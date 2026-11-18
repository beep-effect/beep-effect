# Notes: phase 5 (the prototype on Effect Cluster, conformance, restore)

The stack ran. It came up healthy on the first deploy, about 40 seconds after the swarm was
initialised, and every case below ran against it over its Apis. Docker and `alchemy` were used
for this phase only, as approved (D37). Teardown was checked against the machine's baseline at the
end.

## In memory, and the small items

`bun run check` (16 projects, the new `conformance` package and `scripts/` included),
`bun run test` (133 tests in 37 files), `bun run handlers:check` and `bun run generated:check`
(entry modules included) all pass. The conformance package has its own command and is not part
of `bun run test`.

- **D40:** a producer's newest fact version is never reported retirable. The practice deployment
  now reports nothing; v1 is still reported once nobody consumes it.
- **The 15 authority outcomes:** all covered by three new stories in
  `authority/model/test/Authority.story.test.ts`. `bun run outcomes` now reports all 109 declared
  outcomes executed, and the gap list is empty.
- **New role suffixes:** `.cluster.ts` and `.route.ts` got primary-export rules.
- **The control route:** the conformance-only control route lives in its own file
  (`authority/host/src/Control.route.ts`). The root-construction scan lists it as a named
  exception, because it provides a bootstrap invocation.

## The stack as built

- **Stage:** `mfs-conformance`, deployed with `alchemy deploy` from `apps/practice`, local state
  only (`Alchemy.localState()`, `apps/practice/.alchemy/`). It ran on a swarm initialised for the run
  with `docker swarm init --advertise-addr 127.0.0.1`.
- **Resources (11):**
  - `ClusterDocker.Database("Practice")`: Postgres 17 service, overlay network, volume, password;
    no host port.
  - `ClusterDocker.SwarmPool("Default", { replicas: 2 })`: runner image built locally, two
    runners, gateway token, shard groups.
  - `PracticeFront`: a Docker service on host port 18640, plus the entity and pool records.
- **Entry modules, generated (D13, D40):** `apps/practice/scripts/entries.ts` writes
  `apps/practice/generated/Practice.entry.ts` and `Practice.front.ts` from the composed descriptors
  (`ConformanceStack` = authority, party, runs, conformance); `--check` is in
  `bun run generated:check`.
  - Each descriptor now carries its cluster wiring: the module and export of its
    `<Context>.cluster.ts`, the parts it provides with the parts each uses, and what its Apis use.
  - The generator orders the parts by use and hosts every context on one `layerEntities` platform
    (entity `Practice`).
  - The app names no model or process.
- **Gateways (D39):** each part is the provider's contract adapter (`AuthorityGatewayLive`,
  `RunsGatewayLive`, `PartyFactsFeedLive`) over the provider's model hosted on the pool's own
  platform. Calls reach the provider's entities through Effect Cluster's dispatch. Every call still
  carries provenance that authority re-admits; hosts have no principal of their own.
- **Durable stores:**
  - `PgPartyDirectoryStore` (party host) writes rows and its per-source positions in one
    transaction, per generation.
  - `PgInboxStore` (runs host) moves the inbox checkpoint and the seen-set together.
  - Both connect lazily to the cluster's database (`ClusterSql.ts`).
  - The models are unchanged: the store is a port, and `hostParty(platform, store)` takes it.
- **Front:** every context's Apis by first path segment (`/reviewer`, `/intake`, `/agent`,
  `/authority`, `/runs`), upstream's conformance app at the root, and two conformance-only routes
  (`/control/issue|revoke` and `/runs-state`).

## What the earlier `alchemy plan` failure was, and what else had to change

- **Plan failed on import under Node.** `alchemy` exports `./Runtime/Bootstrap` as `.ts` source
  for every condition, and Node refuses to strip types under `node_modules` (upstream issue 3
  below). `bun --bun alchemy …` imports it. `apps/practice` has `deploy` and `destroy` scripts that
  do this.
- **The deploy builds every runner Layer once, without the runner's environment.** A Postgres
  Layer that reads `CLUSTER_DATABASE_URL` while it builds fails the plan, so both stores connect on
  first use (`ClusterSql.ts`).
- **On the front, `Effect.provide(hosted)` closed the hosted Layer's scope** once the Api fetches
  were built, so a later lazy connect was interrupted and `FindParties` answered `Interrupt`.
  The Party Apis now `Layer.build` the hosted model into the front's own scope.
- **The front needs `CLUSTER_DATABASE_URL`,** because queries run where the Api runs. The
  generated front passes `database.url` in its env.
- **The front's image did not rebuild** when only imported code changed (upstream issue 4); the
  generated front carries a `FRONT_REVISION` env to force it.
- **The inbox poller died silently** on its first failure (`Effect.repeat` stops on error). It now
  logs each failure and keeps polling. That is how the runner-side read failure (upstream issue 2)
  was found.

## Conformance results

Evidence is in the run's evidence log (in the session scratchpad, not committed). The key lines
are quoted here.

| # | Case | Result | Evidence |
| --- | --- | --- | --- |
| U1 | A command commits and replies with the new state | Pass | 109 ms |
| U2 | A live read is pushed over a WebSocket | Pass | 1171 ms |
| U3 | A rejected command commits nothing | Pass | 40 ms |
| U4 | A command sent twice under one id commits once | Pass | 80 ms |
| U5 | A view lists its entries a page at a time, in either order | Pass | 9.8 s |
| U6 | Commands to one instance run one at a time | Pass | 1.9 s |
| U7 | A view applies every event once, in order | Pass | 2.7 s |
| U8 | A policy starts a saga, and the saga's step commits | Pass | 0.6 s |
| U9 | A scheduled command runs when it is due | Pass | 13.4 s |
| U10 | A cancelled command never runs | Pass | 12.1 s |
| P1 | A command sent twice under one id commits once; its reaction happens once | Pass | both receipts `version 2`; one `ClaimAsserted`; run `:1` `AwaitingApproval`, `:2` `Unrequested` |
| P2 | A lost response, retried with the same id | Pass | the first call cut at 5 ms (`Failure`); the retry returns `version 2`; one `ClaimAsserted` |
| P3 | A runner killed right after a commit | **Fail** | The retry gets the stored receipt (`version 2`, both runners killed at 23:41:25Z). The reactions never happen: outbox rows 1 to 3 stay staged; the view read with `atLeast` times out; review run `:1` is still `Unrequested` 3 minutes later. Upstream issue 1. |
| P4 | A projection crash between sink write and checkpoint | **Fail** (window approximated) | Runners killed within the projection's 1 s batch wait. The input is accepted into the key's log (`accepted 1, processed 0`), the wakes after the restart are processed, and no row is ever written. Same stranded drain as P3. The exact write-then-crash window was not forced on the cluster; in memory it is covered by `Rebuild.test.ts`. |
| P5 | A grant revoked while a chain is in flight | Pass (first hop) | Revoked as soon as the assertion committed; the policy's re-admission found no propose grant and recorded `ReviewRefused` `no-propose-grant`; the run never opened. The revocation landed before the first hop, not mid-run, and the runner was not chosen. |
| P6 | A run waiting for approval survives a runner restart and completes after approval | **Fail** | The run survives the kill (`AwaitingApproval`), and the approval commits. Party publishes the decision (`PartyFacts` entries 1 and 2), but the runs inbox on the runners fails every read with `RpcClientError: HttpError: InvalidUrl (POST /rpc/)`, so the run never concludes. Upstream issue 2. |
| P7 | Two runners on one instance (D38) | Pass (no overwrite observed) | Runner `bd8a…` decides `A` (hold 70 s) at 00:14:40.6Z and is paused. After 45 s, `B` commits on `8739…` in 3.9 s (`event:1` = `B`, `meta` version 1). Unpaused at about 00:15:31Z. The stale runner never logs "committing A", even after its deadline (checked 00:16:08Z). The stored events after are unchanged: only `B`. Its HTTP call returned `null`. |
| P8 | Backup and restore | Pass except the run's completion | Dumped while run `:1` waited for approval, with runners and front scaled to 0. Destroyed, deployed fresh, scaled to 0, `pg_restore --clean`, scaled up. Then: the claim view is equal; the directory finds the party; the retried receipt is equal; the hold's expiry is `expired`; the scheduled wakes pending in the dump (`processed f`) are delivered (`t`); the run is still `AwaitingApproval`. After approval the run does not complete: the cause is P6. |

## D5 verdict

**Not yet.** On this workstation the host passes all ten of upstream's Domain conformance cases,
and the prototype's duplicate, lost-response, revocation and two-runners cases.

It fails three of the prototype's cases:

- **Kill after commit (P3)** and **projection crash (P4):** a drain lease held by a killed runner
  strands the outbox and the projection log.
- **Waiting run (P6):** a stream read from a runner fails with `InvalidUrl`. P8's last check fails
  for the same reason.

The D38 case did not reproduce an overwrite. The stale runner's in-flight `decide` was
interrupted once it lost the shard. That is one timing, not a proof that a commit already inside
its SQL write cannot overwrite. The repo-owned platform's retirement stays held, by D5's own
gate, until P3, P4 and P6 pass.

## Decisions

- **D5 (first host):** blocked by upstream issues 1 and 2; see the verdict.
- **D13 (deployment wiring):** built as decided. Entry modules are generated from the composed
  descriptors into the app, with a check mode, and the cluster loader accepted the generated
  `main` (deployed twice). The descriptor gained a `cluster` field (module, export, parts and their
  uses).
- **D38 (two runners):** built and run; no overwrite in this timing, so no local patch was needed
  and none was made. The commit path still has no version check (`DurableObjects.ts:802-854`,
  `EffectCluster/index.ts:208-210`), so the version-check proposal stands.
- **D39 (gateways):** built as decided for calls. Gateways are the provider's contract over its
  model on the pool's own platform; commands and `get` route through Effect Cluster. Reading a
  provider's stream from a runner is blocked (upstream issue 2).
- **D40:** built. The newest fact version is never retirable (`FactRetirement.ts`; the practice
  deployment now reports nothing retirable). Entry modules are generated into
  `apps/practice/generated/`.
- **Inbox as a cluster singleton:** built differently. The inbox runs as a poller on every runner
  over the shared `PgInboxStore`; idempotent command ids make two pollers safe. It was not built
  as a `Cluster.Singleton`, because the singleton would run on a runner and hit the same read
  failure.

## Library facts (file and line, 2.0.0-beta.87)

- `alchemy` `package.json` exports `./Runtime/Bootstrap` as `src/Runtime/Bootstrap.ts` under
  every condition.
- `@alchemy.run/docker` `Service.ts:1079-1084`: ports are `ingress` or `host` mode only, with no
  host IP, so the front's port 18640 was published on all interfaces for the run's duration.
- `DurableObjects.ts:326-371`: a queue's 60 s lease and a one-shot 10 s backstop.
- `EffectCluster/index.ts:745-795`: in runner mode the namespace URL is empty; `824-835`: callers
  reach entities through the gateway.
- `effect-cluster` `Docker/Database.ts:71-80`: user `postgres`, database `cluster`, alias
  `cluster-db`, no host port.
- `internal/Bootstrap.ts:201-312`: the runner builds each entrypoint Layer and provides `PgClient`
  only to cluster storage, not to user Layers.
- The deploy pulled `postgres:17-alpine` by digest even though the tag already existed locally.

## What remains for the D16 gate

- **Conformance on the Postgres swarm host, restore included:** run, and failing P3, P4 and P6
  on upstream issues 1 and 2. The restore procedure itself works. Only the database had to be
  saved: a `pg_dump` into a fresh deploy needs no Alchemy state, since the new password is fine.
  The Alchemy state would matter only for a volume-level restore.
- **Fact through outbox and inbox on the cluster:** published (proven on the stack), not consumed
  (upstream issue 2).
- **Everything else** stands as proven in memory in phase 4.

## Teardown against the baseline

- **Removed:**
  - `alchemy destroy` for `mfs-conformance` succeeded (11 resources, twice: once for the restore
    test, once at the end).
  - Four intermediate runner images that destroy left behind (one per redeploy).
  - `docker swarm leave --force`, and the `docker_gwbridge` network the swarm created.
  - The `postgres:17-alpine@sha256:d3244e8c…` image the deploy pulled; the baseline's
    `3540c0362c80` keeps its tag.
  - `apps/practice/.alchemy/` and the saved state copy.
- **Diff against `docker-baseline.txt`:** containers, images, volumes and networks are identical,
  with one exception, and the swarm is inactive.
  - **The exception:** `danklocal-connect-api`, `danklocal-connect-sync` and the
    `danklocal-connect_default` network have new IDs. Their compose project recreated them at
    23:32:04Z, about a minute after the swarm init and first deploy. No command of this run
    targeted them. Whether the swarm init prompted their supervisor is unknown.
- **Not in the baseline record:** Docker's build cache (754.7 MB now). It was not pruned, because
  pruning would touch other projects' cache.

## Upstream issues, ready to file (NOT filed)

### 1. A queue drain's lease outlives a killed runner, and the one-shot backstop gives up

- **Package:** `@alchemy.run/domain` 2.0.0-beta.87, `src/DurableObjects.ts:326-371`.
- **What happens:** a command commits on runner A and stages its outbox rows; A's `kick` starts a
  drain, which writes `outbox-lease` = now + 60 s, and A is killed mid-drain. The backstop
  (`callback.schedule("drain", { after: "10 seconds" })`, `:368`) fires on runner B 10 s after the
  commit. The lease is still held (`:344`), so `drain` returns without work and schedules nothing.
  The rows stay staged until the instance commits again.
  - Views never see the events; `atLeast` reads time out (`ConsistencyTimeout`).
  - Policies never react.
  - The same pattern strands a projection key's input log: `accepted` 1, `processed` 0,
    `drain-progress` 1.
- **Failing case:** `conformance/test/Own.conformance.ts`, "a runner killed right after a commit".
  Evidence for `Claim/claim_kill_r_a1af872b`:
  - `outbox:1..3` present 3 minutes later;
  - `outbox-lease` = 1794613307828 (23:41:47.8Z);
  - the backstop `Wake` (`deliver_at` 1794613257749, 23:40:57.7Z) is `processed = t`;
  - review run `:1` stays `Unrequested`.
  - The projection-crash case shows it on `PartyDirectoryProjection/party_r_1a6c6cfa`.
- **Proposed change:** when `acquire` finds the lease held, reschedule the backstop for just after
  the lease's expiry instead of returning. Or tie the lease to the runner's shard ownership, so a
  new owner may take it at once.

### 2. Reading a stream (or a view page) from code running on a runner fails with `InvalidUrl`

- **Package:** `@alchemy.run/domain` 2.0.0-beta.87, `src/EffectCluster/index.ts:792-795`.
  - In runner mode the platform's namespace is `makeNamespace(objects, { url: "", token: "",
    service: "" })`.
  - Commands and `get` route through Effect Cluster, but a stream's `list` goes through the HTTP
    read client with an empty URL.
- **What happens:** the runs context's inbox, on a runner, reads Party's fact feed
  (`PartyFacts.list("claims", …)`) and fails every time with
  `RpcClientError: HttpError: InvalidUrl (POST /rpc/)`. The decision is published (stream entries
  1 and 2) but never consumed, so a waiting run never concludes.
- **Failing case:** "a run waiting for approval survives a runner restart and completes after
  approval". The run survives and the approval commits; the run stays `AwaitingApproval`.
- **Proposed change:** route stream and view reads (`list`, `peek`, `events`) through the cluster
  in runner mode, as commands are. Or document that only callers (fronts) may read them.

### 3. The CLI cannot import a stack under Node

- **Package:** `alchemy` 2.0.0-beta.87, `package.json` `exports["./Runtime/Bootstrap"]`.
- **What happens:** every condition, `default` included, points at `./src/Runtime/Bootstrap.ts`.
  Under Node, `alchemy plan` fails importing the stack: "Stripping types is currently unsupported
  for files under node_modules". It works under Bun (`bun --bun alchemy …`).
- **Proposed change:** point `default` at the built `lib/` file, as `.` already does.

### 4. A Docker service's image is not rebuilt when only the code it imports changes

- **Package:** `@alchemy.run/docker` 2.0.0-beta.87 (`Service`).
- **What happens:** redeploys after changing modules the front imports updated the runner image
  and pool, but not `PracticeFront`, which kept serving the old bundle. It rebuilt only once a prop
  changed (`env.FRONT_REVISION`).
- **Proposed change:** include the bundle's content hash in the resource's diff, as the pool's
  runner image does.

### 5. `waitForReady` in the conformance suite always waits three minutes

- **Package:** `packages/integration-tests/test/Domain/conformance/conformance.ts`.
- **What happens:** it parses `/ready`'s plain `ok` as JSON, so every try fails and it gives up
  quietly after 60 × 3 s.
- **Proposed change:** read text, or answer JSON from `/ready`.
