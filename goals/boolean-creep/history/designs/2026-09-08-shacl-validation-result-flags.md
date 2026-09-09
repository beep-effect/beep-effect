> Superseded on 2026-09-08: public-service reproduction proved all four flag
> combinations are supported. See `data/design-refresh-2026-09-08-nlp-shacl.md`.
> Do not implement this design.

## Instance

- id: `shacl-validation-result-flags`
- file:line: `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:285`
- symbol: `ShaclValidationResult`
- members: `conforms`, `truncated`
- evidence classes:
  - E1 — `packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts:195`: the truncation writer sets `conforms: false` and `truncated: true`; the completion writer sets `truncated: false`.
  - E2 — `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:71`: admission recognizes only `conforms && !truncated`, while the other producer outcomes are rejected.
  - E4 — `packages/drivers/shacl/src/Shacl.validation.ts:420`: the adapter projects one engine report into the ordered conforming, violating, or truncated result state.

## Current shape

`ShaclValidationResult` is a schema-first service result with a common violation
payload and two correlated booleans:

```ts
export class ShaclValidationResult extends S.Class<ShaclValidationResult>(...)({
  conforms: S.Boolean,
  violations: S.Array(ShaclValidationViolation),
  truncated: S.Boolean,
}) {}
```

The bounded implementation at
`packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts:195-210`
writes only `(false, true)`, `(false, false)`, or `(true, false)`. The
`shacl-engine` adapter at
`packages/drivers/shacl/src/Shacl.validation.ts:420-424` derives the same three
outcomes from one report and retained-result count. The earlier D1 adjudication
mistook schema representability for legal domain state; round 19 re-opened the
record with producer and reader evidence.

## Cardinality gap

Two booleans represent four states. Three are legal: `conforming`, `violating`,
and `truncated`. `conforms && truncated` is illegal because truncation means the
validation has unreturned violation results, while conformance requires no
violation result.

The `violations` array remains a common payload. In particular, a caller may
request `maxResults: 0`, so the `truncated` outcome must continue to permit an
empty retained array. This migration must not strengthen that payload or reject
an input the current service accepts.

## Target schema

Define a named reusable literal domain and a decoded value class with one
schema-owned field. Keep the old encoded object behind a transformation codec:

```ts
export const ShaclValidationStatus = LiteralKit([
  "conforming",
  "violating",
  "truncated",
]).pipe(
  $I.annoteSchema("ShaclValidationStatus", {
    description: "Completeness and conformance outcome of one SHACL validation run.",
  })
)
export type ShaclValidationStatus = typeof ShaclValidationStatus.Type

export class ShaclValidationResultValue extends S.Class<ShaclValidationResultValue>(...)({
  status: ShaclValidationStatus,
  violations: S.Array(ShaclValidationViolation),
}) {}

const ShaclValidationResultEncoded = S.Struct({
  conforms: S.Boolean,
  violations: S.Array(ShaclValidationViolation),
  truncated: S.Boolean,
})

export const ShaclValidationResult = ShaclValidationResultEncoded.pipe(
  S.decodeTo(
    ShaclValidationResultValue,
    SchemaTransformation.transform({
      decode: ({ conforms, truncated, violations }) =>
        ShaclValidationResultValue.make({
          status: truncated ? "truncated" : conforms ? "conforming" : "violating",
          violations,
        }),
      encode: ({ status, violations }) => ({
        conforms: ShaclValidationStatus.is.conforming(status),
        violations,
        truncated: ShaclValidationStatus.is.truncated(status),
      }),
    })
  )
)
export type ShaclValidationResult = typeof ShaclValidationResult.Type
```

This is a `LiteralKit`, not a tagged union: all three outcomes carry the same
`violations` field and no outcome owns a distinct payload. Use
`ShaclValidationStatus.is.*` or `.$match` for branches; do not recreate
`isConforming` or `isTruncated` predicates. Writers construct decoded values
with `ShaclValidationResultValue.make`; the transformed
`ShaclValidationResult` codec intentionally has no `.make` constructor.

## Migration inventory

- `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`
  — add and export `ShaclValidationStatus` and
  `ShaclValidationResultValue`; keep the old three-key object as the encoded
  side of the transformed `ShaclValidationResult` codec; update its examples
  and the service-layer example.
- `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts:451-452`
  — retain `ShaclValidationResult` transitively inside
  `RunOntologyValidationResult`; the RPC schema must therefore continue to
  encode the old boolean-key object even though handlers consume the decoded
  status value.
- `packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts`
  — construct `truncated`, `conforming`, or `violating` directly and update the
  package example.
- `packages/drivers/shacl/src/Shacl.validation.ts` — derive one status from the
  engine report and retained-result count, giving truncation precedence over
  ordinary violation and conformance.
- `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts` — admit the
  `conforming` status and map both nonconforming statuses to the existing typed
  rejected verdict without changing violation mapping.
- `packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts` —
  update examples and keep repair enumeration over the common `violations`
  payload unchanged.
- `packages/ontology/ui/src/aggregates/Session/Session.validation.tsx` — render
  the main result badge and truncated badge from the status literal; keep the
  violation list and empty presentation unchanged.
- `packages/ontology/ui/src/aggregates/Session/Session.metrics.tsx` — no shape
  change is needed because it reads only the common violation count, but retain
  it in the consumer audit.
- Update all constructor fixtures and property assertions in
  `packages/foundation/capability/semantic-web/test/IdentityRdfBinding.test.ts`,
  `packages/drivers/shacl/test/ShaclEngineValidation.test.ts`,
  `packages/epistemic/server/test/BoundedShaclValidator.test.ts`,
  `packages/epistemic/server/test/IdentityShaclProjection.e2e.test.ts`,
  `packages/epistemic/use-cases/test/EpistemicUseCases.test.ts`,
  `packages/ontology/use-cases/test/Session.validation.test.ts`,
  `packages/ontology/use-cases/test/Session.test.ts`,
  `packages/ontology/server/test/OntologyTools.test.ts`, and
  `packages/ontology/server/test/OntoauthorMatCompetency.test.ts`.
- Re-run source searches through `packages/**/src`, `apps/**/src`, tests, and
  package barrels for `ShaclValidationResult`, `.conforms`, and `.truncated`.
  `apps/professional-desktop/test/ontology-sidecar-registration.test.ts` and
  `packages/ontology/client/test/Session.atoms.test.ts` read only the common
  violation payload and should remain unchanged.

## Guard-deletion accounting

- Delete `result.conforms && !result.truncated` from
  `ClaimGate.service.ts`; one `conforming` literal guard replaces the manual
  coherence test.
- Delete the paired conformance/truncation expressions in both service writers;
  each writer selects one named status once.
- Delete the UI's independent `conforms` and `truncated` branches and render
  from one status match. No boolean alias or compatibility getter may preserve
  the invalid combined state.
- Remove the stale D1 prose that described the flags as independent; this
  design and the corrected canonical record are its evidence-backed
  replacement.

## Encoded-side impact

Tier 2 wire compatibility is mandatory. `ShaclValidationResult` is nested in
the `RunOntologyValidationResult` success schema at
`packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts:451-452` and
crosses the ontology RPC/desktop-sidecar boundary. Its encoded form must retain
exactly `conforms`, `violations`, and `truncated`, with the same value types and
defaults. Encoding each decoded status yields the canonical legacy rows:

| decoded status | `conforms` | `truncated` |
| --- | --- | --- |
| `conforming` | `true` | `false` |
| `violating` | `false` | `false` |
| `truncated` | `false` | `true` |

Decode accepts every old boolean pair so deployed peers do not fail. The
historically representable but domain-incoherent `{ conforms: true,
truncated: true }` row normalizes to `truncated`; its next encode canonicalizes
to `{ conforms: false, truncated: true }`. The other three rows round-trip
exactly, including their violation arrays. The separate `shacl-engine`
`ReportShape` remains unchanged.

## Test impact

- Derive an arbitrary from the decoded value schema and assert its status is
  always one of the three literal members; the removed combined-true state is
  unconstructable.
- Add a four-row legacy decode/encode table: the three legal boolean rows
  round-trip byte-shape exactly, and combined-true decodes to `truncated` then
  canonicalizes only `conforms` to false. Add a nested
  `RunOntologyValidationResult` encode/decode and live RPC client round trip so
  decoded tags cannot leak onto the wire.
- Cover all three writers, including `maxResults: 0` preserving a truncated
  result with an empty retained array.
- Keep existing full-result and bounded-result package tests, updating boolean
  assertions to literal status assertions.
- Keep ClaimGate's admitted/rejected tests and add a truncated rejection case
  so the deleted conjunction has direct behavior coverage.
- Keep ontology repair generation and UI rendering tests for conforming,
  violating, and truncated results.
- Because the ontology validation UI is reached through user actions, record,
  extract, and judge its validation-result flow with `browser-qa-loop` and
  `requiredCount: 0` in the implementation PR evidence.

## Risk & sequencing

Land as a Tier 2 singleton after the Tier 1 batches because the foundation
service result crosses the ontology RPC boundary. The migration must be atomic
across the semantic-web capability, SHACL driver, epistemic services, ontology
use cases/client/server/UI, and desktop sidecar tests. Do not change the driver
`ReportShape`, SHACL protocol semantics, `maxResults` behavior, dependencies,
lockfiles, or any generated surface. Run full package verification for every
touched workspace package plus the recorded browser QA flow before
publication.
