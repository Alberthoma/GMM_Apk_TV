package com.givemymovies.tv;

import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public final class SettingsActivity extends AppCompatActivity {
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        ServerConfig current = ServerConfig.load(this);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setGravity(Gravity.CENTER); root.setPadding(dp(180), dp(50), dp(180), dp(50)); root.setBackgroundColor(Color.rgb(9,11,16));
        TextView title = new TextView(this); title.setText("Conectar GMM TV"); title.setTextColor(Color.WHITE); title.setTextSize(30); root.addView(title);
        EditText url = field("Dirección de GMM Server (Tailscale)", current.baseUrl); root.addView(url);
        EditText key = field("Clave de administración", current.key); key.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD); root.addView(key);
        CheckBox fallback = new CheckBox(this); fallback.setText("Usar Jellyfin como respaldo si GMM no puede reproducir"); fallback.setTextColor(Color.WHITE); fallback.setTextSize(18); fallback.setChecked(current.jellyfinFallback); fallback.setPadding(0, dp(18), 0, dp(18)); root.addView(fallback);
        Button save = new Button(this); save.setText("Guardar y volver"); save.setOnClickListener(v -> { new ServerConfig(url.getText().toString(), key.getText().toString(), fallback.isChecked()).save(this); finish(); }); root.addView(save);
        setContentView(root); url.requestFocus();
    }
    private EditText field(String hint, String value) { EditText field = new EditText(this); field.setHint(hint); field.setText(value); field.setTextColor(Color.WHITE); field.setHintTextColor(Color.GRAY); field.setTextSize(20); field.setSingleLine(true); field.setPadding(dp(16), dp(18), dp(16), dp(18)); return field; }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
