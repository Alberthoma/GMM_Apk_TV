package com.givemymovies.tv;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends AppCompatActivity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private MovieAdapter adapter;
    private TextView status;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(dp(42), dp(28), dp(42), dp(20)); root.setBackgroundColor(Color.rgb(9,11,16));
        LinearLayout header = new LinearLayout(this); header.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = new TextView(this); title.setText("GMM  ·  Te la tengo"); title.setTextColor(Color.WHITE); title.setTextSize(30); title.setTypeface(null, 1);
        header.addView(title, new LinearLayout.LayoutParams(0, dp(64), 1));
        Button settings = new Button(this); settings.setText("Ajustes"); settings.setOnClickListener(v -> startActivity(new Intent(this, SettingsActivity.class))); header.addView(settings);
        root.addView(header);
        status = new TextView(this); status.setTextColor(Color.rgb(167,173,186)); status.setTextSize(17); status.setText("Conectando con GMM Server…"); root.addView(status);
        RecyclerView list = new RecyclerView(this); list.setClipToPadding(false); list.setPadding(0, dp(16), 0, dp(16)); list.setLayoutManager(new GridLayoutManager(this, 4));
        adapter = new MovieAdapter(this::play); list.setAdapter(adapter); root.addView(list, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
    }

    @Override protected void onResume() { super.onResume(); load(); }
    private void load() {
        status.setText("Conectando con GMM Server…");
        ServerConfig config = ServerConfig.load(this);
        executor.execute(() -> {
            try {
                List<Movie> movies = new ApiClient(config).catalog();
                runOnUiThread(() -> { adapter.setMovies(movies); status.setText(movies.size() + " películas disponibles"); });
            } catch (Exception error) {
                runOnUiThread(() -> status.setText("No se pudo conectar. Abre Ajustes y comprueba Tailscale, dirección y clave.\n" + error.getMessage()));
            }
        });
    }
    private void play(Movie movie) { startActivity(new Intent(this, PlayerActivity.class).putExtra("movie_id", movie.id).putExtra("title", movie.title)); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    @Override protected void onDestroy() { executor.shutdownNow(); super.onDestroy(); }
}
