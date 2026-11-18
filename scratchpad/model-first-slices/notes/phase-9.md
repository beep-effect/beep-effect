# Phase 9: the rulings on the three failing cases, and a fourth swarm run

Phase 9 built the owner's rulings on phase 8's three failures (D41 to D43) and ran the whole
conformance suite on a local Docker swarm again, under the same limits:

- **D41.** A third local patch adds a version check inside the commit transaction.
- **D42.** The kill-after-commit case now asserts the recovery guarantee as ruled, against a bound
  derived from the library's lease.
- **D43.** The fact publisher reads claim events and writes a new generation of the published
  stream. A checker pins every published stream to its writer.

Every case passed as written, and no acknowledged write was lost. Two things fall short:

- **The stale runner.** In the paused-inside-commit case it was acknowledged in all three runs. A
  version check orders commits by transaction, not by shard ownership, so the owner's expectation
  that the stale runner is refused is not met.
- **The backfill.** On Effect Cluster a new consumer's backfill finds no instances. That is a fourth
  library defect, found here and left unpatched, so generation 2 holds only decisions made after
  the upgrade.

## Patch 3: the version check in the commit (D41)

### The change

It sits in the prototype's local patch of `@alchemy.run/domain` 2.0.0-beta.87, in both `src` and
`lib` (`patches/@alchemy.run%2Fdomain@2.0.0-beta.87.patch`). As a diff against upstream, it is
`notes/upstream/03-commit-version-check.patch`.

- **`DurableObjects.ts`, `aggregateObject.commit`.** The order is:
  1. The receipt lookup answers first, as before. A command id already committed returns its
     stored receipt before anything is read or decided.
  2. `meta` is read and `decide` runs on that state, unchanged.
  3. The storage transaction's first step reads `meta` again and returns `undefined` when its
     version is not the one `decide` was given. Nothing is written: no events, `meta`, receipt,
     routed set or outbox row.
  4. After a lost check the commit fails with `CommitConflict { id, decided, stored }`.
- **The object method `send`.** It now passes `CommitConflict` through as a failure of the call
  (`reportDefectsUnlessConflict`). Every other cause is still turned into a defect value, as
  before.
- **`EffectCluster/index.ts`, `objectStorage.transaction`.** The transaction first takes
  `pg_advisory_xact_lock(hashtextextended(object, 0))`. Without it, the check would not be enough
  under Postgres's read-committed isolation: both runners would read `meta` at the old version
  before either committed, and the second would wait on the first's row locks and then overwrite.
  With it, commits on one instance serialize across runners, and the check sees the earlier one.
  The lock ends with the transaction.

### What it does on each host

| Host | Storage transaction | The check | Cost |
| --- | --- | --- | --- |
| Effect Cluster (Postgres) | one SQL transaction, serialized per instance by the advisory lock | can fail, when two runners hold one instance while its shard moves | one advisory lock and one `meta` read per commit |
| Durable Objects (Cloudflare), Rivet | already serialized per instance | always passes | one `meta` read inside the transaction |
| In memory (`Domain.InMemory`) | its own commit path, not `aggregateObject` | not present; nothing changed | none |

The in-memory suites and upstream's ten Domain conformance cases pass unchanged with the patch.

### A commit that loses the check

It is never acknowledged. Of the two options, the call fails and the caller retries, rather than
the object deciding again under the same command id:

- **One at a time.** The caller's `unwrapDefects` already retries a failed call
  (`TRANSIT_RETRY`), and a retry is a new call, routed to whichever runner owns the instance now.
  Only the current owner decides again. Deciding again inside the losing object would run `decide`
  on a runner that may have lost the instance, and could repeat the race.
- **Idempotency.** The retry starts from the receipt lookup. If the other runner committed this same
  command, the retry gets that receipt; otherwise it decides on the stored state. A scheduled
  command's job is retried by its callback the same way.

### Reproduced below the cluster

`conformance/test/LostWrite.test.ts`, on the in-process Durable Object host (`SimHost.ts`, which
now serves one instance from two runners sharing its storage), with a `TestClock`:

1. Runner 0 takes write A, decides on version 0 and holds for 10 s.
2. The instance moves to runner 1, which commits write B at version 1.
3. Runner 0's decide returns and it commits.

| | Write A acknowledged at | Stored events | Stored `meta` |
| --- | --- | --- | --- |
| Without the patch | version 1 | `[A]` (B lost) | `{labels: [A]}`, version 1 |
| With the patch | version 2, after a refused first commit and its retry | `[B, A]` | `{labels: [B, A]}`, version 2 |

### The limit

Whichever transaction starts first wins. When the stale runner's transaction began before the
other runner's (it took the advisory lock first), the stale runner is acknowledged, and the other
runner's commit is the one refused and retried. Nothing acknowledged is lost either way. Refusing
the stale runner itself needs a fence on shard ownership inside the commit transaction, which is
beyond a version check. The paused-inside-commit runs below show exactly this.

### Upstream files

`01` and `02` did not need refreshing. No hunk of `03` overlaps theirs, and the three apply to
pristine 33c10dd in any order (checked with `git apply` in three orders). `03` alone reproduces the
patched source exactly.

## The recovery case and its bound (D42)

`conformance/test/RecoveryBound.ts` names the bound:

- `LEASE_MS = 60_000`: the library's drain lease (`DurableObjects.ts`, not exported).
- `ENTITY_MESSAGE_POLL_MS = 10_000`: Effect Cluster's `entityMessagePollInterval` default, which is
  how long the drain's persisted wake can wait to be delivered.
- `RECOVERY_BOUND_MS = LEASE_MS + 2 * ENTITY_MESSAGE_POLL_MS = 80_000`. The two polls are one for
  the drain's wake and one for the reaction it sends.

`RecoveryBound.test.ts` reads the installed library and Effect sources and fails if either constant
moves, so the bound cannot drift from them.

The case (P3) commits `AssertClaim`, kills both runners and records the time of the kill. It then
retries the command under the same id and expects the same receipt version. From the kill it
polls, each second:

- the claim's stored event tags with their counts;
- review run 1's stored event tags with their counts;
- whether the review view has the run's proposal.

It must reach exactly one each of `ClaimAsserted`, `ReviewRequested` and `DispositionProposed`, and
one each of the run's `RunRequested`, `RunActivated`, `BudgetReserved`, `UsageSettled`,
`StepRecorded` and `RunAwaitingApproval`, with the proposal in the view. All of that must happen
within `RECOVERY_BOUND_MS` of the kill. The case then sleeps until the bound and reads again, so a
duplicate that arrives late fails it. Run 2 must still be `Unrequested`. The old view read, with
its ten-second wait, is gone.

**Result: pass.** Everything was done 66.8 s after the kill, and the counts were unchanged at the
bound.

The proposal for leases that follow shard ownership is `notes/upstream/04-leases-follow-shard-ownership.md`.
It is a proposal, not a patch.

## The publisher on claim events (D43)

### What the events lacked

The fact `ClaimDecided` needs the claim's org and its review runs. The old publisher took both
from the `ClaimReview` view. The decision events (`ClaimAccepted`, `ClaimRetracted`,
`ProposalApproved`) carried neither.

**Resolved by widening the events.** Each now carries `DecisionScope`
(`party/contract/src/Claim/DecisionScope.ts`): `org` and `reviewRuns`, both optional keys read as
`Option`. `decide` fills them from the pending state:

- the org;
- `review:<claim>:1` to `review:<claim>:<reviews>`, in order (`scopeOf` in `Claim.rules.ts`).

These are the same runs the view listed. Stored decisions keep their bytes and read with no scope
(D22).

**A decision stored before phase 9** has no scope. The publisher resolves it in this order:

1. **Generation 1 published it.** It takes the scope that generation 1 published for the same fact
   id, which is what consumers were told.
2. **Generation 1 never published it.** This is a decision whose delivery was still pending when
   the code changed. The publisher takes the org from the claim's state, which keeps it, and only
   the review runs the event names: the approved run for an approval, none for a direct decision.
   It logs a warning. Other review runs of such a claim are not concluded by the fact. Draining
   the old publisher before upgrading would close this case.

### The new projection and stream

- **`ClaimDecisions`** (`party/model/src/Facts/ClaimDecisions.projection.ts`) reads `Claim` and
  writes `PartyFacts2`, generation 2 of the published stream. A view's version bump can no longer
  change its generation.
- **`ClaimFacts`** (it read `ClaimReview`) is removed.
- **`PartyFacts`** stays declared as generation 1, closed. The feed serves it, and the new
  publisher reads it for legacy scopes.

### The feed and the consumers

`PartyFactsFeedLive` serves both generations as one log:

- generation 1 at its own positions, from 1 to its length, which is fixed because it is closed;
- generation 2 after it, at that length plus each entry's own position.

So a checkpoint taken before the change still means the same place.

Generation 2 republishes, under the same fact ids, the decisions generation 1 holds. The runs inbox
keeps what it has handled by producer, fact id and version, and drops the repeats.
`party/host/test/PartyFactsFeed.test.ts` shows each position served once, in order, at any page
size and across the boundary.

### The checker

`shared/tooling/src/PublishedStreams.ts`. The pins are in `party/model/src/Facts/StreamPins.ts`:
generation 1 closed, and generation 2 open with `ClaimDecisions`, generation 0, sources `[Claim]`.

The check compares them with the hosted model, whose kernel knows each projection's Layer version
and the views it inherits from. It fails on:

- a writer whose generation or sources changed, or a different writer;
- a closed generation with a writer again;
- an open generation with no writer;
- an unpinned stream;
- a pinned stream gone from the model.

The tests cover both directions:

- `shared/tooling/test/PublishedStreams.test.ts`: each failure, and a new generation opened the
  right way passing.
- `party/model/test/StreamPins.test.ts`: the deployed model passes, and the same model with
  `ClaimDecisions` at version 1 fails with `Changed`.

The proof inventory entries are `published-stream-generations` and `decision-scope`.

### The library behaviour

It is written up as an issue in `notes/upstream/05-published-stream-after-rebuild.md`: title, what
happens, the failing case and the proposed change. It is not filed.

## Conformance on the swarm, beside phase 8

Every case ran one at a time through the one-shot driver on the stack's network. Evidence is in the
scratchpad: `p9-*.txt`, `p9-evidence.log` and `phase9-state.md`.

| Case | Phase 8 | Phase 9 |
| --- | --- | --- |
| U1 to U10, upstream's Domain conformance | 10 pass | **10 pass** |
| P1 a command sent twice | pass | **pass** |
| P2 a lost response | pass | **pass** |
| P3 a runner killed right after a commit | fail as written (10 s view read) | **pass**, rewritten (D42): every reaction once, done 66.8 s after the kill, bound 80 s |
| P4 a projection crash between sink write and checkpoint | pass, window forced | **pass**, window forced (sink row 1, checkpoint blocked, `accepted 1 processed 0`) |
| P5 a grant revoked between two hops of a running chain | pass | **pass**: `ReviewRefused readmission:lapsed` recorded, run `Refused` |
| P6 a run waiting for approval across a restart | pass | **pass** |
| P7 two runners, stale runner paused in `decide` | pass, no takeover | **pass**, no takeover again |
| P7b two runners, stale runner paused inside its commit | overwrite (D38) | **no overwrite in three runs**; the stale runner was acknowledged each time |
| P8 backup and restore with pending scheduled work | pass | **pass**: the hold's pending expiry ran after the restore (`HoldExpired`) |
| P9 stored forms written directly | pass | **pass** |
| P10 phase 6's dump restored under the new code | fail: no fact published | **pass**: the decision published in generation 2 and the waiting run completed |

### P7b, three runs with patch 3

The criterion was "the stale runner must not be acknowledged, and the stored events must hold
exactly the winning write". Each run:

1. A first write gives the slot `meta`.
2. A held write's commit is stopped on a row lock.
3. Its runner is paused with the transaction open.
4. 45 s later another write is sent.
5. The stale runner is unpaused.

| Run | Did the shard move? | The other write's commit | Stale runner acknowledged? | Stored events |
| --- | --- | --- | --- | --- |
| 1 | no | queued on the stale runner; the client gave up at 60 s | **yes**, version 2 | `first`, `held`, `other` (version 3, on the stale runner after unpause) |
| 2 | **yes**, to `db94a2b493f7` | waited on `pg_advisory_xact_lock` while the stale runner's transaction stayed open; after unpause it lost the check, and its retry decided again (logged 0.35 s after unpause) and landed at version 3 | **yes**, version 2 | `first`, `held`, `other` |
| 3 | no | as run 1 | **yes**, version 2 | `first`, `held`, `other` |

The second half of the criterion holds in all three runs. The write that committed first (`held`,
the stale runner's) is at `event:000000000002`, intact, and nothing was overwritten. In phase 8,
without the check, the other runner's event replaced it.

The first half does not hold. The stale runner was acknowledged each time, because its transaction
began first. In run 2 the version check did what D41 asked: the other runner's commit, decided on
version 1, was refused and retried. A runner that is still inside its transaction when it loses
its shard is only refused by fencing on shard ownership.

### P7: did takeover happen?

**No.** The stale runner was paused in `decide` at 06:20:17. The quick write timed out at the client
after 60 s. After unpause, A committed at version 1 and then B at version 2, both on the stale
runner. Across the phase 8 and phase 9 pauses, the shard moved in two of five, so the in-`decide`
takeover timing is still covered by phase 6's run only.

### P10: the upgrade case

The dump came from phase 6. In it:

- one decided claim, `claim_wait`, whose `ClaimDecided` versions 1 and 2 are in generation 1;
- one claim waiting with a proposal, `claim_restore`, with its review run awaiting approval;
- the runs inbox's checkpoint at 2, having seen `party:claim_wait…:decided:v1`.

What happened after restoring it under this phase's code:

- **Before approval.** Every read passed, as in phase 8.
- **On approval.** `ProposalApproved` carried the scope (org, `[review:claim_restore…:1]`).
  `ClaimDecisions` appended both versions to generation 2.
- **The consumer.** The inbox read generation 1 to its end and then generation 2. Its checkpoint
  went from 2 to 4, and it saw `party:claim_restore…:decided:v1` once.
- **The run.** It completed with outcome accepted.

**No fact reached the consumer's command twice.** Each review run has exactly one `RunCompleted`,
and seven receipts, one per command. `claim_wait`'s run was not concluded again.

**One thing did not happen.** Generation 2 does not hold `claim_wait`'s decision. Its republication,
through the generation 1 lookup, was expected from `ClaimDecisions`'s backfill, which on this host
found no instances (below). Consumers stay correct, because the feed still serves generation 1. But
generation 2 is not complete on its own, and the generation 1 lookup path ran only in memory.

### A fourth library defect: the backfill lists nothing on Effect Cluster

`ClaimDecisions`'s run logged:

```
discover done=true subtrees=0 ... in 8ms
```

and the same for `ready`. Its progress ended at `instances: 0`, although Party's directory lists
all six claims.

**The cause.** On Effect Cluster an object call is sent as `JSON.stringify(args)`, so
`node.list(path, undefined)` arrives as `after = null`. The directory node takes `null` for a
cursor:

- it lists no children;
- it passes `startAfter: null` to storage, which queries `key > NULL`.

Every listing is empty, so a consumer added by a deploy never receives history on this host.

**What else it explains.** Phase 8's rebuilt `ClaimFacts` took the first live event as its
input 1, without replaying history.

It is written up in `notes/upstream/06-cluster-backfill-lists-nothing.md`. It is not patched: the
prototype carries three patches only.

## What is still failing, and why

- **P7b's first criterion** (the stale runner must not be acknowledged): not met in any run. A
  version check refuses the later commit, not the stale one. This needs a decision: accept
  first-commit-wins with no lost write, or fence commits on shard ownership. Fencing is a fourth
  patch, which is not allowed this phase.
- **Generation 2 is incomplete on Effect Cluster,** because of the backfill defect. No case fails
  on it, since the feed serves generation 1. But generation 1 cannot be retired until generation 2
  is complete, and any upgrade that adds or rebuilds a consumer on this host gets no history.
- **The takeover timings are rare** on this swarm. The shard moved in one of three P7b runs and in
  neither P7 run since phase 6, so the version check's refusal was observed on the cluster once.

## D5 verdict

**Not met. The repo-owned Postgres platform is not retired.**

Every case of the suite passes as written on the patched library: duplicates, lost responses, kill
after commit within the ruled bound, projection crash, revocation, the waiting run, restore with
pending work, stored forms, and the upgrade from phase 6's data. Three reasons still hold the gate:

1. **The pass rests on three local patches** that are not upstream. D41 keeps D38's other half:
   the repo-owned platform is not retired on the strength of a local patch alone.
2. **The owner's P7b criterion is not met.** The stale runner is acknowledged.
3. **The backfill defect** means an upgrade that adds a consumer is not safe on this host.

## Teardown

In order:

1. `alchemy destroy` for the stage.
2. The `postgres:17-alpine` image the deploy pulled was removed by its digest (`d3244e8c`), because
   the node already had another.
3. `docker swarm leave --force`, since this phase's `swarm init` created the swarm.
4. `docker network rm docker_gwbridge`.
5. `apps/practice/.alchemy/` was deleted.

No `practice-*` or driver service, container, network, volume or image remains. Against
`docker-baseline-4.txt`, the only difference is Docker's build cache: 775.9 MB before, 786.6 MB
after (+10.7 MB). It was not pruned. Free disk is 223 GB.

**A note on the procedure.** `docker service scale --detach=false` returns before the old
containers have stopped (in the second restore they took another 18 s to go). In the first
restore, `pg_restore` therefore ran into the fresh stack's empty database while its runners were
still stopping. That database held no domain state and the restore reported no error. The second
restore waited until the containers were gone.

## Gates

- `bun run check`: 0 diagnostics on the Effect build over all 17 projects.
- `bun run test`: 166 tests pass, and 109 of 109 outcomes are executed.
- `handlers:check` and `generated:check` pass; `PROOFS.md` is regenerated.
- No inline directive was added.
- The monorepo's root `package.json`, `bun.lock` and `patches/` are unchanged.
