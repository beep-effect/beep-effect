# Practice Mail Backfill

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make decades of historical mail searchable in the attorney's Outlook: one
EOP2 seat, archive + auto-expansion, and the Purview network-upload PST
import executed in reconciled ≤100 GB tranches under `/Historical-PST` —
a documentation-and-operations goal whose deliverables are the runbook,
the operator-attended execution, and the evidence trail.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/practice-mail-backfill/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance, inherited
   from the source exploration.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — CSP/New Commerce quote for the EOP2 seat, dry-run license
assignment beside Business Premium, the >100 GB support case, and a
counts/sizes/nesting census of the source PSTs.

## Latest Evidence

Not started.

## Notes

- Graduated 2026-08-30 from `explorations/practice-office-provisioning`
  (BRIEF solution sketch point 3; an explicit appetite carve-out — the raw
  PSTs need no corpus processing).
- The mechanics authority is
  [`r2-purview-pst-import.md`](../../explorations/practice-office-provisioning/research/r2-purview-pst-import.md),
  including the AzCopy staging/mapping-CSV pairing and the nested-PST
  flat-upload caveat landed through PR review.
- Mapping CSVs, PST inventories, and filenames are client-identifying and
  never enter this public repo — evidence is counts, sizes, hashes, tranche
  ids, and job status.
