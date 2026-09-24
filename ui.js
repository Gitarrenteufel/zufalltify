// ── HTML-Escaping für dynamische Werte in innerHTML-Templates ──────────────────
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ── URL-Schema-Prüfung für dynamisch gesetzte href/src ──────────────────────────
// Lässt nur http(s) durch — verhindert, dass z. B. ein "javascript:"-Schema aus
// (aktuell vertrauenswürdigen) Spotify-Daten als Link- oder Bildquelle landet.
function safeUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url, location.href);
    return (u.protocol === "https:" || u.protocol === "http:") ? url : "";
  } catch { return ""; }
}

// ── UI-Schicht ────────────────────────────────────────────────────────────────
const ui = {

  // ── Fehler ─────────────────────────────────────────────────────────────────
  showError(title, msg = "") {
    document.getElementById("errorTitle").textContent = title;
    document.getElementById("errorMsg").textContent   = msg;
    document.getElementById("errorCard").classList.add("visible");
  },
  hideError() {
    document.getElementById("errorCard").classList.remove("visible");
  },
  showSessionBanner(visible) {
    document.getElementById("sessionBanner").style.display = visible ? "block" : "none";
  },
  showInfo(msg) {
    ui.showError(msg, "");
    setTimeout(() => ui.hideError(), 2500);
  },

  // ── Modus ──────────────────────────────────────────────────────────────────
  applyModeColors() {
    const c = MODE_COLORS[state.appMode];
    document.documentElement.style.setProperty("--accent",      c.accent);
    document.documentElement.style.setProperty("--accent-hi",   c.accentHi);
    document.documentElement.style.setProperty("--accent-dark", c.accentDark);
  },
  updateModeToggle() {
    document.getElementById("btnMusik").classList.toggle("active",     state.appMode === "musik");
    document.getElementById("btnHoerspiel").classList.toggle("active", state.appMode === "hoerspiel");
  },
  updateModeLabels() {
    const h = state.appMode === "hoerspiel";
    document.getElementById("aodLabel").textContent    = h ? "🎧 Hörspiel des Tages" : "🌅 Album des Tages";
    document.getElementById("favTabTitle").textContent = h ? "Hörspiel-Favoriten"    : "Musik-Favoriten";
  },

  // ── Album-Karte ────────────────────────────────────────────────────────────
  showAlbumCard(album, artistName) {
    document.getElementById("coverArtist").textContent = artistName;
    document.getElementById("coverTitle").textContent  = album.name;
    document.getElementById("coverYear").textContent   = album.release_date?.substring(0,4) || "";
    document.getElementById("albumLink").href = safeUrl(album.external_urls?.spotify) || "#";
    const img   = document.getElementById("albumCover");
    const ph    = document.getElementById("coverPlaceholder");
    const cover = safeUrl(album.images?.[0]?.url);
    if (cover) { img.src = cover; img.style.display = "block"; ph.style.display = "none"; }
    else        { img.style.display = "none"; ph.style.display = "flex"; }
    document.getElementById("albumCard").classList.add("visible");
    document.getElementById("anotherBtn").classList.add("visible");
    ui.updateCardIcons();
  },
  hideAlbumCard() {
    document.getElementById("albumCard").classList.remove("visible");
    document.getElementById("anotherBtn").classList.remove("visible");
  },
  showPlaylistCard(playlist) {
    document.getElementById("coverArtist").textContent = "Playlist";
    document.getElementById("coverTitle").textContent  = playlist.name;
    document.getElementById("coverYear").textContent   = "";
    document.getElementById("albumLink").href = safeUrl(playlist.uri.replace("spotify:playlist:", "https://open.spotify.com/playlist/")) || "#";
    const img = document.getElementById("albumCover");
    const ph  = document.getElementById("coverPlaceholder");
    img.style.display = "none";
    ph.style.display  = "flex";
    ph.textContent    = "🎵";
    document.getElementById("albumCard").classList.add("visible");
    document.getElementById("anotherBtn").classList.remove("visible");
  },
  updateCardIcons() {
    if (!state.artist.id && !state.album.uri) return;
    const favs        = getFavorites();
    const isFav       = state.artist.name && favs.find(f => getFavName(f).toLowerCase() === state.artist.name.toLowerCase());
    const bookmarks   = getBookmarks();
    const isBookmarked = state.album.uri && bookmarks.find(b => b.uri === state.album.uri);
    const blacklist   = getBlacklist();
    const isBanned    = state.artist.id && blacklist.find(b => b.id === state.artist.id);

    const favBtn  = document.getElementById("favArtistBtn");
    const bookBtn = document.getElementById("bookmarkBtn");
    const banBtn  = document.getElementById("blacklistBtn");

    if (favBtn)  favBtn.innerHTML  = `<i class="ti ti-heart" style="font-size:20px;${isFav ? 'color:var(--accent);' : ''}"></i>`;
    if (bookBtn) bookBtn.innerHTML = `<i class="ti ti-bookmark" style="font-size:20px;${isBookmarked ? 'color:var(--accent);' : ''}"></i>`;
    if (banBtn)  banBtn.innerHTML  = `<i class="ti ti-ban" style="font-size:20px;${isBanned ? 'color:var(--danger);' : ''}"></i>`;
  },

  // ── Album des Tages ────────────────────────────────────────────────────────
  showAlbumOfDay(entry) {
    document.getElementById("aodTitle").textContent  = entry.name;
    document.getElementById("aodArtist").textContent = entry.artist;
    const img = document.getElementById("aodCover");
    const cover = safeUrl(entry.cover);
    if (cover) { img.src = cover; img.style.display = "block"; }
    else img.style.display = "none";
    document.getElementById("albumOfDayCard").classList.add("visible");
  },
  hideAlbumOfDay() {
    document.getElementById("albumOfDayCard").classList.remove("visible");
  },

  // ── Verlauf ────────────────────────────────────────────────────────────────
  renderHistory() {
    const history = getHistory();
    const el = document.getElementById("historyList");
    if (!history.length) {
      el.innerHTML = '<div style="padding:20px 0;font-size:13px;color:var(--muted);text-align:center">Noch nichts gespielt.</div>';
      return;
    }
    el.innerHTML = history.map(h => {
      const albumUrl = safeUrl(h.albumUrl);
      const cover    = safeUrl(h.cover);
      return `
      <a ${albumUrl ? `href="${escapeHtml(albumUrl)}" target="_blank"` : ""} style="text-decoration:none;color:inherit;display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;">
        ${cover ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy" style="width:40px;height:40px;border-radius:4px;object-fit:cover;flex-shrink:0;background:var(--surface2);">` : '<div style="width:40px;height:40px;border-radius:4px;background:var(--surface2);flex-shrink:0;"></div>'}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(h.album)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:1px;">${escapeHtml(h.artist)}</div>
        </div>
        <div style="font-size:11px;color:var(--muted);text-align:right;flex-shrink:0;">${escapeHtml(h.year)}</div>
      </a>`;
    }).join("");
  },

  // ── Vorgemerkte Alben ──────────────────────────────────────────────────────
  renderBookmarks() {
    const bookmarks = getBookmarks();
    const el = document.getElementById("bookmarkList");
    el.innerHTML = "";
    if (!bookmarks.length) {
      el.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--muted);text-align:center">Noch keine vorgemerkten Alben.<br>Lesezeichen-Icon beim Album antippen.</div>';
      return;
    }
    bookmarks.forEach(b => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);";

      const cover = safeUrl(b.cover);
      if (cover) {
        const img = document.createElement("img");
        img.src = cover; img.alt = ""; img.loading = "lazy";
        img.style.cssText = "width:48px;height:48px;border-radius:6px;object-fit:cover;flex-shrink:0;";
        row.appendChild(img);
      } else {
        const ph = document.createElement("div");
        ph.style.cssText = "width:48px;height:48px;border-radius:6px;background:var(--surface2);flex-shrink:0;";
        row.appendChild(ph);
      }

      const info  = document.createElement("div");
      info.style.cssText = "flex:1;min-width:0;";
      const title = document.createElement("div");
      title.style.cssText = "font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      title.textContent = b.album;
      const sub = document.createElement("div");
      sub.style.cssText = "font-size:12px;color:var(--muted);";
      sub.textContent = `${b.artist} · ${b.year}`;
      info.appendChild(title); info.appendChild(sub);
      row.appendChild(info);

      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:8px;align-items:center;flex-shrink:0;";
      const link = document.createElement("a");
      link.href = safeUrl(b.albumUrl) || "#"; link.target = "_blank";
      link.style.cssText = "color:var(--accent);font-size:12px;text-decoration:none;";
      link.textContent = "▶";
      const removeBtn = document.createElement("button");
      removeBtn.style.cssText = "background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:0 4px;";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => app.removeBookmark(b.uri));
      actions.appendChild(link); actions.appendChild(removeBtn);
      row.appendChild(actions);

      el.appendChild(row);
    });
  },

  // ── Favoriten ──────────────────────────────────────────────────────────────
  renderFavorites() {
    const favs  = getFavorites().slice().sort((a, b) => getFavName(a).localeCompare(getFavName(b), 'de'));
    const total = getFavorites().length;
    document.getElementById("favCount").textContent = `${total}`;
    document.getElementById("syssFavCountMusik").textContent     = getFavorites("musik").length;
    document.getElementById("syssFavCountHoerspiel").textContent = getFavorites("hoerspiel").length;
    const el = document.getElementById("favList");
    el.innerHTML = "";
    if (!favs.length) {
      el.innerHTML = '<div class="fav-empty">Noch keine Favoriten.<br>Künstler über Suche oder ♥ hinzufügen.</div>';
      return;
    }
    favs.forEach(f => {
      const name = getFavName(f);
      const id   = getFavId(f);
      const item = document.createElement("div");
      item.className = "fav-item";
      const nameSpan = document.createElement("span");
      nameSpan.className   = "fav-name";
      nameSpan.textContent = name;
      const removeBtn = document.createElement("button");
      removeBtn.className   = "fav-remove";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", e => { e.stopPropagation(); app.removeFavorite(name); });
      item.appendChild(nameSpan);
      item.appendChild(removeBtn);
      if (state.appMode === "hoerspiel") {
        item.addEventListener("click", () => app.playArtist(id, name, null));
      } else {
        app.attachLongPress(item, {
          onTap:       () => app.playArtist(id, name, null),
          onLongPress: () => ui.showPlaybackChoice(name,
            () => app.playArtist(id, name, null),
            () => app.playTopTracks(id, name, null))
        });
      }
      el.appendChild(item);
    });
  },

  // ── Blacklist ──────────────────────────────────────────────────────────────
  renderBlacklist() {
    const list = getBlacklist();
    const el   = document.getElementById("blacklistList");
    if (!list.length) {
      el.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--muted);text-align:center">Keine gesperrten Künstler.<br>Ban-Symbol beim Künstler antippen.</div>';
      return;
    }
    const sorted = list.slice().sort((a, b) => a.name.localeCompare(b.name, 'de'));
    el.innerHTML = "";
    sorted.forEach(b => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);";
      row.innerHTML = `<i class="ti ti-ban" style="font-size:20px;color:var(--muted);flex-shrink:0;"></i>`;

      const nameSpan = document.createElement("span");
      nameSpan.style.cssText = "flex:1;font-size:15px;";
      nameSpan.textContent = b.name;

      const removeBtn = document.createElement("button");
      removeBtn.style.cssText = "background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:0 4px;";
      removeBtn.title = "Sperre aufheben";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => app.removeFromBlacklist(b.id));

      row.appendChild(nameSpan);
      row.appendChild(removeBtn);
      el.appendChild(row);
    });
  },

  // ── Playlisten ─────────────────────────────────────────────────────────────
  renderPlaylists() {
    const el = document.getElementById("playlistContent");
    if (state.appMode === "hoerspiel") {
      el.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--muted);text-align:center">Playlisten sind nur im Musik-Modus verfügbar.</div>';
      return;
    }
    const list = getPlaylists();
    el.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
          <input type="text" id="playlistLinkInput" placeholder="Spotify-Link einfügen…" style="width:100%;">
          <input type="text" id="playlistNameInput" placeholder="Name der Playlist…" style="width:100%;">
        </div>
        <button onclick="app.addPlaylist()" style="background:var(--accent);border:none;color:#000;border-radius:10px;font-size:22px;font-weight:700;cursor:pointer;padding:0 16px;align-self:stretch;">+</button>
      </div>
      <div id="playlistListContainer" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;"></div>`;

    const container = document.getElementById("playlistListContainer");
    list.forEach(p => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer;";
      row.addEventListener("click", () => app.startPlaylist(p.uri, p.name));

      const icon = document.createElement("i");
      icon.className = "ti ti-playlist";
      icon.style.cssText = "font-size:20px;color:var(--muted);flex-shrink:0;";
      row.appendChild(icon);

      const nameSpan = document.createElement("span");
      nameSpan.style.cssText = "flex:1;font-size:15px;font-weight:500;";
      nameSpan.textContent = p.name;
      row.appendChild(nameSpan);

      if (p.id !== "37i9dQZF1F5p3rmiWPIYgZ") {
        const removeBtn = document.createElement("button");
        removeBtn.style.cssText = "background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:0 4px;";
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", e => { e.stopPropagation(); app.removePlaylist(p.id); });
        row.appendChild(removeBtn);
      }
      container.appendChild(row);
    });
  },

  // ── System ─────────────────────────────────────────────────────────────────
  updateDevicePill(name, ok) {
    document.getElementById("deviceLabel").textContent = name || "Kein Gerät gewählt";
    const dot = document.getElementById("deviceDot");
    dot.className = "si-dot" + (ok === true ? " ok" : ok === false ? " warn" : "");
  },
  showSpotifyBtn(visible) {
    const btn = document.getElementById("spotifyOpenBtn");
    if (btn) btn.style.display = visible ? "block" : "none";
  },

  // ── Filter ─────────────────────────────────────────────────────────────────
  loadFilters() {
    const f = getFilters();
    document.getElementById("filterAlbum").checked       = f.album;
    document.getElementById("filterSingle").checked      = f.single;
    document.getElementById("filterCompilation").checked = f.compilation;
    document.getElementById("filterAppearsOn").checked   = f.appears_on;
  },

  // ── Autocomplete ───────────────────────────────────────────────────────────
  formatFollowers(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(0) + 'K';
    return n;
  },
  showDropdown(artists, onSelect, onLongPress) {
    const el = document.getElementById("searchDropdown");
    if (!artists.length) { el.classList.remove("visible"); return; }
    el.innerHTML = artists.map((a, i) => {
      const img = safeUrl(a.images?.[2]?.url || a.images?.[1]?.url);
      return `
      <div class="autocomplete-item" data-idx="${i}">
        ${img
          ? `<img class="autocomplete-img" src="${escapeHtml(img)}" alt="">`
          : `<div class="autocomplete-img"></div>`}
        <span class="autocomplete-name">${escapeHtml(a.name)}</span>
        <span class="autocomplete-followers">${escapeHtml(String(ui.formatFollowers(a.followers?.total || 0)))}</span>
      </div>`;
    }).join("");
    el.classList.add("visible");
    el.querySelectorAll(".autocomplete-item").forEach((item, i) => {
      if (onLongPress) {
        app.attachLongPress(item, {
          onTap:       () => { el.classList.remove("visible"); onSelect(artists[i]); },
          onLongPress: () => { el.classList.remove("visible"); onLongPress(artists[i]); }
        });
      } else {
        item.addEventListener("click", () => { el.classList.remove("visible"); onSelect(artists[i]); });
      }
    });
  },
  hideDropdown() {
    document.getElementById("searchDropdown")?.classList.remove("visible");
  },

  // ── App ein/ausblenden ─────────────────────────────────────────────────────
  showApp() {
    document.getElementById("loginScreen").style.display     = "none";
    document.getElementById("appScreen").style.display       = "flex";
    document.getElementById("appScreen").style.flexDirection = "column";
    document.getElementById("tabBar").style.display          = "flex";
    document.getElementById("hamburgerBtn").style.display    = "block";
  },
  showLogin() {
    document.getElementById("loginScreen").style.display  = "flex";
    document.getElementById("appScreen").style.display    = "none";
    document.getElementById("tabBar").style.display       = "none";
    document.getElementById("hamburgerBtn").style.display = "none";
    document.getElementById("albumCard").classList.remove("visible");
    document.getElementById("anotherBtn").classList.remove("visible");
    ui.showSessionBanner(false);
  },

  // ── Wiedergabe-Wahl (Long-Press) ───────────────────────────────────────────
  showPlaybackChoice(artistName, onAlbum, onTopTracks) {
    document.getElementById("choiceArtistName").textContent = artistName;
    const albumBtn = document.getElementById("choiceAlbumBtn");
    const topBtn   = document.getElementById("choiceTopTracksBtn");
    albumBtn.onclick = () => { ui.closePlaybackChoice(); onAlbum(); };
    topBtn.onclick   = () => { ui.closePlaybackChoice(); onTopTracks(); };
    document.getElementById("playbackChoiceModal").classList.add("visible");
    app.pushOverlayState("playbackChoice");
  },
  closePlaybackChoice(fromPop) {
    document.getElementById("playbackChoiceModal").classList.remove("visible");
    if (!fromPop) app.popOverlayIfMatches("playbackChoice");
  },

  // ── Top-Tracks-Karte ───────────────────────────────────────────────────────
  showTopTracksCard(tracks, artistName) {
    document.getElementById("coverArtist").textContent = artistName;
    document.getElementById("coverTitle").textContent  = "Beliebteste Songs";
    document.getElementById("coverYear").textContent   = `${tracks.length} Songs`;
    document.getElementById("albumLink").href = safeUrl(tracks[0]?.external_urls?.spotify) || "#";
    const img   = document.getElementById("albumCover");
    const ph    = document.getElementById("coverPlaceholder");
    const cover = safeUrl(tracks[0]?.album?.images?.[0]?.url);
    if (cover) { img.src = cover; img.style.display = "block"; ph.style.display = "none"; }
    else        { img.style.display = "none"; ph.style.display = "flex"; }
    document.getElementById("albumCard").classList.add("visible");
    document.getElementById("anotherBtn").classList.remove("visible");
    ui.updateCardIcons();
  },

  // ── Modal ──────────────────────────────────────────────────────────────────
  showModal(name, onConfirm) {
    document.getElementById("modalText").textContent = `„${name}" aus den Favoriten entfernen?`;
    document.getElementById("modalConfirm").onclick  = () => { onConfirm(); ui.closeModal(); };
    document.getElementById("modal").classList.add("visible");
    app.pushOverlayState("modal");
  },
  closeModal(fromPop) {
    document.getElementById("modal").classList.remove("visible");
    if (!fromPop) app.popOverlayIfMatches("modal");
  },
};
