package com.nexusrf.app.data.repository

import android.annotation.SuppressLint
import android.content.Context
import android.telephony.TelephonyManager
import app.netmonster.core.NetMonster
import app.netmonster.core.model.cell.*
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import javax.inject.Inject
import javax.inject.Singleton
import com.nexusrf.app.domain.model.*

/**
 * CellMonitor wraps netmonster-core and emits a clean StateFlow<List<LiveCell>>
 * that the UI and MANTA engine consume.
 *
 * netmonster-core handles all the manufacturer quirks (Samsung, Qualcomm, MediaTek
 * modem differences), validates the data, and gives us correct eNodeB IDs, PCI,
 * RSRP, RSRQ, SINR, and Timing Advance even on Android 7.0 (API 24).
 */
@Singleton
class CellMonitor @Inject constructor(
    @ApplicationContext private val context: Context
) {
    // ── State flows ───────────────────────────────────────────────
    private val _cells = MutableStateFlow<List<LiveCell>>(emptyList())
    val cells: StateFlow<List<LiveCell>> = _cells.asStateFlow()

    /** The primary serving cell (first cell with isServing=true) */
    val servingCell: StateFlow<LiveCell?> = cells
        .map { list -> list.firstOrNull { it.isServing } }
        .stateIn(CoroutineScope(Dispatchers.Default), SharingStarted.Eagerly, null)

    private var monitorJob: Job? = null

    /**
     * Start polling netmonster-core every [intervalMs] milliseconds.
     * Returns immediately; emits live data through [cells] StateFlow.
     *
     * Must be called from a coroutine scope (Application / ViewModel scope).
     */
    @SuppressLint("MissingPermission")
    fun startMonitoring(scope: CoroutineScope, intervalMs: Long = 2000L) {
        if (monitorJob?.isActive == true) return
        monitorJob = scope.launch(Dispatchers.IO) {
            val netMonster = NetMonster.get(context)
            while (isActive) {
                try {
                    val rawCells = netMonster.getCells()
                    _cells.value = rawCells.mapNotNull { it.toLiveCell() }
                } catch (e: SecurityException) {
                    // Permissions revoked at runtime — stop quietly
                    _cells.value = emptyList()
                    break
                } catch (e: Exception) {
                    // Modem temporary error — keep retrying
                }
                delay(intervalMs)
            }
        }
    }

    fun stopMonitoring() {
        monitorJob?.cancel()
        monitorJob = null
        _cells.value = emptyList()
    }
}

// ══════════════════════════════════════════════════════════════════
//  Mapping: netmonster-core Cell → our domain LiveCell
// ══════════════════════════════════════════════════════════════════

private fun ICell.toLiveCell(): LiveCell? = when (this) {

    is CellLte -> LiveCell(
        technology = Technology.LTE,
        isServing = connectionStatus is PrimaryConnection,
        mcc = network?.mcc?.toIntOrNull(),
        mnc = network?.mnc?.toIntOrNull(),
        operatorName = network.toOperatorName(),
        cid = cellIdentity.eci?.toLong(),
        eNodeBId = cellIdentity.eci?.let { it shr 8 },
        sectorId = cellIdentity.eci?.let { it and 0xFF },
        lac = null,
        tac = cellIdentity.tac,
        pci = cellIdentity.pci,
        nci = null,
        arfcn = cellIdentity.earfcn,
        bandName = band?.let { "B${it.number} (${it.downlinkFrequency / 1000} MHz)" },
        freqMhz = band?.downlinkFrequency?.let { it / 1000.0 },
        rsrp = signal.rsrp?.toInt(),
        rsrq = signal.rsrq?.toInt(),
        sinr = signal.snr?.toInt(),
        rssi = signal.rssi?.toInt(),
        rscp = null,
        ecIo = null,
        ssRsrp = null,
        csiRsrp = null,
        cqi = signal.cqi?.toInt(),
        timingAdvance = signal.timingAdvance,
        distanceFromTaM = signal.timingAdvance?.let { it * 78.12 },
        isAggregated = connectionStatus is SecondaryConnection,
        signalLevel = signal.rsrp?.toInt().toSignalLevel()
    )

    is CellNr -> LiveCell(
        technology = if (connectionStatus is SecondaryConnection) Technology.NR_NSA else Technology.NR_SA,
        isServing = connectionStatus is PrimaryConnection || connectionStatus is SecondaryConnection,
        mcc = network?.mcc?.toIntOrNull(),
        mnc = network?.mnc?.toIntOrNull(),
        operatorName = network.toOperatorName(),
        cid = null,
        eNodeBId = null,
        sectorId = null,
        lac = null,
        tac = cellIdentity.tac,
        pci = cellIdentity.pci,
        nci = cellIdentity.nci,
        arfcn = cellIdentity.nrarfcn,
        bandName = band?.let { "n${it.number} (${it.downlinkFrequency / 1000} MHz)" },
        freqMhz = band?.downlinkFrequency?.let { it / 1000.0 },
        rsrp = null,
        rsrq = null,
        sinr = null,
        rssi = null,
        rscp = null,
        ecIo = null,
        ssRsrp = signal.ssRsrp?.toInt(),
        csiRsrp = signal.csiRsrp?.toInt(),
        cqi = null,
        timingAdvance = null,
        distanceFromTaM = null,
        isAggregated = connectionStatus is SecondaryConnection,
        signalLevel = signal.ssRsrp?.toInt().toSignalLevel()
    )

    is CellWcdma -> LiveCell(
        technology = Technology.WCDMA,
        isServing = connectionStatus is PrimaryConnection,
        mcc = network?.mcc?.toIntOrNull(),
        mnc = network?.mnc?.toIntOrNull(),
        operatorName = network.toOperatorName(),
        cid = cellIdentity.ci?.toLong(),
        eNodeBId = cellIdentity.rnc,
        sectorId = null,
        lac = cellIdentity.lac,
        tac = null,
        pci = null,
        nci = null,
        arfcn = cellIdentity.uarfcn,
        bandName = band?.let { "B${it.number} (${it.downlinkFrequency / 1000} MHz)" },
        freqMhz = band?.downlinkFrequency?.let { it / 1000.0 },
        rsrp = null,
        rsrq = null,
        sinr = null,
        rssi = signal.rssi?.toInt(),
        rscp = signal.rscp?.toInt(),
        ecIo = signal.ecio?.toDouble(),
        ssRsrp = null,
        csiRsrp = null,
        cqi = null,
        timingAdvance = null,
        distanceFromTaM = null,
        signalLevel = signal.rscp?.toInt().toSignalLevel()
    )

    is CellGsm -> LiveCell(
        technology = Technology.GSM,
        isServing = connectionStatus is PrimaryConnection,
        mcc = network?.mcc?.toIntOrNull(),
        mnc = network?.mnc?.toIntOrNull(),
        operatorName = network.toOperatorName(),
        cid = cellIdentity.cid?.toLong(),
        eNodeBId = null,
        sectorId = null,
        lac = cellIdentity.lac,
        tac = null,
        pci = null,
        nci = null,
        arfcn = cellIdentity.arfcn,
        bandName = null,
        freqMhz = null,
        rsrp = null,
        rsrq = null,
        sinr = null,
        rssi = signal.rssi?.toInt(),
        rscp = null,
        ecIo = null,
        ssRsrp = null,
        csiRsrp = null,
        cqi = null,
        timingAdvance = signal.timingAdvance,
        distanceFromTaM = signal.timingAdvance?.let { it * 550.0 }, // GSM TA = 550m/unit
        signalLevel = signal.rssi?.toInt().toRssiSignalLevel()
    )

    else -> null // TdScdma / Cdma — not common in India
}

// ── Helper extensions ────────────────────────────────────────────

private fun app.netmonster.core.model.Network?.toOperatorName(): String {
    if (this == null) return "Unknown"
    // MCC+MNC to operator name table (India)
    return when ("${mcc}${mnc}") {
        "40410" -> "Airtel"
        "40445" -> "Airtel"
        "40449" -> "Airtel"
        "40420" -> "Vi (Vodafone)"
        "40420" -> "Vi (Idea)"
        "40470" -> "Vi"
        "40486" -> "Vodafone"
        "40441" -> "Aircel"
        "40443" -> "Vodafone"
        "40450" -> "Reliance Jio"
        "40460" -> "Idea"
        "40001" -> "BSNL"
        "40007" -> "BSNL"
        "40016" -> "Airtel"
        "40030" -> "Aircel"
        "40034" -> "Jio"
        "40488" -> "Jio"
        "40489" -> "Jio"
        "40490" -> "Jio"
        "40491" -> "Jio"
        "40492" -> "Jio"
        "40493" -> "Jio"
        "40496" -> "Jio"
        "40497" -> "Jio"
        "40498" -> "Jio"
        "40499" -> "Jio"
        "40500" -> "Vi"
        else -> "MCC${mcc}-MNC${mnc}"
    }
}

/**
 * RSRP → SignalLevel mapping using 3GPP TS 38.133 thresholds:
 * Excellent ≥ -85, Good -85 to -95, Fair -95 to -105, Poor -105 to -115, None < -115
 */
private fun Int?.toSignalLevel(): SignalLevel = when {
    this == null -> SignalLevel.UNKNOWN
    this >= -85 -> SignalLevel.EXCELLENT
    this >= -95 -> SignalLevel.GOOD
    this >= -105 -> SignalLevel.FAIR
    this >= -115 -> SignalLevel.POOR
    else -> SignalLevel.NONE
}

private fun Int?.toRssiSignalLevel(): SignalLevel = when {
    this == null -> SignalLevel.UNKNOWN
    this >= -65 -> SignalLevel.EXCELLENT
    this >= -75 -> SignalLevel.GOOD
    this >= -85 -> SignalLevel.FAIR
    this >= -95 -> SignalLevel.POOR
    else -> SignalLevel.NONE
}
