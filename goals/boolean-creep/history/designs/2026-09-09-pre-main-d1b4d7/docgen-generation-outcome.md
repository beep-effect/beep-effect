# Instance

- id: `docgen-generation-outcome`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Docgen/Docgen.schemas.ts:392`
- symbol: `DocgenGenerationResult`
- members: `success`, `error`, `moduleCount`
- evidence: E3/E2 at `internal/RunDocgen.ts:71-115` and `Docgen.render.ts:113-129`.

# Current shape

The class stores `success`, optional `moduleCount`, and optional `error` beside package identity and independent optional process output (`Docgen.schemas.ts:392-404`). Nonzero exits and caught execution failures write false plus error and omit module count; success writes true plus a count and omits error (`internal/RunDocgen.ts:71-115`). The only reader partitions by success, displays count on success, and error/output on failure (`Docgen.render.ts:113-129`). It is internal and has no JSON codec.

# Cardinality gap

Boolean success and presence of two optional fields represent eight states. Exactly two are supported: success with moduleCount, and failure with error. `output` remains independent on both arms.

# Target schema

Define annotated `DocgenGenerationSucceeded` and `DocgenGenerationFailed` classes with `status: "succeeded" | "failed"`, required `moduleCount` or `error`, common package fields, and optional output. Combine with `S.toTaggedUnion("status")`.

# Migration inventory

- `Docgen.schemas.ts:375-404` — replace the optional bag with the two cases and keep the exported union name.
- `internal/RunDocgen.ts:71-115` — construct the appropriate case at all three returns; preserve exit/catch error text and output omission.
- `Docgen.render.ts:113-129` — match the tagged union and preserve success-first logging and failure count.
- `Docgen.command.ts` generation callers and tests/examples — update constructors and type annotations without changing scheduling.

# Guard-deletion accounting

Delete the `success` partition and optional payload fallbacks (`moduleCount === undefined`, `error ?? "unknown error"`) for internally constructed results. Tagged cases make both payloads required. Retain optional output checks.

# Encoded-side impact

None. The result is used for human CLI logging and is not JSON-encoded or persisted.

# Test impact

Cover successful zero/nonzero module counts, nonzero exit, execution catch, optional output on both cases, unchanged log text/order, and failure count. Add schema rejection for a missing case payload.

# Risk and sequencing

Tier 1. Preserve process failure recovery and run it before the Docgen persisted designs. Do not introduce a JSON surface or conflate output presence with outcome.
