# Instance

- id: `docgen-subject-collection-outcome`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.subjects.ts:847`
- symbol: `PackageSubjectCandidateResult`
- members: `timedOut`, `status`, `error`
- evidence: E1 at `Quality.subjects.ts:906-954` — the collector returns only completed or partial-timeout triples.

# Current shape

The internal collector result stores candidates, nullable error, the shared three-value `DocgenQualityPackageStatus`, and timedOut (`Quality.subjects.ts:829-859`). Its loop returns partial/true/message when the budget expires and completed/false/null after the scan (`Quality.subjects.ts:906-954`). `analyzePackageQuality` consumes it at `Quality.service.ts:267-309` and may independently observe expiry during subject finalization.

# Cardinality gap

Two booleans/presence states times three status literals represent 12 tuples. The collector supports two: completed + false + null, and partial + true + string. It never emits failed; failure exits the Effect and is converted later into a failed package report.

# Target schema

Reuse `DocgenQualityPackageStatus` as the literal owner, using its `completed` and `partial` members in two annotated cases. Define `PackageSubjectCollectionCompleted` with candidates and `status: "completed"`, and `PackageSubjectCollectionTimedOut` with candidates, `status: "partial"`, and required error. Combine through `S.toTaggedUnion("status")`. Do not share the package report union: this collector has no failed arm and different payload ownership.

# Migration inventory

- `Quality.subjects.ts:829-859` — replace the bag with the two-case internal schema.
- `Quality.subjects.ts:906-954` — construct the cases at the two returns while preserving partial candidates and timeout text.
- `Quality.service.ts:267-309` — match the collection case, then preserve the later budget check and package-level failure conversion.
- Focused Docgen quality tests around timeout and completed collection — update decoded access.

# Guard-deletion accounting

Delete collector-level `timedOut`, nullable error, and their correlation checks. Match the collector status once. Keep the package-level post-finalization `budgetExceeded` check because expiry can occur after collection and is a distinct boundary.

# Encoded-side impact

None. This collector result is internal and only feeds `DocgenQualityPackageReport`; it is never independently JSON-encoded.

# Test impact

Cover completed empty/nonempty candidates, timeout with retained partial candidates and exact message, failure propagation, and expiry during later finalization. Confirm the package report still emits its own legacy triple.

# Risk and sequencing

Tier 1 after `docgen-generation-outcome` and before the package report Tier 2 migration. Preserve source iteration order, exclusions, partial results, and error mapping.
