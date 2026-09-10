# Instance

- id: `ai-metrics-redaction-safety`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/library/ai-metrics/src/privacy.ts:134`
- symbol: `AiMetricsRedactionResult`
- members: `safeForDerivedUi`, `authHeaderCount`, `bearerTokenCount`,
  `openAiKeyCount`, `secretAssignmentCount`
- evidence: E3 at `privacy.ts:689-702` — the only production writer derives
  safety from the joint-zero status of four independently computed counters.

# Current shape

The exported schema stores four detector counts, the independent
`excludedRawTextFieldCount`, and `safeForDerivedUi`. It is nested in
`AiMetricsPrivacyCheckResult` at `privacy.ts:280-291`, produced at 873-885,
encoded by `privacyCheckToJson` at 933-942, printed by the AI-metrics CLI at
`Programs.ts:1420-1452`, and projected separately into DuckDB at
`derived-storage.ts:122-142,1250-1271`. The DuckDB column stores only the
derived safety boolean; privacy-check JSON stores the full structure.

# Cardinality gap

Treating each count as zero/nonzero gives 32 coarse combinations: four detector
bits plus safety. Exactly 16 are legitimate. All-zero is safe; each of the 15
nonempty detector subsets is unsafe. A synthetic call through
`makeAiMetricsPrivacyCheckResult` reproduced every subset independently using
fixture-only strings. `excludedRawTextFieldCount` is outside the cluster and
may be nonzero in either safety case.

# Target schema

Define `AiMetricsRedactionDetector` with a four-value LiteralKit and
`AiMetricsRedactionMatch` carrying `{ detector, count: S.Positive }`. Define a
safe case tagged `status: "safe"` with no match payload and an unsafe case tagged
`status: "unsafe"` with
`matches: S.NonEmptyArray(AiMetricsRedactionMatch)`. Both retain
`excludedRawTextFieldCount`. The production constructor emits matches in the
fixed legacy field order: authorization header, bearer token, OpenAI key,
secret assignment.

Keep a private encoded schema with the six current fields in their exact order.
A fallible `S.decodeTo` transformation converts zero counts to absent match
entries, requires `safeForDerivedUi` iff the resulting list is empty, and
encodes the inverse counters plus derived boolean. This retains exact counts and
all 16 supported subsets without a 15-arm hand-written union.

# Migration inventory

- `privacy.ts:68-75,112-146` — name the detector domain and match/case schemas,
  retain the regexes, and add the exact legacy compatibility codec.
- `privacy.ts:689-703` — construct the ordered match list from the four counts
  and select safe/unsafe once; keep `excludedRawTextFieldCount` independent.
- `privacy.ts:240-291,873-885,887-942` — migrate nested schema, examples,
  constructor, and JSON encoder while preserving the outer payload.
- `derived-storage.ts:1240-1271` — derive the persisted SQL boolean from the
  tagged case at the existing write boundary; keep its column name/value.
- `AIMetrics/internal/Programs.ts:1420-1452` — render the same boolean text from
  the case and preserve JSON output.
- `test/privacy.test.ts` and AI-metrics command/storage tests — add the synthetic
  subset matrix and byte compatibility without real transcripts or secrets.

# Guard-deletion accounting

Delete the stored decoded `safeForDerivedUi` field and its sum-equals-zero
write. Readers use the tagged case or its derived guard. The codec retains one
coherence check for legacy encoded inputs; application code no longer carries
five correlated fields or recalculates their relationship.

# Encoded-side impact

Tier 2 JSON and DuckDB compatibility. For all 16 synthetic counter subsets,
compare old/new canonical `encode(decode(payload))`, preserving the four count
keys, exact counts, `excludedRawTextFieldCount`, `safeForDerivedUi`, and property
order. The SQL projection remains the same boolean. Reject encoded safe+nonzero
and unsafe+all-zero rows as incoherent; permissive schema generation does not
make them legitimate. Never use real secret values or transcripts in fixtures.

# Test impact

Add a 16-row synthetic matrix through the public constructor and codec, plus
mixed-pair decode failures. Retain existing arbitrary bearer-redaction and hash
privacy tests. Assert CLI JSON/text and DuckDB `redaction_safe_for_derived_ui`
remain unchanged for safe and multiple unsafe subsets.

# Risk and sequencing

Land as one Tier 2 AI-metrics change because JSON and SQL project the same
proof differently. Preserve detector overlap exactly; the migration reorganizes
results after counting and must not change any regex, replacement, hashing, or
raw-text exclusion behavior.
