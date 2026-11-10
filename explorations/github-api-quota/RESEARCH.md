# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

All dated 2026-11-09. The detailed, adversarially verified write-ups are in [`research/`](./research/):

| File | What it holds |
| --- | --- |
| [`2026-11-09-reduction-plan.md`](./research/2026-11-09-reduction-plan.md) | The first ranked plan (S1–S9 structural, H1–H10 hotspots, O1–O8 operational) |
| [`2026-11-09-review-code-claims.md`](./research/2026-11-09-review-code-claims.md) | Refuting review of the plan's code claims, with file:line evidence |
| [`2026-11-09-review-platform-claims.md`](./research/2026-11-09-review-platform-claims.md) | Refuting review of the plan's GitHub platform claims, checked against docs.github.com |
| [`2026-11-09-external-landscape.md`](./research/2026-11-09-external-landscape.md) | Prior art: Prow ghproxy/ghcache, octokit throttling/retry, gh caching, webhook delivery, Mergify, Bors, Renovate |
| [`2026-11-09-t3-code-pr-sweeps.md`](./research/2026-11-09-t3-code-pr-sweeps.md) | What T3 Code's PR sync and watch sweeps cost per host |
| [`2026-11-09-in-repo-bricks.md`](./research/2026-11-09-in-repo-bricks.md) | Existing shared-state, cache, daemon and event bricks, with a reuse/extend/NET-NEW verdict per candidate |

## Measurements (2026-11-09)

- **The shared bucket ran dry.** All six fleet hosts (DankStation, beep-worker, dankserver, tbk-worker, tom-pc-1-wsl,
  grok-bot) authenticate `gh` as one user. That user's REST core bucket hit 5000/5000 at 21:31Z, and every call
  returned 403 until 21:42Z.
- **Burn after the reset.** `gh api rate_limit` (free on the primary limit), sampled every 30 s for 10 minutes with
  2–3 detached monitors running: about **1,540 REST/h and 430 GraphQL points/h**. The first 5 minutes after the reset
  ran at about 50/min.
- **App bucket.** The beep-fleet-orchestrator App installation token showed its own bucket at core 29/5000, GraphQL
  0/5000, while the user bucket was empty.
- **`gh` requests per command** (`GH_DEBUG=api`, gh 2.103.3, a clone with 3 remotes and no default repo set):
  - `gh pr view <n> --json state` sends **1** GraphQL request, with or without `GH_REPO`.
  - `gh pr checks <n>` sends **2** real GraphQL requests (`PullRequestByNumber`, `PullRequestStatusChecks`) plus 2
    feature-detection queries that gh answers from its local 24 h cache (`X-Gh-Cache-Ttl: 24h`, answered in µs).
  - **This refutes plan item H2/O1** (a RepositoryNetwork lookup on every spawn). Drop it.
- **Conflict to resolve before sizing anything.** The plan estimated 720–1,440 GraphQL/h per monitor at a 30 s poll.
  The 430/h fleet-wide sample with 2–3 monitors running contradicts that. Per-poll GraphQL cost is unmeasured;
  attribute it before sizing goals.

## External Landscape

Full detail and licenses are in [`research/2026-11-09-external-landscape.md`](./research/2026-11-09-external-landscape.md).

- **Kubernetes Prow `ghproxy`/`ghcache` (Apache-2.0)** is the closest prior art for "many bots, one quota". It is a
  local reverse-proxy cache that every Prow component shares. It works as follows:
  - Every hit is revalidated with a conditional request (a 304 is free).
  - Errors and every `/graphql` request are `no-store`.
  - The cache partition is `sha256(Authorization)`, kept separate from the throttling budget id.
  - Concurrent identical GETs are coalesced.
  - Each response carries an `X-Cache-Mode` that says whether it cost a token.
  - Requests are spaced per budget, with a hard max delay.
  - Disposition: port the design with attribution.
- **GitHub's own guidance:**
  - Use conditional requests; an authorized 304 does not count against the primary limit.
  - Subscribe to webhooks instead of polling.
  - Handle 403 and 429.
  - GraphQL rate-limit errors can come back as HTTP 200.
  - Treat `x-ratelimit-remaining` as approximate.
- **@octokit/plugin-throttling and plugin-retry (MIT).** They implement the primary/secondary-limit waits. Gaps:
  throttling does not catch a GraphQL secondary limit returned as 200, and `@octokit/request` throws on a 304, so
  an ETag layer has to sit below octokit, at `fetch`.
- **`gh api --cache`.** It is a local TTL cache with no ETag revalidation. It is fine for metadata and wrong for live
  PR state.
- **Webhooks to a local machine.** Options are a single receiver (Tailscale Funnel or a self-hosted smee) plus a
  reconciler. GitHub does not redeliver failed deliveries automatically, and manual redelivery only covers 3 days.
  `gh webhook forward` is a single-holder dev tool.
- **Mergify (one consumer per org stream, batched)** and **Bors**: Bors was archived in favour of GitHub's native
  merge queue. Both point to "one reader per budget" and to retiring custom merge polling. The native merge queue
  already has its own packet: [`explorations/github-merge-queue`](../github-merge-queue/README.md).
- **Renovate (AGPL-3.0)** does ETag revalidation with stale-if-error. Clean-room only.

## In-Repo Capability Inventory

Full detail is in [`research/2026-11-09-in-repo-bricks.md`](./research/2026-11-09-in-repo-bricks.md) and
[`research/2026-11-09-review-code-claims.md`](./research/2026-11-09-review-code-claims.md).

| Candidate | Best existing base (package / path) | Verdict | NET-NEW part |
| --- | --- | --- | --- |
| C1 one GraphQL query per poll | `YeetStatusRemote` (`cli/src/commands/Yeet/internal/Status.ts`), typed documents in `packages/drivers/github/src/GraphQL.ts`, `cli/src/internal/github/GraphqlBudget.ts` | extend | The rollup + threads + mergeState query document (no `statusCheckRollup` query exists in source) |
| C2 ETag / conditional-request layer | `GithubTransportFetch` seam (`cli/src/internal/github/GithubIdentity.ts`) reaching both the main and the pagination Octokit (`packages/drivers/github/src/internal/octokit.ts:240-249,369`), plus Effect `KeyValueStore.layerFileSystem` / `Persistence` | extend | The conditional-request `fetch` wrapper and atomic entry writes. It does not cover `gh` spawns or the separately built reviewer App client. |
| C3 one poller per PR + shared snapshot | The monitor **already writes** `YeetStatusSnapshot` on every poll (`MonitorLoop.ts:2131` → `Status.ts:1729`). Also Palantiri `writePrivateFile`/`Freshness`, `PrSessionRegistry` (host + PR keyed), `findLiveReadyMonitorJob`, and a lease modelled on `acquireJournalFileLock`. | extend (host); NET-NEW (fleet) | Snapshot keyed by PR at host scope, atomic write, lease generation + head SHA, readers in ReadyGate / MergeGate / WatchMode / GateTable |
| C4 merge-gate early return | `MergeGate.ts` read order + the C3 snapshot | extend | A snapshot-first hold and a memo keyed by SHA |
| C5 REST budget ledger | `transport.rateLimit` (`octokit.ts:282-285`), `MonitorRateLimit.ts` (#3032), `GraphqlBudget`, the Palantiri `account-headroom` snapshot pattern | extend | A persisted per-identity, per-resource ledger, plus a `github-headroom` parcel in `session open` |
| C6 webhooks into the inbox | Yeet inbox (`Inbox.ts`, the sink), `OwnerCheckpoint.store` CAS + outbox (pattern), `ObservationWorker` + Caddy (receiver shell), `rerun-runner-loss.yml` (event-driven precedent) | NET-NEW receiver | Signature check, delivery-id dedupe, redelivery reconciler, App hook config management, public ingress |
| Per-host daemon | `ObservationWorker` / `ObservationDeployment` (flock singleton, unix socket at 0600, SQLite, `LoadCredential=` token, Caddy front end) | extend | A GitHub-state worker that serves `GET /pr/:n`. The token arrives as a systemd credential, which sidesteps ruling 39's environment denylist. |
| Read-only monitor | `.github/workflows/rerun-runner-loss.yml` already reruns runner-loss failures from Actions on `GITHUB_TOKEN` | extend | Widen its classifier to the monitor's environment-only signatures, so a poller identity never needs Actions write |

**Corrections carried from verification:**
- The monitor does write the snapshot. The gaps are that it is keyed by branch, written non-atomically and carries
  no writer identity.
- T3 PR sweeps spend GraphQL, not REST core. They are already ETag-revalidated only on stack and checks-panel reads.
- Nothing in the repo runs or shares state across hosts.

## T3 Code

Full detail is in [`research/2026-11-09-t3-code-pr-sweeps.md`](./research/2026-11-09-t3-code-pr-sweeps.md).

- T3 always authenticates as the user (a user-to-server App token or `gh auth token`), so it shares the same bucket.
- Its periodic sweeps are aliased, batched GraphQL (25 PRs per document). The sync sweep runs every 1 min and the
  watch sweep every 2 min.
- It already shares one read per (project, PR) across threads on a host. Nothing is shared across hosts.
- It **stops background reads at 10% remaining** while Yeet drives the bucket to 0. After that, watched threads stop
  waking until the reset.
- Estimated cost: about 60 points/h per host for up to 25 linked PRs, plus 35–115 points/h per watched PR. The
  `ReviewThreads` activity read (about 13 points, estimated) dominates.

## Constraints Discovered

- **One shared user bucket** of 5,000 REST/h + 5,000 GraphQL points/h covers every host, every T3 server, every
  monitor and every agent `gh` call. App installation tokens get separate 5,000/h buckets. A 1-repo installation
  never scales. `GITHUB_TOKEN` gets 1,000/h per repo, shared by every workflow.
- **GraphQL has no 304 path.** Only REST can be revalidated for free, and a moving `since` parameter defeats ETags.
- **Moving the monitor to the App token is blocked today:**
  - it reruns jobs (Actions write)
  - ruling 39's unit-environment denylist forbids `GH_TOKEN`
  - the 2026-10-31 orchestrator ruling forbids bridging the App token into `yeet monitor`
- **Fine-grained PATs have no documented REST Checks access.** Check-run reads work on this repo only because it is
  public.
- **A webhook receiver needs a public ingress and a reconciler.** GitHub does not retry failed deliveries
  automatically.
- **Secondary limits:** 100 concurrent requests, 900 points/min per REST endpoint, 2,000 GraphQL points/min, and a
  CPU-time limit. How they are keyed (user, token or App) is undocumented.
- **Creating extra GitHub Apps purely to multiply buckets** would be rate-limit circumvention [inferred from GitHub's
  acceptable-use stance; not verified here]. Treat it as a no-go unless an App has its own real purpose.
