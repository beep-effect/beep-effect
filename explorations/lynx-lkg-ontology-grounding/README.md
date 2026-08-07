# Lynx LKG Ontology Grounding

## Status

Stage: `align`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The Lynx project (H2020) published a Legal Knowledge Graph ontology and a
curated list of reference ontologies for legal-domain KGs; only a one-line
citation of it exists in the graduated `legal-ontology-landscape` packet.
Deep-dive the LKG ontology and the reference-ontologies list and decide what
is valuable for beep-effect's semantic/KG work.

## Next Open Question

Which of the five shortlist opportunities
([`research/05-value-assessment.md`](./research/05-value-assessment.md) §5)
advance, and in what order? Recommended leads: #1 attributed multi-claim span
annotation (AnnotationUnit reshaped onto `EvidenceSpan`/`TextAnchorFields`)
and #2 `lkg.ttl` (CC-BY-4.0, 12.7KB) as the first real VETTED vendor slice.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-08-06: research complete — 5-agent opus workflow landed reports 01-05 +
  SOURCES.md (~834k subagent tokens; first launch lost to a session-limit
  reset). Verdict: Lynx is a pattern donor, not a vocabulary donor; zero
  patent/IP modelling anywhere in its corpus. Five-item shortlist ranked in
  `research/05-value-assessment.md` §5. Stage advanced to `align`; five open
  questions queued in the manifest.
- 2026-08-06: packet opened from Benjamin's capture (LKG ontology + reference-ontologies
  links); confirmed Lynx existed only as a one-line source citation in graduated
  `legal-ontology-landscape`; research fan-out launched.
