package com.givemymovies.tv;

import android.os.Handler;
import android.os.Looper;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.LruCache;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class PosterRepository {
    interface Callback { void onPoster(Bitmap image); }

    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<String, String> cache = new ConcurrentHashMap<>();
    private final LruCache<String, Bitmap> images = new LruCache<String, Bitmap>(24 * 1024) {
        @Override protected int sizeOf(String key, Bitmap value) { return value.getByteCount() / 1024; }
    };

    void load(Movie movie, Callback callback) {
        String key = movie.title + "|" + movie.year;
        Bitmap image = images.get(key);
        if (image != null) { callback.onPoster(image); return; }
        if (movie.posterUrl != null && movie.posterUrl.isEmpty()) { callback.onPoster(null); return; }
        String cached = cache.get(key);
        if (BuildConfig.TMDB_API_KEY.isEmpty()) { callback.onPoster(null); return; }
        executor.execute(() -> {
            String poster = movie.posterUrl != null ? movie.posterUrl : (cached != null ? cached : find(movie));
            cache.put(key, poster);
            movie.posterUrl = poster;
            Bitmap loaded = download(poster);
            if (loaded != null) images.put(key, loaded);
            main.post(() -> callback.onPoster(loaded));
        });
    }

    private Bitmap download(String address) {
        if (address == null || address.isEmpty()) return null;
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(address).openConnection();
            connection.setConnectTimeout(7000);
            connection.setReadTimeout(12000);
            if (connection.getResponseCode() != 200) return null;
            return BitmapFactory.decodeStream(connection.getInputStream());
        } catch (Exception ignored) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String find(Movie movie) {
        HttpURLConnection connection = null;
        try {
            String address = "https://api.themoviedb.org/3/search/movie?api_key=" +
                    URLEncoder.encode(BuildConfig.TMDB_API_KEY, "UTF-8") +
                    "&language=es-ES&include_adult=false&query=" + URLEncoder.encode(movie.title, "UTF-8") +
                    (movie.year.isEmpty() ? "" : "&year=" + URLEncoder.encode(movie.year, "UTF-8"));
            connection = (HttpURLConnection) new URL(address).openConnection();
            connection.setConnectTimeout(7000);
            connection.setReadTimeout(10000);
            connection.setRequestProperty("Accept", "application/json");
            if (connection.getResponseCode() != 200) return "";
            StringBuilder text = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) text.append(line);
            }
            JSONArray results = new JSONObject(text.toString()).optJSONArray("results");
            if (results == null) return "";
            for (int i = 0; i < results.length(); i++) {
                String path = results.getJSONObject(i).optString("poster_path", "");
                if (!path.isEmpty() && !"null".equals(path)) return "https://image.tmdb.org/t/p/w500" + path;
            }
        } catch (Exception ignored) {
        } finally {
            if (connection != null) connection.disconnect();
        }
        return "";
    }

    void close() { executor.shutdownNow(); }
}
