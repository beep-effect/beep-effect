# Runtime evidence span eligibility audit

Reviewed against source `7440cb8c4302ce64b87860069a464bafbf65f576` and corpus main `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

## Final disposition

Keep `r26-agents-workspace-runtime-evidence-span-presence` disqualified as D1. Do not admit canonical id `runtime-evidence-span-presence`, and do not retain a schema migration for it.

The earlier provisional 6/4 design has been withdrawn. It incorrectly treated evidence rejected by business validation as unsupported by the public DTO contract. That would have removed a specifically asserted wire shape and the diagnostic path designed to handle it.

## Contract evidence

`RuntimeEvidenceRef` at `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:192-227` is exported through `packages/agents/use-cases/src/public.ts:74-92`. It deliberately models `spanId` and `spanIds` as independently optional keys with `None` defaults and exposes `RuntimeEvidenceRef.encodeResult`.

The test named `keeps touched runtime DTO encoded shapes stable` at `packages/agents/use-cases/test/ProfessionalRuntime.test.ts:107-157` provides specific compatibility evidence for two decisive shapes:

- `RuntimeEvidenceRef.make({ artifactId: "email-001" })` encodes exactly as `{ artifactId: "email-001" }` at lines 108 and 132-134. The absence of both span fields is therefore an intentional public DTO value.
- A value with both `spanId` and `spanIds` encodes both keys and preserves all values at lines 109-150. Combined presence is also intentional.

Production fixtures and public examples additionally cover single-only and nonempty-list-only forms throughout `ProfessionalRuntime.fixtures.ts:146-588` and `ProfessionalRuntime.contracts.ts:192-490`. Thus all four Boolean presence pairs have specific supported writers, examples, or compatibility fixtures.

The complete validation flow reinforces that distinction. `spanIdsFromEvidence` concatenates both fields at `ProfessionalRuntime.fixture-service.ts:53-56`. `collectEvidenceIssue` emits `evidence for <artifact> does not reference any spans` when that flattened payload is empty at lines 83-92, then retains separate unknown-artifact and unknown-span diagnostics at lines 94-101. `validateOutputSet` aggregates those issues into `ProfessionalRuntimeValidationError` at lines 182-190. The public SDK calls this validation before its deterministic exact-fixture comparison at `ProfessionalRuntime.fixture-service.ts:316-330`. Incomplete evidence is therefore intentionally representable as a validation input so callers receive the existing typed diagnostic; it is not an accepted candidate proposal.

This is the same boundary standard applied to the explicit M365 no-reason fixture: a concrete public codec fixture establishes a supported representation even when a later business decision does not accept that value.

## Full declared domains

At the Boolean-presence census level, all four tuples are supported:

| spanId | spanIds | evidence |
| --- | --- | --- |
| absent | absent | explicit stable encoded DTO fixture; later receives missing-span diagnostic |
| present | absent | production fixtures and public examples |
| absent | present | production fixtures and public examples use nonempty lists |
| present | present | explicit stable encoded DTO fixture; reader concatenates both |

The list field also has absent, present-empty, and present-nonempty values. This creates six detailed content states rather than four presence states. `Some([])` with no primary span follows the same intentional missing-span diagnostic as neither; `Some([])` with a primary span remains nonempty after concatenation. The schema-derived arbitrary test at `ProfessionalRuntime.test.ts:328-347` covers those encodable DTO values, while the explicit empty-result branch preserves their validation meaning. Empty versus nonempty list content does not create a Boolean-creep qualification: it is payload validation inside an intentionally broad input DTO.

## Readers, writers, and encoded boundary

- `ProfessionalRuntime.contracts.ts:192-227` owns both optional fields and the direct encoder.
- Claims, projects, tasks, drafts, and approval gates embed `RuntimeEvidenceRef` at `ProfessionalRuntime.contracts.ts:229-500`.
- `SdkContextPacket` and `CandidateOutputSet` transitively encode evidence at `ProfessionalRuntime.contracts.ts:752-855`.
- `ProfessionalRuntime.fixtures.ts:146-588` writes single-only and list-only production fixture evidence.
- `ProfessionalRuntime.fixture-service.ts:53-108` is the sole payload reader and deliberately supports concatenation of both fields plus diagnostics for an empty result.
- `ProfessionalRuntime.fixture-service.ts:316-330` validates before comparing the proposal to deterministic fixture output.
- `ProfessionalRuntime.test.ts:107-157,328-347` asserts exact public encodings and schema round trips.
- Checked-in context packets under `goals/agentic-professional-runtime/fixtures/runtime-data-loop/` contain accepted single-only and list-only evidence.

Targeted repository and public-barrel search found no additional writer or reader.

## Preservation requirements

Retain the current schema and all six detailed DTO content states. Preserve optional-key omission, explicit empty arrays, combined keys, exact span ordering and duplicates, the primary-before-list concatenation order, the missing-span diagnostic text and ordering, unknown-artifact and unknown-span diagnostics, `ProfessionalRuntimeValidationError`, public exports, `encodeResult`, nested packet bytes, and schema-derived arbitrary round trips.

No guard deletion is appropriate. The empty-result branch is a business validator for an intentionally representable incomplete DTO, not a coherence check made redundant by a narrower domain model.

## Parent reconciliation recommendation

Keep the raw record D1 with members `[spanId,spanIds]` and the Boolean truth table 4/4. Its disqualifier should cite both explicit exact-wire fixtures and state that the empty-empty representation is intentionally accepted by the public DTO/codec for later typed validation, while combined presence is intentionally flattened in primary-then-list order. If recording the richer content partition in notes, describe six encodable DTO states; do not convert that payload distinction into a qualified census cardinality.

## Verification

No design file remains, so design coverage is intentionally unchanged by this audit. Scoped `git diff --check` passed for this handoff. Independent P3 review remains pending.
