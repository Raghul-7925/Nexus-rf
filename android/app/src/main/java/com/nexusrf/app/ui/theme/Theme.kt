package com.nexusrf.app.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// ── Nexus RF Brand Colours ────────────────────────────────────────
val NexusNavy     = Color(0xFF0A0F1E)   // background
val NexusDark     = Color(0xFF111827)   // surface
val NexusCard     = Color(0xFF1E293B)   // card background
val NexusCardEdge = Color(0xFF334155)   // card border

val NexusBlue     = Color(0xFF0EA5E9)   // electric blue primary
val NexusCyan     = Color(0xFF06B6D4)   // cyan secondary
val NexusTeal     = Color(0xFF14B8A6)   // teal tertiary

val SignalGreen   = Color(0xFF22C55E)   // RSRP > -85 dBm
val SignalAmber   = Color(0xFFF59E0B)   // RSRP -85 to -105
val SignalRed     = Color(0xFFEF4444)   // RSRP < -105

val AirtelRed     = Color(0xFFDC2626)
val JioBlue       = Color(0xFF2563EB)
val ViYellow      = Color(0xFFCA8A04)
val BsnlGreen     = Color(0xFF16A34A)

private val NexusDarkColorScheme = darkColorScheme(
    primary = NexusBlue,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF0284C7),
    onPrimaryContainer = Color.White,
    secondary = NexusCyan,
    onSecondary = NexusNavy,
    secondaryContainer = Color(0xFF0891B2),
    onSecondaryContainer = Color.White,
    tertiary = NexusTeal,
    background = NexusNavy,
    onBackground = Color(0xFFE2E8F0),
    surface = NexusDark,
    onSurface = Color(0xFFCBD5E1),
    surfaceVariant = NexusCard,
    onSurfaceVariant = Color(0xFF94A3B8),
    outline = NexusCardEdge,
    error = SignalRed,
)

@Composable
fun NexusRFTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = NexusDarkColorScheme,
        typography = Typography(),
        content = content
    )
}

/** Returns the correct brand colour for an operator name */
fun operatorColor(operator: String?): Color = when {
    operator == null -> NexusBlue
    operator.contains("Airtel", ignoreCase = true) -> AirtelRed
    operator.contains("Jio", ignoreCase = true) -> JioBlue
    operator.contains("Vi", ignoreCase = true) || operator.contains("Vodafone", ignoreCase = true) -> ViYellow
    operator.contains("BSNL", ignoreCase = true) -> BsnlGreen
    else -> NexusCyan
}

/** Returns a signal colour based on RSRP value */
fun rsrpColor(rsrp: Int?): Color = when {
    rsrp == null -> Color.Gray
    rsrp >= -85 -> SignalGreen
    rsrp >= -105 -> SignalAmber
    else -> SignalRed
}
