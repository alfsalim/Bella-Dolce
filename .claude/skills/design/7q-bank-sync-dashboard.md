### 7q. Bank Sync Dashboard
Access: sidebar nav icon:Landmark
Page title: "Banque & Transactions" H1
Top right: "Connecter une banque" primary

Bank accounts row:
- Card per account: logo + name + last 4 digits
- Balance: JetBrains Mono 20px
- Status: Connecté (green) / Erreur (red)
- Last sync: timestamp + refresh icon
- Click: filters transactions to that account

Transaction list:
- Table: Date | Libellé | Montant | Catégorie | Statut
- Montant: green positive, red negative, mono font
- Catégorie: dropdown editable inline
- Statut: Catégorisé | À vérifier | Ignoré
- AI auto-categorizes with confidence badge
- Amber rows: AI unsure, needs review

AI matching:
- Transaction ↔ Invoice auto-link
- Matched: chain icon + invoice number link
- Unmatched: "Associer" button → search modal
- Suggested match: dotted border amber

Bulk actions:
- Select rows → Catégoriser | Ignorer | Associer
- "Tout valider" for high-confidence batch

Filters:
- Date range, amount range
- Catégorie, Statut dropdown
- Matched/Unmatched toggle
- Search by libellé
- Suggested match: dotted border amber, "Suggéré" badge
- Click accept or reject suggestion
- Bulk match: select multiple → auto-match action

Reconciliation summary card (sticky right):
- Total transactions: count
- Catégorisées: count + %
- À vérifier: count amber
- Non rapprochées: count red
- Progress bar: visual of completion

Import alternatives (no bank sync):
- Upload relevé bancaire PDF
- Upload CSV/Excel export
- AI extracts transactions same as OCR
- Manual entry row by row

Rules engine:
- "Si libellé contient X → catégorie Y"
- User creates rules from matched transactions
- Toggle: auto-apply rules
- Rules list in settings sub-tab
