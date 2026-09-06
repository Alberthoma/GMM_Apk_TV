package com.givemymovies.tv;

import android.media.MediaCodecInfo;
import android.media.MediaCodecList;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

final class CodecCapabilities {
    private static JSONObject cached;
    static synchronized JSONObject detect() {
        if (cached != null) return cached;
        Set<String> video = new LinkedHashSet<>();
        Set<String> audio = new LinkedHashSet<>();
        for (MediaCodecInfo info : new MediaCodecList(MediaCodecList.ALL_CODECS).getCodecInfos()) {
            if (info.isEncoder()) continue;
            for (String type : info.getSupportedTypes()) {
                String codec = map(type);
                if (codec == null) continue;
                if (type.toLowerCase(Locale.US).startsWith("video/")) video.add(codec); else audio.add(codec);
            }
        }
        JSONObject result = new JSONObject();
        try {
            result.put("videoCodecs", new JSONArray(video));
            result.put("audioCodecs", new JSONArray(audio));
            result.put("contenedores", new JSONArray(new String[]{".mkv", ".mp4", ".m4v", ".webm", ".ts"}));
        } catch (Exception ignored) { }
        cached = result;
        return cached;
    }

    static boolean supportsDirectPlay(Movie movie) {
        JSONObject detected = detect();
        Set<String> videos = values(detected.optJSONArray("videoCodecs"));
        Set<String> audios = values(detected.optJSONArray("audioCodecs"));
        Set<String> containers = values(detected.optJSONArray("contenedores"));
        boolean codecsKnown = !movie.codecVideo.isEmpty() && !movie.codecAudio.isEmpty() && !videos.isEmpty() && !audios.isEmpty();
        return (!codecsKnown || (videos.contains(movie.codecVideo) && audios.contains(movie.codecAudio))) && (containers.isEmpty() || containers.contains(movie.extension));
    }

    private static Set<String> values(JSONArray array) {
        Set<String> result = new LinkedHashSet<>();
        if (array != null) for (int i=0; i<array.length(); i++) result.add(array.optString(i).toLowerCase(Locale.US));
        return result;
    }

    private static String map(String mime) {
        String value = mime.toLowerCase(Locale.US);
        if (value.equals("video/avc")) return "h264";
        if (value.equals("video/hevc")) return "hevc";
        if (value.equals("video/x-vnd.on2.vp9")) return "vp9";
        if (value.equals("video/x-vnd.on2.vp8")) return "vp8";
        if (value.equals("video/av01")) return "av1";
        if (value.equals("audio/mp4a-latm")) return "aac";
        if (value.equals("audio/mpeg")) return "mp3";
        if (value.equals("audio/ac3")) return "ac3";
        if (value.equals("audio/eac3") || value.equals("audio/eac3-joc")) return "eac3";
        if (value.equals("audio/vnd.dts") || value.equals("audio/vnd.dts.hd")) return "dts";
        if (value.equals("audio/true-hd")) return "truehd";
        if (value.equals("audio/opus")) return "opus";
        if (value.equals("audio/vorbis")) return "vorbis";
        return null;
    }
}
