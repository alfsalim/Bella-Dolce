// ─────────────────────────────────────────────────────────────
//  app.config.ts  —  single source of truth for app configuration
//  Shared by frontend (Vite/React) and backend (server.ts).
//  Secrets (JWT_SECRET, DATABASE_URL, SSL paths) stay in .env.
// ─────────────────────────────────────────────────────────────

const config = {

  // ── App ────────────────────────────────────────────────────
  APP_NAME:    "Bella Dolce",
  APP_VERSION: "1.5.2",

  // ── Display ────────────────────────────────────────────────
  CURRENCY:  "DA",
  PAGE_SIZE: 15,          // rows shown per page in all list views
  /** Max rows fetched per query — must equal PAGE_SIZE × 10 (10 pages max). */
  QUERY_MAX_ITEMS: 150,

  // ── Units of Measure ───────────────────────────────────────
  UNITS: ["kg", "g", "l", "ml", "pcs", "unit"],

  // ── Print Agent ────────────────────────────────────────────
  PRINT_AGENT_URL_DEV:  "http://localhost:5555",
  PRINT_AGENT_URL_PROD: "http://192.168.8.105:5555",
  PRINT_AGENT_TIMEOUT:  2000,
  PRINT_LANGUAGE: "FR", // USER | BOTH | FR | AR

  // ── G50 Tax Service ────────────────────────────────────────
  G50_SERVICE_URL: "http://localhost:3100",
  G50_TENANT_ID:   "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",

};

export default config;
