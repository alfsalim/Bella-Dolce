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
