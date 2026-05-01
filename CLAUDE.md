# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

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
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.


## Bella-Dolce Project Context

### Stack
- Backend: Fastify + TypeScript → runs on port 3000 (dev: npm run dev:backend)
- Frontend: React + Vite + Tailwind → runs on port 5173 (dev: npm run dev)
- Database: SQLite via Prisma at prisma/dev.db
- Docker: only for final staging/prod — NOT used during active dev

### Dev Workflow (No Docker)
Start dev servers:
- Backend:  npm run dev:backend   (port 3000)
- Frontend: cd frontend && npm run dev  (port 5173, hot reload)
- DB:       file:./prisma/dev.db (local SQLite, no container)

### Testing Session Behavior
When user says "I am testing" or "start watching":
1. Monitor terminal output from both backend and frontend processes
2. When error appears:
   a. Explain what failed in plain English (root cause first)
   b. Identify exact file + line number
   c. Show minimal before/after diff (per Rule 3 — surgical changes)
   d. Apply fix
   e. Confirm hot reload picked it up (Vite auto-refreshes, backend needs restart)
   f. Report: "Fixed — here is what happened and why"
3. Fix one error at a time — do not batch fixes

### Deploy Only When Done
- Dev test:  ./deploy-bella.sh --dev   (Docker, port 3501)
- Prod:      ./deploy-bella.sh --prod  (streams to Windows via Tailscale)
- Never deploy mid-session to fix a bug — fix in hot reload first

### Never
- Touch prisma/dev.db directly
- Modify deploy scripts unless asked
- Refactor working code while fixing a bug (Rule 3)