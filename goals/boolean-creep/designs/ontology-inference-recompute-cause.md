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
  $I.annote("OntologyInferenceResult", {
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

Do not reuse `OntologyInferenceRecomputeMode` at `Session.reasoner.ts:107`: its `reused` member describes a per-module execution choice, while this new domain describes the whole-result cause and needs `drifted`.

```ts
export const OntologyInferenceRecomputeCause = LiteralKit(["incremental", "drifted", "full"]).pipe(
  $I.annoteSchema("OntologyInferenceRecomputeCause", {
    description: "Why an ontology inference pass was incremental or required a full recompute.",
  })
)
export type OntologyInferenceRecomputeCause = typeof OntologyInferenceRecomputeCause.Type

export class OntologyInferenceResult extends S.Class<OntologyInferenceResult>($I`OntologyInferenceResult`)(
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

At the producer, select `drifted` first, then `full` when there is no previous result, otherwise `incremental`. Consumers use `OntologyInferenceRecomputeCause.is.drifted`, `.is.full`, or the local full-recompute derivation; no duplicate literal union or ad-hoc literal guard is introduced.

# Migration inventory

- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:278-287` — update the construction example from the two booleans to `recomputeCause: "full"`.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:295-309` — add `OntologyInferenceRecomputeCause` and replace the two boolean fields with `recomputeCause`.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:724-732` — change `recomputeMode` from a `fullRecompute: boolean` input to the cause literal and derive whether it requires full work with the kit.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:793-795` — replace the two locals with one cause selection: drift takes precedence, absence of `previous` selects `full`, and the remainder is `incremental`.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:799-815` — pass `recomputeCause` to all three `recomputeMode` calls.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:838-847` — write `recomputeCause` into `OntologyInferenceResult.make` and delete both boolean writes.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:868-877` — update the `inferredSessionGraphPartitions` example to construct `recomputeCause: "full"`.
- `packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts:859-868` — update the `buildOntologySnapshotWithInference` example to construct `recomputeCause: "full"`.
- `packages/ontology/use-cases/src/tools/OntologyToolService.ts:268` — replace `result.drifted` with `OntologyInferenceRecomputeCause.is.drifted(result.recomputeCause)` before returning the drift refusal.
- `packages/ontology/ui/src/aggregates/Session/Session.metrics.tsx:48-54` — replace the boolean ternary with a match over `recomputeCause`; preserve `drifted -> "full"` and render the non-drifted causes as `"ok"`, or display the literal directly if product copy is deliberately changed.
- `packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts:171`, `Session.sparql.ts:171`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:864`, and `Session.projections.ts:877-884` — these sites carry the whole schema/result without reading either member; their decoded types update transitively.
- `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts:410-414` — the RPC keeps `OntologyInferenceResult` as its success schema, so the lockstep internal RPC encoding changes from two booleans to `recomputeCause`; no call-site branch changes here.

Whole-repository search found no other source read or write of `OntologyInferenceResult.drifted` or `.fullRecompute`.

# Guard-deletion accounting

- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:793-795` — delete the implication-producing pair `drifted` plus `fullRecompute = noPrevious || drifted`; one exclusive cause is selected.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:724-731` — delete the boolean-first `if (fullRecompute)` interpretation of the flattened pair; the helper receives the cause domain directly.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:838-843` — delete the parallel result writes that could construct the illegal `drifted && !fullRecompute` combination.
- `packages/ontology/ui/src/aggregates/Session/Session.metrics.tsx:51` — delete the boolean ternary that reinterprets `drifted` as the display's full-recompute state.

# Encoded-side impact

none (internal)

The ratified inventory classifies this result as Tier 1/internal, so there is no older-client or persisted-shape compatibility contract. The class is nevertheless the success codec of the internal `RunOntologyInference` RPC at `Session.rpc.ts:410-414`; its JSON changes from `drifted` plus `fullRecompute` to `recomputeCause`. Land server/client consumers together and do not claim byte-shape stability. If P3 reclassifies that RPC as a version-skewed wire boundary, this design must be promoted to Tier 2 and wrapped in an old-keys compatibility transform before apply.

# Test impact

- `packages/ontology/use-cases/test/Session.test.ts:329-333` — replace the initial `.fullRecompute` assertion with `recomputeCause === "full"`.
- `packages/ontology/use-cases/test/Session.test.ts:352-363` — replace the added-result false assertion with `recomputeCause === "incremental"`; retain the per-module `mode === "incremental"` assertion because that is a separate domain.
- `packages/ontology/use-cases/test/Session.test.ts:381-392` — make the same change for the removal pass.
- Add a focused drift-cap/history-rewind assertion for `recomputeCause === "drifted"`; the source search found no existing test that directly asserts the `drifted` member.
- No other test under `packages/**/test/**` or app `test/` directories touches these two members.

# Risk & sequencing

This is Tier 1 and can land independently, but it crosses `@beep/ontology-use-cases`, its internal inference RPC, the ontology tool service, client state, and ontology UI. Update the exported schema, RPC peers, all constructors/examples, and both direct readers atomically. Keep `OntologyInferenceRecomputeMode` unchanged: conflating the result-level cause with the module-level `full | incremental | reused` mode would erase the distinction between a drift-triggered full run and an initially full run.
