package com.nexusrf.app.ui.screens.status

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexusrf.app.domain.model.*
import com.nexusrf.app.ui.theme.*
import kotlin.math.*

// ══════════════════════════════════════════════════════════════════
//  STATUS SCREEN — Live Modem Telemetry Dashboard
// ══════════════════════════════════════════════════════════════════

@Composable
fun StatusScreen(viewModel: StatusViewModel = hiltViewModel()) {
    val cells by viewModel.cells.collectAsStateWithLifecycle()
    val serving = cells.firstOrNull { it.isServing }
    val neighbors = cells.filter { !it.isServing }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(NexusNavy),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // ── 1. Operator Banner ─────────────────────────────────────
        item {
            OperatorBanner(serving)
        }

        // ── 2. RSRP Gauge (the big speedometer) ───────────────────
        item {
            RsrpGaugeCard(rsrp = serving?.rsrp, technology = serving?.technology)
        }

        // ── 3. Four metric cards ───────────────────────────────────
        item {
            MetricGrid(serving)
        }

        // ── 4. Band / Channel row ──────────────────────────────────
        item {
            BandInfoCard(serving)
        }

        // ── 5. Carrier Aggregation (if active) ────────────────────
        if (serving?.isAggregated == true && serving.aggregatedBands.isNotEmpty()) {
            item { CaCard(serving.aggregatedBands) }
        }

        // ── 6. Neighbor cells ─────────────────────────────────────
        item {
            Text(
                text = "Neighbor Cells (${neighbors.size})",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
        if (neighbors.isEmpty()) {
            item {
                Text(
                    "No neighbor cells detected",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(start = 8.dp)
                )
            }
        } else {
            items(neighbors.take(8)) { cell ->
                NeighborCellRow(cell)
            }
        }
    }
}

// ── Operator banner ───────────────────────────────────────────────

@Composable
private fun OperatorBanner(cell: LiveCell?) {
    val opColor = operatorColor(cell?.operatorName)
    val techLabel = cell?.technology?.displayName ?: "--"
    val nsaLabel = if (cell?.technology == Technology.NR_NSA) " NSA" else
        if (cell?.technology == Technology.NR_SA) " SA" else ""

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(NexusCard)
            .border(1.dp, opColor.copy(alpha = 0.4f), RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column {
            Text(
                text = cell?.operatorName ?: "No Signal",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Text(
                text = if (cell != null) "Active SIM • MCC${cell.mcc} MNC${cell.mnc}" else "Waiting for permissions…",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        // Technology badge
        if (cell != null) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(opColor.copy(alpha = 0.2f))
                    .border(1.dp, opColor, RoundedCornerShape(8.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "$techLabel$nsaLabel",
                    color = opColor,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
            }
        }
    }
}

// ── RSRP Arc Gauge ────────────────────────────────────────────────

@Composable
private fun RsrpGaugeCard(rsrp: Int?, technology: Technology?) {
    val rsrpColor = rsrpColor(rsrp)
    // Animate needle
    val animProgress by animateFloatAsState(
        targetValue = rsrp?.let { ((it + 140f) / 96f).coerceIn(0f, 1f) } ?: 0f,
        animationSpec = tween(800, easing = EaseOutCubic),
        label = "rsrp_needle"
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NexusCard),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 20.dp, horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Draw arc gauge
            Box(
                modifier = Modifier
                    .size(220.dp)
                    .drawWithCache {
                        val strokeW = 18f
                        val radius = (size.minDimension / 2f) - strokeW
                        val startAngle = 150f
                        val sweepMax = 240f
                        onDrawBehind {
                            // Track arc
                            drawArc(
                                color = NexusCardEdge,
                                startAngle = startAngle,
                                sweepAngle = sweepMax,
                                useCenter = false,
                                style = Stroke(strokeW, cap = StrokeCap.Round),
                                topLeft = Offset(center.x - radius, center.y - radius),
                                size = Size(radius * 2, radius * 2)
                            )
                            // Filled arc
                            drawArc(
                                brush = Brush.sweepGradient(
                                    colorStops = arrayOf(
                                        0.0f to SignalRed,
                                        0.5f to SignalAmber,
                                        1.0f to SignalGreen
                                    ),
                                    center = center
                                ),
                                startAngle = startAngle,
                                sweepAngle = sweepMax * animProgress,
                                useCenter = false,
                                style = Stroke(strokeW, cap = StrokeCap.Round),
                                topLeft = Offset(center.x - radius, center.y - radius),
                                size = Size(radius * 2, radius * 2)
                            )
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = rsrp?.let { "$it" } ?: "--",
                        style = MaterialTheme.typography.displayMedium,
                        fontWeight = FontWeight.Black,
                        color = rsrpColor,
                        fontSize = 52.sp
                    )
                    Text(
                        text = "dBm",
                        style = MaterialTheme.typography.bodyMedium,
                        color = rsrpColor.copy(alpha = 0.8f)
                    )
                    Text(
                        text = "RSRP",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Min / Max labels
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("-140", color = SignalRed, fontSize = 11.sp)
                Text("-85", color = SignalAmber, fontSize = 11.sp)
                Text("-44", color = SignalGreen, fontSize = 11.sp)
            }
        }
    }
}

// ── 2×2 Metric Grid ──────────────────────────────────────────────

@Composable
private fun MetricGrid(cell: LiveCell?) {
    val metrics = listOf(
        Triple("RSRQ", cell?.rsrq?.let { "$it dB" } ?: "--", NexusCyan),
        Triple("SINR", cell?.sinr?.let { "$it dB" } ?: "--", NexusTeal),
        Triple("eNodeB", cell?.eNodeBId?.toString() ?: "--", NexusBlue),
        Triple("PCI", cell?.pci?.toString() ?: "--", NexusBlue)
    )
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        metrics.take(2).forEach { (label, value, color) ->
            MetricCard(label, value, color, Modifier.weight(1f))
        }
    }
    Spacer(Modifier.height(10.dp))
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        metrics.drop(2).forEach { (label, value, color) ->
            MetricCard(label, value, color, Modifier.weight(1f))
        }
    }
}

@Composable
private fun MetricCard(label: String, value: String, color: Color, modifier: Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = NexusCard),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = color,
                textAlign = TextAlign.Center
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

// ── Band / Channel info bar ───────────────────────────────────────

@Composable
private fun BandInfoCard(cell: LiveCell?) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NexusCard),
        shape = RoundedCornerShape(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            InfoChip("Band", cell?.bandName ?: "--")
            VerticalDivider(modifier = Modifier.height(32.dp))
            InfoChip("EARFCN", cell?.arfcn?.toString() ?: "--")
            VerticalDivider(modifier = Modifier.height(32.dp))
            InfoChip("CID", cell?.cid?.toString() ?: "--")
            VerticalDivider(modifier = Modifier.height(32.dp))
            InfoChip("TA→Dist", cell?.distanceFromTaM?.let { "${it.toInt()}m" } ?: "--")
        }
    }
}

@Composable
private fun InfoChip(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontWeight = FontWeight.SemiBold, color = Color.White, fontSize = 13.sp)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

// ── Carrier Aggregation Card ──────────────────────────────────────

@Composable
private fun CaCard(bands: List<String>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NexusCard),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, NexusCyan.copy(alpha = 0.5f))
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(Icons.Default.Layers, contentDescription = null, tint = NexusCyan, modifier = Modifier.size(18.dp))
            Text("CA Active:", color = NexusCyan, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            bands.forEach { b ->
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(NexusCyan.copy(alpha = 0.15f))
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(b, color = NexusCyan, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

// ── Neighbor Cell Row ─────────────────────────────────────────────

@Composable
private fun NeighborCellRow(cell: LiveCell) {
    val opColor = operatorColor(cell.operatorName)
    val rsrpVal = cell.rsrp ?: cell.ssRsrp ?: cell.rssi
    val sigColor = rsrpColor(rsrpVal)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(NexusCard)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Operator colour dot
        Box(
            modifier = Modifier
                .size(10.dp)
                .background(opColor, shape = RoundedCornerShape(50))
        )
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = "${cell.operatorName} • ${cell.technology.displayName} • ${cell.bandName ?: ""}",
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = "eNB ${cell.eNodeBId ?: "?"} | PCI ${cell.pci ?: "?"} | CID ${cell.cid ?: "?"}",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 11.sp
            )
        }
        Text(
            text = rsrpVal?.let { "$it dBm" } ?: "--",
            color = sigColor,
            fontWeight = FontWeight.Bold,
            fontSize = 13.sp
        )
    }
}
