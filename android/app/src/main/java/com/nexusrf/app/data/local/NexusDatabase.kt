package com.nexusrf.app.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

// ══════════════════════════════════════════════════════════════════
//  Room Entities
// ══════════════════════════════════════════════════════════════════

/** Cached tower from Nexus RF backend (Tarang Sanchar baseline or user-added) */
@Entity(tableName = "towers")
data class TowerEntity(
    @PrimaryKey val id: String,
    val lat: Double,
    val lng: Double,
    val operator: String?,
    val technology: String?,
    val freqMhz: Double?,
    val bandName: String?,
    val heightM: Double?,
    val azimuthDeg: Double?,
    val siteId: String?,
    val cellId: String?,
    val pci: String?,
    val eNodeBId: Int?,
    val source: String,             // "tarangsanchar" | "user_test" | "rf_planned"
    val locationName: String?,
    val lastSyncedAt: Long = System.currentTimeMillis()
)

/** One recorded GPS + cell measurement during a drive-test */
@Entity(tableName = "drive_log", indices = [Index(value = ["session_id"])])
data class DriveLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "session_id") val sessionId: String,
    val timestamp: Long,
    val lat: Double,
    val lng: Double,
    @ColumnInfo(name = "gps_accuracy_m") val gpsAccuracyM: Float,
    val operator: String?,
    val technology: String?,
    @ColumnInfo(name = "band_name") val bandName: String?,
    val cid: Long?,
    @ColumnInfo(name = "enodeb_id") val eNodeBId: Int?,
    val pci: Int?,
    val rsrp: Int?,
    val rsrq: Int?,
    val sinr: Int?,
    @ColumnInfo(name = "timing_advance") val timingAdvance: Int?,
    @ColumnInfo(name = "distance_ta_m") val distanceTaM: Double?
)

/**
 * MANTA spatial bucket — stores one GPS position + TA reading per cell.
 * The multilateration optimizer minimizes penalty across these buckets.
 */
@Entity(
    tableName = "manta_cell",
    indices = [
        Index(value = ["lat_bucket", "lon_bucket"]),
        Index(value = ["enodeb_id", "mcc", "mnc"])
    ]
)
data class MantaCellEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "enodeb_id") val eNodeBId: Int,
    val mcc: Int,
    val mnc: Int,
    val lat: Double,
    val lon: Double,
    @ColumnInfo(name = "lat_bucket") val latBucket: Double,  // quantized bucket
    @ColumnInfo(name = "lon_bucket") val lonBucket: Double,
    val technology: String,     // "l" = LTE, "nr" = NR
    val arfcn: Int?,
    val ta: Int,                // Timing Advance (each = 78.12m)
    val rsrp: Int,
    @ColumnInfo(name = "gps_accuracy_m") val gpsAccuracyM: Float,
    val hits: Int = 1           // how many times same bucket was visited
)

// ══════════════════════════════════════════════════════════════════
//  DAOs
// ══════════════════════════════════════════════════════════════════

@Dao
interface TowerDao {
    @Query("SELECT * FROM towers ORDER BY source, operator")
    fun getAllTowers(): Flow<List<TowerEntity>>

    @Query("""
        SELECT * FROM towers 
        WHERE (enodeb_id = :eNodeBId AND mcc = :mcc AND mnc = :mnc)
           OR (cell_id = :cellId)
        LIMIT 1
    """)
    suspend fun findTowerByCell(eNodeBId: Int?, mcc: Int, mnc: Int, cellId: String?): TowerEntity?

    @Query("SELECT COUNT(*) FROM towers WHERE source IN ('tarangsanchar', 'tarangsanchar_seed')")
    suspend fun countBaselineTowers(): Int

    @Upsert
    suspend fun upsertTowers(towers: List<TowerEntity>)

    @Query("DELETE FROM towers")
    suspend fun deleteAll()

    @Query("DELETE FROM towers WHERE last_synced_at < :threshold")
    suspend fun deleteOlderThan(threshold: Long)
}

@Dao
interface DriveLogDao {
    @Query("SELECT * FROM drive_log WHERE session_id = :sessionId ORDER BY timestamp")
    fun getSession(sessionId: String): Flow<List<DriveLogEntity>>

    @Query("SELECT DISTINCT session_id, MIN(timestamp) as started FROM drive_log GROUP BY session_id ORDER BY started DESC")
    suspend fun listSessions(): List<SessionSummary>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPoint(point: DriveLogEntity)

    @Query("DELETE FROM drive_log WHERE session_id = :sessionId")
    suspend fun deleteSession(sessionId: String)

    @Query("SELECT COUNT(*) FROM drive_log WHERE session_id = :sessionId")
    suspend fun countPoints(sessionId: String): Int
}

data class SessionSummary(
    @ColumnInfo(name = "session_id") val sessionId: String,
    @ColumnInfo(name = "started") val startedAt: Long
)

@Dao
interface MantaDao {
    @Query("""
        SELECT * FROM manta_cell 
        WHERE enodeb_id = :eNodeBId AND mcc = :mcc AND mnc = :mnc
    """)
    suspend fun getBucketsForCell(eNodeBId: Int, mcc: Int, mnc: Int): List<MantaCellEntity>

    @Query("""
        SELECT COUNT(DISTINCT lat_bucket || ',' || lon_bucket) 
        FROM manta_cell 
        WHERE enodeb_id = :eNodeBId AND mcc = :mcc AND mnc = :mnc AND ta >= 1
    """)
    suspend fun countUniqueBuckets(eNodeBId: Int, mcc: Int, mnc: Int): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertBucket(entity: MantaCellEntity)

    @Query("DELETE FROM manta_cell WHERE enodeb_id = :eNodeBId AND mcc = :mcc AND mnc = :mnc")
    suspend fun clearCellBuckets(eNodeBId: Int, mcc: Int, mnc: Int)

    @Query("DELETE FROM manta_cell")
    suspend fun clearAll()
}

// ══════════════════════════════════════════════════════════════════
//  Room Database
// ══════════════════════════════════════════════════════════════════

@Database(
    entities = [TowerEntity::class, DriveLogEntity::class, MantaCellEntity::class],
    version = 1,
    exportSchema = false
)
abstract class NexusDatabase : RoomDatabase() {
    abstract fun towerDao(): TowerDao
    abstract fun driveLogDao(): DriveLogDao
    abstract fun mantaDao(): MantaDao
}
