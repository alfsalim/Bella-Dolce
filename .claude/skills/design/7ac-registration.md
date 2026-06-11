### 7ac. Registration Screen
Centered layout, max-width: 400px
bg page: #F8FAFC (surface-page-light)
font: Inter throughout

**Background Decoration**
- Top-right: 500×500px emerald-50 circle, blur-3xl, opacity-30
- Bottom-left: 400×400px slate-100 circle, blur-3xl, opacity-30
- Both fixed, z-index: -10

**Logo & Header**
- Logo badge: w:40px h:40px, bg: #059669 (emerald-600), rounded-lg, shadow-sm
  - Icon: account_balance (Material Symbols, FILL=1), 28px, white
- Logo text: "Jibaya" h1 font (30px/38px 700), slate-900, tracking-tight
- Subtitle: "Créez votre compte fiscal" body-lg (16px/24px 400), on-primary-container
- Header margin-bottom: 48px (5xl)

**Card**
- bg: #FFFFFF
- shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)
- border: 1px border-light (#E2E8F0)
- radius: 12px (xl)
- padding: 32px (3xl)
- max-width: 400px, full width

**Form — field spacing: 20px (xl) between fields, 4px (xs) between label and input**

**Full Name Field**
- label: "Nom complet" body-sm (13px) font-bold slate-900
- input: h:40px, pl:40px, pr:12px, border: border-light, rounded-lg
- icon: person (Material Symbols, 20px, on-primary-container), left-12px, vertically centered
- placeholder: "Ex: Slimane Rahmani"
- focus: ring-2 emerald-600/15, border emerald-600

**Email Field**
- label: "Adresse e-mail" body-sm font-bold slate-900
- input: h:40px, pl:40px, pr:12px, border: border-light, rounded-lg
- icon: mail (Material Symbols, 20px, on-primary-container), left-12px, vertically centered
- placeholder: "contact@entreprise.dz"
- focus: ring-2 emerald-600/15, border emerald-600

**Password Field**
- label: "Mot de passe" body-sm font-bold slate-900
- input: h:40px, pl:40px, pr:12px, border: border-light, rounded-lg
- icon: lock (Material Symbols, 20px, on-primary-container), left-12px, vertically centered
- placeholder: "••••••••"
- focus: ring-2 emerald-600/15, border emerald-600

**Password Strength Indicator** (below password input, pt:8px)
- Track: h:4px, full width, bg: surface-container, rounded-full
- Bar: animated width transition (0.3s ease), colors by strength level:
  - 0%: hidden (w-0), text: "Saisissez un mot de passe sécurisé", color: on-primary-container
  - ≤25%: bg error-600 (#DC2626), text: "Très faible", color: error-600
  - ≤50%: bg warning-600 (#D97706), text: "Moyen", color: warning-600
  - ≤75%: bg info-600 (#2563EB), text: "Fort", color: info-600
  - 100%: bg emerald-600 (#059669), text: "Très sécurisé", color: emerald-600
- Strength label: overline font (11px/16px 600, letter-spacing: 0.05em), mt:4px
- Scoring: +25 each: length>5, has uppercase, has digit, has special char

**Confirm Password Field**
- label: "Confirmer le mot de passe" body-sm font-bold slate-900
- input: h:40px, pl:40px, pr:12px, border: border-light, rounded-lg
- icon: lock_reset (Material Symbols, 20px, on-primary-container), left-12px, vertically centered
- placeholder: "••••••••"
- focus: ring-2 emerald-600/15, border emerald-600

**Terms Checkbox**
- layout: flex items-start gap:12px, pt:8px
- checkbox: w:16px h:16px, emerald-600, border-light, rounded, focus: ring emerald-600/20
- label: body-sm on-primary-container, leading-tight
  - "J'accepte les " + link "Conditions Générales" + " et la " + link "Politique de Confidentialité" + "."
  - Links: emerald-600 font-medium, hover: underline

**Submit Button**
- text: "Créer mon compte"
- bg: emerald-600 (#059669), hover: emerald-600/90, active: scale 0.98
- color: white
- width: full, height: 44px
- font: h4 (16px/24px 600)
- radius: rounded-lg
- shadow-sm

**Loading State (on submit)**
- Button disabled, text replaced with: spinner icon (progress_activity, animate-spin) + " Création..."
- Spinner: Material Symbols progress_activity with animate-spin

**Secondary Action**
- Separated by border-t border-light, mt:24px, pt:20px
- text: "Déjà un compte ?" body-sm on-primary-container
- link: "Se connecter" emerald-600 font-bold hover:underline, ml:4px

**Footer**
- mt: 48px (5xl)
- 3 placeholder bars (w:48px/64px/40px, h:24px, bg:slate-200, rounded)
- opacity-40, grayscale, pointer-events-none (decorative only)
