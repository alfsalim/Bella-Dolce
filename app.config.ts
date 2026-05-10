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
  /** Max rows per bounded list/query against /api/db (purchase history, etc.) */
  QUERY_MAX_ITEMS: 100,

  // ── Server ─────────────────────────────────────────────────
  PORT: 3500,             // overridden by process.env.PORT in production

  // ── Product Categories ─────────────────────────────────────
  CATEGORIES: [
    "viennoiserie",
    "patisserie",
    "boulangerie",
    "traiteur",
    "boissons",
    "cooking",
    "maintenance",
    "cleaning",
    "others",
  ],

  // Categories that can be sold at POS (excludes supplies/maintenance)
  SELLABLE_CATEGORIES: [
    "viennoiserie",
    "patisserie",
    "boulangerie",
    "traiteur",
    "boissons",
  ],

  // ── Units of Measure ───────────────────────────────────────
  UNITS: ["kg", "g", "l", "ml", "pcs", "unit"],

};

export default config;
