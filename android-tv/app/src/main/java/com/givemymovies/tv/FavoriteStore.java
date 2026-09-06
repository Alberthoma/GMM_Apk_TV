package com.givemymovies.tv;

import android.content.Context;
import java.util.HashSet;
import java.util.Set;

final class FavoriteStore {
    private final android.content.SharedPreferences preferences;
    private final Set<String> ids;
    FavoriteStore(Context context) {
        preferences = context.getSharedPreferences("gmm_tv_favorites", Context.MODE_PRIVATE);
        ids = new HashSet<>(preferences.getStringSet("ids", new HashSet<>()));
    }
    boolean contains(String id) { return ids.contains(id); }
    boolean toggle(String id) {
        boolean added;
        if (ids.contains(id)) { ids.remove(id); added = false; }
        else { ids.add(id); added = true; }
        preferences.edit().putStringSet("ids", new HashSet<>(ids)).apply();
        return added;
    }
}
