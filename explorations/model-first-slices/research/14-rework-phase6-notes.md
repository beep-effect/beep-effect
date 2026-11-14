# Phase 6: two library patches, and the conformance suite again on the swarm

Phase 5 left three of the prototype's cluster cases failing on two library defects. This phase
patched both defects in the prototype's own workspace, reran all eighteen cases on a local Docker
swarm with Postgres, tightened two weak cases, added one timing to the two-runners case, and
tore the stack down.

Both patches are fixes, not workarounds. Of the eighteen cases, fifteen pass. Three do not:

- **P3** fails as written, on timing. The patched recovery waits out a 60 s lease, and the
  case's read gives up after about 10 s.
- **P5** fails on a model defect, with the revocation now landing mid-chain.
- **P7b**, the new two-runners timing, reproduced the overwrite D38 describes.

## How the patch is applied, and what each consumer runs

The patch is `patches/@alchemy.run%2Fdomain@2.0.0-beta.87.patch`, listed under `patchedDependencies`
in the prototype's `package.json`. `bun patch` created it, and `bun install` applies it. The
prototype's `bun.lock` gained the `patchedDependencies` entry. The monorepo's root `package.json`,
`bun.lock` and `patches/` are unchanged: they were hashed before and checked after, and
`git status` shows no change outside `scratchpad/model-first-slices/`.

The package exports each module as `{ types: lib/*.d.ts, bun: src/*.ts, default: lib/*.js }`.
Which file a consumer loads:

| Consumer | Resolves | Evidence |
| --- | --- | --- |
| Local tests (vitest under Node) | `lib/*.js` | Node's resolver gives `lib/DurableObjects.js`. The in-memory test still failed with only `src` patched and passed once `lib` was patched too. |
| Runner bundle (Node image) | `lib/*.js` | `PoolHost.ts` bundles with `Bundle.NODE_CONDITION_NAMES` (`node`, `module`, `default`). |
| Front (Bun image) | `src/*.ts` | `ServiceImage.ts` and `ImageSource.ts` bundle with `BUN_CONDITION_NAMES` (`bun`, `module`, `default`). |
| The `alchemy` CLI (run with `bun --bun`) | `src/*.ts` | Bun resolves `import.meta.resolve("@alchemy.run/domain/DurableObjects")` to `src/DurableObjects.ts`. |
| `tsc` in `bun run check` | `lib/*.d.ts` | Neither patch changes a declaration. |

The patch therefore edits four files: `src/DurableObjects.ts`, `lib/DurableObjects.js`,
`src/EffectCluster/index.ts` and `lib/EffectCluster/index.js`. Source maps are not regenerated.
The patched `src` files type-check cleanly with a standalone `tsc` over the two files; the only
errors that check reports are in unrelated `alchemy` sources (JSX and `picomatch` types). The
installed `src` files are byte-identical to upstream's at 33c10dd, so the upstream diffs are the
same `src` changes.

## Patch 1: a drain that finds its lease held comes back when the lease expires

**What changed.** The same defect has two copies in `DurableObjects.ts`: `queue` (outbox and
inbox) and the projection drain (`drain-lease`). Phase 5's issue 1 had already found the
projection copy, which is what P4 exercises. In both copies `acquire` now returns the held lease's
expiry instead of `false`. A drain that finds the lease held then reschedules its callback for one
millisecond after that expiry, instead of returning. In `queue` it calls
`callback.schedule("drain", { at: held + 1, payload: {} })`; in the projection, the existing
`wake(held + 1)`.

**Size.** In `src`, 13 lines added and 6 removed. In `lib`, 14 added and 8 removed.

**The callback contract, checked in source** (`alarmCallbacks`, `DurableObjects.ts`, around line
2200):

- A schedule writes one job per callback id with a fresh token, and arms the alarm only if it is
  earlier than the current one.
- A schedule without `progress` is never refused by the replay guard and keeps the job's
  progress.
- `pass` runs due jobs. A job rescheduled while its handler ran survives, because the token check
  runs before the delete. `pass` then arms the alarm for the earliest job left.
- The projection already schedules from inside its own drain (`wake`), so scheduling from inside
  a drain is an existing pattern.

**Why it cannot loop.** A reschedule always targets a time after the expiry of the lease it found.
The handler runs only once that time is reached. So one lease causes at most one return, and the
extra callback runs are bounded by the number of leases that running drains actually took. When a
healthy drain holds the lease, a kick that finds it moves the single backstop job to the lease's
expiry. The healthy drain still processes rows staged in the meantime (`more`, or the projection's
loop). When the backstop later runs it finds nothing left, and its job is deleted.

**In-memory reproduction:** `conformance/test/StrandedDrain.test.ts`, run by `bun run test`.

- **Host.** The in-process Durable Object host is in `conformance/test/SimHost.ts`, trimmed from
  upstream's integration-test `simHost`.
- **Clock.** A `TestClock` drives it.
- **Setup.** A lease written into storage the way a drain killed mid-run leaves it.

| Case | Unpatched | Patched |
| --- | --- | --- |
| An outbox drain whose lease a dead instance left | fails: view and stream still empty 75 s later | passes: delivered after the lease, with 2 lease reads |
| A projection drain whose lease a dead instance left | fails: stream empty | passes, with 3 lease reads |
| Successive live drains hold the lease for five minutes | fails: never delivered | passes: 5 lease reads while held (the kick, then one return per lease), delivered after the last lease |

**On the cluster (P3).** The patch works, but recovery waits out the lease.

- The killed drain's `outbox-lease` ran until 01:09:15.547Z.
- The new owner's callback job was due one millisecond later, which is the patch at work.
- The outbox drained between 01:09:24 and 01:09:35, so Effect Cluster delivered the wake between
  9 and 20 s late.

## Patch 2: calls from a runner's background fibers

**The read path, read end to end.** Phase 5's description of this defect was wrong. Reads do not
take a separate HTTP path. Every call goes through the same route: a command `send`, a view `get`,
a stream `list` or `page`, and a backfill read.

1. The call reaches `namespace.getByName(key).<method>(...)`.
2. That is `remote(...)` in `EffectCluster/index.ts`.
3. Which calls `makeNamespace(...).getByName` in `@alchemy.run/effect-cluster/internal/Gateway.ts`.

`getByName` checks for `Sharding` in the calling fiber's context. With it, the call goes through
Effect Cluster's own client. Without it, the call goes to the gateway over HTTP. On a runner the
namespace is built with `url: ""`, so that HTTP call fails as `POST /rpc/` with `InvalidUrl`.

Entity handlers run with `Sharding`. The runner bootstrap (`effect-cluster/internal/Bootstrap.ts`)
builds the entrypoint Layer before the cluster Layer exists. So a fiber the model's Layer forks
while it builds never has `Sharding`. The runs inbox poller (`Effect.forkScoped`) is such a fiber,
and its commands would fail the same way as its reads. Phase 5 saw only the reads, because they
come first.

**What a fix needs, and its size.**

- The runner's `Sharding` must reach those fibers.
- The cluster already runs a Layer of the model's own inside the cluster: the
  `runner.value.host(hosted, layer)` hook, where the workflow engine is captured.
- That Layer also completes a `Deferred` with `Sharding`.
- The namespace handed to `remote` provides it to any call whose fiber lacks it, waiting until the
  runner has joined.

Size: in `src/EffectCluster/index.ts`, 18 lines added and 4 removed. In `lib`, 13 added and 2
removed. No new wire protocol, and the change stays inside `@alchemy.run/domain`. This is well
under the 150-line bar, so it is implemented as a fix and the documented workaround was not
needed.

**On the cluster.**

- **P6 passes.** A runner logged `ClaimDecided inbox: handled 2 facts`, the run completed with
  `accepted`, and no runner logged `InvalidUrl`.
- **P8's last check now passes.** The waiting run completes after a restore.
- **No in-memory test.** Reproducing the defect needs the runner bootstrap.

## The conformance suite, before and after

"Before" is phase 5, on the unpatched library. "After" is this phase.

| Case | Phase 5 (unpatched) | Phase 6 (patched) |
| --- | --- | --- |
| U1 to U10, upstream's Domain conformance | 10 pass | 10 pass |
| P1 a command sent twice | pass | pass |
| P2 a lost response | pass | pass |
| P3 a runner killed right after a commit | fail: outbox stranded for good | **fail as written**: every reaction happens once, but after the lease, which is later than the case's read waits |
| P4 a projection crash between sink write and checkpoint | fail, with the window only approximated | **pass**, with the window forced |
| P5 a grant revoked while a chain is in flight | pass, but only before the first hop | **fail**, now mid-chain: the refusal is not recorded |
| P6 a run waiting for approval across a restart | fail: `InvalidUrl` | **pass** |
| P7 two runners, stale runner paused in `decide` | pass (no overwrite) | pass (no overwrite, the same outcome) |
| P7b two runners, stale runner paused inside its commit | not run | **overwrite observed** (D38) |
| P8 backup and restore | pass, except the run's completion | **pass** |

The conformance driver ran as a one-shot swarm service on the stack's overlay network, so no host
port was published. The front's generated module no longer has `ports`. The overlay network is not
attachable, so the driver is a service rather than a `docker run`. It runs in the stack's own
runner image, which has Node 26, with the prototype directory, the repository's
`tsconfig.base.json`, and the Docker socket and CLI mounted, as uid 1000 in the `docker` group.
Getting it working took about 15 minutes. The recipe is in the README.

### The cases that still fail, and why

**P3, kill after a commit: timing, not a stranded outbox.** At 49 s the case failed with
`ConsistencyTimeout` (ClaimReview, `atLeast` version 2). A check after the run
(`ClaimAggregate` and `AgentRun` events, the view entries) shows:

- one `ClaimAsserted`;
- review run `:1` at `RunAwaitingApproval`;
- no run `:2`.

So everything the case asserts became true, but only after the dead drain's lease expired at
01:09:15.5Z plus the wake latency. The case's view read had already given up at about 01:09:00.
With lease-based takeover the case cannot pass as written, because the read would have to wait
past 60 s.

The remaining design question, phase 5's alternative, is whether a drain's lease should follow
shard ownership, so that a new owner takes over at once. This is the owner's call; the case was
not changed.

**P5, revocation mid-chain: a model defect, not a library one.** The tightened case locks the
review run's `meta` row once `RunActivated` is stored, so that the run's next commit waits. While
the run is held there, it revokes the propose grant, then releases the lock. The evidence:

- **Held.** Backend 295 was waiting on the run's row in an `INSERT ... ON CONFLICT`.
- **Run state at the revocation.** `RunRequested`, `RunActivated`, `Running`.
- **Revocation.** `ok`, version 3.
- **After release.** `BudgetReserved` committed: reserve had been re-admitted before the lock.
- **Settle.** The `settle` activity's reply is `RunRefused` with reason `readmission:lapsed`.

`ReviewAssist.handler.ts` catches only `RunEnded`, so `RunRefused` failed the whole workflow. Its
`run` reply is `Failure(RunRefused)`. The consequences:

- nothing is recorded on the claim: no note and no proposal;
- the run stays `Running`, with 40 units reserved and never released.

D16's "the next hop is refused and recorded" holds at the propose hop, which the in-memory tests
cover. It does not hold at the report hops (settle, step, release), which no in-memory test
revokes before. Fixing this is a change to the review saga: record a refusal and release the
reservation when a report is refused. That is outside this phase's two patches, so it was not
made.

**P7b, two runners with the stale runner paused inside its commit: the D38 overwrite.** The case
is observational, and its evidence shows a lost write.

1. A first write gives the slot a `meta` row.
2. The row is locked while the held write's `decide` runs, so its commit starts and waits.
3. The owning runner is paused, and the lock released. Its backend (pid 422) finished the
   statement and sat `idle in transaction`, held by its paused client.
4. 45 s later the other runner had the shard, and its write blocked on the open transaction
   (pid 433, waiting on a lock). The case's 60 s client wait expired at this point.
5. After unpause, the stale runner's call returned success at version 2, with receipt
   `Accepted v2 [held_…]`.
6. The other write then also committed at version 2, with receipt `Accepted v2 [other_…]`.

Afterwards the stored `event:000000000002` is `other_…`, and `meta` is `[first, other]` at
version 2. The stale runner's acknowledged event is gone. The cause is the commit path's
`INSERT ... ON CONFLICT DO UPDATE` with no version check, which is what D38 records. It stays
unpatched, as briefed.

P7, with the stale runner paused during `decide`, again showed no overwrite: the stale fiber was
interrupted before it committed. The two timings together say the window is the commit itself.

### The tightened cases

- **P4** now forces the crash between the sink write and the checkpoint. A Postgres session of the
  conformance's own runs a server-side loop that locks the projection key's `meta` row as soon as
  the input is accepted. The case waits until the sink row exists and a backend is blocked by the
  lock. It then kills the runners, ends that blocked checkpoint write (`pg_terminate_backend`, as a
  crash would end it), and releases the lock. The evidence:
  - **The window.** One sink row; the checkpoint `INSERT` blocked (pid 137); `meta` at
    `accepted 1, processed 0`.
  - **Recovery.** One row and position `Party/…|1`, found by `FindParties`.
  - **The assertions** are unchanged.
- **P5** lands the revocation between the run's activation and its next commit, as described
  above. The assertion (a note on the claim) is unchanged.
- **P7b** is a new case beside P7. The brief asked for the runner to be paused after `decide`
  returned and its commit began; a row lock held it there without patching the library.

The lock helpers (`holdLock`, `lockHeld`, `blockedByLock`, `endBlocked`, `releaseLock`) are in
`conformance/test/Stack.ts`. They change no data; a lock ends with its session.

### Other observations

- **Both runners poll the fact feed.** Both runners' inbox pollers read the same facts (each
  logged `handled 2 facts`). The run concluded once (`RunCompleted` once), through the inbox's
  `seen` keys and the run's idempotency. Two pollers per feed are by design here; correctness
  depends on that dedupe.
- **Restore did not exercise pending work.** The hold's expiry wake ran before the dump finished
  this time, so the restore did not exercise pending scheduled work. Phase 5 did. The restore did
  exercise the waiting run's completion.

## Teardown and the baseline

Destroy. Then remove the image the deploy pulled by digest
(`postgres:17-alpine@sha256:d3244e8c…`; the baseline's `3540c0362c80` kept its tag). Then
`docker swarm leave --force`, `docker network rm docker_gwbridge`, and delete
`apps/practice/.alchemy/`. The first destroy (for the restore) removed that deploy's images, and
the second removed the rest. The temporary driver services were removed after each run.

Diff against `docker-baseline-2.txt`, ignoring container uptime text:

- containers, images, volumes, networks and swarm state are identical;
- the build cache grew from 754.7 MB to 764.7 MB (+10.0 MB, from this phase's image builds). It
  was not pruned (the brief forbids any prune).

Load stayed under 31 and free disk above 100 GB throughout. No `sudo` was used.

## For a reviewer of the upstream pull requests

The pull requests are in `notes/upstream/` (not filed). Each applies with `git apply` to upstream at
33c10dd. Both were checked against a copy of the two upstream files, and the result equals the
patched `src`.

- **`01-drain-lease-takeover.patch`.**
  - Both lease sites change together; they are the same defect.
  - The trade is recovery after the remaining lease (up to 60 s, plus the host's wake latency)
    against never.
  - Every return of a drain that found the lease held now rewrites the queue's single callback
    job, which can move a pending 10 s backstop later, up to the lease's expiry. The live holder
    still processes those rows. A reviewer may prefer keeping the earlier of the two due times.
    That is safe too, and a smaller behaviour change, but on its own it would not fix the defect.
  - Upstream could add an in-memory test in `packages/integration-tests/test/Domain/`, beside
    `simHost`, with a `TestClock`; this prototype's version is `conformance/test/StrandedDrain.test.ts`.
- **`02-runner-background-calls.patch`.**
  - The defect covers any call from a fiber without `Sharding` on a runner, not only reads.
  - A background call made before the runner joins now waits instead of failing.
  - An alternative home for the fix is `makeNamespace` in `@alchemy.run/effect-cluster`.
  - There is no in-memory test, because it needs the runner bootstrap.
- **D38 is not in either PR.** P7b's evidence is the material for that issue.

## Decisions for the owner

1. **P3.** Accept that recovery after a killed drain waits out the 60 s lease, or ask upstream for
   leases tied to shard ownership. Either way, the case's read cannot pass under lease-based
   takeover unless the case waits longer, which would be a change to the case.
2. **P5.** Fix the review saga so that a refused report hop records a refusal on the claim and
   releases the reservation. This is a model change.
3. **D38.** P7b reproduced a lost write. D5's gate depends on it. Decide whether to patch the
   commit's version check locally, or to file it upstream with P7b's evidence.
4. **Upstream.** Whether to file the two pull requests in `notes/upstream/`, and phase 5's issues.
5. **Build cache.** Docker's build cache now holds 764.7 MB from phases 5 and 6. Only the owner may
   prune it.
