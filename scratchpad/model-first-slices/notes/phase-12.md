# Phase 12: the fence's start check, the frozen-runner case, and the upstream set

In process only. No swarm, deploy or container this phase.

## The start check (D54)

**What it verifies, and when.** A runner checks two things at start: that it has an address, and
that its bootstrap named its runner pool after that address. It reads only its configuration.

- **When.** The check is the first thing the domain's Layer does once the runner launches it
  inside the cluster, before the runner registers its workflows.
- **The pool name.** The bootstrap now computes the pool's name once. It gives the name to the
  Postgres pool (as patch 6 did) and declares it to the runner (`RunnerHost.poolName`).
- **The check.** `checkRunnerPool` reads `ShardingConfig`. It fails with `RunnerPoolUnnamed` in
  three cases:
  - the runner has no address (`no-runner-address`);
  - no name was declared (`pool-not-named`);
  - the declared name is not `runnerPoolName(address)` (`pool-named-for-another-runner`).

  A storage that takes no advisory locks passes, since it keeps no lock session.
- **On failure.** The domain logs `commit fence unavailable: <message>` and dies, so the runner
  fails to start.

**What it does not verify.** It never queries PostgreSQL. A check for a session with this runner's
name would be unsound at start, because the lock session may not exist yet or may hold no shard
yet. A lock session lost to a pause is also rebuilt only after the resume, so such a check could
fail on a healthy runner. The cost is that a connection pooler that rewrites or drops
`application_name` goes unnoticed: a runner behind one starts, and every commit it makes is
refused at the fence, which is the safe failure.

The check is in `@alchemy.run/effect-cluster`'s `Host.ts`, beside `runnerPoolName`, so tests can
import it; the domain's Effect Cluster module cannot be imported under vitest. In the local
patches it lives in the existing two patch files: two patched packages, six fixes plus this guard.

**Tests.** `conformance/test/RunnerPool.test.ts` runs the real `checkRunnerPool` against Effect's
own `ShardingConfig` service:

- an unnamed pool fails with `pool-not-named`, and its message names the expected name;
- a runner with no address fails with `no-runner-address`;
- a pool named for another address fails with `pool-named-for-another-runner`;
- a named pool passes, including the hashed name for a 70-character host;
- a storage with advisory locks disabled passes.

**Not exercised:**
- the bootstrap declaring the name;
- the launched Layer running the check on a real runner;
- a runner actually failing to start.

`pg_stat_activity` is not involved, so nothing needed modelling there.

The three changed sources type-check against the packages' own dependencies, load under Bun, and
their built files parse.

**Upstream diff.** `notes/upstream/10-fail-at-start-without-a-named-pool.patch` applies after 03,
08 and 07, and says it has run in process only. Patches 07 and 08 are unchanged. Applied to
pristine 33c10dd in the order 01, 02, 03, 06, 08, 07, 10, the set reproduces the installed `src` of
both packages exactly:
- `domain`: `DurableObjects.ts` and `EffectCluster/index.ts`;
- `effect-cluster`: `Host.ts` and `internal/Bootstrap.ts`.

Patch 10 also removes the stray design-note id from the fence's doc comment that 07 leaves in.

## The frozen-runner case (D55)

**The in-process host.** `SimHost` can now freeze a runner (`freeze`, `thaw`). A call routed to a
frozen runner fails in transit with `RunnerUnreachable`, so the caller retries. Work already
running on it stops at its next storage operation.

**The budget.** It is `TRANSIT_RETRY_BUDGET_MS`, the sum of `TRANSIT_RETRY`'s 35 delays: 63.1 s. The
canary computes that sum from the installed library's schedule and pins it.

`conformance/test/FrozenRunner.test.ts` runs three cases:

1. **The runner resumes within the budget.** The write completes, is stored once, and a retry
   under its command id returns the same receipt and stores nothing more.
2. **The runner stays frozen past the budget.** The caller's attempt fails at exactly 63.1 s of
   virtual time and nothing is stored. Sent again under the same id after the resume, the write is
   stored once, and a further retry returns that receipt.
3. **The shard moves while the runner is frozen.** One write was in flight on the frozen runner and
   one was sent while it was frozen.
   - The write sent during the freeze reaches the new owner within the budget.
   - The write in flight commits after the thaw, is fenced, and is retried onto the new owner.
   - Each is stored once, and each retry gets its receipt.

**The cluster case.** P7 in `Own.conformance.ts` is rewritten to the same guarantee. A write sent
while the stale runner is paused in `decide` must be answered (receipt or failure) within
`FROZEN_WRITE_BOUND_MS`, which is the budget plus a 5 s allowance for the attempts themselves. No
write may be stored twice. Each write's retry under its command id after the resume must get the
receipt its first answer gave, and the state must then hold each write once.

To support this, the slot route takes a `command` id. That change is in `conformance/src`, so the
next deploy builds a new image. The case was not run.

Phase 11 saw such a write wait for the paused runner for over 60 s, so the case may well fail on
the cluster.

**Proof.** The `frozen-runner` entry is added to the inventory, and `commit-fence` and
`cluster-two-runners` are updated (41 entries).

## The upstream set

- Patches 01, 02, 03, 06, 07, 08 and 10 now share one header shape: a conventional title, Problem,
  Fix, the failing case and how it was reproduced, where it ran, and what it depends on.
- Write-ups 04, 05 and 09 have a title, what happens, the evidence and the proposed change.
- Only the text above each patch's first `---` changed; the diff bodies of 01 to 08 are
  byte-identical to phase 11's.
- Every file was read as a maintainer would read it. I removed phase references, decision ids,
  paths outside alchemy, and our own model names where a general description does.
- `notes/upstream/README.md` lists the ten items in the order a maintainer should take them, and
  says at the top that nothing has been sent.

## Gates

- `bun run check`: 0 diagnostics over 17 projects, and no inline directive added.
- `bun run test`: 196 tests in 53 files pass, and 109 of 109 outcomes are executed.
- `handlers:check`, `generated:check` and `outcomes` pass, and `PROOFS.md` is regenerated.
- Vendored upstream files and the monorepo root are untouched (`86c211ae5e2fd4bf`,
  `71b20c66a8fa65f7`).
- The prototype's `bun.lock` is unchanged; `bun install` reapplied the two patches and the result
  matches them.
