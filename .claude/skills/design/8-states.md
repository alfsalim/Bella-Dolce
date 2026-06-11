## 8. States

### Loading States
Skeleton screens: pulse animation #E2E8F0 to #F1F5F9
- Cards: rounded rectangles matching card layout
- Tables: 5 skeleton rows matching column widths
- Forms: skeleton inputs matching field layout
- Dashboard: skeleton KPI cards + chart placeholder
Spinner: only for button actions, 16px accent color
Progress bar: for imports/exports, h:4px accent color
Full page loader: centered logo + skeleton below

### Empty States
Each entity has unique empty state:
- Icon: 48px #B8D4E8 related to entity
- Title: Inter 16px w600 #1E3A52
- Subtitle: Inter 14px #5A8BAC helpful text
- CTA button: primary, action to create first item
- Optional: sample data toggle link

### Error States
Form errors: red border + text below field
Page error: centered card
- Icon: AlertTriangle 48px #DC2626
- Title: "Une erreur est survenue"
- Subtitle: description
- Button: Réessayer (primary)
API timeout: toast + retry
404: custom illustration + "Page introuvable"

### Success States
Toast: bottom right, auto dismiss 5s
- Green left border 3px
- Icon: CheckCircle
- Title + description
- Close x button
G50 submission: confetti 2s +
Toast: bottom right, auto-dismiss 5s
- bg:#ECFDF5 border-left 3px #059669
- icon: CheckCircle #059669
- title: Inter 14px w500
- close: x icon right
Stack: max 3 toasts, newest on top

### Unsaved Changes
Dot indicator: 8px #D97706 on tab/page title
Navigation warning modal:
- Title: "Modifications non enregistrées"
- Subtitle: "Voulez-vous quitter sans sauvegarder?"
- Buttons: Quitter (danger) + Rester (primary)

### Offline State
Banner: top of page h:40px bg:#FEF3C7
- icon: WifiOff
- text: "Connexion perdue. Reconnexion..."
- auto-dismiss when reconnected
- green banner: "Connexion rétablie" 3s
