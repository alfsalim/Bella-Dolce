## 6. Layout

### Shell Structure
Sidebar left + Header top + Content area
Sidebar expanded: 260px width
Sidebar collapsed: 64px width
Header height: 56px
Content padding: 24px
Max content width: 1440px

### Sidebar
bg:#0C1B2A text:#B8D4E8
Logo area: h:56px px:16px border-bottom 1px #1B2B3A
Nav items: h:40px px:16px radius:6px
Nav hover: bg:#1B2B3A
Nav active: bg:#1B2B3A border-left 3px #059669
Nav icon: 20px color:#5A8BAC active:#10B981
Nav label: Inter 14px w400 active:w500
Group labels: 11px w600 uppercase #5A8BAC mt:24px
Collapse btn: bottom, chevron icon
Tooltip on collapsed: show label on hover

### Sidebar Nav Items
Nav items (top to bottom):
- Tableau de bord (icon:LayoutDashboard)
- Factures (icon:FileText)
- Déclarations G50 (icon:FileSpreadsheet)
- Clients (icon:Users)
- Banque (icon:Landmark) ← NEW
- Anomalies (icon:ShieldAlert) ← NEW
- Optimisations (icon:Lightbulb) ← NEW
- Rapports (icon:BarChart3)
- Conformité (icon:ClipboardCheck) ← NEW
- Journal (icon:History) ← NEW

Bottom:
- Paramètres (icon:Settings)

Anomalies: red badge count if active
Optimisations: green badge count if suggestions

### Header
bg:#FFFFFF border-bottom:1px #E2E8F0 h:56px
Left: breadcrumb Inter 14px #5A8BAC
Center: global search Ctrl+K w:400px
Right: notifications bell + user avatar dropdown
Bell: 20px icon, red dot 8px for unread
Avatar: 32px circle, initials fallback
Dropdown: name, email, role, divider, settings, logout

### Global Search (Ctrl+K)
Overlay modal centered w:640px
Input: h:48px font:16px autofocus
Results grouped: Factures, Clients, G50, Paramètres
Each result: icon + title + subtitle + badge
Max 5 per group, "Voir tout" link
Keyboard: arrow keys + enter
Close: Esc or click outside

### Content Area
Page title: H1 left-aligned
Action buttons: top right aligned
Filters/tabs: below title
Content: cards or table below
Pagination: bottom right 10/25/50 per page
