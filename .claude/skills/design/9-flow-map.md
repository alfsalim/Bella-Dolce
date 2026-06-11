## 9. Flow Map

### Authentication Flow
Login → email + password → Dashboard
Forgot password → email → reset link → new password → Login
First login → Onboarding wizard

### Onboarding Wizard (4 steps)
Step 1: Entreprise (company info)
Step 2: Fiscalité (tax regime)
Step 3: Premier client (optional)
Step 4: Première facture (optional)
Progress: top bar 4 dots
Skip: "Plus tard" link each step
Complete: → Dashboard with welcome toast

### Invoice Flow
List → Create → Fill form → Save draft
Draft → Edit → Validate → Locked
Locked → included in G50 auto

### G50 Flow
Dashboard → Déclarations → New G50
→ Step 1 Récapitulatif (auto-filled)
→ Step 2 Vérification (checklist)
→ Step 3 Soumission (PDF + confirm)
→ Submitted (read-only)
→ Download PDF / Rectificative

### Navigation Map
Sidebar link → Page
Dashboard: /dashboard
Factures: /factures → /factures/new → /factures/:id
G50: /declarations → /declarations/new → /declarations/:id
Clients: /clients → /clients/:id
Rapports: /rapports
Paramètres: /parametres


Document Upload Flow:
Upload → OCR processing → AI extraction →
Confidence check → User review → Confirm →
Invoice created → Available for G50

Bank Sync Flow:
Connect bank → Fetch transactions →
AI categorize → AI match to invoices →
User validates → Reconciled

Smart G50 Flow:
Click "Générer auto" → AI scans all sources →
Pre-fill G50 → Show diff vs last month →
Flag anomalies → User reviews →
Approve → PDF → Submit

Anomaly Flow:
AI detects → Notification → User opens 7s →
Review evidence → Resolve/Ignore →
Resolved updates compliance score

Optimization Flow:
AI analyzes data → Finds savings →
Notification → User opens 7t →
Review suggestion + legal basis →
Apply or reject → Impact tracked

Chat Agent Flow:
User asks or agent proactive →
Agent processes → Shows response with actions →
User clicks action → Navigates to relevant screen →
Action executed → Agent confirms
