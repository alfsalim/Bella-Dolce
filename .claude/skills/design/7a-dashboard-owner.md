### 7a. Dashboard (Business Owner)
Period selector: top right, month/quarter/year toggle

Row 1: 4 KPI cards (h:120px gap:16px)
- CA du mois: revenue + %change green/red
- TVA à déclarer: amount due
- Prochaine échéance: date + days left badge
- Factures en attente: count + warning if overdue
KPI style: icon left 40px circle bg accent-50
Number: JetBrains Mono 24px w700
Subtitle: Inter 13px #5A8BAC
Change badge: 12px green up / red down

Row 2: 2 columns (gap:16px)
Left: Revenue chart (bar, 6 months, accent color)
Right: Tax breakdown (donut, TVA/TAP/IRG/Timbre)
Chart height: 280px
Chart lib style: clean, no gridlines, rounded bars

Row 3: Recent invoices table (last 5)
Columns: N°, Client, Date, Montant HT, TVA, Status
"Voir tout" link top right of card


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
