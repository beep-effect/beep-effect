# Instance

- id: `docgen-worker-packet-review`
- source: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerEval.ts:530`
- symbol: `PacketCandidate`
- members: `isFail`, `review`
- evidence: E3 at `QualityWorkerEval.ts:693-731` — isFail is exactly review tier fail, defaulting false when no review exists.

# Current shape

The internal `PacketCandidate` type stores an Option review and a derived `isFail` beside packet, subject, finding, impact, and package metadata (`QualityWorkerEval.ts:525-540`). `packetCandidate` derives the flag at 693-731. `docgenPacketCandidateOrder` consumes it to put failures first before descending impact and stable id order (`quality/Quality.service.ts:55-78`), and packet selection uses that order at `QualityWorkerEval.ts:667-678,752-785`.

# Cardinality gap

Review has four states: None or a review with `pass`, `warn`, or `fail` from the existing `DocgenQualityTier` LiteralKit. Paired with isFail this represents eight states. Four are legal: false+None, false+pass, false+warn, and true+fail.

# Target schema

Define four internal annotated cases discriminated by `reviewDisposition: "none" | "pass" | "warn" | "fail"`, reusing `DocgenQualityTier` for the three review-bearing literals. None has no review; the other cases require the unchanged `DocgenQualityReview` payload. Combine through `S.toTaggedUnion("reviewDisposition")`. Derive failure priority by matching the fail case.

# Migration inventory

- `QualityWorkerEval.ts:525-540` — replace Option-plus-flag with four cases while retaining all other candidate payload.
- `QualityWorkerEval.ts:678-731` — classify the located review once and preserve finding-code/impact calculations.
- `QualityWorkerEval.ts:752-785` — keep package stratification and selection order.
- `quality/Quality.service.ts:55-78` — change the shared ordering helper to accept a failure-priority projection or readiness discriminator without forcing persisted report types into this union.
- Focused worker-eval and remediation ranking tests — migrate constructors and preserve deterministic order.

# Guard-deletion accounting

Delete `isFail`, its Option map/default derivation, and any repeated `review.tier === "fail"` used solely for ordering. The no-review case removes Option checks for review payload access. Retain subject Option because packet-to-subject lookup can fail independently.

# Encoded-side impact

None. `PacketCandidate` is an internal ranking value; worker eval JSON stores selected packet results, not this candidate object.

# Test impact

Test all four cases, fail-first then impact/id ordering, missing review and missing subject, package round-robin selection, packet cap zero, and unchanged prompts/finding codes. Confirm no candidate discriminator leaks into worker JSON.

# Risk and sequencing

Tier 1 after the subject collector. Keep the shared `DocgenQualityTier` owner and deterministic comparator semantics; do not merge this internal candidate with persisted review or report schemas.
