# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

[Step] → verify: [check]
[Step] → verify: [check]
[Step] → verify: [check]


Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Bella Dolce — Project Context

### Stack
- Backend:  Express + TypeScript → port 3000  (npm run dev:backend)
- Frontend: React + Vite + Tailwind → port 5173 (cd frontend && npm run dev)
- Database: SQLite via Prisma at prisma/dev.db
- Docker:   staging/prod ONLY — never during active dev

### Project Structure
src/
  pages/        ← Business logic (Inventory, POS, Finance, Production)
                   One file = one domain. No cross-domain imports.
  components/   ← UI only. Zero business logic here.
  constants.ts  ← ALL user-facing strings (AR + FR + EN). 
                   Never hardcode text anywhere else.

server.ts       ← API routing only.
prisma/
  schema.prisma ← READ ONLY. Never modify unless told to.
  dev.db        ← Never touch directly.

### i18n Rules
- Every user-facing string MUST use a key from src/constants.ts
- When adding a string: add AR + FR + EN variants before using it
- Never add a string in one language only

### Testing
- Backend unit: Vitest → run: `npm run test`
  Location: `src/__tests__/`
- Frontend E2E: Playwright → run: `npx playwright test`
  Location: `e2e/` (testDir in playwright.config.ts)

### Definition of Done
A task is ONLY complete when ALL pass:
- [ ] Vitest tests pass (npm run test)
- [ ] Playwright E2E passes (npx playwright test)
- [ ] doc/BRD.md updated with feature spec + test coverage
- [ ] Zero hardcoded strings or values in the diff

### Deploy (only when dev is clean)
- Dev test:  ./deploy-bella.sh --dev   (Docker, port 3501)
- Prod:      ./deploy-bella.sh --prod  (Tailscale)

---

## Live Debug Mode

### Activation
User pastes an error OR says "watch logs" / "I am testing"

### On Session Start
1. Run: `npm run dev:backend`
2. Watch stdout/stderr continuously
3. Fix any backend error before doing anything else

### Backend Error (auto-detected from terminal)
1. IDENTIFY  → Root cause, one sentence
2. LOCATE    → Exact file + line from stack trace
3. FIX       → Minimal diff. Nothing else touched.
4. RESTART   → kill → `npm run dev:backend`
5. CONFIRM   → "Backend clean. No errors in output."

### Frontend Error (user pastes from DevTools)
Drop everything. Fix this first.
Need from user: red console line + file:line + what triggered it.
1. IDENTIFY  → Root cause, one sentence
2. LOCATE    → Exact file + line
3. FIX       → Minimal diff
4. CONFIRM   → "Hard reload to confirm: Ctrl+Shift+R"

### Rules (both error types)
- One error at a time. Never batch.
- If two errors appear: fix the one causing the other first.
- Same error 3 times after fixing → STOP. Say:
  "This fix isn't holding. Root cause is deeper — here's what I think it is."
- When you don't know: say "I need to see [file] lines [X-Y]." Wait. Don't guess.

### Hot Reload
- Frontend (Vite): auto-reloads on save. No action needed.
- Backend (Fastify): manual restart required after every fix.

---

## Never (absolute)
- Touch prisma/dev.db directly
- Modify deploy scripts unless asked
- Refactor working code while fixing a bug
- Hardcode strings, ports, paths, or magic numbers
- Create files not named in the task spec
- Add dependencies without asking


## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

**When anything is unclear — stop and interview the user:**
- Ask one question at a time. Never stack multiple questions.
- Always offer 2-4 concrete answer options. Never ask open-ended.
- Do not proceed until every ambiguity is resolved.
- Never invent, assume, or create to avoid asking. Inventing = wrong code.

**While asking — always suggest if relevant:**
- A better approach if one exists
- An alternative solution worth considering  
- An enhancement that adds value without scope creep
- Label these clearly: "Suggestion:" — do not implement unless user confirms.

**Only start coding when you can answer YES to all:**
- [ ] I know exactly what file(s) to touch
- [ ] I know exactly what the output looks like
- [ ] I have zero unresolved assumptions

### UI Rules
- All mandatory form fields MUST display a red asterisk (*)
  next to the label. No exceptions.
- Never render a form without marking required fields visually.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
