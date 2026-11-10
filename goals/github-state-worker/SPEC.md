# GitHub State Worker Spec

## Objective

Run one GitHub reader per host so that the same PR fact is fetched once per cycle, not once per consumer. A
per-host systemd user worker (built from the `ObservationWorker` template) reads the tracked PR set with one
aliased GraphQL fingerprint document per 25 PRs, fetches detail (rollup + review threads + merge state) only for
PRs whose fingerprint changed, routes REST through a conditional-request (ETag) `fetch` layer in
`packages/drivers/github`, and publishes atomic PR-keyed snapshots. Yeet monitor, `ready`, `merge-gate`,
`--watch`, gate-table, the orchestrator watchers and a new `--cached` status read consume those snapshots and fall
back to a direct read when the worker is absent or the snapshot is stale. The worker obeys the 15% reserve signal
published by [`github-budget-ledger`](../github-budget-ledger/SPEC.md), and the saving is proven by that ledger's
before/after numbers.

Source exploration: [`explorations/github-api-quota`](../../explorations/github-api-quota/README.md) — [`BRIEF.md`](../../explorations/github-api-quota/BRIEF.md) (normative
shape, item 2 of the solution sketch), [`MAP.md`](../../explorations/github-api-quota/MAP.md) (goal 2 and its capability check),
[`DECISIONS.md`](../../explorations/github-api-quota/DECISIONS.md), [`RESEARCH.md`](../../explorations/github-api-quota/RESEARCH.md).

## Non-Goals

- The budget ledger, `/rate_limit` sampler, `github-headroom` parcel and `gh` spawn attribution: owned by
  [`github-budget-ledger`](../github-budget-ledger/SPEC.md). This goal consumes its reserve signal and numbers.
- Switching the worker to the beep-fleet-orchestrator App installation token, widening
  `.github/workflows/rerun-runner-loss.yml`, and reversing the 2026-10-31 ruling: owned by
  [`yeet-monitor-app-identity`](../yeet-monitor-app-identity/SPEC.md). This goal reads on the user token, but keeps
  the token source behind `LoadCredential=` so goal 3 swaps only the credential.
- Webhook receivers, public ingress, or App hook-config management (gated candidate `github-webhook-intake` in
  the exploration's `MAP.md`).
- Fleet-wide shared state or cross-host polling; each host reads only its own tracked set (gated
  `github-fleet-sharing`).
- Patching the t3code fork or having T3 read the snapshots (gated `t3-snapshot-consumer`).
- Replacing merge-gate with GitHub's native merge queue (stays in `explorations/github-merge-queue`).
- A `gh` shim on PATH, and creating extra GitHub Apps or tokens to multiply buckets.
- Weakening any gate's evidence: a snapshot never replaces the head-pinned authoritative read before a merge.
- Caching `gh` subprocess spawns; leftover spawns are attributed by goal 1, not cached here.

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

- `packages/drivers/github` (`@beep/github`):
  - NET-NEW conditional-request `fetch` wrapper beside `src/Resilience.ts` and `src/internal/octokit.ts`
    (reaches the main and pagination Octokit at `internal/octokit.ts:240-249,369`), exposed through
    `TransportOptions.fetch`.
  - `src/GraphQL.ts`: NET-NEW typed fingerprint document (aliased, 25 PRs per document: head oid, `updatedAt`,
    mergeability, rollup state) and detail document (rollup + review threads + mergeState).
- `packages/tooling/tool/cli` (`@beep/repo-cli`):
  - `src/internal/github/GithubIdentity.ts` (`GithubTransportFetch`): wire the ETag layer into the CLI transport.
  - `src/internal/github/GraphqlBudget.ts`: gate worker cycles on goal 1's reserve signal.
  - `src/commands/AIMetrics/internal/ObservationWorker.ts`, `ObservationDeployment.ts`: template for the
    GitHub-state worker and its deployment (extended or generalised, not copied blindly).
  - `src/commands/Yeet/internal/Status.ts` (`writeYeetStatusSnapshot`, `:1729`), `Status.schemas.ts`,
    `MonitorLoop.ts` (`:2131`): host-scoped, PR-keyed, atomic snapshot; the monitor stops polling.
  - `src/commands/Yeet/internal/PrSessionRegistry.ts`: tracked PR set.
  - Readers: `ReadyGate.ts`, `MergeGate.ts`, `WatchMode.ts`, `GateTable.ts` in `src/commands/Yeet/internal`, plus
    the `status --cached` command surface.
  - Tests under `packages/tooling/tool/cli/test/` and `packages/drivers/github/test/`.
- `packages/tooling/library/repo-cli-kit/src/systemd/SystemdUnit.ts`: reuse for the unit; extend only if
  `LoadCredential=` rendering is missing.
- `.claude/skills/yeet/` and `.claude/skills/orchestrate/` (including `gate.sh` and the watcher scripts): point
  agents and watchers at the cached read.
- This packet (`goals/github-state-worker/`).

No new workspace package is planned. If the SPEC's store decision moves the worker into its own package, it is
bootstrapped only through `bun run beep create-package`.

## Constraints

- **Design order:** schema first (snapshot, fingerprint, tracked-set, ETag-entry and worker-config schemas with
  `effect/Schema` and `@beep/schema` `LiteralKit`), then the `Context.Service` contracts (worker, snapshot store,
  conditional fetch), then implementation. Effect v4 only, validated against `.repos/effect`; `effect/HashMap` /
  `HashSet`, never native `Map`/`Set`; `Effect.fn`/`Effect.fnUntraced` for generator functions; effect/http, never
  `node:http`.
- **Credentials (ruling 39):** the token reaches the worker only through `LoadCredential=` (or the 1Password agent
  route). No token in the unit environment, argv, logs or snapshots.
- **Snapshot store (rabbit hole, decide in P0):** file per PR (Palantiri `writePrivateFile` / `retainLastGood`
  pattern, matches the inbox) or a per-host SQLite table (`OwnerCheckpoint.store` CAS + history). Repo-cli tests run
  on Node and Bun, so SQLite needs a client per runtime; do not reach for `@beep/sqlite` directly. Record the call
  as a decision file.
- **Snapshot shape:** atomic write (temp + rename), keyed by repo + PR, carrying head SHA, writer generation and
  `createdAt`. Readers accept a snapshot only when its head SHA matches what they expect and its age is within the
  `Freshness` bound (about 2x the cycle); otherwise they read directly. The flock singleton means no reader lease;
  a dead worker shows as snapshot age or a missing socket.
- **Worker:** flock singleton, unix socket at 0600, systemd user service. Tracked set = PRs with a local owner in
  `PrSessionRegistry` or a live consumer request, plus every open PR in the repository when the per-host
  `allOpen` config is on (the hub only).
- **GraphQL cost:** no 304 path; nested connections multiply cost; rate-limit errors can arrive as HTTP 200.
  Measure `rateLimit { cost }` for the detail query before fixing its shape, and record the number.
- **ETag layer:** a port of Prow ghcache (Apache-2.0) with attribution in the file header and in
  `research/SOURCES.md`: revalidate every hit, `no-store` for errors and every `/graphql` request, partition by
  token lineage (ETags appear to depend on `Authorization`; expect one full 200 per resource after an App-token
  rotation), coalesce concurrent identical GETs. It sits at `fetch`, below octokit, because `@octokit/request`
  throws on 304. Whether a 304 costs a secondary point or concurrency slot is undocumented: cap the revalidation
  rate and space requests (ghproxy pattern).
- **Reserve:** background reads (worker cycles, and the monitors' and watchers' direct-read fallbacks) back off
  below 15% fleet-wide remaining for their identity x resource bucket (goal 1's signal) until the reset; the merge-critical head-pinned re-read and operator-direct commands may go to 1.
  Remaining counts are approximate: keep margin, not exact arithmetic.
- **`gh` spawns bypass the driver:** migrating the monitor's reads to the in-process client is in scope; leftover
  spawns stay attributed (goal 1), not cached.
- **merge-gate:** snapshot-first hold (no API call while checks are pending or the review window is open), then
  exactly one authoritative head-pinned re-read before the merge.
- Repo-cli tests must pass on Node and Bun; Effect tests via `@effect/vitest`.
- Packet rule: at most three open PRs across this packet's lanes.

## Acceptance Criteria

- [ ] P0 records decision files for the snapshot store, the freshness bound, the cycle cadence, the ETag
      partition key and the before/after reduction target, and records the measured `rateLimit { cost }` of the fingerprint and detail documents.
- [ ] `packages/drivers/github` ships a conditional-request `fetch` layer: a revalidated hit returns the cached body
      on 304; errors and `/graphql` are never stored; partitions are separate per token lineage; Prow attribution
      is present. Covered by focused tests.
- [ ] The GitHub-state worker installs as a systemd user unit with `LoadCredential=`, holds a flock singleton,
      serves a 0600 unix socket, and refuses a second instance (tested).
- [ ] One worker cycle over N tracked PRs issues `ceil(N/25)` fingerprint documents and detail reads only for PRs
      whose fingerprint changed (tested with a recorded fake transport).
- [ ] Snapshots are written atomically, keyed by repo + PR, with head SHA, generation and `createdAt`; a reader
      rejects a head mismatch or an over-age snapshot and falls back to a direct read (tested).
- [ ] Monitor (stops polling while a fresh snapshot exists), `ready`, `merge-gate`, `--watch`, gate-table, the
      orchestrator watchers and `beep yeet status --cached` read snapshots; with the worker stopped, each one still
      works by direct read.
- [ ] merge-gate performs zero API calls on a held attempt with a fresh snapshot, and exactly one authoritative
      head-pinned re-read before merging (tested).
- [ ] The worker backs off below the 15% reserve signal from goal 1 and resumes after reset (tested).
- [ ] The readers' direct-read fallback obeys the same signal: with the worker absent or the snapshot stale and
      the bucket below 15%, the monitor and the orchestrator watchers back off until reset instead of reading,
      while merge-gate's head-pinned re-read and operator-direct commands (`status --cached` fallback, `ready`)
      still read (tested per reader class).
- [ ] The yeet and orchestrate skills steer agents to `status --cached` over raw `gh pr view` / `gh pr checks`.
- [ ] **Measured before/after with goal 1's ledger** on the hub: per-hour REST and GraphQL spend attributed to
      monitor, merge-gate, watch, gate-table and watchers over two windows of at least 24 h each with a similar
      open-PR count (within 20%), before (worker off) and after (worker on), worker spend included in the after
      window. Recorded under `history/` with the ledger output. The reduction target is binding: P0 sets it as a
      decision file from goal 1's baseline (a minimum percentage drop in combined Yeet polling spend per resource),
      and this criterion fails if the after window misses it.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/github-state-worker/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/github-state-worker/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/github-state-worker` | Passes |
| Driver package | `bun run beep quality package-verify @beep/github` | Passes |
| CLI package | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| ETag layer tests | `bunx vitest run packages/drivers/github/test/transport.test.ts` plus the new conditional-fetch test file | Passes |
| Worker and observation template (Node) | `bunx vitest run packages/tooling/tool/cli/test/ai-metrics-observation-deployment.test.ts` plus the new github-state worker test file | Passes |
| Worker and observation template (Bun) | `cd packages/tooling/tool/cli && bunx --bun vitest run test/ai-metrics-observation-deployment.test.ts` plus the new github-state worker test file | Passes |
| Snapshot readers (Node) | `bunx vitest run packages/tooling/tool/cli/test/yeet-merge-gate.test.ts packages/tooling/tool/cli/test/yeet-ready-gate.test.ts packages/tooling/tool/cli/test/yeet-watch-mode.test.ts packages/tooling/tool/cli/test/yeet-gate-table.test.ts packages/tooling/tool/cli/test/yeet-monitor-loop.test.ts packages/tooling/tool/cli/test/yeet-monitor-rate-limit.test.ts packages/tooling/tool/cli/test/yeet-pr-session-registry.test.ts` | Passes |
| Snapshot readers (Bun) | `cd packages/tooling/tool/cli && bunx --bun vitest run test/yeet-merge-gate.test.ts test/yeet-ready-gate.test.ts test/yeet-watch-mode.test.ts test/yeet-gate-table.test.ts test/yeet-monitor-loop.test.ts test/yeet-monitor-rate-limit.test.ts test/yeet-pr-session-registry.test.ts` | Passes |
| Decision log | `bun run beep goals decisions check --slug github-state-worker` | No drift |
| Packet doctor | `bun run beep goals doctor` | No blocking finding for this packet |
| Final gate | `bun run beep yeet final-check` | Passing receipt for the PR head |
| Before/after | goal 1 ledger output, worker off vs on, saved under `history/` | Recorded; reduction stated |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add github-state-worker --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug github-state-worker`; add a `kind: decision` file there, never edit this block._

### Ad-hoc agent gh calls: steer to a cached status read through skills, 2026-11-09

Add `beep yeet status --cached` that reads the worker snapshot, and update the yeet and orchestrate skills to prefer it over raw `gh pr view` / `gh pr checks`. Raw gh stays allowed; goal 1's attribution shows whether steering is enough. A gh shim on PATH was rejected.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.

Reverse: Revert the yeet and orchestrate skill edits; the status --cached command can stay as an unused read.

### Appetite: this goal is goal 2 of 3, about two weeks across the packet set, 2026-11-09

Three goal packets in about two weeks, at most three open PRs at once: (1) ledger and attribution, (2) this per-host worker with batched GraphQL, the ETag layer in drivers/github and the snapshot readers, (3) read-only monitor on the App identity.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.

Reverse: Re-shape the remaining scope through the exploration's MAP.md and record the change as a new decision.

### merge-gate is a snapshot consumer only, 2026-11-09

merge-gate holds with no API call while checks are pending or the review window is open, then does one authoritative head-pinned re-read before merging. Adopting GitHub's merge queue stays in explorations/github-merge-queue. Saves about 13-17 to 2-3 REST per held attempt.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.

Reverse: Remove the snapshot-first hold so merge-gate reads GitHub directly on every attempt again.

### Package homes: ETag layer in drivers/github, worker and readers in repo-cli, 2026-11-09

The conditional-request (ETag) layer and rate-limit handling go in `packages/drivers/github` beside `Resilience.ts` and `internal/octokit.ts`, exposed through `TransportOptions.fetch`. The per-host worker, PR snapshot and Yeet readers go in `packages/tooling/tool/cli`; parcels in `packages/tooling/library/palantiri`. Rationale: driver-boundary standard lists transport helpers as driver concerns; automation routes to tooling.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.

Reverse: Move the conditional-fetch layer into packages/tooling/tool/cli/src/internal/github and drop it from @beep/github.

### Reader: a dedicated per-host systemd GitHub-state worker, 2026-11-09

A systemd user service built from the `ObservationWorker` template: flock singleton, unix socket at 0600, token through `LoadCredential=`. It reads every tracked PR in batched GraphQL plus ETag-revalidated REST and publishes PR-keyed snapshots that monitor, ready, merge-gate, watch, gate-table and the orchestrator scripts read, with a direct-read fallback. A monitor-held lease was rejected because merge-gate, gate-table and watchers run without a monitor.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.

Reverse: Stop and disable the worker unit; readers already fall back to direct reads, restoring today's per-consumer polling.

### Reserve: background reads back off below 15% of the shared bucket, 2026-11-09

Background reads (worker cycles, monitors, watchers) back off once goal 1's fleet-wide remaining for their identity's bucket falls below 15% (750 of 5,000) per resource until the reset. The monitors' and watchers' direct-read fallbacks obey it too; merge-gate's head-pinned re-read and operator-direct commands do not. Interactive and merge-critical reads may go down to 1. 15% sits above T3's 10% background floor so T3 sweeps keep running; remaining counts are approximate, so margin is required.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.

Reverse: Change the reserve threshold in the worker config (or set it to 0 to disable).

### Scope: one reader per PR per host, no fleet-wide state, 2026-11-09

Each host runs one reader per PR. Hosts coordinate only through goal 1's ledger, which reads the free `GET /rate_limit` for true fleet-wide usage. Fleet-wide state and webhook-first were rejected.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.

Reverse: Introduce a fleet-shared snapshot store and single cross-host reader (reopen the exploration at decompose via the github-fleet-sharing gate).

### Tracked PR set: local owners, plus every open PR on the hub, 2026-11-09

Each host reads PRs with a local owner in `PrSessionRegistry` or a live consumer request. The orchestrator host also reads every open PR in the repository for gate-table, merge-gate and the watchers. The all-open flag is per-host configuration. All-open everywhere would cost about 6x.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.

Reverse: Set the per-host allOpen flag off on the hub (or on everywhere) in the worker config.

### Webhooks stay a gated later goal, not built here, 2026-11-09

No receiver, public ingress or hook-config management in this goal. Gate: after goals 2 and 3 land, the ledger still shows the user bucket above about 60% average use, or event latency becomes the bottleneck. The worker is where a receiver would land later.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.

Reverse: Reopen explorations/github-api-quota at decompose when the github-webhook-intake gate fires.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
