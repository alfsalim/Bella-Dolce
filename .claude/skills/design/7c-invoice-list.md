### 7c. Invoice List Screen
Page title: "Factures" H1
Top right: button "Nouvelle facture" primary

Tabs below title: Toutes | Ventes | Achats
Active tab: border-bottom 2px #059669 text #059669

Filter bar below tabs:
- Date range picker
- Client dropdown
- Status dropdown
- Amount min/max
- Clear all filters link
Active filters: pill tags with x to remove

Table columns:
N° facture | Date | Client | Type (V/A) | Montant HT | TVA | TTC | Statut
Number cells: JetBrains Mono
Amount alignment: right
Status: badge component
Row click: opens invoice detail

Table footer:
Left: "X factures trouvées"
Right: pagination 10/25/50

Empty state:
Icon: FileText 48px #B8D4E8
Title: "Aucune facture"
Subtitle: "Créez votre première facture"
Button: "Nouvelle facture" primary

Bulk actions bar (on row select):
bg:#F0F7FB h:48px sticky bottom
Left: "X sélectionnées"
Right: Exporter, Supprimer (danger)
