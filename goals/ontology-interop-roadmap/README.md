# Ontology Interop Roadmap

## Status

Lifecycle: `completed-retained`

**COMPLETE - v1 package implementation landed; retained as roadmap evidence**

## Owner

@beep-team

## Created / Updated

- **Created:** 2026-06-04
- **Updated:** 2026-06-04

## Purpose

This packet plans the next ontology interop phase after
[`goals/ontology-modeling-foundation`](../ontology-modeling-foundation). It
keeps the implementation target inside the existing foundation modeling
packages:

- `@beep/rdf` owns RDF-safe values, generic vocabularies, and future pure RDF
  syntax utilities.
- `@beep/ontology` owns schema-backed ontology assembly, opt-in SKOS profile
  behavior, projections, Markdown documentation output, JSON Schema sidecars,
  and domain-agnostic provenance hooks.
- `@beep/semantic-web` remains the capability home for runtime validation,
  reasoners, and heavier semantic-web services.

The packet is research-backed and execution-capable. Its v1 scope has now been
implemented in the existing foundation modeling packages, and the packet remains
as launch context for audit, regression, or follow-up work.

## Reading Order

- [SPEC.md](./SPEC.md) - normative roadmap contract
- [PLAN.md](./PLAN.md) - future implementation sequence
- [GOAL.md](./GOAL.md) - compact `/goal` launcher
- [ops/manifest.json](./ops/manifest.json) - machine-readable routing
- [research/roadmap-synthesis.md](./research/roadmap-synthesis.md) - ranked
  recommendations and resolved grill decisions

## Research Index

- [current-surface-gap-analysis.md](./research/current-surface-gap-analysis.md)
- [folio-export-benchmark.md](./research/folio-export-benchmark.md)
- [standards-format-inventory.md](./research/standards-format-inventory.md)
- [skos-profile-research.md](./research/skos-profile-research.md)
- [effect-json-schema-metadata.md](./research/effect-json-schema-metadata.md)
- [oip-workflow-fit.md](./research/oip-workflow-fit.md)
- [roadmap-synthesis.md](./research/roadmap-synthesis.md)

## Current Decisions

- Future v1 work stays in existing packages instead of creating a new package.
- Generic SKOS vocabulary constants belong in `@beep/rdf/Vocab/Skos`.
- Higher-level SKOS concept/scheme/profile behavior belongs in `@beep/ontology`.
- Current SKOS-like constants in `@beep/ontology` are cleanup-on-touch.
- V1 prioritizes opt-in SKOS profile behavior, Markdown docs projection,
  JSON-LD/Turtle enrichment, JSON Schema sidecars, and domain-agnostic
  provenance hooks.
- Markdown projection is Markdown-only inside `@beep/ontology`; HTML pages,
  route suffixes, and FOLIO-style browsers are future app/server work.
- Markdown link rendering supports portable Markdown by default plus an
  explicit Obsidian wikilink mode for vault and RAG workflows.
- Effect JSON Schema output stays as non-RDF sidecar metadata by default.

## Deferred Scope

- RDF/XML and OWL XML projection/import.
- OWL functional syntax and OWL DL profile work.
- TriG and N-Quads until named graph provenance is a concrete requirement.
- Full SHACL validator engines and reasoner integration.
- OBO import/export bridges.
- Legal-specific package content; legal/OIP material in this packet is
  draft research context, not legal advice.

## Validation Targets

```sh
jq . goals/ontology-interop-roadmap/ops/manifest.json
test "$(wc -m < goals/ontology-interop-roadmap/GOAL.md)" -le 4000
rg -n "ontology-interop-roadmap|GOAL.md|agentLaunchers|packetAnchorDocument" goals/ontology-interop-roadmap
git diff --check -- goals/ontology-interop-roadmap
```
