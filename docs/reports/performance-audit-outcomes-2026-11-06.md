# Performance audit outcomes, 2026-11-06

This report separates measured component improvements, hosted observations,
avoided work, and incomplete proof. It accompanies the
[sequential audit runbook](../runbooks/performance-audit-loop.md) and the
[repository performance runbook](../runbooks/repository-performance.md).
Parallel job durations are runner usage, not PR wall-clock duration. The
percentages below must not be added together.

## Hosted observations from merged changes

| Change | Evidence | Interpretation |
| --- | --- | --- |
| HTML worker bundling, [#2754](https://github.com/beep-effect/beep-effect/pull/2754) | Citation package: 1,334.86 s to 919.94 s, the same 141 files and 975 passing tests; whole unit-d job: 1,590 s to 1,243 s | Observed 31% shorter package execution and 22% shorter job duration on different runs; not a controlled whole-PR comparison |
| Scheduling and setup, [#2766](https://github.com/beep-effect/beep-effect/pull/2766) | Property Laws: 1,165.11 s to 590.91 s, the same 116 files and 4,152 tests; whole job: 1,245 s to 692 s | Different runners; the final run is an observation, not an isolated attribution to one scheduling change |
| Bounded native dependency setup, #2766 | Explicit update/install timeouts and failure-path controls | Bounds a previously observed hour-long setup hang; no normal-install speedup claim |
| Proof reuse, [#2767](https://github.com/beep-effect/beep-effect/pull/2767) | Same-head install retry: 23,044 ms to 93 ms; eligible docgen resume omitted a previously measured 55.516 s command | Local proof reuse, not a hosted CI percentage; identity and expiry constraints remain |

Detailed methods and limitations are recorded in the
[CI follow-up report](ci-efficiency-followup-2026-11-06.md),
[test scheduling report](ci-test-scheduling-2026-11-06.md), and
[proof reuse report](yeet-proof-reuse-2026-11-06.md).

## Why a documentation PR still executed unit tests

[PR #2769](https://github.com/beep-effect/beep-effect/pull/2769) changed ten
documentation and exploration paths. Its event supplied an older base commit,
while GitHub checked out a temporary merge containing newer main changes.
Comparing that older base with the temporary merge included unrelated code.
The shell classifier therefore selected code verification.

This was actual execution, not merely required check names appearing in the UI.
All ten unit jobs succeeded and consumed 6,697 combined runner-seconds, or
111.6 runner-minutes. Unit-d lasted 1,229 seconds. One CLI shard executed
1,222 tests across 63 files. The run is
[42234450380](https://github.com/beep-effect/beep-effect/actions/runs/42234450380).

[PR #2774](https://github.com/beep-effect/beep-effect/pull/2774) separates the
classification inputs from the verification checkout. Classification uses the
event's pinned PR base and head; code verification still uses the merge
checkout. Unknown references conservatively retain full checks. Disabling
rename detection retains the deleted source path when code is renamed into
documentation. Required check names can remain as fast successful no-ops.

The local regression covers a newer main commit, a synthetic merge checkout,
code changes, deletions, renames, missing references and push events. Its 68
tests passed. The fix merged at 17:29 UTC as
`0b1d20050fce435b6029881fb4bb0beeaa2e4251` after hosted coverage and strict
review gates passed. This documentation PR supplies the subsequent hosted
skip check; the 111.6 runner-minutes above are the faulty run's cost, not
measured savings.

## Sequential audit findings

The first round ran Fable 5.1, Opus 5.5 and GPT-6.1 Sol at xhigh in separate
sessions. Findings were independently checked and implemented before the next
auditor. The round found actionable work, so it did not meet the bounded
no-new-findings stop condition.

| Finding | Accepted implementation | Evidence boundary |
| --- | --- | --- |
| Repeated source fingerprints | [#2773](https://github.com/beep-effect/beep-effect/pull/2773) shares a freshly checked boundary between sequential reusable steps | Three executed commands need four hashes instead of six; three resumed hits need one instead of three. Live commands and failures invalidate the boundary. No measured end-to-end percentage |
| Serial source discovery | [#2772](https://github.com/beep-effect/beep-effect/pull/2772) bounds coverage source-discovery concurrency at two | Same 12 packages and 168 sources: 9.55/7.34 s serial versus 4.93/3.58 s parallel. The 48–51% reduction applies to that component |
| Late package lint failures | [#2779](https://github.com/beep-effect/beep-effect/pull/2779) runs package lint before the full audit | 26 tests and full package verification passed. Green runs pay an extra lint invocation; deliberately delayed fixtures establish early exit, not production savings |

The successful #2772 run after [repair #2776](https://github.com/beep-effect/beep-effect/pull/2776)
verified 190 packages and 192 unique test invocations, matching the successful
baseline population. The comparison step fell from 383 s to 333 s, and the
whole job from 443 s to 387 s: observed reductions of 13.1% and 12.6%.
The new inventory, artifact verification and baseline comparison phases took
149.687 s, 176.828 s and 1.394 s respectively. The baseline lacked phase timings.
Both runs used Node 22.23.4, Bun 1.4.4 and Ubuntu 24.04, but source revisions,
hardware, filesystem warmth and cache-server behavior were not controlled.
This is a successful hosted observation, not a controlled causal estimate.

The [successful candidate run](https://github.com/beep-effect/beep-effect/actions/runs/42253555179)
and [successful baseline](https://github.com/beep-effect/beep-effect/actions/runs/42220674884)
retain their own manifests. An earlier candidate run failed inherited
OwnerCheckpoint coverage; its timings are not substituted for successful proof.
Repair #2776 added refusal/race tests and removed two unreachable paths without
reducing coverage floors. Fingerprint refinement #2773 subsequently merged at
16:50 UTC after current-head hosted coverage and strict merge checks passed.
Coverage concurrency #2772 merged externally at 17:05 UTC as
`49661c889c2dd52e36e31450647a8163e29a868f`. Package preflight #2779 also passed current-head hosted coverage and all ten
unit groups; its review window and merge are separate acceptance steps.

Round-two Fable proposed three more candidates:

- **Unchanged inbox state:** accepted only the small change that avoids
  replacing an identical session file. Two thousand controlled hook calls
  found roughly 3 ms clear-path median savings and no two-second timeouts.
  Every invocation still evaluates inbox rows and time-dependent waiver
  expiry. Input caching and narrowing tool matching were rejected.
- **Duplicate full lint scans:** use the existing scope resolver, explicitly
  request a full policy run when appropriate, and omit only equivalent
  standalone scans already included in it. Affected or uncertain scope keeps
  the guards. The extra scope/config probe measured 94.95 ms median across
  five calls; that excludes CLI startup and establishes no net elapsed gain.
- **Broad cheap-check reuse:** rejected. Some supported cache policies depend
  on independently changing approvals and expiry. The accepted safeguard
  makes that check non-reusable; it is a correctness boundary, not a speedup.

Round-two Opus found repeated abandoned account-usage polling at session start.
The implementation uses the existing snapshot on that hot path and stages
completed account reports, preserving timestamps and independent provider
inventory. A controlled synthetic provider measured a roughly two-second
interrupted live block versus a 2.064 ms median cached block. That is mechanism
proof, not measured production session-start savings. The 96 focused tests and full CLI and Palantiri package verification passed.
The clean local commit is unpublished; hosted proof remains pending.

Opus also proposed running the two session projection writers concurrently.
The final fixed-source confirmation measured 1.136953 s serial versus
0.657681 s parallel median across twenty alternating runs per variant, with
118 byte-identical outputs. The 479.272 ms reduction missed the prespecified
500 ms threshold, so the candidate was rejected and the serial hook retained.
Parallel execution also overlaps process memory; individual peak sums do not
measure simultaneous peak RSS.

Those local follow-ups remain distinct from published and hosted proof. The
audit sequence is still active and does not establish repository-wide
exhaustion.

## Rejected shortcuts and operating lessons

An index copied for hashing missed an assume-unchanged control; the fresh
temporary index remains necessary. Cross-commit install reuse missed lifecycle
inputs outside the manifest digest. A tiny same-root module-cache benefit did
not establish a useful fleet cache: different checkout roots missed, and
network cost remained unmeasured. No required test population, coverage floor,
review condition, or independent artifact inventory was removed.

Three historical integration attempts lost AWS Spot runners without a test
verdict. Missing logs and runner termination are not assertion failures. The
successful repair run is separate evidence; it does not rewrite those
historical outcomes. Automatic paid capacity fallback remains outside this
work.

A missing tool-session handle does not prove its child process ended. Inspect
the owned process tree and durable job registry before replacing a monitor.
Use one monitor per PR and batch a complete fix wave into one push. Preserve
receipts before retiring merged or superseded lanes.

For future audits, begin with compact timing and failure summaries, identify
the exact revision and workload, and then inspect the relevant source. A
historical timeout count or an unlabelled metric is a lead until independently
verified. Separate implementation, local controls, hosted acceptance and
measured savings in every handoff.
