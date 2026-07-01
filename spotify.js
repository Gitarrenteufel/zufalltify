// ── Spotify API-Schicht ───────────────────────────────────────────────────────
const spotify = {

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
    const r = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + token.get() }
    });
    return r.json();
  },

  // ── Künstler ───────────────────────────────────────────────────────────────
  async getArtist(id) {
    const r = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
      headers: { Authorization: "Bearer " + token.get() }
    });
    return r.json();
  },

  async searchArtists(query) {
    if (!query.trim()) return [];
    try {
      const r = await fetch(
        "https://api.spotify.com/v1/search?q=" + encodeURIComponent(query) + "&type=artist&limit=8&market=DE",
        { headers: { Authorization: "Bearer " + token.get() } }
      );
      const d = await r.json();
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
      const r = await fetch(url, { headers: { Authorization: "Bearer " + token.get() } });
      const d = await r.json();
      all.push(...(d?.artists?.items || []));
      if (!d?.artists?.cursors?.after) break;
      after = d.artists.cursors.after;
    }
    const slim = all.map(a => ({ id: a.id, name: a.name, external_urls: a.external_urls }));
    try { localStorage.setItem("zt_followed_cache", JSON.stringify({ date: getTodayKey(), artists: slim })); } catch {}
    return slim;
  },

  // ── Alben ──────────────────────────────────────────────────────────────────
  async fetchAllAlbums(artistId) {
    let all = [];
    let url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=${getIncludeGroups()}&market=DE&limit=50`;
    while (url) {
      const r = await fetch(url, { headers: { Authorization: "Bearer " + token.get() } });
      const d = await r.json();
      all.push(...(d.items || []));
      url = d.next || null;
    }
    return all;
  },

  // ── Wiedergabe ─────────────────────────────────────────────────────────────
  async getDevices() {
    const r = await fetch("https://api.spotify.com/v1/me/player/devices", {
      headers: { Authorization: "Bearer " + token.get() }
    });
    const d = await r.json();
    return d.devices || [];
  },

  async play(uri, deviceId) {
    let url = "https://api.spotify.com/v1/me/player/play";
    if (deviceId) url += "?device_id=" + encodeURIComponent(deviceId);
    return fetch(url, {
      method:  "PUT",
      headers: { Authorization: "Bearer " + token.get(), "Content-Type": "application/json" },
      body:    JSON.stringify({ context_uri: uri })
    });
  },

  async setShuffle(state, deviceId) {
    const suffix = deviceId ? "&device_id=" + encodeURIComponent(deviceId) : "";
    return fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${state}${suffix}`, {
      method: "PUT", headers: { Authorization: "Bearer " + token.get() }
    });
  },

  async setRepeat(state, deviceId) {
    const suffix = deviceId ? "&device_id=" + encodeURIComponent(deviceId) : "";
    return fetch(`https://api.spotify.com/v1/me/player/repeat?state=${state}${suffix}`, {
      method: "PUT", headers: { Authorization: "Bearer " + token.get() }
    });
  },

  async disableShuffleAndRepeat() {
    const deviceId = localStorage.getItem("spotify_device_id");
    const suffix   = deviceId ? "&device_id=" + encodeURIComponent(deviceId) : "";
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
      await fetch("https://api.spotify.com/v1/me/player/shuffle?state=true" + (deviceId ? "&device_id=" + deviceQuery : ""), {
        method: "PUT", headers: { Authorization: "Bearer " + token.get() }
      });
    } catch {}
    await new Promise(res => setTimeout(res, 1200));
    let url = "https://api.spotify.com/v1/me/player/play";
    if (deviceId) url += "?device_id=" + deviceQuery;
    return fetch(url, {
      method:  "PUT",
      headers: { Authorization: "Bearer " + token.get(), "Content-Type": "application/json" },
      body:    JSON.stringify({ context_uri: uri })
    });
  },
};
