const state = {
  currentView: "home",
  selectedMoods: [],
  searchQuery: "",
  page: 1,
  hasMore: false,
  loadingMore: false,
  heroMovie: null,
  moviesByCardKey: {},
  explorerPath: "",
  explorerTitle: "",
  modalReviews: {
    movieId: "",
    reviews: [],
    visibleCount: 3,
    expanded: new Set(),
  },
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
const HIDDEN_MOVIES_KEY = "dannymood-hidden-movies";
const RECENT_MOODS_KEY = "dannymood-recent-moods";
const HIDDEN_MOVIES_SHOW_KEY = "dannymood-show-hidden";
const CURRENT_YEAR = new Date().getFullYear();
const reviewCache = {};

const GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Drama",
  "Fantasy", "Family", "History", "Horror", "Mystery", "Romance",
  "Sci-Fi", "Thriller", "War", "Western", "Documentary",
];

const COUNTRIES = [
  { name: "India", code: "IN", label: "Indian cinema across five major languages" },
  { name: "USA", code: "US", label: "Hollywood, independent film, and modern classics" },
  { name: "Korea", code: "KR", label: "Korean thrillers, dramas, and global hits" },
  { name: "Japan", code: "JP", label: "Anime, drama, action, and Japanese cinema" },
  { name: "UK", code: "GB", label: "British drama, comedy, crime, and period film" },
  { name: "France", code: "FR", label: "French auteurs, romance, comedy, and drama" },
  { name: "Spain", code: "ES", label: "Spanish thrillers, drama, and contemporary film" },
  { name: "Germany", code: "DE", label: "German drama, history, and modern cinema" },
];

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatReviewDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
const fetchExplorer = (path, page) => fetchFromAPI(pagedPath(path, page));

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

function getHiddenMovies() {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_MOVIES_KEY)) || [];
  } catch {
    return [];
  }
}

function toggleHiddenMovies(movieId) {
  const hidden = getHiddenMovies();
  const index = hidden.findIndex(id => String(id) === String(movieId));
  if (index >= 0) hidden.splice(index, 1);
  else hidden.push(String(movieId));
  localStorage.setItem(HIDDEN_MOVIES_KEY, JSON.stringify(hidden));
}

function isHidden(movieId) {
  return getHiddenMovies().some(id => String(id) === String(movieId));
}

function shouldShowHiddenMovies() {
  return localStorage.getItem(HIDDEN_MOVIES_SHOW_KEY) === "true";
}

function toggleShowHiddenMovies() {
  const current = shouldShowHiddenMovies();
  localStorage.setItem(HIDDEN_MOVIES_SHOW_KEY, String(!current));
  return !current;
}

function isSaved(movieId) {
  return getWatchlist().some(movie => String(movie.id) === String(movieId));
}

function updateWatchlistCount() {
  document.getElementById("watchlist-count").textContent = getWatchlist().length;
}

function getRecentMoods() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_MOODS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecentMoods(moods) {
  if (!moods.length) return;
  const key = moods.join("|");
  const recent = getRecentMoods().filter(item => item.join("|") !== key);
  recent.unshift([...moods]);
  localStorage.setItem(RECENT_MOODS_KEY, JSON.stringify(recent.slice(0, 5)));
  renderRecentMoods();
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

function hideMovie(movie, cardElement = null) {
  toggleHiddenMovies(movie.id);
  
  if (cardElement) {
    cardElement.classList.add("hiding");
    setTimeout(() => {
      cardElement.style.display = "none";
    }, 300);
  }
  
  if (state.currentView === "watchlist") {
    renderWatchlist();
  }
}

function replaceSurpriseMovie(container) {
  // Find and remove hidden movies from current results and replace with next available
  const scrollContainer = container || document.querySelector(".movie-row__scroll") || document.querySelector(".movie-grid");
  if (scrollContainer) {
    const cards = scrollContainer.querySelectorAll(".movie-card");
    cards.forEach(card => {
      if (card.classList.contains("hiding")) card.remove();
    });
  }
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
  const hidden = isHidden(movie.id);

  return `
    <article class="movie-card" data-card-key="${escapeHTML(cardKey)}">
      <div class="movie-card__poster">
        <img src="${escapeHTML(movie.image)}" alt="${escapeHTML(movie.title)}" loading="lazy" />
        <div class="movie-card__buttons">
          <button class="heart-btn ${saved ? "active" : ""}" data-movie-id="${escapeHTML(movie.id)}"
            aria-label="${saved ? "Remove from watchlist" : "Add to watchlist"}">${saved ? "\u2665" : "\u2661"}</button>
          <button class="hide-btn" data-movie-id="${escapeHTML(movie.id)}" data-hidden="${hidden}"
            aria-label="${hidden ? "Show movie" : "Hide movie"}">👁️‍🗨️</button>
        </div>
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
  root.querySelectorAll(".hide-btn").forEach(button => {
    if (button.dataset.bound) return;
    button.dataset.bound = "true";
    button.addEventListener("click", event => {
      event.stopPropagation();
      const card = button.closest(".movie-card");
      const movie = state.moviesByCardKey[card.dataset.cardKey];
      hideMovie(movie, card);
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
  document.getElementById("explorer-view").style.display = view === "explorer" ? "block" : "none";
  updateActiveNav(view === "explorer" ? state.explorerTitle.toLowerCase() : view);
  closeMobileMenu();
}

function resetHome() {
  state.selectedMoods = [];
  state.searchQuery = "";
  document.getElementById("search-input").value = "";
  renderMoodState();
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
    saveRecentMoods(moods);
    renderMoodState();
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
      renderMoodState();
      if (state.selectedMoods.length) loadMoodMovies(state.selectedMoods);
      else loadHomepage();
    });
  });
  renderMoodState();
  renderRecentMoods();
}

function renderMoodState() {
  document.querySelectorAll(".mood-chip").forEach(chip => {
    chip.classList.toggle("active", state.selectedMoods.includes(chip.dataset.mood));
  });
  const active = document.getElementById("active-moods");
  active.innerHTML = state.selectedMoods.length
    ? `<span class="active-moods__label">Your blend</span>${state.selectedMoods
        .map(mood => `<span class="active-mood-tag">${escapeHTML(mood)}</span>`).join("")}`
    : "";
  document.getElementById("clear-moods-btn").hidden = state.selectedMoods.length === 0;
}

function clearMoods() {
  state.selectedMoods = [];
  renderMoodState();
  loadHomepage();
}

function renderRecentMoods() {
  const container = document.getElementById("recent-moods");
  const recent = getRecentMoods();
  container.innerHTML = recent.length
    ? `<span class="recent-moods__label">Recent Moods</span>
       <div class="recent-moods__list">${recent.map((moods, index) =>
         `<button class="recent-mood-btn" data-recent-index="${index}" type="button">${escapeHTML(moods.join(" + "))}</button>`
       ).join("")}</div>`
    : "";
  container.querySelectorAll(".recent-mood-btn").forEach(button => {
    button.addEventListener("click", () => {
      state.selectedMoods = recent[Number(button.dataset.recentIndex)] || [];
      renderMoodState();
      showView("home");
      loadMoodMovies(state.selectedMoods);
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
  else if (state.currentView === "explorer") await loadExplorerGrid(state.explorerPath, state.explorerTitle, nextPage, true);
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
  const showHidden = shouldShowHiddenMovies();
  const hidden = getHiddenMovies();
  const filteredMovies = showHidden ? movies : movies.filter(m => !hidden.includes(String(m.id)));
  
  // Update stats
  const stats = document.getElementById("watchlist-stats");
  stats.innerHTML = `<p class="watchlist-stat">${filteredMovies.length} movie${filteredMovies.length !== 1 ? 's' : ''} in your watchlist${hidden.length ? ` (${hidden.length} hidden)` : ''}</p>`;
  
  // Get current sort preference
  const currentSort = document.querySelector(".watchlist-sort-btn.active")?.dataset.sort || "added";
  const sortedMovies = sortWatchlist(filteredMovies, currentSort);
  
  // Show recently saved section if we have multiple movies
  const recentSection = document.getElementById("recently-saved-section");
  if (sortedMovies.length > 0) {
    const recentMovies = sortedMovies.slice(0, 3);
    recentSection.innerHTML = `
      <div class="recently-saved">
        <h3>Recently Saved</h3>
        <div class="movie-grid-horizontal">${recentMovies.map(createMovieCard).join("")}</div>
      </div>
    `;
    attachCardEvents(recentSection);
  } else {
    recentSection.innerHTML = "";
  }
  
  document.getElementById("watchlist-results").innerHTML = sortedMovies.length
    ? createMovieGrid(sortedMovies)
    : `<p class="no-results">${hidden.length && !showHidden ? "All unwatched movies are hidden. Enable \"Show Hidden\" to see them." : "Your watchlist is empty. Tap a heart on any movie to save it."}</p>`;
  attachCardEvents(document.getElementById("watchlist-results"));
}

function sortWatchlist(movies, sortBy) {
  const sorted = [...movies];
  if (sortBy === "rating") {
    sorted.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
  } else if (sortBy === "release") {
    sorted.sort((a, b) => {
      const dateA = new Date(a.release_date || "1900-01-01");
      const dateB = new Date(b.release_date || "1900-01-01");
      return dateB - dateA;
    });
  } else if (sortBy === "alpha") {
    sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }
  // "added" keeps original order (most recently added first)
  return sorted;
}

function surpriseMe() {
  // Get all currently visible movies from any source
  let allMovies = [];
  
  if (state.currentView === "home" && state.selectedMoods.length) {
    // Get from mood results
    const rows = document.querySelectorAll(".movie-row__scroll");
    rows.forEach(row => {
      row.querySelectorAll(".movie-card").forEach(card => {
        const movie = state.moviesByCardKey[card.dataset.cardKey];
        if (movie && !isHidden(movie.id)) allMovies.push(movie);
      });
    });
  } else if (state.currentView === "search") {
    // Get from search results
    const grid = document.querySelector(".movie-grid");
    if (grid) {
      grid.querySelectorAll(".movie-card").forEach(card => {
        const movie = state.moviesByCardKey[card.dataset.cardKey];
        if (movie && !isHidden(movie.id)) allMovies.push(movie);
      });
    }
  } else if (state.currentView === "home") {
    // Get from home page rows
    const rows = document.querySelectorAll(".movie-row__scroll");
    rows.forEach(row => {
      row.querySelectorAll(".movie-card").forEach(card => {
        const movie = state.moviesByCardKey[card.dataset.cardKey];
        if (movie && !isHidden(movie.id)) allMovies.push(movie);
      });
    });
  } else if (state.currentView === "explorer") {
    // Get from explorer
    const rows = document.querySelectorAll(".movie-row__scroll, .movie-grid");
    rows.forEach(row => {
      row.querySelectorAll(".movie-card").forEach(card => {
        const movie = state.moviesByCardKey[card.dataset.cardKey];
        if (movie && !isHidden(movie.id)) allMovies.push(movie);
      });
    });
  }
  
  // Remove duplicates
  const uniqueMovies = Array.from(new Map(allMovies.map(m => [m.id, m])).values());
  
  if (uniqueMovies.length === 0) {
    alert("No movies available for surprise pick. Try browsing some movies first!");
    return;
  }
  
  // Pick random movie
  const randomMovie = uniqueMovies[Math.floor(Math.random() * uniqueMovies.length)];
  
  // Open modal with animation
  const modal = document.getElementById("movie-modal");
  modal.classList.add("surprise-reveal");
  setTimeout(() => modal.classList.remove("surprise-reveal"), 600);
  
  openModal(randomMovie);
}

function openWatchlist() {
  showView("watchlist");
  renderWatchlist();
}

function updateActiveNav(view) {
  const aliases = { explorer: "browse", "tv series": "tv" };
  const target = aliases[view] || view;
  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.view === target);
  });
}

function closeMobileMenu() {
  const panel = document.getElementById("nav-panel");
  const toggle = document.getElementById("menu-toggle");
  panel.classList.remove("open");
  toggle.classList.remove("open");
  toggle.setAttribute("aria-expanded", "false");
}

function toggleMobileMenu() {
  const panel = document.getElementById("nav-panel");
  const toggle = document.getElementById("menu-toggle");
  const open = panel.classList.toggle("open");
  toggle.classList.toggle("open", open);
  toggle.setAttribute("aria-expanded", String(open));
}

function setExplorerHeader(kicker, title, description) {
  document.getElementById("explorer-kicker").textContent = kicker;
  document.getElementById("explorer-title").textContent = title;
  document.getElementById("explorer-description").textContent = description;
}

function openExplorer(view) {
  state.explorerTitle = view;
  state.moviesByCardKey = {};
  showView("explorer");
  updateActiveNav(view);
  const controls = document.getElementById("explorer-controls");
  const results = document.getElementById("explorer-results");
  controls.innerHTML = "";
  results.innerHTML = "";

  if (view === "genres") renderGenreExplorer();
  else if (view === "countries") renderCountryExplorer();
  else if (view === "years") renderYearExplorer();
  else if (view === "movies") renderMediaExplorer("movie");
  else if (view === "tv") renderMediaExplorer("tv");
  else renderBrowseHub();
}

function renderGenreExplorer() {
  setExplorerHeader("EXPLORE BY STORY", "Genres", "Move from broad curiosity to the exact kind of film you want tonight.");
  document.getElementById("explorer-controls").innerHTML =
    `<div class="discovery-card-grid">${GENRES.map((genre, index) =>
      `<button class="discovery-card genre-card" data-genre="${escapeHTML(genre)}" type="button">
        <span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHTML(genre)}</strong>
      </button>`).join("")}</div>`;
  document.querySelectorAll(".genre-card").forEach(card => {
    card.addEventListener("click", () => loadGenreCollections(card.dataset.genre));
  });
  loadGenreCollections("Action");
}

async function loadGenreCollections(genre) {
  setExplorerHeader("GENRE COLLECTION", genre, `Trending, acclaimed, and newly released ${genre.toLowerCase()} movies.`);
  document.querySelectorAll(".genre-card").forEach(card => {
    card.classList.toggle("selected", card.dataset.genre === genre);
  });
  const results = document.getElementById("explorer-results");
  showLoading("explorer-results", `Curating ${genre} movies...`);
  const base = `/api/discover/genre?genre=${encodeURIComponent(genre)}`;
  const [trending, topRated, latest] = await Promise.all([
    fetchFromAPI(`${base}&category=trending&page=1`),
    fetchFromAPI(`${base}&category=top_rated&page=1`),
    fetchFromAPI(`${base}&category=latest&page=1`),
  ]);
  results.innerHTML =
    createMovieRow(`Trending in ${genre}`, trending?.movies || [], {
      endpoint: `${base}&category=trending`, hasMore: trending?.has_more,
    }) +
    createMovieRow(`Top Rated in ${genre}`, topRated?.movies || [], {
      endpoint: `${base}&category=top_rated`, hasMore: topRated?.has_more,
    }) +
    createMovieRow(`Latest in ${genre}`, latest?.movies || [], {
      endpoint: `${base}&category=latest`, hasMore: latest?.has_more,
    });
  attachCardEvents(results);
}

function renderCountryExplorer() {
  setExplorerHeader("WORLD CINEMA", "Countries", "Explore popular films through the languages and filmmaking cultures that shaped them.");
  document.getElementById("explorer-controls").innerHTML =
    `<div class="discovery-card-grid country-grid">${COUNTRIES.map(country =>
      `<button class="discovery-card country-card" data-country="${escapeHTML(country.name)}" type="button">
        <span>${escapeHTML(country.code)}</span><strong>${escapeHTML(country.name)}</strong><small>${escapeHTML(country.label)}</small>
      </button>`).join("")}</div>
     <div id="country-language-filters" class="filter-strip"></div>`;
  document.querySelectorAll(".country-card").forEach(card => {
    card.addEventListener("click", () => selectCountry(card.dataset.country));
  });
  selectCountry("India");
}

function selectCountry(country, language = "") {
  document.querySelectorAll(".country-card").forEach(card => {
    card.classList.toggle("selected", card.dataset.country === country);
  });
  const filters = document.getElementById("country-language-filters");
  filters.innerHTML = country === "India"
    ? ["Hindi", "Tamil", "Telugu", "Malayalam", "Kannada"].map(name =>
        `<button class="filter-chip ${name === language ? "active" : ""}" data-language="${name}" type="button">${name}</button>`
      ).join("")
    : "";
  filters.querySelectorAll(".filter-chip").forEach(button => {
    button.addEventListener("click", () => selectCountry(country, button.dataset.language));
  });
  const query = `/api/discover/country?country=${encodeURIComponent(country)}${language ? `&language=${encodeURIComponent(language)}` : ""}`;
  loadExplorerGrid(query, language ? `${language} Movies` : `Popular in ${country}`);
}

function renderYearExplorer() {
  setExplorerHeader("TIME CAPSULE", "Years", "Travel through movie history or tune the range to a precise era.");
  const presets = [
    ["2020s", 2020, CURRENT_YEAR], ["2010s", 2010, 2019], ["2000s", 2000, 2009],
    ["1990s", 1990, 1999], ["1980s", 1980, 1989], ["Classics", 1950, 1979],
  ];
  document.getElementById("explorer-controls").innerHTML =
    `<div class="filter-strip year-presets">${presets.map(([label, from, to]) =>
      `<button class="filter-chip" data-from="${from}" data-to="${to}" type="button">${label}</button>`
    ).join("")}</div>
    <div class="year-range">
      <div class="year-range__values"><strong id="from-year-value">1950</strong><span>to</span><strong id="to-year-value">${CURRENT_YEAR}</strong></div>
      <label>From <input id="from-year" type="range" min="1950" max="${CURRENT_YEAR}" value="1950"></label>
      <label>To <input id="to-year" type="range" min="1950" max="${CURRENT_YEAR}" value="${CURRENT_YEAR}"></label>
      <button id="apply-year-range" class="btn-gold" type="button">Explore Years</button>
    </div>`;
  document.querySelectorAll(".year-presets .filter-chip").forEach(button => {
    button.addEventListener("click", () => applyYearRange(Number(button.dataset.from), Number(button.dataset.to), button));
  });
  const fromInput = document.getElementById("from-year");
  const toInput = document.getElementById("to-year");
  const syncYears = () => {
    if (Number(fromInput.value) > Number(toInput.value)) {
      if (document.activeElement === fromInput) toInput.value = fromInput.value;
      else fromInput.value = toInput.value;
    }
    document.getElementById("from-year-value").textContent = fromInput.value;
    document.getElementById("to-year-value").textContent = toInput.value;
  };
  fromInput.addEventListener("input", syncYears);
  toInput.addEventListener("input", syncYears);
  document.getElementById("apply-year-range").addEventListener("click", () =>
    applyYearRange(Number(fromInput.value), Number(toInput.value))
  );
  applyYearRange(2020, CURRENT_YEAR, document.querySelector('.year-presets .filter-chip[data-from="2020"]'));
}

function applyYearRange(fromYear, toYear, activeButton = null) {
  document.getElementById("from-year").value = fromYear;
  document.getElementById("to-year").value = toYear;
  document.getElementById("from-year-value").textContent = fromYear;
  document.getElementById("to-year-value").textContent = toYear;
  document.querySelectorAll(".year-presets .filter-chip").forEach(button => {
    button.classList.toggle("active", button === activeButton);
  });
  loadExplorerGrid(
    `/api/discover/year?from_year=${fromYear}&to_year=${toYear}`,
    fromYear === toYear ? `Movies from ${fromYear}` : `Movies from ${fromYear} to ${toYear}`,
  );
}

function renderMediaExplorer(mediaType) {
  const isTv = mediaType === "tv";
  setExplorerHeader(
    isTv ? "SERIES LIBRARY" : "MOVIE LIBRARY",
    isTv ? "TV Series" : "Movies",
    isTv ? "Popular series from around the world, ready to explore." : "A broad, continuously updated collection of popular movies.",
  );
  loadExplorerGrid(`/api/discover/media?type=${mediaType}`, isTv ? "Popular TV Series" : "Popular Movies");
}

function renderBrowseHub() {
  setExplorerHeader("DISCOVERY HUB", "Browse", "Choose a path into DannyMood's movie library.");
  const destinations = [
    ["genres", "Genres", "Explore by story, tone, and cinematic style"],
    ["countries", "Countries", "Travel through international cinema"],
    ["years", "Years", "Browse decades or choose an exact range"],
    ["movies", "Movies", "See what audiences are watching now"],
    ["tv", "TV Series", "Discover popular series from TMDB"],
    ["moods", "Moods", "Build a recommendation from how you feel"],
  ];
  document.getElementById("explorer-controls").innerHTML =
    `<div class="browse-grid">${destinations.map(([view, title, description]) =>
      `<button class="browse-destination" data-destination="${view}" type="button">
        <strong>${title}</strong><span>${description}</span><b aria-hidden="true">&rarr;</b>
      </button>`).join("")}</div>`;
  document.querySelectorAll(".browse-destination").forEach(button => {
    button.addEventListener("click", () => navigateTo(button.dataset.destination));
  });
}

async function loadExplorerGrid(path, title, page = 1, append = false) {
  state.explorerPath = path;
  state.explorerTitle = state.explorerTitle || "browse";
  state.page = page;
  const results = document.getElementById("explorer-results");
  if (!append) {
    state.moviesByCardKey = {};
    showLoading("explorer-results", `Loading ${title.toLowerCase()}...`);
  }
  const data = await fetchExplorer(path, page);
  const movies = data?.movies || [];
  state.hasMore = Boolean(data?.has_more && movies.length);
  if (append) {
    appendMovies(results.querySelector(".movie-grid"), movies);
    updateLoadMore(results);
  } else {
    results.innerHTML = `<h2 class="explorer-results-title">${escapeHTML(title)}</h2>` +
      createMovieGrid(movies) + createLoadMoreButton();
    attachCardEvents(results);
  }
}

function navigateTo(view, updateHash = true) {
  if (updateHash && window.location.hash !== `#${view}`) {
    window.location.hash = view;
    return;
  }
  if (view === "home") resetHome();
  else if (view === "moods") {
    showView("home");
    updateActiveNav("moods");
    document.querySelector(".mood-section").scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (view === "watchlist") openWatchlist();
  else openExplorer(view);
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
  document.getElementById("modal-reviews").innerHTML = '<p class="ott-muted">Loading reviews...</p>';

  if (String(movie.id).startsWith("demo")) {
    renderOttPlatforms(normalizePlatforms(movie.ott_platforms));
    document.getElementById("modal-cast").innerHTML = '<p class="ott-muted">Cast unavailable for demo movies.</p>';
    document.getElementById("modal-similar").innerHTML = '<p class="ott-muted">Similar movies unavailable for demo movies.</p>';
    renderReviews([], movie.id);
  } else {
    const mediaType = movie.media_type || "movie";
    await Promise.all([
      loadMovieDetails(movie, mediaType),
      loadWatchProvidersForModal(movie),
      loadTrailerForModal(movie.id, mediaType),
      loadCastForModal(movie.id, mediaType),
      loadSimilarForModal(movie.id, mediaType),
      loadReviewsForModal(movie.id, mediaType),
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

async function loadMovieDetails(movie, mediaType = "movie") {
  const details = await fetchFromAPI(`/api/${mediaType}/${movie.id}`);
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
  if (movie.media_type === "tv") {
    renderOttPlatforms([]);
    return;
  }
  renderOttPlatforms(await fetchWatchProviders(movie.id));
}

async function loadTrailerForModal(movieId, mediaType = "movie") {
  const data = String(movieId).startsWith("demo")
    ? null
    : await fetchFromAPI(`/api/${mediaType}/${movieId}/trailer`);
  const key = data?.trailer_key || null;
  document.getElementById("trailer-area").innerHTML = key
    ? `<iframe src="https://www.youtube.com/embed/${escapeHTML(key)}?autoplay=0&rel=0" title="Movie trailer"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    : '<p class="no-trailer">No trailer available</p>';
}

async function loadCastForModal(movieId, mediaType = "movie") {
  const data = await fetchFromAPI(`/api/${mediaType}/${movieId}/credits`);
  const cast = data?.cast || [];
  document.getElementById("modal-cast").innerHTML = cast.length
    ? cast.map(person => `<article class="cast-card">
        ${person.profile ? `<img src="${escapeHTML(person.profile)}" alt="${escapeHTML(person.name)}" loading="lazy">` : '<div class="cast-placeholder">No photo</div>'}
        <strong>${escapeHTML(person.name)}</strong><span>${escapeHTML(person.character)}</span>
      </article>`).join("")
    : '<p class="ott-muted">Cast information unavailable.</p>';
}

async function loadSimilarForModal(movieId, mediaType = "movie") {
  const data = await fetchFromAPI(`/api/${mediaType}/${movieId}/similar`);
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

async function loadReviewsForModal(movieId, mediaType = "movie") {
  if (mediaType !== "movie") {
    renderReviews([], movieId);
    return;
  }

  if (reviewCache[movieId]) {
    renderReviews(reviewCache[movieId], movieId);
    return;
  }

  const data = await fetchFromAPI(`/api/movie/${movieId}/reviews`);
  const reviews = data?.reviews || [];
  reviewCache[movieId] = reviews;
  renderReviews(reviews, movieId);
}

function renderReviews(reviews, movieId, visibleCount = 3, expanded = new Set()) {
  const container = document.getElementById("modal-reviews");
  state.modalReviews = { movieId: String(movieId), reviews, visibleCount, expanded };

  if (!reviews.length) {
    container.innerHTML = '<p class="ott-muted">No reviews available for this movie yet.</p>';
    return;
  }

  const visibleReviews = reviews.slice(0, visibleCount);
  container.innerHTML = `
    <div class="review-list">
      ${visibleReviews.map((review, index) => createReviewCard(review, index, expanded.has(index))).join("")}
    </div>
    ${visibleCount < reviews.length
      ? '<button id="show-more-reviews" class="review-action-btn" type="button">Show More Reviews</button>'
      : ""}
  `;

  container.querySelectorAll(".review-expand-btn").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.reviewIndex);
      const nextExpanded = new Set(state.modalReviews.expanded);
      if (nextExpanded.has(index)) nextExpanded.delete(index);
      else nextExpanded.add(index);
      renderReviews(reviews, movieId, visibleCount, nextExpanded);
    });
  });

  const showMore = document.getElementById("show-more-reviews");
  if (showMore) {
    showMore.addEventListener("click", () => {
      renderReviews(reviews, movieId, Math.min(visibleCount + 3, reviews.length), expanded);
    });
  }
}

function createReviewCard(review, index, expanded) {
  const content = review.content || "No review text provided.";
  const shouldTruncate = content.length > 520;
  const displayedContent = shouldTruncate && !expanded
    ? `${content.slice(0, 520).trim()}...`
    : content;
  const rating = review.rating || review.rating === 0
    ? `${review.rating}/10`
    : "No rating";

  return `
    <article class="review-card">
      <div class="review-card__meta">
        <div>
          <strong>${escapeHTML(review.author || "Anonymous")}</strong>
          <span>${escapeHTML(formatReviewDate(review.date))}</span>
        </div>
        <span class="review-rating">${escapeHTML(rating)}</span>
      </div>
      <p>${escapeHTML(displayedContent)}</p>
      <div class="review-card__actions">
        ${shouldTruncate
          ? `<button class="review-expand-btn" data-review-index="${index}" type="button">${expanded ? "Show Less" : "Read More"}</button>`
          : ""}
        ${review.url
          ? `<a href="${escapeHTML(review.url)}" target="_blank" rel="noopener">Open on TMDB</a>`
          : ""}
      </div>
    </article>
  `;
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
  document.getElementById("back-btn").addEventListener("click", () => navigateTo("home"));
  document.getElementById("watchlist-back-btn").addEventListener("click", () => navigateTo("home"));
  document.getElementById("clear-moods-btn").addEventListener("click", clearMoods);
  document.getElementById("menu-toggle").addEventListener("click", toggleMobileMenu);
  document.getElementById("surprise-me-btn").addEventListener("click", surpriseMe);
  
  // Hidden movies toggle (separate button on left)
  document.getElementById("toggle-hidden-movies").addEventListener("click", () => {
    toggleShowHiddenMovies();
    document.getElementById("toggle-hidden-movies").classList.toggle("active");
    renderWatchlist();
  });
  
  // Watchlist sorting
  document.querySelectorAll(".watchlist-sort-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".watchlist-sort-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderWatchlist();
    });
  });
  
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => navigateTo(link.dataset.view));
  });
  document.getElementById("logo").addEventListener("click", () => navigateTo("home"));
  document.getElementById("logo").addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") navigateTo("home");
  });
  window.addEventListener("hashchange", () => {
    navigateTo(window.location.hash.slice(1) || "home", false);
  });
  navigateTo(window.location.hash.slice(1) || "home", false);
});
