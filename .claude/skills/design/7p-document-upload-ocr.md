### 7p. Document Upload / OCR
Access: "Importer" button in header + invoice screen
Modal: lg 720px

Upload zone:
- Drag & drop area h:200px
- Dashed border 2px #E2E8F0 radius:12px
- Icon: Upload 48px #B8D4E8
- Text: "Glissez vos fichiers ici"
- Subtext: "PDF, JPG, PNG – max 10MB"
- Button: "Parcourir" secondary
- Multi-file: up to 20 files at once

Processing state:
- File list with progress bars
- Each file: name + size + status
- Status: En cours | Terminé | Erreur
- Spinner per file during OCR

AI Extraction preview:
- Side by side: original doc left, extracted data right
- Original: PDF/image viewer with zoom
- Extracted: form fields pre-filled
- Confidence: green/amber/red per field
- Green >95%: auto-accepted
- Amber 70-95%: highlighted for review
- Red <70%: manual entry required
- User corrects → AI learns

Extracted fields:
- Type: Vente/Achat auto-detected
- N° facture, Date, Fournisseur/Client
- Line items: designation, qty, price, TVA
- Totals: HT, TVA, TTC
- NIF detected and matched to existing client

Actions after review:
- "Confirmer et créer facture" primary
- "Modifier" secondary
- "Rejeter" ghost
- Batch mode: confirm all reviewed at once
