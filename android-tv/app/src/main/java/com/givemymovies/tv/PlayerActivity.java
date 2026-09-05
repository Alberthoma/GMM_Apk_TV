package com.givemymovies.tv;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class PlayerActivity extends AppCompatActivity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private ExoPlayer player;
    private TextView status;
    private ApiClient api;
    private String movieId;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        FrameLayout root = new FrameLayout(this); root.setBackgroundColor(Color.BLACK);
        PlayerView view = new PlayerView(this); view.setUseController(true); root.addView(view, new FrameLayout.LayoutParams(-1, -1));
        status = new TextView(this); status.setTextColor(Color.WHITE); status.setTextSize(20); status.setBackgroundColor(0xAA090B10); status.setPadding(dp(20), dp(14), dp(20), dp(14));
        FrameLayout.LayoutParams statusLp = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.CENTER_HORIZONTAL); statusLp.topMargin = dp(28); root.addView(status, statusLp);
        setContentView(root);
        player = new ExoPlayer.Builder(this).build(); view.setPlayer(player);
        player.addListener(new Player.Listener() {
            @Override public void onPlayerError(PlaybackException error) { status.setVisibility(View.VISIBLE); status.setText("El TV no pudo decodificar este archivo.\n" + error.getErrorCodeName()); }
            @Override public void onPlaybackStateChanged(int state) { if (state == Player.STATE_READY) status.setVisibility(View.GONE); }
        });
        api = new ApiClient(ServerConfig.load(this)); movieId = getIntent().getStringExtra("movie_id"); requestPlan();
    }

    private void requestPlan() {
        status.setVisibility(View.VISIBLE); status.setText("Preparando “" + getIntent().getStringExtra("title") + "”…");
        executor.execute(() -> {
            try {
                JSONObject plan = api.playbackPlan(movieId);
                if (plan.optInt("httpStatus") == 202) {
                    String strategy = plan.optString("estrategia");
                    runOnUiThread(() -> status.setText(strategy.equals("remux") ? "Adaptando el contenedor sin perder calidad…" : "Convirtiendo solo lo necesario…"));
                    handler.postDelayed(this::requestPlan, Math.max(800, plan.optLong("reintentarEnMs", 1500)));
                    return;
                }
                String url = api.absolute(plan.getString("ruta"));
                String strategy = plan.optString("estrategia", "direct_play");
                runOnUiThread(() -> { status.setText(label(strategy)); player.setMediaItem(MediaItem.fromUri(url)); player.prepare(); player.play(); });
            } catch (Exception error) { runOnUiThread(() -> status.setText("No se pudo iniciar la reproducción.\n" + error.getMessage())); }
        });
    }
    private String label(String strategy) {
        if (strategy.equals("remux")) return "Remux · sin recodificar";
        if (strategy.equals("transcode")) return "Transcodificación GMM";
        if (strategy.equals("jellyfin")) return "Jellyfin · respaldo";
        return "Direct Play · archivo original";
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    @Override protected void onStop() { player.pause(); super.onStop(); }
    @Override protected void onDestroy() { handler.removeCallbacksAndMessages(null); executor.shutdownNow(); player.release(); super.onDestroy(); }
}
