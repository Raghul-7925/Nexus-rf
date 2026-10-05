package com.nexusrf.app.di

import android.content.Context
import androidx.room.Room
import com.nexusrf.app.BuildConfig
import com.nexusrf.app.data.local.*
import com.nexusrf.app.data.remote.NexusApiService
import com.nexusrf.app.data.repository.LocationProvider
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    // ── Room Database ──────────────────────────────────────────────
    @Provides @Singleton
    fun provideDatabase(@ApplicationContext ctx: Context): NexusDatabase =
        Room.databaseBuilder(ctx, NexusDatabase::class.java, "nexus_rf.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides fun provideTowerDao(db: NexusDatabase): TowerDao = db.towerDao()
    @Provides fun provideDriveLogDao(db: NexusDatabase): DriveLogDao = db.driveLogDao()
    @Provides fun provideMantaDao(db: NexusDatabase): MantaDao = db.mantaDao()

    // ── Network ────────────────────────────────────────────────────
    @Provides @Singleton
    fun provideMoshi(): Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    @Provides @Singleton
    fun provideOkHttp(): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        })
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    @Provides @Singleton
    fun provideRetrofit(client: OkHttpClient, moshi: Moshi): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

    @Provides @Singleton
    fun provideApiService(retrofit: Retrofit): NexusApiService =
        retrofit.create(NexusApiService::class.java)

    // ── Location Provider ──────────────────────────────────────────
    @Provides @Singleton
    fun provideLocationProvider(@ApplicationContext ctx: Context): LocationProvider =
        LocationProvider(ctx)
}
