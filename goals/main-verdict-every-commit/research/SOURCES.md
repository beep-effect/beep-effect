# Main Verdict Every Commit — Sources & Provenance

- **Source exploration:** `explorations/ten-minute-certainty` — primary ledger:
  `explorations/ten-minute-certainty/research/SOURCES.md`.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `host-01-row` | HOST-01 A hosted verdict for every main commit, staged (rank 1, tier T0) | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md` (row 1, heading "HOST-01") | main verdicts | adopt, staged by D7 |
| `host-01-merged` | HOST-01 mechanism, savings, both skeptics, runnable gate | in-repo | `explorations/ten-minute-certainty/research/phase2/merged/hosted-ci.md` (heading "HOST-01") | main verdicts | adopt, except the per-SHA slice and the gate's 95% projected main-SHA coverage term (handed to merge-queue-activation, D28) |
| `host-01-slice-a` | Forbid cancelling `refs/heads/main` runs (AGENTS.md and orchestrate skill) | in-repo | `AGENTS.md:198-202`, `.claude/skills/orchestrate/SKILL.md:255,261` | policy | adopt (open) |
| `host-01-slice-b` | Throughput partition layout for main push runs | in-repo | `.github/workflows/check.yml:721-818` (push branch at `:798`) | layout | adopt (open; #3030 kept full push allocation) |
| `host-01-slice-c` | Re-dispatch missing or cancelled main verdicts | in-repo | `.github/workflows/rerun-runner-loss.yml`, `packages/tooling/tool/cli/src/commands/Ci/RunnerLossRerun.ts:28-32` | re-dispatch | adopt (open) |
| `host-01-slice-d` | Per-SHA Check concurrency group for main pushes | in-repo | `.github/workflows/check.yml:12-14` | concurrency | handed off: folded into `merge-queue-activation` (`verdict-placement`, D28) |
| `verdict-placement` | The merge group is the per-commit main verdict | in-repo | `explorations/github-merge-queue/DECISIONS.md` (`verdict-placement`, `sequencing-against-ten-minute-certainty`) | scope | adopt: this goal provides the layout and replay |
| `critique-ceiling` | Job-adding levers share the unverified ~60-job ceiling | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md` ("Cross-area critique", conflicts and "numbers without a primary source") | order | adopt: the replay counts landed levers (D19) |
| `critique-cost` | Per-SHA cost: ~9.7k claimed vs 20 to 36k recomputed; docs-only skip share unmeasured | in-repo | same section | cost | quoted with caveat; now bears on `merge-queue-activation` |
| `critique-rollback` | No CI-YAML lever names a tested revert; App token cannot merge workflow PRs | in-repo | same section ("missing from the plan") | rollback | adopt: each workflow slice names its revert and merger |
| `meas-prereq-replay` | Replay of main merge timestamps against the 60-job ceiling and cap-2 heavy pool | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md` ("Measurement prerequisites") | gate | adopt (slice 2; published for `merge-queue-activation`) |
| `lane-econ-not-changed` | 82 of 100 main push runs cancelled, nine of twelve sampled started no job; per-SHA left for its own decision | in-repo | `goals/ci-lane-economics/SPEC.md` ("Not changed") | baseline | cited as newer evidence |

## 2. Upstream repositories & licenses

None. No lever takes code or a pattern from an upstream repository.

## 3. External research sources

None. The exploration ledger lists no external source for HOST-01; the ~60 concurrent hosted-job figure is
the documented GitHub Team default, recorded in the exploration as unverified.

## 4. In-repo capability references

| Brick | Path | Verdict |
|---|---|---|
| Check workflow concurrency | `.github/workflows/check.yml:12-14` | read only: re-dispatch works around the shared main group |
| Test Plan job, push branch | `.github/workflows/check.yml:721-818` (24 + 20 partitions at `:739-740`; shard timeouts 20 min at `:825`, `:1014`) | extend: throughput layout |
| Heavy identity resolution | `.github/workflows/check.yml:149`, caller at `:214`, `.github/workflows/heavy.yml` | reuse: record beside each verdict; two-PR rule for changes |
| Partition tables and plans | `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts`, `CiPartitions.service.ts`, `CiPartitions.schemas.ts`, `packages/tooling/tool/cli/vitest.shards.json` | extend: push layout (owned by ci-lane-economics for PRs) |
| Runner-loss rerun | `.github/workflows/rerun-runner-loss.yml`, `packages/tooling/tool/cli/src/commands/Ci/CiRerunRunnerLoss.ts`, `RunnerLossRerun.ts` | reuse the pattern: bounded attempts, head gate, summary |
| Workflow policy lint | `packages/tooling/tool/cli/src/commands/Ci/CiGovernance.ts:385-392` | keep passing |
| Hosted job and step reads | `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts` | reuse for the replay |
| PR-head-only cancels | `packages/tooling/tool/cli/src/commands/Yeet/internal/MergeGate.ts` (`cancelMergedHeadRuns`), `packages/tooling/tool/cli/src/commands/Yeet/internal/GhOps.ts` (`cancel-queued`) | unchanged: cannot reach main SHAs |
| Required contexts | `standards/branch-protection-contexts.json` | reuse: what a verdict covers |
| Heavy merge proof | `docs/runbooks/ci-hosted-settings.md` ("Heavy workflow merge proof") | reuse for any `heavy.yml` slice |
| Runner reliability runbook | `docs/runbooks/ci-runner-reliability.md` | amend with re-dispatch |
| Tests | `packages/tooling/tool/cli/test/ci-governance.test.ts`, `ci-rerun-runner-loss.test.ts`, `ci-partitions.test.ts`, `ci-lane.test.ts`, `ci-lane-timings.test.ts` | extend |

## 5. Cross-links & provenance

- Source exploration: [`README.md`](../../../explorations/ten-minute-certainty/README.md),
  [`BRIEF.md`](../../../explorations/ten-minute-certainty/BRIEF.md),
  [`MAP.md`](../../../explorations/ten-minute-certainty/MAP.md),
  [`DECISIONS.md`](../../../explorations/ten-minute-certainty/DECISIONS.md) (D2, D7, D9, D11, D19, D28).
- Requires: [`goals/certainty-scorecard`](../../certainty-scorecard/README.md) (`ci/certainty-scorecard`).
- Consumed by: `merge-queue-activation` in
  [`explorations/github-merge-queue/MAP.md`](../../../explorations/github-merge-queue/MAP.md) (layout and replay);
  lab goal [`goals/merge-queue-lab`](../../merge-queue-lab/README.md).
- Counted in the replay when landed (D19): job-removing levers of
  [`goals/hosted-setup-tax`](../../hosted-setup-tax/README.md) and [`goals/heavy-pool-diet`](../../heavy-pool-diet/README.md).
- Siblings: [`goals/route-soundness-repair`](../../route-soundness-repair/README.md),
  [`goals/local-proof-under-ten`](../../local-proof-under-ten/README.md) (PERIL-09 in `AGENTS.md`, PERIL-10 in the orchestrate skill).
- Related goals: [`goals/ci-lane-economics`](../../ci-lane-economics/README.md) (PR partitions, #3030, #3040, #3043),
  [`goals/yeet-monitor-app-identity`](../../yeet-monitor-app-identity/README.md) (runner-loss classifier, 3a),
  [`goals/verification-route`](../../verification-route/README.md) (reads main's latest push run).
- Shipped precursors: #3005, #3007, #3029, #3030, #3040, #3043, #3046 (layouts and timeouts this goal's push runs inherit).
