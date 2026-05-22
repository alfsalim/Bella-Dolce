# Boulangerie Bella-Dolce — Receipt Printing Solution Specification

## Document Info
- **Project:** Bella Dolce Bakery Management System
- **Module:** Receipt Printing
- **Author:** Salim Toutah (30069508)
- **Workspace:** ENOWA
- **Date:** 2026-05-10
- **Version:** 1.0

---

## 1. Executive Summary

This specification defines a receipt printing solution for the Boulangerie Bella-Dolce web application. A Node.js/TypeScript print agent runs as a Windows service on the cashier machine, receives print jobs from the Dockerized Fastify backend, and sends ESC/POS commands to an Xprinter D200 thermal printer via USB.

---

## 2. Architecture

### 2.1 Print Flow

User clicks "Confirm Payment" (React Frontend)

↓

POST /api/print-receipt (Fastify Backend — Docker :3000)

↓

POST http://host.docker.internal:9100/print (Node.js Print Agent — Windows Service)

↓

ESC/POS raw commands via USB

↓

Xprinter D200 — Receipt prints 🧾

### 2.2 Components

| Component | Technology | Runs On | Port |
|-----------|-----------|---------|------|
| Frontend | React + Vite + Tailwind | Docker | 5173 |
| Backend | Fastify + TypeScript | Docker | 3000 |
| Database | SQLite via Prisma | Docker | — |
| Print Agent | Node.js + TypeScript | Windows Service | 9100 |
| Printer | Xprinter D200 | USB on Windows 11 | — |

### 2.3 Docker-to-Host Communication

- Uses `host.docker.internal` (Docker Desktop for Windows built-in DNS)
- Configured in `.env`: `PRINT_AGENT_URL=http://host.docker.internal:9100`

### 2.4 Repository Structure

Same monorepo:

bella-dolce/

├── frontend/              # React app

├── src/                   # Fastify backend

├── prisma/                # Database schema

├── print-agent/           # Node.js Print Agent (NEW)

│   ├── src/

│   │   ├── index.ts       # Express/Fastify server on :9100

│   │   ├── printer.ts     # ESC/POS command builder

│   │   ├── receipt.ts     # Receipt layout/formatting

│   │   ├── logo.ts        # Logo image processing

│   │   └── config.ts      # Configuration loader

│   ├── assets/

│   │   └── logo.png       # Store logo

│   ├── installer/

│   │   └── setup.iss      # Inno Setup script

│   ├── package.json

│   ├── tsconfig.json

│   └── .env               # Print agent config

├── constants.ts           # Translation labels (FR/AR)

├── app.config             # Application config

└── .env                   # Main app config

---

## 3. Hardware

| Item | Detail |
|------|--------|
| Printer Model | Xprinter D200 |
| Connection | USB |
| Paper Width | 80mm (~42-48 chars/line) |
| Protocol | ESC/POS raw commands |
| Driver | Installed in Windows Printers & Scanners |
| Host OS | Windows 11 |

---

## 4. Receipt Layout

### 4.1 Header

  [LOGO — PNG image, configurable]

Boulangerie Bella-Dolce
  SIDI-ABDELLAH ALGER
──────────────────────────────────

### 4.2 Transaction Info

Caissier : [NAME]       [DD/MM/YYYY] [HH:MM]

Client : [NAME]                (optional)

──────────────────────────────────

### 4.3 Items Table

Produit        Qté   Prix U.    Montant

──────────────────────────────────

PAIN SEMOULE     3     20.00      60.00

CROISSANT        2     50.00     100.00

...

──────────────────────────────────

### 4.4 Totals

Nbr. Produit : [X]    Total :   [X XXX.00]

Nbr. Unité   : [X]

### 4.5 Payment (Cash)

          Paiement : Espèces
          Mont. Reçu :    [X XXX.00]
          Mont. Rendu :     [XXX.00]

### 4.6 Payment (POS/Card)

          Paiement : Carte

_(No "Mont. Reçu" / "Mont. Rendu" lines for card payments)_

### 4.7 Receipt Number

          REC: 20260510-001

Format: `YYYYMMDD-SEQ` — resets daily.

### 4.8 Footer

**French (default):**
──────────────────────────────────

Merci pour votre visite. Demandez

votre ticket, il vous sera demandé

en cas de réclamation

──────────────────────────────────

**Arabic (when AR layout selected):**
──────────────────────────────────

شكرا لزيارتكم. احتفظوا بالتذكرة

سيُطلب منكم تقديمها في حالة

تقديم شكوى

──────────────────────────────────

### 4.9 Fields Excluded

- ❌ Barcode
- ❌ Fidélité (loyalty points)
- ❌ Solde (balance)

---

## 5. Configuration

### 5.1 `.env` (Print Agent — Technical)

```env
PRINT_AGENT_PORT=9100
PRINTER_NAME=XPrinter D200
USB_VENDOR_ID=      # if needed
USB_PRODUCT_ID=     # if needed


5.2 app.config (Application Config)


{
  "store": {
    "name": "Boulangerie Bella-Dolce",
    "subtitle": "SIDI-ABDELLAH ALGER",
    "logo": {
      "enabled": true,
      "path": "assets/logo.png"
    }
  },
  "receipt": {
    "language": "fr",
    "currency": "DA",
    "numberFormat": "space",
    "copies": 1,
    "footer": {
      "fr": "Merci pour votre visite. Demandez votre ticket, il vous sera demandé en cas de réclamation",
      "ar": "شكرا لزيارتكم. احتفظوا بالتذكرة سيُطلب منكم تقديمها في حالة تقديم شكوى"
    },
    "receiptNumberFormat": "YYYYMMDD-SEQ",
    "receiptNumberResetFrequency": "daily"
  },
  "printer": {
    "agentUrl": "http://host.docker.internal:9100",
    "paperWidth": 80,
    "charsPerLine": 42
  }
}


5.3 constants.ts (Translation Labels)


export const RECEIPT_LABELS = {
  fr: {
    cashier: "Caissier",
    client: "Client",
    product: "Produit",
    qty: "Qté",
    unitPrice: "Prix U.",
    amount: "Montant",
    productCount: "Nbr. Produit",
    unitCount: "Nbr. Unité",
    total: "Total",
    amountReceived: "Mont. Reçu",
    changeGiven: "Mont. Rendu",
    paymentMethod: "Paiement",
    cash: "Espèces",
    card: "Carte",
    receiptNumber: "REC",
  },
  ar: {
    cashier: "الصندوق",
    client: "الزبون",
    product: "المنتج",
    qty: "الكمية",
    unitPrice: "سعر الوحدة",
    amount: "المبلغ",
    productCount: "عدد المنتجات",
    unitCount: "عدد الوحدات",
    total: "المجموع",
    amountReceived: "المبلغ المدفوع",
    changeGiven: "المبلغ المسترجع",
    paymentMethod: "طريقة الدفع",
    cash: "نقدي",
    card: "بطاقة",
    receiptNumber: "رقم الوصل",
  },
};


6. API Contracts


6.1 Fastify Backend Endpoint


POST /api/print-receipt



Request body:

{
  "SaleId": "sale-abc-123",
  "ReceiptNumber": "20260510-001",
  "Date": "2026-05-10",
  "Time": "16:10:00",
  "CashierName": "REDA",
  "PaymentMethod": "cash",
  "Items": [
    {
      "Name": "PAIN SEMOULE BOULA",
      "Quantity": 3,
      "UnitPrice": 20.00,
      "LineTotal": 60.00
    }
  ],
  "Subtotal": 1544.00,
  "TaxRate": 0,
  "TaxAmount": 0,
  "Total": 1544.00,
  "AmountPaid": 2055.00,
  "ChangeGiven": 511.00,
  "ProductCount": 7,
  "UnitCount": 10,
  "Comment": "discount 100DZ / خصم 100DA",
  "PrintLanguage": "BOTH"
}


Response:



// Success
{ "success": true, "receiptNumber": "20260510-001" }

// Failure
{ "success": false, "error": "Printer offline" }


6.2 Print Agent Endpoint


POST http://localhost:9100/print



Request body: same as above + receiptNumber added by backend.



Response:



// Success
{ "success": true, "message": "Receipt printed" }

// Failure
{ "success": false, "error": "USB device not found" }


6.3 Print Agent Health Check


GET http://localhost:9100/health



Response:



{
  "status": "ok",
  "printer": "online",
  "printerName": "XPrinter D200"
}


7. Error Handling


Scenario

Behavior

Printer offline

Sale saves successfully. Error toast shown to user. "Retry Print" button available.

Out of paper

Same as offline — non-blocking error.

Print Agent service down

Fastify catches connection error. Sale saves. Error message displayed.

USB disconnected

Print Agent detects and returns error. Non-blocking.

Reprint request

User clicks "Reprint" in Transaction History. Same print flow re-executed with stored transaction data.



7.1 Error Flow


Print fails → Sale still saved to DB
            → Frontend shows error toast: "Impression échouée — imprimante hors ligne"
            → "Réessayer" (Retry) button in popup
            → Transaction marked as "not printed" in DB
            → Reprint available from Transaction History


8. Frontend Integration


8.1 Payment Popup — Print Trigger


After "Confirm Payment" click:



Save transaction to DB via POST /api/transactions
Call POST /api/print-receipt with transaction data
If print succeeds → show success toast + close popup
If print fails → show error toast + "Retry" button + close popup (sale is saved)


8.2 Transaction History — Reprint


Add a "Reprint" button (printer icon) to each transaction row
On click → call POST /api/print-receipt with stored transaction data
Same success/error handling as above


9. Print Agent — Technical Details


9.1 Dependencies


{
  "dependencies": {
    "express": "^4.x",
    "escpos": "^3.x",
    "escpos-usb": "^3.x",
    "sharp": "^0.x",
    "cors": "^2.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/express": "^4.x",
    "pkg": "^5.x",
    "node-windows": "^1.x"
  }
}


9.2 ESC/POS Command Sequence


1. Initialize printer (ESC @)
2. Print logo (if enabled — raster bit image)
3. Set center alignment
4. Print store name (double height/width)
5. Print subtitle (normal)
6. Print separator line
7. Set left alignment
8. Print cashier + date/time
9. Print client (if provided)
10. Print separator line
11. Print column headers (Produit, Qté, Prix U., Montant)
12. Print separator line
13. Print each item line
14. Print separator line
15. Print product count + total
16. Print unit count
17. Print separator line
18. Print payment method
19. Print amount received + change (cash only)
20. Print separator line
21. Print receipt number (centered)
22. Print footer message (centered)
23. Feed paper + cut


9.3 Windows Service Registration


Using node-windows:



import { Service } from "node-windows";

const svc = new Service({
  name: "BellaDolce Print Agent",
  description: "Receipt printing service for Boulangerie Bella-Dolce",
  script: "dist/index.js",
});

svc.install();


9.4 Installer (Inno Setup)


The Inno Setup script (setup.iss) will:



Copy the compiled .exe (from pkg) to C:\Program Files\BellaDolce PrintAgent\
Copy assets/logo.png
Copy default .env and app.config
Register the .exe as a Windows service
Start the service
Add firewall rule for port 9100 (localhost only)


10. Security


Concern

Mitigation

Print Agent exposed to network

Bind to 127.0.0.1 only — not accessible from outside the machine

Unauthorized print requests

API key in header: X-Print-Key: [configured-secret]

Data in transit

Localhost only — no TLS needed

Service permissions

Runs as Local Service account — minimum privileges



11. Receipt Number Sequence


Format: YYYYMMDD-SEQ (e.g., 20260510-001)
Resets daily at midnight
Stored in SQLite DB — receipt_sequence table
Backend generates the number before sending to Print Agent
Sequence is atomic (transaction-safe) to prevent duplicates


12. Bilingual Support


Setting

Behavior

Language = fr

All labels in French, footer in French

Language = ar

All labels in Arabic, footer in Arabic, right-to-left text alignment where supported

Default

fr

Configured via

app.config → receipt.language

Runtime switch

Language passed in each print request — can vary per transaction



13. Testing


Test

Description

Unit: Receipt formatter

Verify ESC/POS byte output for sample receipt data

Unit: Config loader

Verify .env and app.config parsing

Integration: Print Agent API

Send POST to /print with mock data, verify response

Integration: Fastify → Print Agent

Verify backend forwards print job correctly

E2E: Full print

Confirm Payment → verify physical receipt output

Error: Printer offline

Disconnect USB, verify error handling and non-blocking behavior

Error: Agent down

Stop service, verify Fastify error handling

Reprint

Print from Transaction History, verify identical receipt



14. Deployment Checklist


Install Xprinter D200 driver on Windows 11
Verify printer appears in Windows Printers & Scanners
Run Print Agent installer (.exe)
Verify Print Agent service is running (services.msc)
Configure .env with correct printer name
Configure app.config with store details
Place logo.png in assets folder
Test health check: GET http://localhost:9100/health
Test print: send sample receipt via API
Deploy Docker containers (Fastify + React)
Verify host.docker.internal connectivity
End-to-end test from browser


15. Future Enhancements (Out of Scope)


❌ Barcode printing
❌ Loyalty/Fidélité points
❌ Multiple printer support
❌ LAN/network printing
❌ Kitchen order printing
❌ QR code on receipt
Here is your complete specification file ready for download:

📥 **[Download: `bella-dolce-receipt-printing-spec.md`]**

The full Markdown content is above — you can copy it directly into a `.md` file in your repository. Would you like me to proceed with generating the actual implementation code for any specific component?





Like

Dislike
