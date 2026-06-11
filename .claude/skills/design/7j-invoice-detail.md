### 7j. Invoice Detail (read-only)
Page title: "Facture #[N°]" H1 + status badge
Top right: Modifier (secondary) + Télécharger PDF (secondary)
         + Dupliquer (ghost) + Supprimer (danger ghost)

Layout: 2 columns (8/4 grid)

Left column:
Section: Informations
- Type: Vente/Achat badge
- Date facture + Date échéance
- Client: name linked to client detail

Section: Lignes de facture
Table read-only:
Désignation | Qté | Prix unitaire | TVA% | Montant HT
All cells: Inter 14px, amounts JetBrains Mono

Section: Notes
- Text block if present, hidden if empty

Right column (summary card sticky):
Same as 7d but read-only
- Total HT
- TVA 19%
- TVA 9%
- TAP
- Timbre
- Total TTC large accent

Bottom: Activity log
- Créée le [date] par [user]
- Modifiée le [date] par [user]
- Incluse dans G50 [period] link
