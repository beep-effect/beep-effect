---
title: "P5: L6-2 instances are partial lenses with a fixed complement and effectful get and put; PutGet is tested on perturbed and foreign candidates; ProvBundle compares records as a set"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Restate L6-2 over total pure lenses by removing the minted subject from the projection, by a decision file before the projection commit lands"
---

Independent review of the P5 design, findings on L6-2. Refines decision `2026-11-23-p5-source-text-identity-projects-to-prov-entity-under-its-capture-id`.

The first statement of PutGet, "for every v in the image of get", was false for `SourceTextEntity`: `put(o(s))` refuses `get(s')` when `s'` differs from `s` only in the omitted `scopeRef`, because the subject is the instance IRI of `mintCaptureId(s')` and `scopeRef` is element 1 of the `capture/v1` preimage (`packages/foundation/modeling/text/src/Capture.ts:87-99`, `:140-156`). Restricted to `get(s)`, PutGet followed from GetPut and could not fail. Both directions also need `Digest` and can fail (`mintCaptureId`, `Capture.ts:184-190`; `provBundleToDataset` returns a `Result`, `rdf/src/ProvRdf.ts:569-573`), and Effect 4.1.5 has no `Either` module.

1. L6-2 is stated for partial lenses with a fixed complement. GetPut: `put(o(s))(get(s))` succeeds with `s'` and `s' ~ s` under the instance's declared quotient. PutGet: if `put(o(s))(v)` succeeds with `s'`, then `get(s')` is `Equal` to `v`.
2. Candidates `v` come from `get(s)`, `get(t)` for independent `t` (other scopes included), and perturbations of `get(s)`: an extra quad about the subject, a dropped kept quad, a duplicated kept predicate. The harness asserts the `get(s)` pool is always accepted.
3. `SourceTextEntity.fromDataset` refuses unknown quads about the subject (`unknownQuad`) and repeated kept predicates (`duplicateField`); PutGet fails otherwise. Row 5 measures whether `datasetToProvBundle` accepts a perturbation and, if so, makes it refuse in the same commit.
4. `SourceTextEntity.toDataset` and `fromDataset` are `Effect.fn` with `Digest.Digest` in R and `SourceTextEntityRefused | PreimageMintError | ProvRdfCodecError` in E. Pure helpers return `effect/Result`. The harness `rdf/test/support/lensLaws.ts` takes effectful `get` and `put` and runs under `it.effect` with `Digest.layerWebCrypto`.
5. The `ProvBundle <-> Dataset` instance declares record order and record multiplicity omitted and compares bundles with records as a set. `ProvBundle.records` is an ordered array (`rdf/src/Prov.ts:1091`) and `datasetToProvBundle` rebuilds it in quad iteration order (`ProvRdf.ts:969-980`), which is hash order once `Dataset.quads` is a set. The generator draws distinct record ids. Production behaviour of the codec does not change for this.
