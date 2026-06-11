### 7g. Settings Screen
Page title: "Paramètres" H1

Layout: sidebar tabs left (200px) + content right

Tabs (vertical):
1. Entreprise
2. Fiscalité
3. Utilisateurs
4. Notifications
5. Apparence
6. Import/Export

--- Tab 1: Entreprise ---
Section: Informations légales
- Raison sociale
- NIF, NIS, Article d'imposition
- Adresse, Commune, Wilaya
- Activité principale
- Registre de commerce
Save button bottom right

Section: Coordonnées
- Téléphone, Email, Site web
Save button bottom right

--- Tab 2: Fiscalité ---
Section: Régime fiscal
- Type: Réel / Simplifié / Forfaitaire (radio)
- Assujetti TVA: toggle
- Taux TVA défaut: 0% / 9% / 19%
- Assujetti TAP: toggle
- Taux TAP: 2% default editable
- Timbre fiscal: toggle

Section: Seuils et alertes
- Seuil CA annuel: input amount
- Rappel déclaration: X jours avant
Save button bottom right

--- Tab 3: Utilisateurs ---
Table: Nom | Email | Rôle | Statut
Roles: Admin / Comptable / Lecture seule
Actions: Modifier, Désactiver
Button: "Inviter un utilisateur" secondary
Invite modal: email + role dropdown + send

--- Tab 4: Notifications ---
Toggle list:
- Rappel échéance G50: toggle + X jours avant
- Facture en retard: toggle
- Anomalie détectée: toggle
- Résumé hebdomadaire: toggle
Channels: In-app (always) + Email (toggle each)
Save button bottom right

--- Tab 5: Apparence ---
Theme: Clair / Sombre / Système (3 cards visual)
Densité: Confortable / Compact (2 cards visual)
Langue: Français / العربية dropdown
Selected card: border 2px #059669 check icon
Preview updates live on selection

--- Tab 6: Import/Export ---
Import section:
- CSV upload zone (drag and drop)
- Template download link
- Mapping preview table
- Button: Importer (primary)

Export section:
- Type: Factures / Clients / G50 (checkboxes)
- Format: PDF / CSV / Excel (radio)
- Période: date range picker
- Button: Exporter (primary)
- Scheduled exports: toggle + frequency
