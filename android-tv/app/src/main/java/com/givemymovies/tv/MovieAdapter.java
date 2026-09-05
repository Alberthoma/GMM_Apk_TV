package com.givemymovies.tv;

import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.ArrayList;
import java.util.List;

final class MovieAdapter extends RecyclerView.Adapter<MovieAdapter.Holder> {
    interface Listener { void onPlay(Movie movie); }
    private final List<Movie> movies = new ArrayList<>();
    private final Listener listener;
    MovieAdapter(Listener listener) { this.listener = listener; }
    void setMovies(List<Movie> values) { movies.clear(); movies.addAll(values); notifyDataSetChanged(); }

    @NonNull @Override public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        LinearLayout card = new LinearLayout(parent.getContext());
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.BOTTOM);
        card.setPadding(dp(parent, 22), dp(parent, 18), dp(parent, 22), dp(parent, 18));
        card.setFocusable(true);
        card.setClickable(true);
        card.setBackgroundResource(com.givemymovies.tv.R.drawable.focus_card);
        RecyclerView.LayoutParams lp = new RecyclerView.LayoutParams(dp(parent, 280), dp(parent, 158));
        lp.setMargins(dp(parent, 10), dp(parent, 10), dp(parent, 10), dp(parent, 10));
        card.setLayoutParams(lp);
        TextView title = new TextView(parent.getContext());
        title.setTextColor(Color.WHITE); title.setTextSize(20); title.setTypeface(Typeface.DEFAULT_BOLD); title.setMaxLines(2);
        TextView meta = new TextView(parent.getContext());
        meta.setTextColor(Color.rgb(167,173,186)); meta.setTextSize(14); meta.setPadding(0, dp(parent, 8), 0, 0);
        card.addView(title); card.addView(meta);
        return new Holder(card, title, meta);
    }

    @Override public void onBindViewHolder(@NonNull Holder holder, int position) {
        Movie movie = movies.get(position);
        holder.title.setText(movie.title);
        String meta = movie.year;
        if (!movie.compatibility.isEmpty()) meta += (meta.isEmpty() ? "" : "  •  ") + movie.compatibility;
        holder.meta.setText(meta);
        holder.itemView.setOnClickListener(v -> listener.onPlay(movie));
        holder.itemView.setOnFocusChangeListener((v, focused) -> {
            v.animate().scaleX(focused ? 1.06f : 1f).scaleY(focused ? 1.06f : 1f).setDuration(120).start();
            v.setElevation(focused ? dp(v, 14) : dp(v, 2));
        });
    }
    @Override public int getItemCount() { return movies.size(); }
    private static int dp(View view, int value) { return Math.round(value * view.getResources().getDisplayMetrics().density); }
    static final class Holder extends RecyclerView.ViewHolder {
        final TextView title; final TextView meta;
        Holder(View root, TextView title, TextView meta) { super(root); this.title = title; this.meta = meta; }
    }
}
