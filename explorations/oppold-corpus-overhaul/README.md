# Oppold Corpus Overhaul

## Status

Stage: `align` · Status: `active`

Restoration bar **v2** ratified 2026-08-17 after an 8-lane adversarial review
(grok + codex) invalidated the first census — see
[`DECISIONS.md`](./DECISIONS.md) and
[`research/2026-08-17-adversarial/`](./research/2026-08-17-adversarial/).
Next gate: bound the remaining capture bullets, then the BRIEF.

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Re-evaluate the oppold-corpus pipeline from scratch so the next expensive
pipeline run produces the best knowledge graph the corpus can support — and
so the pipeline itself becomes a reusable asset for other solo-practice
attorneys. Sparked by the operator's 2026-08-17 roadmap notes and by the
machine-local T7 salvage drive (`oppold-salvage-2026-08-10`), mined from the
practice's old workstation, which post-dates the completed
[`goals/oppold-corpus-refresh`](../../goals/oppold-corpus-refresh/README.md)
consolidation and is not yet integrated.

## Next Open Question

Salvage restoration and data-loss proof first: the salvage lives on a
removable drive, recycle-bin content needs `$R`/`$I` re-pairing to recover
original names and paths, and libpff-exported mail attachments (`.p`, `.d`,
…) need repair to their true types — what is the restoration inventory and
the no-loss acceptance bar?

## Position in the roadmap

Per the operator's ratified gating (2026-08-17): **this packet gates
practice-kg bundle v2, not the live v1 front.** Lane 1's first-user delivery
ships from the current corpus; this overhaul's exit is the declared
prerequisite for the next expensive pipeline run.

## Provenance

- Operator roadmap notes, 2026-08-17 (captured near-verbatim in
  [`CAPTURE.md`](./CAPTURE.md)).
- Predecessor: [`goals/oppold-corpus-refresh`](../../goals/oppold-corpus-refresh/README.md)
  (completed-retained; salvage/catalog/dedupe for the July consolidation —
  its own notes say refreshes need a successor).
- Composes with (does not duplicate): `goals/semantic-foundation` M1
  Intake-Serving Semantic Seed, `goals/patent-document-schema`,
  `goals/folio-lynx-taxonomy-browse`.

## Trail

- 2026-08-17 (later): adversarial review round — 4 lanes attacked the bar, 4 the
  vision; census factually corrected (no orphan; three volumes; raw
  `f-recyclebin-*`; collector ledger absorbed); bar v2 re-ratified
  (one-pass copy-while-hashing, honest loss universe, mail-first).

- 2026-08-17: packet created from the operator's roadmap re-eval notes (operator-ratified); born active at capture; first align question is the salvage restoration inventory.
