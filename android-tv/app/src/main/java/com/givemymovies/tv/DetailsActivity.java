package com.givemymovies.tv;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import org.json.JSONObject;

public final class DetailsActivity extends AppCompatActivity {
    private PosterRepository posters;
    private FavoriteStore favorites;
    private String id;
    private Button favorite;
    private Button playButton;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        posters = new PosterRepository(this); favorites = new FavoriteStore(this); id = getIntent().getStringExtra("movie_id");
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.HORIZONTAL); root.setPadding(dp(70), dp(50), dp(70), dp(45)); root.setGravity(Gravity.CENTER_VERTICAL); root.setBackgroundColor(Color.rgb(9,11,16));
        ImageView poster = new ImageView(this); poster.setScaleType(ImageView.ScaleType.CENTER_CROP); poster.setBackgroundColor(Color.rgb(36,31,49)); root.addView(poster, new LinearLayout.LayoutParams(dp(310), dp(465)));
        LinearLayout info = new LinearLayout(this); info.setOrientation(LinearLayout.VERTICAL); info.setPadding(dp(48), 0, 0, 0); root.addView(info, new LinearLayout.LayoutParams(0, -2, 1));
        TextView title = text(getIntent().getStringExtra("title"), 34, Color.WHITE); title.setTypeface(Typeface.DEFAULT_BOLD); info.addView(title);
        String metaText = getIntent().getStringExtra("year"); double rating = getIntent().getDoubleExtra("rating", 0); String compatibility = getIntent().getStringExtra("compatibility");
        if (rating > 0) metaText += (metaText.isEmpty() ? "" : "  •  ") + "★ " + String.format(java.util.Locale.US, "%.1f", rating);
        if (compatibility != null && !compatibility.isEmpty()) metaText += (metaText.isEmpty() ? "" : "  •  ") + compatibility;
        TextView meta = text(metaText, 20, Color.rgb(174,181,195)); meta.setPadding(0, dp(15), 0, dp(30)); info.addView(meta);
        PlaybackStore playback = new PlaybackStore(this); long position = playback.position(id);
        playButton = new Button(this); playButton.setText(position > 0 ? "▶  Continuar desde " + PlaybackStore.time(position) : "▶  Reproducir");
        playButton.setOnClickListener(v -> { long resume = new PlaybackStore(this).position(id); startActivity(new Intent(this, PlayerActivity.class).putExtras(getIntent().getExtras()).putExtra("resume_position", resume)); }); info.addView(playButton, buttonParams());
        favorite = new Button(this); updateFavorite(); favorite.setOnClickListener(v -> { favorites.toggle(id); updateFavorite(); }); info.addView(favorite, buttonParams());
        TextView hint = text("Durante la reproducción: mantén ◀ o ▶ para desplazarte. Usa Audio o Subtítulos para elegir pistas.", 16, Color.rgb(167,173,186)); hint.setPadding(0, dp(24), 0, 0); info.addView(hint);
        setContentView(root);
        try {
            JSONObject json = new JSONObject(); json.put("id", id); json.put("tituloDetectado", getIntent().getStringExtra("title")); json.put("anioDetectado", number(getIntent().getStringExtra("year")));
            JSONObject tmdb = new JSONObject(); tmdb.put("poster_path", getIntent().getStringExtra("poster")); tmdb.put("vote_average", rating); tmdb.put("media_type", getIntent().getStringExtra("media_type")); json.put("tmdb", tmdb);
            Movie movie = new Movie(json); posters.load(movie, image -> { if (image != null) poster.setImageBitmap(image); });
        } catch (Exception ignored) {}
        playButton.requestFocus();
    }

    private void updateFavorite() { favorite.setText(favorites.contains(id) ? "★  Quitar de Favoritas" : "☆  Añadir a Favoritas"); }
    @Override protected void onResume() { super.onResume(); if (playButton != null) { long position = new PlaybackStore(this).position(id); playButton.setText(position > 0 ? "▶  Continuar desde " + PlaybackStore.time(position) : "▶  Reproducir"); } }
    private TextView text(String value, int size, int color) { TextView view = new TextView(this); view.setText(value == null ? "" : value); view.setTextSize(size); view.setTextColor(color); return view; }
    private LinearLayout.LayoutParams buttonParams() { LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(58)); lp.setMargins(0, dp(6), 0, dp(6)); return lp; }
    private static int number(String value) { try { return Integer.parseInt(value); } catch (Exception ignored) { return 0; } }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    @Override protected void onDestroy() { if (posters != null) posters.close(); super.onDestroy(); }
}
