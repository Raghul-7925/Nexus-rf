package com.nexusrf.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import androidx.navigation.compose.*
import com.nexusrf.app.ui.screens.drivelog.DriveLogScreen
import com.nexusrf.app.ui.screens.locate.LocateTransmitterScreen
import com.nexusrf.app.ui.screens.map.MapScreen
import com.nexusrf.app.ui.screens.status.StatusScreen
import com.nexusrf.app.ui.theme.*
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            NexusRFTheme {
                NexusRFApp()
            }
        }
    }
}

// ── Navigation routes ──────────────────────────────────────────────
sealed class Route(val route: String, val label: String, val icon: ImageVector, val iconSelected: ImageVector) {
    data object Status : Route("status", "Status", Icons.Outlined.SignalCellularAlt, Icons.Filled.SignalCellularAlt)
    data object Map    : Route("map",    "Map",    Icons.Outlined.Map,                Icons.Filled.Map)
    data object Drive  : Route("drive",  "Drive Log", Icons.Outlined.DirectionsCar,   Icons.Filled.DirectionsCar)
}
private val bottomNavRoutes = listOf(Route.Status, Route.Map, Route.Drive)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NexusRFApp() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val showBottomBar = currentRoute in bottomNavRoutes.map { it.route }

    Scaffold(
        topBar = {
            if (showBottomBar) {
                TopAppBar(
                    title = {
                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            Text(
                                "Nexus RF",
                                fontWeight = FontWeight.Black,
                                fontSize = 20.sp,
                                color = Color.White
                            )
                            Spacer(Modifier.width(8.dp))
                            // Backend connectivity indicator
                            ConnectivityDot()
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = NexusNavy,
                        titleContentColor = Color.White
                    ),
                    actions = {
                        IconButton(onClick = { /* settings */ }) {
                            Icon(Icons.Default.Settings, contentDescription = "Settings", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                )
            }
        },
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    containerColor = NexusDark,
                    tonalElevation = 0.dp
                ) {
                    bottomNavRoutes.forEach { route ->
                        val selected = currentRoute == route.route
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(route.route) {
                                    popUpTo(navController.graph.startDestinationId) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = {
                                Icon(
                                    imageVector = if (selected) route.iconSelected else route.icon,
                                    contentDescription = route.label
                                )
                            },
                            label = { Text(route.label, fontSize = 11.sp) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = NexusBlue,
                                selectedTextColor = NexusBlue,
                                indicatorColor = NexusBlue.copy(alpha = 0.15f),
                                unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        )
                    }
                }
            }
        },
        containerColor = NexusNavy
    ) { innerPadding ->
        Box(modifier = Modifier.padding(innerPadding).background(NexusNavy)) {
            NavHost(
                navController = navController,
                startDestination = Route.Status.route
            ) {
                composable(Route.Status.route) {
                    StatusScreen()
                }
                composable(Route.Map.route) {
                    MapScreen(
                        onLocateClick = { navController.navigate("locate") }
                    )
                }
                composable(Route.Drive.route) {
                    DriveLogScreen()
                }
                composable("locate") {
                    LocateTransmitterScreen(
                        onNavigateBack = { navController.popBackStack() }
                    )
                }
            }
        }
    }
}

@Composable
private fun ConnectivityDot() {
    // TODO: observe actual backend ping state
    val isConnected by remember { mutableStateOf(true) }
    Box(
        modifier = Modifier
            .background(
                if (isConnected) SignalGreen else SignalRed,
                shape = androidx.compose.foundation.shape.CircleShape
            )
            .padding(4.dp)
    )
    Text(
        text = if (isConnected) "Connect" else "Offline",
        fontSize = 10.sp,
        color = if (isConnected) SignalGreen else SignalRed,
        modifier = Modifier.padding(start = 4.dp)
    )
}
