# Ontology Workbench

## Status

Lifecycle: `active`

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

P1 Foundation - implementation complete in the branch; host verification is
pending for `bun install` and package-local Vitest lanes because the sandbox
blocked network package resolution and Bun/Vitest workers failed before test
import.

## Latest Evidence

- P0 Bootstrap evidence:
  [`history/2026-07-08-p0-bootstrap.md`](./history/2026-07-08-p0-bootstrap.md)
  - live package surfaces confirmed, no decision-invalidating drift recorded,
  and P1 risks listed.
- P1 Foundation evidence:
  [`history/2026-07-09-p1-foundation.md`](./history/2026-07-09-p1-foundation.md)
  - ontology slice + N3 driver implemented; package `check`/`lint` passed;
  FOAF + ontoauthor Turtle fixtures round-tripped by `rdfc-1.0` fingerprint.

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
