package com.givemymovies.tv;

import org.json.JSONObject;

final class Movie {
    final String id;
    final String title;
    final String year;
    final String fileName;
    final String compatibility;

    Movie(JSONObject json) {
        id = json.optString("id");
        title = json.optString("tituloDetectado", json.optString("nombreArchivo", "Sin título"));
        int value = json.optInt("anioDetectado", 0);
        year = value > 0 ? String.valueOf(value) : "";
        fileName = json.optString("nombreArchivo");
        compatibility = json.optString("compatibilidad", "desconocida");
    }
}
