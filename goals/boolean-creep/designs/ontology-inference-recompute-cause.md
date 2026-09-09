# Instance

- id: `ontology-inference-recompute-cause`
- file:line: `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:299`
- symbol: `OntologyInferenceResult`
- members: `drifted`, `fullRecompute`
- evidence classes:
  - E4 — `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:814-815`: the producer first derives `drifted`, then defines `fullRecompute = O.isNone(previous) || drifted`, proving `drifted => fullRecompute`. The pair is a flattened recompute-cause state.

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

Reuse the exported `OntologyInferenceRecomputeCause` owner introduced by the
Tier 1 `ontology-infer-session-recompute-latches` migration. Do not redeclare
the kit in this singleton. Also do not reuse `OntologyInferenceRecomputeMode`
at `Session.reasoner.ts:107`: its `reused` member describes a per-module
execution choice, while the existing cause owner describes the whole-result
cause and includes `drifted`.

```ts
export class OntologyInferenceResultValue extends S.Class<OntologyInferenceResultValue>($I`OntologyInferenceResultValue`)(
  {
    processedChangeCount: S.Int,
    driftCap: S.toType(NonNegativeInt),
    recomputeCause: OntologyInferenceRecomputeCause,
    changedSignatures: S.Array(S.toType(OntologyInferenceChangedSignature)),
    modules: S.Array(S.toType(OntologyInferenceModuleResult)),
    disjointnessViolations: S.Array(S.toType(OntologyDisjointnessViolation)),
    inferredDataset: S.toType(Dataset),
  },
  $I.annote("OntologyInferenceResultValue", {
    description: "Complete structural inference result for an ontology session.",
  })
) {}

export class OntologyInferenceResultEncoded extends S.Class<OntologyInferenceResultEncoded>(
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
  },
  $I.annote("OntologyInferenceResultEncoded", {
    description: "Legacy encoded structural inference result with exact recompute flags.",
  })
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

The decoded Class uses `S.toType` for all nested payloads so already-decoded
values do not pass through an encoded-side transformation twice. Export both
Classes through the existing Session barrel: `OntologyInferenceResultValue` is
the supported decoded constructor used by cross-module examples;
`OntologyInferenceResultEncoded` is the old-shape reference for compatibility
proof. Retain identifier/annotation metadata and annotate the encoded Class
with a distinct `$I` identity; do not expose a fictitious `.make` on the codec.

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

Refreshed against source SHA `93217d998f851e2e93d9864e2b5315552eaa58a7` and
`origin/main@d1b4d769fbaffddd55717f3b1ba461897dd545c5` on 2026-09-09.
These remain planned P2 stages; neither predecessor nor codec is implemented
at this source pin. The closure-helper extraction shifts downstream reasoner
citations by 21 lines; snapshot accumulator extraction shifts the projection
example by 30 lines without changing this carrier.

- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:278-287` — update the construction example from `OntologyInferenceResult.make` and the two booleans to `OntologyInferenceResultValue.make({ recomputeCause: "full", ... })`; the exported compatibility codec has no Class `.make` static.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:295-309` — reuse the cause owner after its Tier 1 predecessor lands; retain an encoded old-keys result schema and expose `recomputeCause` only on the decoded result schema. This singleton must not add or rebuild the cause owner.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:745-753` — the Tier 1 predecessor changes `recomputeMode` from its `fullRecompute: boolean` input to the cause literal. This Tier 2 stage retains that helper and all affected/module arguments. This helper consumes only the implication's consequent today; it is not evidence that the result's two booleans are exhaustively branched together.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:810-816` — after the Tier 1 stage replaces all three local latches, preserve its one cause selection: drift takes precedence, absence of `previous` selects `full`, and the remainder is `incremental`.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:820-836` — retain the predecessor’s `recomputeCause` argument at all three `recomputeMode` calls.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:859-868` — construct `OntologyInferenceResultValue.make({ recomputeCause, ... })` and delete both boolean writes. `OntologyInferenceResult` remains the exported compatibility codec and is not treated as a Class constructor.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:889-898` — update the `inferredSessionGraphPartitions` example to construct `OntologyInferenceResultValue.make({ recomputeCause: "full", ... })`, never `OntologyInferenceResult.make`.
- `packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts:889-898` — update the `buildOntologySnapshotWithInference` example to construct `OntologyInferenceResultValue.make({ recomputeCause: "full", ... })`, never the exported codec.
- `packages/ontology/use-cases/src/tools/OntologyToolService.ts:270` — replace `result.drifted` with `OntologyInferenceRecomputeCause.is.drifted(result.recomputeCause)` before returning the drift refusal.
- `packages/ontology/ui/src/aggregates/Session/Session.metrics.tsx:48-54` — replace the boolean ternary with a match over `recomputeCause`; preserve `drifted -> "full"` and render the non-drifted causes as `"ok"`, with exactly the existing display strings.
- `packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts:171`, `Session.sparql.ts:171`, `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:913`, and `Session.projections.ts:906-914` — these sites carry the whole schema/result without reading either member; their decoded types update transitively.
- `packages/ontology/use-cases/src/aggregates/Session/Session.rpc.ts:410-414` — keep `OntologyInferenceResult` as the RPC success schema and prove its encoded response still contains `drifted` and `fullRecompute`, never `recomputeCause`.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:337-345` — `InferOntologySessionInput.previous` uses `S.OptionFromOptionalKey(OntologyInferenceResult)` with the None default, and `driftCap` keeps its constructor default of 64. Preserve absent/None and complete Some(result), all integer/cap values, and the unchanged session payload. `Session.rpc.ts:410-414` uses that request schema directly. The SPARQL and validation input schemas at their respective line 171 also nest an optional result, so preserve the old keys there too.
- `apps/professional-desktop/src/ontology/OntologyOrchestrator.ts:138,175-188,208` forwards the typed reasoner operation through `OntologyRpcs`. `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:89,105,121-124` selects the shared HTTP/IPC protocol; `apps/professional-desktop/src/App.tsx:241-243`, `transport/IpcChatClient.ts:32-33`, and `transport/DesktopHttpProtocol.ts:39` select and serialize the transports. Verify both consume the same result/request compatibility codec; no custom protocol shape is introduced.
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1007-1033` reads the previous result, constructs `InferOntologySessionInput`, calls the RPC, and stores the result. Keep this whole-value flow and the snapshot reader at 1508-1510.
- `packages/ontology/use-cases/src/aggregates/Session/index.ts:42,49` already exports reasoner/RPC symbols; use these existing barrels and package exports for the new constructor/reference schema, without a new public-barrel topology.

Whole-repository search found no other source read or write of `OntologyInferenceResult.drifted` or `.fullRecompute`.

# Guard-deletion accounting

- The planned Tier 1 predecessor deletes the implication-producing
  `historyRewound`, `drifted`, and `fullRecompute` locals; this PR deletes only
  their temporary old-result projections at the constructor boundary.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:745-752` — the predecessor owns deletion of `if (fullRecompute)` and the Boolean parameter. Count zero additional guard deletions here in Tier 2; retain its cause dispatch.
- `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:859-864` — delete the parallel result writes that could construct the illegal `drifted && !fullRecompute` combination.
- `packages/ontology/ui/src/aggregates/Session/Session.metrics.tsx:51` — delete the boolean ternary that reinterprets `drifted` as the display's full-recompute state.

# Encoded-side impact

Tier 2 compatibility codec. The result is both an RPC response and a nested
field of a later inference request. Preserve the exact encoded
`drifted`/`fullRecompute` keys and values in both positions; `recomputeCause`
exists only in the decoded TypeScript model. Preserve all processed-change
counts, drift caps, signature roles/values, module names/modes/quads, violations,
and the complete inferred Dataset; do not replace payloads by presence flags.
Compare `encodeNew(decodeNew(input))` to the exported old-shape codec for all
three legitimate pairs with nonempty payloads, and preserve optional-key
omission/defaults in every enclosing request. Current and supported legacy
payloads remain accepted, and no internal cause tag may appear on the wire.

# Test impact

- `packages/ontology/use-cases/test/Session.test.ts:332-336` — replace the initial `.fullRecompute` assertion with `recomputeCause === "full"`.
- `packages/ontology/use-cases/test/Session.test.ts:355-366` — replace the added-result false assertion with `recomputeCause === "incremental"`; retain the per-module `mode === "incremental"` assertion because that is a separate domain.
- `packages/ontology/use-cases/test/Session.test.ts:384-395` — make the same change for the removal pass.
- Add a focused drift-cap/history-rewind assertion for `recomputeCause === "drifted"`; the source search found no existing test that directly asserts the `drifted` member.
- Add a three-row codec table for `incremental`, `drifted`, and `full` proving the exact pairs `false/false`, `true/true`, and `false/true` in both directions; reject `true/false`.
- Add nested-`previous`, validation-`inference`, and SPARQL-`inference` round trips (None/omitted and Some) and response round trips through HTTP and IPC. Use nonempty signature/module/violation/dataset fixtures and compare old/new encoded outputs, rather than only checking the two flags.
- The rejected `true/false` pair was admitted by the old permissive schema but has no supported producer or legitimate cause; record this intentional invalid-state rejection separately from byte-compatible legitimate input proof.
- Run the focused reasoner/RPC tests and required package verification for every migrated package at implementation. No package tests or browser execution were run for this P2 refresh.

# Risk

This is Tier 2 and lands as a singleton after the internal batches, including
`ontology-infer-session-recompute-latches`. It crosses
`@beep/ontology-use-cases`, inference RPC request and response paths, the
ontology tool service, client state, and ontology UI. Update decoded consumers
atomically while leaving the encoded contract unchanged. Keep
`OntologyInferenceRecomputeMode` separate: conflating the result cause with the
module-level `full | incremental | reused` mode erases why full work occurred.
