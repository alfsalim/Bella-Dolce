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
