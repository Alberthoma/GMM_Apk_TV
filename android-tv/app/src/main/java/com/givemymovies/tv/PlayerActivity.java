package com.givemymovies.tv;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;
import androidx.media3.ui.TrackSelectionDialogBuilder;

import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class PlayerActivity extends AppCompatActivity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private ExoPlayer player;
    private PlayerView playerView;
    private TextView status;
    private ApiClient api;
    private String movieId;
    private PlaybackStore playbackStore;
    private boolean resumed;
    private long lastSeekAt;

    private final Runnable saveProgress = new Runnable() {
        @Override public void run() { savePosition(); handler.postDelayed(this, 5000); }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        FrameLayout root = new FrameLayout(this); root.setBackgroundColor(Color.BLACK);
        playerView = new PlayerView(this); playerView.setUseController(true); playerView.setControllerShowTimeoutMs(4500); root.addView(playerView, new FrameLayout.LayoutParams(-1, -1));
        status = new TextView(this); status.setTextColor(Color.WHITE); status.setTextSize(20); status.setBackgroundColor(0xCC090B10); status.setPadding(dp(20), dp(14), dp(20), dp(14));
        FrameLayout.LayoutParams statusLp = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.CENTER_HORIZONTAL); statusLp.topMargin = dp(28); root.addView(status, statusLp);
        LinearLayout tracks = new LinearLayout(this); tracks.setGravity(Gravity.CENTER);
        Button audio = new Button(this); audio.setText("Audio"); audio.setOnClickListener(v -> showTracks(C.TRACK_TYPE_AUDIO, "Seleccionar audio")); tracks.addView(audio);
        Button subtitles = new Button(this); subtitles.setText("Subtítulos"); subtitles.setOnClickListener(v -> showTracks(C.TRACK_TYPE_TEXT, "Seleccionar subtítulos")); tracks.addView(subtitles);
        FrameLayout.LayoutParams trackLp = new FrameLayout.LayoutParams(-2, dp(58), Gravity.BOTTOM | Gravity.END); trackLp.setMargins(0, 0, dp(32), dp(28)); root.addView(tracks, trackLp);
        setContentView(root);

        player = new ExoPlayer.Builder(this).build(); playerView.setPlayer(player); playbackStore = new PlaybackStore(this);
        player.addListener(new Player.Listener() {
            @Override public void onPlayerError(PlaybackException error) { status.setVisibility(View.VISIBLE); status.setText("El TV no pudo decodificar este archivo.\n" + error.getErrorCodeName()); }
            @Override public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY) {
                    if (!resumed) { long saved = getIntent().getLongExtra("resume_position", playbackStore.position(movieId)); if (saved > 0) player.seekTo(saved); resumed = true; }
                    status.setVisibility(View.GONE); handler.removeCallbacks(saveProgress); handler.postDelayed(saveProgress, 5000);
                } else if (state == Player.STATE_ENDED) playbackStore.complete(movieId);
            }
        });
        api = new ApiClient(ServerConfig.load(this)); movieId = getIntent().getStringExtra("movie_id"); requestPlan();
    }

    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        boolean directionalRepeat = (code == KeyEvent.KEYCODE_DPAD_LEFT || code == KeyEvent.KEYCODE_DPAD_RIGHT) && event.getRepeatCount() > 0;
        boolean mediaSeek = code == KeyEvent.KEYCODE_MEDIA_FAST_FORWARD || code == KeyEvent.KEYCODE_MEDIA_REWIND;
        if ((directionalRepeat || mediaSeek) && event.getAction() == KeyEvent.ACTION_DOWN && player != null && player.isCurrentMediaItemSeekable()) {
            long now = android.os.SystemClock.uptimeMillis(); if (now - lastSeekAt < 220) return true; lastSeekAt = now;
            boolean forward = code == KeyEvent.KEYCODE_DPAD_RIGHT || code == KeyEvent.KEYCODE_MEDIA_FAST_FORWARD;
            long target = player.getCurrentPosition() + (forward ? 10000 : -10000);
            long duration = player.getDuration(); target = Math.max(0, duration > 0 ? Math.min(target, duration) : target); player.seekTo(target);
            status.setVisibility(View.VISIBLE); status.setText((forward ? "Avanzar  ▶  " : "◀  Retroceder  ") + PlaybackStore.time(target));
            handler.removeCallbacks(hideSeekStatus); handler.postDelayed(hideSeekStatus, 900); playerView.showController(); return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private final Runnable hideSeekStatus = () -> status.setVisibility(View.GONE);
    private void showTracks(int type, String title) {
        if (player == null) return;
        try { new TrackSelectionDialogBuilder(this, title, player, type).build().show(); }
        catch (Exception error) { status.setVisibility(View.VISIBLE); status.setText("No hay pistas disponibles para seleccionar."); handler.postDelayed(hideSeekStatus, 1800); }
    }

    private void requestPlan() {
        status.setVisibility(View.VISIBLE); status.setText("Preparando “" + getIntent().getStringExtra("title") + "”…");
        executor.execute(() -> {
            try {
                JSONObject plan = api.playbackPlan(movieId);
                if (plan.optInt("httpStatus") == 202) {
                    String strategy = plan.optString("estrategia"); runOnUiThread(() -> status.setText(strategy.equals("remux") ? "Adaptando el contenedor sin perder calidad…" : "Convirtiendo solo lo necesario…"));
                    handler.postDelayed(this::requestPlan, Math.max(800, plan.optLong("reintentarEnMs", 1500))); return;
                }
                String url = api.absolute(plan.getString("ruta")); String strategy = plan.optString("estrategia", "direct_play");
                runOnUiThread(() -> { status.setText(label(strategy)); player.setMediaItem(MediaItem.fromUri(url)); player.prepare(); player.play(); });
            } catch (Exception error) { runOnUiThread(() -> status.setText("No se pudo iniciar la reproducción.\n" + error.getMessage())); }
        });
    }
    private String label(String strategy) { if (strategy.equals("remux")) return "Remux · sin recodificar"; if (strategy.equals("transcode")) return "Transcodificación GMM"; if (strategy.equals("jellyfin")) return "Jellyfin · respaldo"; return "Direct Play · archivo original"; }
    private void savePosition() { if (player != null && movieId != null && player.getPlaybackState() != Player.STATE_IDLE) playbackStore.save(movieId, player.getCurrentPosition(), player.getDuration()); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    @Override protected void onStop() { savePosition(); if (player != null) player.pause(); super.onStop(); }
    @Override protected void onDestroy() { savePosition(); handler.removeCallbacksAndMessages(null); executor.shutdownNow(); if (player != null) player.release(); super.onDestroy(); }
}
