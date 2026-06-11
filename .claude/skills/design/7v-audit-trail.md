### 7v. Audit Trail
Access: sidebar nav icon:History
Page title: "Journal d'Activité" H1
Subtitle: "Historique complet de toutes les actions"

Filter bar:
- User: dropdown all users
- Action: Création | Modification | Suppression | Soumission
- Entity: Facture | Client | G50 | Paramètre
- Date range picker

Timeline list:
- Vertical line left, dots on line
- Each entry:
  - Dot: colored by action type
  - Green: création
  - Blue: modification
  - Red: suppression
  - Amber: soumission
  - User avatar 24px + name
  - Action: "a créé la facture #F-041"
  - Timestamp: "14 Mai 2026 à 13:04"
  - Entity link: clickable to detail
- Grouped by date: "Aujourd'hui" "Hier" "12 Mai"

Detail expand (click entry):
- Before/after diff for modifications
- Field name | Ancienne valeur | Nouvelle valeur
- Highlighted changed cells

Export: "Exporter PDF" secondary top right
Pagination: load more button bottom
Retention: 24 months displayed
