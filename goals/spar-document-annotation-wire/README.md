# SPAR Document Annotation Wire

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Generate pinned DOCO/DEO/FaBiO/CiTO terms and ship the typed OA/PROV document
annotation wire shape, including the Md-to-DOCO section fold.

## Launch

```text
/goal follow the instructions in goals/spar-document-annotation-wire/GOAL.md
```

## Current Phase

P4 complete in PR [#1588](https://github.com/beep-effect/beep-effect/pull/1588).
Pinned generation, focused codec/fold fixtures, identity/RDF/CLI package
verification and hosted-parity commands pass. Prepared-SDK full docgen passes.
The reflection and lifecycle closeout travel in the same PR; hosted readiness
and merge remain with the orchestrator under S11. See the lane handoff.

## Read This First

Read GOAL, SPEC, PLAN, manifest, SOURCES, then the source exploration.
