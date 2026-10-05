package com.nexusrf.app.ui.screens.status

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nexusrf.app.data.repository.CellMonitor
import com.nexusrf.app.domain.model.LiveCell
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

@HiltViewModel
class StatusViewModel @Inject constructor(
    private val cellMonitor: CellMonitor
) : ViewModel() {

    val cells: StateFlow<List<LiveCell>> = cellMonitor.cells

    init {
        // CellMonitor is already started from the Application-level scope
        // We just observe its StateFlow here
    }
}
