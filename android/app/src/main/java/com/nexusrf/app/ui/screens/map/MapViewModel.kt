package com.nexusrf.app.ui.screens.map

import android.location.Location
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexusrf.app.data.local.TowerDao
import com.nexusrf.app.data.local.TowerEntity
import com.nexusrf.app.data.remote.CompareRequestDto
import com.nexusrf.app.data.remote.NexusApiService
import com.nexusrf.app.data.repository.CellMonitor
import com.nexusrf.app.data.repository.LocationProvider
import com.nexusrf.app.domain.model.LiveCell
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MapViewModel @Inject constructor(
    private val cellMonitor: CellMonitor,
    private val towerDao: TowerDao,
    private val locationProvider: LocationProvider,
    private val api: NexusApiService
) : ViewModel() {

    val towers: StateFlow<List<TowerEntity>> = towerDao.getAllTowers()
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val servingCell: StateFlow<LiveCell?> = cellMonitor.servingCell

    val userLocation: StateFlow<Location?> = locationProvider.locationUpdates
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    private val _sourceFilter = MutableStateFlow("all")
    val sourceFilter: StateFlow<String> = _sourceFilter.asStateFlow()

    private val _ispResults = MutableStateFlow<List<IspResult>>(emptyList())
    val ispResults: StateFlow<List<IspResult>> = _ispResults.asStateFlow()

    init {
        // Auto-fetch ISP comparison whenever location changes
        viewModelScope.launch {
            userLocation.filterNotNull().collect { loc ->
                fetchIspComparison(loc.latitude, loc.longitude)
            }
        }
    }

    fun setSourceFilter(filter: String) { _sourceFilter.value = filter }

    private fun fetchIspComparison(lat: Double, lng: Double) {
        viewModelScope.launch {
            try {
                val resp = api.compareISP(
                    CompareRequestDto(lat = lat, lng = lng, radiusKm = 5.0, sortBy = "balanced")
                )
                if (resp.isSuccessful) {
                    _ispResults.value = resp.body()?.results?.mapIndexed { idx, item ->
                        IspResult(
                            operator = item.operator,
                            signalDbm = item.rxDbm.toInt(),
                            technology = item.technology,
                            score = item.balancedScore,
                            rank = idx + 1
                        )
                    } ?: emptyList()
                }
            } catch (_: Exception) { /* offline — silent */ }
        }
    }
}
