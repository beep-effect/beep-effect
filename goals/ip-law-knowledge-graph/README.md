# IP Law Knowledge Graph

## Status

Pending

- **2026-07-08 supersession:** ontology-survey scope
  (LKIF-Core/IPRonto/ALIS/Copyright-Ontology/JudO/LCBR/ESTRELLA/WIPO-IPC) is
  superseded by [`goals/semantic-foundation`](../semantic-foundation/README.md);
  FalkorDB/Cypher storage is deferred pending
  `explorations/legal-ontology-landscape/research/05-semantic-topology-recommendation.md`,
  with v1 projection doctrine per
  [`goals/legal-document-intake`](../legal-document-intake/README.md) D6
  (Postgres/PGlite).

## Overview

This initiative defines the repository's IP-law knowledge-graph direction,
including ontology grounding, schema shape, storage posture, and verification
expectations.

## Read This First

- [SPEC.md](./SPEC.md) — authoritative initiative contract
- [PLAN.md](./PLAN.md) — current implementation posture
- [ops/manifest.json](./ops/manifest.json) — machine-readable phase routing
- [ops/prompts/](./ops/prompts) and [ops/handoffs/](./ops/handoffs)
- [research/](./research) and [history/](./history)
- [research/ontology-grounding-corpus.md](./research/ontology-grounding-corpus.md)
  — local grounding corpus anchors (FOLIO, IP ontology literature,
  effect-ontology patterns) plus the flagged FalkorDB-vs-projection open
  question P0 must resolve (added 2026-06-11)

## Source material

- [research/SOURCES.md](./research/SOURCES.md) — provenance ledger for the
  gold-intake material folded into this goal: the mined nugget
  (`patents-mcp-server#7`, MIT) → upstream repo + license → external WIPO/EPO/CPC
  standards → in-repo bricks (`@beep/rdf`, `@beep/semantic-web`) it composes.
- **Source exploration dir:** `explorations/_gold-intake/` (cluster "IPC/CPC
  classification SKOS taxonomy seed"; see `ROUTING.md`, `routing.json`,
  `GOLD_SYNTHESIS.md`).

## Notes

- 2026-06-29: gold-intake research note added at research/gold-intake-cpc-ipc-skos-seed.md (see for CPC/IPC classification taxonomy as a SKOS seed for the S7 WIPO-IPC slot); provenance ledger at research/SOURCES.md.
