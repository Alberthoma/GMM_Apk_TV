package com.givemymovies.tv;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

final class ApiClient {
    private final ServerConfig config;

    ApiClient(ServerConfig config) { this.config = config; }

    List<Movie> catalog() throws Exception {
        JSONObject root = request("GET", "/api/catalogo", null);
        JSONArray values = root.getJSONArray("peliculas");
        List<Movie> result = new ArrayList<>();
        for (int i = 0; i < values.length(); i++) {
            JSONObject item = values.getJSONObject(i);
            if (item.optBoolean("disponible", false)) result.add(new Movie(item));
        }
        return result;
    }

    JSONObject playbackPlan(String id) throws Exception {
        JSONObject body = new JSONObject();
        body.put("capacidades", CodecCapabilities.detect());
        body.put("permitirJellyfin", config.jellyfinFallback);
        return request("POST", "/api/tv/reproducir/" + java.net.URLEncoder.encode(id, "UTF-8"), body);
    }

    String absolute(String path) { return path.startsWith("http") ? path : config.baseUrl + path; }

    private JSONObject request(String method, String path, JSONObject body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(config.baseUrl + path).openConnection();
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(15000);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Authorization", "Bearer " + config.key);
        connection.setRequestProperty("Accept", "application/json");
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));
        }
        int status = connection.getResponseCode();
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        StringBuilder text = new StringBuilder();
        if (stream != null) {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) text.append(line);
            }
        }
        JSONObject result = text.length() == 0 ? new JSONObject() : new JSONObject(text.toString());
        if (status >= 400) throw new ApiException(status, result.optString("mensaje", result.optString("error", "Error del servidor")));
        result.put("httpStatus", status);
        return result;
    }

    static final class ApiException extends Exception {
        final int status;
        ApiException(int status, String message) { super(message); this.status = status; }
    }
}
