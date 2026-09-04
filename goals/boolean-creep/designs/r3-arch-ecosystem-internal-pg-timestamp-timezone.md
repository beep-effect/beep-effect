# Instance

- id: `r3-arch-ecosystem-internal-pg-timestamp-timezone`
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

No `LiteralKit` dependency should be introduced merely to restate the existing tagged-enum identity. The target satisfies the named-owner rider by making `ident` the sole internal domain source.

# Migration inventory

- `packages/ecosystem/effect-drizzle/src/pg/Column.ts:222-228` — delete `withTimezone` from the timestamp spec member.
- `Column.ts:414-429` — change `Timestamp`'s second generic from boolean timezone to literal identity and remove the redundant field.
- `Column.ts:855-885` — simplify `makeTimestamp`, delete the disagreement invariant, and derive the Drizzle option from `ident` in `toDrizzleBuilder`.
- `Column.ts:979-987` — remove `withTimezone` property checks and retain identity/mode validation.
- `Column.ts:1210` and `pg/table.ts:135-138` — update generic inference to the identity parameter without changing selected Drizzle builder types.
- `pg/combinators.ts:996-1017` — preserve the public boolean option but map its generic and runtime value to `ident`; stop storing the option in column metadata.
- `packages/ecosystem/effect-drizzle/test`, including type tests and bundle/import-boundary probes — update metadata expectations and prove both identities compile to the same Drizzle builders as before.

# Guard-deletion accounting

Delete the constructor's identity/boolean mismatch guard, the `isSpec` equality guard, and all internal `withTimezone` field reads/writes. The Drizzle adapter's one literal-to-boolean projection is required by the upstream builder API and is not stored.

# Encoded-side impact

None. Column metadata is an in-memory decoded TypeScript contract; no JSON, database row, RPC, CLI, or persisted artifact encodes this descriptor. The exported decoded type migrates atomically with all in-repo consumers.

# Test impact

Add runtime and type-level assertions for default timestamptz, explicit timestamptz, and explicit timestamp-without-time-zone. Prove `isSpec` accepts both legal identities and no longer expects a redundant field; retain table-builder, default-now, bundle-size, and public import-boundary tests.

# Risk & sequencing

Tier 1A. The main risk is generic inference drift in `Field.Patched` and `ToDrizzleColumn`; land type aliases, combinator overloads, runtime builder projection, and type tests atomically. Run full `@beep/effect-drizzle` package verification.
