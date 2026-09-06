package com.givemymovies.tv;

import android.content.Context;
import android.content.SharedPreferences;

final class ServerConfig {
    static final String PREFS = "gmm_tv";
    final String baseUrl;
    final String key;
    final boolean jellyfinFallback;

    ServerConfig(String baseUrl, String key, boolean jellyfinFallback) {
        String clean = baseUrl == null ? "" : baseUrl.trim();
        while (clean.endsWith("/")) clean = clean.substring(0, clean.length() - 1);
        this.baseUrl = clean;
        this.key = key == null ? "" : key.trim();
        this.jellyfinFallback = jellyfinFallback;
    }

    static ServerConfig load(Context context) {
        if (!BuildConfig.DEFAULT_SERVER_URL.isEmpty() && !BuildConfig.DEFAULT_SERVER_KEY.isEmpty()) {
            return new ServerConfig(BuildConfig.DEFAULT_SERVER_URL, BuildConfig.DEFAULT_SERVER_KEY, false);
        }
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return new ServerConfig(prefs.getString("base_url", "http://100.64.0.1:7399"),
                prefs.getString("key", ""), prefs.getBoolean("jellyfin_fallback", true));
    }

    void save(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString("base_url", baseUrl).putString("key", key)
                .putBoolean("jellyfin_fallback", jellyfinFallback).apply();
    }
}
