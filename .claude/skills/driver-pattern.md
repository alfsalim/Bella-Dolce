# Skill: Driver Pattern

All database access goes through the persistence interface — never direct SQL in services.

## Interface location
src/interfaces/ — defines the persistence contract all drivers must implement.

## Existing drivers
- src/drivers/sqlite.driver.ts — used in unit tests with :memory:
- src/drivers/postgres.driver.ts — used in integration tests and production
- src/drivers/mysql.driver.ts

## Adding a new driver
1. Implement the interface from src/interfaces/
2. Add migration scripts to src/migrations/<driver>/
3. Every migration needs UP and DOWN
4. Never modify an existing migration file — new fields go in a new numbered migration
5. Add driver to vitest.config if it needs a separate test project

## Test rule
- Unit tests: instantiate SqliteDriver(':memory:') directly — no mocks, no env-gating
- Integration tests: instantiate PostgresDriver with real connection — requires Docker
