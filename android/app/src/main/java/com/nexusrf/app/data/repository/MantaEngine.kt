package com.nexusrf.app.data.repository

import android.location.Location
import com.nexusrf.app.data.local.MantaCellEntity
import com.nexusrf.app.data.local.MantaDao
import com.nexusrf.app.domain.model.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.*

/**
 * MANTA Transmitter Location Engine
 *
 * Reverse-engineered from netmonster.apk classes3.dex (MantaProcessor.kt,
 * MantaCalibrator.kt, MantaGraphics.kt).
 *
 * Algorithm overview:
 * 1. Collect GPS+TA samples across ≥4 distinct spatial buckets (0.002°×0.002° grid)
 * 2. Once threshold is met, run weighted least-squares penalty minimizer:
 *    penalty(x,y) = Σ weight_i × |distance(x,y, gps_i) - TA_i×78.12|²
 *    where weight_i = hits_i / accuracy_i² (higher GPS accuracy = more trust)
 * 3. Gradient descent from centroid of GPS points toward minimum penalty
 * 4. Emit EstimatedTower when error < convergenceThresholdM
 */
@Singleton
class MantaEngine @Inject constructor(
    private val mantaDao: MantaDao
) {
    companion object {
        const val BUCKET_SIZE_DEG = 0.002          // ~220m grid cell
        const val TA_METRES_PER_UNIT = 78.12       // LTE: 16×Ts×c / 2 ≈ 78.12m
        const val MIN_BUCKETS_NEEDED = 4           // from APK SQL: HAVING count > 3
        const val GRADIENT_STEP = 0.0001           // ~11m per gradient step
        const val MAX_ITERATIONS = 3000
        const val CONVERGENCE_THRESHOLD_M = 150.0  // stop when penalty gradient < 150m
        const val RSRP_DISTANCE_FACTOR = 0.01      // attenuation correction
    }

    private val _state = MutableStateFlow(MantaState())
    val state: StateFlow<MantaState> = _state.asStateFlow()

    private var engineJob: Job? = null
    private var currentENodeB: Int = -1
    private var currentMcc: Int = 0
    private var currentMnc: Int = 0

    /** Call this every time a new GPS+cell sample arrives */
    suspend fun addMeasurement(
        location: Location,
        servingCell: LiveCell,
        scope: CoroutineScope
    ) {
        val eNodeBId = servingCell.eNodeBId ?: return
        val mcc = servingCell.mcc ?: return
        val mnc = servingCell.mnc ?: return
        val ta = servingCell.timingAdvance ?: return
        val rsrp = servingCell.rsrp ?: -100

        // Quantize into spatial bucket
        val latBucket = (location.latitude / BUCKET_SIZE_DEG).toLong() * BUCKET_SIZE_DEG
        val lonBucket = (location.longitude / BUCKET_SIZE_DEG).toLong() * BUCKET_SIZE_DEG

        // If switched to a different eNodeB, reset MANTA state
        if (eNodeBId != currentENodeB || mcc != currentMcc || mnc != currentMnc) {
            currentENodeB = eNodeBId
            currentMcc = mcc
            currentMnc = mnc
            mantaDao.clearCellBuckets(eNodeBId, mcc, mnc)
            _state.value = MantaState(isRunning = true)
        }

        // Upsert bucket
        val existing = mantaDao.getBucketsForCell(eNodeBId, mcc, mnc)
        val matchingBucket = existing.find {
            abs(it.latBucket - latBucket) < 0.0001 && abs(it.lonBucket - lonBucket) < 0.0001
        }

        if (matchingBucket != null) {
            mantaDao.upsertBucket(matchingBucket.copy(hits = matchingBucket.hits + 1))
        } else {
            mantaDao.upsertBucket(
                MantaCellEntity(
                    eNodeBId = eNodeBId, mcc = mcc, mnc = mnc,
                    lat = location.latitude, lon = location.longitude,
                    latBucket = latBucket, lonBucket = lonBucket,
                    technology = when (servingCell.technology) {
                        Technology.LTE -> "l"
                        Technology.NR_NSA, Technology.NR_SA -> "nr"
                        else -> "l"
                    },
                    arfcn = servingCell.arfcn,
                    ta = ta, rsrp = rsrp,
                    gpsAccuracyM = location.accuracy
                )
            )
        }

        // Count distinct buckets with valid TA
        val bucketCount = mantaDao.countUniqueBuckets(eNodeBId, mcc, mnc)
        val measurements = mantaDao.getBucketsForCell(eNodeBId, mcc, mnc)
            .map {
                MantaMeasurement(
                    lat = it.lat, lng = it.lon,
                    timingAdvance = it.ta,
                    radiusM = it.ta * TA_METRES_PER_UNIT,
                    rsrp = it.rsrp,
                    gpsAccuracyM = it.gpsAccuracyM,
                    hits = it.hits
                )
            }

        _state.value = _state.value.copy(
            isRunning = true,
            bucketsFilled = bucketCount,
            measurements = measurements
        )

        // Trigger calibration when we have enough spatial diversity
        if (bucketCount >= MIN_BUCKETS_NEEDED) {
            engineJob?.cancel()
            engineJob = scope.launch(Dispatchers.Default) {
                val estimated = calibrate(measurements)
                if (estimated != null) {
                    _state.value = _state.value.copy(estimatedTower = estimated)
                }
            }
        }
    }

    /**
     * Weighted least-squares penalty minimizer.
     *
     * Finds (lat, lng) that minimises:
     *   Σ_i  (hits_i / accuracy_i²)  ×  |d(lat,lng → gps_i) − TA_i × 78.12|²
     *
     * Uses gradient descent starting from the GPS centroid.
     * Weight = hits/accuracy² so high-accuracy, repeated measurements dominate.
     */
    private fun calibrate(measurements: List<MantaMeasurement>): EstimatedTower? {
        if (measurements.size < MIN_BUCKETS_NEEDED) return null

        // Initial estimate = weighted centroid of GPS positions
        var lat = measurements.sumOf { it.lat * it.hits } / measurements.sumOf { it.hits.toDouble() }
        var lng = measurements.sumOf { it.lng * it.hits } / measurements.sumOf { it.hits.toDouble() }

        val weights = measurements.map { m ->
            (m.hits.toDouble() / (m.gpsAccuracyM * m.gpsAccuracyM).coerceAtLeast(1f).toDouble())
        }
        val totalWeight = weights.sum()

        repeat(MAX_ITERATIONS) { iter ->
            var gradLat = 0.0
            var gradLng = 0.0
            var totalPenalty = 0.0

            measurements.forEachIndexed { i, m ->
                val distM = haversineM(lat, lng, m.lat, m.lng)
                val residual = distM - m.radiusM
                val w = weights[i]
                totalPenalty += w * residual * residual

                // ∂penalty/∂lat, ∂penalty/∂lng via chain rule
                val dlat = latDerivM(lat, lng, m.lat, m.lng)
                val dlng = lngDerivM(lat, lng, m.lat, m.lng)
                gradLat += w * 2.0 * residual * dlat
                gradLng += w * 2.0 * residual * dlng
            }

            val gradMag = sqrt(gradLat * gradLat + gradLng * gradLng)
            if (gradMag < 1e-12) return@repeat

            // Adaptive step (decay with iteration)
            val step = GRADIENT_STEP / (1.0 + iter * 0.002)
            lat -= step * (gradLat / gradMag)
            lng -= step * (gradLng / gradMag)

            // Early convergence check
            if (gradMag * step * 111_320 < CONVERGENCE_THRESHOLD_M && iter > 100) {
                return EstimatedTower(
                    lat = lat, lng = lng,
                    accuracyM = (totalPenalty / totalWeight).pow(0.5),
                    confidence = (1.0 - (gradMag / 1000.0).coerceIn(0.0, 1.0)).toFloat()
                )
            }
        }

        // Didn't fully converge — return best effort
        val finalPenalty = measurements.mapIndexed { i, m ->
            weights[i] * (haversineM(lat, lng, m.lat, m.lng) - m.radiusM).pow(2)
        }.sum()
        return EstimatedTower(
            lat = lat, lng = lng,
            accuracyM = (finalPenalty / totalWeight).pow(0.5).coerceAtMost(500.0),
            confidence = 0.5f
        )
    }

    fun reset() {
        engineJob?.cancel()
        _state.value = MantaState()
    }
}

// ── Math helpers ─────────────────────────────────────────────────

/** Haversine distance in metres between two lat/lng points */
fun haversineM(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val R = 6_371_000.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLng = Math.toRadians(lng2 - lng1)
    val a = sin(dLat / 2).pow(2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2).pow(2)
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))
}

/** Partial derivative of distance w.r.t. lat (metres per degree) */
private fun latDerivM(lat: Double, lng: Double, targetLat: Double, targetLng: Double): Double {
    val d = haversineM(lat, lng, targetLat, targetLng).coerceAtLeast(1.0)
    val dLat = Math.toRadians(targetLat - lat)
    return -6_371_000.0 * dLat / d
}

/** Partial derivative of distance w.r.t. lng (metres per degree) */
private fun lngDerivM(lat: Double, lng: Double, targetLat: Double, targetLng: Double): Double {
    val d = haversineM(lat, lng, targetLat, targetLng).coerceAtLeast(1.0)
    val dLng = Math.toRadians(targetLng - lng)
    return -6_371_000.0 * cos(Math.toRadians(lat)) * dLng / d
}
