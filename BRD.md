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

## 7. Conclusion
The Bella Dolce Bakery Management System is positioned as a transformative tool for bakery owners. By combining traditional operational modules with cutting-edge AI capabilities, it provides a unique competitive advantage in the premium bakery market.
