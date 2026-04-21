"""
DannyMood - Movie Recommender App
===================================
A beginner-friendly Flask app that uses the TMDB API
to show trending, popular, and top-rated movies.

HOW TO RUN:
1. Install dependencies:  pip install flask requests python-dotenv
2. Set your TMDB API key:
   - Create a .env file with: TMDB_API_KEY=your_key_here
3. Run: python app.py
4. Open: http://localhost:5000

Get a free TMDB API key at: https://www.themoviedb.org/settings/api
"""

import os
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from flask import Flask, jsonify, render_template, request
from dotenv import load_dotenv

# Load variables from .env file (if it exists)
load_dotenv()

app = Flask(__name__)

# Configure a requests session with retries for flaky TMDB network calls
TMDB_SESSION = requests.Session()
retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
)
TMDB_SESSION.mount("https://", HTTPAdapter(max_retries=retry_strategy))
TMDB_SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
})

# ─────────────────────────────────────────────
# TMDB API CONFIGURATION
# ─────────────────────────────────────────────

# Get TMDB API key from environment variable only (do not hardcode in code)
TMDB_API_KEY = os.environ.get("TMDB_API_KEY")

if not TMDB_API_KEY:
    raise RuntimeError("TMDB_API_KEY not set. Please add it to your .env file or environment variables.")

TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
TMDB_IMAGE_ORIGINAL = "https://image.tmdb.org/t/p/original"

# ─────────────────────────────────────────────
# GENRE MAP: TMDB genre ID → genre name
# ─────────────────────────────────────────────
GENRE_MAP = {
    28: "Action", 12: "Adventure", 16: "Animation",
    35: "Comedy", 80: "Crime", 99: "Documentary",
    18: "Drama", 10751: "Family", 14: "Fantasy",
    36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
    10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western",
    16: "Animation",  35: "Comedy",  10759: "Anime"  # 10759 is not official, but 16 is Animation (used for anime)
}

# Mood → list of TMDB genre IDs
MOOD_TO_GENRES = {
    "Sad":          [18, 10749],        # Drama, Romance
    "Romantic":     [10749, 18],        # Romance, Drama
    "Thriller":     [53, 27, 80],       # Thriller, Horror, Crime
    "Feel-good":    [35, 10751, 16],    # Comedy, Family, Animation
    "Mind-blowing": [878, 9648, 14],    # Sci-Fi, Mystery, Fantasy
    "Anime":        [16],               # Animation (used for anime)
}

# ─────────────────────────────────────────────
# FALLBACK DEMO DATA (used only if API fails)
# ─────────────────────────────────────────────
DEMO_MOVIES = [
    {
        "id": "demo-1", "title": "Echoes in the Dark",
        "image": "https://images.unsplash.com/photo-1773592612185-bd985ac2bfe2?w=500",
        "summary": "A psychological thriller that explores the depths of human consciousness.",
        "rating": "perfection", "mood": ["Thriller", "Mind-blowing"],
        "year": "2025", "genre": "Psychological Thriller", "vote_average": 8.5,
    },
    {
        "id": "anime-1", "title": "Spirited Away",
        "image": "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
        "summary": "A young girl enters a world of spirits and must find her way back.",
        "rating": "perfection", "mood": ["Anime", "Mind-blowing", "Feel-good"],
        "year": "2001", "genre": "Animation/Adventure/Family", "vote_average": 8.6,
    },
    {
        "id": "anime-2", "title": "Your Name",
        "image": "https://image.tmdb.org/t/p/w500/q719jXXEzOoYaps6babgKnONONX.jpg",
        "summary": "Two teenagers share a profound, magical connection upon discovering they are swapping bodies.",
        "rating": "perfection", "mood": ["Anime", "Romantic", "Mind-blowing"],
        "year": "2016", "genre": "Animation/Drama/Fantasy", "vote_average": 8.5,
    },
    {
        "id": "anime-3", "title": "A Silent Voice",
        "image": "https://image.tmdb.org/t/p/w500/nDP33LmQwNsnPv29GQazz59HjJI.jpg",
        "summary": "A former class bully reaches out to the deaf girl he tormented in grade school.",
        "rating": "go-for-it", "mood": ["Anime", "Sad", "Feel-good"],
        "year": "2016", "genre": "Animation/Drama/Romance", "vote_average": 8.2,
    },
    {
        "id": "demo-2", "title": "Crimson Horizon",
        "image": "https://images.unsplash.com/photo-1771777138502-a0e75dce9101?w=500",
        "summary": "Two souls find each other at the edge of the world.",
        "rating": "go-for-it", "mood": ["Romantic", "Feel-good"],
        "year": "2024", "genre": "Romance/Drama", "vote_average": 7.2,
    },
    {
        "id": "demo-3", "title": "Neon Dreams",
        "image": "https://images.unsplash.com/photo-1764237769175-47c3e556daa9?w=500",
        "summary": "In a cyberpunk metropolis, a hacker discovers a conspiracy that could change everything.",
        "rating": "go-for-it", "mood": ["Thriller", "Mind-blowing"],
        "year": "2025", "genre": "Sci-Fi/Thriller", "vote_average": 7.8,
    },
    {
        "id": "demo-4", "title": "Electric Hearts",
        "image": "https://images.unsplash.com/photo-1774016591273-9bc347fc64b8?w=500",
        "summary": "A vibrant musical journey through love and self-discovery.",
        "rating": "perfection", "mood": ["Feel-good", "Romantic"],
        "year": "2025", "genre": "Musical/Romance", "vote_average": 8.1,
    },
    {
        "id": "demo-5", "title": "The Vanishing",
        "image": "https://images.unsplash.com/photo-1738980420952-56cc02acd17f?w=500",
        "summary": "When people start disappearing without a trace, one investigator races against time.",
        "rating": "perfection", "mood": ["Thriller"],
        "year": "2025", "genre": "Thriller/Mystery", "vote_average": 8.3,
    },
    {
        "id": "demo-6", "title": "Blue & Red",
        "image": "https://images.unsplash.com/photo-1770055204250-f756f10e1ebf?w=500",
        "summary": "A mind-bending exploration of duality and identity.",
        "rating": "perfection", "mood": ["Mind-blowing", "Thriller"],
        "year": "2025", "genre": "Psychological/Sci-Fi", "vote_average": 8.7,
    },
    {
        "id": "demo-7", "title": "3 Idiots",
        "image": "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?w=500",
        "summary": "Three engineering students navigate friendship, pressure, and the meaning of success.",
        "rating": "perfection", "mood": ["Feel-good", "Romantic"],
        "year": "2009", "genre": "Comedy/Drama", "vote_average": 8.4,
    },
    {
        "id": "demo-8", "title": "Taare Zameen Par",
        "image": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=500",
        "summary": "A gifted child struggles in school until an art teacher helps him discover his true self.",
        "rating": "go-for-it", "mood": ["Feel-good", "Sad"],
        "year": "2007", "genre": "Drama/Family", "vote_average": 8.2,
    },
    {
        "id": "anime-4", "title": "Death Note",
        "image": "https://image.tmdb.org/t/p/w500/mggv9zSKnJMZHl50DXuAANtD6S.jpg",
        "summary": "An intelligent high schooler discovers a mysterious notebook that can make any person whose name is written on it die.",
        "rating": "perfection", "mood": ["Anime", "Thriller", "Mind-blowing"],
        "year": "2006", "genre": "Animation/Drama/Thriller", "vote_average": 8.7,
    },
    {
        "id": "anime-5", "title": "Demon Slayer",
        "image": "https://image.tmdb.org/t/p/w500/mPJ0j00H0CwsSMNERXz5OdxjDIH.jpg",
        "summary": "A young demon slayer embarks on a quest to cure his sister who has been transformed into a demon.",
        "rating": "perfection", "mood": ["Anime", "Mind-blowing", "Feel-good"],
        "year": "2019", "genre": "Animation/Action/Adventure", "vote_average": 8.5,
    },
    {
        "id": "anime-6", "title": "Steins;Gate",
        "image": "https://image.tmdb.org/t/p/w500/sxR8W1rjBb0d43V0iKkfPxYFHwC.jpg",
        "summary": "A group of friends discover they can send messages to the past, and must prevent a catastrophic future.",
        "rating": "perfection", "mood": ["Anime", "Mind-blowing", "Thriller"],
        "year": "2011", "genre": "Animation/Drama/Sci-Fi", "vote_average": 9.0,
    },
    {
        "id": "anime-7", "title": "Jujutsu Kaisen",
        "image": "https://image.tmdb.org/t/p/w500/D41qJi2aX3JdH1FLU8j0fgKxg9w.jpg",
        "summary": "A high school boy swallows a cursed finger and joins a secret organization of jujutsu sorcerers.",
        "rating": "go-for-it", "mood": ["Anime", "Mind-blowing", "Thriller"],
        "year": "2020", "genre": "Animation/Action/Drama", "vote_average": 8.6,
    },
    {
        "id": "anime-8", "title": "Attack on Titan",
        "image": "https://image.tmdb.org/t/p/w500/hTP3dSMffxDKSVr2XV6Yvr4j3Zw.jpg",
        "summary": "Humanity fights for survival against giant humanoid creatures that suddenly appear and begin devouring people.",
        "rating": "perfection", "mood": ["Anime", "Thriller", "Mind-blowing"],
        "year": "2013", "genre": "Animation/Action/Adventure", "vote_average": 8.8,
    },
]


# ─────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────

def get_rating_from_score(score):
    """
    Convert TMDB vote_average (0-10) to our custom rating label.
    Example: 8.5 → 'perfection', 7.0 → 'go-for-it'
    """
    if score >= 8.0:
        return "perfection"
    elif score >= 6.5:
        return "go-for-it"
    elif score >= 5.0:
        return "timepass"
    else:
        return "skip"


def get_moods_from_genres(genre_ids):
    """
    Convert a list of TMDB genre IDs into our mood labels.
    Example: [53, 27] → ['Thriller']
    """
    moods = []

    if any(g in genre_ids for g in [18, 10749]):
        moods.append("Sad")
    if 10749 in genre_ids:
        moods.append("Romantic")
    if any(g in genre_ids for g in [53, 27, 80]):
        moods.append("Thriller")
    if any(g in genre_ids for g in [35, 10751, 16]):
        moods.append("Feel-good")
    if any(g in genre_ids for g in [878, 9648, 14]):
        moods.append("Mind-blowing")

    # Default mood if nothing matched
    return moods if moods else ["Feel-good"]


def transform_movie(movie):
    """
    Convert a raw TMDB movie dict into our app's movie format.
    This is called on every movie from the TMDB API.
    """
    genre_ids = movie.get("genre_ids", [])

    # Build a readable genre string like "Action, Drama"
    genre_names = ", ".join(
        GENRE_MAP[g] for g in genre_ids if g in GENRE_MAP
    ) or "Drama"

    # Use poster image, or backdrop as fallback
    poster = movie.get("poster_path")
    backdrop = movie.get("backdrop_path")
    if poster:
        image_url = f"{TMDB_IMAGE_BASE}{poster}"
    elif backdrop:
        image_url = f"{TMDB_IMAGE_BASE}{backdrop}"
    else:
        image_url = "https://images.unsplash.com/photo-1557701472-b7ea9af8aa9a?w=500"

    vote = movie.get("vote_average", 0)

    return {
        "id": str(movie.get("id", "")),
        "title": movie.get("title", "Untitled"),
        "image": image_url,
        "backdrop": f"{TMDB_IMAGE_ORIGINAL}{backdrop}" if backdrop else image_url,
        "summary": movie.get("overview") or "No summary available.",
        "rating": get_rating_from_score(vote),
        "vote_average": round(vote, 1),
        "mood": get_moods_from_genres(genre_ids),
        "year": (movie.get("release_date") or "2024")[:4],  # Get just the year
        "genre": genre_names,
    }


def fetch_from_tmdb(endpoint, params=None):
    """
    Make a request to the TMDB API.
    Returns a list of transformed movies, or an empty list on error.
    """
    if not TMDB_API_KEY:
        return []  # No key set, return empty (frontend will show demo data)

    # Build the request URL
    url = f"{TMDB_BASE_URL}{endpoint}"
    all_params = {"api_key": TMDB_API_KEY, "language": "en-US"}
    if params:
        all_params.update(params)

    try:
        response = TMDB_SESSION.get(url, params=all_params, timeout=8)
        response.raise_for_status()  # Raise error if status is 4xx or 5xx
        data = response.json()
        movies = data.get("results", [])

        # Only include movies that have a poster image
        movies_with_posters = [m for m in movies if m.get("poster_path")]

        return [transform_movie(m) for m in movies_with_posters]

    except requests.exceptions.Timeout:
        print("TMDB API request timed out")
        return []
    except requests.exceptions.RequestException as e:
        print(f"TMDB API error: {e}")
        return []


# ─────────────────────────────────────────────
# FLASK ROUTES
# ─────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main HTML page."""
    return render_template("index.html")


@app.route("/api/trending")
def get_trending():
    """
    Return trending movies from TMDB.
    Falls back to popular or demo data if the trending endpoint is unavailable.
    """
    movies = fetch_from_tmdb("/trending/movie/week")

    if not movies:
        # If trending fails, fall back to popular movies so the hero section still shows live data.
        movies = fetch_from_tmdb("/movie/popular")

    if not movies:
        return jsonify({"movies": DEMO_MOVIES, "source": "demo"})

    return jsonify({"movies": movies, "source": "tmdb"})


@app.route("/api/popular")
def get_popular():
    """Return currently popular movies."""
    movies = fetch_from_tmdb("/movie/popular")

    if not movies:
        return jsonify({"movies": DEMO_MOVIES, "source": "demo"})

    return jsonify({"movies": movies, "source": "tmdb"})


@app.route("/api/top-rated")
def get_top_rated():
    """Return top-rated movies (great for 'Top Picks' section)."""
    movies = fetch_from_tmdb("/movie/top_rated")

    if not movies:
        # If the top-rated endpoint is flaky, use discover sorted by vote average as a stronger fallback.
        movies = fetch_from_tmdb(
            "/discover/movie",
            params={
                "sort_by": "vote_average.desc",
                "vote_count.gte": 500,
            }
        )

    if not movies:
        # Filter demo movies to only show top-rated ones
        top = [m for m in DEMO_MOVIES if m["rating"] == "perfection"]
        return jsonify({"movies": top, "source": "demo"})

    return jsonify({"movies": movies, "source": "tmdb"})


@app.route("/api/indian")
def get_indian_movies():
    """
    Return Indian movies from TMDB using the Hindi original-language filter.
    This keeps the homepage diverse with popular movies from India.
    """
    movies = fetch_from_tmdb(
        "/discover/movie",
        params={
            "with_original_language": "hi",
            "sort_by": "popularity.desc",
            "vote_count.gte": 50,
            "region": "IN",
        }
    )

    if not movies:
        indian_fallback = [
            m for m in DEMO_MOVIES
            if m["title"] in {"3 Idiots", "Taare Zameen Par"}
        ]
        return jsonify({"movies": indian_fallback, "source": "demo"})

    return jsonify({"movies": movies, "source": "tmdb"})


@app.route("/api/search")
def search_movies():
    """
    Search for movies by title.
    Usage: /api/search?q=inception
    """
    query = request.args.get("q", "").strip()

    if not query:
        return jsonify({"movies": [], "error": "No search query provided"})

    movies = fetch_from_tmdb("/search/movie", params={"query": query})

    if not movies:
        # Simple fallback: search through demo data
        query_lower = query.lower()
        results = [
            m for m in DEMO_MOVIES
            if query_lower in m["title"].lower()
            or query_lower in m["genre"].lower()
            or any(query_lower in mood.lower() for mood in m["mood"])
        ]
        return jsonify({"movies": results, "source": "demo"})

    return jsonify({"movies": movies, "source": "tmdb"})


@app.route("/api/mood")
def get_movies_by_mood():
    """
    Return movies filtered by mood using TMDB genre filtering.
    Usage: /api/mood?mood=Thriller
    """
    mood = request.args.get("mood", "").strip()

    if not mood or mood not in MOOD_TO_GENRES:
        return jsonify({"movies": [], "error": "Invalid mood"})

    genre_ids = MOOD_TO_GENRES[mood]
    # Use the first genre ID to fetch from TMDB
    primary_genre = genre_ids[0]

    movies = fetch_from_tmdb(
        "/discover/movie",
        params={
            "with_genres": primary_genre,
            "sort_by": "popularity.desc",
            "vote_count.gte": 100,  # Only show movies with enough votes
        }
    )

    if not movies:
        # Fallback: filter demo data by mood
        results = [m for m in DEMO_MOVIES if mood in m["mood"]]
        return jsonify({"movies": results, "source": "demo"})

    return jsonify({"movies": movies, "source": "tmdb"})


@app.route("/api/anime")
def get_anime():
    """
    Return anime movies and shows from TMDB (using Animation genre).
    Falls back to demo anime data if TMDB request fails.
    """
    movies = fetch_from_tmdb(
        "/discover/movie",
        params={
            "with_genres": 16,  # 16 = Animation genre
            "sort_by": "popularity.desc",
            "vote_count.gte": 100,
        }
    )

    if not movies:
        # Fallback: filter demo data for anime
        anime_results = [m for m in DEMO_MOVIES if "Anime" in m["mood"]]
        return jsonify({"movies": anime_results, "source": "demo"})

    return jsonify({"movies": movies, "source": "tmdb"})


@app.route("/api/movie/<int:movie_id>/trailer")
def get_trailer(movie_id):
    """
    Get the YouTube trailer key for a specific movie.
    Returns: { "trailer_key": "abc123" } or { "trailer_key": null }
    """
    if not TMDB_API_KEY:
        return jsonify({"trailer_key": None})

    url = f"{TMDB_BASE_URL}/movie/{movie_id}/videos"
    params = {"api_key": TMDB_API_KEY, "language": "en-US"}

    try:
        response = TMDB_SESSION.get(url, params=params, timeout=8)
        response.raise_for_status()
        videos = response.json().get("results", [])

        # Find the best trailer: official trailer first, then any trailer, then teaser, then any YouTube video
        trailer = (
            # Official YouTube Trailer
            next((v for v in videos if v.get("site") == "YouTube" and v.get("type") == "Trailer" and v.get("official")), None)

            # Any YouTube Trailer
            or next((v for v in videos if v.get("site") == "YouTube" and v.get("type") == "Trailer"), None)

            # Teaser fallback
            or next((v for v in videos if v.get("site") == "YouTube" and v.get("type") == "Teaser"), None)

            # Any YouTube video
            or next((v for v in videos if v.get("site") == "YouTube"), None)
        )

        return jsonify({"trailer_key": trailer["key"] if trailer else None})

    except Exception as e:
        print(f"Trailer fetch error: {e}")
        return jsonify({"trailer_key": None})


# ─────────────────────────────────────────────
# START THE APP
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 50)
    print("  DannyMood is running!")
    print("  Open: http://localhost:5000")
    if not TMDB_API_KEY:
        print("\n  ⚠️  No TMDB API key found.")
        print("  Demo data will be shown.")
        print("  Set TMDB_API_KEY in .env to use live data.")
    else:
        print("\n  ✅ TMDB API key loaded. Live data enabled.")
    print("=" * 50)
    app.run(debug=True)
