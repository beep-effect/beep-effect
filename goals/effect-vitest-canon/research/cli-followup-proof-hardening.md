# Follow-up proof hardening

The frozen PR remains unchanged. These receipts belong to the follow-up branch.

## Scheduler status repair

Commit f6b1dcaa28 adds Flag.withDefault(false) to scheduler status's Boolean
JSON flag. The existing text handler now runs when no output flag is supplied.
A regression in the existing status/reap case compares omitted --json with
explicit --no-json, preserving the JSON and reap checks. The regression fails
before the repair and passes after it on both Node and Bun. The actual unflagged
command succeeds and prints the admission snapshot as text.

Quick @beep/repo-cli package verification passes lint (4.0 seconds) and check
(6.8 seconds). Actual generated test diagnostics are empty with exit zero.
The complete existing 133-case scheduler cohort passes on Node and Bun with no
skips. The fresh migration baseline takes 23.258 seconds on Node and 19.603 on
Bun; source hashes remain stable and workstation load/pressure are recorded.
These timings are observations, not a causal performance comparison.

The root ratchet remains 1,217 files / 3,465 live findings, with zero introduced
and 1,552 resolved findings. Only the existing status-test runtime anchor was
updated for its added regression; it remains open. The later full CLI package proof at a1de26d035 covers this repair: audit
704.4 seconds and docgen 19.2 seconds. The earlier Yeet proof predates it.

## Expanded assertion conservation

A stronger private audit compares parsed assertion trees in traversal order,
normalizing parentheses and formatting. It recognizes imported assertion
utilities, expect/assert chains, local assert-prefixed helpers and direct
assertion stages in pipelines. Against their original committed sources:

- Yeet: 604 trees preserved, before b719979e98.
- Docgen: 342 trees preserved, before 8eb8b0ad06.
- Files command: 472 trees preserved, before af590adea7.

No assertion exclusions were used for those three comparisons. Receipts are
cli-{yeet,docgen,files}-expanded-assertion-preservation.json in the private
P1 artifacts. This improves the conservation audit, not behavioral coverage.

## Scheduler draft clock evidence

The scheduler resource draft is not applied. It preserves 521 captured
assertion trees while moving the capacity property to it.effect.prop; its
outer Passed-status check is the one explicitly excluded tree. Seven native
fixtures now have hook timeouts.
Four clock-adjusting cases each own a nested TestClock.layer().

An independent six-case public-API control observes distinct clock identities,
zero initial times, two-second advances in each child and an unchanged parent.
It passes on both runtimes. Removing the four nested clock layers fails their
four identity checks on both runtimes (two parent witnesses still pass).
The control proves the fixture API behavior. Actual migrated scheduler tests,
resource lifecycle controls and ledger judgment remain pending; no scheduler
inventory rows are closed by this draft.

A separate it.effect.prop control uses the same finite, nonnegative input domain
bounded by 4,096. Both runtimes accept valid assertions and fail when an assertion
requires that input to be negative, reporting counterexample zero. This confirms
assertion failure propagation through the public property runner. It does not
replace running the actual migrated capacity property with its existing fcRuns
budget. An initial private control import-path failure is archived separately;
it collected no tests and is not counted as property evidence.
