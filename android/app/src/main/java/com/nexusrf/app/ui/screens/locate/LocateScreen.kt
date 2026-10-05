package com.nexusrf.app.ui.screens.locate

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.android.gms.maps.model.*
import com.google.maps.android.compose.*
import com.nexusrf.app.domain.model.*
import com.nexusrf.app.ui.theme.*
import kotlin.math.*

// ══════════════════════════════════════════════════════════════════
//  LOCATE TRANSMITTER SCREEN — MANTA Tower Location Engine
// ══════════════════════════════════════════════════════════════════

@Composable
fun LocateTransmitterScreen(
    onNavigateBack: () -> Unit,
    viewModel: LocateViewModel = hiltViewModel()
) {
    val mantaState by viewModel.mantaState.collectAsStateWithLifecycle()
    val serving by viewModel.servingCell.collectAsStateWithLifecycle()
    val resolvedTower by viewModel.resolvedTower.collectAsStateWithLifecycle()
    val syncStatus by viewModel.syncStatus.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(NexusNavy)
    ) {
        // ── Top bar ──────────────────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
            }
            Text("Locate Transmitter", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 18.sp)
            // Stop/Reset button
            TextButton(onClick = { viewModel.reset() }) {
                Text("Reset", color = NexusCyan)
            }
        }

        // ── MANTA progress ring ────────────────────────────────
        MantaProgressRing(mantaState)

        // ── Map (shows GPS breadcrumbs + TA rings + estimated tower) ──
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(horizontal = 12.dp)
                .clip(RoundedCornerShape(20.dp))
        ) {
            MantaMap(mantaState, resolvedTower, viewModel.userLat, viewModel.userLng)
        }

        Spacer(Modifier.height(12.dp))

        // ── TA measurements log ────────────────────────────────
        MantaMeasurementsRow(mantaState.measurements)

        Spacer(Modifier.height(12.dp))

        // ── Resolved tower info (from Tarang Sanchar baseline) ─
        if (resolvedTower != null) {
            ResolvedTowerCard(resolvedTower!!)
        }

        Spacer(Modifier.height(12.dp))

        // ── Push to Nexus RF button ────────────────────────────
        Button(
            onClick = { viewModel.pushToNexusRF() },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .height(52.dp),
            enabled = mantaState.estimatedTower != null || resolvedTower != null,
            colors = ButtonDefaults.buttonColors(containerColor = NexusBlue),
            shape = RoundedCornerShape(14.dp)
        ) {
            Icon(Icons.Default.CloudUpload, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                text = when (syncStatus) {
                    SyncStatus.SYNCING -> "Syncing…"
                    SyncStatus.SUCCESS -> "✓ Pushed to Nexus RF!"
                    SyncStatus.ERROR -> "Retry Push"
                    else -> "Push to Nexus RF"
                },
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp
            )
        }
        Spacer(Modifier.height(16.dp))
    }
}

// ── MANTA progress ring ───────────────────────────────────────────

@Composable
private fun MantaProgressRing(state: MantaState) {
    val fraction = (state.bucketsFilled.toFloat() / state.bucketsNeeded.toFloat()).coerceIn(0f, 1f)
    val animFraction by animateFloatAsState(fraction, animationSpec = tween(600), label = "manta_ring")

    // Pulsing ring when collecting
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.4f, targetValue = 1f, label = "pulse_alpha",
        animationSpec = infiniteRepeatable(tween(900, easing = EaseInOutSine), RepeatMode.Reverse)
    )

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        colors = CardDefaults.cardColors(containerColor = NexusCard),
        shape = RoundedCornerShape(20.dp)
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Progress ring
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .drawWithCache {
                        val stroke = 8f
                        val r = size.minDimension / 2 - stroke
                        onDrawBehind {
                            // Track
                            drawCircle(NexusCardEdge, radius = r, style = Stroke(stroke))
                            // Progress arc
                            drawArc(
                                color = NexusCyan.copy(alpha = if (state.bucketsFilled < state.bucketsNeeded) pulseAlpha else 1f),
                                startAngle = -90f,
                                sweepAngle = 360f * animFraction,
                                useCenter = false,
                                style = Stroke(stroke, cap = StrokeCap.Round)
                            )
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "${state.bucketsFilled}/${state.bucketsNeeded}",
                        fontWeight = FontWeight.Bold,
                        color = NexusCyan,
                        fontSize = 14.sp
                    )
                    Text("spots", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
                }
            }

            // Status text
            Column(Modifier.weight(1f)) {
                Text(
                    text = when {
                        state.estimatedTower != null -> "✓ Tower Located!"
                        state.bucketsFilled >= state.bucketsNeeded -> "Calibrating…"
                        state.isRunning -> "Collecting…"
                        else -> "Waiting for signal"
                    },
                    fontWeight = FontWeight.Bold,
                    color = when {
                        state.estimatedTower != null -> SignalGreen
                        state.isRunning -> NexusCyan
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    fontSize = 15.sp
                )
                Text(
                    text = if (state.bucketsFilled < state.bucketsNeeded)
                        "Move to ${state.bucketsNeeded - state.bucketsFilled} more distinct locations"
                    else
                        "Running multilateration (TA rings)",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 12.sp
                )
                state.estimatedTower?.let {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "±${it.accuracyM.toInt()}m accuracy · ${(it.confidence * 100).toInt()}% confidence",
                        color = SignalGreen,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}

// ── MANTA Map (breadcrumbs + TA rings + estimated pin) ────────────

@Composable
private fun MantaMap(
    state: MantaState,
    resolvedTower: TowerLocation?,
    userLat: Double,
    userLng: Double
) {
    val cameraState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(LatLng(userLat, userLng), 15f)
    }

    GoogleMap(
        modifier = Modifier.fillMaxSize(),
        cameraPositionState = cameraState,
        properties = MapProperties(mapStyleOptions = MapStyleOptions(DARK_MAP_STYLE_SIMPLE)),
        uiSettings = MapUiSettings(zoomControlsEnabled = false, compassEnabled = false)
    ) {
        // GPS breadcrumb trail with TA rings
        state.measurements.forEachIndexed { idx, m ->
            // Breadcrumb dot
            Circle(
                center = LatLng(m.lat, m.lng),
                radius = 8.0,
                fillColor = NexusCyan.copy(alpha = 0.9f),
                strokeColor = Color.White,
                strokeWidth = 1.5f
            )
            // TA ring (the key — shows radius constraint for multilateration)
            Circle(
                center = LatLng(m.lat, m.lng),
                radius = m.radiusM,
                fillColor = NexusCyan.copy(alpha = 0.04f),
                strokeColor = NexusCyan.copy(alpha = 0.3f),
                strokeWidth = 1.5f
            )
        }

        // Estimated tower pin (MANTA result)
        state.estimatedTower?.let { est ->
            Marker(
                state = MarkerState(LatLng(est.lat, est.lng)),
                title = "Estimated Tower",
                snippet = "±${est.accuracyM.toInt()}m accuracy"
            )
            // Accuracy circle
            Circle(
                center = LatLng(est.lat, est.lng),
                radius = est.accuracyM,
                fillColor = NexusBlue.copy(alpha = 0.1f),
                strokeColor = NexusBlue.copy(alpha = 0.5f),
                strokeWidth = 2f
            )
        }

        // Verified tower from Tarang Sanchar (green pin = exact)
        resolvedTower?.let { t ->
            Marker(
                state = MarkerState(LatLng(t.lat, t.lng)),
                title = "${t.operator} — Verified Site",
                snippet = "eNB ${t.eNodeBId} | ${t.bandName ?: ""}"
            )
        }
    }
}

// ── TA measurements log row ───────────────────────────────────────

@Composable
private fun MantaMeasurementsRow(measurements: List<MantaMeasurement>) {
    if (measurements.isEmpty()) return
    Column(modifier = Modifier.padding(horizontal = 16.dp)) {
        Text("TA Measurements", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        Spacer(Modifier.height(6.dp))
        androidx.compose.foundation.lazy.LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(measurements.size) { idx ->
                val m = measurements[idx]
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(NexusCard)
                        .border(1.dp, NexusCyan.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("TA=${m.timingAdvance}", color = NexusCyan, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text("(${m.radiusM.toInt()}m)", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp)
                        Text("${m.rsrp} dBm", color = rsrpColor(m.rsrp), fontSize = 10.sp)
                    }
                }
            }
        }
    }
}

// ── Resolved tower card ───────────────────────────────────────────

@Composable
private fun ResolvedTowerCard(tower: TowerLocation) {
    val opColor = operatorColor(tower.operator)
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        colors = CardDefaults.cardColors(containerColor = NexusCard),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.5.dp, SignalGreen.copy(alpha = 0.5f))
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(Icons.Default.CellTower, contentDescription = null, tint = SignalGreen, modifier = Modifier.size(28.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("🏛 Tarang Sanchar Verified", color = SignalGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Text(
                    "${tower.operator} • eNB ${tower.eNodeBId} • ${tower.bandName ?: ""}",
                    color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Medium
                )
                Text(
                    "${tower.lat.format(5)}, ${tower.lng.format(5)} • ${tower.distanceKm?.let { "%.2fkm away".format(it) } ?: ""}",
                    color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp
                )
            }
        }
    }
}

enum class SyncStatus { IDLE, SYNCING, SUCCESS, ERROR }

private fun Double.format(decimals: Int) = "%.${decimals}f".format(this)

private val DARK_MAP_STYLE_SIMPLE = """
[
  {"elementType":"geometry","stylers":[{"color":"#0F172A"}]},
  {"elementType":"labels.text.fill","stylers":[{"color":"#475569"}]},
  {"featureType":"road","elementType":"geometry","stylers":[{"color":"#1E293B"}]},
  {"featureType":"water","elementType":"geometry","stylers":[{"color":"#0D1B2A"}]},
  {"featureType":"poi","stylers":[{"visibility":"off"}]}
]
""".trimIndent()
