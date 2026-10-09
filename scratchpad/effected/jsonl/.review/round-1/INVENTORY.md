# jsonl review round 1 — inventory

Commit e0500aea7d (S3). Seats: grok (first run spent its 80-turn budget before reporting and
is kept as grok.failed-max-turns.md; the same session was resumed for the report), sol, fable.

Counts as reported: grok 0/0, sol 2/0, fable 5/4. After dedupe: 7 required, 4 backlog.

## Required (deduplicated)

| Id | Sources | File | Class | Resolution |
| --- | --- | --- | --- | --- |
| R1 | sol-1-1 | Journal.ts:887 | bug (BOM width from a replaced file) | the BOM width, size and identity come from one pinned handle, or the probe's identity is checked against the sample; pin a BOM file replaced by a BOM-less one between probe and sample; extend deviations 10, 12, 13 evidence |
| R2 | sol-1-2 | Journal.ts:1179 | bug (construction fails on a vanished journal) | seed recovery also treats `PlatformError` reason `NotFound` as an empty journal; other platform failures still propagate; pin disappearance before the seed metadata sample; extend deviation 20 evidence |
| R3 | fable-1-1 | internal/tail.ts:121, :115 | perf (measured, 100x to 10,000x) | typed-array `lastIndexOf` and `indexOf` as upstream, no array copy |
| R4 | fable-1-2 | Journal.test.ts:70 | test (upstream case missing) | port upstream "a partial patch INHERITS untouched fields from a class-instance base" with an `S.Class` payload |
| R5 | fable-1-3 | Journal.test.ts:76 | test (weakened) | gate the first patch inside the write permit (the `writeAll` gate of Journal.edges.test.ts:172) so the second provably reads after it |
| R6 | fable-1-4 | Journal.test.ts:153 | test (upstream case missing) | port upstream "an outer-scope subscriber sees EVERY completed append before stream end" at capacity 1 |
| R7 | fable-1-5 | Journal.ts:1378 | jsdoc | one lead paragraph; the warning and the instruction move to `**Gotchas**` (the gate now enforces this) |

## Backlog

| Id | File | Decision |
| --- | --- | --- |
| fable-1-6 | Journal.ts:704, README Deviation 10 | fixed this round (docs only): the README states when reconciliation re-probes; the behaviour change stays recorded until a probe reproduces it |
| fable-1-7 | Journal.ts:547 | fixed this round: the doc block sits on `decodeWindow` |
| fable-1-8 | Line.test.ts, Helpers.test.ts, LineProperty.test.ts | fixed this round: every property passes `{ arbitrary: fcRuns(n) }` |
| fable-1-9 | Journal.integration.test.ts:24 | recorded: lab-authored duplicates of four restored upstream cases with their own timeouts; retiring a test needs an explicit decision |

## Resolution

All seven required rows are closed by restoring or strengthening; no new deviation.

- R1 also had a second site: the seed paired a BOM width probed by path with an identity sampled
  later. Both the read and the seed now take the width, the size and the identity through one
  handle (`internal/tail.ts` `handleBomBytes`). Evidence added to deviations 4, 10, 12 and 13.
- R2 recovers a platform `NotFound` only when the file is in fact gone; a `NotFound` for a journal
  that still exists keeps failing construction (the existing pin at
  `Journal.regressions.test.ts` "an unreadable existing journal fails layer construction with its
  platform error" requires it). Evidence added to deviation 20.
- R4, R5 and R6 were each checked by mutation: removing the guarded behaviour fails the new test.
- The lane found the test gate red before its own changes (two canon detectors on
  `scratchpad/test/jsonl.test.ts`, which the runner had not scanned until this round) and fixed
  both.

## Rejected

None.
