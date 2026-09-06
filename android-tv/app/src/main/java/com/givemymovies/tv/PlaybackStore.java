package com.givemymovies.tv;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import java.util.ArrayList;
import java.util.List;

final class PlaybackStore {
    private final SharedPreferences preferences;
    PlaybackStore(Context context) { preferences = context.getSharedPreferences("gmm_tv_playback", Context.MODE_PRIVATE); }
    long position(String id) { return preferences.getLong("position_" + id, 0); }
    void save(String id, long position, long duration) {
        SharedPreferences.Editor edit = preferences.edit();
        if (duration > 0 && (position >= duration - 30000 || position < 15000)) edit.remove("position_" + id);
        else edit.putLong("position_" + id, position);
        edit.putLong("duration_" + id, duration).apply();
        markRecent(id);
    }
    void complete(String id) { preferences.edit().remove("position_" + id).apply(); markRecent(id); }
    List<String> recentIds() {
        List<String> result = new ArrayList<>();
        try { JSONArray values = new JSONArray(preferences.getString("recent", "[]")); for (int i=0; i<values.length(); i++) result.add(values.optString(i)); } catch (Exception ignored) {}
        return result;
    }
    private void markRecent(String id) {
        List<String> ids = recentIds(); ids.remove(id); ids.add(0, id); while (ids.size() > 30) ids.remove(ids.size()-1);
        JSONArray values = new JSONArray(); for (String value : ids) values.put(value);
        preferences.edit().putString("recent", values.toString()).apply();
    }
    static String time(long millis) {
        long total = Math.max(0, millis / 1000), hours = total / 3600, minutes = (total % 3600) / 60, seconds = total % 60;
        return hours > 0 ? String.format(java.util.Locale.US, "%d:%02d:%02d", hours, minutes, seconds) : String.format(java.util.Locale.US, "%d:%02d", minutes, seconds);
    }
}
