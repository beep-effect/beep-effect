# @beep/agent-memory-store

Agent memory store: append-only node event log, store-side admission, Markdown projection and observation log for operator agent memory

## Surface

- See `src/index.ts` barrel — do not hand-maintain inventory tables here.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package; record only genuinely package-specific deltas here.
- The domain never depends on a database driver. `*.models.ts`, `*.events.ts`, `*.service.ts` and `*.errors.ts` never import `@beep/sqlite` or any `@effect/sql-*` package. A live Layer that composes the driver gets its own role file (for example `MemoryLog.layer.ts`) and translates `SqliteError` and `SqlError` into this package's tagged errors at that boundary.
- Prevalence never ranks or gates: observation counts are read only as distinct-lineage counts by consolidation, never by `Recall` or the admissibility gate.
- Before handing back a change, run `bun run beep quality package-verify @beep/agent-memory-store` from the repository root. Use `--quick` only for a justified lint+check subset; a failure arms the checkout's shared P0 inbox.
