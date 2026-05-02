// ─────────────────────────────────────────────────────────────
//  app.config.ts  —  single source of truth for app configuration
//  Shared by frontend (Vite/React) and backend (server.ts).
//  Secrets (JWT_SECRET, DATABASE_URL, SSL paths) stay in .env.
// ─────────────────────────────────────────────────────────────

const config = {

  // ── App ────────────────────────────────────────────────────
  APP_NAME:    "Bella Dolce",
  APP_VERSION: "1.3.0",

  // ── Display ────────────────────────────────────────────────
  CURRENCY:  "DA",
  PAGE_SIZE: 15,          // rows shown per page in all list views

  // ── Server ─────────────────────────────────────────────────
  PORT: 3000,             // overridden by process.env.PORT in production

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

  // ── Units of Measure ───────────────────────────────────────
  UNITS: ["kg", "g", "l", "ml", "pcs", "unit"],

};

export default config;
