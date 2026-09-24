const test   = require("node:test");
const assert = require("node:assert/strict");
const { createContext, run } = require("./setup");

// ── normalizeAlbumName / filterAlbums ──────────────────────────────────────────
test("normalizeAlbumName entfernt Editions-/Remaster-Zusätze", () => {
  const ctx = createContext();
  assert.equal(run(ctx, `normalizeAlbumName("Master of Puppets (Remastered)")`), "master of puppets");
  assert.equal(run(ctx, `normalizeAlbumName("Master Of Puppets")`),              "master of puppets");
  assert.equal(run(ctx, `normalizeAlbumName("Rust in Peace [Deluxe Edition]")`), "rust in peace");
  assert.equal(run(ctx, `normalizeAlbumName("Reign in Blood (2013 Remaster)")`), "reign in blood");
});

test("filterAlbums entfernt Duplikate nach Normalisierung, behält die erste Variante", () => {
  const ctx = createContext();
  const result = JSON.parse(run(ctx, `
    JSON.stringify(filterAlbums([
      { name: "Rust in Peace" },
      { name: "Rust In Peace (Remastered)" },
      { name: "Countdown to Extinction" }
    ]).map(a => a.name))
  `));
  assert.deepEqual(result, ["Rust in Peace", "Countdown to Extinction"]);
});

// ── getArtistPool ───────────────────────────────────────────────────────────────
test("getArtistPool (Musik-Modus): schließt Blacklist und Hörspiel/Hörbuch-Künstler aus", () => {
  const ctx = createContext();
  run(ctx, `state.appMode = "musik";`);
  run(ctx, `saveBlacklist([{ id: "banned1", name: "Banned Artist" }]);`);
  const result = JSON.parse(run(ctx, `
    JSON.stringify(getArtistPool([
      { id: "a1", name: "Artist A" },
      { id: "banned1", name: "Banned Artist" },
      { id: "3meJIgRw7YleJrmbpbJK6S", name: "Die drei ???" }
    ]).map(a => a.id))
  `));
  assert.deepEqual(result, ["a1"]);
});

test("getArtistPool (Hörspiel-Modus): nutzt Favoriten, schließt Hörbuch und Blacklist aus", () => {
  const ctx = createContext();
  run(ctx, `state.appMode = "hoerspiel";`);
  run(ctx, `
    saveFavorites([
      { id: "3meJIgRw7YleJrmbpbJK6S", name: "Die drei ???" },
      { id: "2Xl8Eqgt8a9DsTohLDwZD3", name: "Gregs Tagebuch" }
    ]);
  `);
  const result = JSON.parse(run(ctx, `JSON.stringify(getArtistPool([]).map(a => a.id))`));
  assert.deepEqual(result, ["3meJIgRw7YleJrmbpbJK6S"]);
});

// ── getIncludeGroups / getFilters ─────────────────────────────────────────────
test("getIncludeGroups fällt auf 'album' zurück, wenn nichts ausgewählt ist", () => {
  const ctx = createContext();
  run(ctx, `saveFilters({ album: false, single: false, compilation: false, appears_on: false });`);
  assert.equal(run(ctx, `getIncludeGroups()`), "album");
});

test("getIncludeGroups kombiniert ausgewählte Gruppen in fester Reihenfolge", () => {
  const ctx = createContext();
  run(ctx, `saveFilters({ album: true, single: true, compilation: true, appears_on: false });`);
  assert.equal(run(ctx, `getIncludeGroups()`), "album,single,compilation");
});

// ── Favoriten (kein Limit mehr seit v5.1) ─────────────────────────────────────
test("getFavorites/saveFavorites: beliebig viele Einträge möglich (kein FAV_MAX)", () => {
  const ctx = createContext();
  const many = Array.from({ length: 120 }, (_, i) => ({ id: "id" + i, name: "Artist " + i }));
  run(ctx, `saveFavorites(${JSON.stringify(many)});`);
  assert.equal(run(ctx, `getFavorites().length`), 120);
});

// ── Bookmarks: keine Duplikate nach URI ────────────────────────────────────────
test("addBookmark fügt kein zweites Mal dieselbe Album-URI hinzu", () => {
  const ctx = createContext();
  const album = { name: "Rust in Peace", uri: "spotify:album:xyz", release_date: "1990-09-24", images: [{ url: "a" }] };
  run(ctx, `addBookmark(${JSON.stringify(album)}, "Megadeth");`);
  run(ctx, `addBookmark(${JSON.stringify(album)}, "Megadeth");`);
  assert.equal(run(ctx, `getBookmarks().length`), 1);
});
