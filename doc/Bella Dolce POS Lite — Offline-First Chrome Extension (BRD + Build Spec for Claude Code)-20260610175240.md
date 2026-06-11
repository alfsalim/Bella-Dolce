# Bella Dolce POS Lite — Offline-First Chrome Extension (BRD + Build Spec for Claude Code)

# Bella Dolce POS Lite — Offline-First Cashier Chrome Extension
## BRD + Technical Build Specification (Claude Code consumable)
> **Purpose of this doc:** A single, self-contained brief that a coding agent (Claude Code / Codex) can read end-to-end and build from with no further clarification. It defines scope, architecture, data model, offline storage, sync protocol, UI, and acceptance criteria.  
> **⚠️ HARD CONSTRAINT — REUSE THE EXISTING BACKEND. DO NOT CHANGE THE API.**  
> This extension is a **client of the already-live Bella Dolce backend**. The coding agent **must NOT invent, rename, or redesign any API endpoint, request/response shape, or field name.** Reuse the **existing backend API signatures and schema verbatim** so that synced data lands in the exact same tables/structures the live system already uses. The local (offline) data model must **mirror the existing server schema** field-for-field, so syncing back later is trivial (same names, same types). Any endpoint/schema shown below is **illustrative placeholder only** — the agent must replace it with the **actual existing signatures** from the current codebase / API. When a real signature is known, it always wins over what's written here.
* * *
## 1\. Executive Summary
The full **Bella Dolce Bakery Management System** (TypeScript + SQLite + React) is live and handles sales, production, inventory, finance, and AI insights. This project delivers **POS Lite**: a stripped-down, **offline-first Chrome extension** that does **one job only — record sales transactions at the till**.

It must keep working when the network is down, the server is unreachable, or the device is running on battery with no connectivity (e.g. a tablet during a power/network outage). Transactions are stored **locally and durably** inside the extension, then **synced automatically** to the main server the moment connectivity is restored — with no cashier intervention and no data loss.

**Target user role: Cashier only.** No dashboards, no reporting, no admin, no production/inventory modules.

* * *
## 2\. Goals & Non-Goals
### 2.1 Goals
*   Record sales transactions reliably **with zero dependency on live connectivity**.
*   Persist every transaction durably on-device before the cashier ever sees a confirmation.
*   Auto-detect server availability and **sync in the background**, idempotently, without duplicates.
*   Run on desktop Chrome **and** Chrome on tablets (touch-friendly, large tap targets).
*   Be fast: a sale should be completable in seconds, fully offline.
### 2.2 Non-Goals (explicitly out of scope)
*   ❌ Dashboards, analytics, reporting, AI insights.
*   ❌ Production planning, inventory management, financial reconciliation UI.
*   ❌ User management / role administration (the extension never _creates or edits_ users — it only caches a small read-only copy for offline login, see §9).
*   ❌ **Any new or modified backend API.** The extension only consumes existing endpoints.
*   ❌ Payment gateway / card processing integration (record tender type only, unless §10 says otherwise).

* * *
## 3\. Target User & Role
**Cashier.** Single role. Logs in once, stays logged in on the device, rings up sales. The cashier should never have to think about "online vs offline" — the app behaves identically either way, and a small status indicator is the only difference they notice.

* * *
## 4\. Platform & Architecture Overview
### 4.1 Form factor
Chrome Extension, built as a **Manifest V3** extension. The POS UI runs as an **extension page** (a full-screen `chrome-extension://` page opened in its own tab/window), NOT a tiny popup — the popup is too small for a touch till. The popup (if used) is just a launcher + status badge.

Why a full extension page (not a content script or popup):
*   Persistent, dedicated storage origin (the extension origin) that survives tab closes.
*   Full-screen, kiosk-friendly layout for tablets.
*   Access to extension APIs (storage, alarms, service worker background sync).
### 4.2 High-level components

```plain
┌─────────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                           │
│                                                           │
│  ┌──────────────────┐      ┌──────────────────────────┐  │
│  │  POS UI (React)  │◄────►│  Local Data Layer        │  │
│  │  extension page  │      │  IndexedDB (Dexie.js)    │  │
│  │  - product grid  │      │  - transactions (queue)  │  │
│  │  - cart          │      │  - products (cache)      │  │
│  │  - checkout      │      │  - sync_meta             │  │
│  └────────┬─────────┘      └───────────┬──────────────┘  │
│           │                            │                 │
│           ▼                            ▼                 │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Service Worker (background)                       │    │
│  │  - connectivity detection                          │    │
│  │  - sync engine (push queued txns)                  │    │
│  │  - periodic + event-driven sync (alarms)           │    │
│  └────────────────────────┬───────────────────────────┘   │
└───────────────────────────┼──────────────────────────────┘
                            │  HTTPS (when reachable)
                            ▼
              ┌──────────────────────────────┐
              │  Bella Dolce Main Server     │
              │  (existing) — Sync API        │
              └──────────────────────────────┘
```

### 4.3 Tech stack (match the existing system)
*   **Language:** TypeScript (strict mode).
*   **UI:** React 18 + Vite (with `@crxjs/vite-plugin` or equivalent for MV3 builds).
*   **Local DB:** **IndexedDB via Dexie.js**. Rationale below (§6.1).
*   **State:** lightweight (Zustand or React Context) — no heavy state lib needed.
*   **Styling:** Tailwind or CSS modules; must be touch-first (min 44×44px tap targets).
*   **Background:** MV3 service worker + `chrome.alarms` for periodic sync.
*   **Build output:** unpacked extension + zipped package for distribution.

* * *
## 5\. Offline-First Principles (non-negotiable)
1. **Local write is the source of truth at point of sale.** Every transaction is committed to IndexedDB and marked `pending` BEFORE the cashier sees "Sale complete." The server is never on the critical path of a sale.
2. **The UI never blocks on the network.** No spinners waiting for the server during checkout.
3. **Sync is a background concern.** It happens opportunistically and invisibly.
4. **Idempotency everywhere.** Every transaction carries a client-generated UUID so re-sends never create duplicates.
5. **No silent data loss.** A transaction leaves the local queue only after the server acknowledges it.

* * *
## 6\. Local Storage Design
### 6.1 Why IndexedDB (Dexie), not files or in-memory
*   **In-memory DB:** ❌ lost on tab close / crash / power loss. Violates durability.
*   **File (File System Access API):** ⚠️ requires user permission prompts, awkward in an extension, not transactional.
*   **`chrome.storage.local`**\*\*\*\***:** OK for small config, but not built for thousands of transactional rows or queries.
*   **IndexedDB (via Dexie):** ✅ durable, transactional, indexed, large quota, survives restarts and power loss. **This is the choice.**
### 6.2 Local data model — REUSE THE EXISTING DB SCHEMA (do not redefine)
> **Don't redefine the schema.** Do **not** invent new entity definitions for transactions, products, or users. Read the **existing backend/SQLite schema** from the live codebase and reuse those **exact entity shapes and field names** for the local Dexie tables. The local store is a **mirror of the server's own tables**, so a queued record can be pushed to the existing API with **zero transformation**. Wherever a server entity already exists, the extension's local copy IS that entity.
The extension keeps a small set of local Dexie tables, each mirroring an existing server entity:
*   **`transactions`** — the offline sales queue. Use the **existing sale/transaction entity verbatim**, plus a few extension-only sync-control fields that never go to the server (see below).
*   **`products`** — local cache of the **existing product/menu entity**, for offline ringing-up. Same fields as the server.
*   **`users`** — small local cache of the **existing user entity** (incl. its `role` field), for offline login. Cache only the handful of staff who use this till. Store a **hashed** PIN only if the server entity doesn't already carry a verifiable credential; **never plaintext**.

**The only fields the extension adds** (sync bookkeeping, local-only, stripped before/ignored on push):

| field | type | notes |
| ---| ---| --- |
| `syncStatus` | enum | `pending` | `syncing` | `synced` | `failed` |
| `syncAttempts` | number | retry counter |
| `lastSyncError` | string? | last error, for the failed-txn panel |

> **Idempotency:** the sale's own id (use whatever the existing schema uses; generate it client-side if the server accepts a client-supplied id) is the dedupe key on push. Don't add a parallel id scheme if the existing one works.

**`sync_meta`** — the one genuinely new, extension-only table (no server equivalent): holds `serverBaseUrl`, `authToken`, `deviceId`, and `lastProductSyncAt` / `lastUserSyncAt` / `lastTxnPushAt` timestamps. This is local config/state only and never syncs.
### 6.3 Indexes
Index `transactions` on `syncStatus` and `createdAt` so the sync engine can quickly pull all `pending` rows in order.

* * *
## 7\. Connectivity Detection & Sync Engine
### 7.1 Detecting "server is up"
`navigator.onLine` is necessary but **not sufficient** (it only tells you the device has a network, not that the server is reachable). Use a layered approach:

1. Listen to `online` / `offline` browser events as a cheap trigger.
2. On any `online` event, and on a `chrome.alarms` timer (default **every 30s**), perform a lightweight **reachability check** against an existing cheap endpoint (§8) with a short timeout (~3s).
3. Only treat the server as "up" when that check returns success. Otherwise stay in offline mode and keep queuing.
### 7.2 Sync flow (push queued transactions)

```plain
TRIGGER: online event | alarm tick | manual "Sync now"
    1. Reachability check → if down, abort, schedule next tick.
    2. Query transactions WHERE syncStatus = 'pending' ORDER BY createdAt ASC.
    3. Batch them and POST to the EXISTING sale endpoint (§8.2). Reuse the live API's body shape; do not invent one.
                    - Mark each 'syncing' before send.
        4. Server processes idempotently by transaction id (see §8).
        5. On 2xx per-item ack:
                            - set syncStatus = 'synced', store serverTxnId.
        6. On per-item failure:
                            - set syncStatus = 'failed', increment syncAttempts, store lastSyncError.
                            - eligible for retry on next tick (with backoff).
        7. Update sync_meta.lastTxnPushAt.
```

### 7.3 Retry & backoff
Exponential backoff per failed transaction (e.g. 30s, 1m, 5m, 15m, capped). `failed` rows are retried automatically; never dropped. A transaction is only ever removed/archived after `synced`.
### 7.4 Product & user cache refresh
When online, refresh the `products` cache via the **existing** products endpoint (§8) on app open and on a slower alarm (e.g. every 15 min). Likewise refresh the small `users`/roles cache via the **existing** users endpoint (§8) so offline login stays current. Selling and login always read from the local caches.
### 7.5 Conflict handling
Sales are append-only events, so conflicts are minimal. The server is authoritative on acceptance. If the server rejects a transaction (e.g. validation), it returns a clear error; the row goes `failed` and surfaces in a small "needs attention" list (see §10.4). No automatic merging needed.

* * *
## 8\. Server Sync — REUSE EXISTING API (do not define new endpoints)
> **Mandate:** Do **not** define, design, or rename any endpoint. Read the **existing live backend's API from the codebase** and call those exact endpoints, with their exact request/response shapes, wherever it makes sense. The extension is just another client of the already-running API.
The extension maps four capabilities onto **existing** endpoints:

1. **Reachability check** — to decide online vs offline (§7.1). Reuse any cheap existing endpoint; no dedicated one needed.
2. **Submit sale(s)** — push each queued offline sale to the **same endpoint the live POS already uses to create a sale**, in the same body shape. Dedupe on the sale's existing id so retries don't double-insert (see §6.2).
3. **Fetch products** — populate/refresh the local product cache from the **existing products/menu endpoint**.
4. **Login + fetch staff** — use the **existing login endpoint** and the **existing users endpoint** to authenticate and to populate the local `users`/roles cache (§9).
> The only thing to **verify** (not build): that the existing sale-create call is idempotent on the sale id. If not, the backend should add id-based dedupe **without changing the signature**. If a capability genuinely has no existing endpoint, flag it as a backend gap in §15 — never invent a shape.

* * *
## 9\. Authentication (offline-capable, backed by a local users cache)
**Principle:** Pre-load a **small set of users and their roles onto the device while online**, so that when the device goes offline it **already has the user DB and roles locally** and can authenticate and authorize without the server.
*   **Provisioning (online, at setup and on refresh):** Using the **existing** login + users endpoints (§8.4), pull the handful of staff who use this till into the local `users` table (`userId`, `username`, `displayName`, `role`, `pinHash`, `active`). Store **only a hash** of the PIN, never plaintext. Refresh this cache whenever the device is online (on app open + a slow alarm), stamping `sync_meta.lastUserSyncAt`.
*   **Offline login:** The cashier logs in with username + PIN; the extension verifies against the **local** **`users`** **cache** (compare against `pinHash`) and reads their `role` locally. No network needed. The role values match the backend's exactly, so the same authorization rules apply on sync.
*   **Online login:** When reachable, authenticate against the **existing** login endpoint and store the returned token in `sync_meta.authToken`. Use that token for all synced calls.
*   **Token expiry never blocks selling:** If the token expires while offline, the cashier keeps selling (transactions queue locally) and login still works against the local users cache. Sync simply waits for a fresh token when back online. **Selling must never be blocked by connectivity or an expired token.**
*   **Operating role:** Day-to-day this till runs as **cashier**. Caching roles for all listed staff lets a manager/admin authenticate locally too (e.g. for an override) without changing scope — the extension still exposes cashier functionality only.
*   On first run, generate and persist a `deviceId` (UUID).

* * *
## 10\. POS UI Specification (cashier screen)
### 10.1 Layout (tablet-first, landscape)
*   **Left ~65%:** Product grid, grouped by category, large touch tiles (name + price). Optional search/filter bar at top.
*   **Right ~35%:** Cart panel — line items with qty steppers, running subtotal/tax/total, and a big **Charge** button.
*   **Top bar:** Cashier name, **connectivity status pill** (🟢 Online / 🟡 Offline — queued: N), and a **Sync now** action.
### 10.2 Core flow
1. Tap products → added to cart (tap again increments qty; stepper to adjust).
2. Optional line discount (if in scope).
3. Tap **Charge** → choose tender (Cash / Card / Other).
4. For cash: enter amount tendered → app shows **change due**.
5. Confirm → transaction written to IndexedDB as `pending` → **instant "Sale complete"** + change/receipt summary → cart clears.
6. Background sync handles the rest.
### 10.3 Offline behavior
*   Everything in 10.2 works identically offline. The only visible change is the status pill (🟡 Offline — queued: N).
*   No blocking, no error popups for being offline. Offline is a normal, expected state.
### 10.4 Sync status / diagnostics (minimal)
*   Status pill shows pending count.
*   A small slide-out panel lists `failed` transactions with their error and a **Retry** button. This is the ONLY reporting surface — it exists for data integrity, not analytics.
### 10.5 Receipts
*   Generate a simple on-screen receipt summary after each sale. Printing (if a receipt printer exists) is optional/Phase 2 — note as a hook, don't block on it.

* * *
## 11\. Manifest V3 Requirements
*   `manifest_version: 3`.
*   **Permissions:** `storage`, `alarms`. **Host permissions:** the server base URL origin only.
*   **Background:** service worker (`background.service_worker`).
*   **Action:** popup = lightweight launcher + status badge; main POS opens as an extension page.
*   Use `chrome.alarms` (not `setInterval`) for periodic sync, since MV3 service workers are not persistent.
*   Handle service-worker wake/sleep gracefully: all sync state lives in IndexedDB, never in worker memory.

* * *
## 12\. Non-Functional Requirements
*   **Durability:** No acknowledged sale is ever lost, including on crash, tab close, or power loss mid-session.
*   **Performance:** Add-to-cart < 100ms; checkout commit < 300ms locally.
*   **Capacity:** Handle a full day (1000s) of queued transactions offline without degradation.
*   **Touch usability:** All interactive targets ≥ 44×44px; works in landscape on a 10" tablet.
*   **Resilience:** Survives flaky/intermittent connectivity without duplicates or stuck states.
*   **Clock skew:** Send device `createdAt`; server may also stamp its own receive time. Don't depend on perfect device clocks for ordering correctness.

* * *
## 13\. Acceptance Criteria (definition of done)
1. ✅ Cashier can log in once (online) and then complete sales **fully offline**.
2. ✅ Every completed sale is persisted in IndexedDB as `pending` before "Sale complete" shows.
3. ✅ Killing the tab / reloading / simulating power loss does **not** lose any pending transaction.
4. ✅ When the server becomes reachable, pending transactions sync automatically within one sync cycle, with **no duplicates** even if a batch is sent twice (idempotency verified).
5. ✅ Status pill accurately reflects online/offline and pending count in real time.
6. ✅ A transaction the server rejects shows in the failed panel with its error and can be retried.
7. ✅ Product catalog is cached and usable offline; refreshes when online.
8. ✅ Works on Chrome desktop and Chrome on an Android tablet (touch).
9. ✅ No dashboards, reporting, admin, or non-cashier features are present.
10. ✅ A cashier can authenticate **fully offline** against the locally cached users/roles DB (no server reachable), and that cache refreshes when online.
11. ✅ No new or modified backend endpoints were introduced; all server calls use existing API signatures, and synced records match the existing server schema.

* * *
## 14\. Suggested Build Order (for the coding agent)
1. Scaffold MV3 extension (Vite + React + TS + `@crxjs/vite-plugin`).
2. **Locate the existing backend's real endpoints + schema** (sale create, products, login, users) and build typed clients/types that mirror them verbatim.
3. Set up Dexie schema (§6) matching the server field names + `deviceId` bootstrap.
4. Build POS UI shell: product grid + cart + charge flow, writing to IndexedDB.
5. Implement login: online via existing endpoint, **offline via local** **`users`**\*\*\*\***/roles cache**; provision + refresh the users cache when online.
6. Implement product cache fetch + offline read (existing products endpoint).
7. Implement service worker: reachability check, alarms, sync engine (§7), idempotent push to the existing sale endpoint.
8. Wire status pill + failed-txn panel.
9. Harden: retries/backoff, crash/power-loss durability tests, duplicate-prevention tests.
10. Package unpacked + zipped build.

* * *
## 15\. Open Questions (assume defaults if unanswered)
*   Tax/discount rules: assume per-product `taxRate` from catalog; flat optional line discount. Confirm if more complex.
*   Receipt printing hardware: assumed out of scope for v1 (on-screen only).
*   **Existing API signatures:** the agent must read the real sale-create, products, login, and users endpoints from the current codebase and reuse them verbatim. Only flag a genuine _backend gap_ here if a capability truly doesn't exist — never invent a new endpoint shape.
*   **Sale idempotency:** confirm the existing sale endpoint de-dupes on the client transaction id; if not, the backend must add id-based de-dup **without changing the signature**.
*   Server base URL: configurable in `sync_meta`; provide it at install/setup time.

_If unanswered, build to the documented defaults and leave clean extension points._