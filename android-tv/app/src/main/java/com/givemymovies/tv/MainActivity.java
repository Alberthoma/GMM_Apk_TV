package com.givemymovies.tv;

import android.app.Dialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.InputType;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends AppCompatActivity {
    private static final String[] GENRES = {"Todos los géneros", "Acción", "Aventura", "Animación", "Comedia", "Crimen", "Documental", "Drama", "Familia", "Fantasía", "Historia", "Terror", "Música", "Misterio", "Romance", "Ciencia ficción", "Película de TV", "Suspenso", "Bélica", "Western"};
    private static final int[] GENRE_IDS = {0, 28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 10770, 53, 10752, 37};
    private static final String[] RATINGS = {"Cualquier calificación", "5 o más", "6 o más", "7 o más", "8 o más", "9 o más"};
    private static final String[] ORDERS = {"Alfabéticamente", "Más reciente", "Más antigua", "Mejor calificada"};

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final List<Movie> catalog = new ArrayList<>();
    private final FilterState filters = new FilterState();
    private MovieAdapter adapter;
    private PosterRepository posters;
    private FavoriteStore favorites;
    private TextView status;
    private Button mediaButton;
    private Button favoritesButton;
    private Set<String> actorKeys;
    private boolean destroyed;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        posters = new PosterRepository(this);
        favorites = new FavoriteStore(this);
        loadFilters();

        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(dp(36), dp(20), dp(36), dp(16)); root.setBackgroundColor(Color.rgb(9,11,16));
        root.addView(createHeader());
        root.addView(createFilmStrip());
        root.addView(createToolbar());
        status = new TextView(this); status.setTextColor(Color.rgb(167,173,186)); status.setTextSize(16); status.setPadding(dp(8), dp(9), 0, dp(2)); status.setText("Conectando con GMM Server…"); root.addView(status);

        RecyclerView list = new RecyclerView(this); list.setClipToPadding(false); list.setPadding(dp(12), dp(8), dp(12), dp(16)); list.setLayoutManager(new GridLayoutManager(this, 4));
        adapter = new MovieAdapter(this::play, this::favoriteChanged, posters, favorites); list.setAdapter(adapter); root.addView(list, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
    }

    private View createHeader() {
        LinearLayout header = new LinearLayout(this); header.setGravity(Gravity.CENTER_VERTICAL); header.setPadding(dp(8), 0, dp(4), 0);
        ImageView logo = new ImageView(this); logo.setImageResource(R.drawable.app_icon); header.addView(logo, new LinearLayout.LayoutParams(dp(58), dp(58)));
        TextView brand = new TextView(this); SpannableString name = new SpannableString("givemymovies");
        name.setSpan(new ForegroundColorSpan(Color.rgb(72,205,217)), 4, 6, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        name.setSpan(new ForegroundColorSpan(Color.rgb(242,143,82)), 6, 8, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        brand.setText(name); brand.setTextColor(Color.WHITE); brand.setTextSize(30); brand.setTypeface(Typeface.DEFAULT_BOLD); brand.setPadding(dp(14), 0, 0, 0);
        header.addView(brand, new LinearLayout.LayoutParams(0, dp(66), 1));
        Button settings = button("⚙  Ajustes"); settings.setOnClickListener(v -> startActivity(new Intent(this, SettingsActivity.class))); header.addView(settings);
        return header;
    }

    private View createFilmStrip() {
        LinearLayout strip = new LinearLayout(this); strip.setGravity(Gravity.CENTER_VERTICAL); strip.setPadding(0, dp(2), 0, dp(2));
        for (int i = 0; i < 26; i++) {
            View hole = new View(this); hole.setBackgroundColor(Color.rgb(26,43,57));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(7), 1); lp.setMargins(dp(4), 0, dp(4), 0); strip.addView(hole, lp);
        }
        return strip;
    }

    private View createToolbar() {
        LinearLayout bar = new LinearLayout(this); bar.setGravity(Gravity.CENTER_VERTICAL); bar.setPadding(0, dp(8), 0, dp(2));
        mediaButton = button("tv".equals(filters.mediaType) ? "Series" : "Películas"); mediaButton.setOnClickListener(v -> { filters.mediaType = "movie".equals(filters.mediaType) ? "tv" : "movie"; mediaButton.setText("tv".equals(filters.mediaType) ? "Series" : "Películas"); applyFilters(); });
        favoritesButton = button(filters.favoritesOnly ? "★ Favoritas" : "☆ Favoritas"); favoritesButton.setOnClickListener(v -> { filters.favoritesOnly = !filters.favoritesOnly; favoritesButton.setText(filters.favoritesOnly ? "★ Favoritas" : "☆ Favoritas"); applyFilters(); });
        Button filter = button("⌕  Buscar y filtrar"); filter.setOnClickListener(v -> showFilters());
        Button clear = button("Limpiar"); clear.setOnClickListener(v -> { filters.clear(); actorKeys = null; mediaButton.setText("Películas"); favoritesButton.setText("☆ Favoritas"); applyFilters(); });
        bar.addView(favoritesButton); bar.addView(filter); bar.addView(mediaButton); bar.addView(clear);
        return bar;
    }

    private Button button(String text) {
        Button value = new Button(this); value.setText(text); value.setTextSize(15); value.setAllCaps(false); value.setFocusable(true);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, dp(50)); lp.setMargins(dp(5), 0, dp(5), 0); value.setLayoutParams(lp); return value;
    }

    @Override protected void onResume() { super.onResume(); if (catalog.isEmpty()) load(); }
    private void load() {
        status.setText("Conectando con GMM Server…"); ServerConfig config = ServerConfig.load(this);
        executor.execute(() -> {
            try {
                List<Movie> movies = new ApiClient(config).catalog();
                for (Movie movie : movies) posters.restore(movie);
                runOnUiThread(() -> {
                    catalog.clear(); catalog.addAll(movies); applyFilters(); indexNext(0);
                    if (!filters.actor.isEmpty()) posters.searchActor(filters.actor, keys -> { actorKeys = keys; applyFilters(); });
                });
            } catch (Exception error) {
                runOnUiThread(() -> status.setText("No se pudo conectar. Comprueba Tailscale, dirección y clave en Ajustes.\n" + error.getMessage()));
            }
        });
    }

    private void indexNext(int index) {
        if (destroyed || index >= catalog.size()) { if (!destroyed) applyFilters(); return; }
        Movie movie = catalog.get(index);
        posters.enrich(movie, value -> {
            if (index % 12 == 0) applyFilters();
            status.post(() -> indexNext(index + 1));
        });
    }

    private void applyFilters() {
        List<Movie> result = new ArrayList<>();
        String query = Movie.normalize(filters.title);
        for (Movie movie : catalog) {
            if (!filters.mediaType.equals(movie.mediaType)) continue;
            if (filters.favoritesOnly && !favorites.contains(movie.id)) continue;
            if (!query.isEmpty() && !Movie.normalize(movie.title).contains(query)) continue;
            int year = number(movie.year);
            if (filters.yearFrom > 0 && year < filters.yearFrom) continue;
            if (filters.yearTo > 0 && year > filters.yearTo) continue;
            if (filters.genreId > 0 && !matchesGenre(movie, filters.genreId)) continue;
            if (filters.minRating > 0 && movie.rating < filters.minRating) continue;
            if (!filters.actor.isEmpty()) {
                if (actorKeys == null) continue;
                String normalized = Movie.normalize(movie.title);
                if (!actorKeys.contains(movie.matchKey()) && !actorKeys.contains(normalized)) continue;
            }
            result.add(movie);
        }
        Comparator<Movie> comparator;
        if (filters.order == 1) comparator = (a,b) -> Integer.compare(number(b.year), number(a.year));
        else if (filters.order == 2) comparator = (a,b) -> Integer.compare(number(a.year), number(b.year));
        else if (filters.order == 3) comparator = (a,b) -> Double.compare(b.rating, a.rating);
        else comparator = (a,b) -> a.title.compareToIgnoreCase(b.title);
        Collections.sort(result, comparator);
        adapter.setMovies(result);
        saveFilters();
        String type = "tv".equals(filters.mediaType) ? "series" : "películas";
        status.setText(result.size() + " " + type + " · Mantén OK sobre una carátula para añadirla a Favoritas" + (posters.completed() > 0 && posters.completed() < catalog.size() ? " · Completando información " + posters.completed() + "/" + catalog.size() : ""));
    }

    private void showFilters() {
        Dialog dialog = new Dialog(this); dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        LinearLayout panel = new LinearLayout(this); panel.setOrientation(LinearLayout.VERTICAL); panel.setPadding(dp(36), dp(24), dp(36), dp(24)); panel.setBackgroundColor(Color.rgb(23,27,37));
        TextView title = label("Buscar y filtrar Te la tengo", 26); title.setTypeface(Typeface.DEFAULT_BOLD); panel.addView(title);
        EditText titleInput = field("Título", filters.title); panel.addView(titleInput);
        EditText actorInput = field("Actor o actriz", filters.actor); panel.addView(actorInput);
        LinearLayout years = new LinearLayout(this); EditText from = numberField("Año desde", filters.yearFrom); EditText to = numberField("Año hasta", filters.yearTo); years.addView(from, new LinearLayout.LayoutParams(0, dp(58), 1)); years.addView(to, new LinearLayout.LayoutParams(0, dp(58), 1)); panel.addView(years);
        Spinner genre = spinner(GENRES, indexOf(GENRE_IDS, filters.genreId)); panel.addView(genre);
        Spinner rating = spinner(RATINGS, Math.max(0, filters.minRating - 4)); panel.addView(rating);
        Spinner order = spinner(ORDERS, filters.order); panel.addView(order);
        LinearLayout actions = new LinearLayout(this); actions.setGravity(Gravity.END);
        Button cancel = button("Cancelar"); Button apply = button("Aplicar filtros"); actions.addView(cancel); actions.addView(apply); panel.addView(actions);
        linkFocus(titleInput, actorInput, from, to, genre, rating, order, apply);
        cancel.setOnClickListener(v -> dialog.dismiss());
        apply.setOnClickListener(v -> {
            filters.title = titleInput.getText().toString().trim(); filters.actor = actorInput.getText().toString().trim();
            filters.yearFrom = number(from.getText().toString()); filters.yearTo = number(to.getText().toString());
            if (filters.yearFrom > 0 && filters.yearTo == 0) filters.yearTo = filters.yearFrom;
            filters.genreId = GENRE_IDS[genre.getSelectedItemPosition()]; filters.minRating = rating.getSelectedItemPosition() == 0 ? 0 : rating.getSelectedItemPosition() + 4; filters.order = order.getSelectedItemPosition();
            actorKeys = filters.actor.isEmpty() ? null : new HashSet<>(); dialog.dismiss();
            if (!filters.actor.isEmpty()) { status.setText("Buscando trabajos de " + filters.actor + "…"); posters.searchActor(filters.actor, keys -> { actorKeys = keys; applyFilters(); }); }
            else applyFilters();
        });
        dialog.setContentView(panel); Window window = dialog.getWindow(); if (window != null) window.setLayout((int)(getResources().getDisplayMetrics().widthPixels * .72), ViewGroup.LayoutParams.WRAP_CONTENT);
        dialog.setOnShowListener(v -> { Window w = dialog.getWindow(); if (w != null) w.setLayout((int)(getResources().getDisplayMetrics().widthPixels * .72), ViewGroup.LayoutParams.WRAP_CONTENT); titleInput.requestFocus(); });
        dialog.show();
    }

    private TextView label(String text, int size) { TextView view = new TextView(this); view.setText(text); view.setTextColor(Color.WHITE); view.setTextSize(size); view.setPadding(dp(8), dp(5), dp(8), dp(5)); return view; }
    private EditText field(String hint, String value) { EditText view = new EditText(this); view.setHint(hint); view.setText(value); view.setSingleLine(true); view.setTextColor(Color.WHITE); view.setHintTextColor(Color.rgb(150,155,168)); view.setTextSize(18); view.setPadding(dp(14), dp(8), dp(14), dp(8)); return view; }
    private EditText numberField(String hint, int value) { EditText view = field(hint, value > 0 ? String.valueOf(value) : ""); view.setInputType(InputType.TYPE_CLASS_NUMBER); return view; }
    private Spinner spinner(String[] values, int selected) { Spinner view = new Spinner(this); ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, values); view.setAdapter(adapter); view.setSelection(Math.max(0, selected)); view.setMinimumHeight(dp(52)); view.setFocusable(true); return view; }
    private void linkFocus(View... views) { for (View view : views) view.setId(View.generateViewId()); for (int i=0; i<views.length-1; i++) { views[i].setNextFocusDownId(views[i+1].getId()); views[i].setNextFocusForwardId(views[i+1].getId()); views[i+1].setNextFocusUpId(views[i].getId()); } }
    private int indexOf(int[] values, int wanted) { for (int i=0; i<values.length; i++) if (values[i] == wanted) return i; return 0; }
    private boolean matchesGenre(Movie movie, int id) {
        if (movie.genreIds.contains(id)) return true;
        if (id == 28 || id == 12) return movie.genreIds.contains(10759);
        if (id == 14 || id == 878) return movie.genreIds.contains(10765);
        if (id == 10752) return movie.genreIds.contains(10768);
        return false;
    }
    private void loadFilters() {
        SharedPreferences p = getSharedPreferences("gmm_tv_filters", MODE_PRIVATE);
        filters.title=p.getString("title", ""); filters.actor=p.getString("actor", ""); filters.mediaType=p.getString("type", "movie");
        filters.yearFrom=p.getInt("from", 0); filters.yearTo=p.getInt("to", 0); filters.genreId=p.getInt("genre", 0); filters.minRating=p.getInt("rating", 0); filters.order=p.getInt("order", 0); filters.favoritesOnly=p.getBoolean("favorites", false);
    }
    private void saveFilters() {
        getSharedPreferences("gmm_tv_filters", MODE_PRIVATE).edit().putString("title", filters.title).putString("actor", filters.actor).putString("type", filters.mediaType)
                .putInt("from", filters.yearFrom).putInt("to", filters.yearTo).putInt("genre", filters.genreId).putInt("rating", filters.minRating).putInt("order", filters.order).putBoolean("favorites", filters.favoritesOnly).apply();
    }
    private static int number(String value) { try { return Integer.parseInt(value); } catch (Exception ignored) { return 0; } }
    private void favoriteChanged(Movie movie, boolean favorite) { Toast.makeText(this, favorite ? "Añadida a Favoritas" : "Quitada de Favoritas", Toast.LENGTH_SHORT).show(); if (filters.favoritesOnly) applyFilters(); }
    private void play(Movie movie) { startActivity(new Intent(this, PlayerActivity.class).putExtra("movie_id", movie.id).putExtra("title", movie.title)); }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    @Override protected void onDestroy() { destroyed = true; executor.shutdownNow(); if (posters != null) posters.close(); super.onDestroy(); }

    static final class FilterState {
        String title = "", actor = "", mediaType = "movie"; int yearFrom, yearTo, genreId, minRating, order; boolean favoritesOnly;
        void clear() { title = ""; actor = ""; mediaType = "movie"; yearFrom = yearTo = genreId = minRating = order = 0; favoritesOnly = false; }
    }
}
