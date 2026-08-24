# PLAN — Oppold Corpus Salvage Restoration

Mutable execution plan. `SPEC.md` is normative; this file sequences the work.

## Status

Status: `pending`

## Phases

All four phases are pending:

- **P0 Preservation gate:** build the bar-v2 archive tooling this week, seed
  the ledgers, run the archive operation, and independently verify it.
- **P1 Mail vertical slice:** prove one metadata-selected non-stub PST
  occurrence end to end and cover exception lanes with synthetic fixtures.
- **P2 Transformation wave:** restore the full mail estate, reconcile all
  three recycle volumes, and convert distinct legacy-Word digests.
- **P3 Close:** reconcile every ledger, write the reflection, drive the final
  PR to mergeable through Yeet, and flip packet state in that same PR.

## P0 — Preservation gate (this week)

The existing `corpus salvage` command violates bar v2 because it hashes a
whole source in memory before copying and fails closed on an existing
destination. P0 is tool work followed by the archive operation, not a rerun.

1. Define archive-object, content/occurrence, inherited-loss, terminal outcome,
   and verification schemas.
2. Define service contracts for streaming hashing, archive writing,
   truncate-and-resume-by-hash, manifest persistence, and independent
   verification.
3. Implement focused synthetic proofs for large streaming input, interrupted
   attempts, existing partial and complete destinations, mismatches,
   unreadable entries, and crash recovery.
4. Record capacity preflight and an approved ceiling.
5. Copy once while hashing into atomic destinations under
   `raw/t7-salvage-2026-08-10/`. Keep `oppold-corpus.zip` verbatim and
   separate as its own archive object.
6. From a fresh process, reparse the destination manifest and verify every
   terminal row against destination bytes.
7. Extend the out-of-repo `raw/provenance.jsonl` ledger and seed the
   inherited-loss ledger from the ratified aggregate opening classes.
8. Run the bar-v2 fail-closed checks for the recorded absent recycle tree,
   the post-staging E-tree mutation class, and row-by-row source-manifest
   reconciliation.

**Exit:** P0 has zero unapproved terminal rows and an independent PASS. No
transformation result contributes to this gate.

## P1 — Mail vertical slice

1. Select one non-stub PST occurrence from a recycle surface using metadata,
   never a client filename.
2. Run a public source-path libpff process at concurrency one with `-m all`.
3. Persist raw engine output, per-child digests, child counts, warnings,
   failures, and atomic attempt promotion.
4. Repair attachment types from byte signatures and run second-pass
   extraction.
5. Exercise corrupt, password, and codepage lanes with synthetic fixtures.
6. Measure disk/time amplification and compare it with the approved ceiling.

**Exit:** zero unaccounted children and approved amplification. Otherwise stop;
do not expand to the estate.

## P2 — Transformation wave

Run the remaining work in this order:

1. Restore the mail estate store by store. Reconcile every child and assign
   non-PST families an explicit process, quarantine, or defer outcome.
2. Reconcile all three recycle volumes with the valid-pair, missing-`$R`,
   orphan-`$R`, and duplicate classes. Reconcile directory trees and apply
   the declared path/collision policy.
3. Format-validate and convert distinct legacy-Word digests in a pinned
   sandbox. Retain originals, measure the declared fidelity dimensions, and
   quarantine terminal exceptions.

**Exit:** all three family ledgers reconcile, the wave stays within approved
disk/time ceilings, and no more than one full transformation run occurs.

## P3 — Close

1. Reconcile preservation plus mail, recycle, DOC, warning, failure, mapping,
   and inherited-loss ledgers. No unapproved terminal row may remain.
2. Record aggregate evidence only: counts, verification results, disk/time
   amplification, and terminal exception classes.
3. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` through `/reflect` and
   pass `bun run beep lint reflection-artifacts`.
4. Run `bun run beep yeet repair`, `verify`, `publish --pr`, and `monitor`
   until `merge-ready: yes`.
5. Flip the goal lifecycle and final phase status in the same PR as the final
   work and closeout reflection.

## Current blockers

None. P0 starts with the missing schema and tooling work.

## Execution notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep all corpus paths, object records, and ledgers outside this public repo.
- If a parent-MAP gate fires, reopen the exploration at `decompose`. Do not
  append G2-G4 or bundle v2 to this packet.
