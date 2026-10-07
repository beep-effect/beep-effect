# PLAN — Oppold Corpus Salvage Restoration

Mutable execution plan. `SPEC.md` is normative; this file sequences the work.

## Status

Status: `active`

## Phases

Current phase state:

- **P0 Preservation gate:** tooling is implemented. The approved archive run
  started 2026-08-27 (`restore-preserve`, 400 GB ceiling) and stalled the same
  day at a 90.25 GB `root-archive.zip.partial` when its writer process died;
  the tree payload was never started. Resumed 2026-10-06 (lane E) under
  re-measured denominators after the source changed: see the 2026-10-06
  decision-log entries in `SPEC.md`. **Complete 2026-10-06:** sealed run
  `t7-salvage-2026-08-10:1791318827540:2721` preserved 11,451 objects
  (10,695 files, 755 directories, the verbatim root archive) /
  348,605,703,418 bytes with zero unapproved rows; the fresh-process
  `restore-verify` reported terminals=11451 passes=11451 over the same bytes.
- **P1 Mail vertical slice:** run-bound source-path extraction, child
  reconciliation, attachment repair, sandboxing, hard resource ceilings, and
  synthetic exception lanes are implemented; the live slice follows P0.
- **P2 Transformation wave:** recycle, legacy-Word, and acceptance tooling has
  synthetic occurrence, fidelity, restart, tamper, and acceptance-integrity
  coverage; the single live wave follows the passing slice.
- **P3 Close:** reconcile every ledger, write the reflection, drive the final
  PR to mergeable through Yeet, and flip packet state in that same PR.
- **P4 Provenance index:** normalized per-message header index over every
  pffexport tree, attachment clipped-extension repair with an undo journal,
  and an exiftool metadata census over base files and attachments, shipped as
  `beep corpus provenance` tooling and run on the corpus home. Opened
  2026-10-06 from the salvage coverage audit; runs alongside P1-P2 and
  precedes P3.

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

**Met 2026-10-06** (lane E): 11,451 terminal PASS rows, 0 unapproved,
independent verification 11,451/11,451.

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
   non-PST families an explicit process, quarantine, or defer outcome. The
   store list includes the four containers that had no copy anywhere before
   P0 closed on 2026-10-06 and now live only in
   `raw/t7-salvage-2026-08-10/payload/tree`: the 24,544,478,208-byte PST
   (f-oip-law), the 12,387,542,016-byte PST (a-OppoldIPLaw), and the two OSTs
   (f-outlook-cache, about 1.0 GB together). Their extraction belongs here,
   not to P4.
2. Reconcile all three recycle volumes with the valid-pair, missing-`$R`,
   orphan-`$R`, and duplicate classes. Reconcile directory trees and apply
   the declared path/collision policy.
3. Format-validate and convert distinct legacy-Word digests in a pinned
   sandbox. Retain originals, measure the declared fidelity dimensions, and
   quarantine terminal exceptions.

**Exit:** all three family ledgers reconcile, the wave stays within approved
disk/time ceilings, and no more than one full transformation run occurs.

## P4 — Provenance index

Opened 2026-10-06 from the read-only salvage coverage audit, which found no
normalized header index on disk (only pffexport sidecars), the attachment
extension repair proposed but never applied, and no per-attachment or
document metadata census. Schema → service → implementation order applies
(`internal/ProvenanceIndex.schemas.ts`, `internal/ProvenanceIndex.contracts.ts`).

1. Header index: walk `staging/<tree>/children/*.export`, emit one
   `MailMessageIndexRecord` per item (MAPI headers, RFC 5322 headers where
   `InternetHeaders.txt` exists, recipients, body, attachments, embedded
   items) to `staging/provenance/messages-<tree>.jsonl` with a counts-only
   summary. Both the base and the 2026-07-refresh trees are indexed.
2. Attachment repair: sniff every file directly under `Attachments/` by magic
   bytes (`file --mime-type`/`--extension`), classify against the clipped
   name remnant, write proposals, then `apply` with an append-only rename
   journal and a tested `undo`. Never infer a type from the name alone.
3. Metadata census: `exiftool` (magic-identified, batched) over `raw/`,
   `incoming/`, `organized/`, and every `Attachments/` file; normalized
   fields plus the raw tag set to `staging/provenance/metadata.jsonl`.
4. Hand the summaries to workstream C (pass-3 identification) and the
   practice-kg bundle; record counts only in the packet.

**Exit:** both mail trees indexed with summaries, the repair journal applied
and its undo proven on a synthetic tree, the census complete over the named
roots, and `beep corpus provenance` covered by package tests.

**Progress 2026-10-07:** steps 1-3 ran on the live trees: 118,771 + 122,730
messages indexed (regenerated after the repair so attachment paths are
post-rename), 299,371 attachment extensions repaired from 299,998 scanned
with two undo journals and zero skips,
census 346,062 files (344,908 ok, 1,154 engine errors kept as rows) over the
five named roots. Step 4 is the orchestrator hand-off to workstreams C and D.

## P3 — Close

1. Reconcile preservation plus mail, recycle, DOC, warning, failure, mapping,
   and inherited-loss ledgers. No unapproved terminal row may remain.
2. Record aggregate evidence only: counts, verification results, disk/time
   amplification, and terminal exception classes.
3. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` through `/reflect` and
   pass `bun run beep lint reflection-artifacts`.
4. Run `bun run beep yeet repair`, `verify`,
   `publish --pr --message "<conventional commit>"`, and `monitor` until
   `merge-ready: yes` (a message-less publish is only valid for an
   already-committed clean HEAD or the explicit amend/no-edit retry).
5. Flip every authoritative closeout surface together in the same PR as the
   final work and closeout reflection: `initiative.status` and the top-level
   `lifecycle` in `ops/manifest.json`, the README `Lifecycle:` token, and the
   final phase status — partial flips trip the goals doctor's
   status-consistency findings.

## Current blockers

P0 runs under the 2026-10-06 re-measured denominators (decision log). P1-P2
transformation ceilings (retained output, elapsed time, fidelity) are still
agent-decided per the 2026-10-06 autonomy charter and must be recorded in the
decision log before the live slice. The T7 exFAT volume carries a dirty flag;
an unmounted `fsck.exfat` is an operator decision and is not required for the
read-only archive run.

## Execution notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep all corpus paths, object records, and ledgers outside this public repo.
- If a parent-MAP gate fires, reopen the exploration at `decompose`. Do not
  append G2-G4 or bundle v2 to this packet.
