# Stage 5 acceptance evidence

## Storage

Source wave: `4decfe96d35fdd2802db7d7567449af2408da99b`, followed by independent
review corrections. Commands run through `beep-heavy` with the assigned 24 GiB
caller budget and the operator-installed admission memory floor. The first
package-relative retention suite ran 39 tests: 36 passed and three fixture
errors were corrected. The expanded suite next ran 48 tests: 29 passed and 19 failed. The unsupported
Effect comparison export and symlinked-checkout sync path were repaired at
`d881c6e2e0`; a schema-derived property test was added. Six complexity
findings and a duplicate parser prompted the refactor at `bc0591bbb1`.
The corrected suite and test-policy diagnostic are queued; no final passing
crash-recovery result or successful publication is claimed yet.

The fleet v3 dry census is published in
[storage cleanup](./stage-5-storage-cleanup.md). Actual fleet cleanup is deferred:
no owner-verified eligible rows, no orchestrator apply acknowledgement, and
live clone owner notices remain required. Applied rows: zero. Reclaimed
apparent/exclusive filesystem bytes: zero/zero. Archive moves in synthetic
fixtures, when verified, demonstrate recovery and preserve payload; they do
not establish physical reclamation from real checkouts.

Research, corpus and runtime material remains owner-ruling-required. Existing
archive reports remain durable proof until a separate owner retention ruling.

## Independent implementation review

At `2026-10-09T18:49Z`, the separate `claude-opus-5-5` medium review session
returned terminal zero actionable source findings on
`a1363f237b38bf694429a86e3cdb09b84d303857`: zero High, Medium and Low. Seven
rounds preserved prior findings and corrected every actionable issue. The
review was read-only, with no tools, edits or delegation. It explicitly
separates source review from queued runtime/package/parity/cache/hosted gates.
Private prompts and receipts remain in the lane's ignored evidence directory.

That source-only verdict predates the admitted runtime failures above. A new
independent review of `bc0591bbb1` is running; the older verdict is historical,
and does not establish terminal zero on the refactor or runtime qualification.

## Current qualification checkpoint

Source `b78c673e039cbd6a6461e2f4f7f3159d2a354cd6`, UTC
`2026-10-09T20:13Z`. Independent read-only `claude-opus-5-5` medium round 15
returned terminal zero High/Medium/Low findings on the supplied source. Rounds
12–15 corrected direct-parent containment, its regression assertion, and the
OS fixture clock. The prior focused admitted run finished 55 cases: 53 passed
and two SIGKILL cases timed out while the fake clock held abandoned-lock retry.
The live-clock repair is committed; final rerun remains pending.

Canonical `yeet publish` passed all 16 cheap gates and opened draft
[PR #1580](https://github.com/beep-effect/beep-effect/pull/1580) at
`5f5a4f452a6cac4ee8d30a6532ed9fdaaaba2529`. This publication predates the
clock repair. No final passing runtime, package, compiler, docgen or scoped
coverage claim is made here. The three Vercel failures explicitly report
"Deployment rate limited — retry in 24 hours." and are acknowledged as
environment-only. No service plan or quota changed.

The latest storage dry run has 2,765 rows across 259 roots, all deferred, with
0 applied and 0/0 MiB reclaimed. The latest cache receipts prove identical
28-file restored manifests for both task hashes in the lane, linked worktree,
fresh clone, and shared route. Changed-input execution recorded a new task
hash and MISS, then failed because the linked fixture lacked `tsc`; the
frozen-install repair and successful execution proof are pending.
