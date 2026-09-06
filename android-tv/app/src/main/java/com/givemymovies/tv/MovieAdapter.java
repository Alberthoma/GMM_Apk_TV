package com.givemymovies.tv;

import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
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
    private final PosterRepository posters = new PosterRepository();
    MovieAdapter(Listener listener) { this.listener = listener; }
    void setMovies(List<Movie> values) { movies.clear(); movies.addAll(values); notifyDataSetChanged(); }

    @NonNull @Override public Holder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        FrameLayout card = new FrameLayout(parent.getContext());
        card.setFocusable(true);
        card.setClickable(true);
        card.setBackgroundResource(R.drawable.focus_card);
        card.setForeground(parent.getContext().getDrawable(R.drawable.focus_poster));
        RecyclerView.LayoutParams lp = new RecyclerView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(parent, 290));
        lp.setMargins(dp(parent, 8), dp(parent, 10), dp(parent, 8), dp(parent, 10));
        card.setLayoutParams(lp);

        ImageView poster = new ImageView(parent.getContext());
        poster.setScaleType(ImageView.ScaleType.CENTER_CROP);
        poster.setBackgroundColor(Color.rgb(36, 31, 49));
        card.addView(poster, new FrameLayout.LayoutParams(-1, -1));

        View gradient = new View(parent.getContext());
        gradient.setBackgroundResource(R.drawable.poster_gradient);
        card.addView(gradient, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout labels = new LinearLayout(parent.getContext());
        labels.setOrientation(LinearLayout.VERTICAL);
        labels.setGravity(Gravity.BOTTOM);
        labels.setPadding(dp(parent, 16), dp(parent, 16), dp(parent, 16), dp(parent, 17));
        TextView title = new TextView(parent.getContext());
        title.setTextColor(Color.WHITE); title.setTextSize(18); title.setTypeface(Typeface.DEFAULT_BOLD); title.setMaxLines(2);
        TextView meta = new TextView(parent.getContext());
        meta.setTextColor(Color.rgb(215, 218, 225)); meta.setTextSize(13); meta.setPadding(0, dp(parent, 6), 0, 0);
        labels.addView(title); labels.addView(meta);
        card.addView(labels, new FrameLayout.LayoutParams(-1, -1));
        return new Holder(card, poster, title, meta);
    }

    @Override public void onBindViewHolder(@NonNull Holder holder, int position) {
        Movie movie = movies.get(position);
        holder.boundId = movie.id;
        holder.title.setText(movie.title);
        String meta = movie.year;
        if (!movie.compatibility.isEmpty()) meta += (meta.isEmpty() ? "" : "  •  ") + movie.compatibility;
        holder.meta.setText(meta);
        holder.poster.setImageDrawable(null);
        posters.load(movie, image -> {
            if (!movie.id.equals(holder.boundId) || image == null) return;
            holder.poster.setImageBitmap(image);
        });
        holder.itemView.setOnClickListener(v -> listener.onPlay(movie));
        holder.itemView.setOnFocusChangeListener((v, focused) -> {
            v.animate().scaleX(focused ? 1.035f : 1f).scaleY(focused ? 1.035f : 1f).setDuration(120).start();
            v.setElevation(focused ? dp(v, 14) : dp(v, 2));
        });
    }

    @Override public void onViewRecycled(@NonNull Holder holder) {
        holder.boundId = null;
        holder.poster.setImageDrawable(null);
        super.onViewRecycled(holder);
    }

    void close() { posters.close(); }
    @Override public int getItemCount() { return movies.size(); }
    private static int dp(View view, int value) { return Math.round(value * view.getResources().getDisplayMetrics().density); }
    static final class Holder extends RecyclerView.ViewHolder {
        final ImageView poster; final TextView title; final TextView meta; String boundId;
        Holder(View root, ImageView poster, TextView title, TextView meta) { super(root); this.poster = poster; this.title = title; this.meta = meta; }
    }
}
