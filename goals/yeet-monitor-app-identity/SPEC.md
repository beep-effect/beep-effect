# Yeet Monitor App Identity Spec

## Objective

Make the Yeet monitor a read-only consumer, then move the host's GitHub polling
load off the shared user bucket onto the beep-fleet-orchestrator App
installation bucket. Two steps:

- **3a, read-only monitor.** Widen
  [`.github/workflows/rerun-runner-loss.yml`](../../.github/workflows/rerun-runner-loss.yml)
  and its `beep ci rerun-runner-loss` classifier to cover every
  environment-only signature the monitor reruns today (`YeetMonitorFlakeClass`:
  `ts2589-no-location`, `ci-timeout`, `setup-5xx`, `runner-loss`,
  `install-failure`; `MonitorLoop.ts` ~213-275). Reruns then spend
  `GITHUB_TOKEN` (1,000/h per repo, shared by every workflow, ample for rare
  reruns), and the monitor's own rerun write path (`rerunJob`,
  `POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun`) is removed.
- **3b, App identity.** The per-host GitHub-state worker from
  [`goals/github-state-worker`](../github-state-worker/README.md) reads on an
  App installation token minted in-process through
  `packages/drivers/github/src/GitHubApp.ts` (cached, early-refreshed
  installation tokens). The App credential reaches the worker only through
  systemd `LoadCredential=`. A recorded decision reverses the 2026-10-31
  orchestrator ruling "never bridge the App token into yeet monitor".

The ledger from [`goals/github-budget-ledger`](../github-budget-ledger/README.md)
proves the move: polling load leaves the user bucket and appears on the App
bucket.

Origin: [`explorations/github-api-quota`](../../explorations/github-api-quota/README.md)
([BRIEF](../../explorations/github-api-quota/BRIEF.md) step 3,
[MAP](../../explorations/github-api-quota/MAP.md) goal 3,
[DECISIONS](../../explorations/github-api-quota/DECISIONS.md) "identity").

## Non-Goals

- Creating extra GitHub Apps or tokens to multiply buckets (BRIEF no-go). Only
  the existing beep-fleet-orchestrator App is used, and the beep-reviewer App
  stays separate.
- Moving censuses, polling or any read loop into Actions. The `GITHUB_TOKEN`
  bucket is shared by every workflow; only rare reruns move there.
- Tokens in unit environments or argv (ruling 39), a `gh` shim on PATH, or an
  askpass-style credential bridge.
- Giving the App identity to the monitor's interactive writes or to operator
  commands. `yeet gh checks rerun-failed`, `yeet reply`, merges and
  merge-gate's head-pinned merge keep their current identities.
- Fleet-wide shared state, cross-host polling, webhook receivers, public
  ingress, or App hook-config management (gated in MAP:
  `github-webhook-intake`, `github-fleet-sharing`).
- Patching the t3code fork (gated: `t3-snapshot-consumer`).
- Replacing merge-gate with GitHub's merge queue
  (`explorations/github-merge-queue`).
- Sibling scope: the budget ledger, attribution, `github-headroom` parcel and
  reserve signal belong to `github-budget-ledger`; the worker itself, the
  snapshot store, the ETag layer, the batched GraphQL documents and the
  snapshot readers belong to `github-state-worker`. This goal only changes the
  worker's credential source and identity tag.
- Weakening any gate's evidence. A snapshot never replaces the head-pinned
  authoritative read before a merge.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

3a, read-only monitor:

- `.github/workflows/rerun-runner-loss.yml` (triggers, job permissions, the
  `beep ci rerun-runner-loss` step).
- `packages/tooling/tool/cli/src/commands/Ci/RunnerLossRerun.ts` and
  `CiRerunRunnerLoss.ts` (classifier widened from runner-loss to the full
  environment-only domain).
- `packages/tooling/tool/cli/src/internal/github/JobShape.ts` (shared shape
  classes `setup-5xx`, `runner-loss`, `install-failure`).
- `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts`
  (`YeetMonitorFlakeClass` and its log fingerprints move to
  `packages/tooling/tool/cli/src/internal/github/FlakeClass.ts`, beside
  `JobShape.ts`, so the workflow command and the monitor share one classifier;
  `rerunJob` and its applier are removed; the decision becomes a report). The
  same file is edited by `github-state-worker` (polling stop and read
  migration): whichever PR lands second merges `main` first.
- `docs/runbooks/ci-runner-reliability.md` ("Automatic runner-loss rerun").

3b, App identity:

- The GitHub-state worker and its deployment module as landed by
  `github-state-worker` (template:
  `packages/tooling/tool/cli/src/commands/AIMetrics/internal/ObservationWorker.ts`,
  `ObservationDeployment.ts`).
- `packages/tooling/library/repo-cli-kit/src/systemd/SystemdUnit.ts` (reuse
  for `LoadCredential=`; extend only if a credential directive is missing).
- `packages/drivers/github/src/GitHubApp.ts` (reuse; no change expected).
- `packages/tooling/tool/cli/src/commands/Github/` (existing `github app mint`
  command; reuse its credential decode).
- Ledger identity tagging and the per-identity `/rate_limit` sampler from
  `github-budget-ledger` (reuse: this goal adds the App installation to the
  ledger's configured identities, with no ledger code change).
- The yeet and orchestrate skills' references and `docs/ops/` notes that state
  which identity the monitor and worker use.

No new workspace package is expected. If one is needed, it is bootstrapped
with `bun run beep create-package`.

## Constraints

- **Schema-first, Effect v4.** Model the identity choice (`app` | `user`), the
  credential file shape and any new decision type as schemas first
  (`LiteralKit` for literal domains), then `Context.Service` contracts, then
  implementation. Validate Effect APIs against `.repos/effect`.
- **Ruling 39.** The App private key and installation token never appear in a
  unit `Environment=`, argv, logs or the ledger. The worker reads the App
  credential from `$CREDENTIALS_DIRECTORY` (systemd `LoadCredential=` or
  `LoadCredentialEncrypted=`), populated through the 1Password agent route.
- **Installation tokens rotate hourly.** Mint and refresh in-process with
  `GitHubApp` cached tokens; never write a minted token to disk. Expect one
  full 200 per ETag resource after each rotation (ETags appear to depend on
  `Authorization`, undocumented); the ETag partition key follows token
  lineage as `github-state-worker` defines it.
- **No silent identity swap.** A mint or permission failure surfaces as a
  degraded worker state and readers fall back to direct reads (today's cost).
  The worker never quietly drops to the user token; the user identity is an
  explicit per-host configuration value.
- **Least privilege.** Request installation tokens with read-only permissions
  (checks, pull requests, contents, actions read, statuses) and check them
  with `assertPermissions`.
- **The App bucket is shared** with the orchestrator's own App use. The 15%
  reserve from `github-budget-ledger` applies per identity and resource: the
  App bucket gets its own sampler and reserve signal once this goal configures
  the App identity in the ledger, and the worker backs off on the App signal,
  not the user one (decision "reserve applies per identity").
- **`GITHUB_TOKEN` is 1,000/h per repo, shared.** The widened workflow reads
  job logs only for failed jobs of a failed run, and keeps its existing head
  gate, per-job bound and attempt ceiling. The monitor's "one rerun per job
  per head SHA" bound must survive the move.
- **Workflow security posture holds.** `workflow_run` still checks out only
  the default branch, executes no pull-request code and receives no secrets.
  A widened trigger list names each workflow explicitly.
- **Every widening of the flake domain is a decision.** The workflow command
  admits exactly the monitor's current classes; adding one needs a decision
  file with evidence.
- **Repo-cli tests run on Node and Bun.** Use `NodeServices` and Effect's
  process API, no `Bun` global; prove with the Node coverage command as well
  as `beep:test`.
- **Sequencing.** 3a starts after `github-budget-ledger` lands and may run
  alongside `github-state-worker`; 3b starts only after `github-state-worker`'s
  worker and 3a have merged. The manifest `requires` lists both edges:
  `github/budget-ledger` gates 3a, `github/pr-snapshot` gates 3b.
- **Appetite.** This goal's share of the two-week, three-goal appetite; at most
  three open PRs across the three packets.

## Acceptance Criteria

- [ ] 3a: `bun run beep ci rerun-runner-loss` decides all five
      `YeetMonitorFlakeClass` signatures from a run's jobs, annotations and
      (for log fingerprints) job logs, with unit tests per class, the head
      gate, the per-job bound and the attempt ceiling.
- [ ] 3a: P0 records, as a decision file, the enumerated list of workflows
      whose jobs the monitor reruns today (the workflow currently triggers on
      `[Check, Heavy Admit]`); `rerun-runner-loss.yml` names exactly that list
      in `workflow_run.workflows`, and keeps job-level `actions: write`,
      `checks: read`, `contents: read`, `pull-requests: read` only.
- [ ] 3a: The monitor makes no GitHub write for reruns:
      `rg -n "actions/jobs/\{job_id\}/rerun" packages/tooling/tool/cli/src -g '!**/commands/Ci/**'`
      returns nothing, a unit test shows the monitor's GitHub client issues no
      POST during a cycle that matches every flake class, and the monitor
      reports a matched flake as owned by Rerun Runner Loss instead of
      rerunning it.
- [ ] 3a: At least one workflow rerun of a monitor-class failure on
      `GITHUB_TOKEN` is linked in `history/`: a natural hosted flake, or, if
      none occurs within the goal window, a seeded proof: a deliberately failed
      `Check` or `Heavy Admit` run on a throwaway PR whose job carries a
      monitor-class signature, with its decision and rerun recorded. (Not a
      `workflow_dispatch` run: neither listed workflow has that trigger, and
      `heavy.yml`'s own dispatch is a main-only run named "Heavy", which is not
      listed.) Either way, the failed run must belong
      to a workflow listed in `rerun-runner-loss.yml`'s `workflow_run.workflows`,
      and the rerun decision and the rerun itself must come from
      `rerun-runner-loss.yml` through its `workflow_run` trigger, not from a
      manual or out-of-band rerun.
- [ ] 3b: The worker reads with an App installation token minted from a
      `LoadCredential=` credential; its unit file has no token or key in
      `Environment=` or `ExecStart=` (checked by a unit-render test).
- [ ] 3b: A decision file reverses the 2026-10-31 ruling "never bridge the App
      token into yeet monitor", with reversal "point the worker back at the
      user token" (set the per-host identity to `user`).
- [ ] 3b: The ledger samples the App installation's `/rate_limit` as a
      configured identity and publishes its own reserve signal; a test shows
      the worker backs off on the App signal while the user bucket is healthy
      and vice versa.
- [ ] 3b: Measured before/after from the `github-budget-ledger` ledger over
      windows of at least 24 h each with an open-PR count within 20%; the
      before window is `github-state-worker`'s after window (worker on the
      user identity). Recorded in `history/`, it passes when:
      - 100% of worker rows carry the App identity;
      - user-identity rows from monitor, ready, merge-gate, watch, gate-table
        and the orchestrator watchers are at most 10% of their count in the
        before window, and every such row is a tagged direct-read fallback
        (the fallbacks still spend the user token and are the counted
        residual);
      - the fleet `/rate_limit` user `used` peak per resource is at most the
        before-window peak minus 80% of the worker's before-window spend on
        that resource.
- [ ] A mint failure leaves the worker degraded and readers on direct reads,
      covered by a test; no fallback to the user token without configuration.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/yeet-monitor-app-identity/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/yeet-monitor-app-identity/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/yeet-monitor-app-identity` | Passes |
| Rerun classifier (Bun) | `cd packages/tooling/tool/cli && bunx --bun vitest run test/ci-rerun-runner-loss.test.ts test/yeet-monitor-loop.test.ts test/yeet-wave-rerun.test.ts` | Passes |
| Worker identity (Bun) | `cd packages/tooling/tool/cli && bunx --bun vitest run test/ai-metrics-observation-deployment.test.ts test/github-app-mint.test.ts` plus the worker tests `github-state-worker` lands | Passes |
| Node runtime | `cd packages/tooling/tool/cli && bunx vitest run --coverage --exclude='test/integration/**'` | Passes |
| Monitor write removed | `rg -n "actions/jobs/\{job_id\}/rerun" packages/tooling/tool/cli/src -g '!**/commands/Ci/**'` | No match |
| Decision log | `bun run beep goals decisions check --slug yeet-monitor-app-identity` | No drift |
| Package handoff | `bun run beep quality package-verify @beep/repo-cli` (and `@beep/repo-cli-kit`, `@beep/github` if touched) | Passes |
| Final gate | `bun run beep yeet final-check` | Passing receipt for the head |
| Quota evidence | Ledger before/after report in `history/` | User-bucket polling moved to the App bucket |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add yeet-monitor-app-identity --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug yeet-monitor-app-identity`; add a `kind: decision` file there, never edit this block._

### Appetite: one of three goals in about two weeks, at most three open PRs, 2026-11-09

Answer: the redesign is three goal packets (ledger, per-host worker, read-only monitor on the App identity) in about two weeks, with at most three open PRs at once across them. This goal is the third; 3a starts after github-budget-ledger and may overlap github-state-worker, 3b waits for github-state-worker and 3a. Webhooks, T3 changes and fleet sharing stay behind MAP gates. Source: exploration `explorations/github-api-quota/DECISIONS.md`, entry 'appetite'.

Reverse: Re-shape the appetite in the exploration and record a superseding decision

### No extra GitHub Apps or tokens to multiply buckets, 2026-11-09

Answer: only the existing beep-fleet-orchestrator App installation is used for the worker's reads; no new App, PAT or installation is created to gain buckets, and the beep-reviewer App stays separate. Rationale: the BRIEF no-go and RESEARCH.md Constraints (minting Apps only to multiply buckets is a no-go unless the App has a real purpose). Source: exploration `explorations/github-api-quota/DECISIONS.md`, entry 'identity' (rationale) and ../../explorations/github-api-quota/BRIEF.md No-gos.

Reverse: An operator ruling that admits a new App with its own real purpose, recorded as a superseding decision

### Package homes: drivers/github for transport, tooling for worker and readers, 2026-11-09

Answer: rate-limit handling and transport helpers stay in packages/drivers/github (GitHubApp.ts reused unchanged); the worker, its deployment and credential wiring, the monitor change and the rerun classifier live in packages/tooling/tool/cli, with systemd units through packages/tooling/library/repo-cli-kit. Rationale: standards/architecture/03-driver-boundaries.md:54 and 07-non-slice-families.md:42. Source: exploration `explorations/github-api-quota/DECISIONS.md`, entry 'package homes'.

Reverse: Move the code to the agreed package and record a superseding decision

### Identity: read-only monitor on the App bucket, after the reader, 2026-11-09

Answer: widen .github/workflows/rerun-runner-loss.yml to the monitor's environment-only rerun signatures so reruns spend GITHUB_TOKEN and the monitor never writes; then the per-host worker reads on the beep-fleet-orchestrator App installation token delivered by LoadCredential=. This doubles headroom without new Apps. Rejected: keeping the user identity (leaves a free bucket unused) and deciding only after measuring (measurement sets timing, not direction). Source: exploration `explorations/github-api-quota/DECISIONS.md`, entry 'identity: read-only monitor on the App bucket, after the reader'.

Reverse: Restore the monitor's rerunJob write path and keep the worker on the user token

### Reserve applies per identity: the App bucket gets its own sampler and signal, 2026-11-09

Answer: the 15% background reserve applies per identity x resource. When 3b configures the beep-fleet-orchestrator App installation as a ledger identity, github-budget-ledger's per-identity sampler reads the App's `/rate_limit` and publishes a separate reserve signal for it; the worker backs off on the App signal, not the user one, and readers that fall back to direct reads on the user token keep obeying the user signal. The exploration decided the 15% threshold for the shared user bucket only; extending it per identity keeps the App bucket (shared with the orchestrator's own App use) from being driven to 0 and keeps one bucket's state from throttling the other. Source: exploration `explorations/github-api-quota/DECISIONS.md`, entries 'reserve: 15% of the shared bucket' and 'identity'.

Reverse: Point the worker back at the user identity's reserve signal and remove the App identity from the ledger's configured identities.

### Reverse the 2026-10-31 ruling: never bridge the App token into yeet monitor, 2026-11-09

Answer: the 2026-10-31 orchestrator ruling (orchestrator HANDOFF.md) forbade bridging the App token into yeet monitor because the monitor merged (App lacked Workflows permission), spawned raw gh reads, and reran jobs. Once 3a moves reruns to Rerun Runner Loss and the polling reads run in the github-state worker on the in-process client, none of those reasons applies to the reader. The App token is minted in-process by GitHubApp.ts from a LoadCredential= credential; it is never given to monitor writes, merges or operator commands. Takes effect only when 3b lands. Source: exploration `explorations/github-api-quota/DECISIONS.md`, entry 'identity'; RESEARCH.md Constraints.

Reverse: Point the worker back at the user token (set the per-host worker identity to user)

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
