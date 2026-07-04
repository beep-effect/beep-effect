# Oppold Corpus Refresh

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Consolidate the post-June exports/downloads from the user's data-home boundary
into the existing governed corpus home at `<CORPUS_ROOT>`, append them under a
new run-scoped raw subtree, catalog and dedupe them against prior runs, then
archive-move the verified originals.

This packet is limited to salvage, catalog, dedupe, and archive-move. Extraction,
organization, enrichment, and downstream ingestion are explicitly deferred to a
follow-up packet/run.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/oppold-corpus-refresh/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`history/decision-log.md`](./history/decision-log.md) - 2026-07-03 grilling-session decisions and supersessions.
6. [`history/sources.md`](./history/sources.md) - authority order and redacted source labels.
7. [`research/README.md`](./research/README.md) - placeholder for the redacted data-home inventory posture.

## Current Phase

Closed for this packet's scope. Operational phases P0-P3 are complete:
label-map guardrails, dedupe-aware salvage/tooling, run-union catalog, and
archive move. Extraction, organization, enrichment, and downstream ingestion
remain deferred to a follow-up packet/run per `SPEC.md`.

## Latest Evidence

- [`history/outputs/2026-07-03-p3-archive-move-report.md`](./history/outputs/2026-07-03-p3-archive-move-report.md)
- [`history/outputs/2026-07-03-p2-catalog-report.md`](./history/outputs/2026-07-03-p2-catalog-report.md)
- [`history/outputs/2026-07-03-p1-salvage-report.md`](./history/outputs/2026-07-03-p1-salvage-report.md)
- [`history/reflections/2026-07-03-claude.md`](./history/reflections/2026-07-03-claude.md)

## Notes

- Repo files must never contain corpus content, PII, concrete data-home source
  paths, local usernames, or source filenames. In-scope sources are referenced
  only as `source-a`, `source-b`, `source-c`, and `source-d`.
- This packet deliberately supersedes two retained
  `goals/oppold-corpus-pipeline` assumptions: `raw/` is append-only by run, and
  verified originals are archive-moved after salvage instead of left for manual
  retirement.
- The refresh walked 8,336 records across `source-a` through `source-d`, copied
  12 new artifacts, retained 8,324 provenance-only rows, and archive-moved all
  four source roots after full coverage proof. Nothing was deleted.
