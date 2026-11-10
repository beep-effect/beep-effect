## In-Repo Capability Inventory (2026-11-09)

**Scope.** Which pieces already in the repo could let a single PR poller publish facts, so that monitor, `--watch`, `ready`, `merge-gate`, gate-table and the orchestrator read them instead of calling GitHub themselves. I checked this read-only against worktree HEAD `fda98a2c4bd` (#3032), made no `gh` or API calls, and read the Effect source from the `.repos/effect` reference checkout.

**Path abbreviations.**
- `CLI` = `packages/tooling/tool/cli/src`
- `Y` = `CLI/commands/Yeet/internal`
- `PAL` = `packages/tooling/library/palantiri/src`
- `D` = `packages/drivers/github/src`
- `EFX` = `.repos/effect/packages/effect/src`

**Candidates.**
- **C1**: one GraphQL query per poll
- **C2**: ETag layer
- **C3**: one poller per PR, with a shared snapshot
- **C4**: merge-gate early return
- **C5**: REST budget ledger
- **C6**: webhooks into the Yeet inbox

**Verdicts.**
- **reuse**: works as-is.
- **extend**: the brick exists but needs new code.
- **NET-NEW**: nothing to build on.

### Correction to the code review

The code review says the monitor never writes the status snapshot (`2026-11-09-review-code-claims.md`, S5). **That is wrong.**
- The `--until-ready` loop calls `reportMonitorObservation` on every poll (`Y/MonitorLoop.ts:2503`). That function calls `writeYeetStatusSnapshot(observation.snapshot)` (`Y/MonitorLoop.ts:2131`). That call dates from #1149 (`9e77f17410d`).
- The real gaps are different:
  1. The snapshot is keyed by **branch run id**, not by PR. Its path is `<checkout>/.beep/yeet/runs/<repoRunArtifactId(branch)>/status.json` (`Y/Status.ts:400`, `Y/ArtifactPaths.ts:514-522`).
  2. It is written with a plain `writeFileString`. There is no temp-file-and-rename, so a reader can catch a half-written file (`Y/Status.ts:1729-1744`).
  3. It records **when it was collected**: a `createdAt` field is set from `DateTime.now` at collection time (`Y/Status.ts:159,1490-1506`), so a reader can judge its age. It records **no identity or generation for the process that wrote it**.
  4. Only one consumer reads it: `Goals/Completion.ts:392`, for verdict recovery. `ReadyGate`, `MergeGate`, `WatchMode` and `GateTable` all call GitHub themselves.
- **S5 therefore starts from "move the writer and add readers", not from "make the monitor write".**

### (a) Palantiri hot parcels: `beep session open` → `beep palantiri`

| Aspect | Finding |
|---|---|
| Where they come from | `PAL` holds the schemas and reducers. It has 5 parcels: `account-headroom`, `lane-reds`, `host-pressure`, `app-error-classes` and `since-last-check` (`PAL/Parcel.models.ts:55-61`). The CLI ports are in `CLI/commands/Palantiri/Palantiri.service.ts`. The hot block lives in `CLI/commands/Palantiri/Palantiri.hot.ts`: a 2 s timeout covers all parcels (`HOT_PARCELS_TIMEOUT`, `:65`), and the result is staged as `hot.json` for the SessionStart hook (`:47`, `stageHotParcels` at `:357`). |
| Transport | One `HttpApi` contract, `GET /parcels/:id` (`PAL/Parcels.api.ts:55`), served **in process** through `HttpApiTest.groups` with no socket (`PAL/Parcels.api.ts:132-155`). `beep palantiri mcp` serves the same envelope as stdio MCP tools (`CLI/commands/Palantiri/Palantiri.tools.ts`). No network listener exists. |
| Storage and refresh | `account-headroom` is the only parcel with a cache. It is a read-through snapshot `account-headroom.json` under `resolveWorkstationStateDir({store:"palantiri"})`, which is `$XDG_STATE_HOME/beep/palantiri`, or `BEEP_PALANTIRI_STATE_ROOT` (`Palantiri.service.ts:97-100`). A snapshot younger than the bound is served. An older one triggers a live poll and a rewrite. If the poll fails, the stale file is served and the parcel reports `Unknown{stale}` (`:236-275`). Accounts whose poll failed keep their last good row (`retainLastGood`, `:166-190`). Writes go through `writePrivateFile`: directory mode 0700, a temp file at 0600, then an **atomic rename** (`:103-115`). There is **no lock around the refresh**, so two readers that both see a stale file will both poll. |
| How freshness is judged | Each `ParcelSpec` carries `freshnessBound`. `checkFreshness(now, bound, [readings])` returns `Fresh{asOf}` or `Unknown{stale \| unreachable \| attribution-incomplete \| no-source}` (`PAL/Freshness.ts`). The bounds are: account-headroom 5 min, lane-reds 10 min, host-pressure 1 min, app-error-classes 15 min, since-last-check unbounded (`Duration.infinity`). |
| `lane-reds` | Reads the current checkout plus every open checkout in the session ledger. For each one it reads the `.beep/inbox` view and the `.beep/yeet/jobs` proof-job records (`Palantiri.service.ts:640-700`). **It makes no GitHub call.** It sees GitHub only through what monitors already wrote into the inbox. |
| `host-pressure` | `/proc/pressure/*`, meminfo and the admission-scheduler slots. No GitHub. |
| `account-headroom` | Covers AI providers only: `claude, codex, muse, grok, junie, kimi` (`CLI/commands/Accounts/Accounts.schemas.ts:34`). GitHub buckets are not part of it. |
| An unused slot | `ParcelKey` already includes `"pr"` (`PAL/Parcel.models.ts:29`), but no parcel uses that key. |

| Candidate | Verdict | Rationale |
|---|---|---|
| C3 shared snapshot | **extend** | Two pieces are needed. (1) A `pr-status` parcel keyed by `pr`, with a bound around 2× the poll interval and a new `ParcelSource` such as `pr-poller`. (2) The writer half, reusing the `account-headroom` pattern: atomic private file, keep the last good reading, serve stale as `Unknown{stale}`. Still missing: a single-flight lock on refresh, and readers outside Palantiri. |
| C5 budget ledger | **extend** | Add a `github-headroom` parcel keyed by `account`, with one row per identity (user, orchestrator App, reviewer App) per resource (core, graphql). It would reuse the snapshot file and `retainLastGood`. Inputs: `transport.rateLimit` headers and `MonitorRateLimit`'s `/rate_limit` reads. It would then show up in `session open` with no extra calls. |
| C1, C2, C4, C6 | n/a | No overlap. |

### (b) Yeet inbox, status snapshot, job registry, session ledger, PR session registry

| Brick | Path | What it is | Scope |
|---|---|---|---|
| Failure inbox | `Y/Inbox.ts` (writer), `Y/InboxView.ts` (reader), `.claude/hooks/yeet-inbox.sh` | Append-only NDJSON at `<checkout>/.beep/inbox/failures.ndjson`, with ack receipts in `acks/<id>`. Row ids are deterministic over (prNumber, headSha, lane), so dedupe survives restarts. The hook's hot path is stat+read only. The header says "GitHub never enters a hook" (`Inbox.ts:1-25`). The reader skips bad lines and keeps the first copy of a duplicate id. | per checkout |
| Status snapshot | `Y/Status.ts:154-185` (`YeetStatusSnapshot`, `yeet-status/v1`), `:1729` writer | Holds head, remote checks, mergeReady, timeline, `createdAt` and nextCommand. Written by `yeet status`/`settle` (`Y/Handler.ts:1779,2157`) and on every monitor poll (`Y/MonitorLoop.ts:2131`). | per checkout, keyed by branch |
| Watch transition stream | `Y/WatchStream.ts`, `Y/WatchMode.ts` | Typed `YeetWatchSnapshot` → `diffYeetWatchSnapshots` → NDJSON transition events (`WatchMode.ts:723`). This is already the publish/subscribe shape that consumers read. | per watch process |
| Proof-job registry and lock | `Y/ProofJobLauncher.ts:83-89,366,441`, `findLiveReadyMonitorJob` (`Y/ProofJob.ts:1157`, used at `Y/ReadyGate.ts:565` and `Y/Handler.ts:1189`) | `.beep/yeet/jobs/<uuid>.json` plus `ready-monitor-submit.lock`. `ready` already looks for a live monitor by (branch, prNumber). It only does this to decide whether to submit one; it does not reuse the monitor's result. | per checkout |
| Owned-generation file lock | `CLI/internal/repo-run/AdmissionJournal.ts:1278-1302` (`acquireJournalFileLock`) | Publishes a PID+start-time generation through a hard link. A dead or PID-reused owner is reclaimed, and a live owner is never reaped by age. It is built for **short serialized journal rewrites**: contenders "retry briefly". | any path; host-wide if the path is |
| Machine-wide admission scheduler | `CLI/internal/repo-run/QualityScheduler.ts` | Durable tickets, heartbeated leases and reaping of dead PIDs, under the per-user runtime directory. (unverified in detail) | host |
| Session ledger | `CLI/commands/Session/SessionLedger.service.ts:146-148`, `CLI/internal/state/JsonLinesStore.ts` | `$XDG_STATE_HOME/beep/sessions/<host__owner__name>.jsonl`. Append-only with private modes. Shared by every clone and lane **on one host**. | host |
| PR session registry | `Y/PrSessionRegistry.ts:239-245` | `$XDG_STATE_HOME/beep/yeet/pr-sessions/<repo>.jsonl`. Maps a PR to its owner sessions, and `WaveNotifier` uses it to find a dead owner. **It is already keyed by PR at host scope.** | host |
| Workstation state resolver | `CLI/internal/state/WorkstationState.ts:73` | Shared resolver: `BEEP_*_STATE_ROOT`, then `$XDG_STATE_HOME/beep/<store>`. Stores in use: sessions, orchestrator, goals, yeet, fleet, palantiri, accounts. | host |
| Wave notifier | `Y/WaveNotifier.ts` | Claims each wave with a descriptor file (`<checkout>/.beep/yeet/pr-wave-notifier/waves/<waveKey>.json`), so a wave escalates once even across monitor restarts. | per checkout |

| Candidate | Verdict | Rationale |
|---|---|---|
| C3 one poller per PR | **extend** | Every brick exists, at the wrong scope. Proposed shape: (1) Move the snapshot to host scope, at `<state>/beep/yeet/pr-status/<repo>/<pr>.json`, keyed by PR and written atomically with `writePrivateFile`. Add `headSha` and a `poller` generation; `createdAt` already serves as the observation time. (2) Elect the poller with an owned-generation lock on `<state>/beep/yeet/pr-pollers/<repo>/<pr>.lock`, so a dead holder is reclaimed automatically; this answers the "stale snapshot / dead poller" risk. `acquireJournalFileLock` retries briefly and is meant for short rewrites, so a long-held lease needs a non-blocking try-acquire variant. (3) Readers accept the snapshot when its `headSha` matches local HEAD and its age is under the bound, as `Freshness`-checked. Otherwise they poll once and still publish the result. Owner routing stays in `PrSessionRegistry`. |
| C6 webhooks → inbox | **reuse** (consumer side) | The inbox is already the sink that harnesses consume, and it is idempotent by row id. A receiver only has to translate events into `appendYeetInboxRow` and the watch-event NDJSON. The receiver itself is NET-NEW (see e). |
| C4 merge-gate early return | **extend** | merge-gate could first read the host snapshot (C3) and hold without any API call while checks are pending or the window is still open. It would still do one authoritative re-read right before its head-pinned merge. |
| C1 | **extend** | Better freshness alone does not reduce the per-poll cost, but `YeetStatusRemote` is already the target shape for a single GraphQL query to fill. The typed document infrastructure exists (`D/GraphQL.ts`, `D/ReviewThread.ts`, `CLI/internal/github/GithubGraphql.ts`). **There is no `statusCheckRollup` query anywhere in source**, so the query document itself is NET-NEW. |

### (c) Caches, persistence, daemons, systemd

| Brick | Path | What it is | Fit |
|---|---|---|---|
| **Transport fetch seam** | `CLI/internal/github/GithubIdentity.ts:278-302,371` (`GithubTransportFetch` Context.Reference, default none), `D/GitHubClient.ts:229,697`, `D/GitHubApp.ts:832` (`fetch` option) | Every client that `layerGithubClientFor` builds (user token and App) sends its requests through an injectable `fetch`. The main Octokit and the separate pagination Octokit both get it from the same `TransportOptions` (`D/internal/octokit.ts:240-249,369`). | **C2: the best place for the ETag layer.** A conditional-request `fetch` wrapper covers `request` *and* `paginate` with no octokit hook. That fixes the review's "hook misses paginate" problem with no driver change. It does not cover `gh` subprocess reads, and it does not cover the reviewer App client, which is built separately through `GitHubApp.clientLayer` (`CLI/commands/Reviewer/GitHubAppAuth.ts:307`). |
| Rate-limit cell | `D/internal/octokit.ts:282-285`, `D/Resilience.ts:51-70` (`RateLimitSnapshot{remaining,limit,resetEpochSeconds}`) | Records `x-ratelimit-*` per transport, in memory, per process. It has no `resource` field (core or graphql). | C5: **extend.** Add the resource and identity, then persist. |
| Monitor rate-limit pause | `Y/MonitorRateLimit.ts` (`YEET_MONITOR_RATE_LIMIT_BUDGET = 8`, `GET /rate_limit` read) | Classifies a failure as a rate limit, then sleeps until the reset. | C5: **reuse** as an input to the ledger. |
| GraphQL budget guard | `CLI/internal/github/GraphqlBudget.ts` | 1-point `rateLimit` probe. Its fallback reads REST `/rate_limit` for the reset time only and treats the remaining points as zero. | C5: **extend** with a REST twin, and read the ledger before probing. |
| Effect `KeyValueStore` | `EFX/persistence/KeyValueStore.ts:421` (`layerFileSystem`), `:610` (`layerSql`) | One file per key (`encodeURIComponent`) in a directory, or a SQL table. Works across processes. **`layerFileSystem` and `layerSql` are not used in repo source.** `KeyValueStore` itself appears only as `layerStorage` over `localStorage` in browser atoms (`packages/agents/client/src/Chat.atoms.ts:333`, `apps/professional-desktop`). | C2: **reuse.** `layerFileSystem(<cache>/beep/github/etag)` keyed by identity+route+params, holding `{etag, body}`. Make writes atomic, since `layerFileSystem` writes in place with `writeFileString`. |
| Effect `Persistence` / `PersistedCache` | `EFX/persistence/Persistence.ts:1079,1177,1231` (`layerBackingKvs`, `layerKvs`, `layerSql`), `PersistedCache.ts` | Schema-keyed persisted cache with a `timeToLive` function. `packages/drivers/duckdb/src/DuckDbPersistence.service.ts` already imports `Persistence`. | C2: an immutable cache for completed check runs, run jobs and logs keyed by run id (H7). **reuse.** |
| Effect `RateLimiter` | `EFX/persistence/RateLimiter.ts` (memory and Redis stores only); used in `packages/foundation/capability/api-transport/src/Transport.ts:31`, `drivers/ecfr`, `drivers/govinfo` | Shared limits across processes, *given a shared store*. | C5: **extend.** It needs a file or SQLite `RateLimiterStore` for cross-process use on one host. Neither exists in Effect or the repo. |
| SQLite | `packages/drivers/sqlite/src/SqliteClient.service.ts` (Bun-only, `bun:sqlite`). The repo CLI lists **both** `@effect/sql-sqlite-bun` and `@effect/sql-sqlite-node` as runtime dependencies (`packages/tooling/tool/cli/package.json:270-271`). | SQLite usable from many processes. | Store for C2, C3 and C5 if files become a problem. Gotcha: repo-cli tests must run on Node and Bun, so pick the client per runtime. Do not use `@beep/sqlite` directly. |
| Owner-checkpoint store | `Y/OwnerCheckpoint.store.ts:59-110` (SQLite CAS table keyed by (repository, pr) plus an outbox keyed by (repository, pr, revision)), with `.adapter.ts`, `.publisher.ts` and `.schemas.ts` | A PR-keyed compare-and-swap record plus a delivery outbox. **Not registered:** "No command, endpoint, App credential, publisher or ruleset is activated here" (adapter header). Outside its own files, only the test kit references it. | C3 and C6: **reuse the pattern.** A PR-keyed CAS with an outbox is the "one writer, idempotent delivery" store that a poller or webhook receiver needs. |
| **Long-running local daemon** | `CLI/commands/AIMetrics/internal/ObservationWorker.ts:274-360`, `CLI/commands/AIMetrics/internal/ObservationDeployment.ts:131-227`, `CLI/commands/AIMetrics/ObservationWorker.entry.ts` | An existing pattern for a Bun daemon run as a systemd **user** service. It runs as a `flock --nonblock` singleton and keeps a SQLite journal chmod'ed to 0600. It serves Effect `HttpServer` on a **unix socket** at 0600 with no TCP listener. A Caddy front end listens on `127.0.0.1:<port>` and reverse-proxies to the socket. Installed credentials arrive through **`LoadCredential=`** (`CREDENTIALS_DIRECTORY=%d`), never argv; the worker only accepts environment credentials for direct process fixtures. `renderObservationDeployment` produces a unit plan, and no command in source invokes it. | C3 and C6: **extend.** This is a ready template for a per-host "GitHub state daemon" that owns the pollers and serves `GET /pr/:n`. It also solves the review's blocker that ruling 39's denylist bans `GH_TOKEN` in unit environments, because the token arrives as a systemd credential instead. The Caddy front end is the natural place to terminate a webhook path. |
| systemd unit kit | `packages/tooling/library/repo-cli-kit/src/systemd/SystemdUnit.ts`, `docs/runbooks/systemd-timers.md`, `CLI/commands/Research/internal/Timers.ts`, `CLI/commands/Refs/Refs.service.ts` | Renders and installs user `.service`/`.timer` units. | Install path for a daemon or timer: **reuse.** |
| Detached proofs and monitors | `beep-proof-<jobId>.service` via `systemd-run` (`Y/ProofJob.ts:61`, `Y/ProofJobLauncher.ts`) | One transient unit per monitor job. | Already the poller process. Under C3 it becomes the lease holder. |
| Loopback HTTP callback | `CLI/commands/Github/Github.service.ts` (BunHttpServer on `127.0.0.1:8787` for the App-manifest flow) | One-use loopback receiver with `state` validation. | C6: a small precedent only. It has no signature check. |

### (d) Per host or fleet-wide?

**Nothing in the repo runs across hosts or shares state across hosts.**

| Store or mechanism | Scope |
|---|---|
| Session ledger, PR session registry, Palantiri state, admission scheduler, `FleetRoots` (`CLI/commands/Worktree/internal/FleetRoots.ts`) | host only. In `FleetRoots`, "fleet" means this host's worktree roots (unverified). |
| Inbox, jobs, status snapshot | per checkout |

The only cross-host mechanisms are outside the repo: T3 Code environment links and PR watch, `ssh <host> op read` in `CLI/commands/Reviewer/GitHubAppAuth.ts:118-141`, and the orchestrator's shell scripts. The one fleet-wide shared surface that exists today is GitHub itself: check runs, PR state, and the reviewer App's check publication (`beep reviewer`; `OwnerCheckpoint.publisher.ts` is unregistered). Reading those costs quota.

**Verdict.**
- **C3 host-wide: extend** (bricks above).
- **C3 fleet-wide: NET-NEW.** It needs a transport. Options: Tailscale with the existing `packages/drivers/tailscale` driver, a unix-socket daemon exposed over the tailnet, or a single elected poller host.
- **C5 fleet-wide: NET-NEW.** It is cheap, though: GitHub documents that accessing `GET /rate_limit` "does not count against your REST API rate limit" (docs.github.com/en/rest/rate-limit/rate-limit). Each host's ledger can read the shared `used` value without coordinating with the others. The docs say nothing about secondary limits for this endpoint, so keep the read interval modest.

### (e) Existing GitHub event ingestion

| Brick | Finding | Verdict for C6 |
|---|---|---|
| Webhook receiver | **None.** No `X-Hub-Signature-256` or `X-GitHub-Delivery` handling anywhere in source. The other webhook hits in source are other vendors (`packages/drivers/{box,freshbooks,box-provisioning}`), the Actions event payload type (`packages/drivers/github-actions/src/ActionEnvironment.ts`) and the App manifest's `hook_attributes` (`CLI/commands/Github/Github.schemas.ts`). | **NET-NEW** |
| beep-reviewer App | Configured with **"no webhook, no subscribed events"** (`docs/ops/beep-reviewer-app.md:90,106`). The controller calls `beep reviewer l0`/`gate` on each tick, which is polling (`:223-246`). Commands are in `CLI/commands/Reviewer/ReviewerCommand.ts`. | Changing its webhook settings is a config change, but **App hook config is not managed anywhere**. Only the manifest `hook_attributes` exist, in `CLI/commands/Github/Github.schemas.ts`. |
| Owner checkpoint publisher | Not registered, as noted in (c). It publishes App check runs and does not consume events. | n/a |
| GitHub-side event workflows | `.github/workflows/rerun-runner-loss.yml` runs on `workflow_run: completed` for Check and Heavy Admit when the conclusion is `failure`. It uses `GITHUB_TOKEN` (`GH_TOKEN: ${{ github.token }}`; that token has a 1,000/h per-repository bucket) with `actions: write`, and calls `beep ci rerun-runner-loss`. It covers **runner-loss failures only**. The monitor reruns a broader set of environment-only failure signatures, one per job per head, via `gh run rerun --job <id>` on the user's `gh` identity (`Y/MonitorLoop.ts` header, `:213-245`). | **Relevant to the S1 refutation.** The workflow is an event-driven, Actions-side precedent for the monitor's one write. Moving the monitor's rerun decisions there means widening the workflow's classifier and its workflow list. That would make the monitor read-only, so a poller identity would never need Actions write. **extend** |
| T3 PR watch | Outside the repo (T3 MCP `watch_pull_request`), runs on each host, and its cost has not been measured. | Out of scope, but a C3 consumer candidate. |

### Verdict matrix

| Candidate | Best in-repo base | Verdict | What is NET-NEW |
|---|---|---|---|
| C1 one GraphQL query per poll | `YeetStatusRemote`/`YeetWatchSnapshot` as targets; `D/GraphQL.ts` typed documents; `GraphqlBudget` | extend | The rollup+threads+mergeState query document; a derived `bucket` to satisfy D-13 |
| C2 ETag layer | `GithubTransportFetch` / `TransportOptions.fetch` seam + Effect `KeyValueStore.layerFileSystem` or `Persistence.layerKvs` under `~/.cache/beep/github/` | extend | The conditional-request fetch wrapper; atomic writes for entries. It does not cover `gh` spawns or the separately built reviewer App client, so it needs C1/H9 too. |
| C3 one poller per PR | `writeYeetStatusSnapshot` (already per poll) + Palantiri `writePrivateFile`/`Freshness` + an owned-generation lease modeled on `acquireJournalFileLock` + `PrSessionRegistry` (host and PR keyed) + `findLiveReadyMonitorJob`; daemon template `ObservationWorker` | extend (host-wide); NET-NEW (fleet) | Host-scoped PR-keyed snapshot path; a non-blocking lease file; readers in ReadyGate, MergeGate, WatchMode, GateTable; a `pr-status` parcel |
| C4 merge-gate early return | `MergeGate.ts` read order; the C3 snapshot | extend | Snapshot-first hold; memo keyed by SHA |
| C5 REST budget ledger | `transport.rateLimit`, `MonitorRateLimit`, `GraphqlBudget`, Palantiri `account-headroom` snapshot pattern | extend | Persisted per-identity, per-resource ledger; `github-headroom` parcel; file/SQLite `RateLimiterStore` if hard throttling is wanted |
| C6 webhooks into the inbox | Inbox writer and hook (sink); `OwnerCheckpoint.store` CAS+outbox (idempotency pattern); ObservationWorker + Caddy intake (receiver shell); `rerun-runner-loss.yml` (event-driven Actions precedent) | NET-NEW receiver; reuse sink | Signature verification, delivery-id dedupe, redelivery after downtime, App hook config management, a public ingress (Funnel or smee) |

### Most important takeaways for shaping

1. **The publisher already exists.** The monitor writes a full typed snapshot, with `createdAt`, on every poll. C3 is mostly a matter of moving that file to host scope, keying it by PR, making the write atomic, and stamping it with a lease generation and head SHA. Readers then trust it within a `Freshness` bound.
2. **The C2 hook point already exists and is better than `hook.wrap`.** Wrapping `fetch` through `GithubTransportFetch` covers pagination without touching the driver. The reviewer App client needs the same `fetch` passed in separately.
3. **A daemon template already exists.** `ObservationWorker` and `ObservationDeployment` combine a flock singleton, a unix socket, SQLite, `LoadCredential` and a Caddy front end, as a rendered plan that no command installs yet. It solves the ruling 39 token-in-env problem and gives a webhook path somewhere to land later.
4. **Making the monitor read-only has a precedent.** `rerun-runner-loss.yml` already reruns runner-loss failures from Actions on `GITHUB_TOKEN`. Widening it to the monitor's environment-only signatures would separate "poll on a read-only identity" from "needs Actions write".
5. **Fleet-wide sharing is greenfield.** Everything durable is per host, so the first milestone should be one reader per fact **per host**. The 5,000/h user bucket is shared fleet-wide, though, so the ledger (C5) should read `GET /rate_limit`, which GitHub documents as not counting against the REST limit, to see what other hosts are spending.

SOURCES (corrected licenses):

- beep-effect Palantiri CLI service: https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/cli/src/commands/Palantiri/Palantiri.service.ts (`@beep/repo-cli` declares Apache-2.0; reference-only)
- beep-effect Yeet MonitorLoop and Status writer: https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts (Apache-2.0; reference-only)
- beep-effect GithubIdentity `GithubTransportFetch`: https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/cli/src/internal/github/GithubIdentity.ts (Apache-2.0; reference-only)
- beep-effect AIMetrics ObservationWorker: https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/cli/src/commands/AIMetrics/internal/ObservationWorker.ts (Apache-2.0; reference-only)
- beep-effect OwnerCheckpoint store: https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/cli/src/commands/Yeet/internal/OwnerCheckpoint.store.ts (Apache-2.0; reference-only)
- beep-effect AdmissionJournal `acquireJournalFileLock`: https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts (Apache-2.0; reference-only)
- beep-effect rerun-runner-loss workflow: https://github.com/beep-effect/beep-effect/blob/main/.github/workflows/rerun-runner-loss.yml (repo root LICENSE: Apache-2.0; reference-only)
- beep-reviewer App ops doc: https://github.com/beep-effect/beep-effect/blob/main/docs/ops/beep-reviewer-app.md (repo root LICENSE: Apache-2.0; reference-only)
- Effect v4 persistence modules: https://github.com/Effect-TS/effect/tree/main/packages/effect/src/persistence (MIT, confirmed from the LICENSE file; reference-only)
- GitHub REST rate-limit endpoint: https://docs.github.com/en/rest/rate-limit/rate-limit ("Accessing this endpoint does not count against your REST API rate limit."; GitHub docs, reference-only)

### Verifier notes

- **Review correction:** confirmed. `MonitorLoop.ts:2131` and `:2503` and #1149 `9e77f17410d` all match. I changed gap 3: the snapshot does have a `createdAt` stamped from `DateTime.now` at collection time. What it lacks is a writer identity or generation.
- **KeyValueStore:** "not used anywhere in `packages/**/src`" was false. `KeyValueStore.layerStorage` is used in `packages/agents/client/src/Chat.atoms.ts` and in `apps/professional-desktop`. I narrowed the claim to `layerFileSystem`/`layerSql`, which are unused.
- **Wrong path:** `ObservationWorker.entry.ts` is in `CLI/commands/AIMetrics/`, not `internal/`. I added that `renderObservationDeployment` is not invoked by any command, and that the worker accepts environment credentials for direct process fixtures. The user-manager scope is confirmed (`ObservationDeployment.ts:24`).
- **C1 verdict:** it said "reuse" in table (b) and "extend" in the matrix. I made it **extend** in both. I dropped `isRequired` from "no query anywhere", because unrelated `isRequired*` identifiers exist; the `statusCheckRollup` part still holds.
- **Fetch seam:** I added that the reviewer App client (`GitHubAppAuth.ts:307`) is built outside `layerGithubClientFor`, so the seam does not reach it.
- **`acquireJournalFileLock`:** I noted that it is designed for short serialized rewrites with a brief retry, so a long-held poller lease needs a try-acquire variant.
- **rerun-runner-loss:** I noted that it covers runner-loss failures for Check and Heavy Admit only. The monitor reruns a broader set of environment-only signatures through `gh run rerun --job` on the user identity, not an App token. The C6 row stays "extend", now framed as widening the workflow.
- **`GraphqlBudget` fallback:** I clarified that REST `/rate_limit` is read only for the reset time, and the remaining points are treated as zero.
- **`/rate_limit` cost:** confirmed against GitHub docs. I added that the docs are silent on secondary limits.
- **Line refs:** I tightened several (`ReadyGate.ts:565`, `Handler.ts:1189`, `ProofJob.ts:1157`, `ProofJobLauncher.ts:366,441`, SessionLedger `:146-148`). I added `accounts` to the stores list and removed the `~/.local/state` fallback, which is not in the resolver; it resolves through `XdgBase`.
- **Marked (unverified):** the QualityScheduler details and the FleetRoots "this host's roots" semantics. I did not open either.
- **Source licenses:** "MIT" was wrong for most repo sources. The repo root and the CLI package are Apache-2.0; only the palantiri library and the github driver manifests say MIT. The Effect MIT license is confirmed. I added the GitHub docs source for the `/rate_limit` claim.