package com.nexusrf.app.ui.screens.map

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.android.gms.maps.model.*
import com.google.maps.android.compose.*
import com.nexusrf.app.data.local.TowerEntity
import com.nexusrf.app.domain.model.*
import com.nexusrf.app.ui.theme.*
import kotlin.math.*

// ══════════════════════════════════════════════════════════════════
//  MAP SCREEN — GIS Tower Map + Best ISP Panel
// ══════════════════════════════════════════════════════════════════

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MapScreen(
    onLocateClick: () -> Unit,
    viewModel: MapViewModel = hiltViewModel()
) {
    val towers by viewModel.towers.collectAsStateWithLifecycle()
    val serving by viewModel.servingCell.collectAsStateWithLifecycle()
    val userLocation by viewModel.userLocation.collectAsStateWithLifecycle()
    val ispResults by viewModel.ispResults.collectAsStateWithLifecycle()
    val sourceFilter by viewModel.sourceFilter.collectAsStateWithLifecycle()

    val sheetState = rememberBottomSheetScaffoldState()
    val cameraState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(
            userLocation?.let { LatLng(it.latitude, it.longitude) } ?: LatLng(13.0827, 80.2707),
            13f
        )
    }

    // Auto-pan to user location
    LaunchedEffect(userLocation) {
        userLocation?.let {
            cameraState.animate(
                CameraUpdateFactory.newLatLngZoom(LatLng(it.latitude, it.longitude), 14f),
                durationMs = 800
            )
        }
    }

    BottomSheetScaffold(
        scaffoldState = sheetState,
        sheetPeekHeight = 160.dp,
        sheetContainerColor = NexusDark,
        sheetShape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        sheetContent = {
            IspBottomSheet(ispResults, serving)
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            // ── Dark Google Map ──────────────────────────────────
            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraState,
                properties = MapProperties(
                    mapStyleOptions = MapStyleOptions(DARK_MAP_STYLE),
                    isMyLocationEnabled = false // we draw our own pulsing dot
                ),
                uiSettings = MapUiSettings(
                    zoomControlsEnabled = false,
                    myLocationButtonEnabled = false,
                    compassEnabled = false
                )
            ) {
                // User's pulsing location dot
                userLocation?.let { loc ->
                    Circle(
                        center = LatLng(loc.latitude, loc.longitude),
                        radius = 12.0,
                        fillColor = NexusBlue.copy(alpha = 0.9f),
                        strokeColor = Color.White,
                        strokeWidth = 2f
                    )
                    // Accuracy ring
                    Circle(
                        center = LatLng(loc.latitude, loc.longitude),
                        radius = loc.accuracy.toDouble(),
                        fillColor = NexusBlue.copy(alpha = 0.08f),
                        strokeColor = NexusBlue.copy(alpha = 0.3f),
                        strokeWidth = 1.5f
                    )
                }

                // Tower markers
                val filteredTowers = when (sourceFilter) {
                    "real" -> towers.filter { it.source.contains("tarangsanchar") }
                    "test" -> towers.filter { it.source in listOf("user_test", "rf_planned", "manual") }
                    else -> towers
                }
                filteredTowers.forEach { tower ->
                    TowerMarker(tower, serving)
                }

                // Draw bearing line from user to serving tower
                val servingTower = serving?.let { cell ->
                    towers.find { t ->
                        t.eNodeBId != null && t.eNodeBId == cell.eNodeBId
                    }
                }
                if (userLocation != null && servingTower != null) {
                    Polyline(
                        points = listOf(
                            LatLng(userLocation!!.latitude, userLocation!!.longitude),
                            LatLng(servingTower.lat, servingTower.lng)
                        ),
                        color = operatorColor(serving?.operatorName).copy(alpha = 0.7f),
                        width = 3f,
                        pattern = listOf(Dash(12f), Gap(8f))
                    )
                }
            }

            // ── Source filter pills (top overlay) ───────────────
            Column(modifier = Modifier.align(Alignment.TopStart).padding(12.dp)) {
                FilterPills(sourceFilter) { viewModel.setSourceFilter(it) }
            }

            // ── Locate Transmitter FAB ───────────────────────────
            FloatingActionButton(
                onClick = onLocateClick,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 16.dp, bottom = 180.dp),
                containerColor = NexusBlue,
                contentColor = Color.White,
                shape = RoundedCornerShape(16.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.MyLocation, contentDescription = null, modifier = Modifier.size(18.dp))
                    Text("Locate", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }
    }
}

// ── Tower marker with sector cone ────────────────────────────────

@Composable
private fun MapScope.TowerMarker(tower: TowerEntity, serving: LiveCell?) {
    val opColor = operatorColor(tower.operator)
    val isServing = serving?.eNodeBId != null && tower.eNodeBId == serving.eNodeBId

    // Sector cone (if azimuth is known)
    if (tower.azimuthDeg != null) {
        val coneAngle = 120.0  // ±60° half-beamwidth
        Polygon(
            points = sectorPolygon(
                center = LatLng(tower.lat, tower.lng),
                azimuthDeg = tower.azimuthDeg,
                halfWidthDeg = coneAngle / 2,
                radiusM = 800.0
            ),
            fillColor = opColor.copy(alpha = if (isServing) 0.18f else 0.08f),
            strokeColor = opColor.copy(alpha = if (isServing) 0.5f else 0.2f),
            strokeWidth = 1.5f
        )
    }

    // Tower pin
    Marker(
        state = MarkerState(LatLng(tower.lat, tower.lng)),
        title = "${tower.operator ?: "Unknown"} — ${tower.technology ?: ""}",
        snippet = "eNB ${tower.eNodeBId ?: tower.siteId} | ${tower.bandName ?: ""}",
        anchor = Offset(0.5f, 1.0f)
    )
}

// ── ISP Bottom Sheet ──────────────────────────────────────────────

@Composable
private fun IspBottomSheet(
    results: List<IspResult>,
    serving: LiveCell?
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        // Drag handle
        Box(
            modifier = Modifier
                .align(Alignment.CenterHorizontally)
                .width(40.dp)
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(NexusCardEdge)
        )
        Spacer(Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = NexusBlue, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text("Best ISP Nearby", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 16.sp)
        }
        Spacer(Modifier.height(12.dp))

        if (results.isEmpty()) {
            Text(
                "Waiting for location to fetch ISP rankings…",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 13.sp
            )
        } else {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(results.take(4)) { isp ->
                    IspCard(isp, isServing = isp.operator == serving?.operatorName)
                }
            }
        }
    }
}

@Composable
private fun IspCard(isp: IspResult, isServing: Boolean) {
    val opColor = operatorColor(isp.operator)
    Card(
        modifier = Modifier.width(130.dp),
        colors = CardDefaults.cardColors(containerColor = NexusCard),
        shape = RoundedCornerShape(14.dp),
        border = if (isServing) BorderStroke(1.5.dp, opColor) else BorderStroke(1.dp, NexusCardEdge)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (isp.rank == 1) {
                Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = Color(0xFFF59E0B), modifier = Modifier.size(20.dp))
            }
            Text(isp.operator, fontWeight = FontWeight.Bold, color = opColor, fontSize = 13.sp)
            Spacer(Modifier.height(4.dp))
            Text("${isp.signalDbm} dBm", fontSize = 12.sp, color = rsrpColor(isp.signalDbm))
            Text(isp.technology ?: "", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(6.dp))
            LinearProgressIndicator(
                progress = { (isp.score / 100f).coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)),
                color = opColor,
                trackColor = NexusCardEdge
            )
            Text("Score ${isp.score.toInt()}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// ── Filter pills ──────────────────────────────────────────────────

@Composable
private fun FilterPills(active: String, onSelect: (String) -> Unit) {
    val options = listOf("all" to "All", "real" to "🏛 Real", "test" to "🧪 Test/Plan")
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(NexusDark.copy(alpha = 0.85f))
            .padding(horizontal = 6.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        options.forEach { (key, label) ->
            val sel = active == key
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(16.dp))
                    .background(if (sel) NexusBlue else Color.Transparent)
                    .clickable { onSelect(key) }
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(label, color = if (sel) Color.White else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, fontWeight = if (sel) FontWeight.Bold else FontWeight.Normal)
            }
        }
    }
}

// ── Data classes ─────────────────────────────────────────────────

data class IspResult(
    val operator: String,
    val signalDbm: Int,
    val technology: String?,
    val score: Double,
    val rank: Int
)

// ── Sector polygon builder ────────────────────────────────────────

private fun sectorPolygon(
    center: LatLng,
    azimuthDeg: Double,
    halfWidthDeg: Double,
    radiusM: Double
): List<LatLng> {
    val points = mutableListOf<LatLng>(center)
    val steps = 16
    val startBearing = azimuthDeg - halfWidthDeg
    val endBearing = azimuthDeg + halfWidthDeg
    for (i in 0..steps) {
        val bearing = startBearing + (endBearing - startBearing) * i / steps
        points.add(destinationPoint(center.latitude, center.longitude, bearing, radiusM))
    }
    points.add(center)
    return points
}

private fun destinationPoint(lat: Double, lng: Double, bearingDeg: Double, distanceM: Double): LatLng {
    val R = 6371000.0
    val d = distanceM / R
    val brg = Math.toRadians(bearingDeg)
    val lat1 = Math.toRadians(lat)
    val lon1 = Math.toRadians(lng)
    val lat2 = asin(sin(lat1) * cos(d) + cos(lat1) * sin(d) * cos(brg))
    val lon2 = lon1 + atan2(sin(brg) * sin(d) * cos(lat1), cos(d) - sin(lat1) * sin(lat2))
    return LatLng(Math.toDegrees(lat2), Math.toDegrees(lon2))
}

// ── Dark map style (mirrors our web MapView dark tiles) ──────────
private val DARK_MAP_STYLE = """
[
  {"elementType":"geometry","stylers":[{"color":"#0A0F1E"}]},
  {"elementType":"labels.icon","stylers":[{"visibility":"off"}]},
  {"elementType":"labels.text.fill","stylers":[{"color":"#516A89"}]},
  {"elementType":"labels.text.stroke","stylers":[{"color":"#0A0F1E"}]},
  {"featureType":"road","elementType":"geometry","stylers":[{"color":"#1E293B"}]},
  {"featureType":"road.arterial","elementType":"geometry","stylers":[{"color":"#253347"}]},
  {"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#334155"}]},
  {"featureType":"water","elementType":"geometry","stylers":[{"color":"#0D1B2A"}]},
  {"featureType":"poi","stylers":[{"visibility":"off"}]}
]
""".trimIndent()
