# SPAR Document Annotation Wire

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Generate pinned DOCO/DEO/FaBiO/CiTO terms and ship the typed OA/PROV document
annotation wire shape, including the Md-to-DOCO section fold.

## Launch

```text
/goal follow the instructions in goals/spar-document-annotation-wire/GOAL.md
```

## Current Phase

P3 blocked before push: the RDF-to-Md dependency requires generated Fallow boundary
and reviewed cache-policy synchronization outside the lane scope. Package audits,
fixtures, test TSGo, JSDoc, knowledge refs and Fallow pass; full repository docgen
retains an inherited infra SDK failure. See the committed lane handoff.

## Read This First

Read GOAL, SPEC, PLAN, manifest, SOURCES, then the source exploration.
