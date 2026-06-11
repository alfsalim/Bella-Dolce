### 7f. Client Management Screen
Page title: "Clients" H1
Top right: button "Nouveau client" primary

View toggle: top right, Cards | Table (icon buttons)

--- CARDS VIEW (default) ---

Grid: 3 columns gap:16px
Each card (h:200px):
- Company name H4
- NIF: caption monospace
- Activity: badge
- Status: À jour (green) / En retard (red)
- Invoices count: "X factures"
- Last declaration: "G50 Mars 2026"
- Next deadline: date + days badge
Card hover: shadow-sm border:#B8D4E8
Card click: opens client detail

--- TABLE VIEW ---

Columns: Nom | NIF | Activité | Factures | Dernier G50 | Statut
Sort: all columns
Filter: status + activity dropdown
Search: by name or NIF

--- CLIENT DETAIL PAGE ---

Header: company name H1 + status badge
Tabs: Informations | Factures | Déclarations | Activité

Tab Informations:
- NIF, NIS, Article
- Raison sociale, Adresse
- Activité, Régime fiscal
- Contact: tel, email
- Edit button top right

Tab Factures:
- Same as 7c filtered to this client

Tab Déclarations:
- List of G50 by period
- Status badge each row
- Click opens 7e for that period

Tab Activité:
- Simple timeline log
- "Facture #X créée" + date
- "G50 Mars soumis" + date
- Max 50 entries + load more
Tab Déclarations:
- List of G50 by period
- Columns: Période | Montant | Statut | Date soumission
- Click opens G50 detail

Tab Activité:
- Simple activity log
- Each entry: icon + action + user + timestamp
- "Facture #12 créée par Salim"
- "G50 Mars 2026 soumis"
- Chronological, newest first
- Load more button at bottom

--- NEW CLIENT FORM (modal lg:720px) ---

Fields:
- Raison sociale (required)
- NIF (required, 15 digits, validated)
- NIS (optional)
- Article d'imposition (optional)
- Adresse (required)
- Commune + Wilaya dropdowns
- Activité principale (dropdown)
- Régime fiscal: Réel / Simplifié / Forfaitaire
- Taux TVA par défaut: 0% / 9% / 19%
- Assujetti TAP: toggle
- Contact: nom, tel, email
Footer: Annuler (ghost) + Créer (primary)

Empty state:
Icon: Users 48px #B8D4E8
Title: "Aucun client"
Subtitle: "Ajoutez votre premier client"
Button: "Nouveau client" primary
