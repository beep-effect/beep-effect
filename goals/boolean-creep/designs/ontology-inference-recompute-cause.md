# Instance

- id: `ontology-inference-recompute-cause`
- file:line: `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:299`
- symbol: `OntologyInferenceResult`
- members: `drifted`, `fullRecompute`
- evidence classes:
  - E2 — `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:724`: `recomputeMode` already branches the flags into one mode-like value.
  - E4 — `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:799`: `fullRecompute` subsumes `drifted` at every module-mode call; the pair is a flattened recompute-cause state.

# Current shape

Live declaration at `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:295`:

```ts
export class OntologyInferenceResult extends S.Class<OntologyInferenceResult>($I`OntologyInferenceResult`)(
  {
    processedChangeCount: S.Int,
    driftCap: NonNegativeInt,
    drifted: S.Boolean,
    fullRecompute: S.Boolean,
    changedSignatures: S.Array(OntologyInferenceChangedSignature),
    modules: S.Array(OntologyInferenceModuleResult),
    disjointnessViolations: S.Array(OntologyDisjointnessViolation),
    inferredDataset: Dataset,
  },
  $I.annote("OntologyInferenceResultValue", {
    description: "Complete structural inference result for an ontology session.",
  })
) {}
```

# Cardinality gap

Two booleans represent four combinations. Exactly three recompute causes are legal:

- `incremental`: a previous result exists and the drift limit was not exceeded.
- `drifted`: history was rewound or the changed-operation window exceeded `driftCap`; this necessarily performs a full recompute.
- `full`: no previous result exists, so an initial full recompute is required without drift.

`drifted: true, fullRecompute: false` is illegal. The remaining three boolean pairs map one-to-one to the named causes.

# Target schema

Reuse the exported `OntologyInferenceRecomputeCause` owner introduced by the
Tier 1 `ontology-infer-session-recompute-latches` migration. Do not redeclare
the kit in this singleton. Also do not reuse `OntologyInferenceRecomputeMode`
at `Session.reasoner.ts:107`: its `reused` member describes a per-module
execution choice, while the existing cause owner describes the whole-result
cause and includes `drifted`.

```ts
class OntologyInferenceResultValue extends S.Class<OntologyInferenceResultValue>($I`OntologyInferenceResultValue`)(
  {
    processedChangeCount: S.Int,
    driftCap: NonNegativeInt,
    recomputeCause: OntologyInferenceRecomputeCause,
    changedSignatures: S.Array(OntologyInferenceChangedSignature),
    modules: S.Array(OntologyInferenceModuleResult),
    disjointnessViolations: S.Array(OntologyDisjointnessViolation),
    inferredDataset: Dataset,
  },
  $I.annote("OntologyInferenceResult", {
    description: "Complete structural inference result for an ontology session.",
  })
) {}

class OntologyInferenceResultEncoded extends S.Class<OntologyInferenceResultEncoded>(
  $I`OntologyInferenceResultEncoded`
)(
  {
    processedChangeCount: S.Int,
    driftCap: NonNegativeInt,
    drifted: S.Boolean,
    fullRecompute: S.Boolean,
    changedSignatures: S.Array(OntologyInferenceChangedSignature),
    modules: S.Array(OntologyInferenceModuleResult),
    disjointnessViolations: S.Array(OntologyDisjointnessViolation),
    inferredDataset: Dataset,
  }
) {}

export const OntologyInferenceResult = OntologyInferenceResultEncoded.pipe(
  S.decodeTo(OntologyInferenceResultValue, OntologyInferenceResultTransformation),
  $I.annoteSchema("OntologyInferenceResult", {
    description: "Complete structural inference result for an ontology session.",
  })
)
export type OntologyInferenceResult = typeof OntologyInferenceResult.Type

const recomputeMode = (
  cause: OntologyInferenceRecomputeCause,
  affected: boolean,
  previous: O.Option<OntologyInferenceModuleResult>
): OntologyInferenceRecomputeMode => {
  if (!OntologyInferenceRecomputeCause.is.incremental(cause)) return OntologyInferenceRecomputeMode.Enum.full
  if (O.isSome(previous) && !affected) return OntologyInferenceRecomputeMode.Enum.reused
  return OntologyInferenceRecomputeMode.Enum.incremental
}
```

The named transformation has exactly this compatibility table:

| Decoded cause | Encoded `drifted` | Encoded `fullRecompute` |
| --- | --- | --- |
| `incremental` | `false` | `false` |
| `drifted` | `true` | `true` |
| `full` | `false` | `true` |

Decode those three pairs exactly and reject `{ drifted: true,
fullRecompute: false }`. Encoding is the exact inverse, so the drifted cause
retains the live producer invariant `fullRecompute = O.isNone(previous) ||
drifted` and never changes either old wire value. Use the tersest Effect-v4
transformation form accepted by the current `.repos/effect` reference. At the
producer, select `drifted` first, then `full` when there is no previous result,
otherwise `incremental`. Consumers use the cause kit or the local
full-recompute derivation; no duplicate literal union or ad-hoc guard is
introduced.

# Migration inventory

- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:278-287` — update the construction example from `OntologyInferenceResult.make` and the two booleans to `OntologyInferenceResultValue.make({ recomputeCause: "full", ... })`; the exported compatibility codec has no Class `.make` static.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:295-309` — reuse the already-landed `OntologyInferenceRecomputeCause`; retain an encoded old-keys result schema and expose `recomputeCause` only on the decoded result schema. This singleton must not add or rebuild the cause owner.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:724-732` — change `recomputeMode` from a `fullRecompute: boolean` input to the cause literal and derive whether it requires full work with the kit.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:789-795` — the Tier 1 stage already replaced all three local latches with one cause selection: drift takes precedence, absence of `previous` selects `full`, and the remainder is `incremental`.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:799-815` — pass `recomputeCause` to all three `recomputeMode` calls.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:838-847` — construct `OntologyInferenceResultValue.make({ recomputeCause, ... })` and delete both boolean writes. `OntologyInferenceResult` remains the exported compatibility codec and is not treated as a Class constructor.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:868-877` — update the `inferredSessionGraphPartitions` example to construct `OntologyInferenceResultValue.make({ recomputeCause: "full", ... })`, never `OntologyInferenceResult.make`.
- `packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts:859-868` — update the `buildOntologySnapshotWithInference` example to construct `OntologyInferenceResultValue.make({ recomputeCause: "full", ... })`, never the exported codec.
- `packages/ontology/use-cases/src/tools/OntologyToolService.ts:268` — replace `result.drifted` with `OntologyInferenceRecomputeCause.is.drifted(result.recomputeCause)` before returning the drift refusal.
- `packages/ontology/ui/src/aggregates/Session/Session.metrics.tsx:48-54` — replace the boolean ternary with a match over `recomputeCause`; preserve `drifted -> "full"` and render the non-drifted causes as `"ok"`, or display the literal directly if product copy is deliberately changed.
- `packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts:171`, `Session.sparql.ts:171`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:864`, and `Session.projections.ts:877-884` — these sites carry the whole schema/result without reading either member; their decoded types update transitively.
- `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts:410-414` — keep `OntologyInferenceResult` as the RPC success schema and prove its encoded response still contains `drifted` and `fullRecompute`, never `recomputeCause`.
- `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts` — inventory the request schema that nests a prior result under `previous`; decoding exposes the honest cause while encoding preserves the nested old keys.
- HTTP and IPC inference handlers/clients — verify both paths consume the same compatibility codec and migrate decoded TypeScript reads atomically.

Whole-repository search found no other source read or write of `OntologyInferenceResult.drifted` or `.fullRecompute`.

# Guard-deletion accounting

- The Tier 1 predecessor already deleted the implication-producing
  `historyRewound`, `drifted`, and `fullRecompute` locals; this PR deletes only
  their temporary old-result projections at the constructor boundary.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:724-731` — delete the boolean-first `if (fullRecompute)` interpretation of the flattened pair; the helper receives the cause domain directly.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:838-843` — delete the parallel result writes that could construct the illegal `drifted && !fullRecompute` combination.
- `packages/ontology/ui/src/aggregates/Session/Session.metrics.tsx:51` — delete the boolean ternary that reinterprets `drifted` as the display's full-recompute state.

# Encoded-side impact

Tier 2 compatibility codec. The result is both an RPC response and a nested
field of a later inference request. Preserve the exact encoded
`drifted`/`fullRecompute` keys and values in both positions; `recomputeCause`
exists only in the decoded TypeScript model. Current and supported legacy
payloads remain accepted, and no internal cause tag may appear on the wire.

# Test impact

- `packages/ontology/use-cases/test/Session.test.ts:329-333` — replace the initial `.fullRecompute` assertion with `recomputeCause === "full"`.
- `packages/ontology/use-cases/test/Session.test.ts:352-363` — replace the added-result false assertion with `recomputeCause === "incremental"`; retain the per-module `mode === "incremental"` assertion because that is a separate domain.
- `packages/ontology/use-cases/test/Session.test.ts:381-392` — make the same change for the removal pass.
- Add a focused drift-cap/history-rewind assertion for `recomputeCause === "drifted"`; the source search found no existing test that directly asserts the `drifted` member.
- Add a three-row codec table for `incremental`, `drifted`, and `full` proving the exact pairs `false/false`, `true/true`, and `false/true` in both directions; reject `true/false`.
- Add nested-`previous` request round trips and response round trips through both HTTP and IPC transport paths.

# Risk & sequencing

This is Tier 2 and lands as a singleton after the internal batches, including
`ontology-infer-session-recompute-latches`. It crosses
`@beep/ontology-use-cases`, inference RPC request and response paths, the
ontology tool service, client state, and ontology UI. Update decoded consumers
atomically while leaving the encoded contract unchanged. Keep
`OntologyInferenceRecomputeMode` separate: conflating the result cause with the
module-level `full | incremental | reused` mode erases why full work occurred.
