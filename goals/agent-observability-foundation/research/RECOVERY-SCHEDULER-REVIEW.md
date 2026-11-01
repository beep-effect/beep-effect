# Evidence recovery and scheduling refactor review

Independent Astra panel, 2026-10-29. Read-only source review against exact
pre-refactor snapshots. Parent execution receipts are separate; these reviews do
not independently certify tests, release the recovery hold or close the full goal.

## Recovery

No actionable semantic regression found. Current evidence-recovery.ts SHA-256:
`a6e2da7917bb9b1ac038595a2c1e042834818a1073b0eda34411cae8a51a6625`.
Original snapshot SHA-256:
`b3132f31d0d9cf48879ed8d292c756b2c80d35c9dd15b3a5bfa76fd85ac8acb7`.

Fixed descriptor/column allowlists, 32-row keyset scans, per-row UTF-8 and aggregate
capacity checks before hashing/inserting remain intact. Checksum short circuits,
current-generation and empty-table refusal order, final count/bytes/chain equality
before publication, and already-restored fast path are preserved. Every helper uses
the same SQL client. Retention seal/restore still own the surrounding transaction
and deadline, so copy, restore and publication failures roll back together.
Immutable progress replaces private locally mutated counters; failing intermediate
progress is never exposed, and no externally observable failure state changes.

## Scheduler

No actionable semantic regression found. Current native-schedule.ts SHA-256:
`50ad3a0114aac2fab3570b35f58cc0c2d436a946d3ac75d3c2017711dc47d720`.
Original snapshot SHA-256:
`b1115ff9c631e5973e1c5585c753f092018815d1f4aa08e6efb5e5197b4f01e1`.

Selection preserves current-page reading, at most one further-page advance, wrap
calculation and cursor claim within the original transaction. Empty pages advance;
missing selected payloads refuse. The bounded tick loop, permit, deadline, visited
set and one-claim-before-I/O behavior are byte-equivalent to the snapshot.

Tagged query admission preserves checksum verification before clock/backoff,
clock-regression refusal before resetting for a different attempt, and capped
count/delay formulas. Reservation still commits before readback. Multi-event
attempts reconstruct contiguous source order from canonical ID sets. Accepted or
ambiguous events require readback before replay; fresh Missing, qualification,
minimum delay, latest permanent refusal, attempt limit and transport backoff are
checked in the same order. Visible/rejected holds, age sampling, prior consistency,
clock reads, epoch-scoped deterministic IDs, one-event send selection and safe
failure classifications are unchanged. No replay-authority/privacy expansion found.

The reviewer inspected scheduler tests for source order, restart traversal,
permanent refusals, durable query backoff, interruption and corrupted reservations.
No tests were executed by the reviewer. Inspected scheduler test SHA-256:
`00e46074724ca044330c1140dd51c06f33b95028dedb4bec7ab9e2ba4012e071`.
Inspected retention caller SHA-256:
`f05d08e5ac949e2512c7bb4cca8078f8bb2bb7446668d93a8bc990f76ce18257`.

## Native intake

No actionable semantic regression found. Current native-intake.ts SHA-256:
`9501fabf3f3962de64d4851a9cc765b2c1cdafef6bb61ec371ee0d9cca873efe`.
Original snapshot SHA-256:
`3b4b833ad21a772edd0d85a9108ad3ffc8203556de7c68289380916e0f9373c8`.

Namespace and encoded-size checks remain outside the transaction. Window lookup,
epoch-bound receipt hashing and replay validation precede disposition/page/byte
capacity checks inside it. Replay checks retain page disposition, reclaimed
acceptance equality or canonical event validation, skip previously rejected
occurrences, then hash/check each canonical index entry and its owner's expiry.
Missing/altered metadata refuses; expiry remains explicit.

Admission is sequential per occurrence: encode/hash, lookup, insert the first
identity at its original index, duplicate matching content, reject differing
content before reading disposition, and classify an expired matching owner.
Exhaustive matching increments exactly one count or records one index. Index/page/
receipt insertion, page readback and receipt hashing remain in one transaction;
helpers neither fork nor commit independently. Receipt-write failure retains
rollback of the page and newly inserted canonical events. Missing payload handling
retains expired/reclaimed/None distinctions after receipt validation. readNewEvents
and the returned API are byte-equivalent to the original snapshot.

The reviewer inspected existing duplicate/conflict, exact replay/privacy,
receipt-write rollback and replay-at-capacity assertions without running them.
Parent execution receipts remain separate. No files/services were changed by the
reviewer, and no recovery or full-goal hold was released.
