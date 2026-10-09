# Remaining native fixture resource batch

Source commit `b286f35a4dcb3af444ade3ccbe6a5a9019c4cb6a` repairs nine existing resource findings in
`@beep/repo-cli`. All 457 original runtime cases remain and 22 fault controls
were added. This is a qualified source batch; the full goal and hosted merge
readiness are not established by these receipts.

## Source and ownership

The batch started at `ba4fe3389462a57445a22610dfc31d45566f2898` in a
separate sibling checkout. The original source, registration counts, installed
cohort and before reports were frozen before any edit. The nine files are
`lint-security`, `purge-security`, `quality-scheduler`, `quality-tasks`,
`regenerate-merge-driver`, `skills-command`, `step-git-exec`,
`version-sync-effect`, and `yeet-pr-provenance` under the CLI test directory.

Temporary directories now have release ownership before fallible setup. The
scheduler's two restrictive permission cases restore mode 0700 through
`acquireUseRelease`, including failed or interrupted use. Eleven quality-task
acquisitions are atomic scoped allocations; the existing shorter comparison
scope and the `process.cwd` function override retain their original semantics.
Skills reuses the existing shared working-directory constructor, with cwd
restoration before root deletion. Six native layer registrations now declare
five-second build/close hook budgets. Case timeouts and property options were
not raised or reduced.

Actual symlinks, Git index conflicts, archive bytes under hostile profiles,
worktree common-directory resolution, subprocesses, permission errors and
transcript files remain native subjects. Pure per-case services remain local.
No production algorithm or shared support helper changed.

## Runtime and compiler evidence

Actual runtimes: Node **22.22.3**, Bun **1.4.2**; installed Effect and
`@effect/vitest` **4.0.1**, Vitest **5.0.3**. Ordinary runs use `CI=true`
with `BEEP_FC_NUM_RUNS` unset. Package cwd is `packages/tooling/tool/cli`.
Node invokes the installed `vitest.mjs`; Bun invokes `bun run test`, not
Bun's separate test framework. Exact commands, expanded names, source hashes,
exit codes and timings are retained in the private receipt directory
`~/.cache/beep/effect-vitest-canon/resource-next-20261006`.

| Frozen selection | Node 22 | Bun |
| --- | ---: | ---: |
| Before, nine files | 457/457; 49.65 s | 457/457; 36.75 s |
| First implementation, before R1 repair | 478/478; 49.46 s | 478/478; 32.81 s |
| Final reviewed source | 479/479; 50.74 s | 479/479; 35.74 s |

Final reports contain zero failures, pending cases or TODOs. Full-name
multisets retain every original case with its original multiplicity. The
additional 22 cases are native fixture controls. Original assertion operands
are preserved in each writer's AST receipt and the parent's two-file receipt;
no case or oracle was removed to obtain a pass. These selected timings are
observations under shared workstation contention, not a causal speedup or a
whole-package Bun timing claim.

The direct test-project compiler exited zero:

```sh
node_modules/.bin/tsgo -p packages/tooling/tool/cli/test/tsconfig.json \
  --rootDir packages/tooling/tool/cli --noEmit
```

Full `bun run beep quality package-verify @beep/repo-cli` exited zero on the
final nine-file source: **audit 681.1 seconds, docgen 21.8 seconds**. The
wrapper elapsed time was 704.45 seconds. Source hashes were checked before
and after. The earlier attempt was interrupted with exit 130 when independent
review required source repair; that attempt remains incomplete, not passed.

Fresh-worktree quick checks initially failed because upstream declaration
outputs were absent. The canonical full verifier builds the dependency closure.
The writers also repaired their introduced import/type diagnostics. A
package-test-typecheck wrapper's zero shell exit was not accepted as compiler
proof; the direct process and stored compiler outcome were inspected.

## Failure, interruption and cleanup controls

The final source has 18 native security/Git controls and four Skills controls.
They invoke the actual extracted scenario or working-directory constructor.
Setup failure, body failure where meaningful, interruption, second allocation
failure, and deliberate cleanup permission errors retain original assertions
and add direct release observations. Rescue finalizers live outside the
observed scope so a failed assertion cannot strand mode-000 directories.

Round one found that a PermissionDenied substring could come from the injected
Fail while an unrelated Die satisfied a loose cleanup assertion. It also found
extra Cause reasons could escape inspection, and two unregistered mode arms.
The repair now requires exact singleton Fail/Die or exact expected Fail plus
native cleanup Die, with independently captured removal error, method and root
identity. Interrupt controls require an interrupt-only Cause. Thirty-two
constructed Cause counterexamples reject wrong Die, extra Die and extra Fail.
One missing merge-driver cleanup case was registered; unreachable step-git
branches were removed. The independent
[round-one review](2026-10-06-resource-next-grok-r1.md) and
[round-two review](2026-10-06-resource-next-grok-r2.md) retain the findings and
source-bound closure. Round two reports no new defects.

The fault-control filesystem uses native acquisition/removal through public
`acquireRelease` so its removal error can be tapped before `orDie`. The installed
scoped constructor closes over a private removal factory. The ordinary cases
still use that installed constructor. The controls prove native removal error
identity through the instrumented fixture; they do not prove its private
finalizer's method label by substitution. Copied Cause annotations reconcile
runner stack metadata; exact reason lists and error identities still must match.

Parent controls additionally extract both actual permission acquisition/release
expressions and exercise success, failure, interruption and restoration failure:
12 controls pass on each runtime. Private copies of all eleven modified
quality-task acquisition sites fail or interrupt immediately after acquisition;
all 11 recorded paths are removed in each of four Node/Bun-by-fault runs. Those
copies intentionally report 11 failing selected cases and skip unrelated copied
cases. They are negative-control evidence, not skipped production tests or a
replacement for the passing complete suites.

## Historical ledger and baseline

[The lineage receipt](cli-resource-next-lineage.json) preserves all 51 selected
historical identities: **33 fixed** at the actual source commit (24 detector,
nine resource) and **18 individually justified exceptions**. Eight new reviewed
exception occurrences and one separately inherited open archive-spawn provider
candidate are appended. Five existing controlled-clock judgments remain unchanged.
Four historical missing-hook-budget rows are fixed; two introduced hook candidates
are gone after the explicit options. No native-platform blanket exemption was used.

Across all ledger files, **15,512 unique rows** pass strict public-schema
validation, directory/lens checks and fixed-SHA presence. Exactly 51 existing
rows change only status/reason/fixSha, nine are appended, and none are removed.
All other rows are byte-identical to the integrated parent. An exploratory
40-character-only SHA check rejected 74 inherited abbreviated receipts; all
five abbreviations resolve to commits. That extra check is distinct from the
schema's existing text contract and does not establish their historical source
correspondence. The complete source-bound validator remains a final-goal task.

The canonical baseline falls **1,883 to 1,866**: 621 open findings and 1,245
exceptions. Its rows outside these nine files are unchanged. Historical CLI
backlog now has **212 open detector rows** and **30 actionable human rows**:
resource zero, property 21, flake five, observability four. Coverage-only rows
remain unchanged. These historical and live populations are not interchangeable.
The empty-final-baseline gate includes exceptions and remains unsatisfied.

The existing Version Sync property lacks an explicit `fcRuns` option. A previous
400-in-the-environment run does not prove 400 actual native trials or the requested
seed; source tracing showed no such forwarding. This resource batch preserves
its existing options and records that qualification for the property phase.

## Integration and acceptance limits

After source qualification, parent branch `64bff0e5` was merged at
`46500c117ae854cf378a08e273196e63b5a1e1a6`. This imports the separately
qualified first-batch metadata and upstream SDK 1.31.0 security lock change.
Both sides of append-only decision/opportunity conflicts were retained, and a
frozen install passed. The nine reviewed source hashes are unchanged. The
post-integration focused runtime, compiler and quick package receipts are
recorded separately below when terminal; the full audit above retains its
original dependency cohort.

No PR is yet attached to this second batch. PR #1506 belongs to the preceding
batch and remains distinct. The fleet orchestrator owns merges. Current-main
integration, cheap gates, exact-head hosted checks/reviews, remaining inventory,
D1-D14 acceptance, ratifications, following-week coverage p95 and final reflection
remain open; no full-goal completion follows from this source batch.

Post-integration receipts are terminal: Node 479/479 in 52.90 seconds, Bun
479/479 in 38.89 seconds, direct test-project compiler exit zero in 15.20
seconds, and package quick lint/check exit zero in 9.52 seconds. All bind the
same nine final source hashes with SDK 1.31.0 installed. They do not relabel
the earlier full audit's cohort or assert whole-package timing comparability.
