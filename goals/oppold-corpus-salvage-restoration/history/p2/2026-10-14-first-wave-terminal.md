# P2 first wave terminal record: nine sealed, five accepted

All nine bounded members have sealed. Accepted ordinals: 1, 2, 3, 4, 6.
Sealed failures: 5, 7, 8, 9. All family units are inactive. No sealed
family was retried, original mutated, or engine/launcher changed.
P2 stays in-progress; P0/P1/P4 complete, P3 pending, lifecycle active.

## Family 9 evidence and diagnosis

Unit: beep-heavy-corpus-restore-p2-2026-10-13-9.service. Result stamp: 1.
Ledger relative to corpus home:
`staging/restoration/runs/t7-salvage-2026-08-10-p2-2026-10-13-wave-09/ledgers/mail/slice.jsonl`.
Attempt: mail:cdbf9fe5be4cec603a24b02e:r0.
Object: 90fe1bba1664bb79ffe5b6bdca9b720f27ec1e001314cf8788cef57282a2f3f1.
Source: efa55f979cbcd6ca4f7e58880abce689645daba36a9058e2d36ba71f077a12bb.
Runtime/frozen policy: 8e31b6b8b054267e41cbe4db098e5a201308accd882bdea2e8f3b91ba580f2ec.
Ledger SHA-256: 87943da8d7c8b10283008000c1d99ca4a17e411a7824bec520f1f10adae5bc90.
Retained-attempt digest: 7eede173895745bd4cd82921fcf4bce4216570edcef0e3b4b7335a717e3f6cf6.
Family-output digest: fa478ee95807e14641d67da6d86ab3887ce601e75a60c14c2c928b5fddc7e59d.

One each family-run-start, family-attempt-start, mail-store-exception,
family-run-summary and family-acceptance-failure; 634 attachment-type-repair
rows. Expected/terminal one; unapproved one; engine-failure approved false.
Zero store passes, child rows, warnings or interruptions. Partial dispositions:
359 repaired occurrences / 320 distinct digests, 275 unsupported, zero unchanged.
Retained files: 14,767; repair copies: 321; Tika files: 320; one unmatched
PDF copy, zero unmatched Tika files. No accepted child reconciliation,
repair-pair acceptance or atomic promotion is claimed.

Input 456,877,056 bytes; output 1,177,728,174 bytes (2.577779205x).
Output fits attempt cap 1,827,508,224 and family cap 2,147,483,648 bytes.
Family elapsed 7,222,485 ms fits 43,200,000-ms family cap; it exceeds the
7,200,000-ms attempt ceiling. No store-pass attempt-duration field exists.
Started 2026-10-14T08:42:20.121Z; family start 08:46:59.320Z;
attempt-start row 08:46:59.338Z; failure seal 10:47:21.815Z.
Archive re-verification: 279,199 ms. Queue latency is only approximate,
121 ms from the whole-second submission record, not a precise measurement.
Pre-launch free bytes 403,566,137,344; diagnosis free bytes 392,097,185,792.

The unmatched PDF copy is 28,712 bytes with SHA-256
55cb9b03e5af4ebab39985b4d3217fa78fc8e659b267aecc1c55e3b480c5edf2.
Its modification time is 2026-10-14T10:47:10.161441Z, 7,210,823 ms after
the attempt-start row. extractAttachmentText checks remaining elapsed time
before starting Tika; a copy written after the attempt ceiling strongly
supports attachment-repair elapsed-budget exhaustion. The terminal catch
replaces the original cause with a generic engine-failure. Exact cause,
precise attempt clock and parser status remain unresolved. No parser
reproduction or exception approval is inferred from this timing.
Private log: four lines, 992 bytes. Journal killed/oom/signal matches zero;
code=exited one. Only counts were read. No retry or recovery was launched.

## Wave reconciliation

All nine runtime policies match immutable manifests; all nine source
object/digest/input-size values match sealed archive metadata. Current engine
versions, Java real path, Tika digest, launcher digest and membership digest
match all nine records. Eight prior ledger hashes match earlier handoffs.
Accepted-family child counts and engine counts reconcile, and repair-copy,
Tika and repaired-digest sets are identical for each accepted family. All
accepted store output/time ceilings hold. Accepted children total 19,438.
Wave input total 1,974,633,472 bytes; retained output total 4,974,218,513 bytes.
Failed-family partial repairs are not accepted children or successful repairs.

Family 5: input-sensitive GIF Tika parser failure, exact cause unresolved.
Family 7: attachment-repair elapsed-budget exhaustion, exact cause unresolved.
Family 8: input-sensitive PDF Tika parser failure, exact cause unresolved.
Family 9: timing supports attachment-repair elapsed-budget exhaustion,
exact cause unresolved. Each sealed failure remains unapproved and retained.

Execution identity: families 8–9 used the separately committed 06:25Z
fallback amendment because the unchanged launcher hardcodes this lane.
Ordinal 9 execution head was 91256cfd1bf4fa7c428b9d568f7a5192c210dd9e;
its restoration/libpff source diff from amendment head ce71e3cb88 is empty.
Original immutable codeHead remains 6eb3d036771e868768846b3c56a5aafac69c3b2b.
No equivalence to original source is claimed; no execution-only worktree exists.

## Decision and remaining scope

Stop on family 9's sealed failure and publish this separate terminal record.
Do not push to merged #1696. The 08:35:38Z ruling scopes one recovery
amendment to 5/7/8; it does not authorize family 9 recovery. Record that
additional failed occurrence for an explicit orchestrator scope decision.
The amendment must name the next fallback engine before approval and launch.
No such ordered restoration-engine chain is present in the packet, brief
or public restore-mail implementation. A model-provider fallback chain is
not an extraction-engine contract. Preserve this missing dependency rather
than invent an engine. Eighteen larger occurrences and estate/recycle/DOC
gates remain open for P3. Reversal: revert packet decisions while retaining
every ledger, output, claim and immutable manifest.
