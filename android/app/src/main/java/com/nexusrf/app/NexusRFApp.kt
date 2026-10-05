package com.nexusrf.app

import android.app.Application
import com.nexusrf.app.data.repository.CellMonitor
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import javax.inject.Inject

@HiltAndroidApp
class NexusRFApp : Application() {

    @Inject lateinit var cellMonitor: CellMonitor

    // Application-scoped coroutine scope — lives for the full app lifetime
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onCreate() {
        super.onCreate()
        // Start cell monitoring at app launch — keeps running across screen/tab changes
        cellMonitor.startMonitoring(appScope, intervalMs = 2000L)
    }
}
