package com.givemymovies.tv;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.LruCache;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

final class PosterRepository {
    interface Callback { void onPoster(Bitmap image); }
    interface MetadataCallback { void onReady(Movie movie); }
    interface ActorCallback { void onReady(Set<String> titleKeys); }

    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final SharedPreferences metadata;
    private final LruCache<String, Bitmap> images = new LruCache<String, Bitmap>(32 * 1024) {
        @Override protected int sizeOf(String key, Bitmap value) { return value.getByteCount() / 1024; }
    };
    private final AtomicInteger completed = new AtomicInteger();

    PosterRepository(Context context) {
        metadata = context.getSharedPreferences("gmm_tv_tmdb_cache_v1", Context.MODE_PRIVATE);
    }

    void restore(Movie movie) {
        if (movie.metadataReady) return;
        String saved = metadata.getString(movie.matchKey(), "");
        if (!saved.isEmpty()) try { movie.applyMetadata(new JSONObject(saved)); } catch (Exception ignored) {}
    }

    void enrich(Movie movie, MetadataCallback callback) {
        restore(movie);
        if (movie.metadataReady) { if (callback != null) callback.onReady(movie); return; }
        if (BuildConfig.TMDB_API_KEY.isEmpty()) return;
        executor.execute(() -> {
            JSONObject found = find(movie);
            if (found != null) {
                movie.applyMetadata(found);
                metadata.edit().putString(movie.matchKey(), movie.metadataJson().toString()).apply();
            } else {
                movie.metadataReady = true;
            }
            completed.incrementAndGet();
            if (callback != null) main.post(() -> callback.onReady(movie));
        });
    }

    void load(Movie movie, Callback callback) {
        restore(movie);
        Bitmap cached = images.get(movie.matchKey());
        if (cached != null) { callback.onPoster(cached); return; }
        MetadataCallback afterMetadata = value -> executor.execute(() -> {
            Bitmap loaded = download(value.posterUrl);
            if (loaded != null) images.put(value.matchKey(), loaded);
            main.post(() -> callback.onPoster(loaded));
        });
        if (movie.metadataReady) afterMetadata.onReady(movie); else enrich(movie, afterMetadata);
    }

    void searchActor(String actor, ActorCallback callback) {
        executor.execute(() -> {
            Set<String> keys = new HashSet<>();
            try {
                JSONObject people = getJson("/search/person?language=es-ES&query=" + encode(actor));
                JSONArray results = people.optJSONArray("results");
                if (results != null && results.length() > 0) {
                    int personId = results.getJSONObject(0).getInt("id");
                    JSONObject credits = getJson("/person/" + personId + "/combined_credits?language=es-ES");
                    collectCredits(credits.optJSONArray("cast"), keys);
                    collectCredits(credits.optJSONArray("crew"), keys);
                }
            } catch (Exception ignored) {}
            main.post(() -> callback.onReady(keys));
        });
    }

    private void collectCredits(JSONArray credits, Set<String> keys) {
        if (credits == null) return;
        for (int i = 0; i < credits.length(); i++) {
            JSONObject item = credits.optJSONObject(i);
            if (item == null) continue;
            String title = item.optString("title", item.optString("name", ""));
            String date = item.optString("release_date", item.optString("first_air_date", ""));
            String year = date.length() >= 4 ? date.substring(0, 4) : "";
            String normalized = Movie.normalize(title);
            if (!normalized.isEmpty()) { keys.add(normalized); keys.add(normalized + "|" + year); }
        }
    }

    private JSONObject find(Movie movie) {
        try {
            JSONObject response = getJson("/search/multi?language=es-ES&include_adult=false&query=" + encode(movie.searchTitle()));
            JSONArray results = response.optJSONArray("results");
            JSONObject best = null;
            int bestScore = -1;
            if (results != null) for (int i = 0; i < results.length(); i++) {
                JSONObject candidate = results.optJSONObject(i);
                if (candidate == null) continue;
                String type = candidate.optString("media_type");
                if (!"movie".equals(type) && !"tv".equals(type)) continue;
                String title = candidate.optString("title", candidate.optString("name", ""));
                String date = candidate.optString("release_date", candidate.optString("first_air_date", ""));
                String year = date.length() >= 4 ? date.substring(0, 4) : "";
                int score = Movie.normalize(title).equals(Movie.normalize(movie.searchTitle())) ? 8 : 1;
                if (movie.serverClassified && "tv".equals(type)) score += 8;
                if (!movie.year.isEmpty() && movie.year.equals(year)) score += 5;
                if (score > bestScore) { best = candidate; bestScore = score; }
            }
            return best;
        } catch (Exception ignored) { return null; }
    }

    private JSONObject getJson(String path) throws Exception {
        String separator = path.contains("?") ? "&" : "?";
        HttpURLConnection connection = (HttpURLConnection) new URL("https://api.themoviedb.org/3" + path + separator + "api_key=" + encode(BuildConfig.TMDB_API_KEY)).openConnection();
        connection.setConnectTimeout(7000); connection.setReadTimeout(10000); connection.setRequestProperty("Accept", "application/json");
        if (connection.getResponseCode() != 200) { connection.disconnect(); return new JSONObject(); }
        StringBuilder text = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
            String line; while ((line = reader.readLine()) != null) text.append(line);
        } finally { connection.disconnect(); }
        return new JSONObject(text.toString());
    }

    private Bitmap download(String address) {
        if (address == null || address.isEmpty()) return null;
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(address).openConnection(); connection.setConnectTimeout(7000); connection.setReadTimeout(12000);
            if (connection.getResponseCode() != 200) return null;
            return BitmapFactory.decodeStream(connection.getInputStream());
        } catch (Exception ignored) { return null; }
        finally { if (connection != null) connection.disconnect(); }
    }

    private static String encode(String value) throws Exception { return URLEncoder.encode(value == null ? "" : value, "UTF-8"); }
    int completed() { return completed.get(); }
    void close() { executor.shutdownNow(); }
}
