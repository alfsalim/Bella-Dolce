### 7w. Multi-Entity Switcher
Access: sidebar top, below logo
Current entity: company name + chevron down

Dropdown on click:
- List of entities/companies
- Each: logo 24px + name + NIF truncated
- Active: checkmark right + bg:#F0F7FB
- Hover: bg:#F8FAFC
- Divider line
- "+ Ajouter une entité" link green bottom

Switch behavior:
- Click entity → full context switch
- Dashboard, invoices, clients all reload
- Sidebar badge shows entity initial
- Header shows entity name
- Toast: "Basculé vers [entity name]"
- Last selected remembered per user

Add entity modal:
- Same fields as Settings > Entreprise
- Raison sociale, NIF, régime fiscal
- "Créer" primary button
- Max entities: per plan (Free:1, Pro:3, Enterprise:∞)
- Upgrade prompt if limit reached

Entity settings:
- Each entity has independent settings
- Independent fiscal regime
- Independent client list
- Independent declarations
- Shared: user accounts, billing
