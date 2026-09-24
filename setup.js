// ── Test-Harness ─────────────────────────────────────────────────────────────
// Lädt die ECHTEN config.js/state.js in einen isolierten VM-Kontext mit
// minimalen Browser-Stubs (localStorage, window, navigator). Dadurch testen
// wir den tatsächlich ausgelieferten Code, ohne ihn zu duplizieren.
const fs  = require("node:fs");
const path = require("node:path");
const vm  = require("node:vm");

function createContext() {
  const store = {};
  const localStorage = {
    getItem:    k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear:      () => { for (const k in store) delete store[k]; },
  };

  const sandbox = {
    localStorage,
    window:    { location: { protocol: "https:" } },
    navigator: { userAgent: "node-test" },
    console,
  };
  vm.createContext(sandbox);

  const configSrc = fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8");
  const stateSrc  = fs.readFileSync(path.join(__dirname, "..", "state.js"), "utf8");
  vm.runInContext(configSrc, sandbox, { filename: "config.js" });
  vm.runInContext(stateSrc,  sandbox, { filename: "state.js" });

  return sandbox;
}

// Führt Code im gegebenen Kontext aus (Zugriff auf state.js-Funktionen/-Variablen).
function run(ctx, code) {
  return vm.runInContext(code, ctx);
}

module.exports = { createContext, run };
