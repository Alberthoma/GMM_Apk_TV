package com.givemymovies.tv;

import android.graphics.Color;
import android.app.Dialog;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.Tracks;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

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
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        FrameLayout root = new FrameLayout(this); root.setBackgroundColor(Color.BLACK);
        playerView = new PlayerView(this); playerView.setUseController(true); playerView.setControllerShowTimeoutMs(4500); root.addView(playerView, new FrameLayout.LayoutParams(-1, -1));
        status = new TextView(this); status.setTextColor(Color.WHITE); status.setTextSize(20); status.setBackgroundColor(0xCC090B10); status.setPadding(dp(20), dp(14), dp(20), dp(14));
        FrameLayout.LayoutParams statusLp = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.CENTER_HORIZONTAL); statusLp.topMargin = dp(28); root.addView(status, statusLp);
        LinearLayout trackControls = new LinearLayout(this); trackControls.setGravity(Gravity.CENTER); trackControls.setVisibility(View.GONE);
        ImageButton audio = iconButton(R.drawable.ic_audio, "Seleccionar audio"); audio.setOnClickListener(v -> showTracks(C.TRACK_TYPE_AUDIO, "Seleccionar audio")); trackControls.addView(audio, iconParams());
        ImageButton subtitles = iconButton(R.drawable.ic_subtitles, "Seleccionar subtítulos"); subtitles.setOnClickListener(v -> showTracks(C.TRACK_TYPE_TEXT, "Seleccionar subtítulos")); trackControls.addView(subtitles, iconParams());
        FrameLayout.LayoutParams trackLp = new FrameLayout.LayoutParams(-2, dp(58), Gravity.BOTTOM | Gravity.END); trackLp.setMargins(0, 0, dp(32), dp(28)); root.addView(trackControls, trackLp);
        playerView.setControllerVisibilityListener((PlayerView.ControllerVisibilityListener) visibility -> trackControls.setVisibility(visibility));
        setContentView(root);

        player = new ExoPlayer.Builder(this).build(); player.setWakeMode(C.WAKE_MODE_LOCAL); playerView.setPlayer(player); playbackStore = new PlaybackStore(this);
        player.addListener(new Player.Listener() {
            @Override public void onPlayerError(PlaybackException error) { status.setVisibility(View.VISIBLE); status.setText("El TV no pudo decodificar este archivo.\n" + error.getErrorCodeName()); }
            @Override public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY) {
                    if (!resumed) { long saved = getIntent().getLongExtra("resume_position", playbackStore.position(movieId)); if (saved > 0) player.seekTo(saved); resumed = true; }
                    status.setVisibility(View.GONE); handler.removeCallbacks(saveProgress); handler.postDelayed(saveProgress, 5000);
                } else if (state == Player.STATE_ENDED) playbackStore.complete(movieId);
            }
            @Override public void onIsPlayingChanged(boolean isPlaying) { playerView.setKeepScreenOn(isPlaying); }
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
        Dialog dialog = new Dialog(this); dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        RadioGroup choices = new RadioGroup(this); choices.setOrientation(LinearLayout.VERTICAL); choices.setPadding(dp(28), dp(22), dp(28), dp(22)); choices.setBackgroundColor(Color.rgb(23,27,37));
        TextView heading = new TextView(this); heading.setText(title); heading.setTextColor(Color.WHITE); heading.setTextSize(25); heading.setPadding(dp(10), 0, dp(10), dp(14)); choices.addView(heading);
        java.util.List<RadioButton> rows = new java.util.ArrayList<>();
        if (type == C.TRACK_TYPE_TEXT) {
            RadioButton off = trackRow("Desactivados", player.getTrackSelectionParameters().disabledTrackTypes.contains(C.TRACK_TYPE_TEXT));
            off.setOnClickListener(v -> { player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon().clearOverridesOfType(type).setTrackTypeDisabled(type, true).build()); dialog.dismiss(); }); choices.addView(off); rows.add(off);
        }
        int number = 1;
        for (Tracks.Group group : player.getCurrentTracks().getGroups()) {
            if (group.getType() != type) continue;
            for (int i = 0; i < group.length; i++) {
                if (!group.isTrackSupported(i)) continue;
                Format format = group.getTrackFormat(i); String label = trackLabel(format, number++); RadioButton row = trackRow(label, group.isTrackSelected(i)); final int trackIndex = i;
                row.setOnClickListener(v -> { TrackSelectionOverride override = new TrackSelectionOverride(group.getMediaTrackGroup(), trackIndex); player.setTrackSelectionParameters(player.getTrackSelectionParameters().buildUpon().setTrackTypeDisabled(type, false).clearOverridesOfType(type).addOverride(override).build()); dialog.dismiss(); });
                choices.addView(row); rows.add(row);
            }
        }
        if (rows.isEmpty()) { status.setVisibility(View.VISIBLE); status.setText("No hay pistas disponibles para seleccionar."); handler.postDelayed(hideSeekStatus, 1800); return; }
        for (int i=0; i<rows.size(); i++) {
            RadioButton row = rows.get(i); row.setId(View.generateViewId());
            row.setOnFocusChangeListener((view, focused) -> { if (focused) choices.check(view.getId()); view.setBackgroundColor(focused ? Color.rgb(242,143,82) : Color.TRANSPARENT); });
            if (i>0) { rows.get(i-1).setNextFocusDownId(row.getId()); row.setNextFocusUpId(rows.get(i-1).getId()); }
        }
        ScrollView scroll = new ScrollView(this); scroll.addView(choices); dialog.setContentView(scroll); dialog.setOnShowListener(v -> { Window window = dialog.getWindow(); if (window != null) window.setLayout(dp(620), Math.min(dp(650), getResources().getDisplayMetrics().heightPixels - dp(60))); RadioButton selected = rows.get(0); for (RadioButton row : rows) if (row.isChecked()) selected = row; selected.requestFocus(); }); dialog.show();
    }

    private ImageButton iconButton(int icon, String description) { ImageButton button = new ImageButton(this); button.setImageResource(icon); button.setContentDescription(description); button.setBackgroundResource(R.drawable.gmm_icon_button); button.setPadding(dp(12), dp(12), dp(12), dp(12)); button.setFocusable(true); return button; }
    private LinearLayout.LayoutParams iconParams() { LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(54), dp(54)); lp.setMargins(dp(5), 0, dp(5), 0); return lp; }
    private RadioButton trackRow(String label, boolean checked) { RadioButton row = new RadioButton(this); row.setText(label); row.setTextColor(Color.WHITE); row.setTextSize(19); row.setChecked(checked); row.setFocusable(true); row.setFocusableInTouchMode(true); row.setGravity(Gravity.CENTER_VERTICAL); row.setPadding(dp(14), dp(12), dp(14), dp(12)); row.setMinimumHeight(dp(58)); return row; }
    private String trackLabel(Format format, int number) { String label = format.label; if (label == null || label.trim().isEmpty()) label = format.language; if (label == null || label.trim().isEmpty() || "und".equals(label)) label = "Pista " + number; return label; }

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
