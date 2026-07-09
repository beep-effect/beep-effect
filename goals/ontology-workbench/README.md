# Ontology Workbench

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship a fully featured ontology explorer, editor, and visualizer in
`apps/professional-desktop`, delivered as a new `ontology` vertical slice with
files-as-truth Turtle persistence, a typed change-operation edit model,
GPU-scale graph exploration (cosmos.gl), SPARQL querying (Oxigraph), and
bounded domain-native inference.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/ontology-workbench/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (13 locked decisions).
3. [`PLAN.md`](./PLAN.md) - phased execution plan (P0 Bootstrap → P5 Close).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - three research reports + provenance ledger.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Bootstrap — next concrete action: branch from fresh `origin/main`, confirm
the `@beep/rdf` / `@beep/semantic-web` / `@beep/rdf-canonize` surfaces still
match `research/beep-repo-capability-report.md`, then scaffold the slice
(`bun run beep architecture create slice`).

## Latest Evidence

Not started.

## Notes

- Decisions were locked in a `/grill-with-docs` interview on 2026-07-08
  (13 branches; recorded as SPEC constraints). Research was performed by
  Codex agents; reports are verbatim under `research/`.
- Naming: the slice is `ontology` (`@beep/ontology-domain`, …); the existing
  foundation package `@beep/ontology` (FOLIO models,
  `packages/foundation/modeling/ontology`) is a different artifact. P5 adds
  mutual disambiguation notes. This workbench edits **user ontology
  documents**; repo-internal schema-derived ontologies belong to the
  `explorations/identity-as-iri` lineage.
- Prior ontology packets: `goals/ontology-modeling-foundation` (superseded)
  and `goals/ontology-interop-roadmap` (complete) target foundation modeling
  packages, not a product feature — related, not overlapping.
- WebGPU is deliberately NOT a baseline dependency: Tauri on Linux uses
  WebKitGTK where `navigator.gpu` is unreliable. cosmos.gl's WebGL2 GPGPU
  path is the committed approach; sigma.js is the pre-approved fallback.
