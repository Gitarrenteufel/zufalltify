// ── Zentraler State ───────────────────────────────────────────────────────────
const state = {
  appMode:       localStorage.getItem("zt_mode") || "musik",
  cachedArtists: null,
  artist: {
    id:   null,
    name: null,
    url:  null,
  },
  album: {
    uri:  null,
    data: null,
  },
};

// ── Token ─────────────────────────────────────────────────────────────────────
const token = {
  get:  ()      => localStorage.getItem("spotify_access_token"),
  set:  (t, exp, refresh) => {
    localStorage.setItem("spotify_access_token",     t);
    localStorage.setItem("spotify_token_expires_at", Date.now() + (exp || 3600) * 1000);
    if (refresh) localStorage.setItem("spotify_refresh_token", refresh);
  },
  getRefresh: () => localStorage.getItem("spotify_refresh_token"),
  getExpiry:  () => localStorage.getItem("spotify_token_expires_at"),
  clear: () => {
    ["spotify_access_token","spotify_token_expires_at","spotify_refresh_token","zt_followed_cache"]
      .forEach(k => localStorage.removeItem(k));
  },
};

// ── Modus ─────────────────────────────────────────────────────────────────────
function getMode() { return state.appMode; }
function setAppMode(mode) {
  state.appMode = mode;
  localStorage.setItem("zt_mode", mode);
}

// ── Favoriten ─────────────────────────────────────────────────────────────────
function favKey(mode) {
  const m = mode || state.appMode;
  return m === "hoerspiel" ? "zt_favorites_hoerspiel" : "zt_favorites_musik";
}
function getFavorites(mode) {
  const key = favKey(mode);
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return JSON.parse(stored);
    const defaults = (mode || state.appMode) === "hoerspiel" ? DEFAULT_FAVORITES_HOERSPIEL : DEFAULT_FAVORITES_MUSIK;
    saveFavorites(defaults, mode);
    return defaults.slice();
  } catch {
    return ((mode || state.appMode) === "hoerspiel" ? DEFAULT_FAVORITES_HOERSPIEL : DEFAULT_FAVORITES_MUSIK).slice();
  }
}
function saveFavorites(favs, mode) {
  localStorage.setItem(favKey(mode), JSON.stringify(favs));
}
function getFavName(f) { return typeof f === 'object' ? f.name : f; }
function getFavId(f)   { return typeof f === 'object' ? f.id   : null; }

// ── Bookmarks ─────────────────────────────────────────────────────────────────
function bookmarkKey() {
  return state.appMode === "hoerspiel" ? "zt_bookmarks_hoerspiel" : "zt_bookmarks_musik";
}
function getBookmarks() {
  try { return JSON.parse(localStorage.getItem(bookmarkKey()) || "[]"); }
  catch { return []; }
}
function addBookmark(album, artistName) {
  const bookmarks = getBookmarks();
  const entry = {
    album: album.name, artist: artistName,
    year:     album.release_date?.substring(0,4) || "",
    cover:    album.images?.[1]?.url || album.images?.[0]?.url || "",
    albumUrl: album.external_urls?.spotify || "",
    uri:      album.uri
  };
  if (bookmarks.find(b => b.uri === entry.uri)) return;
  bookmarks.unshift(entry);
  localStorage.setItem(bookmarkKey(), JSON.stringify(bookmarks));
}
function removeBookmark(uri) {
  const bookmarks = getBookmarks().filter(b => b.uri !== uri);
  localStorage.setItem(bookmarkKey(), JSON.stringify(bookmarks));
}

// ── Blacklist ─────────────────────────────────────────────────────────────────
function blacklistKey() {
  return state.appMode === "hoerspiel" ? "zt_blacklist_hoerspiel" : "zt_blacklist_musik";
}
function getBlacklist() {
  try { return JSON.parse(localStorage.getItem(blacklistKey()) || "[]"); } catch { return []; }
}
function saveBlacklist(list) {
  localStorage.setItem(blacklistKey(), JSON.stringify(list));
}

// ── Verlauf ───────────────────────────────────────────────────────────────────
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}
function getHistory() {
  try { return JSON.parse(localStorage.getItem("zt_history") || "[]"); } catch { return []; }
}
function addToHistory(album, artistName) {
  const history = getHistory();
  const entry = {
    album:    album.name,
    artist:   artistName,
    year:     album.release_date?.substring(0,4) || "",
    cover:    album.images?.[2]?.url || album.images?.[1]?.url || album.images?.[0]?.url || "",
    albumUrl: album.external_urls?.spotify || "",
    ts:       Date.now()
  };
  const filtered = history.filter(h => h.album !== entry.album || h.artist !== entry.artist);
  filtered.unshift(entry);
  localStorage.setItem("zt_history", JSON.stringify(filtered.slice(0, HISTORY_MAX)));
}

// ── Playlisten ────────────────────────────────────────────────────────────────
function getPlaylists() {
  try {
    const stored = localStorage.getItem("zt_playlists");
    if (stored !== null) return JSON.parse(stored);
    savePlaylists(DEFAULT_PLAYLISTS);
    return DEFAULT_PLAYLISTS.slice();
  } catch { return DEFAULT_PLAYLISTS.slice(); }
}
function savePlaylists(list) { localStorage.setItem("zt_playlists", JSON.stringify(list)); }

// ── Filter ────────────────────────────────────────────────────────────────────
function getFilters() {
  try { return JSON.parse(localStorage.getItem("zt_filters") || '{"album":true,"single":false,"compilation":false,"appears_on":false}'); }
  catch { return { album: true, single: false, compilation: false, appears_on: false }; }
}
function saveFilters(filters) {
  localStorage.setItem("zt_filters", JSON.stringify(filters));
}
function getIncludeGroups() {
  const f = getFilters();
  const groups = [];
  if (f.album)       groups.push("album");
  if (f.single)      groups.push("single");
  if (f.compilation) groups.push("compilation");
  if (f.appears_on)  groups.push("appears_on");
  return groups.length ? groups.join(",") : "album";
}

// ── Künstler-Pool ─────────────────────────────────────────────────────────────
function getArtistPool(artists) {
  const blacklist    = getBlacklist();
  const blacklistIds = new Set(blacklist.map(b => b.id));
  if (state.appMode === "hoerspiel") {
    return getFavorites().map(f => ({
      id:   getFavId(f),
      name: getFavName(f),
      external_urls: { spotify: `https://open.spotify.com/artist/${getFavId(f)}` }
    })).filter(a => a.id && !HOERBUCH_IDS.has(a.id) && !blacklistIds.has(a.id));
  }
  return artists.filter(a => !HOERSPIEL_IDS.has(a.id) && !HOERBUCH_IDS.has(a.id) && !blacklistIds.has(a.id));
}

// ── Album-Normalisierung ──────────────────────────────────────────────────────
function normalizeAlbumName(name) {
  return name.toLowerCase()
    .replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '')
    .replace(/\bremaster(ed)?\b/g, '').replace(/\bdeluxe\b/g, '')
    .replace(/\bsuper\b/g, '').replace(/\bexpanded\b/g, '')
    .replace(/\bcollector'?s?\b/g, '').replace(/\bedition\b/g, '')
    .replace(/\banniversary\b/g, '')
    .replace(/\b\d{4}\s*(mix|remaster|version|edition)\b/g, '')
    .replace(/\bmix\b/g, '').replace(/\bversion\b/g, '')
    .replace(/\s+/g, ' ').trim();
}
function filterAlbums(items) {
  const seen = new Set();
  return items.filter(a => {
    const k = normalizeAlbumName(a.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Album des Tages ───────────────────────────────────────────────────────────
function aodKey() {
  return state.appMode === "hoerspiel" ? "zt_album_of_day_hoerspiel" : "zt_album_of_day_musik";
}
function getAlbumOfDay() {
  try { return JSON.parse(localStorage.getItem(aodKey()) || "null"); } catch { return null; }
}
function saveAlbumOfDay(entry) {
  localStorage.setItem(aodKey(), JSON.stringify(entry));
}

// ── Letztes Album ─────────────────────────────────────────────────────────────
function saveLastAlbum(album, artistName, artistUrl) {
  const cover    = album.images?.[0]?.url || "";
  const albumUrl = album.external_urls?.spotify || "";
  localStorage.setItem("zt_last_album", JSON.stringify({
    uri:      album.uri,
    name:     album.name,
    artist:   artistName,
    artistId: state.artist.id || null,
    year:     album.release_date?.substring(0,4) || "",
    cover, albumUrl,
    artistUrl: artistUrl || "",
    mode:     state.appMode
  }));
}
function getLastAlbum() {
  try { return JSON.parse(localStorage.getItem("zt_last_album") || "null"); } catch { return null; }
}
