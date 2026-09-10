# Instance

- id: `runtime-activity-payload-kind`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:625`
- symbol: `RuntimeActivity`
- members: `activityType`, `artifactId`, `spanIds`
- evidence classes:
  - E1 at `ProfessionalRuntime.fixtures.ts:378-390,662-674` — both deterministic writers emit artifact ingestion with only `artifactId` and candidate proposal with only `spanIds`.
  - E2 at `ProfessionalRuntime.fixture-service.ts:316-330` — proposal acceptance compares the complete encoded object with the deterministic fixture, rejecting extra, missing, crossed, or combined activity payloads.

# Current shape

`RuntimeActivityType` is the existing two-literal owner at `ProfessionalRuntime.values.ts:247-284`. `RuntimeActivity` stores that type beside independently defaulted optional `artifactId` and `spanIds` fields at `ProfessionalRuntime.contracts.ts:603-642`. It is nested in the client-safe `SdkContextPacket.activities` array at lines 677-792 and in `CandidateOutputSet` at lines 833-855. Both `RuntimeActivity.encodeResult` and `CandidateOutputSet.encodeResult` expose encoded DTOs.

The law and wealth fixture writers at `ProfessionalRuntime.fixtures.ts:378-390,662-674`, both checked-in `expected.context-packet.json` files, and both public JSDoc examples at `ProfessionalRuntime.contracts.ts:603-620,677-747` agree on two payload-bearing forms: artifact ingestion carries its artifact id, and candidate-work proposal carries its span-id array. The validation pass reads activity principal ids at `ProfessionalRuntime.fixture-service.ts:123-180`. The SDK returns generated fixtures at lines 302-315 and accepts proposals only after complete plain-JSON equality with a generated fixture at lines 316-330.

No production writer, public example, expected packet, validator, or accepted SDK path supports neither payload, crossed payloads, or both payloads. The `Option` defaults and schema-derived arbitrary round-trip at `ProfessionalRuntime.test.ts:328-347` prove syntactic construction and codec invertibility only. In particular, both-present can be constructed by the permissive class, but the only accepting service rejects it because it differs from the generated packet.

# Cardinality gap

Two activity literals and two optional-payload presence bits represent eight tuples. Exactly two are supported:

| activityType | artifactId | spanIds |
| --- | --- | --- |
| `artifact_ingested` | present | absent |
| `candidate_work_proposed` | absent | present |

The payload contents remain variable: preserve every valid `RuntimeArtifactId` and the complete ordered `ReadonlyArray<RuntimeSpanId>`, including the current array schema's empty-array acceptance. Cardinality concerns only payload presence, not identifier values or array length.

# Target schema

Replace the flat class with a schema union discriminated by the existing encoded `activityType` key:

- `RuntimeArtifactIngestedActivity` has `activityType: "artifact_ingested"`, required `artifactId`, `activityId`, and `principalId`.
- `RuntimeCandidateWorkProposedActivity` has `activityType: "candidate_work_proposed"`, required `spanIds`, `activityId`, and `principalId`.

Expose their union under the existing `RuntimeActivity` schema/type name and retain `RuntimeActivity.encodeResult`. Reuse `RuntimeActivityType` options for the discriminants and existing identifier/array schemas. Do not model the choice as `Option<Literal>`, discard either payload, add a second tag, or create an eight-case enum. The union's two cases carry the real payload directly.

# Migration inventory

- `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts:247-284` — reuse `RuntimeActivityType` and its two encoded literals unchanged.
- `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:603-642` — replace the flat optional-field class with the two payload-bearing cases and exported union; preserve field annotations and the `RuntimeActivity.encodeResult` API.
- `ProfessionalRuntime.contracts.ts:677-792` — keep `SdkContextPacket.activities: Array<RuntimeActivity>`, all packet fields, schema version, and public example encoding unchanged.
- `ProfessionalRuntime.contracts.ts:833-855` — keep `CandidateOutputSet.fromUnknown` and `encodeResult`; nested activity decoding now enforces the union.
- `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.fixtures.ts:378-390,662-674` — construct the matching union cases without changing any ids, span order, activity order, or packet bytes.
- `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.fixture-service.ts:123-180,298-335` — preserve principal validation, generated packet reads, exact proposal comparison, promotion sequencing, errors, and spans. Exhaustive activity matching is unnecessary because the shared `principalId` remains directly readable.
- `packages/agents/use-cases/src/public.ts:74-92,133-147` and `package.json:32-40` — preserve the public DTO/value exports.
- `packages/agents/use-cases/test/ProfessionalRuntime.test.ts:90-157` — retain fixture and exact encoded-shape assertions; instantiate the artifact case explicitly.
- `ProfessionalRuntime.test.ts:159-325` — preserve SDK retrieval, validation, proposal equality, typed errors, and promotion behavior; add rejection coverage for each unsupported activity shape through the public decoded command path.
- `ProfessionalRuntime.test.ts:328-347` — retain schema-derived round trips, now generated from the two-case union, and add explicit exact encoding for the candidate case.
- `goals/agentic-professional-runtime/fixtures/runtime-data-loop/law-patent-intake/expected.context-packet.json:70-89` and `wealth-cash-request/expected.context-packet.json:70-89` — no edit; both already encode the target cases exactly.

Targeted repository and public-barrel search found no other constructor or payload reader. There is no CLI consumer or persistence adapter beyond the checked-in versioned expected packets; the public SDK DTO and encode/decode APIs make this a wire-facing contract.

# Guard-deletion accounting

Delete both `OptionFromOptionalKey` wrappers and `withNoneDefault` calls at `ProfessionalRuntime.contracts.ts:629-635`. Delete optional-payload branching from constructors and the possibility of using `RuntimeActivity.make` with a mismatched payload. The discriminated union makes payload presence structural, so no new relational validator, normalizer, or comment-only invariant is required. Update the arbitrary test to generate the union rather than all eight flat combinations.

# Encoded-side impact

The two supported packet projections are byte-shape identical: the discriminator remains `activityType`, required payload keys retain their existing names and encoded values, and the absent opposite key remains omitted. Activity and span order are unchanged. Decoding now rejects the six unsupported projections previously admitted by the permissive flat schema. No compatibility transform is warranted for those projections: none appears in either versioned fixture, public example, production writer, or accepted SDK request, and the existing exact-fixture gate already rejects them as business inputs.

# Test impact

Assert exact encode/decode for both variants, arbitrary round trips over the union, and preservation of ordered span arrays and exact ids. Add negative decode or proposal tests for neither payload, each crossed single payload, and both-present forms for both activity types. Retain both deterministic fixture snapshots, context-packet retrieval, exact proposal acceptance, principal validation, typed failures, and promotion-gate sequencing.

# Risk and sequencing

Tier 2 stored/wire migration. Land the union, both fixture constructors, public examples, and tests atomically. The main risks are changing the versioned packet bytes, treating ordered span ids as a set, losing shared-field access used by validation, or accidentally accepting combined payloads. No new discriminator string, stored state, dependency, generated file, or generic helper is introduced.
