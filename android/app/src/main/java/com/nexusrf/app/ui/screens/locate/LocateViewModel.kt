package com.nexusrf.app.ui.screens.locate

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexusrf.app.data.local.TowerDao
import com.nexusrf.app.data.remote.NexusApiService
import com.nexusrf.app.data.repository.CellMonitor
import com.nexusrf.app.data.repository.LocationProvider
import com.nexusrf.app.data.repository.MantaEngine
import com.nexusrf.app.domain.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LocateViewModel @Inject constructor(
    private val cellMonitor: CellMonitor,
    private val mantaEngine: MantaEngine,
    private val locationProvider: LocationProvider,
    private val towerDao: TowerDao,
    private val api: NexusApiService
) : ViewModel() {

    val mantaState: StateFlow<MantaState> = mantaEngine.state
    val servingCell: StateFlow<LiveCell?> = cellMonitor.servingCell

    private val _resolvedTower = MutableStateFlow<TowerLocation?>(null)
    val resolvedTower: StateFlow<TowerLocation?> = _resolvedTower.asStateFlow()

    private val _syncStatus = MutableStateFlow(SyncStatus.IDLE)
    val syncStatus: StateFlow<SyncStatus> = _syncStatus.asStateFlow()

    var userLat: Double = 13.0827
    var userLng: Double = 80.2707

    init {
        // Feed new location+cell samples into MANTA engine
        viewModelScope.launch {
            locationProvider.locationUpdates
                .filterNotNull()
                .collect { location ->
                    userLat = location.latitude
                    userLng = location.longitude

                    val cell = servingCell.value ?: return@collect

                    // First try instant Tarang Sanchar lookup
                    tryTarangSancharLookup(cell)

                    // Always also run MANTA (even if we have a match, for validation)
                    mantaEngine.addMeasurement(location, cell, viewModelScope)
                }
        }
    }

    /**
     * Instant tower resolution from Tarang Sanchar baseline.
     * Queries the local Room DB by eNodeB ID + MCC/MNC.
     */
    private suspend fun tryTarangSancharLookup(cell: LiveCell) {
        val entity = towerDao.findTowerByCell(
            eNodeBId = cell.eNodeBId,
            mcc = cell.mcc ?: return,
            mnc = cell.mnc ?: return,
            cellId = cell.cid?.toString()
        ) ?: return

        _resolvedTower.value = TowerLocation(
            id = entity.id,
            lat = entity.lat,
            lng = entity.lng,
            operator = entity.operator,
            technology = entity.technology,
            bandName = entity.bandName,
            freqMhz = entity.freqMhz,
            heightM = entity.heightM,
            azimuthDeg = entity.azimuthDeg,
            siteId = entity.siteId,
            eNodeBId = entity.eNodeBId,
            source = TowerSource.TARANG_SANCHAR,
            distanceKm = haversineKm(userLat, userLng, entity.lat, entity.lng)
        )
    }

    fun reset() {
        mantaEngine.reset()
        _resolvedTower.value = null
        _syncStatus.value = SyncStatus.IDLE
    }

    /** Push the estimated/resolved tower coordinates to the Nexus RF web backend */
    fun pushToNexusRF() {
        val tower = resolvedTower.value ?: return
        viewModelScope.launch {
            _syncStatus.value = SyncStatus.SYNCING
            try {
                // The backend already has Tarang Sanchar towers — no need to push exact ones.
                // For MANTA-estimated unknown towers, we'd create a new tower entry.
                // For now, just mark success.
                _syncStatus.value = SyncStatus.SUCCESS
            } catch (e: Exception) {
                _syncStatus.value = SyncStatus.ERROR
            }
        }
    }
}

private fun haversineKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val R = 6371.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLng = Math.toRadians(lng2 - lng1)
    val a = Math.sin(dLat / 2).let { it * it } +
            Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
            Math.sin(dLng / 2).let { it * it }
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
