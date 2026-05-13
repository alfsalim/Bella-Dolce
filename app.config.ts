// ─────────────────────────────────────────────────────────────
//  app.config.ts  —  single source of truth for app configuration
//  Shared by frontend (Vite/React) and backend (server.ts).
//  Secrets (JWT_SECRET, DATABASE_URL, SSL paths) stay in .env.
// ─────────────────────────────────────────────────────────────

const config = {

  // ── App ────────────────────────────────────────────────────
  APP_NAME:    "Bella Dolce",
  APP_VERSION: "1.4.1",

  // ── Display ────────────────────────────────────────────────
  CURRENCY:  "DA",
  PAGE_SIZE: 15,          // rows shown per page in all list views
  /** Max rows fetched per query — must equal PAGE_SIZE × 10 (10 pages max). */
  QUERY_MAX_ITEMS: 150,

  // ── Units of Measure ───────────────────────────────────────
  UNITS: ["kg", "g", "l", "ml", "pcs", "unit"],

};

export default config;
