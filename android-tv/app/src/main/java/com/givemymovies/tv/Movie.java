package com.givemymovies.tv;

import org.json.JSONArray;
import org.json.JSONObject;
import java.text.Normalizer;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

final class Movie {
    final String id;
    final String title;
    final String year;
    final String fileName;
    final String compatibility;
    final String extension;
    final String codecVideo;
    final String codecAudio;
    final String seriesTitle;
    final int season;
    final int episode;
    final boolean serverClassified;
    String posterUrl;
    String mediaType = "movie";
    double rating;
    final Set<Integer> genreIds = new HashSet<>();
    boolean metadataReady;

    Movie(JSONObject json) {
        id = json.optString("id");
        mediaType = json.optString("tipoMedia", "movie");
        serverClassified = "tv".equals(mediaType);
        seriesTitle = json.optString("serieTitulo", "");
        season = json.optInt("temporada", 0); episode = json.optInt("episodio", 0);
        String detectedTitle = json.optString("tituloDetectado", json.optString("nombreArchivo", "Sin título"));
        title = serverClassified && !seriesTitle.isEmpty() ? seriesTitle + (season > 0 ? "  ·  T" + season + (episode > 0 ? " E" + episode : "") : "") : detectedTitle;
        int value = json.optInt("anioDetectado", 0);
        year = value > 0 ? String.valueOf(value) : "";
        fileName = json.optString("nombreArchivo");
        compatibility = json.optString("compatibilidad", "desconocida");
        extension = json.optString("extension", "").toLowerCase(Locale.ROOT);
        codecVideo = json.optString("codecVideo", "").toLowerCase(Locale.ROOT);
        codecAudio = json.optString("codecAudio", "").toLowerCase(Locale.ROOT);
        JSONObject tmdb = json.optJSONObject("tmdb");
        if (tmdb != null) applyMetadata(tmdb);
    }

    void applyMetadata(JSONObject json) {
        String path = json.optString("poster_path", "");
        if (!path.isEmpty() && !"null".equals(path)) posterUrl = path.startsWith("http") ? path : "https://image.tmdb.org/t/p/w500" + path;
        if (!serverClassified) mediaType = json.optString("media_type", json.optString("tipo", mediaType));
        if (!"tv".equals(mediaType)) mediaType = "movie";
        rating = json.optDouble("vote_average", json.optDouble("calificacion", 0));
        genreIds.clear();
        JSONArray genres = json.optJSONArray("genre_ids");
        if (genres != null) for (int i = 0; i < genres.length(); i++) genreIds.add(genres.optInt(i));
        metadataReady = true;
    }

    JSONObject metadataJson() {
        JSONObject json = new JSONObject();
        try {
            json.put("poster_path", posterUrl == null ? "" : posterUrl);
            json.put("media_type", mediaType);
            json.put("vote_average", rating);
            JSONArray genres = new JSONArray();
            for (Integer id : genreIds) genres.put(id);
            json.put("genre_ids", genres);
        } catch (Exception ignored) {}
        return json;
    }

    String matchKey() { return normalize(title) + "|" + year; }
    String searchTitle() { return serverClassified && !seriesTitle.isEmpty() ? seriesTitle : title; }
    static String normalize(String value) {
        String text = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }
}
