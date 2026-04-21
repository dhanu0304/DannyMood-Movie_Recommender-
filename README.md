# 🎬 DannyMood — Movie Recommender

A beginner-friendly Flask web app that recommends movies based on your mood, 
powered by the TMDB API. Looks like Netflix. Works like magic.

---

## 📁 Project Structure

```
DannyMood/
├── app.py              ← Flask backend (all Python logic here)
├── requirements.txt    ← Python packages to install
├── .env.example        ← Copy this to .env and add your API key
├── templates/
│   └── index.html      ← The one HTML page
└── static/
    ├── css/
    │   └── style.css   ← All the styling
    └── js/
        └── main.js     ← All the JavaScript
```

---

## 🚀 How to Run

### Step 1 — Install dependencies
```bash
pip install -r requirements.txt
```

### Step 2 — Set your TMDB API key
1. Get a free API key at: https://www.themoviedb.org/settings/api
2. Copy `.env.example` to `.env`
3. Replace `your_tmdb_api_key_here` with your actual key

Or just open `app.py` and replace `YOUR_TMDB_API_KEY_HERE` directly.

### Step 3 — Run the app
```bash
python app.py
```

### Step 4 — Open in browser
Go to: **http://localhost:5000**

> ⚠️ If you don't set an API key, the app will show demo placeholder movies.

---

## ✨ Features

| Feature | Description |
|--------|-------------|
| 🔥 Trending | Live trending movies from TMDB |
| 🎬 Popular | Currently popular movies |
| ⭐ Top Picks | Top-rated movies of all time |
| 😢 Mood Filter | Filter movies by mood (Sad, Romantic, Thriller...) |
| 🔍 Search | Search by title with live results |
| ← Back Button | Returns to homepage after searching |
| 🎥 Trailers | YouTube trailers in the movie modal |
| 📱 Responsive | Works on desktop and mobile |

---

## 🔌 API Endpoints

| Endpoint | What it does |
|---------|-------------|
| `GET /` | Serves the app homepage |
| `GET /api/trending` | Returns trending movies |
| `GET /api/popular` | Returns popular movies |
| `GET /api/top-rated` | Returns top-rated movies |
| `GET /api/search?q=batman` | Searches for a movie |
| `GET /api/mood?mood=Thriller` | Returns movies for a mood |
| `GET /api/movie/123/trailer` | Returns the YouTube trailer key |

---

## 🎨 Rating System

| Rating | Score Range | Color |
|--------|------------|-------|
| Perfection | 8.0+ | 🟢 Green |
| Go For It | 6.5–7.9 | 🔵 Blue |
| Timepass | 5.0–6.4 | 🟡 Yellow |
| Skip | Below 5.0 | 🔴 Red |
