package com.luis.home;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;

import org.json.JSONObject;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * V-Brain context sensor v22.
 *
 * Raw coordinates never cross the generic JS telemetry bridge. They are packaged only as a
 * private_activity row by AdaptiveBridge. v22 intentionally samples only while the app is active;
 * background sensing and calendar punctuality are separate, later stages.
 */
final class ContextSensor {
    static final int VERSION = 22;
    private static final String PREF = "vbrain_context_sensor_v22";
    private static final long MAX_COMPARE_GAP_MS = 12L * 60L * 60L * 1000L;

    static final class Sample {
        final JSONObject summary;
        final JSONObject privateActivity;
        Sample(JSONObject summary, JSONObject privateActivity) {
            this.summary = summary;
            this.privateActivity = privateActivity;
        }
    }

    private ContextSensor() { }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    static void setEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean("enabled", enabled).apply();
    }

    static boolean isEnabled(Context context) {
        return prefs(context).getBoolean("enabled", false);
    }

    private static boolean fine(Context context) {
        return context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private static boolean coarse(Context context) {
        return context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    static JSONObject status(Context context) {
        JSONObject out = new JSONObject();
        try {
            LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
            boolean gps = false, network = false;
            if (lm != null) {
                try { gps = lm.isProviderEnabled(LocationManager.GPS_PROVIDER); } catch (Exception ignored) { }
                try { network = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER); } catch (Exception ignored) { }
            }
            SharedPreferences p = prefs(context);
            out.put("version", VERSION)
                    .put("enabled", p.getBoolean("enabled", false))
                    .put("fine", fine(context))
                    .put("coarse", coarse(context))
                    .put("location", fine(context) || coarse(context))
                    .put("gpsProvider", gps)
                    .put("networkProvider", network)
                    .put("lastSampleAt", p.getLong("sampleAt", 0L));
        } catch (Exception ignored) { }
        return out;
    }

    private static Location freshestLastKnown(Context context, LocationManager lm) {
        if (lm == null || (!fine(context) && !coarse(context))) return null;
        Location best = null;
        try {
            List<String> providers = lm.getProviders(true);
            for (String provider : providers) {
                try {
                    Location candidate = lm.getLastKnownLocation(provider);
                    if (candidate == null) continue;
                    if (best == null || candidate.getTime() > best.getTime() ||
                            (candidate.getTime() == best.getTime() && candidate.getAccuracy() < best.getAccuracy())) {
                        best = candidate;
                    }
                } catch (SecurityException ignored) { }
            }
        } catch (Exception ignored) { }
        return best;
    }

    private static Location currentLocation(Context context) {
        if (!fine(context) && !coarse(context)) return null;
        LocationManager lm = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return null;
        Location fallback = freshestLastKnown(context, lm);
        if (Build.VERSION.SDK_INT < 30) return fallback;

        String provider = null;
        try { if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) provider = LocationManager.NETWORK_PROVIDER; } catch (Exception ignored) { }
        if (provider == null) {
            try { if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) provider = LocationManager.GPS_PROVIDER; } catch (Exception ignored) { }
        }
        if (provider == null) return fallback;

        ExecutorService executor = Executors.newSingleThreadExecutor();
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<Location> value = new AtomicReference<>();
        try {
            lm.getCurrentLocation(provider, null, executor, location -> {
                value.set(location);
                latch.countDown();
            });
            latch.await(7, TimeUnit.SECONDS);
        } catch (Exception ignored) {
        } finally {
            executor.shutdownNow();
        }
        Location current = value.get();
        return current != null ? current : fallback;
    }

    private static double readDouble(SharedPreferences p, String key) {
        try { return Double.parseDouble(p.getString(key, "")); }
        catch (Exception ignored) { return Double.NaN; }
    }

    private static String movementClass(double meters) {
        if (!Double.isFinite(meters)) return "first_sample";
        if (meters < 25) return "stationary";
        if (meters < 250) return "local_move";
        if (meters < 2000) return "moving";
        return "travel";
    }

    static Sample capture(Context context) {
        long now = System.currentTimeMillis();
        JSONObject summary = status(context);
        try {
            summary.put("capturedAt", now).put("rawPrivate", true);
            if (!isEnabled(context)) {
                summary.put("state", "disabled");
                return new Sample(summary, null);
            }
            if (!fine(context) && !coarse(context)) {
                summary.put("state", "permission_required");
                return new Sample(summary, null);
            }

            Location location = currentLocation(context);
            if (location == null) {
                summary.put("state", "location_unavailable");
                return new Sample(summary, null);
            }

            SharedPreferences p = prefs(context);
            double previousLat = readDouble(p, "lat");
            double previousLon = readDouble(p, "lon");
            long previousLocationAt = p.getLong("locationAt", 0L);
            double movedMeters = Double.NaN;
            long sampleGapMs = previousLocationAt > 0 ? Math.max(0L, location.getTime() - previousLocationAt) : 0L;
            if (Double.isFinite(previousLat) && Double.isFinite(previousLon) && sampleGapMs <= MAX_COMPARE_GAP_MS) {
                float[] distance = new float[1];
                Location.distanceBetween(previousLat, previousLon, location.getLatitude(), location.getLongitude(), distance);
                movedMeters = Math.max(0d, distance[0]);
            }
            String movement = movementClass(movedMeters);
            long sampleAge = Math.max(0L, now - location.getTime());
            String precision = fine(context) ? "fine" : "approximate";

            p.edit()
                    .putBoolean("enabled", true)
                    .putString("lat", Double.toString(location.getLatitude()))
                    .putString("lon", Double.toString(location.getLongitude()))
                    .putLong("locationAt", location.getTime())
                    .putLong("sampleAt", now)
                    .apply();

            summary.put("state", "ready")
                    .put("precision", precision)
                    .put("movementClass", movement)
                    .put("movedMeters", Double.isFinite(movedMeters) ? Math.round(movedMeters) : JSONObject.NULL)
                    .put("sampleGapMs", sampleGapMs)
                    .put("sampleAgeMs", sampleAge)
                    .put("accuracyMeters", Math.round(location.getAccuracy()))
                    .put("locationAt", location.getTime());

            JSONObject data = new JSONObject()
                    .put("sensorVersion", VERSION)
                    .put("lat", location.getLatitude())
                    .put("lon", location.getLongitude())
                    .put("accuracyMeters", location.getAccuracy())
                    .put("provider", String.valueOf(location.getProvider()))
                    .put("precision", precision)
                    .put("locationAt", location.getTime())
                    .put("sampleAgeMs", sampleAge)
                    .put("sampleGapMs", sampleGapMs)
                    .put("movedMeters", Double.isFinite(movedMeters) ? movedMeters : JSONObject.NULL)
                    .put("movementClass", movement);
            JSONObject privateActivity = new JSONObject()
                    .put("id", "ctx22-" + UUID.randomUUID())
                    .put("kind", "private_location_sample")
                    .put("at", now)
                    .put("screen", "system")
                    .put("source", "android-context-v22")
                    .put("data", data);
            return new Sample(summary, privateActivity);
        } catch (Exception error) {
            try { summary.put("state", "error"); } catch (Exception ignored) { }
            return new Sample(summary, null);
        }
    }
}
