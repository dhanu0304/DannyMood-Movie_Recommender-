/**
 * DannyMood - Main JavaScript File
 * ===================================
 * This file handles everything on the page:
 *  - Fetching movies from the Flask backend
 *  - Displaying movies in rows (like Netflix)
 *  - Search functionality with Back button
 *  - Mood filtering
 *  - Movie detail modal with trailer
 */

// ─────────────────────────────────────────────
// APP STATE
// Keeps track of what the app is currently showing
// ─────────────────────────────────────────────
const state = {
  currentView: "home",    // "home" or "search"
  selectedMood: "",       // Which mood chip is active
  searchQuery: "",        // Current search text
  heroMovie: null,        // The big featured movie at the top
};


// ─────────────────────────────────────────────
// MOOD CATEGORIES
// These match the backend /api/mood endpoint
// ─────────────────────────────────────────────
const MOODS = [
  { label: "Sad",          emoji: "😢" },
  { label: "Romantic",     emoji: "❤️" },
  { label: "Thriller",     emoji: "🔪" },
  { label: "Feel-good",    emoji: "✨" },
  { label: "Mind-blowing", emoji: "🤯" },
  { label: "Anime",        emoji: "🎨" },
];

// Rating label and color for each rating type
const RATING_CONFIG = {
  "perfection": { label: "Perfection", color: "#06D6A0" },
  "go-for-it":  { label: "Go For It",  color: "#457B9D" },
  "timepass":   { label: "Timepass",   color: "#F1C40F" },
  "skip":       { label: "Skip",       color: "#E63946" },
};


// ─────────────────────────────────────────────
// FETCHING DATA FROM THE BACKEND
// ─────────────────────────────────────────────

/**
 * Generic fetch function — contacts our Flask backend.
 * Returns the parsed JSON, or null if something went wrong.
 */
async function fetchFromAPI(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("API error: " + response.status);
    return await response.json();
  } catch (error) {
    console.error("Fetch failed:", url, error);
    return null;
  }
}

/** Fetch trending movies for the homepage */
async function fetchTrending() {
  return fetchFromAPI("/api/trending");
}

/** Fetch popular movies */
async function fetchPopular() {
  return fetchFromAPI("/api/popular");
}

/** Fetch top-rated movies */
async function fetchTopRated() {
  return fetchFromAPI("/api/top-rated");
}

/** Fetch Indian movie recommendations */
async function fetchIndianMovies() {
  return fetchFromAPI("/api/indian");
}

/** Fetch anime movies */
async function fetchAnime() {
  return fetchFromAPI("/api/anime");
}

/** Fetch movies by mood (e.g. "Thriller") */
async function fetchByMood(mood) {
  return fetchFromAPI(`/api/mood?mood=${encodeURIComponent(mood)}`);
}

/** Search movies by title */
async function fetchSearch(query) {
  return fetchFromAPI(`/api/search?q=${encodeURIComponent(query)}`);
}

/** Get a trailer key for a movie */
async function fetchTrailer(movieId) {
  // Skip demo movies (they have string IDs like "demo-1")
  if (String(movieId).startsWith("demo")) return null;
  const data = await fetchFromAPI(`/api/movie/${movieId}/trailer`);
  return data ? data.trailer_key : null;
}


// ─────────────────────────────────────────────
// BUILDING HTML ELEMENTS
// These functions create the movie cards and rows
// ─────────────────────────────────────────────

/**
 * Create a single movie card HTML string.
 * The card shows the poster, and on hover shows the summary + rating badge.
 */
function createMovieCard(movie) {
  const ratingInfo = RATING_CONFIG[movie.rating] || RATING_CONFIG["timepass"];

  // Escape any quotes in the title/summary for safe use in HTML attributes
  const safeTitle   = (movie.title   || "").replace(/"/g, "&quot;");
  const safeSummary = (movie.summary || "").replace(/"/g, "&quot;");
  const safeImage   = (movie.image   || "").replace(/"/g, "&quot;");
  const safeId      = String(movie.id || "");
  const safeRating  = movie.rating || "timepass";
  const safeMoods   = (movie.mood || []).join(",");

  return `
    <div
      class="movie-card"
      data-id="${safeId}"
      data-title="${safeTitle}"
      data-summary="${safeSummary}"
      data-image="${safeImage}"
      data-rating="${safeRating}"
      data-year="${movie.year || ''}"
      data-genre="${movie.genre || ''}"
      data-mood="${safeMoods}"
      data-vote="${movie.vote_average || ''}"
    >
      <div class="movie-card__poster">
        <img src="${safeImage}" alt="${safeTitle}" loading="lazy" />

        <!-- This overlay appears on hover -->
        <div class="movie-card__overlay">
          <span class="rating-badge" style="background-color: ${ratingInfo.color}">
            ${ratingInfo.label}
          </span>
          <p class="movie-card__summary">${safeSummary}</p>
          <button class="watch-btn">▶ Watch Now</button>
        </div>
      </div>
      <h3 class="movie-card__title">${safeTitle}</h3>
    </div>
  `;
}

/**
 * Create an entire movie row (title + horizontal scroll of cards).
 */
function createMovieRow(title, movies) {
  if (!movies || movies.length === 0) return "";

  const cards = movies.map(createMovieCard).join("");

  return `
    <div class="movie-row">
      <h2 class="movie-row__title">${title}</h2>
      <div class="movie-row__scroll">
        ${cards}
      </div>
    </div>
  `;
}

/**
 * Create a grid of movie cards (used in search results).
 */
function createMovieGrid(movies) {
  if (!movies || movies.length === 0) {
    return `<p class="no-results">No movies found. Try a different search.</p>`;
  }
  return `
    <div class="movie-grid">
      ${movies.map(createMovieCard).join("")}
    </div>
  `;
}


// ─────────────────────────────────────────────
// HERO SECTION
// The big banner at the top of the homepage
// ─────────────────────────────────────────────

function renderHero(movie) {
  if (!movie) return;

  state.heroMovie = movie;

  const heroSection = document.getElementById("hero-section");
  const heroBg      = document.getElementById("hero-bg");
  const heroTitle   = document.getElementById("hero-title");
  const heroSummary = document.getElementById("hero-summary");
  const heroExplore = document.getElementById("hero-explore-btn");

  if (heroBg)    heroBg.src = movie.backdrop || movie.image;
  if (heroTitle) heroTitle.textContent = movie.title;
  if (heroSummary) heroSummary.textContent = movie.summary;
  if (heroSection) heroSection.style.display = "";

  // Hook up the Explore button to open the modal
  if (heroExplore) {
    heroExplore.onclick = () => openModal(movie);
  }
}


// ─────────────────────────────────────────────
// VIEWS: HOME vs SEARCH
// ─────────────────────────────────────────────

/** Show the homepage (hero + mood chips + movie rows) */
function showHomeView() {
  state.currentView = "home";
  document.getElementById("home-view").style.display    = "";
  document.getElementById("search-view").style.display  = "none";
  document.getElementById("search-input").value         = "";
  state.searchQuery = "";
}

/** Show the search results view */
function showSearchView(query) {
  state.currentView = "search";
  document.getElementById("home-view").style.display    = "none";
  document.getElementById("search-view").style.display  = "";
  document.getElementById("search-title").textContent   = `Results for "${query}"`;
}


// ─────────────────────────────────────────────
// HOMEPAGE LOADER
// Fetches and renders trending, popular, top picks
// ─────────────────────────────────────────────

async function loadHomepage() {
  showLoadingInSection("rows-container", "Loading movies...");

  // Fetch all three sections at the same time (faster than one-by-one)
  const [trendingData, popularData, topRatedData, indianData, animeData] = await Promise.all([
    fetchTrending(),
    fetchPopular(),
    fetchTopRated(),
    fetchIndianMovies(),
    fetchAnime(),
  ]);

  const trending = trendingData?.movies || [];
  const popular  = popularData?.movies  || [];
  const topRated = topRatedData?.movies || [];
  const indian   = indianData?.movies  || [];
  const anime    = animeData?.movies    || [];

  // Show the first trending movie in the hero section
  if (trending.length > 0) {
    renderHero(trending[0]);
  }

  // Show a demo banner if we're using fallback data
  const usingDemo = trendingData?.source === "demo";
  document.getElementById("demo-banner").style.display = usingDemo ? "" : "none";

  // Render the movie rows
  const rowsHTML =
    createMovieRow("🔥 Trending Now", trending.slice(0, 10)) +
    createMovieRow("🎬 Popular This Week", popular.slice(0, 10)) +
    createMovieRow("🎨 Anime", anime.slice(0, 10)) +
    createMovieRow("🇮🇳 Indian Picks", indian.slice(0, 10)) +
    createMovieRow("⭐ Top Picks", topRated.slice(0, 10));

  document.getElementById("rows-container").innerHTML = rowsHTML || "<p class='no-results'>Could not load movies.</p>";

  // Attach click events to all movie cards
  attachCardClickEvents();
}

/**
 * Load movies for a specific mood and show them.
 * Called when a mood chip is clicked.
 */
async function loadMoodMovies(mood) {
  const container = document.getElementById("rows-container");
  showLoadingInSection("rows-container", `Loading ${mood} movies...`);

  const data = await fetchByMood(mood);
  const movies = data?.movies || [];

  const moodEmojis = { "Sad": "😢", "Romantic": "❤️", "Thriller": "🔪", "Feel-good": "✨", "Mind-blowing": "🤯", "Anime": "🎨" };
  const emoji = moodEmojis[mood] || "🎬";

  container.innerHTML = createMovieRow(`${emoji} ${mood} Movies`, movies);
  attachCardClickEvents();
}

/** Helper: show a loading spinner inside a section */
function showLoadingInSection(containerId, message) {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
  }
}


// ─────────────────────────────────────────────
// MOOD CHIPS
// ─────────────────────────────────────────────

function renderMoodChips() {
  const container = document.getElementById("mood-chips");
  if (!container) return;

  container.innerHTML = MOODS.map(({ label, emoji }) => `
    <button class="mood-chip" data-mood="${label}">
      <span>${emoji}</span> ${label}
    </button>
  `).join("");

  // Attach click events to each mood chip
  container.querySelectorAll(".mood-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const mood = chip.dataset.mood;

      if (state.selectedMood === mood) {
        // Clicking the same mood again → deselect and show all
        state.selectedMood = "";
        chip.classList.remove("active");
        loadHomepage();
      } else {
        // Select this mood
        state.selectedMood = mood;
        container.querySelectorAll(".mood-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        loadMoodMovies(mood);
      }
    });
  });
}


// ─────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────

let searchTimeout = null; // Used to debounce search input

function setupSearch() {
  const input = document.getElementById("search-input");
  if (!input) return;

  input.addEventListener("input", () => {
    const query = input.value.trim();

    // Clear previous timer (debounce: wait 400ms after user stops typing)
    clearTimeout(searchTimeout);

    if (!query) {
      // Empty search → go back to home
      if (state.currentView === "search") {
        showHomeView();
        loadHomepage();
      }
      return;
    }

    // Wait a bit before searching (avoid spamming the API)
    searchTimeout = setTimeout(() => {
      runSearch(query);
    }, 400);
  });
}

async function runSearch(query) {
  state.searchQuery = query;
  showSearchView(query);
  showLoadingInSection("search-results", "Searching...");

  const data = await fetchSearch(query);
  const movies = data?.movies || [];

  document.getElementById("search-results").innerHTML = createMovieGrid(movies);
  attachCardClickEvents();
}


// ─────────────────────────────────────────────
// MOVIE DETAIL MODAL
// The popup that shows full movie info + trailer
// ─────────────────────────────────────────────

function openModal(movie) {
  const modal        = document.getElementById("movie-modal");
  const modalBg      = document.getElementById("modal-bg");
  const modalTitle   = document.getElementById("modal-title");
  const modalYear    = document.getElementById("modal-year");
  const modalGenre   = document.getElementById("modal-genre");
  const modalRating  = document.getElementById("modal-rating");
  const modalMood    = document.getElementById("modal-mood");
  const modalSummary = document.getElementById("modal-summary");
  const modalVote    = document.getElementById("modal-vote");
  const trailerArea  = document.getElementById("trailer-area");

  // Fill in the movie details
  if (modalBg)      modalBg.style.backgroundImage = `url('${movie.backdrop || movie.image}')`;
  if (modalTitle)   modalTitle.textContent  = movie.title;
  if (modalYear)    modalYear.textContent   = movie.year;
  if (modalGenre)   modalGenre.textContent  = movie.genre;
  if (modalSummary) modalSummary.textContent = movie.summary;

  // Rating badge
  if (modalRating) {
    const ratingInfo = RATING_CONFIG[movie.rating] || RATING_CONFIG["timepass"];
    modalRating.textContent = ratingInfo.label;
    modalRating.style.backgroundColor = ratingInfo.color;
  }

  // Mood tags
  if (modalMood) {
    const moods = Array.isArray(movie.mood) ? movie.mood : (movie.mood || "").split(",");
    modalMood.innerHTML = moods
      .filter(Boolean)
      .map(m => `<span class="mood-tag">${m.trim()}</span>`)
      .join("");
  }

  // TMDB vote score
  if (modalVote) {
    modalVote.textContent = movie.vote_average
      ? `⭐ ${movie.vote_average} / 10`
      : "";
  }

  // Clear trailer area and show loading
  if (trailerArea) {
    trailerArea.innerHTML = `<div class="trailer-loading"><div class="spinner"></div><p>Loading trailer...</p></div>`;
  }

  // Show the modal
  modal.style.display = "flex";
  document.body.style.overflow = "hidden"; // Prevent background scrolling

  // Load the trailer in the background
  loadTrailerForModal(movie.id);
}

async function loadTrailerForModal(movieId) {
  const trailerArea = document.getElementById("trailer-area");
  const key = await fetchTrailer(movieId);

  if (!trailerArea) return;

  if (key) {
    // Embed the YouTube trailer
    trailerArea.innerHTML = `
      <iframe
        src="https://www.youtube.com/embed/${key}?autoplay=0&rel=0"
        title="Movie Trailer"
        frameborder="0"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    `;
  } else {
    trailerArea.innerHTML = `<p class="no-trailer">No trailer available</p>`;
  }
}

function closeModal() {
  const modal = document.getElementById("movie-modal");
  const trailerArea = document.getElementById("trailer-area");

  if (trailerArea) trailerArea.innerHTML = ""; // Stop the video
  if (modal) modal.style.display = "none";
  document.body.style.overflow = ""; // Restore scrolling
}

function setupModal() {
  // Close when clicking the X button
  document.getElementById("modal-close-btn").addEventListener("click", closeModal);

  // Close when clicking the dark overlay behind the modal
  document.getElementById("movie-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Close when pressing Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}


// ─────────────────────────────────────────────
// CARD CLICK EVENTS
// Reads data from the card's HTML attributes
// ─────────────────────────────────────────────

function attachCardClickEvents() {
  document.querySelectorAll(".movie-card").forEach(card => {
    card.addEventListener("click", () => {
      // Read all the movie data stored in data-* attributes
      const movie = {
        id:           card.dataset.id,
        title:        card.dataset.title,
        summary:      card.dataset.summary,
        image:        card.dataset.image,
        backdrop:     card.dataset.image, // Use poster as backdrop fallback
        rating:       card.dataset.rating,
        year:         card.dataset.year,
        genre:        card.dataset.genre,
        mood:         card.dataset.mood ? card.dataset.mood.split(",") : [],
        vote_average: card.dataset.vote,
      };
      openModal(movie);
    });
  });
}


// ─────────────────────────────────────────────
// BACK BUTTON (on search view)
// ─────────────────────────────────────────────

function setupBackButton() {
  const btn = document.getElementById("back-btn");
  if (!btn) return;

  btn.addEventListener("click", () => {
    // Reset mood chips
    state.selectedMood = "";
    document.querySelectorAll(".mood-chip").forEach(c => c.classList.remove("active"));

    // Go back to home
    showHomeView();
    loadHomepage();
  });
}


// ─────────────────────────────────────────────
// LOGO CLICK → goes back home
// ─────────────────────────────────────────────

function setupLogoClick() {
  const logo = document.getElementById("logo");
  if (!logo) return;

  logo.addEventListener("click", () => {
    state.selectedMood = "";
    document.querySelectorAll(".mood-chip").forEach(c => c.classList.remove("active"));
    showHomeView();
    loadHomepage();
  });
}


// ─────────────────────────────────────────────
// START THE APP
// This runs when the page is fully loaded
// ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Set up all UI interactions
  renderMoodChips();
  setupSearch();
  setupModal();
  setupBackButton();
  setupLogoClick();

  // Load movies immediately on page load
  loadHomepage();
});
