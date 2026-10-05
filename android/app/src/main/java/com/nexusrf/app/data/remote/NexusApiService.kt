package com.nexusrf.app.data.remote

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import retrofit2.Response
import retrofit2.http.*

// ══════════════════════════════════════════════════════════════════
//  Retrofit service — mirrors existing FastAPI Nexus RF backend
// ══════════════════════════════════════════════════════════════════

interface NexusApiService {

    /** Health check — used to verify backend connectivity */
    @GET("api/health")
    suspend fun health(): Response<HealthResponse>

    /** Get all towers (optionally filtered by source) */
    @GET("api/towers")
    suspend fun getTowers(
        @Query("source") source: String? = null
    ): Response<List<TowerDto>>

    /** Locate a tower by eNodeB + MCC/MNC (resolves from Tarang Sanchar baseline) */
    @GET("api/mobile/locate-tower")
    suspend fun locateTower(
        @Query("mcc") mcc: Int,
        @Query("mnc") mnc: Int,
        @Query("cid") cid: Long? = null,
        @Query("enb") eNodeBId: Int? = null
    ): Response<TowerDto?>

    /** Sync a drive-test session to the web dashboard */
    @POST("api/mobile/drive-test/sync")
    suspend fun syncDriveTest(@Body payload: DriveTestSyncDto): Response<SyncResultDto>

    /** Get offline pack — all towers near a lat/lng for offline use */
    @GET("api/mobile/offline-pack")
    suspend fun getOfflinePack(
        @Query("lat") lat: Double,
        @Query("lng") lng: Double,
        @Query("radius_km") radiusKm: Double = 25.0
    ): Response<List<TowerDto>>

    /** ISP comparison at a location */
    @POST("api/compare")
    suspend fun compareISP(@Body request: CompareRequestDto): Response<CompareResponseDto>
}

// ── DTOs (match existing backend schemas.py exactly) ──────────────

@JsonClass(generateAdapter = true)
data class HealthResponse(@Json(name = "status") val status: String)

@JsonClass(generateAdapter = true)
data class TowerDto(
    @Json(name = "id") val id: String,
    @Json(name = "name") val name: String,
    @Json(name = "lat") val lat: Double,
    @Json(name = "lng") val lng: Double,
    @Json(name = "operator") val operator: String?,
    @Json(name = "technology") val technology: String?,
    @Json(name = "freq_mhz") val freqMhz: Double?,
    @Json(name = "bandwidth_mhz") val bandwidthMhz: Double?,
    @Json(name = "height_m") val heightM: Double?,
    @Json(name = "power_dbm") val powerDbm: Double?,
    @Json(name = "azimuth_deg") val azimuthDeg: Double?,
    @Json(name = "tower_type") val towerType: String?,
    @Json(name = "source") val source: String?,
    @Json(name = "cell_id") val cellId: String?,
    @Json(name = "site_id") val siteId: String?,
    @Json(name = "pci") val pci: String?,
    @Json(name = "area") val area: String?,
    @Json(name = "channel") val channel: Double?,
    @Json(name = "location_name") val locationName: String?
)

@JsonClass(generateAdapter = true)
data class DriveTestSyncDto(
    @Json(name = "session_id") val sessionId: String,
    @Json(name = "points") val points: List<DrivePointDto>
)

@JsonClass(generateAdapter = true)
data class DrivePointDto(
    @Json(name = "timestamp") val timestamp: Long,
    @Json(name = "lat") val lat: Double,
    @Json(name = "lng") val lng: Double,
    @Json(name = "gps_accuracy_m") val gpsAccuracyM: Float,
    @Json(name = "operator") val operator: String?,
    @Json(name = "technology") val technology: String?,
    @Json(name = "band_name") val bandName: String?,
    @Json(name = "cid") val cid: Long?,
    @Json(name = "enodeb_id") val eNodeBId: Int?,
    @Json(name = "pci") val pci: Int?,
    @Json(name = "rsrp") val rsrp: Int?,
    @Json(name = "rsrq") val rsrq: Int?,
    @Json(name = "sinr") val sinr: Int?,
    @Json(name = "timing_advance") val timingAdvance: Int?
)

@JsonClass(generateAdapter = true)
data class SyncResultDto(
    @Json(name = "session_id") val sessionId: String,
    @Json(name = "points_saved") val pointsSaved: Int
)

@JsonClass(generateAdapter = true)
data class CompareRequestDto(
    @Json(name = "lat") val lat: Double,
    @Json(name = "lng") val lng: Double,
    @Json(name = "radius_km") val radiusKm: Double = 5.0,
    @Json(name = "sort_by") val sortBy: String = "balanced",
    @Json(name = "model") val model: String = "cost231",
    @Json(name = "environment") val environment: String = "urban",
    @Json(name = "data_source") val dataSource: String = "verified"
)

@JsonClass(generateAdapter = true)
data class CompareResponseDto(
    @Json(name = "results") val results: List<CompareItemDto>
)

@JsonClass(generateAdapter = true)
data class CompareItemDto(
    @Json(name = "operator") val operator: String,
    @Json(name = "rx_dbm") val rxDbm: Double,
    @Json(name = "freq_mhz") val freqMhz: Double,
    @Json(name = "technology") val technology: String?,
    @Json(name = "distance_km") val distanceKm: Double,
    @Json(name = "coverage_score") val coverageScore: Double,
    @Json(name = "speed_score") val speedScore: Double,
    @Json(name = "balanced_score") val balancedScore: Double,
    @Json(name = "bands_available") val bandsAvailable: List<String>,
    @Json(name = "verdict") val verdict: String?
)
