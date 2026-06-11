### 7y. Smart Matching UI
Access: from Bank Sync or Invoice list
Modal: fullscreen overlay
Header: "Rapprochement Intelligent" + close X

Layout: 3 columns (30% | 40% | 30%)

Left: unmatched transactions
- Each: date + libellé + montant
- Click to select, blue border
- Filter: date, amount range
- Count badge top: "23 non rapprochées"

Center: matching zone
- AI suggested pairs connected by lines
- Each pair: card with both items
- Confidence: green >90% | amber 70-90% | red <70%
- Actions per pair: Accepter | Rejeter | Modifier
- Drag & drop: manual matching
- "Accepter tout >90%" bulk button top

Right: unmatched invoices
- Each: N° + client + montant TTC
- Click to select, green border
- Filter: date, client, amount
- Count badge top: "8 non rapprochées"

Match rules:
- Amount exact match: high confidence
- Amount ±5%: medium confidence
- Date within 7 days: boost score
- Client name ↔ libellé: NLP matching

Summary bottom bar:
- Rapprochées: count green
- En attente: count amber
- Rejetées: count red
- Taux: percentage complete
- "Terminer" primary button right
- "Annuler" ghost button left
