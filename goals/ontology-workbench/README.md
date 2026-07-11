# Ontology Workbench

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship a fully featured ontology explorer, editor, and visualizer in
`apps/professional-desktop`, delivered as a new `ontology` vertical slice with
files-as-truth Turtle persistence, a typed change-operation edit model,
GPU-scale graph exploration (cosmos.gl), SPARQL querying (Oxigraph), bounded
domain-native inference, and a SHACL validation lane with verified repairs.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/ontology-workbench/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (18 locked constraints).
3. [`PLAN.md`](./PLAN.md) - phased execution plan (P0 Bootstrap → P6 Close).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - five research reports + provenance ledger.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

Closed. P0-P6 landed as PRs #351/#354/#355/#357/#358/#359 plus the P6 close
branch, all hosted checks green. Host acceptance proofs (browser author-edit-save
loop, webkitgtk 100k folds at 60 FPS, SPARQL + inferred view, SHACL
violation → verified repair → undo, PROV-O/VoID exports) are recorded per phase
in `history/`. Competency tasks t2/t3 are a regression-guarded deferral (full
OWL 2 DL reasoning is out of scope per `GOAL.md`); ROBOT validation commands
are recorded as environment-gated. Closeout reflection:
[`history/reflections/2026-07-09-claude.md`](./history/reflections/2026-07-09-claude.md).

## Latest Evidence

- P0 Bootstrap evidence:
  [`history/2026-07-08-p0-bootstrap.md`](./history/2026-07-08-p0-bootstrap.md)
  - live package surfaces confirmed, no decision-invalidating drift recorded,
  and P1 risks listed.
- P1 Foundation evidence:
  [`history/2026-07-09-p1-foundation.md`](./history/2026-07-09-p1-foundation.md)
  - ontology slice + N3 driver implemented; package `check`/`lint` passed;
  FOAF + ontoauthor Turtle fixtures round-tripped by `rdfc-1.0` fingerprint.
- P2 Explorer + Editor evidence:
  [`history/2026-07-09-p2-explorer-editor.md`](./history/2026-07-09-p2-explorer-editor.md)
  - ontology client/ui packages, sidecar RPCs, app navigation, real batch
  deltas, shared ABox/TBox classification, pizza tutorial typed operation
  flow, live app proof observations, change-log panel, tooltip button fix, and
  prefix-preserving Turtle save behavior recorded.
- P3 Visualizer evidence:
  [`history/2026-07-09-p3-visualizer.md`](./history/2026-07-09-p3-visualizer.md)
  - cosmos worker projection, incremental graph deltas, L0-L3 folds, workbench
  viewport integration, halo gesture change-op wiring, worker-backed folded
  spike contract, local proof results, and host webkitgtk re-proof commands
  recorded.
- P4 SPARQL + Reasoning evidence:
  [`history/2026-07-09-p4-sparql-reasoning.md`](./history/2026-07-09-p4-sparql-reasoning.md)
  - Oxigraph driver, structural inference, SPARQL runner, inferred graph
  projection, query/result UI, desktop RPC wiring, full local gate sweep,
  node-backed Vitest proof, and host-side follow-up commands recorded.
- P5 Validation + Provenance evidence:
  [`history/2026-07-09-p5-validation-provenance.md`](./history/2026-07-09-p5-validation-provenance.md)
  - SHACL driver, asserted-plus-inferred validation runner, verified repair
  proposals, focus-node validation UI, real metrics wiring, PROV-O journal
  export, VoID/DCAT dataset export, local proof results, and host-side follow-up
  commands recorded.
- P6 Harden + Close evidence:
  [`history/2026-07-09-p6-harden-close.md`](./history/2026-07-09-p6-harden-close.md)
  - Turtle interop suite with a real PROV-O subset fixture, ontoauthor-mat
  t1-t6 competency status suite, node-side projection benchmark, docs touched,
  SPEC checklist verdicts, host-side ROBOT/GUI/reflection commands, and
  unresolved DL competency gaps recorded.

## Notes

- Decisions were locked in a `/grill-with-docs` interview on 2026-07-08
  (13 branches; recorded as SPEC constraints). Research was performed by
  Codex agents; reports are verbatim under `research/`.
- A same-day round-2 interview (9 branches) folded in the ontosphere
  reference repo (Apache-2.0, ISWC 2026): SHACL + verified repairs, session
  graph partitions, typed worker protocol, ABox/TBox view modes, fold
  levels/clustering, agent-ready ops, PROV-O + VoID/DCAT exports, and the
  ontoauthor-mat fixtures — recorded as SPEC Constraints 13–18; phases became
  P0–P6. The agent/MCP tool surface is deliberately deferred to a named
  follow-up packet (`ontology-agent-tools`).
- Naming: the slice is `ontology` (`@beep/ontology-domain`, ...); the existing
  foundation package `@beep/ontology` (FOLIO models,
  `packages/foundation/modeling/ontology`) is a different artifact. P6 adds
  mutual disambiguation notes. This workbench edits **user ontology
  documents**; repo-internal schema-derived ontologies belong to the
  `explorations/identity-as-iri` lineage.
- Prior ontology packets: `goals/ontology-modeling-foundation` (superseded)
  and `goals/ontology-interop-roadmap` (complete) target foundation modeling
  packages, not a product feature — related, not overlapping.
- WebGPU is deliberately NOT a baseline dependency: Tauri on Linux uses
  WebKitGTK where `navigator.gpu` is unreliable. cosmos.gl's WebGL2 GPGPU
  path is the committed approach; sigma.js is the pre-approved fallback.
