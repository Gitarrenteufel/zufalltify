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
    document.getElementById("albumLink").href = album.external_urls?.spotify || "#";
    const img   = document.getElementById("albumCover");
    const ph    = document.getElementById("coverPlaceholder");
    const cover = album.images?.[0]?.url;
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
    document.getElementById("albumLink").href = playlist.uri.replace("spotify:playlist:", "https://open.spotify.com/playlist/");
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
    if (entry.cover) { img.src = entry.cover; img.style.display = "block"; }
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
    el.innerHTML = history.map(h => `
      <a ${h.albumUrl ? `href="${h.albumUrl}" target="_blank"` : ""} style="text-decoration:none;color:inherit;display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;">
        ${h.cover ? `<img src="${h.cover}" alt="" loading="lazy" style="width:40px;height:40px;border-radius:4px;object-fit:cover;flex-shrink:0;background:var(--surface2);">` : '<div style="width:40px;height:40px;border-radius:4px;background:var(--surface2);flex-shrink:0;"></div>'}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${h.album}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:1px;">${h.artist}</div>
        </div>
        <div style="font-size:11px;color:var(--muted);text-align:right;flex-shrink:0;">${h.year}</div>
      </a>`).join("");
  },

  // ── Vorgemerkte Alben ──────────────────────────────────────────────────────
  renderBookmarks() {
    const bookmarks = getBookmarks();
    const el = document.getElementById("bookmarkList");
    if (!bookmarks.length) {
      el.innerHTML = '<div style="padding:20px;font-size:13px;color:var(--muted);text-align:center">Noch keine vorgemerkten Alben.<br>Lesezeichen-Icon beim Album antippen.</div>';
      return;
    }
    el.innerHTML = bookmarks.map(b => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
        ${b.cover ? `<img src="${b.cover}" alt="" loading="lazy" style="width:48px;height:48px;border-radius:6px;object-fit:cover;flex-shrink:0;">` : '<div style="width:48px;height:48px;border-radius:6px;background:var(--surface2);flex-shrink:0;"></div>'}
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.album}</div>
          <div style="font-size:12px;color:var(--muted);">${b.artist} · ${b.year}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
          <a href="${b.albumUrl}" target="_blank" style="color:var(--accent);font-size:12px;text-decoration:none;">▶</a>
          <button onclick="app.removeBookmark('${b.uri}')" style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:0 4px;">×</button>
        </div>
      </div>`).join("");
  },

  // ── Favoriten ──────────────────────────────────────────────────────────────
  renderFavorites() {
    const favs  = getFavorites().slice().sort((a, b) => getFavName(a).localeCompare(getFavName(b), 'de'));
    const total = getFavorites().length;
    const full  = total >= FAV_MAX;
    document.getElementById("favCount").textContent   = `${total}/${FAV_MAX}`;
    document.getElementById("favCount").style.color   = full ? "var(--warn)" : "var(--muted)";
    document.getElementById("syssFavCountMusik").textContent     = getFavorites("musik").length + "/" + FAV_MAX;
    document.getElementById("syssFavCountHoerspiel").textContent = getFavorites("hoerspiel").length + "/" + FAV_MAX;
    const el = document.getElementById("favList");
    if (!favs.length) {
      el.innerHTML = '<div class="fav-empty">Noch keine Favoriten.<br>Künstler über Suche oder ♥ hinzufügen.</div>';
      return;
    }
    el.innerHTML = favs.map(f => {
      const name = getFavName(f);
      const safe = name.replace(/'/g, "\\'");
      return `
      <div class="fav-item" onclick="app.playArtist(${f.id ? `'${f.id}'` : 'null'}, '${safe}', null)">
        <span class="fav-name">${name}</span>
        <button class="fav-remove" onclick="event.stopPropagation();app.removeFavorite('${safe}')">×</button>
      </div>`;
    }).join("");
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
    el.innerHTML = sorted.map(b => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">
        <i class="ti ti-ban" style="font-size:20px;color:var(--muted);flex-shrink:0;"></i>
        <span style="flex:1;font-size:15px;">${b.name}</span>
        <button onclick="app.removeFromBlacklist('${b.id}')" style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:0 4px;" title="Sperre aufheben">×</button>
      </div>`).join("");
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
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;">
        ${list.map(p => `
          <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer;" onclick="app.startPlaylist('${p.uri}', '${p.name.replace(/'/g,"\\'")}')">
            <i class="ti ti-playlist" style="font-size:20px;color:var(--muted);flex-shrink:0;"></i>
            <span style="flex:1;font-size:15px;font-weight:500;">${p.name}</span>
            ${p.id !== "37i9dQZF1F5p3rmiWPIYgZ" ? `<button onclick="event.stopPropagation();app.removePlaylist('${p.id}')" style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;padding:0 4px;">×</button>` : ""}
          </div>`).join("")}
      </div>`;
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
  showDropdown(artists, onSelect) {
    const el = document.getElementById("searchDropdown");
    if (!artists.length) { el.classList.remove("visible"); return; }
    el.innerHTML = artists.map((a, i) => `
      <div class="autocomplete-item" data-idx="${i}">
        ${a.images?.[2]?.url || a.images?.[1]?.url
          ? `<img class="autocomplete-img" src="${a.images?.[2]?.url || a.images?.[1]?.url}" alt="">`
          : `<div class="autocomplete-img"></div>`}
        <span class="autocomplete-name">${a.name}</span>
        <span class="autocomplete-followers">${ui.formatFollowers(a.followers?.total || 0)}</span>
      </div>`).join("");
    el.classList.add("visible");
    el.querySelectorAll(".autocomplete-item").forEach((item, i) => {
      item.addEventListener("click", () => {
        el.classList.remove("visible");
        onSelect(artists[i]);
      });
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

  // ── Modal ──────────────────────────────────────────────────────────────────
  showModal(name, onConfirm) {
    document.getElementById("modalText").textContent = `„${name}" aus den Favoriten entfernen?`;
    document.getElementById("modalConfirm").onclick  = () => { onConfirm(); ui.closeModal(); };
    document.getElementById("modal").classList.add("visible");
  },
  closeModal() {
    document.getElementById("modal").classList.remove("visible");
  },
};
