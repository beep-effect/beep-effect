# Instance

- id: `r2-foundation-graph-validation-result`
- file:line: `packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/Types.ts:527`
- symbol: `ValidationResult`
- members: `valid`, `errors`
- evidence classes:
  - E3 at `Types.ts:500-507` — the contract says errors make the result invalid.
  - E1 at `Executor.ts:463-472` — validation writes valid with no errors or invalid with the collected errors in one return.

# Current shape

The exported `S.Class` carries `errors`, `valid`, and independent `warnings`. Static `valid`, `invalid`, and `withWarnings` helpers construct/copy it. `GraphExecutor.validate` returns it; graph-operation definitions and tests consume that decoded TypeScript shape. No source consumer serializes or persists this result.

# Cardinality gap

The boolean plus error-array presence represents four coarse combinations. Three remain accepted by current constructors (`valid + empty`, `invalid + empty`, `invalid + nonempty`); `valid + nonempty` contradicts the documented result. Warnings are orthogonal and stay outside the outcome distinction.

# Target schema

Replace the class with a named `ValidationResultKind` `LiteralKit(["valid", "invalid"])` mapped to a tagged union. Both members carry warnings. Only `invalid` carries `errors: ReadonlyArray<string>`; keep empty invalid errors accepted because the existing `invalid([])` constructor does. Reattach `cases`, `guards`, `match`, a `valid()` convenience, `invalid(errors)`, and dual `withWarnings` statics without recreating a `valid` boolean.

# Migration inventory

- `Types.ts:500-558` — define the two members, tagged union, and compatible decoded helper surface.
- `Operation.ts:23,68,109-116` — retain `ValidationResult` return typing and migrate the default constructor.
- `Executor.ts:100-103,457-467` — build tagged cases in the empty-graph warning and collected-error branches.
- `Executor.ts:468` — replace the unconditional `v.errors` read with an exhaustive `ValidationResult.match`: the invalid case contributes its `errors`, while the valid case contributes `A.empty<string>()`.
- `Executor.ts:469` — retain the unconditional `v.warnings` aggregation because warnings are deliberately shared by both cases.
- `Executor.ts:470-472` — return `ValidationResult.cases.valid.make({ warnings })` or `ValidationResult.cases.invalid.make({ errors, warnings })`; never reconstruct a `valid` boolean.
- All source reads returned by `rg ValidationResult packages/foundation/capability/nlp-processing/src` — migrate construction and type references to the tagged owner.
- `test/Graph/GraphOperations.test.ts:276,299` — replace both live `.valid` assertions with `ValidationResult.guards.valid(...)` assertions and retain the empty-graph warning assertion.
- Remaining `test/Graph/GraphOperations.test.ts` coverage and any package tests added by the implementation — assert the two cases, invalid error payload, and warning preservation through `GraphExecutor.validate`.

# Guard-deletion accounting

Delete all object writes that set `valid` in parallel with errors and both test
reads of `.valid`. Case constructors make the outcome explicit;
`withWarnings` must match both cases rather than spread an unconstrained bag,
and the executor must case-match before reading the invalid-only error payload.

# Encoded-side impact

No supported encoded or persisted boundary was found. This is an authorized atomic decoded TypeScript migration: every in-repo consumer changes in the same Tier 1 PR. Do not add a compatibility alias or retain a derived `valid` getter.

# Test impact

Cover valid-without-errors, invalid-with-empty-errors, invalid-with-errors,
warnings on each member, and the executor's empty-graph warning. Prove that
valid per-node results contribute no errors, invalid results contribute their
payload, and warnings aggregate from both cases. Existing operation/executor
tests must remain green; use schema-derived guards rather than a compatibility
`.valid` getter.

# Risk & sequencing

Tier 1C. The only subtlety is preserving `invalid([])` and dual `withWarnings`; do not silently strengthen the public decoded constructor beyond current behavior. Run full `@beep/nlp-processing` package verification.
