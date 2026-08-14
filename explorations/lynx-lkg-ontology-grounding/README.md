# Lynx LKG Ontology Grounding

## Status

Stage: `graduate`
Status: `graduated`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The Lynx project (H2020) published a Legal Knowledge Graph ontology and a
curated list of reference ontologies for legal-domain KGs; only a one-line
citation of it exists in the graduated `legal-ontology-landscape` packet.
Deep-dive the LKG ontology and the reference-ontologies list and decide what
is valuable for beep-effect's semantic/KG work.

## Next Open Question

No blocking question. Reopen at `decompose` when semantic-foundation M4 fires
the SHACL candidate or a multilingual consumer supplies its competency
question.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-08-13 (final ceremony): operator signed off `BRIEF.md` and `MAP.md`;
  graduated [`attributed-multi-claim-span`](../../goals/attributed-multi-claim-span/README.md)
  with lexicog CQ authoring included. SHACL and language discipline remain
  gated MAP re-entry points.

- 2026-08-13 (ceremony): drafted `BRIEF.md` and `MAP.md`; span annotation is
  the lead, SHACL remains M4-gated, language discipline is a re-entry, and
  lexicog CQ authoring is included. Stage remains `shape` for operator review.

- 2026-08-13: align closed with all five questions resolved; stage advanced to
  `shape`. Span annotation leads, SHACL waits behind M4, multilingual work is a
  re-entry, `lkg.ttl` routes through document-structure ontologies, ELI is
  reference-only, and lexicog receives a competency question.

- 2026-08-06: research complete — 5-agent opus workflow landed reports 01-05 +
  SOURCES.md (~834k subagent tokens; first launch lost to a session-limit
  reset). Verdict: Lynx is a pattern donor, not a vocabulary donor; zero
  patent/IP modelling anywhere in its corpus. Five-item shortlist ranked in
  `research/05-value-assessment.md` §5. Stage advanced to `align`; five open
  questions queued in the manifest.
- 2026-08-06: packet opened from Benjamin's capture (LKG ontology + reference-ontologies
  links); confirmed Lynx existed only as a one-line source citation in graduated
  `legal-ontology-landscape`; research fan-out launched.
