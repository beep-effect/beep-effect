# Fixes and proposals for alchemy, from running a Domain application on Effect Cluster

**Nothing here has been sent.** No issue, pull request or message has been posted upstream.

Checked against alchemy `main` on 2026-11-17: see [`MAIN-CHECK.md`](./MAIN-CHECK.md). Copies
rebased onto `main`, formatted and carrying tests are in `rebased/`; draft texts are in `drafts/`;
the test runs with and without each fix are in `evidence/`. The files below are the set as it ran
on the cluster, against 33c10dd, and are kept unchanged.

Seven patches and three write-ups for alchemy at 33c10dd (2.0.0-beta.87), in the order a
maintainer should take them. Patches apply from the repository root with `git apply`. Applied to
33c10dd in the order 01, 02, 03, 06, 08, 07, 10, they reproduce exactly the sources the application
ran: all of them except 10 ran on a cluster.

The evidence column names the run of the application's conformance suite that measured it. The
application is three Domain models hosted on two runners and a front, on Effect Cluster with
PostgreSQL 17, on a single-node Docker swarm. Each numbered run (5 to 11) deployed the stack and ran
the suite against it; run 5 used no patches. "In process" is an in-process Durable Object host with a `TestClock`, like
the `simHost` in `packages/integration-tests/test/Domain/DurableObjects.test.ts`.

| # | Item | What it fixes or proposes | Depends on | Size | Evidence (run, case) |
| --- | --- | --- | --- | --- | --- |
| 1 | `03-commit-version-check.patch` | A runner that stalls past its shard lock overwrites an acknowledged write: the commit now checks, inside its transaction, the version `decide` saw | none | 2 files, +52 −3 | Before, in runs 6 and 8: the frozen runner's acknowledged write was overwritten. After, in run 9: nothing lost in 3 runs (paused inside its commit). In process: the two-runner case |
| 2 | `08-name-the-runner-pool.patch` | No connection can tell which runner holds a shard: the runner bootstrap names its Postgres pool `effect-cluster:<host>:<port>` | none | 2 files, +28 −2 | Run 11: lock sessions named per runner and renamed after a rebuild; unnamed on the previous code. In process: the hashed name for a long host |
| 3 | `07-commit-fenced-on-shard-ownership.patch` | A runner that lost its shard is still acknowledged: every commit is fenced on this runner's own lock session, checked first and at `COMMIT` | 03, 08 | 2 files, +194 −18 | Run 11: invariant held in 6 of 6 (paused inside its commit). An address-based version acknowledged a stale write in 3 of 5 in run 10. In process: the fenced-commit case |
| 4 | `10-fail-at-start-without-a-named-pool.patch` | A runner whose fence can never succeed refuses every commit silently: it now fails at start | 03, 07, 08 | 3 files, +78 −5 | **In process only; not run on a cluster.** Unnamed, unaddressed and misnamed pools fail the check with `RunnerPoolUnnamed`; named ones pass |
| 5 | `01-drain-lease-takeover.patch` | A drain whose holder died leaves its rows stranded until the next commit: it now comes back when the lease expires | none | 1 file, +13 −6 | Before, in run 5: the outbox stranded for good after a kill. Runs 6 to 11: every reaction once after both runners are killed (66.8 to 67.7 s in runs 9 to 11, bound 80 s); a projection crash redelivered. In process: the stranded-drain cases |
| 6 | `06-call-args-keep-undefined.patch` | Left-out optional arguments arrive as `null` on Effect Cluster, so every backfill lists nothing: trailing `undefined`s are left out of the JSON | none | 2 files, +20 −1 | Runs 10 and 11: a view added over a restored dump held 11 of 11 earlier writes; before, `subtrees=0` (run 9). In process: the ledger case |
| 7 | `02-runner-background-calls.patch` | Calls from fibers a model's Layer starts on a runner fail with `InvalidUrl`: they now go through the runner's `Sharding` | none | 1 file, +18 −4 | Before, in run 5: every call from a poller on the runners failed with `InvalidUrl`. Runs 6 to 11: it consumed another model's facts. No in-process test (needs the bootstrap) |
| 8 | `05-published-stream-after-rebuild.md` | Issue: a rebuilt projection's first appends to its stream are silently dropped | none | 78 lines | Run 8: a decision under the next version was never published (dump restored across versions). Reproducible in memory |
| 9 | `04-leases-follow-shard-ownership.md` | Proposal: drain leases follow instance ownership, so recovery does not wait out the lease | 01 | 82 lines | Runs 9 to 11: recovery after a kill takes about 67 s, most of it the 60 s lease |
| 10 | `09-projection-backlog.md` | Proposal: `Projection.Progress.backlog`, so a drain check is one line on every platform | none | 99 lines | Run 11: a reader of the private layout agreed with a model-specific query in three comparisons, two on the cluster and one in process |

Of the patches, only 07's code carries anything from outside alchemy: a stray reference to a
design note in the fence's doc comment, which 10 removes. 07 and 08 are kept exactly as they ran.
