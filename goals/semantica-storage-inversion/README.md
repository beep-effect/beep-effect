# Semantica Storage Inversion

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Spike the storage semantics D16 needs before it can bind: `Invalidated`
retraction with derived reach, `Redacted` document erasure with a
ledger-computed closure and an atomic purge protocol, `Compacted` trust-root
snapshots and checkpoint continuity in chain order — proven by probes P-S0..3
on the offline-regenerated C2 ledger as one S1 candidate.

Graduated 2026-09-03 from
[`explorations/semantica-lab`](../../explorations/semantica-lab/README.md)
(MAP v1.1 re-entry packet S, ratified 2026-09-03 as R1 with amendments
R0.a and R1.a–R1.i).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/semantica-storage-inversion/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read this first

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative scope, constraints, acceptance, and
   stop conditions; every section back-links the exploration instead of
   restating it.
3. [`PLAN.md`](./PLAN.md) - P0-P4 execution plan (P-S0 entry check, P-S1
   retraction, P-S2 compaction + erasure, P-S3 desktop storage, close).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - goal-side mirror of the
   exploration's provenance ledger.
6. Exploration contracts in force:
   [`MAP.md` §S](../../explorations/semantica-lab/MAP.md#s-semantica-storage-inversion--what-delete-and-compaction-must-mean)
   v1.1,
   [`DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md) (Current
   law table + the 2026-09-03 ratification grill),
   [`BRIEF.md`](../../explorations/semantica-lab/BRIEF.md) v1.1,
   [`research/shared-schema.md`](../../explorations/semantica-lab/research/shared-schema.md)
   v1.4.
7. [`goals/semantica-canary/SPEC.md`](../semantica-canary/SPEC.md) - the
   lab's standing constraints and the C2 evidence this spike replays.
8. [`history/`](./history/) - probe evidence and the closeout reflection.

## Current phase

P0 P-S0 entry check — not started. First action: confirm the workstation
provider cache is present, regenerate the full-W1 C2 ledger with the lab's
`canary` entry at C2 `--offline`, and compare the report digest with
[`goals/semantica-canary/history/c2/`](../semantica-canary/history/c2/).
No reproduction means the spike does not start.

## Latest evidence

Not started.

## Notes

- **Sequencing.** Runs after the `semantica-atlas-sync` verdict lane (docs
  only, no dependency) and before the reasoning spike's R-c class and P2–P4,
  which inherit this packet's tombstone law (R1.g).
- **Budget.** P-S0..3 are one stage of one S1 candidate; a failed probe buys
  exactly one redesigned candidate for that probe (R0.a); a second failure
  parks the storage family and drops the exploration to `decompose`.
- **Named risks (unverified on 2026-09-03).** PGlite `VACUUM FULL` reclaim
  under Bun/NodeFS; the redesigned P-S3 candidate is copy-to-fresh-`dataDir`
  compaction.
- **Never committed.** The regenerated ledger and the provider cache (about
  152 MB, untracked) stay on the workstation.
