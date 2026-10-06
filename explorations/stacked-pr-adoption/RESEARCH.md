# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-10-05 — Recommendation (read this first)

**Short answer.** Adopt native stacks only for real dependency chains, and
do not expect them to fix the 2026-10-05 burn-down. Native stacks make the
informal stacks we already run honest: every layer gets the required
matrix, GitHub owns the retarget, and the whole stack merges atomically from
the top. They do not let a child skip the re-run after its base merges alone,
and they cannot model a fan-out (twelve independent PRs waiting on one fix).
On 2026-10-05 stacking would have saved about 50–150 of 2,308 Heavy
runner-minutes (2–6%). The larger waste, and the starvation of #1436, came
from admitting Heavy for PRs that could not merge while `main` was red.

Ranked recommendations (none applied in this task):

1. **Agent rule, no tooling change: stack, don't copy; hold, don't label.**
   - A lane that needs another open PR's code stacks on it as a native stack
     layer (`gh stack link`) instead of merging that PR's branch, which
     #1429, #1435 and #1444 did.
   - A lane blocked only by red `main` does not merge the unblocker in and
     does not apply `ready-for-heavy` until the unblocker lands.
   - Inside the #1436 unblock window, PRs other than the unblockers burned
     546 runner-minutes while the unblockers' Heavy jobs waited 28–41
     minutes in the queue.
2. **Yeet stack slice (the next goal).**
   - `yeet publish --stack-on <pr>` creates the PR with the right base and
     links it into a native stack.
   - Split today's single `--base` into *trunk*, which keys rulesets and
     closeout, and *parent*, which keys affected planning and freshness.
   - Add a stack-level ready verdict and merge stacks only from the top.
   - Detailed in §4.
3. **CI changes, which need an operator ruling.**
   - *Main-red admission hold*: Heavy returns `hold` for PRs other than a
     declared unblocker while `main`'s required checks are red. This is the
     biggest lever.
   - *Top-of-stack Heavy*: lower layers report Heavy satisfied without work;
     the top layer's merge ref proves the union. This is only safe if
     Yeet/agents merge stacks from the top.
4. **No merge queue yet.** The ship-velocity E8 flip condition is ≥80%
   non-cancelled `main` push success over 14 days. Today's window is 22.5%
   (32 / 142). The queue is free for this public org repo, and stacks are
   queue-aware, so revisit when the gate clears.
5. **No third-party stack tool.**
   - Graphite needs an org-installed GitHub App, and its merge queue is in
     paid tiers only.
   - ghstack's synthetic `gh/*/base` branches dodge our `branches: [main]`
     filters and the merge button.
   - spr collapses a stack into one PR at merge.
   - git-town is a compatible local helper through `gh stack link`, but it
     is optional.

## 2026-10-05 — Q0: why #1433 and #1442 got required checks

Nothing changed in the triggers. `.github/workflows/check.yml:4-5`,
`.github/workflows/storybook.yml:4-5` and `.github/workflows/heavy-admit.yml:14-17`
still filter `pull_request` on `branches: [main]`. The last edit to
`check.yml` is #1380 (strict shadcn lint), unrelated to triggers.

The runs come from Yeet opening every PR against the default branch and a
human or agent retargeting it seconds later:

| PR | created | Check/Storybook run on head | base changed to `goals/push-first-publish` |
| --- | --- | --- | --- |
| #1433 | 21:55:19Z | 21:55:23Z on `795a688e9c` | 21:55:37Z |
| #1442 | 23:37:18Z | 23:37:23Z on `b45f8c884b` | 23:37:33Z |

(`gh api repos/beep-effect/beep-effect/issues/<n>/timeline`, events
`base_ref_changed`; `actions/runs?branch=<head>`.)

Yeet's PR creation passes no `--base`
(`packages/tooling/tool/cli/src/commands/Yeet/internal/PullRequest.ts:422`),
so `gh pr create` targets `main`. The `opened` event fired while the base was
`main`, so the full required suite and the Heavy matrix started. The retarget
fired `edited`, which these workflows ignore, and runs already in flight were
not cancelled. #1433's later push (`31f2894708`, 22:31Z) had **no** workflow
runs: only Vercel, Greptile and one skipped third-party check. This is the
behaviour the memories describe.

So the coverage was accidental, not intended. The REST `pulls/<n>` objects for
#1427, #1433, #1442 and #1444 carry no `stack` object, so these were informal
base-branch chains, not native stacks.

## 2026-10-05 — Q1: does native stacking run the matrix once and avoid the re-run?

External facts (full citations in
[`research/SOURCES.md`](./research/SOURCES.md) §3):

- **Every layer runs trunk CI.** GitHub documents that Actions workflows
  trigger as if each PR in the stack targets the stack's base, so
  `branches: [main]` fires for every layer. Required checks, reviews and
  CODEOWNERS are evaluated against the stack base, not the direct parent.
  The 2026-08-27 E7 trial confirmed this live on this repo: top layer #860
  registered every one of the 17 contexts then required
  (`goals/ship-velocity/research/stacked-pr-trial.md:17-22`).
- **Bottom-only merge ⇒ children are rebased ⇒ full re-run.** When the bottom
  PR merges alone, GitHub rebases the next layer onto the trunk and retargets
  it. The head is rewritten, and the docs say CI is re-triggered. Which
  `pull_request` activity this emits is not documented (UNVERIFIED; expected
  `synchronize` for the force-push plus `edited` for the base).
- **Atomic top merge ⇒ no re-run.** Merging the top PR lands every layer
  below it in one operation, as *n* squash commits. No child is rebased, so
  nothing re-runs. This is the only path where "run once, never again" holds.
- **Only bottom-up merges.** A mid-stack PR cannot merge in isolation.
  Auto-merge is unsupported, and API merges must use the async merge
  endpoint.
- **Linear only.** Stacks cannot branch, so twelve PRs waiting on #1436 could
  only become a twelve-deep serial chain, which is worse than today.
- **Server-side rebase commits are unsigned.** The `main` ruleset here has
  only `deletion`, `non_fast_forward`, `pull_request` and
  `required_status_checks` rules (`gh api repos/beep-effect/beep-effect/rules/branches/main`),
  so unsigned rebases are not blocked.

**Answer.**

- *Yes*, a child runs the required matrix against the stack: its merge ref
  contains the parent.
- *No*, it does not avoid the re-run after the base lands, unless the base
  and child land together through a top merge.
- *Cost note*: with today's CI, every layer head buys a full Heavy matrix
  (about 52 runner-minutes; table below). A three-layer stack pays three
  matrices per round unless Heavy is gated on `pull_request.stack.position`
  (recommendation 3).

## 2026-10-05 — Q2: Heavy-runner time on 2026-10-05

Window `2026-10-05T00:00Z..2026-10-06T06:00Z`. Source: every Check and Heavy
Admit run (`gh api repos/beep-effect/beep-effect/actions/runs?created=...`,
519 runs total), their jobs (`actions/runs/<id>/jobs?filter=all`), and jobs
labelled `beep-ec2-heavy`. Runner-minutes are `completed_at − started_at`,
counted only for jobs that got a runner. The Actions API keeps a
`started_at` on jobs that never left the queue, so jobs without a
`runner_name` are excluded.

| Bucket | Runner-min | Share |
| --- | ---: | ---: |
| PR heads that are the final/current head | 999 | 43% |
| `main` pushes | 618 | 27% |
| PR heads later superseded by a push | 497 | 22% |
| Cancelled after starting | 193 | 8% |
| **Total executed** | **2,308 (38.5 h)** | |

- 602 Heavy jobs were created; **275 never got a runner** (queued, then
  cancelled or superseded).
- Queue wait for jobs that ran: p50 20 min, p90 38 min, max 49 min.
- Heavy matrix per head, average runner-minutes per lane:
  - Coverage Regression 20.1
  - Lint Policy 16.8
  - Docgen 3.8
  - Check 3.6
  - Test Integration 3.0
  - Doctest 2.7
  - Build 2.4
  - Total ≈ **52 runner-min**, about 20 min of wall time once admitted.
- Heads that were merge commits (main, or another PR's branch, merged in):
  308 runner-min, 18% of PR Heavy time. By PR: #1411 110, #1427 100, #1428
  45, #1429 27, #1435 26.
- **Unblock window**, from #1436 opening (23:05:58Z) to #1435 merging
  (00:48:29Z), which carried #1436's content to main; #1436 was then closed
  as superseded:
  - Other PRs executed 546 Heavy runner-min, the two unblocker branches 89,
    and `main` 57.
  - The unblockers' Heavy jobs waited 28–41 min each for a runner.
  - 104 Heavy jobs from other PRs were queued in that window and never ran.

What stacking would have saved:

| Pattern on 2026-10-05 | Heavy runner-min observed | With native stack + top merge |
| --- | ---: | --- |
| #1429, #1435 merged `origin/fix/osv-postcss-selector-parser` (copy instead of stack) | 53 on the copy heads, plus 67 on #1436's own heads, which became redundant when #1436 closed as superseded | One matrix per layer head; saves about 50–120 |
| #1433, #1442 informal layers on #1427 | 102 (63 + 39, 26 of it cancelled), run only through the accidental `opened`-on-`main` event | Every layer runs anyway; saves 0 but makes coverage intentional |
| #1427 merging `main` (long-lived base PR) | 100 | 0: a stack does not remove the base-refresh tax on the bottom layer |
| Fan-out: about 12 PRs blocked by red `main` | 546 in the unblock window alone | 0: stacks are linear; this needs an admission hold |

**Estimate: roughly 50–150 runner-min (2–6% of the day).** Main-red
admission hold targets the 546 runner-min burned in the unblock window and
most of the 275 jobs that never ran. It also removes the 28–41 min queue
wait on the PR that everyone else was waiting for.

Measurement scripts and raw TSVs are reproducible from the queries above.
They were not committed, because they are regenerable and the run list
includes branch names only.

## 2026-10-05 — Q3: Yeet and agent changes to stack by default

Where Yeet assumes `base = main` today:

| Surface | Location | Assumption | Stack change |
| --- | --- | --- | --- |
| PR creation | `Yeet/internal/PullRequest.ts:422`, planner preview `Yeet/internal/Planner.ts:576` | `gh pr create` with no `--base`, so the default branch | `--stack-on <pr>` passes `--base <parent-branch>` and links the PR into a native stack (`gh stack link` or the Stacks REST API) |
| `--base` flag | `Yeet/Yeet.command.ts:75-78` | one ref (`origin/main`) for affected planning *and* ruleset reads | split into **trunk** (rulesets, closeout, sweep) and **parent** (affected planning, freshness) |
| Required contexts | `Yeet/internal/Settle.ts:295-346` | reads `rules/branches/<base>`; a non-`main` parent returns zero rules (confirmed: `goals/push-first-publish` returns `[]`), so a stacked layer's expected contexts are empty | always read the trunk (`pull_request.stack.base.ref`) |
| Stale-base guard | `Yeet/internal/PublishScope.ts:882-917`; skill step 2b `.claude/skills/yeet/SKILL.md:27-53` | freshness and overlap measured against `origin/main` | measure the layer against its parent and the stack against trunk; remediation becomes `gh stack sync`, not "merge origin/main" |
| Base-conflict remediation | `Yeet/internal/Settle.ts:1420`; `SKILL.md:492-495` | "merge origin/main and push" | for a layer, rebase or sync the stack |
| No-rebase law | `SKILL.md:51-53` | published branches never rebase or force-push | GitHub force-pushes child layers after a partial merge; the lane must re-sync (`gh stack sync`, or `git reset` to the remote head) instead of merging |
| Readiness and merge | `monitor --until-ready` verdict per head | one PR equals one merge | a stack verdict (every layer `merge-ready`), then one top merge via the async endpoint |
| Sweep | `Yeet/internal/Sweep.ts:677-680` | trunk is `main` | unchanged; `--retire` already refuses until the PR is MERGED, and a top merge marks every layer merged |

Agent workflow change (skill text, no code):

- A dependent fix lane branches from the unblocking PR's head and publishes
  as a layer on it. It never merges that branch in.
- When the unblocker merges alone, GitHub retargets the layer. When both are
  green, merge from the top.
- The E7 deferral still applies: Yeet binds proof, lease and verdict to one
  head (`goals/ship-velocity/research/stacked-pr-trial.md:44-54`). The slice
  above is the "explicit stack artifact that proves and monitors every head
  independently" that the deferral names as its revisit condition.

## 2026-10-05 — Q4: risks

- **Squash merges drop late pushes.** A top merge lands *n* squash commits
  atomically, so a push to any layer after the merge starts is silently
  lost. The single-PR version of this is recorded in operator memory as
  `squash-merge-drops-pushes-after-merge`. Mitigations:
  - Yeet holds a lease over every layer head during a stack merge.
  - After the merge, run the existing per-fix content-fingerprint check on
    each layer.
  - Check `state` before every late push. A post-merge push re-creates the
    deleted branch.
- **Partial-merge rebase invalidates proof.** A bottom-only merge rewrites
  every child head, so any local proof, Greptile score or Heavy verdict
  bound to the old SHA is stale. Treat it as a new head, and prefer top
  merges.
- **Review bots on stacked diffs.**
  - Layer diffs are smaller. Ruling 21 rejected one bundled PR because
    "Greptile goes blind past 500 files"
    (`explorations/beep-ci-operational-ontology/DECISIONS.md:1027-1036`).
  - Every server-side rebase is a new head, so bots re-review it. Old
    threads become outdated but still gate until resolved (AGENTS.md
    "Mergeable").
  - Whether Greptile and Codex review the layer diff or the trunk diff is
    UNVERIFIED. Bots stay advisory either way.
- **The `ready-for-heavy` label is per PR.**
  - With today's CI, every layer must carry the label, or its `Heavy / *`
    contexts never report and the stack cannot merge. Unlabelled code
    PRs get `hold` (`packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts:315-321`).
  - A partial-merge rebase on a labelled layer re-admits the full matrix
    automatically.
  - A top-only Heavy policy changes this: label only the top layer and
    satisfy lower layers. That needs workflow work, plus a rule that
    lower layers never merge alone. Otherwise a lower layer could land
    proven only by the union with the layers above it, which is not proof
    of the subset; the `main`-push Heavy would catch it after the merge.
- **Docs-only skip rules.**
  - Admission computes `changedPaths` against `GITHUB_BASE_REF`
    (`.github/workflows/check.yml:84`, `HeavyAdmission.ts:355-368`).
  - For a stack layer, that is probably the parent branch (UNVERIFIED:
    the docs say workflows trigger *as if* targeting trunk, but not which
    `base_ref` they see). If so, a docs-only layer above a code layer gets
    `skip-satisfied`, which is sound only while the code layer below
    carries its own Heavy proof.
  - If `base_ref` is the trunk instead, every layer sees the cumulative
    diff, and the docs-only skip will never apply above a code layer.
  - Verify this in the first live stack before any policy depends on it.
- **The preview can change.** Native stacks are public preview. Merge-queue
  support for stacks was rolled out progressively, and the docs contradict
  each other on whether a failed stack merge can stop partway. Keep stack
  use manual and reversible (`gh stack unstack`) until GA.
- **The merge queue stays off.** Workflows already list `merge-group` as an
  admission source (`HeavyAdmission.ts:328-333`), but speed-loop #62 records
  that commitlint and gitleaks pass vacuously under `merge_group`
  (`goals/speed-loop/research/OPPORTUNITIES.md:684-690`). The E8 gate is
  unmet: 22.5% against 80%.

## In-Repo Capability Inventory

- Prior trial and decision: `goals/ship-velocity/PLAN.md:140-147`;
  `goals/ship-velocity/research/stacked-pr-trial.md` (E7, `gh stack` v0.1.0,
  #859/#860, deferral at :44-54); `goals/ship-velocity/research/merge-queue-evaluation.md`
  (E8 80% gate at :9, decision at :56-60).
- Earlier rejections, each now partly obsolete:
  - `explorations/agent-pipeline-velocity/DECISIONS.md:12-16` and
    `BRIEF.md:50`: one merge event preferred. That is still valid for a
    single goal PR.
  - `explorations/beep-ci-operational-ontology/DECISIONS.md:1027-1036`
    (Ruling 21): "required checks skip until the base merges". That is
    true for informal stacks and false for native stacks.
  - `BRIEF.md:260` and `MAP.md:226`: no merge queue (E8).
- Planned items in ledgers:
  - `goals/speed-loop/research/OPPORTUNITIES.md:57` (#80, spike first),
    `:207` (#22 merge queue), `:684-690` (#62 `merge_group` parity), and
    `:966-978` (#80 detail: decision-49 gate; Yeet stale-base, sweep and
    `--pr` riders).
  - `goals/time-to-certainty/research/OPPORTUNITIES.md:1940-1950`: B8
    ruling numbers collide across stacked branches.
  - `goals/time-to-certainty/research/OPPORTUNITIES.md:2000-2008`: a
    stacked branch went `CONFLICTING` after a squash, read as
    `settle-timeout`.
  - `goals/time-to-certainty/research/OPPORTUNITIES.md:1107`,
    `goals/lexical-playground-capability-atlas/research/OPPORTUNITIES.md:23`
    and `goals/packet-convention-migration/research/OPPORTUNITIES.md:627`:
    merge-queue asks.
  - `goals/effect-vitest-canon/research/OPPORTUNITIES.md:2255`: skipped
    checks on a stacked PR are not readiness.
  - `research/ledger`: no stacking or merge-queue claims (NOT FOUND).
- Admission brick: `packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts`
  (`run` / `skip-satisfied` / `hold`, label and docs-only rules). Main-red
  hold would extend `sourcesFor`/`verdictFor`; no such input exists today
  (NOT FOUND).
- Stack-aware Yeet: NOT FOUND (`rg -n stack packages/tooling/tool/cli/src/commands/Yeet`
  returns no stack model).

## Constraints Discovered

- Task constraint: no CI, ruleset or Yeet changes here; everything above is
  a proposal for align.
- Existing subscriptions only. Native stacks and the merge queue cost
  nothing extra for a public org repo. Graphite's merge queue would need a
  paid tier and an org-installed app.
- Native stacks are linear and public preview; their webhook activity on
  retarget and their `base_ref` for Actions are undocumented and must be
  verified live.
- `main` health gates the merge queue: 32 successes, 110 failures and 86
  cancellations among `check.yml` push runs from 2026-09-21 to 2026-10-05.
