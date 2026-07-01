// ── Konfiguration ─────────────────────────────────────────────────────────────
const CLIENT_ID  = "7f11ab0b763a4d95ba84882b55101ee1";
const WORKER_URL = "https://zufalltify-token.summer-truth-edd2.workers.dev";
const SCOPES     = "user-read-private user-read-playback-state user-modify-playback-state user-follow-read";
const HISTORY_MAX = 50;
const FAV_MAX     = 50;

const IS_WEBVIEW = window.location.protocol === 'zufalltify:' ||
  (typeof Android !== 'undefined') ||
  (/Android/.test(navigator.userAgent) && /wv/.test(navigator.userAgent));

const REDIRECT_URI = IS_WEBVIEW
  ? "zufalltify://callback"
  : "https://gitarrenteufel.github.io/zufalltify/";

// Hörspiel-IDs – Ausschlussliste für Musik-Modus
const HOERSPIEL_IDS = new Set([
  "3meJIgRw7YleJrmbpbJK6S", // Die drei ???
  "6lly2jn9MqaxaWRrkEzOsJ", // John Sinclair
  "55dz39BSDTWYbBFVZRj72b", // Asterix
  "3vlzAKeADwRpvZAgOom2Wh", // Jan Tenner
]);

// Hörbuch-IDs – immer ausgeblendet
const HOERBUCH_IDS = new Set([
  "2Xl8Eqgt8a9DsTohLDwZD3", // Gregs Tagebuch
]);

const MODE_COLORS = {
  musik:     { accent: "#1DB954", accentHi: "#1ed760", accentDark: "#0f3d1e" },
  hoerspiel: { accent: "#7EB8D4", accentHi: "#9ECCE3", accentDark: "#0d2a38" },
};

const DEFAULT_FAVORITES_MUSIK = [
  { id: "711MCceyCBcFnzjGY4Q7Un", name: "AC/DC" },
  { id: "1Ol0R5H1TFflezh7JYIBzn", name: "Amorphis" },
  { id: "3NtFhSFVFNJGmFBFEFLsxG", name: "Anthrax" },
  { id: "6Qwm8K1FSss5oCvT0OIUSC", name: "Bolt Thrower" },
  { id: "5LGiPOl3MOXSP9l39HJQKW", name: "Death" },
  { id: "6M8kfGqAhpqmE6PuJrHnI2", name: "Ghost Brigade" },
  { id: "0GDGKpJFhVpcjIGF8N6Bvx", name: "Gojira" },
  { id: "3HyMCFm0V9jGOWlGVHIBGP", name: "Katatonia" },
  { id: "4kIwETcbpuFgRukE8o7Opd", name: "Machine Head" },
  { id: "1DgQpFJgMuHr2UKFczNLfa", name: "Motörhead" },
  { id: "5a2EFKLqiRqtKVRlHPnkXU", name: "Pantera" },
  { id: "6TIiLVSXYZFbdkfXm7CXQR", name: "Paradise Lost" },
  { id: "5UHGAbHwKcGAOCjZGJt5Wv", name: "Sepultura" },
  { id: "1IQ2e1buppatiN1bxUVkrk", name: "Slayer" },
  { id: "0MBcy6D2CyFXBHBUEWTtny", name: "Such A Surge" },
];

const DEFAULT_FAVORITES_HOERSPIEL = [
  { id: "3meJIgRw7YleJrmbpbJK6S", name: "Die drei ???" },
  { id: "55dz39BSDTWYbBFVZRj72b", name: "Asterix" },
  { id: "6lly2jn9MqaxaWRrkEzOsJ", name: "John Sinclair" },
  { id: "3vlzAKeADwRpvZAgOom2Wh", name: "Jan Tenner" },
];

const DEFAULT_PLAYLISTS = [
  { id: "37i9dQZF1F5p3rmiWPIYgZ", name: "Lieblingssongs", uri: "spotify:playlist:37i9dQZF1F5p3rmiWPIYgZ" },
];
