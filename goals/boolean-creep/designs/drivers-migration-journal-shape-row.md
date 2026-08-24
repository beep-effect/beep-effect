# Instance

- id: `drivers-migration-journal-shape-row`
- file:line: `packages/drivers/postgres/src/PostgresDrizzle.service.ts:349`
- symbol: `MigrationJournalShapeRow`
- members: `exists`, `hasName`
- evidence classes:
  - E2 at `packages/drivers/postgres/src/PostgresDrizzle.service.ts:473` — if `!exists` return empty; else if `!hasName` take the legacy journal path; else the named-column path. Combined-true is only the modern path; `!exists && hasName` is never handled.
  - E4 at `packages/drivers/postgres/src/PostgresDrizzle.service.ts:476` — `hasName` is only inspected after `exists` is true; a name column cannot exist without the table.

# Current shape

Live declaration at `packages/drivers/postgres/src/PostgresDrizzle.service.ts:349`:

```ts
const MigrationJournalShapeRow = S.Struct({ exists: S.Boolean, hasName: S.Boolean }).pipe(
  $I.annoteSchema("MigrationJournalShapeRow", {
    description: "Information-schema projection used to detect a current or legacy Drizzle journal.",
  })
);
```

# Cardinality gap

Two booleans represent four combinations; only three journal shapes are legal:

- `missing` — the journal table does not exist.
- `legacy` — the table exists without a `name` column.
- `current` — the table and `name` column exist.

The fourth combination, `exists: false, hasName: true`, cannot describe an information-schema result. Because this row is derived from one database inspection, the query should project the literal directly rather than store or normalize two flags afterward.

# Target schema

Add `LiteralKit` from `@beep/schema`; there is no nearby journal-shape literal to reuse.

```ts
const MigrationJournalKind = LiteralKit(["missing", "legacy", "current"]).pipe(
  $I.annoteSchema("MigrationJournalKind", {
    description: "Detected shape of the Drizzle migration journal.",
  })
);
type MigrationJournalKind = typeof MigrationJournalKind.Type;

const MigrationJournalShapeRow = S.Struct({ kind: MigrationJournalKind }).pipe(
  $I.annoteSchema("MigrationJournalShapeRow", {
    description: "Information-schema projection of the detected Drizzle migration-journal shape.",
  })
);
```

Change the SQL projection to one `CASE` expression aliased as `kind`: table absent -> `missing`; table present and name column absent -> `legacy`; otherwise -> `current`. Decode that one field and branch exhaustively with `MigrationJournalKind.$match`; do not decode the old booleans and translate them in TypeScript.

# Migration inventory

- `packages/drivers/postgres/src/PostgresDrizzle.service.ts:9-17` — import `LiteralKit` from `@beep/schema` alongside the existing imports.
- `packages/drivers/postgres/src/PostgresDrizzle.service.ts:349-353` — add `MigrationJournalKind` and replace the two-field row with `{ kind }`.
- `packages/drivers/postgres/src/PostgresDrizzle.service.ts:449-462` — replace both `EXISTS ... AS exists/hasName` projections with a single SQL `CASE ... AS kind`; this is the only write site for the derived row.
- `packages/drivers/postgres/src/PostgresDrizzle.service.ts:463-472` — continue decoding the single returned row through `MigrationJournalShapeRow`.
- `packages/drivers/postgres/src/PostgresDrizzle.service.ts:473-476` — replace the ordered boolean `if` chain with exhaustive `missing`/`legacy`/`current` literal arms; the existing legacy and current branch bodies remain unchanged.

Repository-wide search finds no other source read or write of `MigrationJournalShapeRow`, `shape.exists`, or `shape.hasName`.

# Guard-deletion accounting

- `packages/drivers/postgres/src/PostgresDrizzle.service.ts:473-476` — delete the ordered coherence chain `if (!exists) ...; if (!hasName) ...`, whose correctness depends on checking table existence before column existence. Exhaustive literal arms make the missing-with-name state unrepresentable.
- `packages/drivers/postgres/src/PostgresDrizzle.service.ts:449-462` — delete the pair of independent boolean projections whose output type admits the impossible combination; the SQL `CASE` produces exactly one legal literal.

# Encoded-side impact

none (internal)

# Test impact

- `packages/drivers/postgres/test/integration/Postgres.pglite.test.ts:180-255` — current named-journal handoff remains the `current` branch regression.
- `packages/drivers/postgres/test/integration/Postgres.pglite.test.ts:259-316` — complete legacy-name behavior remains covered.
- `packages/drivers/postgres/test/integration/Postgres.pglite.test.ts:319-397` — the version-zero table without a `name` column exercises the `legacy` arm and its upgrade.
- `packages/drivers/postgres/test/integration/Postgres.pglite.test.ts:399-410` — partial legacy journal rejection remains a fail-closed regression.
- No test touches the private row members directly. Add a missing-table assertion only if existing first-run migration coverage does not already execute the `missing` arm.

# Risk & sequencing

The query projection and decoder must land together because SQL result keys change from `exists`/`hasName` to `kind`. Preserve the ordering semantics of the current checks in the SQL `CASE`, and keep all legacy-journal resolution code byte-for-byte equivalent inside its new arm. This Tier 1 instance shares the large migration service and integration suite with other Postgres work, so minimize edits outside the query, schema, and dispatch.
