# Oppold Corpus Pipeline

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Salvage, consolidate, dedupe, name-restore, extract, organize, and
USPTO-enrich the scattered 25-year Oppold IP practice corpus into a single
governed home (machine-local, outside the repo) with a DuckDB
catalog and `@beep/file-processing` manifests, so the runtime ingestion lane
and the IP-law knowledge graph have a clean, provenance-tracked substrate to
consume.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/oppold-corpus-pipeline/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/corpus-scan-inventory.md`](./research/corpus-scan-inventory.md) - the 2026-06-11 workstation scan: source locations, formats, risks, repo capability.
6. [`history/`](./history/) - decision log and source inventory.

## Current Phase

Closed (completed-retained, 2026-06-11). All six phases executed: salvage
(8,438 files, 31.7 GB, zero errors), DuckDB catalog (7,330 distinct digests,
290 duplicate sets), real extraction via hardened libpff/tika drivers
(7,045/7,330 succeeded; 663,272 PST message artifacts; 6,702 text
artifacts), the `organized/` taxonomy (643 docket files across 105 docket
families, 242 restored names), and USPTO enrichment (99 resolved
identifiers, 99 docket-family anchors). Closeout reflection:
[`history/reflections/2026-06-11-claude.md`](./history/reflections/2026-06-11-claude.md).

## Latest Evidence

- [`history/outputs/2026-06-11-p4-enrichment-report.md`](./history/outputs/2026-06-11-p4-enrichment-report.md)
- [`history/outputs/2026-06-11-p3-organize-report.md`](./history/outputs/2026-06-11-p3-organize-report.md)
- [`history/outputs/2026-06-11-p2-extraction-report.md`](./history/outputs/2026-06-11-p2-extraction-report.md)
- [`history/outputs/2026-06-11-p1-catalog-report.md`](./history/outputs/2026-06-11-p1-catalog-report.md)
- [`history/outputs/2026-06-11-p0-salvage-report.md`](./history/outputs/2026-06-11-p0-salvage-report.md)
- [`research/corpus-scan-inventory.md`](./research/corpus-scan-inventory.md)
  (2026-06-11 scan).

## Related Packets

- `goals/agentic-professional-runtime` — this corpus feeds its NEXT roadmap
  lane (corpus ingestion → epistemic claims); the runtime packet owns
  epistemic ingestion, not this one.
- `goals/ip-law-knowledge-graph` — consumes the organized corpus; its
  ontology grounding research now includes the corpus-adjacent sources (see
  its `research/ontology-grounding-corpus.md`).
- `goals/agentic-cad-patent-tooling` — the Precision Planting CAD package
  directory is its active workspace; this packet catalogs a copy and leaves
  the original in place.

## Notes

- The largest source (26 PSTs, 26 GB) lives on the `ESD-USB` stick — treat
  salvage as urgent; avoid unnecessary reads of that media before P0.
- `LH_Inbox_2009` and `LH_Sent_2015` are absent from the USB year series;
  the recycle-bin-recovered PSTs (`$RE5ARTA/Sent_Emails.pst`,
  `Oppold_IP_Law/$R0SFKGS.pst`) are the leading candidates — confirm in P1.
- Real corpus data never enters this repository (runtime SPEC rule); packet
  evidence is manifests, reports, and counts only.
