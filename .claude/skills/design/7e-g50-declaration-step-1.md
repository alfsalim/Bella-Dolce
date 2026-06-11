### 7e. G50 Declaration Screen
Page title: "Déclaration G50 – [Mois Année]"
Top right: Sauvegarder (secondary) + Valider (primary)

Top bar: month/year selector + status badge
Progress: step indicator (3 steps)
Step 1: Récapitulatif | Step 2: Vérification | Step 3: Soumission

--- STEP 1: Récapitulatif ---

Layout mirrors official DGI G50 form structure

Section A - Identification:
- NIF, NIS, Article d'imposition
- Raison sociale, Adresse, Activité
- Période (mois/trimestre)
All prefilled from settings, read-only, grey bg

Section B - Chiffre d'affaires:
Table: Nature | Base imposable | Taux | Montant
- CA imposable TVA 19%
- CA imposable TVA 9%
- CA exonéré
All amounts: JetBrains Mono right-aligned
Auto-filled from invoices, editable with warning icon
Edit triggers: amber border + tooltip "Modifié manuellement"

Section C - TVA:
- TVA collectée (19% + 9%)
- TVA déductible (from purchases)
- TVA nette (collectée - déductible)
Negative value: crédit de TVA, shown in blue

Section D - TAP:
- Base: total CA
- Taux: 2%
- Montant: auto-calc

Section E - IRG/IBS:
- Base imposable
- Taux applicable
- Montant dû

Section F - Timbre:
- Nombre d'opérations
- Montant timbre

Section G - Récapitulatif:
Card bg:#F8FAFC border-left 3px #059669
Total à payer: JetBrains Mono 24px w700
Breakdown: TVA + TAP + IRG + Timbre
- Base: total CA imposable
- Taux: 2%
- Montant: auto-calculated

Section E - IRG/Salaires:
- Nombre de salariés
- Masse salariale brute
- IRG retenu
Manual entry fields, not from invoices

Section F - Timbre fiscal:
- Nombre de factures avec timbre
- Montant total timbre
Auto-filled from invoices

Section G - Récapitulatif des droits:
Summary card bg:#F8FAFC border-left 3px #059669
- TVA nette: amount
- TAP: amount
- IRG: amount
- Timbre: amount
- TOTAL À PAYER: JetBrains Mono 24px w700 #059669
Divider above total

--- STEP 2: Vérification ---

Checklist card:
Each check: icon + label + status (✓ ok / ⚠ warning / ✗ error)
- Toutes les factures incluses
- Montants cohérents avec factures
- TVA déductible justifiée
- Période correcte
- Informations société complètes
Errors block validation button
Warnings allow proceed with confirmation

--- STEP 3: Soumission ---

Preview: PDF render of official G50 form
Side by side: preview left, actions right
Actions card:
- Télécharger PDF (secondary)
- Marquer comme soumis (primary)
- Date de soumission: date picker
- Référence DGI: text input optional
Confirmation modal on submit:
"Confirmez-vous la soumission?" + summary
- Marquer comme soumis (primary)
- Requires checkbox: "Je confirme l'exactitude"

After submission:
- Status badge changes to "Soumis"
- Form becomes read-only
- Actions: Télécharger PDF, Dupliquer, Rectificative
- Success toast: "Déclaration G50 soumise avec succès"
- Confetti animation subtle 2 seconds

AI Insights panel (right side, collapsible):
Width: 320px
Header: sparkle icon + "Insights IA"
Cards inside:
- Anomalies détectées (amber)
- Comparaison période précédente
- Optimisations fiscales suggérées
- Risques de contrôle
Each card: icon + title + description + action link
Collapse: chevron, remembers state

Entry point change:
- Page shows two options before form:
  - Card 1: "Génération automatique" primary
    - Icon: sparkle
    - "L'IA prépare votre G50"
    - "Basé sur vos factures et transactions"
    - Click: navigates to 7r
  - Card 2: "Saisie manuelle" secondary
    - Icon: edit
    - "Remplissez le formulaire vous-même"
    - Click: existing 7e flow

Auto-fill banner (if data available):
- bg:#ECFDF5 top of manual form
- "43 factures et 156 transactions détectées"
- "Pré-remplir automatiquement?" link
- Click: fills form, each field tagged with source

G50 steps change from 4 to 3:
- Step 1: Récapitulatif (all form sections)
- Step 2: Vérification (checklist)
- Step 3: Soumission (PDF + confirm)
