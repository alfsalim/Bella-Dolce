# Business Requirements Document (BRD) - Bella Dolce Bakery Management System

## 1. Executive Summary
The Bella Dolce Bakery Management System is a comprehensive, AI-powered solution designed to streamline the operations of a premium bakery. The system integrates sales, production, inventory, and financial management into a single platform, enhanced by advanced AI insights to drive efficiency and profitability.

## 2. Project Overview
The objective of this application is to replace manual processes with a digital workflow that provides real-time visibility into every aspect of the bakery business. It aims to reduce waste, optimize production planning, and provide management with actionable strategic data.

## 3. Business Objectives
*   **Operational Efficiency:** Automate production planning and inventory tracking to minimize manual errors and save time.
*   **Waste Reduction:** Use precise batch tracking and AI-driven insights to align production with actual demand.
*   **Financial Accuracy:** Ensure daily cash consistency through a structured reconciliation process.
*   **Data-Driven Decisions:** Empower management with AI-generated reports and a strategic chatbot for real-time operational queries.
*   **Scalability:** Provide a robust framework that can handle increasing transaction volumes and multi-role staff management.

## 4. Target Audience & User Roles
*   **Administrators:** Full access to all modules, including financial data, user management, and strategic AI insights.
*   **Managers:** Oversight of daily operations, production planning, and inventory control.
*   **Employees (Sales/Production):** Focused access to point-of-sale (POS) systems and production batch updates.

## 5. Functional Requirements

### 5.1 Dashboard & Real-Time Analytics
*   **Daily Overview:** Visual representation of total sales, active production batches, pending orders, and critical stock alerts.
*   **Performance Metrics:** Real-time tracking of revenue and production efficiency.

### 5.2 Sales & Point of Sale (POS)
*   **Transaction Recording:** Ability to process sales quickly with product selection and automatic total calculation.
*   **Inventory Validation:** Products with zero stock cannot be added to cart. "Add to Cart" button is disabled with visual feedback (reduced opacity).
*   **Stock-Aware Quantity:** When modifying cart quantities, the system prevents quantity from exceeding available stock. The quantity increase button is disabled when at max stock.
*   **Sales History:** Searchable log of all past transactions for auditing and customer service.
*   **Pending Payments:** Cashiers can open a POS lookup for sales with a remaining balance, filter by the remaining amount, and record additional payment against the original transaction.
*   **Partial Settlement:** When a pending balance is paid, the system updates the sale's paid amount, clears or reduces the remaining discount balance, and marks fully paid transactions as settled.
*   **Inventory Integration:** Automatic deduction of product stock upon successful sale (server-side atomic transaction).

### 5.3 Production Management
*   **Batch Planning:** Create and schedule production batches for specific products.
*   **Status Tracking:** Monitor batches through stages (Planned, In Progress, Completed).
*   **Ingredient Tracking:** Link production batches to raw material usage (future enhancement for automated deduction).

### 5.4 Inventory & Stock Control
*   **Product Management:** Track finished goods with minimum stock level alerts.
*   **Product Images:** Products display professional images sourced from Unsplash API for visual identification.
*   **Auto-Image Loading (Future Enhancement):** When new products are created, system automatically fetches and assigns relevant product images via Unsplash API based on product name/category, eliminating manual image upload requirement.
*   **Raw Material Management:** Monitor ingredients (flour, sugar, etc.) with low-stock notifications.
*   **Stock History:** Track movements and adjustments in inventory levels.
*   **Stock Locations:** Products tracked across two physical locations (Shop/Front Counter and Freezer) with automatic distribution maintenance.
*   **Traceability Principle:** "Nothing comes from nowhere" — all stock changes must be traceable via stock movements with documented reasons (purchase, sale, waste, transfer, etc.).

### 5.4.1 Purchase Management
*   **Purchase Orders:** Create purchase orders for raw materials from suppliers with specified quantities, prices, and brands.
*   **Supplier Integration:** Maintain supplier database with contact information and material history.
*   **Purchase Tracking:** Record purchase date, expiry date, cost price, and supplier details for each acquisition.
*   **Inventory Sync:** Auto-sync mechanism to convert approved purchases into inventory stock movements (reason='purchase').
*   **Status Workflow:** Purchase orders progress through states (Ordered, Received, Invoiced, Paid) with visibility into each stage.
*   **Cost Price Recording:** Track cost price per unit for COGS calculations and profitability analysis.

### 5.4.2 Waste Management & Tracking
*   **Waste Recording:** All waste is tracked via stock movements (reason='waste') with automatic journaling to both Activities and Waste Management tabs.
*   **Waste Sources:** Track waste from multiple sources including manual adjustments during inventory checks, production losses, and expiry/spoilage.
*   **Waste Logging:** When inventory stock is reduced during edit, the difference automatically creates a waste movement.
*   **Waste Audit Trail:** All waste transactions include timestamp, user, quantity, and reason for full auditability.
*   **No Waste Field:** Waste is NOT stored as a field on products/materials; it exists only as stock movements for traceability.
*   **Waste vs. Actual Stock:** Waste movements decrease actual usable stock; total stock can only increase through purchases or transfers, never through waste adjustment alone.

### 5.4.3 Stock Movement Audit Trail
*   **Movement Types:** All inventory changes create entries in stockMovements collection:
    - **Purchase:** Raw material acquisition from suppliers (increases stock)
    - **Sale:** Product sold through POS (decreases shop stock)
    - **Waste:** Product/material reduction during inventory checks or spoilage (decreases stock with waste reason)
    - **Transfer:** Movement between locations (shop ↔ freezer, maintains total stock)
    - **Adjustment:** Manual stock corrections by authorized staff
*   **Movement Details:** Each movement records:
    - Item ID and name
    - Item type (product or material)
    - Quantity changed
    - Previous and new stock levels
    - Location affected (shop, freezer, warehouse)
    - Reason for movement
    - Reference ID (batchId, orderId, purchaseId, etc.)
    - User who made the change
    - Timestamp of the transaction
*   **Real-Time Logging:** All movements logged immediately to Activities tab for staff awareness; waste-specific movements also appear in Waste Management tab for compliance/analysis.

### 5.4.4 Inventory Data Consistency & Cleanup
*   **Data Integrity:** All product inventory must maintain consistency where `stock = shopStock + freezerStock`. No orphaned inventory records allowed.
*   **Historical Cleanup (May 2, 2026):** Removed 6 products with inconsistent inventory data (stock totals that didn't match shop + frozen distribution). Retained only production and purchase-related inventory records.
*   **Product Restoration:** Restored 7 product definitions from seed data with clean, consistent inventory allocation:
    - Croissant au Beurre (45 units: 22 shop + 23 freezer)
    - Pain au Chocolat (38 units: 19 shop + 19 freezer)
    - Éclair au Chocolat (12 units: 6 shop + 6 freezer)
    - Tarte aux Fraises (8 units: 4 shop + 4 freezer)
    - Pain aux Raisins (25 units: 12 shop + 13 freezer)
    - Croissant aux Amandes (20 units: 10 shop + 10 freezer)
    - Paris-Brest (10 units: 5 shop + 5 freezer)
    - Mille-Feuille (12 units: 6 shop + 6 freezer)
*   **Current Product Inventory:** System now maintains 11 products, all with verified stock consistency.

### 5.5 Order Management
*   **Customer Orders:** Manage custom or bulk orders from creation to delivery.
*   **Status Workflow:** Track orders through Pending, Confirmed, Ready, and Delivered statuses.
*   **Special Orders:** Ad hoc, walk-in custom orders (e.g. bulk pastries, custom cakes) with a deposit/balance payment flow and a baker-facing kitchen ticket. See "Special Orders (Ad Hoc Custom Orders)" below.

### 5.6 Financial Management (Cash Reconciliation)
*   **Daily Closing:** A structured process to record system-calculated sales vs. actual physical cash in the drawer.
*   **Discrepancy Reporting:** Automatic identification and logging of cash differences for management review.

### 5.7 AI-Powered Insights (AI Manager)
*   **Daily Strategic Reports:** Automated generation of comprehensive reports analyzing sales, production, and efficiency.
*   **AI Chatbot:** A dedicated "AI Manager" prompt allowing users to ask natural language questions about the bakery's data.
*   **Strategic Recommendations:** AI-driven suggestions for improving profit and reducing waste based on historical patterns.

### 5.8 User Management & Security
*   **Role-Based Access Control (RBAC):** Restrict sensitive data (financials, AI reports) to authorized personnel only.
*   **Activity Logs:** A detailed audit trail of all significant actions taken within the system.

## 6. Non-Functional Requirements
*   **Usability:** Intuitive interface designed for high-paced bakery environments.
*   **Multi-Language Support:** Full support for French and Arabic, including Right-to-Left (RTL) layout compatibility.
*   **Accessibility:** High-contrast design and clear typography for readability in various lighting conditions.
*   **Reliability:** Real-time data synchronization to ensure all staff are working with the latest information.


## 7.1. receipe printing

Define the business requirements for printing sales receipts from the Boulangerie Bella-Dolce web application to a thermal receipt printer at the cashier point of sale.

---

## 2. Business Context

Boulangerie Bella-Dolce is a bakery located in Sidi-Abdellah, Alger. The business requires printed receipts for every customer transaction to:
- Provide customers with proof of purchase
- Support daily cash reconciliation
- Maintain transaction traceability

---

## 3. Scope

### 3.1 In Scope
- Receipt printing triggered from the web application
- Single thermal printer at the cashier station
- Cash and POS (card terminal) payment methods
- Bilingual support (French and Arabic)
- Receipt reprinting from transaction history

### 3.2 Out of Scope
- Barcode printing
- Loyalty points (Fidélité)
- Multiple printer support
- Kitchen order printing

---

## 4. Stakeholders

| Role | Responsibility |
|------|---------------|
| Cashier | Operates the POS, triggers payment and receipt printing |
| Store Manager | Configures receipt settings, accesses transaction history |
| Customer | Receives printed receipt |

---

## 5. Functional Requirements

### FR-01: Print Trigger
The system shall print a receipt automatically when the cashier clicks "Confirm Payment" in the payment popup.

### FR-02: Non-Blocking Printing
Printing shall never block or prevent a sale from being completed. If printing fails, the sale is still saved successfully.

### FR-03: Print Failure Notification
When printing fails, the system shall display an error notification to the cashier with the option to retry immediately.

### FR-04: Receipt Reprinting
The system shall allow reprinting any past receipt from the Transaction History page.

### FR-05: Single Copy
The system shall print one (1) copy per transaction by default. Additional copies are obtained via reprint.

### FR-06: Receipt Number
Each receipt shall have an auto-generated sequential number that resets daily.
- Format: `YYYYMMDD-NNN` (e.g., `20260510-001`)

### FR-07: Payment Method Display
The receipt shall display the payment method used:
- **Cash:** Display "Espèces" (FR) / "نقدي" (AR), and show amount received and change returned
- **POS/Card:** Display "Carte" (FR) / "بطاقة" (AR), and omit amount received and change lines

---

## 6. Receipt Layout

### 6.1 Header
| Element | Content |
|---------|---------|
| Logo | Bakery logo image (PNG) — configurable: enable/disable |
| Store Name | Boulangerie Bella-Dolce |
| Store Address | SIDI-ABDELLAH ALGER |

### 6.2 Transaction Info
| Element | Description |
|---------|-------------|
| Cashier | Name of the cashier (e.g., "Caissier : REDA") |
| Date & Time | Transaction date and time (e.g., "03/05/2026 16:10") |
| Client Name | Customer name — optional field |
| Receipt Number | Daily sequential number (e.g., "20260510-001") |

### 6.3 Items Table
| Column | Description |
|--------|-------------|
| Produit | Product name |
| Qté | Quantity |
| Prix U. | Unit price |
| Montant | Line total (Qty × Unit Price) |

### 6.4 Totals Section
| Element | Description |
|---------|-------------|
| Nbr. Produit | Number of distinct products |
| Nbr. Unité | Total number of units |
| Total | Grand total amount |

### 6.5 Payment Section
| Element | Condition | Description |
|---------|-----------|-------------|
| Payment Method | Always | "Espèces" or "Carte" |
| Mont. Reçu | Cash only | Amount received from customer |
| Mont. Rendu | Cash only | Change returned to customer |

### 6.6 Footer
| Element | Content |
|---------|---------|
| Thank you message (FR) | "Merci pour votre visite. Demandez votre ticket, il vous sera demandé en cas de réclamation" |
| Thank you message (AR) | Arabic translation — displayed when Arabic layout is selected |

---

## 7. Language & Localization

### LR-01: Supported Languages
The system shall support French (FR) and Arabic (AR) for receipt content.

### LR-02: Default Language
French shall be the default receipt language.

### LR-03: Configurable Layout
The receipt language/layout shall be configurable from application settings. Options include:
- French only
- Arabic only
- Bilingual (configurable arrangement)

### LR-04: Currency
All monetary values shall be displayed in Algerian Dinar (DZD).
- Format: `1 544.00 DA`

---

## 8. Configuration Requirements

### CR-01: Receipt Content Configuration
The following elements shall be configurable from application settings:

| Element | Configurable? |
|---------|--------------|
| Store name | Yes |
| Store address | Yes |
| Logo image (enable/disable + file) | Yes |
| Footer message | Yes |
| Receipt language | Yes |
| Currency format | Yes |

### CR-02: Technical Configuration
The following shall be configurable via environment/configuration files:

| Element | Configurable? |
|---------|--------------|
| Printer name | Yes |
| Print service port | Yes |
| Print service URL | Yes |

### CR-03: Configuration Sources
- **Translation labels:** `constants.ts`
- **Technical config:** `.env`
- **Application config:** `app.config`

---

## 9. Printer Requirements

| Requirement | Value |
|-------------|-------|
| Printer Model | Xprinter D200 |
| Connection | USB |
| Paper Width | 80mm |
| Driver | Installed and visible in Windows Printers & Scanners |

---

## 10. Non-Functional Requirements

### NFR-01: Reliability
The printing mechanism shall not impact the core sales workflow. A print failure shall never cause data loss or block a transaction.

### NFR-02: Performance
Receipt printing shall initiate within 2 seconds of the "Confirm Payment" action.

### NFR-03: Availability
The print service shall start automatically when the cashier machine boots and restart automatically on failure.

### NFR-04: Maintainability
The print module shall reside in the same repository as the main application for unified maintenance.

---

## 11. Acceptance Criteria

| # | Criteria |
|---|---------|
| AC-01 | Cashier clicks "Confirm Payment" and receipt prints successfully with all required fields |
| AC-02 | Receipt displays correct store header: "Boulangerie Bella-Dolce" + "SIDI-ABDELLAH ALGER" |
| AC-03 | Receipt displays logo when logo printing is enabled |
| AC-04 | Receipt displays all items with correct name, quantity, unit price, and amount |
| AC-05 | Receipt displays correct totals (product count, unit count, grand total) |
| AC-06 | Cash payment receipt shows amount received and change; POS receipt does not |
| AC-07 | Receipt number follows daily sequential format (YYYYMMDD-NNN) |
| AC-08 | Sale is saved successfully even when printing fails |
| AC-09 | Error notification is shown on print failure with retry option |
| AC-10 | Past receipts can be reprinted from Transaction History |
| AC-11 | Receipt prints in French by default |
| AC-12 | Receipt prints in Arabic when Arabic layout is selected |
| AC-13 | All configurable fields can be modified without code changes |
| AC-14 | No barcode or loyalty points appear on receipt |

---

## 12. Reference Receipt Layout (Visual)

┌──────────────────────────────────────┐

│          [LOGO - if enabled]         │

│                                      │

│     Boulangerie Bella-Dolce          │

│       SIDI-ABDELLAH ALGER            │

│                                      │

│ Caissier : XXXXX    DD/MM/YYYY HH:MM│

│ Client : XXXXX (optional)            │

│ Reçu N° : YYYYMMDD-NNN              │

│──────────────────────────────────────│

│ Produit      Qté  Prix U.   Montant │

│──────────────────────────────────────│

│ XXXXXXXXXX    X   XXX.XX    XXX.XX  │

│ XXXXXXXXXX    X   XXX.XX    XXX.XX  │

│ XXXXXXXXXX    X   XXX.XX    XXX.XX  │

│──────────────────────────────────────│

│ Nbr. Produit : X                     │

│ Nbr. Unité   : X    Total: X XXX.XX │

│──────────────────────────────────────│

│                                      │

│ Paiement : Espèces / Carte          │

│              Mont. Reçu : X XXX.XX  │ ← Cash only

│              Mont. Rendu :   XXX.XX  │ ← Cash only

│                                      │

│──────────────────────────────────────│

│ Merci pour votre visite. Demandez    │

│ votre ticket, il vous sera demandé   │

│ en cas de réclamation                │

└──────────────────────────────────────┘

## 7. Implementation Notes & Recent Updates

### 7.1 Inventory System Validation (May 2, 2026)
*   **Issue:** Manual inventory entries created prior to system enhancements resulted in inconsistent data (total stock without proper shop/freezer distribution).
*   **Resolution:** Cleaned inconsistent inventory records while preserving production and purchase-related data; restored product definitions with clean stock allocation.
*   **Verification:** All 11 products verified to maintain `stock = shopStock + freezerStock` invariant.
*   **Testing:** Manual verification in Inventory and Production pages confirms all products display with correct stock levels.

## 8. Conclusion
The Bella Dolce Bakery Management System is positioned as a transformative tool for bakery owners. By combining traditional operational modules with cutting-edge AI capabilities, it provides a unique competitive advantage in the premium bakery market.



# User Stories & Use Cases Document - Bella Dolce Bakery Management System

## 1. Introduction
This document provides a detailed breakdown of the user stories and functional use cases for the Bella Dolce Bakery Management System. It serves as a guide for understanding how different user roles interact with the platform to achieve business goals.

---

## 2. User Personas (Actors)
*   **Administrator (Admin):** The business owner with full oversight of financials, staff, and strategic AI data.
*   **Manager:** Responsible for daily operations, production planning, and inventory accuracy.
*   **Sales/Production Employee:** Front-line staff who record sales and update production statuses.

---

## 3. User Stories

### 3.1 Authentication & Profile
*   **US.1:** As a user, I want to log in securely so that I can access features relevant to my role.
*   **US.2:** As a user, I want to switch between French and Arabic so that I can use the app in my preferred language.
*   **US.3:** As a user, I want to update my profile information to keep my contact details current.

### 3.2 Dashboard & Analytics
*   **US.4:** As a manager, I want to see a summary of today's sales and production so that I can quickly assess business health.
*   **US.5:** As an admin, I want to view real-time revenue charts to track financial performance over time.

### 3.3 Sales (Point of Sale)
*   **US.6:** As a sales employee, I want to quickly select products and process a sale so that customers aren't kept waiting.
*   **US.7:** As a manager, I want to view a history of all sales to audit transactions and handle customer inquiries.

### 3.4 Production Management
*   **US.8:** As a manager, I want to create production batches for specific products so that the production team knows what to bake.
*   **US.9:** As a production employee, I want to update the status of a batch (e.g., from "In Progress" to "Completed") so that the sales team knows when fresh stock is available.

### 3.5 Inventory Management
*   **US.10:** As a manager, I want to track the stock levels of finished products so that I can prevent "out-of-stock" situations.
*   **US.11:** As a manager, I want to monitor raw material levels (flour, sugar, etc.) so that I can reorder supplies before they run out.

### 3.6 Order Management
*   **US.12:** As a sales employee, I want to record custom customer orders with specific pickup dates so that we can fulfill them on time.
*   **US.13:** As a manager, I want to update order statuses (Pending, Confirmed, Ready, Delivered) to keep track of fulfillment progress.

### 3.7 Financial Management (Cash Reconciliation)
*   **US.14:** As a manager, I want to perform a daily cash closing by entering the actual cash in the drawer so that I can identify any discrepancies with system-calculated sales.
*   **US.15:** As an admin, I want to review a history of cash closings to identify patterns of financial loss or theft.

### 3.8 AI Manager
*   **US.16:** As an admin, I want the AI to generate a daily strategic report so that I can get insights into performance without manual analysis.
*   **US.17:** As an admin, I want to ask the AI specific questions (e.g., "Which product was most profitable today?") to get immediate data-driven answers.

---

## 4. Detailed Use Cases

### UC.1: Process a Sale (POS)
*   **Actor:** Sales Employee, Manager, Admin
*   **Precondition:** User is logged in and on the Sales page.
*   **Trigger:** A customer wants to purchase items.
*   **Main Flow:**
    1.  User selects one or more products from the list.
    2.  User adjusts quantities if necessary.
    3.  System calculates the total amount.
    4.  User clicks "Complete Sale."
    5.  System records the transaction and deducts stock from inventory.
*   **Postcondition:** Sale is logged, stock is updated, and a success message is displayed.

### UC.2: Create a Production Batch
*   **Actor:** Manager, Admin
*   **Precondition:** User is on the Production page.
*   **Trigger:** Need to replenish stock or fulfill orders.
*   **Main Flow:**
    1.  User clicks "New Batch."
    2.  User selects the product to be produced.
    3.  User enters the planned quantity.
    4.  User sets the status to "Planned."
    5.  User saves the batch.
*   **Postcondition:** A new batch appears in the production list with a "Planned" status.

### UC.3: Perform Daily Cash Closing
*   **Actor:** Manager, Admin
*   **Precondition:** It is the end of the business day.
*   **Trigger:** Closing the register.
*   **Main Flow:**
    1.  User navigates to the Cash Reconciliation page.
    2.  System displays the "Calculated Sales" based on recorded transactions.
    3.  User enters the "Actual Cash" physically present in the drawer.
    4.  User adds any optional notes.
    5.  User clicks "Save Closing."
    6.  System calculates the "Difference" (Discrepancy).
*   **Postcondition:** A reconciliation record is created, and any discrepancy is highlighted for the Admin.

### UC.4: Interact with AI Manager Chat
*   **Actor:** Admin
*   **Precondition:** User is on the AI Manager page.
*   **Trigger:** Admin has a specific question about bakery operations.
*   **Main Flow:**
    1.  User selects a specific date for data context.
    2.  User types a question in the "Ask AI Manager" prompt.
    3.  System sends the question along with the selected date's data to the AI.
    4.  AI processes the data and generates a response in the user's current language.
    5.  System displays the AI's response.
*   **Postcondition:** Admin receives a data-driven answer to their query.

---

## 5. Conclusion
This document outlines the essential interactions within the Bella Dolce Bakery Management System. By following these user stories and use cases, the development and management teams can ensure that the application meets the core business needs of efficiency, accuracy, and strategic growth.



# POS Lite — Offline-First Chrome Extension (2026-06-11)

## Summary
A self-contained Manifest V3 Chrome extension (`/PosLite`, sibling to `/PrintAgent`) that lets cashiers ring up sales fully offline and sync them to the existing backend when connectivity returns. Spec source: `doc/Bella Dolce POS Lite — Offline-First Chrome Extension (BRD + Build Spec for Claude Code)-20260610175240.md` (read-only).

## Backend changes (additive only)
- `prisma/schema.prisma`: added `clientTxnId String? @unique` to `Sale` (migration `20260611120000_add_sale_client_txn_id`).
- `POST /api/sale`: accepts optional `clientTxnId`; if a sale with that id already exists, returns it instead of creating a duplicate (idempotent retry/sync).
- `POST /api/auth/login`: accepts optional `deviceLogin: true`; issues a 30-day token (vs default 8h) for use by the extension's background sync engine only.

## Extension architecture (`/PosLite`)
- **Stack**: Vite + `@crxjs/vite-plugin`, React 19, TypeScript strict, Tailwind v4, Zustand, Dexie.js (IndexedDB).
- **Local data**: `transactions` (sale queue, PK `clientTxnId`), `products` (cache from `GET /api/db/products`), `users` (cache for offline login), `sync_meta` (auth token, device id, PrintAgent URL).
- **Sync**: one-way, cashier/tablet → server. `chrome.alarms` runs sync every 30s and cache refresh every 15min. On successful `POST /api/sale`, the local transaction row is purged immediately (no archive). Failed pushes retry with backoff (30s/1m/5m/15m capped) and surface in a "Failed Sales" panel with manual retry.
- **Login**: online uses `POST /api/auth/login`; offline falls back to the cached `users` table + `bcrypt.compareSync` against the cached password hash.
- **Printing**: cashier machines call the local PrintAgent (`http://localhost:5555/print`) directly from the extension (not via `/api/print-receipt`, which would resolve PrintAgent on the server's network). Tablets have no `printAgentUrl` configured — printing is silently skipped and only the on-screen `ReceiptPreview` is shown.
- **Header status indicator**: dot next to the cashier profile — green/red based on `GET /api/health` reachability, with a pending-sync count badge.
- **i18n**: self-contained AR/FR/EN translation table in `PosLite/src/constants.ts`.

## Known gaps (flagged, not silently worked around)
- No existing endpoint returns `username` + password hash together for offline-login provisioning (`GET /api/db/users` strips the password via `sanitizeUser`; `GET /api/cashiers` returns only `{id, name, role}`). Until a backend endpoint is added, the offline `users` cache has empty `username`/`password`, and offline login surfaces a clear error rather than failing silently. Online login is unaffected.
- `Product` has no `taxRate` field; PosLite sales are computed with tax = 0 until the catalog adds one.

## Test coverage
- `src/__tests__/pos-lite-sync-api.test.ts`: unit tests for `clientTxnId` dedupe lookup logic (3 cases) and `deviceLogin` token-expiry logic (3 cases).
- Full backend suite: `npm run test` — 112/112 passing (106 pre-existing + 6 new).
- `PosLite`: `npx tsc --noEmit` clean; `npx vite build` produces a complete unpacked extension in `PosLite/dist/`.
- Manual E2E (offline sale → sync → purge → dedupe, and PrintAgent vs tablet printing) — pending, to be run by loading `PosLite/dist` as an unpacked extension in Chrome.



# Special Orders — Ad Hoc Custom Orders (2026-08-09)

## Summary
Extends the existing Order model/page (`src/pages/Orders.tsx`, `prisma/schema.prisma` `Order` model) — not a new table or page — so staff can take a walk-in, pay-a-deposit, pick-up-later custom order (e.g. "50 chocolate croissants" or a custom cake) directly from the Orders screen. Supports multiple catalog products per order (mini-cart UI, collapses to a single simple row when only one product is picked), ad hoc per-item customization (flavor/glaze/shape/size/addons) that persists for reuse across future orders, a deposit or full-payment collected at creation, an immediate large-font no-price kitchen ticket for the baker, and a formal "close" at pickup that requires collecting the full remaining balance (no partial close).

## Data model changes (`prisma/schema.prisma`)
- `Order.customerId`: `String` → `String?` — walk-in special orders have no `Customer` record (no B2B/B2C customer is created for them).
- `Order`: added `firstName String?`, `lastName String?`, `phone String?` (walk-in identity, stored directly on the order row), `amountPaid Float?` (cumulative amount collected — deposit, then balance; mirrors `Sale.amountPaid`), `paymentStatus String @default("n/a")` (`deposit` | `paid_full` | `closed`; only meaningful when `type === 'special'`).
- `Order.items` (JSON string, unchanged shape at the schema level) — each item in the JSON array may now carry an optional `specifications: { flavor?, glaze?, shape?, size?, addons? }` object.
- New model `SpecificationOption` (`id`, `category` — `flavor|glaze|shape|size|addon`, `value`, `createdAt`, `@@unique([category, value])`) — the ad hoc catalog of customization values, registered in `server.ts`'s `getModel()` as `specificationOptions` for free CRUD via `/api/db/specificationOptions`.
- `Order`: added `cancellationReason String?` — mandatory (enforced client-side) free-text reason captured when an order is cancelled via the dedicated Cancel action described below. Applies to every order type, not just special orders.
- Migrations: `20260808223255_special_orders`, `20260809154531_order_cancellation_reason`.
- `orderDate` reuses the existing `createdAt`; delivery date/time reuse the existing `expectedDate`/`expectedTime` fields — no new fields needed for either.

## Backend changes (`server.ts`)
- `POST /api/orders/:id/close`: loads the order, computes `balance = totalAmount - (amountPaid || 0)`, rejects with 400 if the submitted `amountPaid` is less than the full remaining balance (no partial close), otherwise sets `amountPaid = totalAmount`, `paymentStatus = 'closed'`, `status = 'delivered'`.
- `POST /api/print-order-receipt`: a new, separate route (the working POS `/api/print-receipt` flow is untouched) — sources items/total/amountPaid from an `Order` row instead of a `Sale`, forwards to PrintAgent's existing `/print` endpoint (the order id is passed into `PrintJob.SaleId`, which is just a string field), with an optional `isDeposit` flag that overrides the printed receipt label ("Acompte" vs the default "Reçu").
- `POST /api/print-kitchen-ticket`: health-checks PrintAgent, then forwards order id / customer name / delivery date+time / items (name, quantity, `specifications` formatted as text) / notes to a new PrintAgent endpoint. Called once, always, immediately after a special order is created — independent of payment status.

## PrintAgent changes (`/PrintAgent`, .NET)
- `Models/PrintJob.cs`: new `KitchenTicketJob` (`OrderId`, `CustomerName`, `DeliveryDate`, `DeliveryTime`, `Items: [{Name, Quantity, SpecificationsText}]`, `Notes`) and `KitchenTicketItem`.
- `Controllers/PrintController.cs`: new `POST /print/kitchen-ticket`, mirroring the existing `/print` action's validation/response shape.
- `Services/IPrintService.cs`, `ThermalPrintService.cs`, `EmulatorPrintService.cs`: new `PrintKitchenTicketAsync(KitchenTicketJob)` on both implementations. The thermal renderer uses large bold fonts (16–20pt vs the receipt path's 9–12pt) for product name/quantity/specs, with delivery date & time drawn largest/boldest since that's what the baker needs to spot fastest — no price fields anywhere in this render path. Requires a PrintAgent rebuild/redeploy alongside the app deploy.

## Frontend changes
- `src/components/EditableSelect.tsx` (new): a dropdown populated from `/api/db/specificationOptions?category=X` plus a "+ Add new" inline flow — typing a new value POSTs it to `specificationOptions` and selects it immediately. Used for all 5 customization categories.
- `src/pages/Orders.tsx`: "New Special Order" action next to the Orders/Tracking tabs, opening a creation form — first/last name + a combined "Date et heure prévue" field (date+time side by side, defaulted to exactly two days from the moment the form opens, both date and time components), then phone (defaults to a pre-filled `"0"`; validated as exactly 10 digits starting with `0`, both via `pattern`/client-side check and a `phoneInvalid` error toast) alongside the downpayment field, then a product+quantity+price mini-cart (labeled fields, starts as one row with an "add another product" button, each row expandable to a 2-per-row flavor/glaze/shape/size/addons grid), then a 2-row notes textarea. On submit: creates the order (`type: 'special'`), fires `/api/print-kitchen-ticket`, then fires `/api/print-order-receipt` for whatever was collected. List rendering branches on `order.type === 'special'` to show first/last name, phone, payment status and balance due instead of the B2B delivery-guy fields, with a "Close Order" action gated on the full balance being entered.
- **Order cancellation** (applies to every order, not just special orders): `cancelled` was removed from the ordered/in-progress/delivered status toggle group and replaced with a dedicated red "Annuler la commande" action, positioned next to the "Éditer la facture" (invoice) button rather than in the status-toggle row, shown whenever an order isn't already `cancelled` or `delivered`. Clicking it opens a secondary-validation popup (`role="dialog"`) with a mandatory cancellation-reason textarea — the confirm button stays disabled until a reason is entered (`cancellationReasonRequired` toast if bypassed). Confirming: restores shop stock for every line item (same logic the old cancelled-status branch used), then updates the order via the generic `PUT /api/db/orders/:id` route with `status: 'cancelled'`, `amountPaid: 0`, `paymentStatus: 'n/a'`, and the mandatory `cancellationReason`. Zeroing `amountPaid` is what keeps a refunded deposit out of revenue — `Reports.tsx`'s cash-basis `amountPaid` aggregation and the special-order downpayment/balance summary both read from the same field, so no separate reporting change was needed. The order row itself is never deleted — it stays logged with `status: 'cancelled'` for audit. Card/list views hide the special-order payment-status and balance-due lines once an order is cancelled (showing stale "Solde restant" on a refunded order would be misleading) and fall back to the regular `createdBy` display instead.

## Daily Orders Reminder (2026-08-09)
A popup that greets logged-in staff once a day at a configurable time, listing any of today's orders (`expectedDate` = today) that still need fulfilling (`status` in `ordered | in-progress | delayed`). No schema or backend changes — it reuses the existing shop-wide `Setting` model exactly the way `backup_config` already does.

- **Configuration** (`src/pages/Settings.tsx`, "Display & Notifications" section, `general` tab): an enabled toggle + `<input type="time">`, loaded from and saved to `/api/db/settings/order_reminder_config` (`{ enabled: boolean, time: 'HH:mm' }`, default `{ enabled: true, time: '06:00' }`) via the generic `/api/db/settings/:id` route — no admin-only restriction was added (unlike `backup_config`), since any staff member who can reach Settings can already toggle the equivalent local `systemAlerts` preference there.
- **Popup** (`src/components/DailyOrdersReminder.tsx`, new; mounted in `src/App.tsx` next to `<SystemAlerts />` so it's present on every route): gated on `user && profile && isStaffRole(profile.role)` — covers both a fresh login and an already-open session that crosses the configured time, since `AuthContext` has no distinct "just logged in" signal to key off instead. Runs an immediate check on mount plus every 60s (`setInterval`) while a staff user is present. A check: reads the config; skips if disabled; skips if the local clock hasn't reached the configured time yet; skips if already shown today for this user (localStorage key `bd_order_reminder_shown_${userId}_${YYYY-MM-DD}`, so it can show again the next calendar day and doesn't retrigger on every render); otherwise fetches today's qualifying orders and — only if there's at least one — shows the dialog and lists them (customer/description, short id, expected time), with "Voir les commandes" (navigates to `/orders`) and a plain dismiss.
- **Real bug found while wiring this up**: `expectedDate` is a plain `String` column storing `"YYYY-MM-DD"`, not a `DateTime`. Both the client's `where()` helper (`src/lib/db.ts`) and the server's `deepNormalizePrismaWhere` (`server.ts`) coerce any calendar-day-shaped filter *value* into an ISO datetime, assuming it's targeting a `DateTime` column — so `where('expectedDate', '==', today)` silently matched zero rows against this specific `String` column, confirmed by hand via `curl` before diagnosing it. Fixed by fetching `orders` unfiltered and comparing `order.expectedDate === todayStr` client-side — the same workaround `Reports.tsx` already uses for all of its own order-date filtering, so this isn't a new pattern, just a previously-undiscovered edge of an existing one. Left the shared where-clause helpers untouched since "fix" there would require knowing per-field types the generic layer doesn't track, and could silently change behavior for the `DateTime` fields it's actually meant for.
- **Test-isolation note**: since the popup is globally mounted and genuinely can appear over the Orders page in real usage (`z-[200]`, above the special-order/cancel modals' `z-[100]`), `e2e/special-order.spec.ts`'s `openSpecialOrderModal` helper now dismisses it if present before interacting with anything else, rather than relying on it happening to be absent during a test run.
- `src/types.ts`: `Order.customerId` now optional; added `firstName`/`lastName`/`phone`/`amountPaid`/`paymentStatus`; `SaleItem` (used for order line items) gained an optional `specifications: OrderItemSpecifications`; added `SpecificationOption` type.
- `src/constants.ts`: FR + AR keys for every new label. (This project's `Language` type is `'fr' | 'ar'` only — there is no `'en'` locale anywhere in `TRANSLATIONS`/the language switcher, so no English keys were added for this feature, matching every other feature in the codebase.)
- `src/pages/Reports.tsx`: type filter chip (All / B2B / Special) on the order report section, plus a downpayment-collected vs balance-outstanding summary for special orders in the selected range. Revenue is recognized on a cash basis (`amountPaid`) — a deposit counts immediately, the balance counts when collected at close — same as `Sale.amountPaid` elsewhere.

## Known gaps / decisions (flagged, not silently worked around)
- No `Customer` record is created for walk-in special orders by design — `customerId` is null and first/last name + phone live directly on the `Order` row.
- Closing an order requires paying the *exact* remaining balance or more; there is no partial-close path, per the explicit "no partial close" requirement. Overpayment is accepted but `amountPaid` is always set to `totalAmount` (no change-tracking for special orders).
- A real bug was found and fixed during e2e testing: the "Close Order" balance input is pre-filled with the correct remaining balance as a display default, but that default was not tracked in the component's `closeBalanceInput` state until the user actually edited the field. Clicking "Close" without touching the (already-correct) pre-filled value caused the submitted amount to be read as `0`, incorrectly rejecting the close. Fixed by giving `handleCloseOrder` the same fallback-to-balance default used by the input and the button's `disabled` check (`src/pages/Orders.tsx`).

## Test coverage
- `src/__tests__/special-orders-api.test.ts`: special-order creation validation (required fields, walk-in has no `customerId`), phone format (10 digits starting with `0` — accepts/rejects wrong prefix, too short, too long, non-digit characters), mini-cart totals for 1 vs N products, `SpecificationOption` dedup via `@@unique([category, value])`, `POST /api/orders/:id/close` rejecting a partial amount and succeeding on the exact balance, a regression test for the pre-filled-balance-input bug above, and order-cancellation coverage (mandatory reason enforced, refunded deposit zeroes `amountPaid`, order still logs with `status: 'cancelled'` plus the stored reason, cancel is confirmed absent from the status-toggle option list).
- `src/__tests__/daily-orders-reminder.test.ts`: time-gating (before/at/after the configured `HH:mm`, malformed-time fallback), disabled-config short-circuit, which orders qualify (today + unfulfilled status only; explicitly excludes `delivered`/`cancelled` and other days), the `expectedDate`-is-a-plain-string regression above, and the once-per-user-per-day localStorage key (distinct per user, distinct per day, stable for the same user+day).
- Full Vitest suite: `npm run test` — 163/163 passing.
- `e2e/special-order.spec.ts` (Playwright, first e2e spec in this project — `vitest.config.ts` updated to exclude `e2e/**` so Vitest doesn't try to collect it): (1) creates a special order end-to-end, types a brand-new flavor value via `EditableSelect` and confirms it persists and reappears on a second order, verifies the order renders with the correct balance in the Orders list, then closes it and confirms the status flips to closed/delivered; (2) creates a paid special order, opens the Cancel dialog, confirms the confirm button is disabled until a reason is typed, cancels it, and asserts via the actual `PUT` response that `status`/`amountPaid`/`cancellationReason` all landed correctly. Both dismiss the daily reminder popup first if present. Passing against a live dev instance (`PORT=3500 npx playwright test e2e/special-order.spec.ts`).
- Manual verification: created and closed several special orders against the running dev server via the actual UI and API — order creation, balance display, close-order rejection/success, and payment status transitions all behave correctly. For the reminder: set `order_reminder_config` to `{enabled:true, time:'00:00'}` via the API, created a today-dated unfulfilled order, confirmed the popup appears on login/reload with the correct order listed, confirmed it stays dismissed on a same-day reload, then reset the config back to the default and deleted the test order. PrintAgent itself was not running in this dev environment (no `dotnet` SDK available to build/run it in this session), so `/api/print-kitchen-ticket` and `/api/print-order-receipt` were only exercised through their graceful `printer_unavailable` path, not against a live `EmulatorPrintService`/`ThermalPrintService` — that render path still needs a manual pass with PrintAgent actually running.
