# P2 first bounded wave stopped at family 5

The standing Runs 12+/13+ ruling requires a stop at the first sealed failure.
Five of nine planned families started. Four sealed acceptance and reconciled;
family 5 sealed failure. Ordinals 6-9 remain unstarted. No family was retried,
no engine or launcher changed, and no output, ledger or claim was mutated.

## Wave totals

| Family | Result | Seal | Input bytes | Retained output bytes | Family elapsed ms |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | pass | 61,727,744 | 147,490,617 | 847,540 |
| 2 | 0 | pass | 98,804,736 | 265,766,621 | 2,611,137 |
| 3 | 0 | pass | 98,804,736 | 246,434,736 | 2,430,372 |
| 4 | 0 | pass | 119,120,896 | 337,512,124 | 4,797,300 |
| 5 | 1 | failure | 157,975,552 | 354,621,626 | 1,491,085 |

The five started families total 536,433,664 input bytes, 1,351,825,724
retained output bytes and 12,177,434 ms of family elapsed time. These are
sums across separate families, not a cumulative acceptance decision.
Accepted families total 378,458,112 input bytes, 997,204,098 output bytes,
13,347 accounted children (12,591 engine plus 756 derived) and 10,557,132 ms
of attempt time. Their recorded ledger digests remain unchanged.
The failed family contributes no accepted store or terminal child rows.

Retained ceilings per family: amplification ratio 4, attempt 7,200,000 ms,
family 43,200,000 ms, total output 2,147,483,648 bytes and free-space floor
100,000,000,000 bytes. All nine pre-launch source, engine, membership,
launcher and recomputed policy identities match. The eighteen larger
occurrences remain excluded.

## Family 5 terminal evidence

Unit: beep-heavy-corpus-restore-p2-2026-10-13-5.service.
Started stamp: 2026-10-14T00:14:38.133Z.
Family start: 2026-10-14T00:21:38.814Z.
Failure seal: 2026-10-14T00:46:29.904Z.
Archive re-verification took 420,681 ms before family start. Queue delay
was approximately 133 ms from the recorded second-resolution submission.
Attempt: mail:37a7c097ad537810a0a4dc25:r0.

| Identity | SHA-256 |
| --- | --- |
| Object | 492971fd43294de2fc1f47e58ad0ec78fa0438af9004fcb1166ad42ffd09437d |
| Source | 722872e1f639f3cf9d771708dd0f817111a024880292aeaaf9964b664d9f9c81 |
| Runtime and frozen policy | fd9019c7caf2b434c8a09d12196ca841b4802b7702181fb571d57c4f878ebbc6 |
| Ledger | dda98f8c7088589dffdc463935455b7474fad7ab4738cf8feaab749dd1d3031c |
| Retained-output combined digest | 12a8e09ae681c92c0732f584684e5b164faf407b630f6fc382ca8e944d3d0aec |
| Unmatched repair copy | 21a22af48d47077e731ed4806a6a470191c3c85924f7c8c2d8f4aee55dc9dd7a |

Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-05/ledgers/mail/slice.jsonl`.
Freeze record:
`history/evidence/p2-first-wave-2026-10-13-family-05-run-manifest.json`.

Record counts: 325 attachment-type-repair rows; one each family-run-start,
family-attempt-start, mail-store-exception, family-run-summary and
family-acceptance-failure. Zero store passes, child passes, warnings or
interruptions. Exception class engine-failure, approved false.
Expected/terminal one, unapproved one. The failure is sealed and cannot rerun.

Dispositions before failure: 108 repaired occurrences / 98 distinct digests,
217 unsupported, zero unchanged. These are partial processing evidence.
They do not establish store or child acceptance. The retained attempt has
6,368 files, including 99 repair copies and 98 Tika files. There is one
unmatched copy and no unmatched Tika file. Atomic promotion did not complete;
the retained partial attempt is left intact.

Retained output and family disk usage are both 354,621,626 bytes, amplification
2.244788016x against 157,975,552 input bytes. The per-attempt output ceiling
is 631,902,208 bytes. Family elapsed 1,491,085 ms is also below the attempt
time ceiling. No terminal attempt-duration measurement exists because there
is no store pass. Capacity after failure: 418,243,366,912 free bytes.
The pre-launch handoff measured 422,327,496,704 free bytes.

The result stamp is 1. The transient family unit is inactive; it has been
collected, so its default show Result is not execution evidence.
Journal counts: zero killed, zero oom-kill/signal failure matches, one
code=exited match and four lines. Private live log: four lines / 990 bytes.
No private log or journal lines were printed.

## Read-only diagnosis and attribution

The sole unmatched copy is a 3,020-byte GIF-signature object. Repeating the
exact extension-less frozen Java/Tika second pass in a read-only bwrap
sandbox, with stdout held only in RAM, produces exit 1, zero characters,
zero bytes and zero non-whitespace bytes. A second reproduction gives the
same result and one TikaException match; no IIOException, IOException,
EOFException, IllegalArgumentException, ArrayIndexOutOfBoundsException,
UnsupportedFormatException or NoClassDefFoundError matches. Stderr was
counted inside the disposable sandbox and its lines were never printed.
The frozen Tika version smoke exits zero; the real pffexport sandbox smoke
also passes.

RestorationTransformations.ts repairDetectedAttachment materializes a copy
before extractAttachmentText, and appends its repaired row only after
successful Tika evidence. extractAttachmentText refuses nonzero or empty
second-pass output; processPstCandidate catches the error and
pstFailureTerminal seals the unapproved engine-failure. The observed
unmatched copy and reproduction localize this stop to second-pass extraction.
The precise original parser cause is not retained by the generic ledger catch.

Attribution: input-sensitive failure at the frozen Tika/parser boundary.
A malformed input, unsupported GIF parsing condition or engine defect is
not distinguished by the retained sanitized evidence. This is not an
observed capacity breach, interruption, policy drift or successful repair.
Do not approve an exception class or claim input corruption without evidence.

Four focused restoration tests passed, 78 skipped, 4.41 seconds through
beep-heavy. No package source changed, so package-verify and package-source
hosted-parity producers are not run for this evidence PR. Packet adoption,
doctor, index, launcher, manifest and knowledge-reference results belong
in the dated handoff.

## Stop decision and reversal

Stop the wave permanently under its current contract and retain all five
families and all nine immutable freeze records. Do not launch ordinal 6,
retry family 5, change its flags or create a replacement family. Publish this
terminal failure record with P2 in-progress and all remaining gates open.
P0, P1 and P4 remain complete; P3 remains pending.

The orchestrator owns any separately frozen recovery or later-wave ruling.
Track sanitized exception-stage evidence and a failing-GIF fixture as
follow-ups. Reversal is reverting packet decisions while retaining every
ledger, output, claim and freeze record; this lane never deletes them.
