# Phase 11: the rulings D49 to D51, an upgrade, and a sixth swarm run

Phase 11 built the owner's rulings on phase 10's open points, ran an upgrade from phase 8's code on
the cluster, and ran the whole conformance suite on a local Docker swarm again, under the same
limits:

- **D49, the fence's identity** (local patch 6, in `@alchemy.run/effect-cluster`, and the fence
  made strict). **The invariant held in every attempt.** There were six attempts; four counted
  under the case's own rule, and in the other two a write sent after the move still reached the
  paused runner. In every attempt the paused commit was refused at `COMMIT`. Every write the
  resumed runner decided before it took its shard back was refused at the fence's first read. Every
  refused write landed once, the last 12.03 s after the unpause. The derived bound is 33 s.
- **D50, a generic backlog reader.** The drain check now reads any publisher's backlog from its
  host's own rows. It agreed with Party's own query in process (one pending while held, none after
  draining), on phase 6's data on the cluster (none when drained, one with a decision undelivered),
  and in the upgrade. The in-memory platform keeps what it needs out of reach (proposal 09).
- **D51, retiring a closed generation.** The check is in `shared/tooling`, and stream pins gained a
  `Retired` state that keeps its length. Run against the cluster after P10, its verdict for
  generation 1 is **allowed**. Generation 1 was not retired.
- **The upgrade.** Phase 8's code was deployed and a decision was made with its fact undelivered.
  The check refused. Once the publisher drained, the check passed. The current code was then
  deployed over the same data, and the one review run concluded once.

Every case ran on one build (build A); the upgrade's first half ran on phase 8's code by design.

## D49: the fence's identity

### The two bootstrap sites, and PgClient

`@alchemy.run/effect-cluster` 2.0.0-beta.87 builds a PostgreSQL pool in two places
(`src/internal/Bootstrap.ts`; `lib/internal/Bootstrap.js` at the lines after the slash):

- **Line 170 / 133, `runExternal`.** It runs an existing Effect Cluster program as its own process.
  Its pool serves the gateway beside it, which joins the cluster `clientOnly: true` and holds no
  shards. The program it starts builds its own pool from `DATABASE_URL`. Its pool is left unnamed.
- **Line 312 / 221, `bootstrap`.** This is the runner launch for hosted entities, and it builds the
  pool that Effect's `SqlRunnerStorage` uses. `acquireLockConn` reserves the lock session from that
  pool (`effect` 4.1.4, `SqlRunnerStorage.ts:107-136`, `sql.reserve` at 110). This pool is now named.

`PgClient.layer` in `@effect/sql-pg` 4.1.4 takes `applicationName` (`PgClient.ts:124`). The value
overrides the startup parameter and the URL's.

### The name, and PostgreSQL's 63 bytes

`runnerPoolName(host, port)` is new in `Host.ts` and gives `effect-cluster:<host>:<port>`. The
bootstrap computes it from the same `host` and `RUNNER_PORT` it gives Effect as
`ShardingConfig.runnerAddress`, so both sides use one function on one address:

- The bootstrap names the pool with it.
- The fence (patch 4) computes the expected name with it from `ShardingConfig.runnerAddress`.

PostgreSQL keeps 63 bytes of `application_name` and replaces characters outside printable ASCII. A
name that would be cut or changed becomes `effect-cluster:#` plus an FNV-1a hash of `host:port`, so
two runners never share a cut name. Checked: `runnerPoolName("10.0.1.6", 34431)` gives
`effect-cluster:10.0.1.6:34431`, and a 70-character host gives `effect-cluster:#d46008cb`.

How it was patched: a second `patchedDependencies` entry,
`patches/@alchemy.run%2Feffect-cluster@2.0.0-beta.87.patch`, changes `src/Host.ts`,
`src/internal/Bootstrap.ts`, `lib/Host.js`, `lib/Host.d.ts` and `lib/internal/Bootstrap.js`. No
patch to `effect`. Six patches in all: five in `@alchemy.run/domain`, one here.

### The fence, strict

The fence's first read now accepts one session: the one named after this runner that holds the
shard's lock.

```sql
SELECT l.pid FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'advisory' AND l.classid = $classid AND l.objid = $objid
  AND l.objsubid = 2 AND l.granted AND $named <> '' AND a.application_name = $named
```

It has no fallback to the client address or to any holder. The `COMMIT`-time trigger is unchanged.
It checks that the same pid still holds the lock.

**On a deployment whose pool is not named.** No session carries the name, so the first read finds no
row. Every commit is refused with `ShardLost` and retried until the caller's budget (about 63 s)
runs out. Without a runner address, the name is empty and the same holds. This follows from the
SQL; no unnamed build was deployed to watch it.

Refusing is the right failure to send upstream, because it never acknowledges a write it cannot
attribute. But it is silent apart from the `commit fenced` lines. Upstream it should come with a
startup error for an unnamed pool. Alchemy's Effect Cluster platform builds runner pools only
through the bootstrap, so no such host exists today.

### Only the lock session holds locks in the cluster's namespace

Every lock in the namespace (classid 2839596291, objsubid 2) was attributed by name, each time with
`pg_locks` joined to `pg_stat_activity` (`p11-locks.txt`):

| When | Holders of locks in the namespace |
| --- | --- |
| After the first deploy | `effect-cluster:10.0.1.6:34431` (pid 62) and `effect-cluster:10.0.1.7:34431` (pid 65), 150 each |
| After P7b attempt 1 | 10.0.1.7's lock session rebuilt as pid 133, still named, 150 each |
| Rebuild probe | `pg_terminate_backend` on 10.0.1.6's lock session (pid 1190); within 15 s a new session (pid 3003) with the same name held all 150 again |
| After every P7b attempt | only the two named sessions, one per runner (the case asserts it) |
| After the upgrade | `effect-cluster:10.0.1.15:34431` and `effect-cluster:10.0.1.16:34431`, 150 each |
| For contrast, phase 8's code | `@effect/sql-pg` twice, 150 each: no session could be told apart |

No other session held a lock in the namespace at any sample:

- The domain's own pool (`@effect/sql-pg`, five to fourteen sessions) held none.
- Each runner pool's other sessions carry its name but held none.
- Patch 3's transaction locks (`pg_advisory_xact_lock(hashtextextended(...))`, objsubid 1) are
  outside the namespace and never appeared at a sample.

### Liveness: a refused write lands once, within 33 s

`REFUSED_WRITE_BOUND_MS` (`conformance/test/RecoveryBound.ts`) is derived from the cluster's
defaults, which a canary test reads from the installed `ShardingConfig.ts`. The bound adds five
delays, measured from the resume:

1. The resumed runner finds its lock session gone at its next lock refresh: 10 s.
2. The current owner sees it live again at its next assignment refresh: 3 s.
3. The owner hands the shard back once its entities stop: 15 s.
4. The resumed runner takes the lock at its next assignment pass: 3 s.
5. The caller's next retry: 2 s.

That totals 33 s, within the caller's `TRANSIT_RETRY` budget of 63.1 s. A retry that reaches the
current owner first commits sooner.

What happened to the write queued to the paused runner, in every attempt where that runner decided
it:

- The paused runner decided it on resume. It did not hold the shard, so the fence's first read
  refused it ("does not hold shard"). Nothing was written.
- The caller retried. In attempts 1, 2 and 5 the retry reached the runner that had taken over,
  which committed it 2.13 s after the unpause. In attempt 4 the retry committed on that runner
  0.11 s after the unpause. (In attempts 3 and 6 the paused runner never decided the queued write:
  it went to the other runner directly and committed 0.09 s after the unpause.)
- Writes the resumed runner refused later in those attempts were committed by it 12.0 s after the
  unpause. By then it had taken its shard back at 10.2 to 10.4 s, and its own session held the lock.

### P7b, every attempt

The case pauses the stale runner inside its commit and waits until the other runner's named
session holds the shard (it fails as "no takeover" otherwise). It sends a write at once, then
another after the move, and unpauses. After the unpause it samples the shard's holder every half
second. It checks:

- the paused commit was refused;
- every write after the unpause committed while its own runner's session held the shard;
- every label was stored once;
- the refused writes landed within the bound;
- only named sessions hold locks, one per runner.

It counts a run only if the paused runner decided the write sent at once (`queued`).

| Attempt | Takeover after pause | Counted (case's rule) | Paused commit | Invariant | Refused writes landed after unpause |
| --- | --- | --- | --- | --- | --- |
| 1 | 33.4 s | yes | refused before `COMMIT` | held | 2.13 s, by the new owner |
| 2 | 30.1 s | yes | refused before `COMMIT` | held | 2.14 s, by the new owner |
| 3 | 28.8 s | no: `queued` went to the new owner; the stale runner decided `other` after the move and was refused | refused before `COMMIT` | held | 12.0 s, by the stale runner after it took the shard back |
| 4 | 32.9 s | yes | refused before `COMMIT` | held | 0.11 s (new owner) and 12.0 s (stale runner, holding again) |
| 5 | 27.8 s | yes | refused before `COMMIT` | held | 2.13 s, by the new owner |
| 6 | 31.9 s | no, as attempt 3 | refused before `COMMIT` | held | 12.03 s, by the stale runner after it took the shard back |

Four of six counted under the case's rule, within the ceiling of twelve. Attempts 3 and 6 failed
only their final `counted` assertion; every other assertion passed. Under the brief's wording,
which counts a run when "a write reached the paused runner after its shard moved", they count too.
The case's rule is narrower and was left as it was during the run.

The phase 10 fence, which fell back to address, acknowledged such a write in three of five runs.

## D50: the drain check reads any publisher's backlog

### What it reads, from source

`shared/tooling/src/PublisherBacklog.ts`. `writerShapeOf` derives a writer from a hosted model: the
projection that lists the stream in `writes`, the tags it consumes, and the views it reads, followed
through views that read views. Each consumer comes with both of its generations:

- its delivery generation (`kernel.generationOf`);
- its storage generation (`kernel.classGenerationOf`). A view keyed by the one aggregate it reads
  is rebuilt in place and keeps storage generation 0 (`Kernel.ts`, lines 721-754).

`backlogOf` counts four things from the Durable Object platform's rows (`@alchemy.run/domain`
2.0.0-beta.87):

- **Deliveries staged to the writer.** These are the `outbox:<12-digit seq>` rows of its sources'
  instances (`queue`, `DurableObjects.ts:396`; the aggregate's outbox at 823, the view's at 1042).
- **Deliveries of a tag it consumes, staged for a view it reads.**
- **Inputs accepted and not handled.** For each key of the writer's class this is
  `accepted - processed` in its `meta` row (`ProjectionMeta`, line 1311).
- **An incomplete backfill run.** The run's phase is at `<class>Run/~run` under
  `run:<encoded target>` (`RUN_ROOT`, line 771; `Backfill.ts:1986`).

A row is deleted only after its delivery returns. So the reader skips a staged delivery the
consumer already took in: the key's `meta.intake` or the view snapshot's `checkpoints` has its
`seq` (`Platform.ts:302`). It is counted where it now waits.

### Both forms

- **SQL on a live cluster.** `conformance/test/HostBacklog.ts` reads the rows with one `json_agg`
  query, used by `Handover.conformance.ts` and `Upgrade.conformance.ts`.
- **Through the model's clients in memory.** The library does not allow it. The in-memory platform
  keeps its queue in a closure-local array of effects (`InMemory.ts:137`), and its projection
  partitions are closures too. `Control` exposes `idle` and `drain`; `Model.Internals` exposes the
  aggregate, view and stream stores. A queued delivery and a key's progress are out of reach.
  `conformance/test/HandoverBacklog.test.ts` runs the reader in process on the Durable Object
  platform over an in-process host instead, reading each instance's storage. What would make it one
  line on every platform is `notes/upstream/09-projection-backlog.md`: a `backlog` member on
  `Projection.Progress`.

### Agreement with Party's own query

The oracle is "decided claims whose fact generation 1 lacks", kept in the tests:

| Where | Held / undelivered | Drained |
| --- | --- | --- |
| In process, phase 8's publisher held in its handler | generic 1, oracle 1 | 0, 0 |
| Cluster, phase 6's dump, runners stopped | generic 1 (`throughViews`), oracle 1 | 0, 0 |
| Cluster, phase 8's code live (the upgrade) | generic 1 (`throughViews`), oracle 1 | 0, 0 |

On phase 6's dump, the undelivered decision is an event row plus its delivery to the review view
staged in the claim's outbox (and `outbox-seq`), added in a transaction that is never committed.
Afterwards both read 0 again. The reader matched real rows: one `ClaimFacts` meta (accepted 1,
processed 1), a complete run and six `ClaimReview` snapshots. The handover case ran twice on
build A, the second time after its helpers moved to `HostBacklog.ts`, with the same numbers.

## D51: a closed generation stops being served only by a checker rule

### The rule, the pins and the check

`StreamPin` (`shared/kernel/src/PublishedStream.ts`) gains `Retired { stream, length }`. A retired
pin keeps the number of positions the generation held, so the feed places later generations where
they were. Retiring is a pin change from `Closed` to `Retired`.

`checkGenerationRetirement` (`shared/tooling/src/GenerationRetirement.ts`) approves the change
against the live host's reading (each generation's entries, each consumer's checkpoint) only when:

- **(a)** the next served generation holds every fact version the retiring one held, with an equal
  payload (`Equal.equals` on the encoded payload);
- **(b)** every consumer in every deployment descriptor has a checkpoint at or past the last
  position the retiring generation held. A consumer is a descriptor that consumes any version of the
  feed's producer and contract; an unread checkpoint refuses;
- **(c)** the feed keeps later generations at the same positions: pins are append-only (none dropped
  or reordered), and the retired pin's length is the generation's live length;
- **(d)** D34 allows it: the composed descriptors pass the fact-retirement ledger (no consumed
  version unpublished).

Only a closed generation can be retired, and only one that was read. Refusals are a tagged union,
one case per condition.

Other changes:

- The stream-pin check treats a retired pin like a closed one: a writer on it is `Reopened`, and it
  may leave the model.
- The handover check treats retiring an open generation as closing it.
- `PartyFactsFeed.adapter.ts` now builds the feed from the pins (`partyFactsFeedFor(pins)`;
  `PartyFactsFeedLive` is it over `partyStreamPins`). Once generation 1 is retired, the feed serves
  none of it and offsets generation 2 by the pin's length.
- `liveGenerationOf` reads a generation as the check needs it, with the feed's encoding.

### Tests, both directions

`shared/tooling/test/GenerationRetirement.test.ts`:

- **Allowed** when all four conditions hold; a change that retires nothing is approved empty.
- **Refused** when:
  - a consumer is behind, or its checkpoint unread;
  - the next generation lacks a fact, or holds it with another payload;
  - the pinned length is wrong;
  - a pin is dropped;
  - the generation is open;
  - D34 refuses;
  - the successor was not read.

`party/host/test/PartyFactsFeed.test.ts`, after an allowed retirement:

- every checkpoint from 2 to 6 reads exactly the pages it read before;
- the consumer at 4 reads claim b's two versions and nothing it already handled;
- the four fact versions are each handled once in total;
- a consumer starting at 0 reads positions 3 to 6, each fact version once.

### The verdict on the cluster after P10

`conformance/test/Retirement.conformance.ts` (`RESTORE_PHASE=retirement`) ran on the state the
`across` case left. The live host held:

- generation 1: claim_wait's decision, v1 and v2, at positions 1 and 2;
- generation 2: claim_wait's and claim_restore's decisions, positions 1 to 4;
- Runs' checkpoint: 6.

It checked against all four descriptors.

**Verdict: allowed**, retiring positions 0 to 2. Generation 2 holds both of generation 1's entries
with equal payloads, Runs has read past 2, the pinned length 2 is the live length, and the D34
ledger is clean. Nothing was retired: `partyStreamPins` still has `PartyFacts` closed.

## The upgrade from phase 8's code

`conformance/test/Upgrade.conformance.ts` ran in two halves.

**Setup.** `git archive 0d11b18590d scratchpad/model-first-slices` was extracted under
`~/.cache/beep/mfs-p8/`, with the worktree's `packages/`, `node_modules/` and `tsconfig.base.json`
linked beside it, then installed with `bun install --frozen-lockfile`. Its own lockfile carries
phase 8's two-fix patch: no version check, no fence, no pool name.

1. **Phase 8's code deployed** from that tree with its own local state. Its lock sessions were the
   unnamed `@effect/sql-pg`.
2. **Decide half.** A fresh claim was asserted, and its review run reached `AwaitingApproval`. The
   claim's review-view snapshot was row-locked, then the proposal was approved. With the
   decision's delivery to the view waiting, the generic reader (phase 8's writer written out) gave
   1, in `throughViews`, and the oracle 1. The drain check refused. After the lock was released,
   both gave 0 and the check passed. The run completed.
3. **The phase 8 deploy's state** was copied into this tree's empty `apps/practice/.alchemy/state/`.
4. **This code deployed over it.** Alchemy updated five resources in place and kept the Postgres
   service and its volume. The images carry build A's input hashes, and the lock sessions were
   named.
5. **After half.** `ClaimDecisions`' backfill completed (one subtree, two instances). Generation 2
   holds the decision's v1 and v2, both equal to generation 1's. Runs' checkpoint reached 4, the end
   of both generations. The one review run in this deployment's data concluded once: one
   `RunCompleted`, state `Completed`, one seen key. No `never published` line appeared on either
   runner.

The after half failed on its first attempt. It waited for `ClaimDecisions`' backfill before any call
reached Party, and a consumer's backfill run starts on its model's first call after a deploy: after
60 s there was no run row, while `SlotTally`'s had started on the probe's call. The case read SQL
only. It now reads the claim's review first, and passed on the same data.

## Conformance on the swarm, beside phase 10

Evidence is in the scratchpad: `p11-*.txt`, `p11-evidence.log`, `p11-locks.txt` and
`phase11-state.md`.

About build A:

- It is this tree, deployed three times: deploys 1, 2 and 4, with runner image input hash
  `f4058bf1d6499302` and front `4f0a53405198dd0d`.
- Deploy 2's images were created at deploy 1's build time, from reused layers; their image IDs
  differ.
- Between deploys, only test files and notes changed, and those are not in the images.
- Build P8 is phase 8's code (runner `bbd00a70473d43bd`), used for the upgrade's first half only.

| Case | Phase 10 | Phase 11 | Build |
| --- | --- | --- | --- |
| U1 to U10, upstream's Domain conformance | 10 pass | **10 pass** | A |
| P1 a command sent twice | pass | **pass** | A |
| P2 a lost response | pass | **pass** | A |
| P3 a runner killed right after a commit | pass, 67.7 s | **pass**, 67.0 s (bound 80 s) | A |
| P4 a projection crash between sink write and checkpoint | pass | **pass** | A |
| P5 a grant revoked between two hops | pass | **pass** | A |
| P6 a run waiting for approval across a restart | pass | **pass** | A |
| P7 stale runner paused in `decide` | pass, takeover | **pass**: on resume its write was refused ("does not hold shard") and never stored; a write sent during the pause waited for the paused runner (its client gave up at 60 s), then was committed once by it after it held the shard again | A |
| P7b stale runner paused inside its commit (D49) | invariant held in 1 of 5, violated in 3 | **invariant held in 6 of 6**; 4 counted by the case's rule | A |
| P8 backup and restore with pending scheduled work | pass | **pass**: the hold expired after the restore | A |
| P9 stored forms written directly | pass | **pass** | A |
| P10 phase 6's dump under the new code | pass | **pass**: generation 2 complete, runs concluded once | A |
| D46 a consumer added over existing data | 11 of 11 | **11 of 11** | A |
| D47/D50 the drain check on phase 6's data | pass (Party's query) | **pass** (generic reader, agreeing with the oracle), run twice | A |
| D51 retirement verdict after P10 (new) | not run | **allowed** for generation 1; not retired | A |
| Lock-session rebuild probe (new) | not run | **named again within 15 s** | A |
| Upgrade from phase 8's code (new) | not run | **refused while undelivered, passed drained; the run concluded once** | P8 then A |

One operator error: at 05:19:56 I called `restore11.sh` with no dump argument. The runners were
already at 0 and pg_restore got no input and exited 1, so nothing was restored or dropped. The
script then scaled the stack back 10 s before the planned scale-up. The handover case's data was
unchanged.

## What still falls short

- **The paused runner holds up a write sent during the pause.** In P7, a write sent while the
  runner was paused in `decide` waited for that runner rather than reaching the runner that held
  the shard. Its client gave up at 60 s, and it was committed once after the resume. That is
  liveness, not safety; the fence kept it correct.
- **Two P7b attempts did not count under the case's own rule.**
- **The reader cannot run on the in-memory platform.**
- **The upgrade's data was fresh, with one decision and one run**, not phase 6's.
- **Generation 1 is still served**, though the check now allows retiring it.

## D5 verdict

**Not met. The repo-owned Postgres platform is not retired.** Every case passed on one build and
D49's invariant held in every run. But the pass rests on six local patches that are not upstream,
and D38 rejected treating a patched pass as meeting the gate. Nothing has gone upstream (D52).

## Teardown

In order:

1. `alchemy destroy` for the stage. That was the third destroy; the first two were for P8's restore
   and the upgrade.
2. Two images were removed:
   - the runner image of build P8, left by the state move (`8bac9949d146`);
   - the `postgres:17-alpine` the deploys pulled, by its digest (`d3244e8c`).
3. `docker swarm leave --force`.
4. `docker network rm docker_gwbridge`.
5. `apps/practice/.alchemy/` was deleted, and so was `~/.cache/beep/mfs-p8/`.

No `practice-*` or driver service, container, network, volume or image remains. Against
`docker-baseline-6.txt` the only difference is Docker's build cache: 808 MB before, 829.3 MB after.
It was not pruned. Free disk is 218 GB. The load guard (wait while the 5-minute load is above
128) never had to wait.

Every restore waited until the old containers were gone, which took 4 to 6 s.

## Gates

- `bun run check`: 0 diagnostics over all 17 projects.
- `bun run test`: 188 tests in 51 files pass, and 109 of 109 outcomes are executed.
- `handlers:check`, `generated:check` and `outcomes` pass.
- `PROOFS.md` is regenerated with 40 entries:
  - new: `publisher-backlog`, `generation-retirement`;
  - updated: `commit-fence`, `publisher-handover`, `cluster-two-runners`, `cluster-stored-forms`.
- No inline directive was added, and no home path is in the tree.
- The monorepo root's `package.json` and `bun.lock` hashes are unchanged (`86c211ae5e2fd4bf`,
  `71b20c66a8fa65f7`), and its `patches/` is untouched.
- The prototype's `package.json` gained the second `patchedDependencies` entry. Its `bun.lock`
  gained that entry and two workspace devDependencies of `conformance`: `@proto/party-host` and
  `@proto/runs-host`, for the descriptors.

## The upstream set (nothing sent, D52)

The patches against upstream at 33c10dd, apply-checked in four orders:

- **01, 02, 03, 06 and 07** in `packages/domain`. 07 is rewritten for the strict fence and needs 08
  to compile.
- **08, new**, `08-name-the-runner-pool.patch` in `packages/effect-cluster`. Its failing case is the
  unnamed sessions on phase 8's code against the named ones here.
- Applied to the pristine sources, 01, 02, 03, 06, 08 and 07 reproduce the installed `src` of both
  packages exactly.

The write-ups:

- 04, on leases;
- 05, on the published stream after a rebuild;
- 09, new, the backlog call.

Phase 10's proposal that Effect name the lock session is now a short "alternative, not taken"
section at the end of 08, and its file `08-effect-name-the-lock-session.md` is deleted.

## What I did not verify

- **The refusal on an unnamed pool.** It follows from the SQL; no unnamed build was deployed.
- **Holders between samples.** After the unpause the holder was sampled every half second; a
  commit is judged by the last sample before its time.
- **The retired feed on the cluster.** Generation 1 was not retired, so `partyFactsFeedFor` with a
  retired pin ran in process only.
- **The generic reader on Cloudflare or Rivet**, and on more than one decision in flight.
- **An upgrade from phase 6's data through phase 8's code**, or a rolling deploy of mixed versions.

## Decisions for the owner

1. **Whether to send 07 and 08 together**, with a startup error for an unnamed pool added first.
   The error is a change to patches 4 and 6, not a seventh patch.
2. **Whether attempts 3 and 6 count.** Under the brief's wording they do, which makes six of six.
3. **Whether to retire generation 1** now that the check allows it.
4. **Whether to ask the library for the backlog call** (proposal 09).
5. **The full upstream set for D52**: patches 01 to 03 and 06 to 08, write-ups 04, 05 and 09.
6. **Whether a write held up by a paused runner (P7) needs work**, given the fence keeps it
   correct.
