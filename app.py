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
import urllib3
import requests
from datetime import date
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from flask import Flask, jsonify, render_template, request
from flask_caching import Cache
from dotenv import load_dotenv

# Suppress SSL warnings (fix for SSL connection issue on some Windows machines)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Load variables from .env file (if it exists)
load_dotenv()

app = Flask(__name__)
app.config["CACHE_TYPE"] = "SimpleCache"
app.config["CACHE_DEFAULT_TIMEOUT"] = 300
cache = Cache(app)

# Configure a requests session with retries for flaky TMDB network calls
TMDB_SESSION = requests.Session()
retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
)
TMDB_SESSION.mount("https://", HTTPAdapter(max_retries=retry_strategy))
TMDB_SESSION.verify = False  # Fix for SSL connection reset error on Windows
TMDB_SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
})

# ─────────────────────────────────────────────
# TMDB API CONFIGURATION
# ─────────────────────────────────────────────

# Get TMDB API key from environment variable only (do not hardcode in code)

TMDB_API_KEY = os.environ.get("TMDB_API_KEY")
if not TMDB_API_KEY:
    import warnings
    warnings.warn("TMDB_API_KEY not set. Movie API features will not work. Please set TMDB_API_KEY in your environment variables (see README). App will still start for local development.")

TMDB_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
TMDB_IMAGE_ORIGINAL = "https://image.tmdb.org/t/p/original"
TMDB_PROVIDER_LOGO_BASE = "https://image.tmdb.org/t/p/original"

# ─────────────────────────────────────────────
# GENRE MAP: TMDB genre ID → genre name
# ─────────────────────────────────────────────
GENRE_MAP = {
    28: "Action", 12: "Adventure", 16: "Animation",
    35: "Comedy", 80: "Crime", 99: "Documentary",
    18: "Drama", 10751: "Family", 14: "Fantasy",
    36: "History", 27: "Horror", 10402: "Music",
    9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
    10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western"
}

GENRE_NAME_TO_ID = {
    name.lower(): genre_id
    for genre_id, name in GENRE_MAP.items()
    if name != "TV Movie"
}

COUNTRY_FILTERS = {
    "india": {"region": "IN", "origin_country": "IN"},
    "usa": {"region": "US", "origin_country": "US"},
    "korea": {"region": "KR", "origin_country": "KR", "language": "ko"},
    "japan": {"region": "JP", "origin_country": "JP", "language": "ja"},
    "uk": {"region": "GB", "origin_country": "GB"},
    "france": {"region": "FR", "origin_country": "FR", "language": "fr"},
    "spain": {"region": "ES", "origin_country": "ES", "language": "es"},
    "germany": {"region": "DE", "origin_country": "DE", "language": "de"},
}

INDIAN_LANGUAGE_FILTERS = {
    "hindi": "hi",
    "tamil": "ta",
    "telugu": "te",
    "malayalam": "ml",
    "kannada": "kn",
}

# Mood → list of TMDB genre IDs
MOOD_TO_GENRES = {
    "Sad":          [18, 10749],        # Drama, Romance
    "Romantic":     [10749, 18],        # Romance, Drama
    "Thriller":     [53, 27, 80],       # Thriller, Horror, Crime
    "Feel-good":    [35, 10751, 16],    # Comedy, Family, Animation
    "Mind-blowing": [878, 9648, 14],    # Sci-Fi, Mystery, Fantasy
    "Happy":        [35, 16, 12],       # Comedy, Animation, Adventure
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
        "ott_platforms": [
            {"name": "Netflix", "logo": "https://cdn.simpleicons.org/netflix/E50914", "type": "subscription"},
            {"name": "Prime Video", "logo": "https://cdn.simpleicons.org/amazonprime/00A8E1", "type": "subscription"},
            {"name": "Tubi", "logo": "https://cdn.simpleicons.org/tubi/7408FF", "type": "free"},
        ],
        "websites": [
            {"name": "Net20", "url": "https://net20.cc/home"},
            {"name": "Cinebto", "url": "https://cinebto.com/"}
        ],
    },

    {
        "id": "demo-2", "title": "Crimson Horizon",
        "image": "https://images.unsplash.com/photo-1771777138502-a0e75dce9101?w=500",
        "summary": "Two souls find each other at the edge of the world.",
        "rating": "go-for-it", "mood": ["Romantic", "Feel-good"],
        "year": "2024", "genre": "Romance/Drama", "vote_average": 7.2,
        "ott_platforms": [
            {"name": "JioCinema", "logo": "https://cdn.simpleicons.org/jio/0A2885", "type": "ads"},
            {"name": "ZEE5", "logo": "https://cdn.simpleicons.org/zee5/8230C6", "type": "subscription"},
        ],
        "websites": [
            {"name": "Net20", "url": "https://net20.cc/home"},
            {"name": "Cinebto", "url": "https://cinebto.com/"}
        ],
    },
    {
        "id": "demo-3", "title": "Neon Dreams",
        "image": "https://images.unsplash.com/photo-1764237769175-47c3e556daa9?w=500",
        "summary": "In a cyberpunk metropolis, a hacker discovers a conspiracy that could change everything.",
        "rating": "go-for-it", "mood": ["Thriller", "Mind-blowing"],
        "year": "2025", "genre": "Sci-Fi/Thriller", "vote_average": 7.8,
        "ott_platforms": [
            {"name": "Apple TV", "logo": "https://cdn.simpleicons.org/appletv/FFFFFF", "type": "rent"},
            {"name": "Prime Video", "logo": "https://cdn.simpleicons.org/amazonprime/00A8E1", "type": "subscription"},
        ],
        "websites": [
            {"name": "Net20", "url": "https://net20.cc/home"},
            {"name": "Cinebto", "url": "https://cinebto.com/"}
        ],
    },
    {
        "id": "demo-4", "title": "Electric Hearts",
        "image": "https://images.unsplash.com/photo-1774016591273-9bc347fc64b8?w=500",
        "summary": "A vibrant musical journey through love and self-discovery.",
        "rating": "perfection", "mood": ["Feel-good", "Romantic"],
        "year": "2025", "genre": "Musical/Romance", "vote_average": 8.1,
        "ott_platforms": [
            {"name": "Disney+ Hotstar", "logo": "https://cdn.simpleicons.org/disneyplus/02D6E8", "type": "subscription"},
        ],
        "websites": [
            {"name": "Net20", "url": "https://net20.cc/home"},
            {"name": "Cinebto", "url": "https://cinebto.com/"}
        ],
    },
    {
        "id": "demo-5", "title": "The Vanishing",
        "image": "https://images.unsplash.com/photo-1738980420952-56cc02acd17f?w=500",
        "summary": "When people start disappearing without a trace, one investigator races against time.",
        "rating": "perfection", "mood": ["Thriller"],
        "year": "2025", "genre": "Thriller/Mystery", "vote_average": 8.3,
        "ott_platforms": [
            {"name": "SonyLIV", "logo": "https://cdn.simpleicons.org/sony/FFFFFF", "type": "subscription"},
            {"name": "Prime Video", "logo": "https://cdn.simpleicons.org/amazonprime/00A8E1", "type": "subscription"},
        ],
        "websites": [
            {"name": "Net20", "url": "https://net20.cc/home"},
            {"name": "Cinebto", "url": "https://cinebto.com/"}
        ],
    },
    {
        "id": "demo-6", "title": "Blue & Red",
        "image": "https://images.unsplash.com/photo-1770055204250-f756f10e1ebf?w=500",
        "summary": "A mind-bending exploration of duality and identity.",
        "rating": "perfection", "mood": ["Mind-blowing", "Thriller"],
        "year": "2025", "genre": "Psychological/Sci-Fi", "vote_average": 8.7,
        "ott_platforms": [
            {"name": "Netflix", "logo": "https://cdn.simpleicons.org/netflix/E50914", "type": "subscription"},
            {"name": "Plex", "logo": "https://cdn.simpleicons.org/plex/EBAF00", "type": "free"},
        ],
        "websites": [
            {"name": "Net20", "url": "https://net20.cc/home"},
            {"name": "Cinebto", "url": "https://cinebto.com/"}
        ],
    },
    {
        "id": "demo-7", "title": "3 Idiots",
        "image": "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?w=500",
        "summary": "Three engineering students navigate friendship, pressure, and the meaning of success.",
        "rating": "perfection", "mood": ["Feel-good", "Romantic"],
        "year": "2009", "genre": "Comedy/Drama", "vote_average": 8.4,
        "ott_platforms": [
            {"name": "Netflix", "logo": "https://cdn.simpleicons.org/netflix/E50914", "type": "subscription"},
            {"name": "Prime Video", "logo": "https://cdn.simpleicons.org/amazonprime/00A8E1", "type": "subscription"},
        ],
        "websites": [
            {"name": "Net20", "url": "https://net20.cc/home"},
            {"name": "Cinebto", "url": "https://cinebto.com/"}
        ],
    },
    {
        "id": "demo-8", "title": "Taare Zameen Par",
        "image": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=500",
        "summary": "A gifted child struggles in school until an art teacher helps him discover his true self.",
        "rating": "go-for-it", "mood": ["Feel-good", "Sad"],
        "year": "2007", "genre": "Drama/Family", "vote_average": 8.2,
        "ott_platforms": [
            {"name": "Netflix", "logo": "https://cdn.simpleicons.org/netflix/E50914", "type": "subscription"},
            {"name": "YouTube", "logo": "https://cdn.simpleicons.org/youtube/FF0000", "type": "buy"},
        ],
        "websites": [
            {"name": "Net20", "url": "https://net20.cc/home"},
            {"name": "Cinebto", "url": "https://cinebto.com/"}
        ],
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
    if any(g in genre_ids for g in [35, 16, 12]):
        moods.append("Happy")

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

    release_date = movie.get("release_date", "")
    year = release_date[:4] if release_date else "N/A"

    return {
        "id": str(movie.get("id", "")),
        "title": movie.get("title", "Untitled"),
        "image": image_url,
        "backdrop": f"{TMDB_IMAGE_ORIGINAL}{backdrop}" if backdrop else image_url,
        "summary": movie.get("overview") or "No summary available.",
        "rating": get_rating_from_score(vote),
        "vote_average": round(vote, 1),
        "mood": get_moods_from_genres(genre_ids),
        "year": year,
        "release_date": release_date or "N/A",
        "genre": genre_names,
        "genre_names": [GENRE_MAP[g] for g in genre_ids if g in GENRE_MAP],
        "ott_platforms": [],
        "media_type": "movie",
    }


def transform_tv_show(show):
    """Convert a raw TMDB TV result into the shared card format."""
    transformed = transform_movie({
        **show,
        "title": show.get("name") or show.get("original_name"),
        "release_date": show.get("first_air_date", ""),
    })
    transformed["media_type"] = "tv"
    return transformed


def get_watch_providers_for_movie(movie_id, region="IN"):
    """
    Fetch OTT/watch provider names for a movie.
    TMDB groups providers by country, so we prefer India and fall back to the US.
    """
    if not TMDB_API_KEY or not movie_id:
        return []

    url = f"{TMDB_BASE_URL}/movie/{movie_id}/watch/providers"
    params = {"api_key": TMDB_API_KEY}

    try:
        response = TMDB_SESSION.get(url, params=params, timeout=8)
        response.raise_for_status()
        results = response.json().get("results", {})
        country_data = results.get(region) or results.get("US") or {}
        providers = []
        seen_names = set()

        provider_type_labels = {
            "flatrate": "subscription",
            "free": "free",
            "ads": "ads",
            "rent": "rent",
            "buy": "buy",
        }

        for provider_type in ("free", "ads", "flatrate", "rent", "buy"):
            for provider in country_data.get(provider_type, []):
                name = provider.get("provider_name")
                logo_path = provider.get("logo_path")
                if name and name not in seen_names:
                    seen_names.add(name)
                    providers.append({
                        "name": name,
                        "logo": f"{TMDB_PROVIDER_LOGO_BASE}{logo_path}" if logo_path else "",
                        "type": provider_type_labels[provider_type],
                    })

        return providers[:8]

    except requests.exceptions.RequestException as e:
        print(f"Watch providers fetch error: {e}")
        return []


def fetch_tmdb_json(endpoint, params=None):
    """Return raw JSON from a TMDB endpoint, or an empty dict on failure."""
    if not TMDB_API_KEY:
        return {}

    url = f"{TMDB_BASE_URL}{endpoint}"
    all_params = {"api_key": TMDB_API_KEY, "language": "en-US"}
    if params:
        all_params.update(params)

    try:
        response = TMDB_SESSION.get(url, params=all_params, timeout=8)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.Timeout:
        print("TMDB API request timed out")
    except requests.exceptions.RequestException as e:
        print(f"TMDB API error: {e}")
    return {}


def fetch_from_tmdb(endpoint, params=None, require_poster=True, media_type="movie"):
    """
    Make a request to the TMDB API.
    Returns a list of transformed movies, or an empty list on error.
    """
    data = fetch_tmdb_json(endpoint, params)
    movies = data.get("results", [])
    if require_poster:
        movies = [movie for movie in movies if movie.get("poster_path")]
    transformer = transform_tv_show if media_type == "tv" else transform_movie
    return [transformer(movie) for movie in movies]


def get_page():
    """Read a positive TMDB page number from the current request."""
    return max(request.args.get("page", 1, type=int), 1)


def movie_response(movies, page, source="tmdb"):
    """Build the shared paginated response used by movie collection routes."""
    return jsonify({
        "movies": movies,
        "page": page,
        "has_more": source == "tmdb" and len(movies) > 0 and page < 500,
        "source": source,
    })


def add_recommendation_explanations(movies, moods):
    """Explain each mood recommendation using selected moods and matching genres."""
    selected = " and ".join(moods)
    selected_genres = {
        GENRE_MAP[genre_id]
        for mood in moods
        for genre_id in MOOD_TO_GENRES[mood]
        if genre_id in GENRE_MAP
    }

    for movie in movies:
        matching = [
            genre for genre in movie.get("genre_names", [])
            if genre in selected_genres
        ]
        if movie.get("vote_average", 0) >= 7 and matching:
            movie["explanation"] = (
                f"Recommended because you selected {selected} and this movie "
                f"is highly rated in {' and '.join(matching[:2])}."
            )
        else:
            movie["explanation"] = f"Recommended because you selected {selected}."
    return movies


def get_discover_sort(category):
    """Return safe TMDB sorting parameters for explorer collections."""
    today = date.today().isoformat()
    if category == "top_rated":
        return {"sort_by": "vote_average.desc", "vote_count.gte": 200}
    if category == "latest":
        return {
            "sort_by": "primary_release_date.desc",
            "primary_release_date.lte": today,
            "vote_count.gte": 5,
        }
    return {"sort_by": "popularity.desc", "vote_count.gte": 25}


# ─────────────────────────────────────────────
# FLASK ROUTES
# ─────────────────────────────────────────────

@app.route("/")
def index():
    """Serve the main HTML page."""
    return render_template("index.html")


@app.route("/api/trending")
@cache.cached(timeout=300, query_string=True)
def get_trending():
    """
    Return trending movies from TMDB.
    Falls back to popular or demo data if the trending endpoint is unavailable.
    """
    page = get_page()
    movies = fetch_from_tmdb("/trending/movie/week", {"page": page})

    if not movies:
        # If trending fails, fall back to popular movies so the hero section still shows live data.
        movies = fetch_from_tmdb("/movie/popular", {"page": page})

    if not movies:
        return movie_response(DEMO_MOVIES if page == 1 else [], page, "demo")

    return movie_response(movies, page)


@app.route("/api/popular")
@cache.cached(timeout=300, query_string=True)
def get_popular():
    """Return currently popular movies."""
    page = get_page()
    movies = fetch_from_tmdb("/movie/popular", {"page": page})

    if not movies:
        return movie_response(DEMO_MOVIES if page == 1 else [], page, "demo")

    return movie_response(movies, page)


@app.route("/api/top-rated")
@cache.cached(timeout=300, query_string=True)
def get_top_rated():
    """Return top-rated movies (great for 'Top Picks' section)."""
    page = get_page()
    movies = fetch_from_tmdb("/movie/top_rated", {"page": page})

    if not movies:
        # If the top-rated endpoint is flaky, use discover sorted by vote average as a stronger fallback.
        movies = fetch_from_tmdb(
            "/discover/movie",
            params={
                "sort_by": "vote_average.desc",
                "vote_count.gte": 500,
                "page": page,
            }
        )

    if not movies:
        # Filter demo movies to only show top-rated ones
        top = [m for m in DEMO_MOVIES if m["rating"] == "perfection"]
        return movie_response(top if page == 1 else [], page, "demo")

    return movie_response(movies, page)


@app.route("/api/indian")
@cache.cached(timeout=300, query_string=True)
def get_indian_movies():
    """
    Return Indian movies from TMDB using the Hindi original-language filter.
    This keeps the homepage diverse with popular movies from India.
    """
    page = get_page()
    movies = fetch_from_tmdb(
        "/discover/movie",
        params={
            "with_original_language": "hi",
            "sort_by": "popularity.desc",
            "vote_count.gte": 50,
            "region": "IN",
            "page": page,
        }
    )

    if not movies:
        indian_fallback = [
            m for m in DEMO_MOVIES
            if m["title"] in {"3 Idiots", "Taare Zameen Par"}
        ]
        return movie_response(indian_fallback if page == 1 else [], page, "demo")

    return movie_response(movies, page)


@app.route("/api/search")
@cache.cached(timeout=300, query_string=True)
def search_movies():
    """
    Search for movies by title.
    Usage: /api/search?q=inception
    """
    query = request.args.get("q", "").strip()
    page = get_page()

    if not query:
        return jsonify({"movies": [], "page": page, "has_more": False, "error": "No search query provided"})

    movies = fetch_from_tmdb(
        "/search/movie",
        {"query": query, "page": page},
        require_poster=False,
    )
    if movies:
        return movie_response(movies, page)

    # Fallback: search through demo data
    query_lower = query.lower()
    results = [
        m for m in DEMO_MOVIES
        if query_lower in m["title"].lower()
        or query_lower in m["genre"].lower()
        or any(query_lower in mood.lower() for mood in m["mood"])
    ]
    return movie_response(results if page == 1 else [], page, "demo")


@app.route("/api/mood")
@cache.cached(timeout=300, query_string=True)
def get_movies_by_mood():
    """
    Return movies filtered by mood using TMDB genre filtering.
    Usage: /api/mood?mood=Thriller
    """
    mood_values = request.args.getlist("mood")
    if len(mood_values) == 1 and "," in mood_values[0]:
        mood_values = mood_values[0].split(",")
    moods = list(dict.fromkeys(mood.strip() for mood in mood_values if mood.strip()))
    page = get_page()

    if not moods or any(mood not in MOOD_TO_GENRES for mood in moods):
        return jsonify({"movies": [], "page": page, "has_more": False, "error": "Invalid mood"})

    genre_ids = list(dict.fromkeys(
        genre_id for mood in moods for genre_id in MOOD_TO_GENRES[mood]
    ))
    with_genres = "|".join(str(genre_id) for genre_id in genre_ids)

    movies = fetch_from_tmdb(
        "/discover/movie",
        params={
            "with_genres": with_genres,
            "sort_by": "popularity.desc",
            "vote_count.gte": 100,  # Only show movies with enough votes
            "page": page,
        }
    )

    if not movies:
        # Fallback: filter demo data by mood
        results = [
            {**movie, "explanation": f"Recommended because you selected {' and '.join(moods)}."}
            for movie in DEMO_MOVIES
            if any(mood in movie["mood"] for mood in moods)
        ]
        return movie_response(results if page == 1 else [], page, "demo")

    return movie_response(add_recommendation_explanations(movies, moods), page)


@app.route("/api/discover/genre")
@cache.cached(timeout=300, query_string=True)
def discover_by_genre():
    """Browse trending, top-rated, or latest movies in a genre."""
    genre = request.args.get("genre", "").strip()
    category = request.args.get("category", "trending").strip().lower()
    page = get_page()
    genre_id = GENRE_NAME_TO_ID.get(genre.lower())

    if not genre_id or category not in {"trending", "top_rated", "latest"}:
        return jsonify({
            "movies": [], "page": page, "has_more": False,
            "error": "Invalid genre or category",
        }), 400

    params = {
        "with_genres": genre_id,
        "page": page,
        **get_discover_sort(category),
    }
    movies = fetch_from_tmdb("/discover/movie", params=params)
    return movie_response(movies, page)


@app.route("/api/discover/country")
@cache.cached(timeout=300, query_string=True)
def discover_by_country():
    """Browse popular movies by production country and optional language."""
    country = request.args.get("country", "").strip().lower()
    language_name = request.args.get("language", "").strip().lower()
    page = get_page()
    country_filter = COUNTRY_FILTERS.get(country)

    if not country_filter:
        return jsonify({
            "movies": [], "page": page, "has_more": False,
            "error": "Invalid country",
        }), 400

    language = country_filter.get("language")
    if country == "india" and language_name:
        language = INDIAN_LANGUAGE_FILTERS.get(language_name)
        if not language:
            return jsonify({
                "movies": [], "page": page, "has_more": False,
                "error": "Invalid Indian language",
            }), 400

    params = {
        "page": page,
        "sort_by": "popularity.desc",
        "vote_count.gte": 15,
        "region": country_filter["region"],
        "with_origin_country": country_filter["origin_country"],
    }
    if language:
        params["with_original_language"] = language

    movies = fetch_from_tmdb("/discover/movie", params=params)
    return movie_response(movies, page)


@app.route("/api/discover/year")
@cache.cached(timeout=300, query_string=True)
def discover_by_year():
    """Browse movies released within an inclusive year range."""
    current_year = date.today().year
    from_year = request.args.get("from_year", 1950, type=int)
    to_year = request.args.get("to_year", current_year, type=int)
    page = get_page()

    if not 1870 <= from_year <= to_year <= current_year:
        return jsonify({
            "movies": [], "page": page, "has_more": False,
            "error": "Invalid year range",
        }), 400

    movies = fetch_from_tmdb(
        "/discover/movie",
        params={
            "primary_release_date.gte": f"{from_year}-01-01",
            "primary_release_date.lte": f"{to_year}-12-31",
            "sort_by": "popularity.desc",
            "vote_count.gte": 20,
            "page": page,
        },
    )
    return movie_response(movies, page)


@app.route("/api/discover/media")
@cache.cached(timeout=300, query_string=True)
def discover_media():
    """Browse popular movies or TV series through one stable endpoint."""
    media_type = request.args.get("type", "movie").strip().lower()
    page = get_page()
    if media_type not in {"movie", "tv"}:
        return jsonify({
            "movies": [], "page": page, "has_more": False,
            "error": "Invalid media type",
        }), 400

    endpoint = "/movie/popular" if media_type == "movie" else "/tv/popular"
    movies = fetch_from_tmdb(
        endpoint,
        params={"page": page},
        media_type=media_type,
    )
    return movie_response(movies, page)


@app.route("/api/movie/<int:movie_id>")
@cache.cached(timeout=300)
def get_movie_details(movie_id):
    """Return complete details for a movie modal."""
    movie = fetch_tmdb_json(f"/movie/{movie_id}")
    if not movie:
        return jsonify({"error": "Movie details unavailable"}), 404

    genres = [genre.get("name") for genre in movie.get("genres", []) if genre.get("name")]
    poster_path = movie.get("poster_path")
    backdrop_path = movie.get("backdrop_path")
    return jsonify({
        "id": str(movie.get("id", movie_id)),
        "title": movie.get("title", "Untitled"),
        "runtime": movie.get("runtime"),
        "tagline": movie.get("tagline") or "",
        "genres": genres,
        "genre": ", ".join(genres) or "N/A",
        "overview": movie.get("overview") or "No summary available.",
        "release_date": movie.get("release_date") or "N/A",
        "year": movie.get("release_date", "")[:4] or "N/A",
        "rating": round(movie.get("vote_average", 0), 1),
        "rating_label": get_rating_from_score(movie.get("vote_average", 0)),
        "poster": f"{TMDB_IMAGE_BASE}{poster_path}" if poster_path else "",
        "backdrop": f"{TMDB_IMAGE_ORIGINAL}{backdrop_path}" if backdrop_path else "",
    })


@app.route("/api/movie/<int:movie_id>/similar")
@cache.cached(timeout=300, query_string=True)
def get_similar_movies(movie_id):
    """Return movies similar to a selected title."""
    page = get_page()
    movies = fetch_from_tmdb(f"/movie/{movie_id}/similar", {"page": page})
    return movie_response(movies[:10], page)


@app.route("/api/movie/<int:movie_id>/credits")
@cache.cached(timeout=300)
def get_movie_credits(movie_id):
    """Return the top five billed cast members."""
    data = fetch_tmdb_json(f"/movie/{movie_id}/credits")
    cast = []
    for person in data.get("cast", [])[:5]:
        profile_path = person.get("profile_path")
        cast.append({
            "id": person.get("id"),
            "name": person.get("name", "Unknown"),
            "character": person.get("character") or "Unknown role",
            "profile": f"{TMDB_IMAGE_BASE}{profile_path}" if profile_path else "",
        })
    return jsonify({"cast": cast})


@app.route("/api/tv/<int:show_id>")
@cache.cached(timeout=300)
def get_tv_details(show_id):
    """Return TV details using the same modal contract as movies."""
    show = fetch_tmdb_json(f"/tv/{show_id}")
    if not show:
        return jsonify({"error": "TV details unavailable"}), 404

    genres = [genre.get("name") for genre in show.get("genres", []) if genre.get("name")]
    poster_path = show.get("poster_path")
    backdrop_path = show.get("backdrop_path")
    runtimes = show.get("episode_run_time") or []
    return jsonify({
        "id": str(show.get("id", show_id)),
        "title": show.get("name", "Untitled"),
        "runtime": runtimes[0] if runtimes else None,
        "tagline": show.get("tagline") or "",
        "genres": genres,
        "genre": ", ".join(genres) or "N/A",
        "overview": show.get("overview") or "No summary available.",
        "release_date": show.get("first_air_date") or "N/A",
        "year": show.get("first_air_date", "")[:4] or "N/A",
        "rating": round(show.get("vote_average", 0), 1),
        "rating_label": get_rating_from_score(show.get("vote_average", 0)),
        "poster": f"{TMDB_IMAGE_BASE}{poster_path}" if poster_path else "",
        "backdrop": f"{TMDB_IMAGE_ORIGINAL}{backdrop_path}" if backdrop_path else "",
    })


@app.route("/api/tv/<int:show_id>/similar")
@cache.cached(timeout=300, query_string=True)
def get_similar_tv(show_id):
    """Return similar TV series."""
    page = get_page()
    shows = fetch_from_tmdb(
        f"/tv/{show_id}/similar",
        {"page": page},
        media_type="tv",
    )
    return movie_response(shows[:10], page)


@app.route("/api/tv/<int:show_id>/credits")
@cache.cached(timeout=300)
def get_tv_credits(show_id):
    """Return the top five billed TV cast members."""
    data = fetch_tmdb_json(f"/tv/{show_id}/credits")
    cast = []
    for person in data.get("cast", [])[:5]:
        profile_path = person.get("profile_path")
        cast.append({
            "id": person.get("id"),
            "name": person.get("name", "Unknown"),
            "character": person.get("character") or "Unknown role",
            "profile": f"{TMDB_IMAGE_BASE}{profile_path}" if profile_path else "",
        })
    return jsonify({"cast": cast})


@app.route("/api/tv/<int:show_id>/trailer")
@cache.cached(timeout=300)
def get_tv_trailer(show_id):
    """Return the best YouTube trailer available for a TV series."""
    data = fetch_tmdb_json(f"/tv/{show_id}/videos")
    videos = data.get("results", [])
    trailer = (
        next((video for video in videos if video.get("site") == "YouTube" and video.get("type") == "Trailer" and video.get("official")), None)
        or next((video for video in videos if video.get("site") == "YouTube" and video.get("type") == "Trailer"), None)
        or next((video for video in videos if video.get("site") == "YouTube" and video.get("type") == "Teaser"), None)
        or next((video for video in videos if video.get("site") == "YouTube"), None)
    )
    return jsonify({"trailer_key": trailer["key"] if trailer else None})





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


@app.route("/api/movie/<int:movie_id>/watch-providers")
def get_watch_providers(movie_id):
    """
    Get OTT platforms where a movie is available.
    Returns: { "ott_platforms": [{ "name": "Netflix", "logo": "..." }] }
    """
    region = request.args.get("region", "IN").strip().upper() or "IN"
    platforms = get_watch_providers_for_movie(movie_id, region=region)
    return jsonify({"ott_platforms": platforms})


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
