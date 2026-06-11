### 7h. Login Screen
Centered layout, max-width:420px
bg page:#F8FAFC (surface-page-light)

**Top Accent Bar**
- absolute top, full width, h:1px, bg:#059669 (emerald-600)

**Logo & Header**
- Logo badge: w:40px h:40px, bg:#ECFDF5 (emerald-50), border:1px emerald-600/20, rounded-lg
  - Icon: account_balance (Material Symbols), 24px, emerald-600
- Logo text: "Jibaya" h2 font, slate-900
  - Note: جباية (Arabic) deferred for future release
- Subtitle: "Accédez à votre espace fiscal sécurisé" body text, on-surface-variant

**Card**
- bg:#FFFFFF (surface-container-lowest)
- shadow:lg border:1px border-light
- radius:12px
- padding:32px/40px (3xl/5xl responsive)

**Email Input**
- label: "Email" body-sm font-semibold
- input: bg-surface, border-light, rounded, h:40px (4xl)
- icon: mail (Material Symbols, 18px, left-positioned)
- placeholder: "nom@entreprise.dz"

**Password Input**
- label: "Mot de passe" body-sm font-semibold
- input: bg-surface, border-light, rounded, h:40px (4xl)
- icon: lock (Material Symbols, 18px, left-positioned)
- placeholder: "••••••••"
- Note: Show/hide toggle deferred (not in current Stitch)

**Forgot Password Link**
- text: "Mot de passe oublié ?" body-sm font-medium
- color: emerald-600 (#059669)
- position: right-aligned
- hover: emerald-600/80

**Submit Button**
- text: "Se connecter" body-sm font-semibold
- bg: emerald-600 hover:emerald-600/90
- color: white
- width: full
- height: 40px (4xl)
- icon: arrow_forward (Material Symbols, 18px, right of text)
- rounded

**Footer**
- text: "Problème de connexion ? Contactez le support"
- "Contactez le support" is a link (slate-900, hover:emerald-600)
- font: body-sm
- position: centered inside card with border-top separator
- Note: "© 2026 Jibaya" copyright and "ou" divider + "Créer un compte" link deferred

**States (deferred for future)**
- Error banner: top of card, error-50 bg, error-600 border/text
- Message: "Email ou mot de passe incorrect"
- Loading: button spinner instead of text
- Account locked: warning banner with support link
