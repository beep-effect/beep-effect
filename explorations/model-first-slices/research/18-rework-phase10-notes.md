# Phase 10: the rulings D45 to D47, and a fifth swarm run

Phase 10 built the owner's rulings on phase 9's open points and ran the whole conformance suite on
a local Docker swarm again, under the same limits:

- **D45, the commit fence** (local patch 4). It refused the paused runner's commit in all five
  counting runs. **The invariant did not hold in every counting run**: in three of the five, a
  write queued to the paused runner was committed by it after its shard had moved. The fence cannot
  tell its own runner's lock session from another runner's on this stack, and the change that would
  let it is in Effect, which would be a sixth patch. Stopped there; proposal 08.
- **D46, the call-argument fix** (local patch 5). A new consumer's backfill now lists the directory
  on Effect Cluster. A view added over phase 9's data holds every earlier write, and generation 2 of
  Party's facts now holds phase 6's decision.
- **D47, the publisher-drain check.** It is in `shared/tooling`, driven by the stream pins. It
  refuses an upgrade while the outgoing publisher has a decision unpublished, and passes once it
  has drained. In memory and on the cluster, the fallback for never-published decisions was not
  taken.

Every other case passed.

## How Effect Cluster 4.1.4 records and moves shard ownership

This is read from the installed `effect` 4.1.4 source, which is identical for these files to the
reference checkout (`~/YeeBois/references/effect/effect`, `packages/effect/src/cluster/`).

- **Locks.** A shard is a session-level PostgreSQL advisory lock with two keys, taken with
  `pg_try_advisory_lock(namespace, lock)` (`SqlRunnerStorage.ts:485-488`):
  - `namespace` is FNV-1a of `effect-cluster:<prefix>` (`:51`), here `effect-cluster:cluster`,
    which `pg_locks` shows as `classid 2839596291`;
  - `lock` is `(group index + 1) * 1000000 + shard` over the sorted available groups (`:457-466`).
  - When advisory locks are disabled, rows in a `locks` table are used instead (`:347-366`).
- **Which connection.** All of a runner's locks are on one reserved connection, the lock session
  (`acquireLockConn`, `:107-136`). Its `idle_session_timeout` is set to `shardLockExpiration`
  (35 s), so a frozen runner's session is ended by the server and its locks go (`:126-136`).
  Refreshing a lock only confirms what that session's pid holds (`pgHeldLocks`, `:314`;
  `refreshShards`, `:520`).
- **The domain's connections are another pool.** The runner storage's pool is the one
  `@alchemy.run/effect-cluster`'s bootstrap builds (`Bootstrap.ts:312`). The domain's object
  storage opens a pool of its own (`EffectCluster/index.ts`, `layerEntities`,
  `PgClient.layer({ url })`). A commit therefore runs on a different session from the one that
  holds its shard.
- **What moves a shard.** A runner is listed only while its heartbeat in `cluster_runners` is
  newer than the lock expiry (`getRunners`, `SqlRunnerStorage.ts:652`); the heartbeat is updated by
  each lock refresh (`:695`). Shards are assigned by a hash ring over the listed runners, every
  `refreshAssignmentsInterval` (3 s) (`Sharding.ts:1484`, `:1563`). An assigned shard is then
  taken with `pg_try_advisory_lock`, which succeeds once the old session has ended (`:648`).
  - An entity's shard is `abs(hashString(id) % 300) + 1` (`:343`).
  - The defaults are in `ShardingConfig.ts:242-261`: 300 shards per group, refresh every 10 s,
    lock expiry 35 s, assignments every 3 s, health checks every minute.
- **The health check does not move shards here.** It is a singleton registered in group `default`
  (`Sharding.ts:2130`), while this pool serves only `alchemy:default` (the deploy sets
  `CLUSTER_SHARD_GROUPS`). No runner owns that singleton's shard, so it never runs. The move comes
  from the heartbeat and the lock session both lapsing at 35 s.

### The coordinator's observation about two pauses in five

The lock does not survive `docker pause`. The server ends the paused runner's idle lock session
after 35 s. This phase sampled the holder each second: in all five pauses the shard's lock passed
to a session of the other runner 28.8 to 36.4 s after the pause.

Phases 8 and 9 judged a takeover by which runner decided the next write, not by the lock. This
phase shows the two differ: in three of five runs the shard had moved, yet the next write was
routed to the paused runner and waited there until it resumed. Phase 9's runs 1 and 3, read as "no
takeover", fit that pattern, though the lock was not observed then.

## D45: the commit fence (patch 4)

### Which option, and why

The two options were to make a takeover wait for the open commit, or to check ownership where a
moved shard is seen before the commit completes. **The fence uses the second.**

- **Why a takeover cannot wait.** It needs only the old lock session to end. The commit's
  connection cannot take or share that lock: it is held exclusively by a different session, and a
  shared request would wait on the runner's own lock session.
- **How the fence works.**
  - First in each transaction, after the instance's advisory lock from patch 3, it finds the
    session holding the shard's lock that is this runner's, and records its pid in a
    transaction-local setting.
  - A deferred constraint trigger, run at `COMMIT` on the `meta` row, checks that the same pid
    still holds the lock. Otherwise it raises SQLSTATE `AD001`.
  - The storage reports a failure at either step as `ShardLost`, logs it (`commit fenced: ...`),
    and the commit fails the call as `CommitConflict` does. The commit is never acknowledged, and
    its caller retries under the same command id, starting from the receipt lookup.
- **Why at `COMMIT`.** The check runs after the last point at which the runner itself can stall.
  The SQL was validated in an in-process Postgres before the deploy (PGlite).

### Where the fence falls short

A session cannot be attributed to its runner on this stack:

- every session reaches Postgres from the swarm network's load-balancer address (`10.0.1.4`);
- every session has the client's default name, `@effect/sql-pg`;
- Effect does not expose its lock session's pid.

The fence takes the session Effect would name `effect-cluster:<host>:<port>`, and failing that the
one from this runner's address. On this stack that means any holder.

**What it does exactly:** it refuses a commit during which the shard's lock changed hands. That
covers the paused-inside-commit timing.

**What it misses:** a commit that starts on a runner after it lost its shard is attributed to the
new holder and passes. This happens when its in-memory ownership is still stale, or a request was
queued to it while it was paused. Attempts 2, 3 and 5 below are that case.

The smallest change that makes the fence exact is for Effect's SQL runner storage to name its lock
session after the runner, in the statement where it already sets the timeout
(`notes/upstream/08-effect-name-the-lock-session.md`). That is a patch to `effect`, a sixth local
patch, so I stopped there and report it. Exposing the lock session's pid on `RunnerStorage` would
do as well.

### The version check and the advisory lock

Both stay; the fence makes neither redundant.

- **The advisory lock** still serializes commits on one instance. A new owner therefore cannot
  commit before an open, fenced commit has ended.
- **The version check** still refuses a new owner's commit decided on a state read before an older
  commit landed. A takeover that completes inside the server's commit, between the trigger and the
  commit record, is exactly this case.

### On other hosts

- **Durable Objects and Rivet:** unaffected. The fence is in the Effect Cluster storage only, and
  their storage admits one instance at a time.
- **In memory:** unchanged.

### Below the cluster

`conformance/test/FencedCommit.test.ts`. The in-process host can model ownership at the level the
domain sees it (`SimHost` `fenced`): a transaction whose runner no longer serves the instance when
it commits is rolled back and dies with `ShardLost`. The case:

1. Runner 0 decides.
2. The instance moves to runner 1, which commits nothing.
3. Runner 0 commits with the version unchanged.

Without the fence, runner 0 is acknowledged. With it, runner 0 is refused and the retry commits on
runner 1.

The test cannot model Postgres sessions, so it does not show the attribution gap.

`SimHost` now also routes a call when it runs, as a cluster call does, so that a retry reaches the
current runner.

### P7b, rewritten to the invariant

The case:

1. A first write gives the slot a `meta` row; the runner that decided it is the owner, and the
   holder of the slot's shard lock is its lock session.
2. The held write's commit is stopped on a row lock, and its runner is paused with the transaction
   open.
3. Each second it samples the shard's lock holder, the paused transaction's state, the heartbeats
   and the lock counts per session.
4. A run counts only if another session holds the lock while the paused transaction is still open;
   otherwise it fails as "no takeover".
5. The other runner then writes, and the paused runner is unpaused.
6. The invariant is judged in three checks:
   - the paused commit was refused at `COMMIT` (the fence's log line), and the version it decided
     on went to the other runner's write;
   - any later write of the paused runner committed while the other runner's session no longer held
     the shard;
   - every acknowledged write is stored once.

Because the move is driven by the 35 s lapse, the takeover is as deterministic as the mechanism
allows: five attempts, five takeovers.

| Attempt | Takeover after | Paused commit refused at COMMIT | Next write | Invariant |
| --- | --- | --- | --- | --- |
| 1 | 29.9 s | yes | `other` by the owner at v2; `held` retried and committed by the paused runner at v3, 15 s after unpause | paused commit not acknowledged; the retry's ownership was not sampled (this attempt ran before the post-unpause sampling was added) |
| 2 | 28.8 s | yes | `other`, queued to the paused runner, committed by it at v2 while the other runner's session held the shard | **violated** |
| 3 | 32.1 s | yes | as attempt 2 | **violated** |
| 4 | 36.4 s | yes | `other` v2 and `held` v3 by the owner | **held** |
| 5 | 34.9 s | yes | as attempt 2 | **violated** |

Five counting runs, within the ceiling of ten. The fence did its part in all five: the paused
commit was refused every time. The invariant held in one run and was violated in three, all by the
attribution gap above. Attempt 1 is not judged on its later write.

## D46: the call-argument fix (patch 5)

### Cause and fix

The defect is in the transport. Effect Cluster carries a call's arguments as `JSON.stringify(args)`,
which turns a left-out optional argument into `null`. Durable Objects (structured clone) give
`undefined`, and the object code is written for that.

The audit of every call through `DurableObjects.ts`'s stubs found these with optional arguments:

- `list(path, after)`: broken. The directory node lists children only when `after === undefined`,
  and the storage queries `key > NULL`.
- `bfStart` and `bfConsumerReady`, with `waitMillis = 0` defaults: `null` skips the default, and they
  behave only because `null <= 0`.
- `page(range)`: survives, through optional chaining.

The others pass defined arguments. Results cross as `JSON.stringify(result ?? null)`; no caller
tells `null` from `undefined` in a result.

Every optional parameter is trailing, so the class is fixed at the transport. `encodeCallArgs`
(`DurableObjects.ts`) leaves trailing `undefined` arguments out, and the object sees them as
`undefined`. The wire format is unchanged (a shorter array), so a rolling deploy is safe both ways.

### Reproduced in process

`conformance/test/BackfillArgs.test.ts` runs `SimHost` with arguments crossing as the transport
carries them:

| Arguments cross as | Bookings in the view a deploy adds |
| --- | --- |
| `JSON.stringify`, before the fix | 1 (only the booking after the deploy) |
| `encodeCallArgs` | 4 (3 earlier, 1 after) |

### On the cluster

`conformance/test/Backfill.conformance.ts` runs this phase's code over phase 9's dump. `SlotTally`,
new in phase 10, held all 11 earlier slot writes. Its run listed 4 subtrees and 8 instances; phase
9's backfill run logged `subtrees=0`.

### P10, rerun

Generation 2 now holds `claim_wait`'s decision. It was republished by `ClaimDecisions`'s backfill
(6 subtrees, 12 instances) through the generation 1 lookup, and its entries are identical to
generation 1's. `claim_restore`'s decision follows it.

Consumers still saw each fact once:

- the inbox's checkpoint went from 2 to 6 (generation 1's two entries, then generation 2's four);
- it kept one key per fact;
- each review run has one `RunCompleted` and seven receipts.

### What would have to be true before generation 1 could stop being served

It is still served, and was not retired.

1. **Generation 2 is complete.** Every fact in generation 1 is in generation 2 with the same
   payload. That is true now.
2. **Every consumer has read past generation 1.** That is true for the runs inbox here, but it
   would have to be checked for every producer's consumers.
3. **Positions stay put.** The feed keeps serving generation 2 at generation 1's length plus its
   own positions, so checkpoints keep their meaning.
4. **D34's retirement rule allows it.** No composed consumer still depends on what only
   generation 1 holds.

## D47: an upgrade that replaces a publisher drains the old one first

### The rule and the check

**The rule:** a deploy that closes a published stream's generation, or gives it another writer, is
refused while the outgoing publisher has anything pending.

**The check:** `checkPublisherHandover` (`shared/tooling/src/PublisherHandover.ts`) takes the live
code's pins, the next code's pins and the backlog read from the live host:

- `handoversOf` finds each generation the deploy takes from its writer: `closed` or `replaced`;
- the check fails with `PublisherPending` while any of those writers has `pending > 0`, or its
  backlog was not read.

### How it reads "pending"

At the domain level: decided claims, those with a decision event in the claim's own events, whose
`ClaimDecided` the outgoing generation lacks.

- **In memory:** through the model's clients (the claim's state and the stream).
- **On a live cluster:** through SQL over the host's storage
  (`conformance/test/Handover.conformance.ts`).

I did not use the library-level counts phase 4 showed (`accepted` and `processed`). The outgoing
publisher reads the review view, so its pending work also sits in the claims' and the view's
outboxes before it is accepted. The domain-level query sees all of it, but it is specific to
Party's publisher.

### How an operator runs it

Before `alchemy deploy` of code that changes `StreamPins.ts`, run
`test/Handover.conformance.ts` with `RESTORE_PHASE=handover` through the one-shot driver on the
live stack's network, with the live code's pins in the case. Deploy only once it passes.

### The cases

- **In memory** (`party/model/test/Handover.test.ts`).
  1. Phase 8's publisher is live with a claim of two review runs, decided directly with no scope.
  2. Its fact is held undelivered, and the check refuses the upgrade (pending 1).
  3. The old publisher drains; the check passes and returns the handover (`PartyFacts` closed).
  4. The new code republishes the decision into generation 2 with both review runs, which is the
     generation 1 lookup. The fallback would have named no run for this direct decision, so it was
     not taken.
- **On the runs side** (`runs/host/test/RunsHost.test.ts`). A fact served twice, in generation 1
  and again in generation 2, concludes each of its two review runs exactly once.
- **On the cluster** (`Handover.conformance.ts`), against phase 6's data with the runners stopped:
  - the check passes on the data as dumped (pending 0);
  - it refuses once an undelivered decision is added (pending 1), inside a transaction that is
    then rolled back;
  - the data was unchanged afterwards.
- **What the cluster cannot show.** The drain itself was not exercised there, because the old code
  was not deployed. The phase 6 dump holds no undelivered decision.

### The fallback

Kept, and now logged at error level. In P10 it was not taken: no `never published` line appeared
on either runner. `claim_wait` is an approval, whose fallback would name the same run as the
lookup, so the log is the evidence there.

## Conformance on the swarm, beside phase 9

Evidence is in the scratchpad: `p10-*.txt`, `p10-evidence.log` and `phase10-state.md`.

| Case | Phase 9 | Phase 10 |
| --- | --- | --- |
| U1 to U10, upstream's Domain conformance | 10 pass | **10 pass** |
| P1 a command sent twice | pass | **pass** |
| P2 a lost response | pass | **pass** |
| P3 a runner killed right after a commit | pass, 66.8 s | **pass**, 67.7 s (bound 80 s) |
| P4 a projection crash between sink write and checkpoint | pass | **pass**, window forced |
| P5 a grant revoked between two hops | pass | **pass** |
| P6 a run waiting for approval across a restart | pass | **pass** |
| P7 stale runner paused in `decide` | pass, no takeover | **pass**, takeover this time: the other runner committed B at v1 in 23 ms; the stale runner never committed A |
| P7b stale runner paused inside its commit | stale runner acknowledged, 3 of 3 | **rewritten (D45):** 5 counting runs; paused commit refused in 5; invariant held in 1, violated in 3, unjudged in 1 |
| P8 backup and restore with pending scheduled work | pass | **pass** |
| P9 stored forms written directly | pass | **pass** |
| P10 phase 6's dump under the new code | pass, generation 2 incomplete | **pass**, generation 2 complete |
| D46 (new) a consumer added over existing data | not run | **pass**: 11 of 11 earlier writes |
| D47 (new) the publisher-drain check on live data | not run | **pass**: passes as drained, refuses with a decision undelivered |

## What still falls short

- **D45's invariant.** It is not established on this stack: three of five counting runs violated
  it. The fence needs the identity of its runner's lock session from Effect (proposal 08), which
  would be a sixth patch.
- **The drain check is specific to Party's publisher.** Its backlog query knows Party's decisions.
  A generic check would need the library to expose a writer's backlog.
- **The cluster did not exercise the drain itself.**
- **Generation 1 is still served.**

## D5 verdict

**Not met. The repo-owned Postgres platform is not retired.**

1. **D45's invariant fails on the cluster.** A runner that lost its shard can still be acknowledged
   when a request queued to it runs after it resumes.
2. **The pass rests on five local patches** that are not upstream (D41 keeps D38's other half).
3. **Exactness needs a change in Effect** that the five-patch limit excludes.

Everything else passed, including the upgrade cases that phase 9 left short.

## Teardown

In order:

1. `alchemy destroy` for the stage.
2. The `postgres:17-alpine` image the deploys pulled was removed by its digest (`d3244e8c`).
3. `docker swarm leave --force`.
4. `docker network rm docker_gwbridge`.
5. `apps/practice/.alchemy/` was deleted.

No `practice-*` or driver service, container, network, volume or image remains. Against
`docker-baseline-5.txt` the only difference is Docker's build cache: 786.6 MB before, 808 MB after
(+21.4 MB). It was not pruned. Free disk is 212 GB.

Every restore this phase waited until the old containers were gone (4 to 5 s after `scale
--detach=false` returned).

## Gates

- `bun run check`: 0 diagnostics over all 17 projects.
- `bun run test`: 175 tests pass, and 109 of 109 outcomes are executed.
- `handlers:check` and `generated:check` pass; `PROOFS.md` is regenerated, with three new entries
  (`commit-fence`, `call-arguments`, `publisher-handover`).
- No inline directive was added.
- The monorepo root's `package.json`, `bun.lock` and `patches/` are unchanged. The prototype's
  `bun.lock` gained the conformance package's two new workspace devDependencies.

## What I did not verify

- **Which code each case ran on.** The cases before P8's redeploy ran on a build whose fence
  identified sessions by address only. The final code first tries the session name. No session on
  this stack is named `effect-cluster:*`, so the behaviour is the same, but upstream's ten, P1 to
  P7, P7b and P9 did not rerun on the final build. P8, D46, D47 and P10 did.
- **Whether attempt 1's later write was committed by an owner.** Its holder was not sampled.
- **The fence with Effect naming its lock session.** Proposal 08 is unbuilt, so that path is
  untested.
- **The backfill across a rolling deploy of mixed code versions.**
