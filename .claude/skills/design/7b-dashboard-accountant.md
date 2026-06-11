### 7b. Dashboard (Accountant)
Period selector: top right, month/quarter/year toggle

Row 1: 4 KPI cards (h:120px gap:16px)
- Clients actifs: count + new this month
- Déclarations en cours: count + urgent badge
- Échéances cette semaine: count + red if overdue
- Revenus cabinet: amount + %change
Same KPI style as business owner

Row 2: Client portfolio grid (3 columns)
Each client card (h:160px):
- Company name H4
- NIF number caption
- Status badge (À jour / En retard / En cours)
- Next deadline date
- Mini progress bar (declarations done/total)
- Click → opens client workspace
Sort: by deadline urgency default
Filter: status dropdown + search

Row 3: Upcoming deadlines timeline
Horizontal timeline, next 30 days
Each node: date + client name + declaration type
Color: green done, amber upcoming, red overdue
Hover: tooltip with details

AI Agent widget (right column):
- Card: "Assistant Jibaya" sparkle icon
- Last message preview from agent
- "3 suggestions en attente"
- Click: opens chat panel 7o

Anomaly widget:
- Card: "Anomalies" shield icon
- Count: critiques red + avertissements amber
- Latest anomaly title preview
- Click: navigates to 7s

Compliance widget:
- Mini circular score (same as 7x)
- Label: "Conformité" + percentage
- Next deadline: "G50 Mai dans 5 jours"
- Click: navigates to 7x

Import activity widget:
- "Derniers imports"
- 3 recent: filename + status + count
- Click: navigates to 7p

Optimization banner (conditional):
- bg:#ECFDF5 top of dashboard
- "Économisez 45,000 DZD ce trimestre"
- "Voir les suggestions" link
- Dismissable X
