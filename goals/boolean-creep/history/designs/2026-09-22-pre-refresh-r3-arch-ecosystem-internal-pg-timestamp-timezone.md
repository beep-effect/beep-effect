# Instance

- id: `r3-arch-ecosystem-internal-pg-timestamp-timezone`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/ecosystem/effect-drizzle/src/pg/Column.ts:222`
- symbol: `SpecDefinition.timestamp` / `Timestamp`
- members: `ident`, `withTimezone`
- evidence classes:
  - E3 at `Column.ts:855-869` — `makeTimestamp` derives the expected identity from `withTimezone` and rejects disagreement.
  - E1 at `pg/combinators.ts:1008-1017` — the only public writer pairs `timestamptz/true` or `timestamp/false` in one operation.
  - E2 at `Column.ts:979-987` — the runtime guard accepts the descriptor only when identity agrees with the boolean.

# Current shape

The public `SpecDefinition.timestamp` member stores `ident: "timestamp" | "timestamptz"`, `mode`, and `withTimezone: boolean`. The exported `Timestamp<Mode, Timezone>` type carries the same correlation. `makeTimestamp` validates it, `Timestamp.toDrizzleBuilder` reads only the boolean, and the `timestamp()` combinator writes both from its option.

# Cardinality gap

The identity/boolean pair represents four combinations but only two are legal. The descriptor identity already names the exact SQL choice, so `withTimezone` is a redundant projection.

# Target schema

Use the existing `ident` literal owner rather than creating a duplicate domain. Remove `withTimezone` from `SpecDefinition.timestamp`. Change the exported type to `Timestamp<Mode, Identity extends "timestamp" | "timestamptz">` and derive Drizzle's required boolean only at `toDrizzleBuilder` via identity matching. Keep the user-facing `timestamp({ withTimezone })` option because function parameters are outside this campaign; map it once to the descriptor identity in the combinator's return type and writer.

Preserve defaults exactly: omitted `withTimezone` maps to `timestamptz`, true
maps to `timestamptz`, false maps to `timestamp`, and omitted mode remains
runtime `string`. Drizzle still receives `withTimezone: ident === "timestamptz"`
for both modes; this external builder boolean is projected and never stored.

No `LiteralKit` dependency should be introduced merely to restate the existing tagged-enum identity. The target satisfies the named-owner rider by making `ident` the sole internal domain source.

# Migration inventory

- `packages/ecosystem/effect-drizzle/src/pg/Column.ts:222-228` — delete `withTimezone` from the timestamp spec member.
- `Column.ts:414-429` — change `Timestamp`'s second generic from boolean timezone to literal identity and remove the redundant field.
- `Column.ts:855-885` — simplify `makeTimestamp`, delete the disagreement invariant, and derive the Drizzle option from `ident` in `toDrizzleBuilder`.
- `Column.ts:979-987` — remove `withTimezone` property checks and retain identity/mode validation.
- `Column.ts:1210` and `pg/table.ts:135-138` — update generic inference to the identity parameter without changing selected Drizzle builder types.
- `pg/combinators.ts:996-1017` — preserve the public boolean option but map its generic and runtime value to `ident`; stop storing the option in column metadata.
- `test/unit.test.ts:264-270,358-370` and timestamp fixtures — preserve SQL
  type/default metadata and add both identities and modes.
- `test/import-boundary.test.ts:188` — retain the proof that the deleted
  timestamp mismatch error text is absent from the consumer bundle.
- Package type tests and `pg/table.ts:135-138` — prove both identities retain
  date/string Drizzle builder inference.

# Guard-deletion accounting

Delete the constructor's identity/boolean mismatch guard, the `isSpec` equality guard, and all internal `withTimezone` field reads/writes. The Drizzle adapter's one literal-to-boolean projection is required by the upstream builder API and is not stored.

# Encoded-side impact

None. Column metadata is an in-memory decoded TypeScript contract; no JSON, database row, RPC, CLI, or persisted artifact encodes this descriptor. The exported decoded type migrates atomically with all in-repo consumers.

# Test impact

Add runtime and type-level assertions for default timestamptz, explicit timestamptz, and explicit timestamp-without-time-zone. Prove `isSpec` accepts both legal identities and no longer expects a redundant field; retain table-builder, default-now, bundle-size, and public import-boundary tests.

# Risk & sequencing

Tier 1A. The main risk is generic inference drift in `Field.Patched` and `ToDrizzleColumn`; land type aliases, combinator overloads, runtime builder projection, and type tests atomically. Run full `@beep/effect-drizzle` package verification.
