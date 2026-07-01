// ── App-Logik ─────────────────────────────────────────────────────────────────
const app = {

  // ── Modus ──────────────────────────────────────────────────────────────────
  setMode(mode) {
    setAppMode(mode);
    ui.applyModeColors();
    ui.updateModeToggle();
    ui.updateModeLabels();
    ui.renderFavorites();
    ui.hideAlbumOfDay();
    app.pickAlbumOfDay().catch(() => {});
    if (document.getElementById("page-bookmarks").classList.contains("active")) ui.renderBookmarks();
    if (document.getElementById("page-blacklist").classList.contains("active")) ui.renderBlacklist();
    if (document.getElementById("page-playlists").classList.contains("active")) ui.renderPlaylists();
    if (document.getElementById("albumCard").classList.contains("visible"))     ui.updateCardIcons();
  },

  // ── Auth ───────────────────────────────────────────────────────────────────
  login() {
    const url = new URL("https://accounts.spotify.com/authorize");
    url.searchParams.set("client_id",     CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri",  REDIRECT_URI);
    url.searchParams.set("scope",         SCOPES);
    location.href = url.toString();
  },
  logout() {
    token.clear();
    ui.showLogin();
  },

  // ── Navigation ─────────────────────────────────────────────────────────────
  switchTab(name, btn) {
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    if (btn) btn.classList.add('active');
    if (name === 'stats')      ui.renderHistory();
    if (name === 'bookmarks')  ui.renderBookmarks();
    if (name === 'blacklist')  ui.renderBlacklist();
    if (name === 'favs')       ui.renderFavorites();
    if (name === 'playlists')  ui.renderPlaylists();
  },
  openDrawer() {
    document.getElementById("drawer").classList.add("open");
    document.getElementById("drawerOverlay").style.display = "block";
  },
  closeDrawer() {
    document.getElementById("drawer").classList.remove("open");
    document.getElementById("drawerOverlay").style.display = "none";
  },
  openDrawerTab(name) {
    app.closeDrawer();
    document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    if (name === 'stats')     ui.renderHistory();
    if (name === 'bookmarks') ui.renderBookmarks();
    if (name === 'blacklist') ui.renderBlacklist();
  },

  // ── Gerät ──────────────────────────────────────────────────────────────────
  async checkDevice() {
    if (!token.get()) return;
    const savedId   = localStorage.getItem("spotify_device_id");
    const savedName = localStorage.getItem("spotify_device_name");
    try {
      const devices = await spotify.getDevices();
      if (devices.length >= 1) {
        const d = devices.find(d => d.id === savedId) || devices[0];
        localStorage.setItem("spotify_device_id",   d.id);
        localStorage.setItem("spotify_device_name", d.name);
        ui.updateDevicePill(d.name + (devices.length === 1 ? " (automatisch)" : ""), true);
        ui.showSpotifyBtn(false);
      } else {
        if (savedName) ui.updateDevicePill(savedName + " – nicht erreichbar", false);
        ui.showSpotifyBtn(true);
      }
    } catch {
      if (savedName) ui.updateDevicePill(savedName, null);
      ui.showSpotifyBtn(true);
    }
  },

  async waitForDevice(maxRetries = 2, delayMs = 1000) {
    let spotifyOpened = false;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const devices = await spotify.getDevices();
        if (devices.length > 0) {
          const savedId = localStorage.getItem("spotify_device_id");
          if (!savedId || !devices.find(d => d.id === savedId)) {
            localStorage.setItem("spotify_device_id",   devices[0].id);
            localStorage.setItem("spotify_device_name", devices[0].name);
            ui.updateDevicePill(devices[0].name + " (automatisch)", true);
          }
          return true;
        }
      } catch {}
      if (i === 0 && !spotifyOpened && typeof AndroidBridge !== "undefined") {
        AndroidBridge.openSpotify();
        spotifyOpened = true;
      }
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, delayMs));
    }
    return false;
  },

  async openSpotifyFromApp() {
    if (typeof AndroidBridge !== "undefined") {
      AndroidBridge.openSpotify();
    }
    // checkDevice wird durch visibilitychange ausgelöst wenn App zurückkommt
  },

  async toggleDeviceSelector() {
    const sel = document.getElementById("deviceSelectorSys");
    if (sel.style.display === "block") { sel.style.display = "none"; return; }
    const devices = await spotify.getDevices();
    const list    = document.getElementById("deviceList");
    list.innerHTML = "";
    if (!devices.length) {
      list.innerHTML = '<p style="color:var(--warn);font-size:13px">Keine Geräte gefunden – Spotify öffnen und erneut versuchen.</p>';
    } else {
      devices.forEach(d => {
        const btn = document.createElement("button");
        btn.className = "device-btn";
        btn.innerHTML = d.name + `<span class="device-type">(${d.type})</span>`;
        btn.onclick = () => {
          localStorage.setItem("spotify_device_id",   d.id);
          localStorage.setItem("spotify_device_name", d.name);
          ui.updateDevicePill(d.name, true);
          document.getElementById("deviceSelectorSys").style.display = "none";
        };
        list.appendChild(btn);
      });
    }
    sel.style.display = "block";
  },

  // ── Wiedergabe ─────────────────────────────────────────────────────────────
  async playAlbum() {
    const exp = token.getExpiry();
    if (exp && parseInt(exp) - Date.now() < 0) {
      const ok = await spotify.refreshToken();
      if (!ok) { ui.showSessionBanner(true); return; }
    }
    if (!state.album.uri) return;

    let deviceId = localStorage.getItem("spotify_device_id");
    if (!deviceId) {
      const found = await app.waitForDevice(3, 1000);
      if (!found) { ui.showError("Kein Gerät verbunden", "Spotify öffnen und erneut versuchen."); return; }
      deviceId = localStorage.getItem("spotify_device_id");
    }

    await spotify.disableShuffleAndRepeat();
    const r = await spotify.play(state.album.uri, deviceId);
    if (r.ok || r.status === 204) {
      ui.hideError();
    } else {
      const data = await r.json().catch(() => ({}));
      if (r.status === 404 || r.status === 403) {
        const found = await app.waitForDevice(2, 1500);
        if (found) {
          deviceId = localStorage.getItem("spotify_device_id");
          const r2 = await spotify.play(state.album.uri, deviceId);
          if (r2.ok || r2.status === 204) { ui.hideError(); return; }
        }
        ui.showError("Kein Gerät verbunden", "Spotify öffnen und erneut versuchen.");
      } else {
        ui.showError("Wiedergabe fehlgeschlagen", data?.error?.message || "Unbekannter Fehler");
      }
    }
  },

  // ── Kernfunktion: Künstler abspielen ───────────────────────────────────────
  // Ersetzt loadAlbums, loadAlbumsByName, playArtistById
  async playArtist(artistId, artistName, artistUrl) {
    ui.hideError();
    document.getElementById("artistInput").value = "";
    ui.hideDropdown();

    // Wenn nur Name übergeben: erst suchen
    if (!artistId) {
      if (!artistName) return;
      const results = await spotify.searchArtists(artistName);
      const found   = results.find(a => a.name.toLowerCase() === artistName.toLowerCase()) || results[0];
      if (!found) { ui.showError("Künstler nicht gefunden", "Bitte Schreibweise prüfen."); return; }
      artistId  = found.id;
      artistName = found.name;
      artistUrl  = found.external_urls?.spotify || "";
    }

    // Wenn vollständige Artist-Daten noch nicht bekannt: laden
    if (!artistUrl) {
      try {
        const artist = await spotify.getArtist(artistId);
        artistName = artist.name || artistName;
        artistUrl  = artist.external_urls?.spotify || "";
      } catch {}
    }

    const studioAlbums = filterAlbums(await spotify.fetchAllAlbums(artistId));
    if (!studioAlbums.length) {
      ui.showError("Keine Alben gefunden", "Für diesen Künstler wurden keine passenden Alben gefunden.");
      return;
    }

    state.artist.id   = artistId;
    state.artist.name = artistName;
    state.artist.url  = artistUrl;

    const random = studioAlbums[Math.floor(Math.random() * studioAlbums.length)];
    state.album.uri  = random.uri;
    state.album.data = { album: random, artistName };

    addToHistory(random, artistName);
    saveLastAlbum(random, artistName, artistUrl);
    ui.showAlbumCard(random, artistName);
    await app.playAlbum();
  },

  // ── Surprise Me ────────────────────────────────────────────────────────────
  async surpriseMe() {
    const btn = document.getElementById("surpriseBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>Einen Moment…';
    ui.hideError();
    try {
      if (!state.cachedArtists) state.cachedArtists = await spotify.fetchAllFollowedArtists();
      const pool = getArtistPool(state.cachedArtists);
      if (!pool.length) {
        ui.showError(
          state.appMode === "hoerspiel" ? "Keine Hörspiel-Künstler gefunden" : "Keine gefolgten Künstler",
          state.appMode === "hoerspiel" ? "Hörspiel-Favoriten sind leer."   : "Bitte Künstler auf Spotify folgen."
        );
        return;
      }
      for (let i = 0; i < 30; i++) {
        const artist = pool[Math.floor(Math.random() * pool.length)];
        try {
          const albums = filterAlbums(await spotify.fetchAllAlbums(artist.id));
          if (!albums.length) continue;
          state.artist.id   = artist.id;
          state.artist.name = artist.name;
          state.artist.url  = artist.external_urls?.spotify || "";
          const random = albums[Math.floor(Math.random() * albums.length)];
          state.album.uri  = random.uri;
          state.album.data = { album: random, artistName: artist.name };
          addToHistory(random, artist.name);
          saveLastAlbum(random, artist.name, state.artist.url);
          ui.showAlbumCard(random, artist.name);
          await app.playAlbum();
          return;
        } catch { continue; }
      }
      ui.showError("Kein passendes Album", "Bitte erneut versuchen.");
    } catch(e) { ui.showError("Fehler", e.message); }
    finally { btn.disabled = false; btn.innerHTML = "🎲 Überrasch mich"; }
  },

  // ── Anderes Album ──────────────────────────────────────────────────────────
  async playAnother() {
    const btn = document.getElementById("anotherBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>Einen Moment…';
    try {
      if (state.artist.id) {
        const albums = filterAlbums(await spotify.fetchAllAlbums(state.artist.id));
        if (!albums.length) { ui.showError("Keine Alben gefunden", "Für diesen Künstler wurden keine passenden Alben gefunden."); return; }
        const random = albums[Math.floor(Math.random() * albums.length)];
        state.album.uri  = random.uri;
        state.album.data = { album: random, artistName: state.artist.name };
        addToHistory(random, state.artist.name);
        saveLastAlbum(random, state.artist.name, state.artist.url);
        ui.showAlbumCard(random, state.artist.name);
        ui.hideError();
        await app.playAlbum();
      } else {
        await app.surpriseMe();
      }
    } catch(e) { ui.showError("Fehler", e.message); }
    finally { btn.disabled = false; btn.innerHTML = "🔀 Anderes Album"; }
  },

  // ── Favoriten würfeln ──────────────────────────────────────────────────────
  async surpriseFavs() {
    const btn = document.getElementById("surpriseFavsBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>Einen Moment…';
    try {
      const favs = getFavorites();
      if (!favs.length) { ui.showError("Keine Favoriten", "Bitte zuerst Künstler hinzufügen."); return; }
      for (let i = 0; i < 20; i++) {
        const fav = favs[Math.floor(Math.random() * favs.length)];
        try {
          const id   = getFavId(fav);
          const name = getFavName(fav);
          let artistId = id, artistName = name, artistUrl = "";
          if (id) {
            const artist = await spotify.getArtist(id);
            artistName = artist.name || name;
            artistUrl  = artist.external_urls?.spotify || "";
          } else {
            const results = await spotify.searchArtists(name);
            const found   = results.find(a => a.name.toLowerCase() === name.toLowerCase()) || results[0];
            if (!found) continue;
            artistId   = found.id;
            artistName = found.name;
            artistUrl  = found.external_urls?.spotify || "";
          }
          const albums = filterAlbums(await spotify.fetchAllAlbums(artistId));
          if (!albums.length) continue;
          state.artist.id   = artistId;
          state.artist.name = artistName;
          state.artist.url  = artistUrl;
          const random = albums[Math.floor(Math.random() * albums.length)];
          state.album.uri  = random.uri;
          state.album.data = { album: random, artistName };
          addToHistory(random, artistName);
          saveLastAlbum(random, artistName, artistUrl);
          ui.showAlbumCard(random, artistName);
          ui.hideError();
          app.switchTab('home', document.querySelector('.tab-btn'));
          await app.playAlbum();
          return;
        } catch { continue; }
      }
      ui.showError("Kein passendes Album", "Bitte erneut versuchen.");
    } catch(e) { ui.showError("Fehler", e.message); }
    finally { btn.disabled = false; btn.innerHTML = "🎲 Favoriten würfeln"; }
  },

  // ── Album des Tages ────────────────────────────────────────────────────────
  async pickAlbumOfDay() {
    const todayKey = getTodayKey();
    const existing = getAlbumOfDay();
    if (existing && existing.date === todayKey) { ui.showAlbumOfDay(existing); return; }
    if (!state.cachedArtists) state.cachedArtists = await spotify.fetchAllFollowedArtists();
    const pool = getArtistPool(state.cachedArtists);
    if (!pool.length) return;
    for (let i = 0; i < 30; i++) {
      const artist = pool[Math.floor(Math.random() * pool.length)];
      try {
        const albums = filterAlbums(await spotify.fetchAllAlbums(artist.id));
        if (!albums.length) continue;
        const album = albums[Math.floor(Math.random() * albums.length)];
        const entry = {
          date: todayKey, uri: album.uri, name: album.name,
          artist: artist.name, artistId: artist.id,
          artistUrl: artist.external_urls?.spotify || "",
          albumUrl:  album.external_urls?.spotify || "",
          cover:     album.images?.[1]?.url || album.images?.[0]?.url || "",
        };
        saveAlbumOfDay(entry);
        ui.showAlbumOfDay(entry);
        return;
      } catch { continue; }
    }
  },

  async playAlbumOfDay() {
    const entry = getAlbumOfDay();
    if (!entry) return;
    state.artist.id   = entry.artistId;
    state.artist.name = entry.artist;
    state.artist.url  = entry.artistUrl;
    state.album.uri   = entry.uri;
    state.album.data  = null;
    document.getElementById("coverArtist").textContent = entry.artist;
    document.getElementById("coverTitle").textContent  = entry.name;
    document.getElementById("coverYear").textContent   = "";
    document.getElementById("albumLink").href = entry.albumUrl || "#";
    const img = document.getElementById("albumCover");
    const ph  = document.getElementById("coverPlaceholder");
    if (entry.cover) { img.src = entry.cover; img.style.display = "block"; ph.style.display = "none"; }
    else              { img.style.display = "none"; ph.style.display = "flex"; }
    document.getElementById("albumCard").classList.add("visible");
    document.getElementById("anotherBtn").classList.add("visible");
    ui.updateCardIcons();
    await app.playAlbum();
  },

  // ── Letztes Album wiederherstellen ─────────────────────────────────────────
  restoreLastAlbum() {
    const a = getLastAlbum();
    if (!a) return;
    if (a.mode && a.mode !== state.appMode) return;
    state.artist.id   = a.artistId || null;
    state.artist.name = a.artist   || null;
    state.artist.url  = a.artistUrl || null;
    state.album.uri   = a.uri;
    state.album.data  = { album: { uri: a.uri, name: a.name, external_urls: { spotify: a.albumUrl }, images: a.cover ? [{ url: a.cover }] : [] }, artistName: a.artist };
    document.getElementById("coverArtist").textContent = a.artist;
    document.getElementById("coverTitle").textContent  = a.name;
    document.getElementById("coverYear").textContent   = a.year;
    document.getElementById("albumLink").href = a.albumUrl || "#";
    const img = document.getElementById("albumCover");
    const ph  = document.getElementById("coverPlaceholder");
    if (a.cover) { img.src = a.cover; img.style.display = "block"; ph.style.display = "none"; }
    else          { img.style.display = "none"; ph.style.display = "flex"; }
    document.getElementById("albumCard").classList.add("visible");
    document.getElementById("anotherBtn").classList.add("visible");
    ui.updateCardIcons();
  },

  // ── Favoriten-Actions ──────────────────────────────────────────────────────
  addCurrentArtistToFavs() {
    if (!state.artist.id || !state.artist.name) return;
    const btn       = document.getElementById("favArtistBtn");
    const targetKey = state.appMode === "hoerspiel" ? "zt_favorites_hoerspiel" : "zt_favorites_musik";
    let favs;
    try { favs = JSON.parse(localStorage.getItem(targetKey) || "[]"); } catch { favs = []; }
    if (favs.length >= FAV_MAX) { ui.showError("Favoriten voll", `Maximal ${FAV_MAX} Künstler erlaubt.`); return; }
    if (favs.find(f => getFavName(f).toLowerCase() === state.artist.name.toLowerCase())) {
      btn.innerHTML = `<i class="ti ti-heart" style="font-size:20px;color:var(--accent);"></i>`;
      setTimeout(() => { btn.innerHTML = `<i class="ti ti-heart" style="font-size:20px;"></i>`; }, 2000);
      return;
    }
    favs.push({ id: state.artist.id, name: state.artist.name });
    localStorage.setItem(targetKey, JSON.stringify(favs));
    ui.renderFavorites();
    btn.innerHTML = `<i class="ti ti-heart" style="font-size:20px;color:var(--accent);"></i>`;
    setTimeout(() => { btn.innerHTML = `<i class="ti ti-heart" style="font-size:20px;"></i>`; }, 2000);
  },

  removeFavorite(name) {
    ui.showModal(name, () => {
      saveFavorites(getFavorites().filter(f => getFavName(f) !== name));
      ui.renderFavorites();
    });
  },

  // ── Bookmark-Actions ───────────────────────────────────────────────────────
  bookmarkCurrent() {
    if (!state.album.data) return;
    addBookmark(state.album.data.album, state.album.data.artistName);
    const btn = document.getElementById("bookmarkBtn");
    btn.innerHTML = `<i class="ti ti-bookmark" style="font-size:20px;color:var(--accent);"></i>`;
    setTimeout(() => { btn.innerHTML = `<i class="ti ti-bookmark" style="font-size:20px;"></i>`; }, 2000);
  },

  removeBookmark(uri) {
    removeBookmark(uri);
    ui.renderBookmarks();
  },

  // ── Blacklist-Actions ──────────────────────────────────────────────────────
  blacklistCurrent() {
    if (!state.artist.id || !state.artist.name) return;
    const btn  = document.getElementById("blacklistBtn");
    const list = getBlacklist();
    if (list.find(b => b.id === state.artist.id)) {
      btn.innerHTML = `<i class="ti ti-ban" style="font-size:20px;"></i>`;
      return;
    }
    list.push({ id: state.artist.id, name: state.artist.name });
    saveBlacklist(list);
    btn.innerHTML = `<i class="ti ti-ban" style="font-size:20px;color:var(--danger);"></i>`;
    setTimeout(() => { btn.innerHTML = `<i class="ti ti-ban" style="font-size:20px;"></i>`; }, 2000);
  },

  removeFromBlacklist(id) {
    saveBlacklist(getBlacklist().filter(b => b.id !== id));
    ui.renderBlacklist();
  },

  // ── Playlist-Actions ───────────────────────────────────────────────────────
  addPlaylist() {
    const linkInput = document.getElementById("playlistLinkInput");
    const nameInput = document.getElementById("playlistNameInput");
    const link = linkInput.value.trim();
    const name = nameInput.value.trim();
    if (!link || !name) { ui.showError("Bitte Link und Name eingeben", ""); return; }
    const match    = link.match(/playlist\/([A-Za-z0-9]+)/) || link.match(/spotify:playlist:([A-Za-z0-9]+)/);
    const id       = match?.[1];
    if (!id) { ui.showError("Ungültiger Playlist-Link", "Spotify-Link oder URI einfügen."); return; }
    const list = getPlaylists();
    if (list.find(p => p.id === id)) { ui.showError("Playlist bereits vorhanden", ""); return; }
    list.push({ id, name, uri: "spotify:playlist:" + id });
    savePlaylists(list);
    linkInput.value = "";
    nameInput.value = "";
    ui.renderPlaylists();
  },

  removePlaylist(id) {
    savePlaylists(getPlaylists().filter(p => p.id !== id));
    ui.renderPlaylists();
  },

  async startPlaylist(uri, name) {
    const deviceId = localStorage.getItem("spotify_device_id");
    const r = await spotify.playPlaylist(uri, deviceId);
    if (r.ok || r.status === 204) {
      ui.hideError();
      state.artist.id   = null;
      state.artist.name = null;
      state.album.uri   = uri;
      state.album.data  = null;
      ui.showPlaylistCard({ name, uri });
      app.switchTab("home", document.querySelector(".tab-btn"));
    } else {
      ui.showError("Wiedergabe fehlgeschlagen", "Spotify öffnen und erneut versuchen.");
    }
  },

  // ── Filter ─────────────────────────────────────────────────────────────────
  saveFilters() {
    const filters = {
      album:       document.getElementById("filterAlbum").checked,
      single:      document.getElementById("filterSingle").checked,
      compilation: document.getElementById("filterCompilation").checked,
      appears_on:  document.getElementById("filterAppearsOn").checked,
    };
    if (!Object.values(filters).some(Boolean)) {
      document.getElementById("filterAlbum").checked = true;
      filters.album = true;
    }
    saveFilters(filters);
  },

  // ── Standardfavoriten ──────────────────────────────────────────────────────
  loadDefaultFavorites() {
    const defaults = state.appMode === "hoerspiel" ? DEFAULT_FAVORITES_HOERSPIEL : DEFAULT_FAVORITES_MUSIK;
    const current  = getFavorites();
    let added = 0;
    for (const d of defaults) {
      const dName = getFavName(d);
      if (!current.find(f => getFavName(f).toLowerCase() === dName.toLowerCase())) {
        current.push(d); added++;
      }
    }
    saveFavorites(current);
    ui.renderFavorites();
    ui.showInfo(added > 0 ? `${added} Künstler hinzugefügt.` : "Alle bereits vorhanden.");
  },

  // ── Init ───────────────────────────────────────────────────────────────────
  async init() {
    ui.applyModeColors();
    ui.updateModeToggle();
    ui.updateModeLabels();

    const params = new URLSearchParams(location.search);
    const code   = params.get("code");

    if (code) {
      const data = await spotify.exchangeCode(code);
      if (data.error) { ui.showError("Anmeldefehler", data.error_description); return; }
      token.set(data.access_token, data.expires_in, data.refresh_token);
      await spotify.getProfile();
      history.replaceState({}, "", "/");
    }

    if (token.get()) {
      ui.showApp();
      app.restoreLastAlbum();
      ui.renderFavorites();
      ui.loadFilters();

      spotify.fetchAllFollowedArtists().then(artists => {
        state.cachedArtists = artists;
        document.getElementById("followedCount").textContent = artists.length;
      }).catch(() => {});

      await app.checkDevice();
      app.pickAlbumOfDay().catch(() => {});
    }

    await spotify.checkTokenExpiry();
    setInterval(() => spotify.checkTokenExpiry(), 60 * 1000);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/zufalltify/sw.js").catch(e => console.warn("SW:", e));
    }

    app.initEvents();
  },

  // ── Event-Listener ─────────────────────────────────────────────────────────
  initEvents() {
    let autocompleteTimer = null;

    document.getElementById("artistInput").addEventListener("input", e => {
      clearTimeout(autocompleteTimer);
      const q = e.target.value.trim();
      if (q.length < 2) { ui.hideDropdown(); return; }
      autocompleteTimer = setTimeout(async () => {
        const artists = await spotify.searchArtists(q);
        ui.showDropdown(artists, artist => {
          document.getElementById("artistInput").value = "";
          app.playArtist(artist.id, artist.name, artist.external_urls?.spotify || "");
        });
      }, 300);
    });

    document.getElementById("artistInput").addEventListener("keydown", e => {
      if (e.key === "Enter")  {
        ui.hideDropdown();
        const q = document.getElementById("artistInput").value.trim();
        if (q) app.playArtist(null, q, null);
      }
      if (e.key === "Escape") ui.hideDropdown();
    });

    document.addEventListener("click", e => {
      if (!e.target.closest(".autocomplete-wrap")) ui.hideDropdown();
    });

    // Sichtbarkeits-Wechsel: Gerät prüfen wenn App in Vordergrund kommt
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        app.checkDevice().catch(() => {});
      }
    });

    // Swipe-Gesten
    const TABS = ["home", "favs", "playlists"];
    let swipeStartX = 0, swipeStartY = 0;
    document.getElementById("appScreen").addEventListener("touchstart", e => {
      swipeStartX = e.touches[0].clientX;
      swipeStartY = e.touches[0].clientY;
    }, { passive: true });
    document.getElementById("appScreen").addEventListener("touchend", e => {
      const dx = e.changedTouches[0].clientX - swipeStartX;
      const dy = e.changedTouches[0].clientY - swipeStartY;
      if (Math.abs(dx) < 50 || Math.abs(dy) > 100) return;
      const btns = Array.from(document.querySelectorAll(".tab-btn"));
      const idx  = btns.indexOf(document.querySelector(".tab-btn.active"));
      if (dx < 0 && idx < TABS.length - 1) app.switchTab(TABS[idx + 1], btns[idx + 1]);
      if (dx > 0 && idx > 0)               app.switchTab(TABS[idx - 1], btns[idx - 1]);
    }, { passive: true });
  },
};

// ── Start ─────────────────────────────────────────────────────────────────────
app.init();
