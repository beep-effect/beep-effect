---
title: "Pull-request runs diff against the merge commit's first parent, not the event base sha"
date: 2026-11-13
lane: "fix/ci-pr-base-first-parent"
reversal: "git revert the PR's squash commit: check.yml returns to BEEP_COVERAGE_BASE_SHA and --base; a workflow-only revert also runs on the new CLI"
---

**Evidence.** Test Plan, Test Unit, Labs and Coverage Regression passed
`--base "$BEEP_COVERAGE_BASE_SHA"` (`pull_request.base.sha || github.sha`)
while checking out the synthetic merge commit. GitHub records `base.sha`
from the pull request; when main moves before it creates the merge, the
merge's first parent is newer and `base.sha...HEAD` counts main's commits
as the pull request's own. Hosted run 43386625727 (PR #3228) checked out
`bc319bbe9 Merge 71bc76f9 into 97afc3ae` with the base at `13303191`: 49
changed files instead of 10, a full coverage fallback from #3215's
workflow edits, and 24 Test Unit partitions where 9 were needed. Of 87
pull-request Check runs on 2026-11-13 (03:46Z to 08:05Z), 23 had
`base.sha` different from the merge's first parent; replaying the new
base on their exact merge commits shrank 5 of the 18 that
ran the planner, saving 65 of the window's 1,327 planned partitions (4.9%);
4 of its 47 full-matrix runs were this defect (replay table in the PR).

**What changed.** `beep ci lane --event-base` (`CiEventBase.ts`) resolves
the base once per job from event facts (`GITHUB_EVENT_NAME`, `GITHUB_SHA`,
`BEEP_CI_PR_BASE_SHA`, `BEEP_CI_PR_HEAD_SHA`) and the checkout: the
merge's first parent when HEAD is `GITHUB_SHA` with exactly two parents,
the second being `pull_request.head.sha`. The four call sites pass
`--event-base`; `BEEP_COVERAGE_BASE_SHA` is gone. Coverage identity
(`baseSha`) and the comparator's floors and self-judge scope move with
the affected scope: identity is only compared for equality between
producers and the comparator, and the floors at the merged base are
the floors of the code under test.

**What was kept.** When the proof fails the base stays
`pull_request.base.sha`, the old behaviour: it is an ancestor of the
merged base, so it never selects less than the pull request's own diff
and only costs runner time. A pull request with neither fails the lane
instead of diffing against itself; push runs keep `GITHUB_SHA`.
Stability across jobs and re-runs holds because `GITHUB_SHA` is fixed
per run: the checkout fetches that exact sha, and run 43374964920's
attempt 2 re-executed a shard after main moved four commits and still
checked out `fb5ab903 Merge 6b162016 into d8326d55`. The other affected
lanes (`origin/<base>...HEAD`) were already right: on every replayed
merge, `git merge-base origin/main <merge>` equals its first parent.

**Revert (tested).** `git revert` of the squash commit restores the
variable, the four `--base "$BEEP_COVERAGE_BASE_SHA"` call sites and the
contract assertion. `--base` keeps its meaning in the new CLI, so a
workflow-only revert also runs: the replay's old leg (`--base <base.sha>`
on the new CLI) reproduced run 43386625727's 24-partition plan.
