### 7l. Global Search (Ctrl+K)
Overlay: centered modal w:640px
Backdrop: rgba(0,0,0,0.5) blur(4px)
Animation: fade in + slide down 8px
Input: h:56px font:18px
Placeholder: "Rechercher..."
Icon: Search left, Esc badge right

Results:
Group header: "Factures" "Clients" "G50"
Each result row h:48px:
- Icon left 20px
- Title Inter 14px w500
- Subtitle Inter 13px #5A8BAC
- Badge right if status
Max 5 per group
"Voir tout" link per group
Keyboard: arrows navigate, enter selects
No results: "Aucun résultat pour [query]
Results appear below input as user types
Debounce: 200ms
Min chars: 2

Grouped sections:
- Factures (icon:FileText)
- Clients (icon:Users)
- Déclarations (icon:FileSpreadsheet)
- Paramètres (icon:Settings)

Each result row:
- Icon left 20px #5A8BAC
- Title: Inter 14px w500
- Subtitle: Inter 13px #5A8BAC
- Badge right if applicable
- Row hover: bg #F0F7FB
Max 5 per group
"Voir tous les résultats" link per group

Footer: keyboard hints
- ↑↓ naviguer | ↵ ouvrir | esc fermer

No results state:
- Icon: Search 32px #B8D4E8
- "Aucun résultat pour [query]"
- Suggestion: "Essayez un autre terme"
