# @beep/sqlite

Driver-level SQLite runtime via @effect/sql-sqlite-bun with FTS5 and sqlite-vec extension loading

## Surface

- See `src/index.ts` barrel — do not hand-maintain inventory tables here.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package; record only genuinely package-specific deltas here.
- Bun-only runtime: `@effect/sql-sqlite-bun` imports `bun:sqlite`, so nothing may import `@beep/sqlite` (the barrel, `SqliteClient.service.ts` or `Sqlite.test-layer.ts`) statically from a test. Load the driver with a dynamic `import("@beep/sqlite")` inside `describe.skipIf(!isBunRuntime)`. Only `@beep/sqlite/Sqlite.errors` is safe to import statically, and tests that use only it run on Node and Bun.
- The package `coverage` script runs `bunx --bun vitest`, so the coverage lane measures the Bun-only client code. Keep it on Bun.
- Before handing back a change, run `bun run beep quality package-verify @beep/sqlite` from the repository root. Use `--quick` only for a justified lint+check subset; a failure arms the checkout's shared P0 inbox.
