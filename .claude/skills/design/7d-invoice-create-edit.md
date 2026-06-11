### 7d. Invoice Create/Edit Screen
Page title: "Nouvelle facture" or "Modifier facture #XX"
Top right: Annuler (ghost) + Enregistrer (primary)

Layout: 2 columns (8/4 grid)

Left column (main form):
Section 1 - Informations générales:
- Type: toggle Vente/Achat
- N° facture: auto-generated, editable
- Date facture: date picker
- Date échéance: date picker

Section 2 - Client:
- Client dropdown with search
- Or "Nouveau client" link inline
- Selected: shows name + NIF + address preview

Section 3 - Lignes de facture:
Repeatable row table:
Désignation | Qté | Prix unitaire HT | TVA% | Montant HT
- Add row: "+ Ajouter une ligne" link
- Delete row: trash icon right
- TVA% dropdown: 0%, 9%, 19%
- Montant HT: auto-calculated
- Number inputs: JetBrains Mono

Section 4 - Notes:
- Textarea, optional, max 500 chars

Right column (summary card, sticky):
Card bg:#F8FAFC
- Total HT: amount
- TVA 19%: amount
- TVA 9%: amount
- Timbre fiscal: amount
- Total TTC: amount bold large
All amounts: JetBrains Mono 16px
Divider between subtotal and total
Divider line between subtotals and TTC
TTC: JetBrains Mono 24px w700 #059669

Tax auto-calculation rules:
- TVA computed per line based on TVA% selected
- TAP: 2% of Montant HT (ventes only)
- Timbre: 1% of TTC if applicable
- IRG: based on activity type in settings
- All recalculate on any field change
- Animated number transition on change

Unsaved changes:
- Dot indicator on tab title
- Navigation warning modal if leaving
- "Vous avez des modifications non enregistrées"
- Buttons: Quitter sans sauvegarder / Rester

Validation:
- Required fields: red border + error text on submit
- Inline: real-time as user types
- Date: échéance must be >= date facture
- Amounts: must be > 0
- At least 1 line required
- Client required
