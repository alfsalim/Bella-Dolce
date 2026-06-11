# Skill: TDD Loop

Every code change follows this loop. No exceptions.

## 1. Red
- Write the test first in tests/unit/ (or tests/integration/ if it needs Postgres)
- Run: npm run test:unit -- <file>
- Confirm: test fails for the right reason (not a syntax error)

## 2. Green
- Write minimum code to pass
- Run the same test command
- Confirm: pass

## 3. Refactor
- Clean up. Re-run test. Still green.

## 4. Typecheck gate
- Run: npm run typecheck (or tsc --noEmit)
- Vitest passing ≠ TypeScript passing. Both must be green.

## 5. Integration check (if logic touches DB or API)
- Run: npm run test:integration
- Requires Docker up

## 6. Commit
- Husky pre-commit runs test:unit + mock-pattern block
- If it fails, fix, don't bypass

## Forbidden
- Writing implementation before test
- Skipping typecheck because tests pass
- --no-verify on commit