# Client, readback and enrollment structural review

Independent Astra review on 2026-10-29 accepted the following source-bound
extractions against foundation HEAD `48f87682ccfb6037fe870baa747123c0789c5077`.
This is a complexity repair, not a new collection or deployment authorization.

## Managed launch client

Private directory/socket inode validation, request construction and submission
status mapping now have separate internal helpers. Both lstat reads still precede
metadata validation. Missing owners refuse; the initial inode/device identities
remain pinned and are checked before encoding or network work. Request limits,
response read limits, fatal UTF-8, no retries, no-queue permit, deadline and error
mapping retain their prior ordering. Context and receipt verification remain
outside the exchange. The single type constraint added after the first package
check, `Match.withReturnType`, is runtime identity in the installed Effect version.

Final reviewed SHA256:
`67d0ef1a4d78df615b17841a0dcaf541794156c639bfd4b6302447a4bdbbf786`.

## Phoenix exact-span readback

The bounded response reader and allowlisted projection are separate internal
helpers. HTTP status still precedes media/encoding checks and body reading.
404 remains `not-found`; valid empty 200 remains `None`. The 262144-byte streaming
cap, fatal UTF-8, duplicate/pagination refusal, exact identity checks, scalar
allowlist, five-second scoped deadline and no-queue permit are unchanged.

Reviewed SHA256:
`19521880baff145946b4844aa81e446071514a3ad8d038f0222d34ef6aa05d47`.

## Enrollment

Path separation and private parent validation now have dedicated internal
helpers. Enrollment preparation and the consumed-attempt snapshot still precede
target validation. Canonical path and separation checks precede parent lstat;
type/mode/present owner precede realPath. Encoding/size validation precede mkdir.
Exclusive file creation, file and directory synchronization, checked reread and
the outer write-error mapping are unchanged.

Reviewed SHA256:
`ffc832b5b1f35f02fef18075b31e42a3388003c80ee7568b110eae14714662f4`.

The reviewer made no edits or test runs. Qualification and the current complexity
worklist must be read from the separate verification receipt; this review is not
full-goal acceptance. Historical data and the recovery hold remain preserved.
