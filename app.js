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
    if (document.getElementById("page-more").classList.contains("active")) {
      const activeSection = document.querySelector(".mehr-section.active");
      if (activeSection?.id === "mehrSection-bookmarks") ui.renderBookmarks();
      if (activeSection?.id === "mehrSection-blacklist") ui.renderBlacklist();
    }
    if (document.getElementById("page-playlists").classList.contains("active")) ui.renderPlaylists();
    if (document.getElementById("albumCard").classList.contains("visible"))     ui.updateCardIcons();
  },

  // ── Home-Quelle (Künstler/Alben-Bibliothek) ───────────────────────────────────
  // Betrifft nur "Überrasch mich" — Album des Tages bleibt bewusst EIN fester
  // Tagespick (die Quelle, aus der es kam, wird beim Umschalten nicht rückwirkend
  // geändert), sonst fühlt sich der Wechsel nachträglich unstimmig an.
  setHomeSource(src) {
    saveHomeSource(src);
    ui.updateHomeSourceToggle();
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
    if (name === 'favs')       ui.renderFavorites();
    if (name === 'playlists')  ui.renderPlaylists();
    // "Mehr" landet immer auf dem ersten Unterpunkt (Verlauf) — kein gemerkter
    // Zustand zwischen Tab-Wechseln, bewusst flach (kein Zurück-Button-Bedarf).
    if (name === 'more') {
      document.querySelectorAll('.mehr-toggle-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
      document.querySelectorAll('.mehr-section').forEach((s, i) => s.classList.toggle('active', i === 0));
      ui.renderHistory();
    }
  },

  // "Mehr"-Unterbereich wechseln: reines Ein-/Ausblenden, kein Navigations-
  // Stack, kein History-Eintrag nötig — Android-Zurück verlässt wie jeder
  // andere Tab auch einfach die App.
  setMehrSection(name, btn) {
    document.querySelectorAll('.mehr-toggle-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mehr-section').forEach(s => s.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('mehrSection-' + name).classList.add('active');
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
    let devices = [];
    try { devices = await spotify.getDevices(); } catch {}
    const list    = document.getElementById("deviceList");
    list.innerHTML = "";
    if (!devices.length) {
      list.innerHTML = '<p style="color:var(--warn);font-size:13px">Keine Geräte gefunden – Spotify öffnen und erneut versuchen.</p>';
    } else {
      devices.forEach(d => {
        const btn = document.createElement("button");
        btn.className = "device-btn";
        btn.textContent = d.name;
        const type = document.createElement("span");
        type.className   = "device-type";
        type.textContent = `(${d.type})`;
        btn.appendChild(type);
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

  // ── Gemeinsame Bausteine für Album-Auswahl & Wiedergabe ─────────────────────
  // Diese drei Helfer fassen die Logik zusammen, die zuvor fast identisch in
  // playArtist/surpriseMe/playAnother/pickAlbumOfDay stand.

  // Künstler per Name auflösen (Fallback, wenn nur ein Name statt einer ID vorliegt)
  async resolveArtistByName(name) {
    const results = await spotify.searchArtists(name);
    return results.find(a => a.name.toLowerCase() === name.toLowerCase()) || results[0] || null;
  },

  // Zufälliges Album eines Künstlers wählen. Berücksichtigt das Bekannt-leer-
  // Gedächtnis, markiert neu erkannte leere Künstler. Gibt null zurück, wenn
  // keine passenden Alben existieren; wirft bei echten API-Fehlern (Aufrufer
  // entscheidet, ob das per try/catch pro Versuch oder pro Aufruf behandelt wird).
  async pickRandomAlbum(artistId) {
    const filterKey = getIncludeGroups();
    if (isKnownEmptyArtist(artistId, filterKey)) return null;
    const albums = filterAlbums(await spotify.fetchArtistAlbums(artistId));
    if (!albums.length) { markArtistEmpty(artistId, filterKey); return null; }
    return albums[Math.floor(Math.random() * albums.length)];
  },

  // Gewähltes Album als aktuelle Auswahl übernehmen: State setzen, Verlauf und
  // "letztes Album" speichern, Karte anzeigen, danach abspielen.
  async selectAndPlayAlbum(album, artistId, artistName, artistUrl) {
    state.artist.id   = artistId;
    state.artist.name = artistName;
    state.artist.url  = artistUrl;
    state.album.uri   = album.uri;
    state.album.data  = { album, artistName };
    addToHistory(album, artistName);
    saveLastAlbum(album, artistName, artistUrl);
    ui.showAlbumCard(album, artistName);
    ui.hideError();
    await app.playAlbum();
  },

  // ── Wiedergabe ─────────────────────────────────────────────────────────────
  // ── Automatisch zu Spotify wechseln (optionale Einstellung) ─────────────────
  // Startet nach erfolgreicher Wiedergabe einen 5s-Timer; jede Interaktion in
  // der App währenddessen bricht ihn ab. Läuft er ab, wird Spotify per
  // AndroidBridge in den Vordergrund geholt (ohne Bridge, z. B. im Browser, passiert nichts).
  _autoForegroundTimer: null,
  _autoForegroundHandler: null,
  scheduleAutoForeground() {
    if (!getAutoForegroundSpotify()) return;
    if (typeof AndroidBridge === "undefined") return;
    app.cancelAutoForeground();
    app._autoForegroundHandler = () => app.cancelAutoForeground();
    document.addEventListener("click", app._autoForegroundHandler, { once: true });
    document.addEventListener("touchstart", app._autoForegroundHandler, { once: true, passive: true });
    app._autoForegroundTimer = setTimeout(() => {
      app.cancelAutoForeground();
      AndroidBridge.openSpotify();
    }, 5000);
  },
  cancelAutoForeground() {
    if (app._autoForegroundTimer) { clearTimeout(app._autoForegroundTimer); app._autoForegroundTimer = null; }
    if (app._autoForegroundHandler) {
      document.removeEventListener("click", app._autoForegroundHandler);
      document.removeEventListener("touchstart", app._autoForegroundHandler);
      app._autoForegroundHandler = null;
    }
  },

  saveAutoForegroundSetting() {
    const checked = document.getElementById("autoForegroundToggle").checked;
    saveAutoForegroundSpotify(checked);
  },

  // Gemeinsame Wiedergabe-Ausführung mit Geräte-Retry. playFn(deviceId) muss die
  // rohe Response zurückgeben (spotify.play/playTracks/playPlaylist). Stellt ein
  // Gerät sicher, versucht bei 404/403 (Gerät nicht erreichbar) einmal erneut
  // nach einem Gerät zu suchen und zu wiederholen, zeigt Fehler einheitlich an.
  // Gibt true bei Erfolg zurück, sonst false.
  async playWithDeviceRetry(playFn) {
    let deviceId = localStorage.getItem("spotify_device_id");
    if (!deviceId) {
      const found = await app.waitForDevice(3, 1000);
      if (!found) { ui.showError("Kein Gerät verbunden", "Spotify öffnen und erneut versuchen."); return false; }
      deviceId = localStorage.getItem("spotify_device_id");
    }

    try {
      const r = await playFn(deviceId);
      if (r.ok || r.status === 204) { ui.hideError(); app.scheduleAutoForeground(); return true; }

      if (r.status === 404 || r.status === 403) {
        const found = await app.waitForDevice(2, 1500);
        if (found) {
          deviceId = localStorage.getItem("spotify_device_id");
          const r2 = await playFn(deviceId);
          if (r2.ok || r2.status === 204) { ui.hideError(); app.scheduleAutoForeground(); return true; }
        }
        ui.showError("Kein Gerät verbunden", "Spotify öffnen und erneut versuchen.");
      } else {
        const data = await r.json().catch(() => ({}));
        ui.showError("Wiedergabe fehlgeschlagen", data?.error?.message || "Unbekannter Fehler");
      }
    } catch (e) {
      ui.showError("Wiedergabe fehlgeschlagen", e.message);
    }
    return false;
  },

  async playAlbum() {
    const exp = token.getExpiry();
    if (exp && parseInt(exp) - Date.now() < 0) {
      const ok = await spotify.refreshToken();
      if (!ok) { ui.showSessionBanner(true); return; }
    }
    if (!state.album.uri) return;

    await app.playWithDeviceRetry(async (deviceId) => {
      await spotify.disableShuffleAndRepeat();
      return spotify.play(state.album.uri, deviceId);
    });
  },

  // ── Beliebteste Songs ──────────────────────────────────────────────────────
  async playTopTracks(artistId, artistName, artistUrl) {
    ui.hideError();
    if (!artistId) {
      if (!artistName) return;
      const found = await app.resolveArtistByName(artistName);
      if (!found) { ui.showError("Künstler nicht gefunden", "Bitte Schreibweise prüfen."); return; }
      artistId   = found.id;
      artistName = found.name;
      artistUrl  = found.external_urls?.spotify || "";
    }

    let tracks;
    try { tracks = await spotify.getTopTracks(artistId); }
    catch { ui.showError("Fehler", "Top-Songs konnten nicht geladen werden."); return; }
    if (!tracks.length) {
      ui.showError("Keine Songs gefunden", "Für diesen Künstler wurden keine Top-Songs gefunden.");
      return;
    }

    state.artist.id   = artistId;
    state.artist.name = artistName;
    state.artist.url  = artistUrl;
    state.album.uri   = null;
    state.album.data  = null;

    ui.showTopTracksCard(tracks, artistName);
    app.switchTab("home", document.querySelector(".tab-btn"));

    await app.playWithDeviceRetry(async (deviceId) => {
      await spotify.disableShuffleAndRepeat();
      return spotify.playTracks(tracks.map(t => t.uri), deviceId);
    });
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
      const found = await app.resolveArtistByName(artistName);
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

    let random;
    try {
      random = await app.pickRandomAlbum(artistId);
    } catch (e) {
      ui.showError("Fehler beim Laden", e.message);
      return;
    }
    if (!random) {
      ui.showError("Keine Alben gefunden", "Für diesen Künstler wurden keine passenden Alben gefunden.");
      return;
    }

    await app.selectAndPlayAlbum(random, artistId, artistName, artistUrl);
  },

  // ── Surprise Me ────────────────────────────────────────────────────────────
  // "Überrasch mich": im Musik-Modus je nach Home-Umschalter aus gefolgten
  // Künstlern oder direkt aus der Alben-Bibliothek; im Hörspiel-Modus immer
  // aus den Hörspiel-Favoriten (kein Umschalter dort).
  async surprise() {
    const btn = document.getElementById("surpriseBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>Einen Moment…';
    ui.hideError();
    try {
      if (state.appMode === "musik" && getHomeSource() === "alben") {
        await app.surpriseFromAlbumLibrary();
      } else {
        await app.surpriseFromArtists();
      }
    } catch (e) {
      ui.showError("Fehler", e.message);
    } finally {
      btn.disabled = false; btn.innerHTML = "🎲 Überrasch mich";
    }
  },

  async surpriseFromArtists() {
    if (!state.cachedArtists) state.cachedArtists = await spotify.fetchAllFollowedArtists();
    const pool = getArtistPool(state.cachedArtists);
    if (!pool.length) {
      ui.showError(
        state.appMode === "hoerspiel" ? "Keine Hörspiel-Künstler gefunden" : "Keine gefolgten Künstler",
        state.appMode === "hoerspiel" ? "Hörspiel-Favoriten sind leer."   : "Bitte Künstler auf Spotify folgen."
      );
      return;
    }
    const filterKey = getIncludeGroups();
    const candidates = pool.filter(a => !isKnownEmptyArtist(a.id, filterKey));
    const searchPool = candidates.length ? candidates : pool;
    for (let i = 0; i < 30; i++) {
      const artist = searchPool[Math.floor(Math.random() * searchPool.length)];
      try {
        const random = await app.pickRandomAlbum(artist.id);
        if (!random) continue;
        await app.selectAndPlayAlbum(random, artist.id, artist.name, artist.external_urls?.spotify || "");
        return;
      } catch { continue; }
    }
    ui.showError("Kein passendes Album", "Bitte erneut versuchen.");
  },

  async surpriseFromAlbumLibrary() {
    if (!state.cachedSavedAlbums) state.cachedSavedAlbums = await spotify.fetchAllSavedAlbums();
    const pool = getAlbumPool(state.cachedSavedAlbums);
    if (!pool.length) {
      ui.showError("Keine Alben in der Bibliothek", "Speichere zuerst Alben in deiner Spotify-Bibliothek.");
      return;
    }
    const album = pool[Math.floor(Math.random() * pool.length)];
    const artistName = album.artists?.[0]?.name || "";
    const artistId    = album.artists?.[0]?.id || null;
    const artistUrl   = album.artists?.[0]?.external_urls?.spotify || "";
    await app.selectAndPlayAlbum(album, artistId, artistName, artistUrl);
  },

  // ── Anderes Album ──────────────────────────────────────────────────────────
  async playAnother() {
    const btn = document.getElementById("anotherBtn");
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>Einen Moment…';
    try {
      if (state.artist.id) {
        const random = await app.pickRandomAlbum(state.artist.id);
        if (!random) {
          ui.showError("Keine Alben gefunden", "Für diesen Künstler wurden keine passenden Alben gefunden.");
          return;
        }
        await app.selectAndPlayAlbum(random, state.artist.id, state.artist.name, state.artist.url);
      } else {
        await app.surprise();
      }
    } catch(e) { ui.showError("Fehler", e.message); }
    finally { btn.disabled = false; btn.innerHTML = "🔀 Anderes Album"; }
  },

  // (surpriseFavs entfernt — Favoriten-Tab ist jetzt eine reine Anzeige/Auswahl-
  // liste ohne eigenen Zufallspool; "Überrasch mich" deckt das ab.)

  // ── Album des Tages ────────────────────────────────────────────────────────
  // Folgt derselben Quelle wie der Home-Umschalter (eigener Tages-Eintrag pro
  // Quelle, siehe aodKey() in state.js — kein Vermischen von Künstler-/Bibliothek-Pick).
  async pickAlbumOfDay() {
    const todayKey = getTodayKey();
    const existing = getAlbumOfDay();
    if (existing && existing.date === todayKey) { ui.showAlbumOfDay(existing); return; }
    if (state.appMode === "musik" && getHomeSource() === "alben") {
      await app.pickAlbumOfDayFromLibrary(todayKey);
    } else {
      await app.pickAlbumOfDayFromArtists(todayKey);
    }
  },

  async pickAlbumOfDayFromArtists(todayKey) {
    if (!state.cachedArtists) state.cachedArtists = await spotify.fetchAllFollowedArtists();
    const pool = getArtistPool(state.cachedArtists);
    if (!pool.length) return;
    const filterKey = getIncludeGroups();
    const candidates = pool.filter(a => !isKnownEmptyArtist(a.id, filterKey));
    const searchPool = candidates.length ? candidates : pool;
    for (let i = 0; i < 30; i++) {
      const artist = searchPool[Math.floor(Math.random() * searchPool.length)];
      try {
        const album = await app.pickRandomAlbum(artist.id);
        if (!album) continue;
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

  async pickAlbumOfDayFromLibrary(todayKey) {
    try {
      if (!state.cachedSavedAlbums) state.cachedSavedAlbums = await spotify.fetchAllSavedAlbums();
      const pool = getAlbumPool(state.cachedSavedAlbums);
      if (!pool.length) return;
      const album = pool[Math.floor(Math.random() * pool.length)];
      const entry = {
        date: todayKey, uri: album.uri, name: album.name,
        artist: album.artists?.[0]?.name || "", artistId: album.artists?.[0]?.id || null,
        artistUrl: album.artists?.[0]?.external_urls?.spotify || "",
        albumUrl:  album.external_urls?.spotify || "",
        cover:     album.images?.[1]?.url || album.images?.[0]?.url || "",
      };
      saveAlbumOfDay(entry);
      ui.showAlbumOfDay(entry);
    } catch {}
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
    document.getElementById("albumLink").href = safeUrl(entry.albumUrl) || "#";
    const img = document.getElementById("albumCover");
    const ph  = document.getElementById("coverPlaceholder");
    const cover = safeUrl(entry.cover);
    if (cover) { img.src = cover; img.style.display = "block"; ph.style.display = "none"; }
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
    document.getElementById("albumLink").href = safeUrl(a.albumUrl) || "#";
    const img = document.getElementById("albumCover");
    const ph  = document.getElementById("coverPlaceholder");
    const cover = safeUrl(a.cover);
    if (cover) { img.src = cover; img.style.display = "block"; ph.style.display = "none"; }
    else          { img.style.display = "none"; ph.style.display = "flex"; }
    document.getElementById("albumCard").classList.add("visible");
    document.getElementById("anotherBtn").classList.add("visible");
    ui.updateCardIcons();
  },

  // ── Favoriten-Actions ──────────────────────────────────────────────────────
  // Echter Umschalter: Tap fügt hinzu, erneuter Tap entfernt wieder. Das Icon
  // zeigt danach immer den tatsächlichen Favoriten-Status (über updateCardIcons),
  // statt sich nach einer festen Zeit unabhängig vom echten Zustand zurückzusetzen.
  addCurrentArtistToFavs() {
    if (!state.artist.id || !state.artist.name) return;
    const targetKey = state.appMode === "hoerspiel" ? "zt_favorites_hoerspiel" : "zt_favorites_musik";
    let favs;
    try { favs = JSON.parse(localStorage.getItem(targetKey) || "[]"); } catch { favs = []; }
    const already = favs.find(f => getFavName(f).toLowerCase() === state.artist.name.toLowerCase());
    if (already) {
      favs = favs.filter(f => f !== already);
    } else {
      favs.push({ id: state.artist.id, name: state.artist.name });
    }
    localStorage.setItem(targetKey, JSON.stringify(favs));
    ui.renderFavorites();
    ui.updateCardIcons();
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
    const played = await app.playWithDeviceRetry(deviceId => spotify.playPlaylist(uri, deviceId));
    if (played) {
      state.artist.id   = null;
      state.artist.name = null;
      state.album.uri   = uri;
      state.album.data  = null;
      ui.showPlaylistCard({ name, uri });
      app.switchTab("home", document.querySelector(".tab-btn"));
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
  // Nutzt einen selbst gesicherten Snapshot, falls vorhanden, sonst die fest im
  // Code hinterlegten Standardnamen. Rein additiv — nichts wird entfernt/überschrieben.
  loadDefaultFavorites() {
    const custom   = getCustomDefaultFavorites();
    const defaults = custom || (state.appMode === "hoerspiel" ? DEFAULT_FAVORITES_HOERSPIEL : DEFAULT_FAVORITES_MUSIK);
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

  // Sichert die aktuelle Favoritenliste (des aktiven Modus) als neuen Standard-
  // Snapshot — verändert die laufende Liste selbst nicht, nur den Snapshot.
  saveDefaultFavorites() {
    saveCustomDefaultFavorites(getFavorites());
    ui.showInfo("Standardfavoriten aktualisiert.");
  },

  // ── Init ───────────────────────────────────────────────────────────────────
  async init() {
    ui.applyModeColors();
    ui.updateModeToggle();
    ui.updateModeLabels();

    const params = new URLSearchParams(location.search);
    const code   = params.get("code");

    if (code) {
      try {
        const data = await spotify.exchangeCode(code);
        if (data.error) {
          ui.showError("Anmeldefehler", data.error_description);
        } else {
          token.set(data.access_token, data.expires_in, data.refresh_token);
          await spotify.getProfile();
        }
      } catch (e) {
        ui.showError("Anmeldefehler", e.message || "Verbindung zu Spotify fehlgeschlagen.");
      } finally {
        history.replaceState({}, "", "/");
      }
    }

    // Ab hier läuft alles in try/catch, damit ein Fehler (z. B. beim initialen
    // Geräte-/Bibliothek-Abruf) nie verhindert, dass app.initEvents() weiter
    // unten noch erreicht wird — sonst bleiben Suche und Wischgesten tot.
    try {
      if (token.get()) {
        ui.showApp();
        app.restoreLastAlbum();
        ui.renderFavorites();
        ui.loadFilters();
        ui.loadAutoForegroundSetting();

        spotify.fetchAllFollowedArtists().then(artists => {
          state.cachedArtists = artists;
          const el = document.getElementById("followedCount");
          if (el) el.textContent = artists.length;
          if (document.getElementById("page-favs").classList.contains("active")) ui.renderFavorites();
        }).catch(() => {});

        spotify.fetchAllSavedAlbums().then(albums => {
          state.cachedSavedAlbums = albums;
          const el = document.getElementById("savedAlbumsCount");
          if (el) el.textContent = albums.length;
        }).catch(() => {});

        await app.checkDevice();
        app.pickAlbumOfDay().catch(() => {});
      }

      await spotify.checkTokenExpiry();
    } catch (e) {
      console.error("init:", e);
    }
    setInterval(() => spotify.checkTokenExpiry(), 60 * 1000);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/zufalltify/sw.js").catch(e => console.warn("SW:", e));
    }

    window.addEventListener("popstate", app.handlePopState);

    app.initEvents();
  },

  // ── Long-Press-Helfer ──────────────────────────────────────────────────────
  // Bindet Tap (kurzer Klick/Touch) und Long-Press (gehalten) an ein Element.
  // Scroll-Gesten (Finger bewegt sich) zählen weder als Tap noch als Long-Press.
  attachLongPress(el, { onTap, onLongPress, duration = 500, moveTolerance = 10 }) {
    let timer = null;
    let fired = false;
    let moved = false;
    let startX = 0, startY = 0;
    const start = (e) => {
      fired = false;
      moved = false;
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX;
      startY = t.clientY;
      timer = setTimeout(() => { fired = true; onLongPress(); }, duration);
    };
    const move = (e) => {
      const t = e.touches ? e.touches[0] : e;
      if (Math.abs(t.clientX - startX) > moveTolerance || Math.abs(t.clientY - startY) > moveTolerance) {
        moved = true;
        clearTimeout(timer);
      }
    };
    const cancel = () => { clearTimeout(timer); };
    const end = (e) => {
      clearTimeout(timer);
      if (!fired && !moved) { if (e) e.preventDefault(); if (onTap) onTap(); }
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", cancel);
    el.addEventListener("mousedown", start);
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseup", end);
    el.addEventListener("mouseleave", cancel);
  },

  // ── Zurück-Button-Unterstützung für Overlays (Modals) ───────────────────────
  // Jedes geöffnete Overlay legt einen History-Eintrag an. Der Android-Zurück-
  // Button löst dadurch ein popstate aus, das wir abfangen und in ein Schließen
  // des obersten Overlays übersetzen — statt dass die App beendet wird. Der
  // "Mehr"-Tab braucht das bewusst NICHT (flacher Umschalter, kein Sub-Stack).
  _overlayStack: [],
  _suppressPop: false,

  pushOverlayState(name) {
    app._overlayStack.push(name);
    history.pushState({ ztOverlay: name }, "");
  },
  // Wird aufgerufen, wenn ein Overlay über die UI (nicht über den Zurück-Button)
  // geschlossen wird — konsumiert den zugehörigen History-Eintrag wieder.
  popOverlayIfMatches(name) {
    const stack = app._overlayStack;
    if (stack.length && stack[stack.length - 1] === name) {
      stack.pop();
      app._suppressPop = true;
      history.back();
    }
  },
  handlePopState() {
    if (app._suppressPop) { app._suppressPop = false; return; }
    const top = app._overlayStack.pop();
    if (top === "modal")               ui.closeModal(true);
    else if (top === "playbackChoice") ui.closePlaybackChoice(true);
  },

  // ── Event-Listener ─────────────────────────────────────────────────────────
  initEvents() {
    let autocompleteTimer = null;

    // Natives Android-Kontextmenü (Markieren/Kopieren/Web-Suche) unterdrücken —
    // das reagiert auf das contextmenu-Event unabhängig von CSS user-select und
    // würde sonst mit dem eigenen Long-Press (Wiedergabe-Wahl) kollidieren.
    document.addEventListener("contextmenu", e => e.preventDefault());

    document.getElementById("artistInput").addEventListener("input", e => {
      clearTimeout(autocompleteTimer);
      const q = e.target.value.trim();
      if (q.length < 2) { ui.hideDropdown(); return; }
      autocompleteTimer = setTimeout(async () => {
        const artists = await spotify.searchArtists(q);
        ui.showDropdown(artists, artist => {
          document.getElementById("artistInput").value = "";
          app.playArtist(artist.id, artist.name, artist.external_urls?.spotify || "");
        }, state.appMode === "hoerspiel" ? null : artist => {
          document.getElementById("artistInput").value = "";
          ui.showPlaybackChoice(artist.name,
            () => app.playArtist(artist.id, artist.name, artist.external_urls?.spotify || ""),
            () => app.playTopTracks(artist.id, artist.name, artist.external_urls?.spotify || ""));
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
    const TABS = ["home", "favs", "playlists", "more"];
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
