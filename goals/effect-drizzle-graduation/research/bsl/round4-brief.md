# BSL Round 4 Brief — The Gauntlet: Live Postgres, drizzle-kit, Optimistic Repository

Implementer: Codex GPT 5.6 Sol (xhigh). Reviewer: Fable. Same protocol as rounds 2–3:
implement in `scratchpad/bsl/`, prove everything green, write
`research/round4-report.md`, do **not** commit.

Read first: `research/round3-report.md`, `research/round3-brief.md` (laws + conventions
sections apply verbatim — zero runtime type assertions, overload-with-broad-impl,
`TaggedErrorClass` + `.make()`, effect helper modules, both-sides-of-every-invariant,
JSDoc titled examples), then the current `scratchpad/bsl/*.ts` sources.

## Operator decisions (locked — do not relitigate)

1. **rowVersion = optimistic concurrency.** The update payload REQUIRES the expected
   version; the update executes `WHERE <id> = ? AND <version> = expected` with
   `SET <version> = expected + 1`; zero rows matched → typed `VersionConflictError`.
   No blind-increment mode, no per-entity policy switch this round.
2. **Audit timestamps = timestamptz + ISO string.** The round-3
   `DateTimeInsert`/`DateTimeUpdate` paved road stands. No millis mode, no millis
   transform.
3. **Enum implicit naming stays field-key-derived.** Shared cross-table enums use
   explicit names; document this in the report, change nothing.

## Verified environment facts

- `@beep/pglite` (packages/drivers/pglite) exports
  `PgliteTestLayer: Layer.Layer<PgliteClientValue | Pg.PgClient | SqlClient.SqlClient, PgliteError>`
  (`src/Pglite.test-layer.ts:37`) — an effect v4 SqlClient over in-process WASM
  Postgres. Its own test (`test/PgliteClient.test.ts`) uses `@effect/vitest`'s
  `layer()` runner; **scratchpad stays on `bun:test`** — build the layer manually
  per suite (Scope + the v4 Layer build APIs; validate the exact incantation against
  installed effect source, and mirror how the driver's test provides services).
  SQL suites run sequentially (repo law: shared-SQL tests serialize).
- `drizzle-kit` is installed; `drizzle-kit/api-postgres` exports
  `generateDrizzleJson`, `generateMigration`, `pushSchema` (programmatic API).
- `@effect/sql-pg` is installed (the PgClient in the layer type).
- drizzle-orm ships a pglite adapter (`drizzle-orm/pglite`) usable to wrap the same
  PGlite instance if `pushSchema` requires a drizzle db object — verify against the
  installed rc build.

## Deliverables (priority order)

### A. Execution substrate

A test-support module (suggest `scratchpad/bsl/live.test-support.ts` or similar)
that builds the `PgliteTestLayer` once per suite under `bun:test` and exposes a
run-effect helper. Keep it minimal and reusable by every live suite below. Document
the v4 incantation you land on in the report (this is reference material for the
repo's eventual adoption).

### B. DDL path + drizzle-kit round-trip

The round's thesis: the BSL projection is drizzle-kit-equivalent to hand-written
tables. Prove it:

1. From the existing `bslSchema` assembly (tables + enums registry), produce DDL via
   the programmatic drizzle-kit API (`generateDrizzleJson` → `generateMigration`,
   or `pushSchema` against a `drizzle-orm/pglite` db — investigate which works with
   the installed rc; record the path and any rc-specific friction precisely).
2. Apply that DDL to pglite. **The executed DDL must come from the BSL projection,
   never hand-written SQL.**
3. No-op regeneration proof: after applying, a second diff/generation produces zero
   statements. This is the drift detector the whole experiment exists to enable.

If one API entry point is broken under the rc, fall back to another (e.g.
generateMigration between empty and current snapshots, executing statements through
the SqlClient) — but a fallback must still satisfy 2 and 3, and the report must say
exactly which path shipped and why.

### C. Repository execution proofs

Against the applied schema, execute `SqlModel.makeRepository(User, ...)` (the
round-3 fixture) through the pglite SqlClient:

- `insert` returns the decoded row: DB-assigned identity id present; Overrideable
  `createdAt`/`updatedAt` actually stored and round-tripped.
- `findById` finds it; `delete` removes it.
- `update` uses the id as locator (not SET) and returns the updated row.
- **Option paved road live**: add a fixture field using `S.OptionFromNullOr` and
  prove `Option.none()` ⇄ SQL `NULL` ⇄ `Option.some(...)` round-trips through real
  rows via the model's decode path.

### D. Optimistic-version repository (the core feature)

Two halves, designed together so type-level, runtime, and SQL agree:

1. **Version marker in the meta algebra.** Suggest `pg.version()` (design the exact
   name/shape) valid on integer-family columns, recording version intent in Meta.
   Truth-table consequences, type and runtime identically:
   - insert: optional (the column keeps its SQL default — the kit fixture already
     uses `pg.default(1)`);
   - update: **required** — it is the expected-version token;
   - select/json: present.
   Invariants with negative fixtures: at most one version field per model; version
   requires an integer-family column; version is mutually exclusive with
   `generated`/`identity`.
2. **BSL repository builder** (new `repository.ts`, exported from `index.ts` and
   returned by the kit). Reuse `SqlModel.makeRepository` semantics for
   insert/findById/delete where possible; implement the optimistic update:

   ```sql
   UPDATE <table>
   SET <author fields, minus id, minus version>, <version> = <expected> + 1
   WHERE <id> = ? AND <version> = <expected>
   RETURNING *
   ```

   Zero rows → `VersionConflictError` (TaggedErrorClass: table, id, expected
   version; decide and document whether missing-row vs stale-version are
   disambiguated by a follow-up select or reported as one conflict). `updatedAt`
   must still stamp through the update-variant construction on this path.
3. **Execution tests**: happy path increments 1→2 and returns the row; stale
   expected version → `VersionConflictError`; two writers from the same snapshot —
   first wins, second conflicts.

### E. Enum live proof

Enum DDL from B applied; a valid enum value inserts and round-trips; an invalid
value is rejected by Postgres (assert the failure surfaces as a typed/SqlError,
not a silent success).

### F. Report

`research/round4-report.md`: per-deliverable outcomes; the exact drizzle-kit path
shipped (and what failed, if anything); the v4 layer-under-bun incantation; the
missing-vs-stale disambiguation decision; assertion census; open items → round-5
queue (candidates already known: `.array()` implementation per round-3 design,
reverse `many`/`through` relations, BaseEntity migration plan).

## Proofs

```sh
./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false
bun test scratchpad/bsl/
```

Both must be fully green including the new live suites (report unmasked exit codes —
no `| tail` verdicts). Zero runtime type assertions; census in the report. If a
deliverable is blocked by installed versions, finish the others and document the
blocker precisely — no silently degraded substitutes.
