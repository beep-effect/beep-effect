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


## G current source qualification at 59e5cf879f

The following measurements supersede the earlier queued runtime checkpoint.
At `2026-10-09T20:47:07Z`–`20:47:28Z`, the admitted focused suite passed
**55/55**, including both SIGKILL windows using the live test clock. The
one-pass recovery warning selection at `59e5cf879f1796dfec00d14ba6545e5c79154eeb`
then received independent source review round 16: zero High, Medium and Low.
This verdict covers the supplied retention source, schemas and directory
handle; it does not review main's incoming CI modules or prove runtime gates.

At that source revision, `CI=true bun run beep knowledge refs --check` exited 0
(`20:53:37Z`–`20:54:09Z`), `bun run beep quality fallow audit` exited 0
(`20:54:09Z`–`20:54:20Z`) and `bun run beep quality fallow health` exited 0
(`20:54:20Z`–`20:54:25Z`). `bun run beep ci lane jsdoc-ratchet` exited 0
(`20:48:34Z`–`20:53:37Z`) at `9373232640`; exported documentation did not
change in the subsequent warning-selection compiler repair. No baseline was
refreshed. All heavy commands used the admission wrapper.

Scoped V8 coverage passed all 55 tests at the current source revision
(`20:54:25Z`–`20:54:49Z`). [The measured rows](./stage-5-g-coverage.json)
compare both files with the existing coverage baseline. Schemas remain 100%
on all four metrics. Implementation lines/statements/branches/functions are
91.01/88.30/78.60/87.66%, above baseline 86.85/85.07/76.92/84.52%.
Absolute uncovered counts increased with the added implementation:
103/147/132/38 versus 41/50/42/13. This is a scoped coverage read, not a claim
that the full repository coverage ratchet passed. The baseline stays intact.

The earlier `test-tsgo` and docgen failures at `9373232640` were introduced:
nested `A.filter`/`A.flatMap` contextual inference treated the row as unknown.
The direct, single-pass `A.flatMap(rows, ...)` repair preserves warning order
and selection. Compiler/docgen reruns and the default full package audit remain
pending; their actual terminal results will be appended below.


## Final G package and hosted-parity results

The default `bun run beep quality package-verify @beep/repo-cli` passed at
source `59e5cf879f1796dfec00d14ba6545e5c79154eeb`, UTC
`2026-10-09T20:54:49Z`–`21:12:04Z`: audit 1005.4 seconds, docgen 27.8 seconds.
The full audit includes package lint/check; this was not `--quick`.

At source-equivalent receipt revision `4916a7479698b34f6461aa4495361d3dbb9f554d`,
`bun run beep quality test-tsgo` passed (`21:11:31Z`–`21:11:52Z`, 331 files),
and `bun run beep docgen local --base origin/main` passed
(`21:11:52Z`–`21:12:29Z`, 2332 examples). The preceding owner commands all
passed without tracked changes: schema-first write, package-scripts write,
tsconfig-sync write, cache-profile write and goals-index write. These ran
after the final main integration and fetch confirmed `origin/main` remains
`df7d88aad7` at `21:07Z`. Code files are identical to the reviewed/package-
verified source revision; later commits update receipts only.

All named local parity checks have terminal passes. Scoped coverage is the
separate percentage/count read above, not a full repository coverage gate.
[Fresh cache fixtures](./stage-5-g-cache-fixtures.json) passed cold/warm/linked
manifest equality and successful changed-input MISS with 28 healthy outputs.
Real storage remains fully deferred: 2765 rows, 0 applied, 0/0 MiB reclaimed.

The earlier hosted CLI shard failed only the two SIGKILL virtual-clock cases;
these were fixed, independently reviewed, and both focused/full package runs
now pass. Vercel statuses explicitly report deployment rate limiting. Hosted
checks on each earlier pushed head remain historical; local proof does not
turn those failures into hosted successes. S11 assigns the final hosted-red
and 20-minute review-window merge gate to the orchestrator. No G merge is
performed by the worker.
# Stage 5 acceptance evidence — partial V contribution

This records V's local evidence only. It does not close the program or qualify
publication, hosted readiness, other lanes, or the repaired non-CLI preview.
The orchestrator owns the aggregate acceptance record.

## Package gates

| Lane | Package | Qualified source / artifact | Full package result | Evidence |
| --- | --- | --- | --- | --- |
| V | `@beep/repo-cli` | `4be0599a181c86fdf282da880dacf49bb20fb1bf` | PASS 781.746 s (audit 750.5 s, docgen 29.6 s) | `rsc-v-local-proof-results.json`, V handoff |
| V, prepared R105 patch | `@beep/rdf` | Original patch `b0f087e9b4addbd08cebc4c8cb4750e879a6367d8f344c6a55b278f5f77a4a92` | PASS 12.064 s | Prepared-patch evidence only; repair preview needs its own proof |
| V, prepared R105 patch | `@beep/pacer` | Same original patch | PASS 10.024 s | Prepared-patch evidence only; no second PR exists |

## Scope

V changes 78 files relative to merged main, including this partial receipt.
Only repo-cli package source/tests are edited; RDF/Pacer are preserved patches,
not package edits in the integration branch. The D13 roughly 150-file cap and
CLI-only first PR boundary remain intact. Thirty-five reviewed files match
terminal-zero source `a0b0df4147`. Main's changeset-remedy assertion and V's
new canonical plan property have separate terminal-zero Run 4 review. The
earlier 757.718-second package result belongs only to the table's recorded
`5a79cbc49a` source, including incoming Accounts code. The new full package
collector at `4be0599a18` completed with all nine source/parity stages green.
The later main merge `7ef36e8020` imports only seven exploration documents;
all package/root gate inputs and 37 source digests remain unchanged. No source worktree or branch was retired.

Final inventory: 1,853 / 716 open / 1,137 exceptions. Historical IDs remain
immutable; the dated linkage record describes re-anchors and candidate churn.
PR #1575 is published and ready; direct capped publication passed cheap gates
and frozen-install preflight. The private repo-cli release note was archived
after D policy landed. Knowledge refs passes with zero live gated observations
after the main SPEC wording repair. Hosted readiness, R105 follow-up, R102 remediation and completed-retained
gates remain open. The integration local package proof is complete.
