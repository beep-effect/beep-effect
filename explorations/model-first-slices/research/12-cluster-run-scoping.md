# Scoping the cluster run — 2026-11-13

Read-only fact-find by a sub-agent (Claude Opus 5.5) over the upstream source, to scope D5 and D16:
running an `@alchemy.run/domain` model on Effect Cluster with Postgres on one workstation, and
testing it for conformance. Nothing was run. The citations were not individually re-read by the
orchestrating session, except that the commit path in `DurableObjects.ts` and the upsert in
`EffectCluster/index.ts` match what it read earlier the same day.

Roots: **A** = `~/YeeBois/references/effect/alchemy` at `33c10dd` (2.0.0-beta.87); **E** =
`~/YeeBois/references/effect/effect/packages/effect` at `d28a692` (4.1.4).

## 1. The local Docker route

- `Database(id)` (`A/packages/effect-cluster/src/Docker/Database.ts:48-94`) creates a random
  password (`:60`), an overlay network (`:65`), a named volume `${id}Data` (`:67`) and a one-replica
  swarm service running `postgres:17-alpine`, with the password as plain env, database `cluster`,
  alias `cluster-db` (`:72-80`). No host port unless `port` is set (`:76`). No swarm secrets.
- `SwarmPool(id)` (`SwarmPool.ts:48-83`, via `internal/PoolHost.ts:123-262`) creates a pool, a
  gateway token (`:174`), a locally built image (`skipPush`, tagged with the bundle hash;
  `SwarmPool.ts:63-67`) and a swarm service with `replicas` on the database's network. The gateway
  is published only if `gatewayPort` is set (`:73-76`).
- Image: rolldown bundles `internal/runner.ts` plus a virtual module importing every `main` into
  `.alchemy/cluster/<label>/runner.mjs` (`PoolHost.ts:37-56, 286-330`). The Dockerfile is
  `FROM node:26-slim`, runs `node /app/runner.mjs`, exposes 34431 and 34500 (`:110-116`).
- Swarm: required, and never initialised by this code. The overlay network and
  `docker service create` assume it (`Database.ts:36,65`; `docker/src/Service.ts:856`). Upstream's
  tests run `docker swarm init --advertise-addr 127.0.0.1` themselves
  (`A/packages/integration-tests/test/Docker/Runtime.ts:32-45`).
- Commands: `alchemy deploy` and `alchemy destroy`. There is no dev path in `effect-cluster/src`.
- Teardown removes the services, network and runner image and **deletes the Postgres volume**
  (`docker/src/Volume.ts:178-182, 370-378`; `Database` sets no retain or protect). Left behind: the
  swarm, pulled base images and `.alchemy/`.

## 2. State and credentials

Purely local: `Alchemy.localState()` writes to `<cwd>/.alchemy/state`
(`A/packages/alchemy/src/State/LocalState.ts:32-34`). No cloud account is needed. Env read:
`ALCHEMY_STAGE` (default `live_$USER`), `.env`, `DOCKER_BIN`, `DOCKER_AUTH_CONFIG`, the Docker
context, `NO_DESTROY`.

## 3. A lighter route

None is supported. On a runner, `layerEntities` needs `RunnerHost`, which only the runner bootstrap
provides (`domain/src/EffectCluster/index.ts:745-773`; `internal/Bootstrap.ts:233-246`). Postgres
access is hard-wired to `@effect/sql-pg` (`index.ts:574-583`; `Bootstrap.ts:312`), so PGlite does
not work. Alchemy never uses Effect's `SingleRunner` or `TestRunner`; Domain-on-Cluster is tested
only on a swarm (`test/Cluster/Domain.test.ts`). Hosting a model in process on Effect's own test
layers would mean re-implementing `Bootstrap.ts:201-368`.

## 4. Upstream's conformance suite

- The entity suite is `test/Cluster/conformance.ts` (24 cases now), with workflow (9) and scheduled
  (2) suites beside it.
- The Domain suite is `test/Domain/conformance/conformance.ts:53-221`, ten cases: a command commits
  and replies; a live read is pushed over a WebSocket; a rejection commits nothing; a command sent
  twice under one id commits once; view paging in both orders; commands to one instance run one at
  a time; a view applies each event once, in order; a policy starts a saga and its step commits; a
  scheduled command runs when due; a cancelled command never runs.
- It needs Docker and a swarm, nothing else. It drives the routes of upstream's fixed `app.ts` over
  its own `model.ts`, and accepts any `url`, so another project can vendor those files and host the
  conformance model on its own host.

## 5. The commit does not check the stored version

`commit` reads the receipt and `meta` outside the SQL transaction, then writes events, `meta`, the
receipt and the outbox inside it (`domain/src/DurableObjects.ts:802-854`). Each write is an
unconditional `ON CONFLICT DO UPDATE` (`EffectCluster/index.ts:208-210`).

Two things keep one aggregate's commands one at a time: an in-process input gate
(`index.ts:256-257`) and Effect's shard locks (refreshed every 10 s, expiring after 35 s;
`E/src/cluster/ShardingConfig.ts:246-247`). Effect checks shard ownership before saving a reply
only for persisted messages (`E/src/cluster/internal/entityManager.ts:416-426`), and the Domain
`Call` RPC is volatile (`index.ts:164-168`). So during a failover a runner paused past its lock
expiry can still commit, and would overwrite `event:<seq>`.

## 6. Entry modules

`main` goes into the virtual module as an import and is bundled into the runner
(`PoolHost.ts:37-56, 233-241`). The module must export the model Layer, as `default` or under
`handler`. A generated file is accepted the same way if it is passed as `import.meta.url` or an
absolute path and its imports resolve from where it lives. Changing its content produces a new
image.

## 7. Restore

Everything is in the Postgres database `cluster`: `alchemy_domain_objects(object, key, value)`
holds events, `meta` (state and version), receipts, the outbox, schedules, backfill rows and the
rows of views, projections, policies and streams; `cluster_messages` and `cluster_replies` hold
saga runs, timers and persisted messages. The Postgres password lives only in Alchemy state, so a
restored volume needs the matching `.alchemy/state`. Upstream has no backup, restore or export
support.

## 8. `waitsFor` and `atLeast`

They wait, by polling: every 25 ms until the checkpoint reaches the version, up to 10 s by
default, then `ConsistencyTimeout` (`domain/src/Model.ts:890-921`).

## 9. `Cluster.EntityState`

Absent from `effect-cluster/src`, `domain/src` and Effect 4.1.4's cluster module.

## Smallest sound way to run conformance on one workstation

1. `docker swarm init --advertise-addr 127.0.0.1`.
2. Deploy a stack with `ClusterDocker.Database` and `SwarmPool`, then run the vendored Domain
   conformance cases plus the prototype's own against it.

It creates: an overlay network; a Postgres volume and service; a runner service with its local
image; a front service on a host port through swarm ingress; pulled `postgres:17-alpine`,
`node:26-slim` and `oven/bun:1` images; a `.alchemy/` directory with state and bundles.

To remove it: `alchemy destroy` (services, network, volume, runner image), then
`docker swarm leave --force`, then remove the base images and `.alchemy/`.
