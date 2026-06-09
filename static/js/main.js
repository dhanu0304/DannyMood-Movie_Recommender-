const state = {
  currentView: "home",
  selectedMoods: [],
  searchQuery: "",
  page: 1,
  hasMore: false,
  loadingMore: false,
  heroMovie: null,
  moviesByCardKey: {},
};

const MOODS = [
  { label: "Sad", emoji: "\uD83D\uDE22" },
  { label: "Romantic", emoji: "\u2764\uFE0F" },
  { label: "Thriller", emoji: "\uD83D\uDD2A" },
  { label: "Feel-good", emoji: "\u2728" },
  { label: "Mind-blowing", emoji: "\uD83E\uDD2F" },
  { label: "Happy", emoji: "\uD83D\uDE04" },
];

const RATING_CONFIG = {
  perfection: { label: "Perfection", color: "#06D6A0" },
  "go-for-it": { label: "Go For It", color: "#457B9D" },
  timepass: { label: "Timepass", color: "#F1C40F" },
  skip: { label: "Skip", color: "#E63946" },
};

const BACKEND_URL = "";
const WATCHLIST_KEY = "dannymood-watchlist";

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePlatforms(platforms) {
  if (!platforms) return [];
  if (typeof platforms === "string") {
    return platforms.split(",").filter(Boolean).map(name => ({ name: name.trim(), logo: "" }));
  }
  return platforms.filter(Boolean).map(platform => typeof platform === "string"
    ? { name: platform.trim(), logo: "", type: "subscription" }
    : {
        name: platform.name || "",
        logo: platform.logo || "",
        type: platform.type || "subscription",
      }).filter(platform => platform.name);
}

async function fetchFromAPI(path) {
  try {
    const response = await fetch(BACKEND_URL + path);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Fetch failed:", path, error);
    return null;
  }
}

function pagedPath(path, page) {
  return `${path}${path.includes("?") ? "&" : "?"}page=${page}`;
}

const fetchTrending = page => fetchFromAPI(pagedPath("/api/trending", page));
const fetchPopular = page => fetchFromAPI(pagedPath("/api/popular", page));
const fetchTopRated = page => fetchFromAPI(pagedPath("/api/top-rated", page));
const fetchIndianMovies = page => fetchFromAPI(pagedPath("/api/indian", page));
const fetchSearch = (query, page) => fetchFromAPI(
  `/api/search?q=${encodeURIComponent(query)}&page=${page}`
);
const fetchByMood = (moods, page) => fetchFromAPI(
  `/api/mood?${moods.map(mood => `mood=${encodeURIComponent(mood)}`).join("&")}&page=${page}`
);

async function fetchTrailer(movieId) {
  if (String(movieId).startsWith("demo")) return null;
  const data = await fetchFromAPI(`/api/movie/${movieId}/trailer`);
  return data?.trailer_key || null;
}

async function fetchWatchProviders(movieId) {
  if (String(movieId).startsWith("demo")) return [];
  const data = await fetchFromAPI(`/api/movie/${movieId}/watch-providers?region=IN`);
  return data?.ott_platforms || [];
}

function getWatchlist() {
  try {
    return JSON.parse(localStorage.getItem(WATCHLIST_KEY)) || [];
  } catch {
    return [];
  }
}

function isSaved(movieId) {
  return getWatchlist().some(movie => String(movie.id) === String(movieId));
}

function updateWatchlistCount() {
  document.getElementById("watchlist-count").textContent = getWatchlist().length;
}

function toggleWatchlist(movie) {
  const watchlist = getWatchlist();
  const index = watchlist.findIndex(item => String(item.id) === String(movie.id));
  if (index >= 0) watchlist.splice(index, 1);
  else watchlist.unshift(movie);
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  updateWatchlistCount();
  refreshHeartButtons(movie.id);
  if (state.currentView === "watchlist") renderWatchlist();
}

function refreshHeartButtons(movieId) {
  const saved = isSaved(movieId);
  document.querySelectorAll(`.heart-btn[data-movie-id="${CSS.escape(String(movieId))}"]`)
    .forEach(button => {
      button.classList.toggle("active", saved);
      button.setAttribute("aria-label", saved ? "Remove from watchlist" : "Add to watchlist");
      button.textContent = saved ? "\u2665" : "\u2661";
    });
}

function createMovieCard(movie) {
  const ratingInfo = RATING_CONFIG[movie.rating] || RATING_CONFIG.timepass;
  const cardKey = `${movie.id}-${Object.keys(state.moviesByCardKey).length}`;
  const storedMovie = { ...movie, ott_platforms: normalizePlatforms(movie.ott_platforms) };
  state.moviesByCardKey[cardKey] = storedMovie;
  const saved = isSaved(movie.id);

  return `
    <article class="movie-card" data-card-key="${escapeHTML(cardKey)}">
      <div class="movie-card__poster">
        <img src="${escapeHTML(movie.image)}" alt="${escapeHTML(movie.title)}" loading="lazy" />
        <button class="heart-btn ${saved ? "active" : ""}" data-movie-id="${escapeHTML(movie.id)}"
          aria-label="${saved ? "Remove from watchlist" : "Add to watchlist"}">${saved ? "\u2665" : "\u2661"}</button>
        <div class="movie-card__overlay">
          <span class="rating-badge" style="background-color:${ratingInfo.color}">${ratingInfo.label}</span>
          <p class="movie-card__summary">${escapeHTML(movie.summary)}</p>
          <button class="watch-btn" type="button">&#9654; Explore</button>
        </div>
      </div>
      <h3 class="movie-card__title">${escapeHTML(movie.title)}</h3>
      ${movie.explanation ? `<p class="recommendation-explanation">${escapeHTML(movie.explanation)}</p>` : ""}
    </article>`;
}

function createMovieRow(title, movies, options = {}) {
  if (!movies?.length) return "";
  return `
    <div class="movie-row" data-row="${escapeHTML(options.rowId || "")}">
      <h2 class="movie-row__title">${escapeHTML(title)}</h2>
      <div class="movie-row__scroll">${movies.map(createMovieCard).join("")}</div>
      ${options.endpoint && options.hasMore
        ? `<div class="load-more-wrap"><button class="load-more-btn row-load-more"
            data-endpoint="${escapeHTML(options.endpoint)}" data-page="1">Load More</button></div>`
        : ""}
      ${options.loadMore ? createLoadMoreButton() : ""}
    </div>`;
}

function createMovieGrid(movies) {
  if (!movies?.length) return '<p class="no-results">No movies found.</p>';
  return `<div class="movie-grid">${movies.map(createMovieCard).join("")}</div>`;
}

function createLoadMoreButton() {
  return state.hasMore
    ? '<div class="load-more-wrap"><button id="load-more-btn" class="load-more-btn">Load More</button></div>'
    : "";
}

function attachCardEvents(root = document) {
  root.querySelectorAll(".movie-card").forEach(card => {
    if (card.dataset.bound) return;
    card.dataset.bound = "true";
    card.addEventListener("click", () => openModal(state.moviesByCardKey[card.dataset.cardKey]));
  });
  root.querySelectorAll(".heart-btn").forEach(button => {
    if (button.dataset.bound) return;
    button.dataset.bound = "true";
    button.addEventListener("click", event => {
      event.stopPropagation();
      const card = button.closest(".movie-card");
      toggleWatchlist(state.moviesByCardKey[card.dataset.cardKey]);
    });
  });
  const loadMoreButton = root.querySelector("#load-more-btn");
  if (loadMoreButton && !loadMoreButton.dataset.bound) {
    loadMoreButton.dataset.bound = "true";
    loadMoreButton.addEventListener("click", loadMore);
  }
  root.querySelectorAll(".row-load-more").forEach(button => {
    if (button.dataset.bound) return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => loadMoreHomeRow(button));
  });
}

function renderHero(movie) {
  if (!movie) return;
  state.heroMovie = movie;
  document.getElementById("hero-bg").src = movie.backdrop || movie.image;
  document.getElementById("hero-title").textContent = movie.title;
  document.getElementById("hero-summary").textContent = movie.summary;
  document.getElementById("hero-explore-btn").onclick = () => openModal(movie);
}

function showView(view) {
  state.currentView = view;
  document.getElementById("home-view").style.display = view === "home" ? "grid" : "none";
  document.getElementById("search-view").style.display = view === "search" ? "block" : "none";
  document.getElementById("watchlist-view").style.display = view === "watchlist" ? "block" : "none";
}

function resetHome() {
  state.selectedMoods = [];
  state.searchQuery = "";
  document.getElementById("search-input").value = "";
  document.querySelectorAll(".mood-chip").forEach(chip => chip.classList.remove("active"));
  showView("home");
  loadHomepage();
}

async function loadHomepage() {
  state.page = 1;
  state.hasMore = false;
  state.moviesByCardKey = {};
  showLoading("rows-container", "Loading movies...");
  const [trendingData, popularData, topRatedData, indianData] = await Promise.all([
    fetchTrending(1), fetchPopular(1), fetchTopRated(1), fetchIndianMovies(1),
  ]);
  const trending = trendingData?.movies || [];
  if (trending.length) renderHero(trending[0]);
  document.getElementById("demo-banner").style.display = trendingData?.source === "demo" ? "" : "none";
  document.getElementById("rows-container").innerHTML =
    createMovieRow("\uD83D\uDD25 Trending Now", trending, {
      endpoint: "/api/trending", hasMore: trendingData?.has_more,
    }) +
    createMovieRow("\uD83C\uDFAC Popular This Week", popularData?.movies || [], {
      endpoint: "/api/popular", hasMore: popularData?.has_more,
    }) +
    createMovieRow("\uD83C\uDDEE\uD83C\uDDF3 Indian Picks", indianData?.movies || [], {
      endpoint: "/api/indian", hasMore: indianData?.has_more,
    }) +
    createMovieRow("\u2B50 Top Picks", topRatedData?.movies || [], {
      endpoint: "/api/top-rated", hasMore: topRatedData?.has_more,
    });
  attachCardEvents();
}

async function loadMoreHomeRow(button) {
  const page = Number(button.dataset.page) + 1;
  button.disabled = true;
  button.textContent = "Loading...";
  const data = await fetchFromAPI(pagedPath(button.dataset.endpoint, page));
  const movies = data?.movies || [];
  appendMovies(button.closest(".movie-row").querySelector(".movie-row__scroll"), movies);
  if (data?.has_more && movies.length) {
    button.dataset.page = String(page);
    button.disabled = false;
    button.textContent = "Load More";
  } else {
    button.closest(".load-more-wrap").remove();
  }
}

async function loadMoodMovies(moods, page = 1, append = false) {
  const container = document.getElementById("rows-container");
  if (!append) {
    state.moviesByCardKey = {};
    showLoading("rows-container", `Loading ${moods.join(" + ")} movies...`);
  }
  const data = await fetchByMood(moods, page);
  const movies = data?.movies || [];
  state.page = page;
  state.hasMore = Boolean(data?.has_more && movies.length);
  if (append) {
    appendMovies(container.querySelector(".movie-row__scroll"), movies);
    updateLoadMore(container);
  } else {
    container.innerHTML = createMovieRow(
      `${moods.join(" + ")} Movies`,
      movies,
      { rowId: "mood", loadMore: true },
    );
    attachCardEvents(container);
  }
}

function renderMoodChips() {
  const container = document.getElementById("mood-chips");
  container.innerHTML = MOODS.map(({ label, emoji }) =>
    `<button class="mood-chip" data-mood="${escapeHTML(label)}"><span>${emoji}</span> ${escapeHTML(label)}</button>`
  ).join("");
  container.querySelectorAll(".mood-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const mood = chip.dataset.mood;
      state.selectedMoods = state.selectedMoods.includes(mood)
        ? state.selectedMoods.filter(selected => selected !== mood)
        : [...state.selectedMoods, mood];
      chip.classList.toggle("active");
      if (state.selectedMoods.length) loadMoodMovies(state.selectedMoods);
      else loadHomepage();
    });
  });
}

let searchTimeout;
function setupSearch() {
  document.getElementById("search-input").addEventListener("input", event => {
    const query = event.target.value.trim();
    clearTimeout(searchTimeout);
    if (!query) {
      if (state.currentView === "search") resetHome();
      return;
    }
    searchTimeout = setTimeout(() => runSearch(query), 400);
  });
}

async function runSearch(query, page = 1, append = false) {
  state.searchQuery = query;
  if (!append) {
    state.moviesByCardKey = {};
    showView("search");
    document.getElementById("search-title").textContent = `Results for "${query}"`;
    showLoading("search-results", "Searching...");
  }
  const data = await fetchSearch(query, page);
  const movies = data?.movies || [];
  state.page = page;
  state.hasMore = Boolean(data?.has_more && movies.length);
  const container = document.getElementById("search-results");
  if (append) {
    appendMovies(container.querySelector(".movie-grid"), movies);
    updateLoadMore(container);
  } else {
    container.innerHTML = createMovieGrid(movies) + createLoadMoreButton();
    attachCardEvents(container);
  }
}

async function loadMore() {
  if (state.loadingMore || !state.hasMore) return;
  state.loadingMore = true;
  const button = document.getElementById("load-more-btn");
  if (button) {
    button.disabled = true;
    button.textContent = "Loading...";
  }
  const nextPage = state.page + 1;
  if (state.currentView === "search") await runSearch(state.searchQuery, nextPage, true);
  else if (state.selectedMoods.length) await loadMoodMovies(state.selectedMoods, nextPage, true);
  state.loadingMore = false;
}

function appendMovies(container, movies) {
  if (!container) return;
  container.insertAdjacentHTML("beforeend", movies.map(createMovieCard).join(""));
  attachCardEvents(container);
}

function updateLoadMore(container) {
  container.querySelector(".load-more-wrap")?.remove();
  container.insertAdjacentHTML("beforeend", createLoadMoreButton());
  attachCardEvents(container);
}

function showLoading(containerId, message) {
  document.getElementById(containerId).innerHTML =
    `<div class="loading-state"><div class="spinner"></div><p>${escapeHTML(message)}</p></div>`;
}

function renderWatchlist() {
  state.moviesByCardKey = {};
  const movies = getWatchlist();
  document.getElementById("watchlist-results").innerHTML = movies.length
    ? createMovieGrid(movies)
    : '<p class="no-results">Your watchlist is empty. Tap a heart on any movie to save it.</p>';
  attachCardEvents(document.getElementById("watchlist-results"));
}

function openWatchlist() {
  showView("watchlist");
  renderWatchlist();
}

async function openModal(movie) {
  if (!movie) return;
  fillModal(movie);
  const modal = document.getElementById("movie-modal");
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  document.getElementById("trailer-area").innerHTML =
    '<div class="trailer-loading"><div class="spinner"></div><p>Loading trailer...</p></div>';
  document.getElementById("modal-cast").innerHTML = '<p class="ott-muted">Loading cast...</p>';
  document.getElementById("modal-similar").innerHTML = '<p class="ott-muted">Loading recommendations...</p>';

  if (String(movie.id).startsWith("demo")) {
    renderOttPlatforms(normalizePlatforms(movie.ott_platforms));
    document.getElementById("modal-cast").innerHTML = '<p class="ott-muted">Cast unavailable for demo movies.</p>';
    document.getElementById("modal-similar").innerHTML = '<p class="ott-muted">Similar movies unavailable for demo movies.</p>';
  } else {
    await Promise.all([
      loadMovieDetails(movie),
      loadWatchProvidersForModal(movie),
      loadTrailerForModal(movie.id),
      loadCastForModal(movie.id),
      loadSimilarForModal(movie.id),
    ]);
  }
}

function fillModal(movie) {
  document.getElementById("modal-bg").src = movie.backdrop || movie.image;
  document.getElementById("modal-title").textContent = movie.title || "Untitled";
  document.getElementById("modal-year").textContent = movie.year || "N/A";
  document.getElementById("modal-genre").textContent = movie.genre || "N/A";
  document.getElementById("modal-summary").textContent = movie.summary || "No summary available.";
  document.getElementById("modal-tagline").textContent = movie.tagline || "";
  document.getElementById("modal-runtime").textContent = movie.runtime ? `${movie.runtime} min` : "";
  const ratingInfo = RATING_CONFIG[movie.rating] || RATING_CONFIG.timepass;
  const rating = document.getElementById("modal-rating");
  rating.textContent = ratingInfo.label;
  rating.style.backgroundColor = ratingInfo.color;
  document.getElementById("modal-vote").textContent = movie.vote_average ? `\u2B50 ${movie.vote_average} / 10` : "";
  document.getElementById("modal-mood").innerHTML = (movie.mood || [])
    .map(mood => `<span class="mood-tag">${escapeHTML(mood)}</span>`).join("");
  renderOttPlatforms(normalizePlatforms(movie.ott_platforms));
}

async function loadMovieDetails(movie) {
  const details = await fetchFromAPI(`/api/movie/${movie.id}`);
  if (!details || document.getElementById("modal-title").textContent !== movie.title) return;
  document.getElementById("modal-bg").src = details.backdrop || details.poster || movie.image;
  document.getElementById("modal-year").textContent = details.year;
  document.getElementById("modal-genre").textContent = details.genre;
  document.getElementById("modal-summary").textContent = details.overview;
  document.getElementById("modal-tagline").textContent = details.tagline;
  document.getElementById("modal-runtime").textContent = details.runtime ? `${details.runtime} min` : "Runtime N/A";
  document.getElementById("modal-vote").textContent = `\u2B50 ${details.rating} / 10`;
}

function renderOttPlatforms(platforms, loading = false) {
  const container = document.getElementById("modal-ott");
  if (loading) {
    container.innerHTML = '<h3>Available on</h3><p class="ott-muted">Checking OTT platforms...</p>';
    return;
  }
  const normalized = normalizePlatforms(platforms);
  if (!normalized.length) {
    container.innerHTML = '<h3>Available on</h3><p class="ott-muted">No OTT platform listed right now.</p>';
    return;
  }
  const free = normalized.filter(platform => ["free", "ads"].includes(platform.type));
  const paid = normalized.filter(platform => !["free", "ads"].includes(platform.type));
  container.innerHTML = [
    free.length ? `<div class="ott-group"><h3>Watch free legally</h3><div class="ott-platforms">${free.map(createOttPill).join("")}</div></div>` : "",
    paid.length ? `<div class="ott-group"><h3>Available on</h3><div class="ott-platforms">${paid.map(createOttPill).join("")}</div></div>` : "",
  ].join("");
}

function createOttPill(platform) {
  const labels = { ads: "Free with ads", free: "Free", subscription: "Subscription", rent: "Rent", buy: "Buy" };
  return `<span class="ott-pill">
    ${platform.logo ? `<img src="${escapeHTML(platform.logo)}" alt="" loading="lazy">` : `<span class="ott-fallback">${escapeHTML(platform.name[0])}</span>`}
    <span class="ott-pill__text"><span>${escapeHTML(platform.name)}</span><small>${labels[platform.type] || "Watch"}</small></span>
  </span>`;
}

async function loadWatchProvidersForModal(movie) {
  renderOttPlatforms([], true);
  renderOttPlatforms(await fetchWatchProviders(movie.id));
}

async function loadTrailerForModal(movieId) {
  const key = await fetchTrailer(movieId);
  document.getElementById("trailer-area").innerHTML = key
    ? `<iframe src="https://www.youtube.com/embed/${escapeHTML(key)}?autoplay=0&rel=0" title="Movie trailer"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    : '<p class="no-trailer">No trailer available</p>';
}

async function loadCastForModal(movieId) {
  const data = await fetchFromAPI(`/api/movie/${movieId}/credits`);
  const cast = data?.cast || [];
  document.getElementById("modal-cast").innerHTML = cast.length
    ? cast.map(person => `<article class="cast-card">
        ${person.profile ? `<img src="${escapeHTML(person.profile)}" alt="${escapeHTML(person.name)}" loading="lazy">` : '<div class="cast-placeholder">No photo</div>'}
        <strong>${escapeHTML(person.name)}</strong><span>${escapeHTML(person.character)}</span>
      </article>`).join("")
    : '<p class="ott-muted">Cast information unavailable.</p>';
}

async function loadSimilarForModal(movieId) {
  const data = await fetchFromAPI(`/api/movie/${movieId}/similar`);
  const movies = (data?.movies || []).slice(0, 8);
  document.getElementById("modal-similar").innerHTML = movies.length
    ? movies.map(movie => `<button class="similar-card" data-similar-id="${escapeHTML(movie.id)}">
        <img src="${escapeHTML(movie.image)}" alt="${escapeHTML(movie.title)}" loading="lazy">
        <span>${escapeHTML(movie.title)}</span>
      </button>`).join("")
    : '<p class="ott-muted">No similar movies found.</p>';
  document.querySelectorAll(".similar-card").forEach((button, index) => {
    button.addEventListener("click", () => openModal(movies[index]));
  });
}

function closeModal() {
  document.getElementById("trailer-area").innerHTML = "";
  document.getElementById("movie-modal").style.display = "none";
  document.body.style.overflow = "";
}

function setupModal() {
  document.getElementById("modal-close-btn").addEventListener("click", closeModal);
  document.getElementById("movie-modal").addEventListener("click", event => {
    if (event.target === event.currentTarget) closeModal();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderMoodChips();
  setupSearch();
  setupModal();
  updateWatchlistCount();
  document.getElementById("back-btn").addEventListener("click", resetHome);
  document.getElementById("watchlist-back-btn").addEventListener("click", resetHome);
  document.getElementById("watchlist-nav-btn").addEventListener("click", openWatchlist);
  document.getElementById("logo").addEventListener("click", resetHome);
  document.getElementById("logo").addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") resetHome();
  });
  loadHomepage();
});
