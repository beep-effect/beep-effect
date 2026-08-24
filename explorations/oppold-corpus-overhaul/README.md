# Oppold Corpus Overhaul

## Status

Stage: `graduate`
Status: `graduated`

Graduated 2026-08-24:
[`goals/oppold-corpus-salvage-restoration`](../../goals/oppold-corpus-salvage-restoration/README.md)
was scaffolded as G1, the only promised-now goal. G2-G4 and
`practice-kg-bundle-v2` remain gated MAP re-entry points; the
`solo-practice-corpus-kit` productization candidate remains deferred. A fired
gate reopens this packet at `decompose`.

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Re-evaluate the oppold-corpus pipeline from scratch so the next expensive
pipeline run produces the best knowledge graph the corpus can support — and
so the pipeline itself becomes a reusable asset for other solo-practice
attorneys. Sparked by the operator's 2026-08-17 roadmap notes and by the
machine-local T7 salvage drive (`oppold-salvage-2026-08-10`), mined from the
practice's old workstation, which post-dates the completed June
[`goals/oppold-corpus-pipeline`](../../goals/oppold-corpus-pipeline/README.md)
run and July
[`goals/oppold-corpus-refresh`](../../goals/oppold-corpus-refresh/README.md)
consolidation and is not yet integrated.

## Next Open Question

None. Re-entry is through the gates in [`MAP.md`](./MAP.md): G2 pipeline v2,
G3 semantic ingestion v2, G4 enrichment v2, practice-kg bundle v2, or the
deferred solo-practice corpus kit. A fired gate resumes at `decompose`.

## Position in the roadmap

Per the operator's ratified gating (2026-08-17): **this packet gates
practice-kg bundle v2, not the live v1 front.** Lane 1's first-user delivery
ships from the current corpus; this overhaul's exit is the declared
prerequisite for the next expensive pipeline run.

## Provenance

- Operator roadmap notes, 2026-08-17 (captured near-verbatim in
  [`CAPTURE.md`](./CAPTURE.md)).
- Binding predecessor:
  [`goals/oppold-corpus-pipeline`](../../goals/oppold-corpus-pipeline/README.md)
  (completed-retained June extract run; its debt ledger is inherited).
- Predecessor: [`goals/oppold-corpus-refresh`](../../goals/oppold-corpus-refresh/README.md)
  (completed-retained; salvage/catalog/dedupe for the July consolidation —
  its own notes say refreshes need a successor).
- Composes with (does not duplicate): `goals/semantic-foundation` M1
  Intake-Serving Semantic Seed, `goals/patent-document-schema`,
  `goals/folio-lynx-taxonomy-browse`.

## Trail

- 2026-08-24 (graduate): G1
  `goals/oppold-corpus-salvage-restoration` scaffolded as the sole
  promised-now goal; packet status flipped to graduated. G2-G4, bundle v2,
  and the deferred productization candidate remain MAP re-entry points.

- 2026-08-24 (decompose): `MAP.md` ratified with G1 promised now and the later
  candidates kept behind named reopen-at-`decompose` gates.

- 2026-08-24 (shape): `BRIEF.md` ratified with a preservation gate this week,
  one approximately three-week transformation wave, and explicit no-gos.

- 2026-08-24 (align): closed the four stop conditions for pipeline scope,
  capability incorporation, immutable-run improvement, and enrichment.

- 2026-08-17 (later): adversarial review round — 4 lanes attacked the bar, 4 the
  vision; census factually corrected (no orphan; three volumes; raw
  `f-recyclebin-*`; collector ledger absorbed); bar v2 re-ratified
  (one-pass copy-while-hashing, honest loss universe, mail-first).

- 2026-08-17: packet created from the operator's roadmap re-eval notes (operator-ratified); born active at capture; first align question is the salvage restoration inventory.
