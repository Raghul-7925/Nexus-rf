package com.nexusrf.app.domain.model

/**
 * Unified domain model for a single detected cell.
 * Populated by CellMonitor from netmonster-core's raw Cell objects.
 */
data class LiveCell(
    // ── Identity ──────────────────────────────────────────
    val technology: Technology,         // GSM / WCDMA / LTE / NR
    val isServing: Boolean,             // true = phone is connected to this cell

    val mcc: Int?,                      // Mobile Country Code (India = 404/405)
    val mnc: Int?,                      // Mobile Network Code (Airtel=10, Jio=50, Vi=20, BSNL=1)
    val operatorName: String,           // Resolved from MCC+MNC table

    // ── Cell Identifiers ──────────────────────────────────
    val cid: Long?,                     // Cell Identity (full 28-bit for LTE, 36-bit for NR)
    val eNodeBId: Int?,                 // eNodeB = CID >> 8 (LTE)  or  gNB = NCI >> 12 (NR)
    val sectorId: Int?,                 // Sector = CID & 0xFF (LTE) or NCI & 0xFFF (NR)
    val lac: Int?,                      // Location Area Code (2G/3G)
    val tac: Int?,                      // Tracking Area Code (4G/5G)
    val pci: Int?,                      // Physical Cell ID (0-503 for LTE, 0-1007 for NR)
    val nci: Long?,                     // 36-bit NR Cell Identity (5G only)

    // ── Frequency / Band ──────────────────────────────────
    val arfcn: Int?,                    // ARFCN / EARFCN / NR-ARFCN
    val bandName: String?,              // e.g. "B3 (1800 MHz)", "n78 (3500 MHz)"
    val freqMhz: Double?,               // Carrier centre frequency

    // ── Signal Metrics ────────────────────────────────────
    val rsrp: Int?,                     // LTE/NR: Reference Signal Received Power (dBm)
    val rsrq: Int?,                     // LTE/NR: Reference Signal Received Quality (dB)
    val sinr: Int?,                     // LTE/NR: Signal to Interference + Noise Ratio (dB)
    val rssi: Int?,                     // GSM/WCDMA/LTE: Received Signal Strength Indicator
    val rscp: Int?,                     // WCDMA: Received Signal Code Power (dBm)
    val ecIo: Double?,                  // WCDMA: Ec/Io (dB)
    val ssRsrp: Int?,                   // 5G NR: SS-RSRP (dBm)
    val csiRsrp: Int?,                  // 5G NR: CSI-RSRP (dBm)
    val cqi: Int?,                      // LTE: Channel Quality Indicator (0-15)

    // ── Timing Advance (key for tower location!) ──────────
    val timingAdvance: Int?,            // TA in units → distance ≈ TA × 78.12m
    val distanceFromTaM: Double?,       // Computed: TA * 78.12 (metres)

    // ── Carrier Aggregation ───────────────────────────────
    val isAggregated: Boolean = false,  // true if this is a secondary CC
    val aggregatedBands: List<String> = emptyList(), // e.g. ["B3","B1","B40"]

    // ── Signal quality label ──────────────────────────────
    val signalLevel: SignalLevel = SignalLevel.UNKNOWN
)

enum class Technology(val displayName: String) {
    GSM("2G"),
    WCDMA("3G"),
    TDSCDMA("3G TD"),
    LTE("4G"),
    NR_NSA("5G NSA"),
    NR_SA("5G SA"),
    UNKNOWN("?")
}

enum class SignalLevel {
    EXCELLENT,   // RSRP > -85 dBm
    GOOD,        // -85 to -95
    FAIR,        // -95 to -105
    POOR,        // -105 to -115
    NONE,        // < -115
    UNKNOWN
}

/** Physical tower looked up from Nexus RF (Tarang Sanchar baseline) or MANTA estimate */
data class TowerLocation(
    val id: String,
    val lat: Double,
    val lng: Double,
    val operator: String?,
    val technology: String?,
    val bandName: String?,
    val freqMhz: Double?,
    val heightM: Double?,
    val azimuthDeg: Double?,
    val siteId: String?,
    val eNodeBId: Int?,
    val source: TowerSource,
    val distanceKm: Double? = null   // from current GPS
)

enum class TowerSource {
    TARANG_SANCHAR,   // From India government database (exact, reliable)
    MANTA_ESTIMATED,  // Computed by multilateration algorithm (approximate)
    MANUAL            // User-added
}

/** One recorded point during a drive-test session */
data class DriveLogPoint(
    val id: Long = 0,
    val sessionId: String,
    val timestamp: Long,
    val lat: Double,
    val lng: Double,
    val gpsAccuracyM: Float,
    val operator: String?,
    val technology: String?,
    val bandName: String?,
    val cid: Long?,
    val eNodeBId: Int?,
    val pci: Int?,
    val rsrp: Int?,
    val rsrq: Int?,
    val sinr: Int?,
    val timingAdvance: Int?,
    val distanceFromTaM: Double?
)

/** State for the MANTA locate-transmitter algorithm */
data class MantaState(
    val isRunning: Boolean = false,
    val bucketsFilled: Int = 0,     // spatial grid cells visited (need ≥ 4)
    val bucketsNeeded: Int = 4,
    val measurements: List<MantaMeasurement> = emptyList(),
    val estimatedTower: EstimatedTower? = null
)

data class MantaMeasurement(
    val lat: Double,
    val lng: Double,
    val timingAdvance: Int,         // TA (each unit ≈ 78.12m)
    val radiusM: Double,            // TA * 78.12
    val rsrp: Int,
    val gpsAccuracyM: Float,
    val hits: Int = 1
)

data class EstimatedTower(
    val lat: Double,
    val lng: Double,
    val accuracyM: Double,
    val confidence: Float           // 0.0 – 1.0
)
