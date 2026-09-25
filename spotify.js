// ── Spotify API-Schicht ───────────────────────────────────────────────────────
const spotify = {

  // Session-Cache für Alben je Künstler + Filterkombination (leert sich beim Neuladen)
  _albumCache: new Map(),

  // ── Zentrale Request-Schicht ─────────────────────────────────────────────────
  // Alle authentifizierten Spotify-API-Calls laufen hier durch: Auth-Header wird
  // automatisch angehängt, bei 401 wird einmal automatisch refresht + wiederholt,
  // bei 429 wird die von Spotify vorgegebene Zeit (Retry-After) abgewartet und
  // einmal wiederholt, Netzwerkfehler werden zu einer einheitlichen Exception.
  // Gibt die rohe Response zurück, damit Aufrufer wie bisher .json() oder
  // .ok/.status selbst prüfen können (wichtig für die Playback-Endpunkte).
  // 401- und 429-Retry laufen über getrennte Flags, damit z. B. ein 429 direkt
  // nach einem 401-Refresh weiterhin korrekt abgewartet/wiederholt wird.
  async _request(url, options = {}, _retriedAuth = false, _retriedRate = false) {
    const headers = { ...(options.headers || {}), Authorization: "Bearer " + token.get() };
    let r;
    try {
      r = await fetch(url, { ...options, headers });
    } catch (networkErr) {
      throw new Error("Netzwerkfehler: " + (networkErr.message || "Verbindung fehlgeschlagen"));
    }

    if (r.status === 401 && !_retriedAuth) {
      const refreshed = await spotify.refreshToken();
      if (refreshed) return spotify._request(url, options, true, _retriedRate);
      ui.showSessionBanner(true);
      throw new Error("Sitzung abgelaufen");
    }

    if (r.status === 429 && !_retriedRate) {
      const waitSec = Math.min(parseInt(r.headers.get("Retry-After") || "1", 10) || 1, 10);
      await new Promise(res => setTimeout(res, waitSec * 1000));
      return spotify._request(url, options, _retriedAuth, true);
    }

    return r;
  },

  // Wie _request, parst aber direkt JSON und wirft bei verbleibendem Fehlerstatus
  // (nach Refresh-/Rate-Limit-Retry) mit der Spotify-Fehlermeldung, falls vorhanden.
  async _requestJson(url, options = {}) {
    const r = await spotify._request(url, options);
    if (!r.ok) {
      let message = `HTTP ${r.status}`;
      try { const err = await r.json(); message = err?.error?.message || message; } catch {}
      throw new Error(message);
    }
    if (r.status === 204) return null;
    try { return await r.json(); } catch { return null; }
  },

  // ── Auth ───────────────────────────────────────────────────────────────────
  async exchangeCode(code) {
    const r = await fetch(WORKER_URL + "/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: REDIRECT_URI })
    });
    return r.json();
  },

  async refreshToken() {
    const refresh_token = token.getRefresh();
    if (!refresh_token) return false;
    try {
      const r = await fetch(WORKER_URL + "/refresh", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token })
      });
      const data = await r.json();
      if (data.access_token) {
        token.set(data.access_token, data.expires_in, data.refresh_token);
        return true;
      }
      return false;
    } catch { return false; }
  },

  async checkTokenExpiry() {
    const exp = token.getExpiry();
    if (!exp) return;
    const rem = parseInt(exp) - Date.now();
    if (rem < 0) {
      const ok = await spotify.refreshToken();
      ui.showSessionBanner(!ok);
    } else if (rem < 5 * 60 * 1000) {
      await spotify.refreshToken();
    }
  },

  // ── Profil ─────────────────────────────────────────────────────────────────
  async getProfile() {
    return spotify._requestJson("https://api.spotify.com/v1/me");
  },

  // ── Künstler ───────────────────────────────────────────────────────────────
  async getArtist(id) {
    return spotify._requestJson(`https://api.spotify.com/v1/artists/${id}`);
  },

  async searchArtists(query) {
    if (!query.trim()) return [];
    try {
      const d = await spotify._requestJson(
        "https://api.spotify.com/v1/search?q=" + encodeURIComponent(query) + "&type=artist&limit=8&market=DE"
      );
      return d?.artists?.items || [];
    } catch { return []; }
  },

  async fetchAllFollowedArtists() {
    try {
      const cached = JSON.parse(localStorage.getItem("zt_followed_cache") || "null");
      if (cached && cached.date === getTodayKey() && cached.artists?.length) return cached.artists;
    } catch {}
    let all = [], after = null;
    while (true) {
      let url = "https://api.spotify.com/v1/me/following?type=artist&limit=50";
      if (after) url += "&after=" + encodeURIComponent(after);
      const d = await spotify._requestJson(url);
      all.push(...(d?.artists?.items || []));
      if (!d?.artists?.cursors?.after) break;
      after = d.artists.cursors.after;
    }
    const slim = all.map(a => ({ id: a.id, name: a.name, external_urls: a.external_urls }));
    try { localStorage.setItem("zt_followed_cache", JSON.stringify({ date: getTodayKey(), artists: slim })); } catch {}
    return slim;
  },

  // ── Bibliothek (gespeicherte Alben) ───────────────────────────────────────────
  async fetchAllSavedAlbums() {
    try {
      const cached = JSON.parse(localStorage.getItem("zt_saved_albums_cache") || "null");
      if (cached && cached.date === getTodayKey() && cached.albums?.length) return cached.albums;
    } catch {}
    let all = [], url = "https://api.spotify.com/v1/me/albums?limit=50";
    while (url) {
      const d = await spotify._requestJson(url);
      all.push(...(d?.items || []));
      url = d?.next || null;
    }
    const slim = all.map(item => {
      const a = item.album || {};
      return {
        uri: a.uri, name: a.name, release_date: a.release_date,
        images: a.images, external_urls: a.external_urls,
        artists: (a.artists || []).map(ar => ({ id: ar.id, name: ar.name, external_urls: ar.external_urls }))
      };
    });
    try { localStorage.setItem("zt_saved_albums_cache", JSON.stringify({ date: getTodayKey(), albums: slim })); } catch {}
    return slim;
  },

  // ── Alben ──────────────────────────────────────────────────────────────────
  // Bewusst nur die erste Seite (50 Alben) – für eine Zufallsauswahl ausreichend
  // und reduziert die Requests pro Versuch von potenziell mehreren auf genau einen.
  async fetchArtistAlbums(artistId) {
    const cacheKey = artistId + "|" + getIncludeGroups();
    if (spotify._albumCache.has(cacheKey)) return spotify._albumCache.get(cacheKey);
    const url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=${getIncludeGroups()}&market=DE&limit=50`;
    const d = await spotify._requestJson(url);
    const albums = d?.items || [];
    spotify._albumCache.set(cacheKey, albums);
    return albums;
  },

  // ── Top-Tracks ─────────────────────────────────────────────────────────────
  async getTopTracks(artistId) {
    const d = await spotify._requestJson(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=DE`);
    return d?.tracks || [];
  },

  // ── Künstler folgen ────────────────────────────────────────────────────────
  async followArtist(id) {
    return spotify._request(`https://api.spotify.com/v1/me/following?type=artist&ids=${encodeURIComponent(id)}`, { method: "PUT" });
  },
  async unfollowArtist(id) {
    return spotify._request(`https://api.spotify.com/v1/me/following?type=artist&ids=${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  // ── Album in Bibliothek speichern ─────────────────────────────────────────
  async saveAlbum(id) {
    return spotify._request(`https://api.spotify.com/v1/me/albums?ids=${encodeURIComponent(id)}`, { method: "PUT" });
  },
  async removeAlbum(id) {
    return spotify._request(`https://api.spotify.com/v1/me/albums?ids=${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  // ── Wiedergabe ─────────────────────────────────────────────────────────────
  async getDevices() {
    const d = await spotify._requestJson("https://api.spotify.com/v1/me/player/devices");
    return d?.devices || [];
  },

  async play(uri, deviceId) {
    let url = "https://api.spotify.com/v1/me/player/play";
    if (deviceId) url += "?device_id=" + encodeURIComponent(deviceId);
    return spotify._request(url, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ context_uri: uri })
    });
  },

  async playTracks(uris, deviceId) {
    let url = "https://api.spotify.com/v1/me/player/play";
    if (deviceId) url += "?device_id=" + encodeURIComponent(deviceId);
    return spotify._request(url, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ uris })
    });
  },

  async setShuffle(state, deviceId) {
    const suffix = deviceId ? "&device_id=" + encodeURIComponent(deviceId) : "";
    return spotify._request(`https://api.spotify.com/v1/me/player/shuffle?state=${state}${suffix}`, { method: "PUT" });
  },

  async setRepeat(state, deviceId) {
    const suffix = deviceId ? "&device_id=" + encodeURIComponent(deviceId) : "";
    return spotify._request(`https://api.spotify.com/v1/me/player/repeat?state=${state}${suffix}`, { method: "PUT" });
  },

  async disableShuffleAndRepeat() {
    const deviceId = localStorage.getItem("spotify_device_id");
    try {
      await Promise.all([
        spotify.setShuffle(false, deviceId),
        spotify.setRepeat("off", deviceId)
      ]);
    } catch {}
  },

  // ── Playlisten ─────────────────────────────────────────────────────────────
  async playPlaylist(uri, deviceId) {
    const deviceQuery = deviceId ? encodeURIComponent(deviceId) : "";
    // Shuffle setzen, dann warten, dann abspielen
    try {
      await spotify._request("https://api.spotify.com/v1/me/player/shuffle?state=true" + (deviceId ? "&device_id=" + deviceQuery : ""), { method: "PUT" });
    } catch {}
    await new Promise(res => setTimeout(res, 1200));
    let url = "https://api.spotify.com/v1/me/player/play";
    if (deviceId) url += "?device_id=" + deviceQuery;
    return spotify._request(url, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ context_uri: uri })
    });
  },
};
