# Oppold Corpus Salvage Restoration

Lifecycle: `active`

This packet closes two separate gates. P0 preserves and independently verifies
the current T7 salvage state. The transformation wave then restores mail,
reconciles all three recycle volumes, and converts distinct legacy-Word
digests while retaining the originals.

## Next action

P1 complete; P2 ceilings come next. The orchestrator owns expansion and P2/P3
work. Retain the accepted fresh family, the original sealed failure, both freeze
records, and their aggregate evidence. This lane publishes PR4 only.

## Launcher

```text
/goal follow the instructions in goals/oppold-corpus-salvage-restoration/GOAL.md
```

## Reading order

1. [`SPEC.md`](SPEC.md) - normative scope, acceptance gates, constraints,
   decision log, and capability inventory.
2. [`PLAN.md`](PLAN.md) - P0-P3 sequencing and exit criteria.
3. [`GOAL.md`](GOAL.md) - compact execution launcher.
4. [`research/SOURCES.md`](research/SOURCES.md) - inherited provenance and
   capability citations.

## Provenance

Graduated 2026-08-24 from
[`explorations/oppold-corpus-overhaul`](../../explorations/oppold-corpus-overhaul/README.md)
as G1, the exploration's only promised-now candidate. Pipeline v2, semantic
ingestion v2, enrichment v2, and practice-kg bundle v2 remain gated MAP
re-entry points. The solo-practice corpus kit remains deferred.

## Latest evidence

2026-10-10 — Fresh P1 slice sealed acceptance: one store pass, zero warnings,
exceptions or interruptions, 3,339 accounted children (3,237 engine plus 51
repair-copy and 51 Tika children). Attachment dispositions: 59 repaired
occurrences / 51 distinct digests, 147 unsupported, zero unchanged. Input
56,140,800 bytes; promoted output/family disk usage 132,668,272 bytes
(2.363134690x); attempt 809,685 ms, family 822,686 ms. All ceilings hold.
Archive re-verification took 254,472 ms before family start. Four focused
restoration tests pass. P1 complete, P0/P4 complete, P2/P3 pending, lifecycle
active. PR3 #1606 merged; PR4 records the outcome and post-push receipts.
See `history/p1/2026-10-10-fresh-slice-acceptance.md`.


2026-10-10 — Run-5 selector regression passes: a new mail family uses the original
sealed archive, creates a distinct transformation identity and output tree, and
leaves the first terminal ledger unchanged. All five focused tests pass. The
fresh live slice uses the retained object, engines and ceilings after PR3 is
content-final; its outcome is separate evidence for PR4.

2026-10-10 — Sealed P1 diagnosis attributes an attachment-reuse engine defect.
Eleven repaired digests and 22 unsupported dispositions preceded a duplicate
attachment. Two real Tika invocations exited 0 with unchanged extracted content
and one differing parser-duration field. First-evidence reuse passes the new
synthetic regression. The fresh family is authorized by run 4; acceptance is
pending. See `history/p1/2026-10-10-engine-failure-diagnosis.md`.


2026-10-09 — PR1 #1596 merged the probe-proven Tika capture and portable-name
fixes. The frozen live slice ran once and sealed a failure: one unapproved
`engine-failure`, zero store passes, zero warning rows, and zero terminal child
rows. Attachment dispositions: 11 repaired, 22 unsupported, zero unchanged.
Input 56,140,800 bytes; retained output 115,418,004 bytes (2.055866749x);
family elapsed 350,398 ms; archive re-verification 282,677 ms. The output fits
the frozen disk/time ceilings, but final child reconciliation did not complete.
The four fresh synthetic exception/accounting/resume cases pass. P1 remains
in-progress; no second launch or artifact mutation is authorized. See the
handoff and frozen run manifest for aggregate evidence and digests.

2026-10-06 — P0 resumed and P4 opened (lane E, corpus provenance completion).
The 2026-08-27 archive run had stalled at a 90.25 GB root-archive partial;
the source tree had since lost 1,818 operator-deleted noise files (recorded
as inherited loss, see `SPEC.md` decision log). The run resumed under
re-measured denominators on a USB 3 link and **closed P0**: 11,451 objects /
348,605,703,418 bytes preserved, independent verification 11,451/11,451, zero
unapproved rows. The catalog now registers the T7 run (10,696 rows) and the
2026-10 tom-pc run (8,237 rows; 35,707 files / 18,464 distinct digests in
all). Full-hash reconcile: 5,086 T7 files (28.5 GB) have a copy elsewhere in
the corpus home; 5,610 (320.1 GB, 4,354 distinct digests, including the four
large PSTs and both OSTs) exist only in the preserved payload. P4 schemas and service contracts
landed (`ProvenanceIndex.schemas.ts`, `ProvenanceIndex.contracts.ts`), and the
header index ran over both mail trees: 118,771 + 122,730 messages, 72,980 +
101,107 with RFC 5322 headers, 116,951 + 186,180 attachments, 1,539 + 1,582
embedded items (`staging/provenance/messages-<tree>.jsonl`).

2026-10-07 — P4 attachment repair applied and the census run (lane E). The
byte-signature repair scanned 299,998 files directly under `Attachments/` in
both mail trees and renamed 299,371 (exact completion 267,237; fully eaten
extension 31,228; remnant mismatch 515; inexact 16; 627 left as
`ambiguous-mime`, 375 already consistent from the interrupted first run);
zero collisions, missing or size-changed sources. Two append-only journals
(375 + 298,996 rows) are the undo input. pffexport keeps Windows backslashes
inside attachment names (793 proposals in the refresh tree alone); the first
apply stopped on them and the path schema was corrected
(`CorpusRelativePath`, see the decision log), after which the header index
was regenerated so its attachment paths match the repaired tree. Metadata
census (`staging/provenance/metadata.jsonl`, exiftool 13.55, magic-identified):
346,062 files over `raw/` (25,763), `incoming/` (16,521), `organized/`
(3,780; its 28 symlinks into `raw/` dedupe to their canonical path) and the
two attachment trees (115,402 + 184,596); 344,908 read cleanly, 1,154 engine
errors kept as rows, 60,643 with an author, 102,883 with a creation date, 67
file types (PDF 88,648; JPEG 80,115; GIF 64,599; PNG 48,679; ZIP 19,637; DOC
13,090). P4 is complete; the hand-off to workstreams C and D goes through the
orchestrator with file names, counts and digests only.


2026-08-27 — P0 in progress. Bar-v2 preservation schemas landed in the repo
CLI Corpus command family (`Preservation.schemas.ts`): occurrence identity,
six attempt outcomes with pre/post source-stability observations, the
five-class inherited-loss opening balance, two-state capacity preflight with
an approved ceiling, fresh-process verification outcomes, and the tagged
provenance-ledger record decoding beside legacy salvage rows. Services,
streaming runners, and synthetic proofs are next; no archive run has
occurred.
