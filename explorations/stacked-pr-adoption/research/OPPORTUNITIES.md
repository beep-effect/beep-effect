# Opportunities & Friction Receipts

Dated receipts recorded while the work happened. Paths are repo-relative; no
machine or session identifiers.

## 2026-10-05 — Yeet opens stacked lanes against `main`, so CI coverage is accidental

- **Doing:** explaining why #1433 and #1442 (base `goals/push-first-publish`)
  had required check runs although every PR workflow filters
  `branches: [main]`.
- **Evidence:**
  - Both PRs were created against `main` and retargeted 10–18 s later
    (`issues/<n>/timeline` `base_ref_changed`).
  - Check and Storybook started on the `opened` event.
  - #1433's later push `31f2894708` got no workflow runs.
  - `Yeet/internal/PullRequest.ts:422` calls `gh pr create` without
    `--base`.
- **Would have prevented it:** `yeet publish --stack-on <pr>`, or at least
  a `--base` pass-through, and native stack linking, so a layer's CI is
  intentional rather than an artifact of the first seconds after `opened`.

## 2026-10-05 — Actions API loses the PR link and hides never-started jobs

- **Doing:** attributing 2026-10-05 Heavy runner-minutes to PRs.
- **Evidence:**
  - `actions/runs` returns an empty `pull_requests` array for runs whose
    PR has since merged or closed, so runs had to be mapped by branch
    through `gh pr list --head`.
  - `jobs` keeps a `started_at` for jobs that never got a runner: 275 of
    602 Heavy jobs had no `runner_name`. Naive duration sums doubled the
    total, 4,921 against 2,308 real runner-minutes.
- **Would have prevented it:** a `beep ci` report that joins runs to PRs by
  head branch and counts only jobs with a runner. The ci-lane-economics
  census is the natural home.

## 2026-10-05 — The unblocking PR waited behind PRs that could not merge

- **Doing:** measuring the #1436 unblock window (23:05Z–00:48Z).
- **Evidence:**
  - The unblocking branches' Heavy jobs waited 28–41 min for a runner,
    while other PRs executed 546 Heavy runner-minutes in the same window.
  - 104 other Heavy jobs were queued and never ran.
  - About 9 runs were cancelled by hand.
- **Would have prevented it:** a main-red admission hold (Heavy `hold` for
  every PR except a declared unblocker while `main`'s required checks are
  red), or a priority lane for the unblocker. Recorded as a recommendation
  in `../RESEARCH.md`; it needs an operator ruling.

## 2026-10-05 — Inherited cheap-gate reds block a docs-only publish

- **Doing:** publishing this docs-only packet with `yeet verify --tier cheap-gates`.
- **Evidence:** `lint:schema-first` (`SFV4-arbitrary-tests` on
  `packages/tooling/tool/cli/test/yeet-sweep-retire.test.ts`) and
  `lint:effect-vitest` (5 new findings in that file and in
  `packages/foundation/modeling/schema/test/PatternOntology.test.ts`) failed
  on files this branch never touched. Both came from `origin/main`. The full
  pre-push proof inside `yeet publish` would refuse the same way, so the
  packet went out by plain commit, push and draft PR, and hosted checks are
  the gate.
- **Would have prevented it:** cheap gates that scope repo-law lints to the
  branch diff for docs-only changes, or a main-red flag that marks such
  failures inherited automatically.
