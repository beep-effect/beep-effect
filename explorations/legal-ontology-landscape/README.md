# Legal Ontology Landscape

## Status

Stage: `graduate`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Ground the repo's legal semantics in reusable ontology and taxonomy
capabilities without coupling intake, IP-law graph work, or future trademark
docketing to a premature graph store or domain-entity model.

## Next Open Question

None — research phases P0-P4 plus the verification pass are complete and
synthesized in [`RESEARCH.md`](./RESEARCH.md). Next action lives in the goal
packet: implement
[`goals/semantic-foundation`](../../goals/semantic-foundation/README.md) M1.
Open loose ends tracked there: SALI LMSS license conflict before any
ingestion; P4 gate conditions before SPARQL/SHACL upgrades.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state.
2. `CAPTURE.md` - origin dump, expected from the source exploration.
3. `research/01-direction-grounding.md` - P0 grounding and competency
   questions when present.
4. [`DECISIONS.md`](./DECISIONS.md) - locked 2026-07-08 decisions.
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch.
6. [`MAP.md`](./MAP.md) - decomposition and capability check.
7. `assets/README.md` - asset-pack rules when present.

## Trail

- 2026-07-14: absorbed the paused `ip-law-knowledge-graph` P0 survey as the
  compact research note
  [`07-ip-law-ontology-survey-distillation.md`](./research/07-ip-law-ontology-survey-distillation.md);
  the full survey remains a repository-history lookup, not a copied corpus.
- 2026-07-08 (later): P1-P4 reports + verification landed (16 manifest rows,
  9 fully verified; LKIF namespaces found dead, SALI license conflict flagged);
  synthesis written to `RESEARCH.md`; recovered full packet from a yeet
  staged-only stash sweep during a parallel legal-document-intake run.
- 2026-07-08: graduated the first goal packet,
  [`goals/semantic-foundation`](../../goals/semantic-foundation/README.md),
  for M1 intake-serving semantic seed and registry work. Status remains
  `active` at stage `graduate` because P1-P4 research reports still need to
  land and feed M2-M4.
