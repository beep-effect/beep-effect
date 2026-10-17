# Repository simplification residue

Lifecycle: `active`

Source: [ops/manifest.json](./ops/manifest.json).

This is the S36 executable successor to
[repository-simplification-confidence](../repository-simplification-confidence/README.md),
closed by #1884. It owns fifteen unmet source outcomes; the eighteen externally
gated follow-ups remain cross-references. All fifteen implementation acceptances
are still outstanding at packet opening.

Read [SPEC.md](./SPEC.md) for the per-issue contract and standing rulings,
[PLAN.md](./PLAN.md) for lanes, admission and waves, and
[research/SOURCES.md](./research/SOURCES.md) for provenance and external references.
[GOAL.md](./GOAL.md) is the compact launcher.

```text
/goal follow the instructions in goals/repository-simplification-residue/GOAL.md
```

P0 Research and admission is in progress. Wave 1 is the A/catalog retirement
train (#1851/#1860) plus detector repairs (#1855), starting with F-S31-EV010.
#1860 is complete: the third A-train PR landed the catalog removals and the
`beep quality catalog-usage` detector
([record](./history/receipts/catalog-removals-record.md)).
#1861 must land before 2026-10-30. The repository-wide six-open-PR cap usually
permits one or two residue lanes. S23 forbids parking for size and S31 forbids
added debt/exception/baseline rows.

Opening provenance is in
[the bootstrap receipt](./history/receipts/bootstrap-materialization.json).
The worker's proof and publication state are in
[the opening handoff](./history/handoffs/rsc-residue-packet-2026-10-17.md).
