# The upstream set against alchemy `main`

Checked 2026-11-17; the rebased set was then type-checked, formatted and tested on 2026-11-18
against the same `main` (re-fetched; it had not moved). Nothing was posted upstream: no issue,
pull request, comment or reaction. Draft texts for upstream are in `drafts/`; see "Send-ready
state" at the end.

- **Upstream `main`:** `3ff34b94f6c4142b4dfd0395553a6f2af134fe5f`, committed 2026-11-17 22:29 UTC
  (`feat(secrets): add 1Password provider (#2749)`), from a fresh clone under `~/.cache/beep/`.
- **Newest release:** 2.0.0-beta.87 for both `@alchemy.run/domain` and `@alchemy.run/effect-cluster`
  (npm `latest`, published 2026-11-12 22:27 UTC; newest git tag `v2.0.0-beta.87`, which is 33c10dd).
  Both `package.json` files on `main` still say 2.0.0-beta.87. Nothing newer is released, so every
  defect below is in the current release as well as on `main`.
- **Since 33c10dd:** 35 commits on `main`, 13 of them in `packages/domain` or
  `packages/effect-cluster` (52 files, +4,174 −666). Of the four files the patches touch:
  - `packages/domain/src/DurableObjects.ts`: 5 commits, +583 −88. #3420 (Decision, a command decided
    across several aggregates) is the large one; it restructures `commit`. Also #3215 (Callbacks
    service), #3380, #3415, #3373.
  - `packages/domain/src/EffectCluster/index.ts`: 1 commit, #3215 (+3 −6, Callbacks wiring only).
  - `packages/effect-cluster/src/Host.ts` and `packages/effect-cluster/src/internal/Bootstrap.ts`:
    no commits. (#3446 changed other files of `packages/effect-cluster`: the pools' networks.)
  - Effect is still pinned to 4.1.4 (`pnpm-workspace.yaml:185` and the override at `:299`), so the
    Effect Cluster internals that 07 relies on (lock namespace, lock numbering) are unchanged.

Line references below are to `main` at 3ff34b9 unless they say otherwise.

## Summary

| Item | Applies to `main` | Defect on `main` | Existing upstream issue or PR | Recommended action |
| --- | --- | --- | --- | --- |
| 01 drain lease takeover | clean (offsets) | present | PR #3220 (open, same fix); issue #2763 (open, same defect) | fold into #3220: comment drafted (`drafts/3220-2763-comment.md`), no patch |
| 02 runner background calls | clean (offsets) | present | issue #3423 (open); PR #3424 (open draft, narrower fix) | fold into #3423 / #3424: comment drafted (`drafts/3423-3424-comment.md`) |
| 03 commit version check | no; 3-way conflicts | present | issue #3490 (open, filed 2026-11-17) | send `rebased/03` with 08, 07, 10 as one PR in #3490: comment and PR text drafted (`drafts/3490-comment.md`) |
| 04 leases follow ownership (write-up) | not a patch | still as described | related: #2763 comment, #3220 comment | fold into #3220 / #2763: part of `drafts/3220-2763-comment.md` |
| 05 published stream after rebuild (write-up) | not a patch | still as described | none | file as a new issue: drafted (`drafts/new-issue-published-stream-after-rebuild.md`) |
| 06 call args keep undefined | no; 3-way clean | present | issue #3381 (open); PR #3382 (open draft, different fix) | drop ours; confirm #3382 covers it, with one rollout point: drafted (`drafts/3381-3382-comment.md`) |
| 07 commit fenced on shard ownership | no; 3-way clean on rebased 03 + 08 | present | issue #3490 | send `rebased/07` in the #3490 PR; the decision-path refusal is an open question in it |
| 08 name the runner pool | clean | present | none (open draft PR #3422 rewrites the same line) | send `rebased/08` (formatting only) in the #3490 PR |
| 09 projection backlog (write-up) | not a patch | still as described | none | file as a new issue after 05: drafted (`drafts/new-issue-projection-backlog.md`) |
| 10 fail at start without a named pool | no (also fails at 33c10dd in the README's order); 3-way conflicts | present once 07 is applied | none | send `rebased/10` in the #3490 PR; say it ran in process only |

"3-way" means: the patch was committed on 33c10dd and cherry-picked onto `main`. `git apply --3way`
itself cannot run on these files, because they carry no `index` lines (blob ids); it stops with
"repository lacks the necessary blob".

Rebased copies are in `rebased/` for 02, 03, 06, 07, 08 and 10, regenerated on 2026-11-18 from a
formatted, type-checked and tested tree (see "Send-ready state"). With the original 01, the set
applies with `git apply --check` to a fresh checkout of `main`, cumulatively, in the README's order
(03, 08, 07, 10, 01, 06, 02). The resulting tree is the one that was type-checked and tested. In
the order the cluster ran them (01, 02, 03, 06, 08, 07, 10) it no longer applies: 07's import hunk
fails, because the formatter sorts the import 07 adds directly next to the import line 02 changes,
so their context depends on order. Applied separately, 01, the original 02, the rebased 06 and the
rebased 08 each apply to `main` alone, and 03, 08, 07, 10 apply as a group. Each rebased copy keeps
the original description below a note on its state and what changed. The seven original patches
and the README were not touched.

## Item by item

### 01 `01-drain-lease-takeover.patch`

**Applies:** cleanly; hunks at offsets +6, +461 and +461.

**Defect: present, verified by reading code.** The queue drain still returns, with success, when
another drain's lease is unexpired, and nothing else schedules a retry:

- `packages/domain/src/DurableObjects.ts:351` `if (held !== undefined && held > (yield* Clock.currentTimeMillis)) return false;`
- `:358` `if (!(yield* acquire)) return;`
- the only backstop is the one-shot schedule in `stage`, `:386`
  `callback.schedule("drain", { after: "10 seconds", payload: {}, progress: last })`.

The projection drain has the same shape: `:1743` `const lease = "drain-lease";`, `:1764`
`if (!(yield* acquire)) return;`. `LEASE_MS` is still 60 000 (`:334`). The lease is still a number,
never renewed by a live drain.

**Upstream already has it.**

- PR #3220, open since 2026-11-10, not draft, mergeable, no maintainer review yet. Title: "fix(domain): a queue
  drain stuck on a dead drain's lease, with crash tests for the Effect Cluster host". The fix is the same
  idea as 01 (reschedule for the lease's expiry, in both the queue and the projection drain), written as
  `callback.schedule("drain", { at: held, payload: {} }).pipe(Effect.orDie)` and `wake(held)` where 01
  uses `held + 1`. It adds an in-memory unit test (`test/Domain/QueueLease.test.ts`) and three
  Swarm crash cases. A comment on it (2026-11-15) reports a second trigger with a live holder on
  Effect Cluster (a short-batch projection's `wake` firing before the holder's `ensuring` deletes
  the lease; 101 keys stuck on one stack) and suggests waking at `min(held, now + ~1 s)`.
- Issue #2763, open since 2026-10-29: the same defect, reported against the older
  `packages/cloudflare/src/Domain/index.ts` layout. Its follow-up comment is a real objection to 01 as
  well as to #3220: a live drain never renews its lease, so a drain still processing after 60 s
  (a policy retrying an external call, say) is overlapped by the rescheduled drain, which then
  processes the same row concurrently. Unpatched code can do this only when a wake happens to land
  after expiry; the reschedule makes it certain. The comment proposes an instance-local "a drain is
  running here" flag.

**Recommendation:** do not send 01 as a separate pull request. Add 01's cluster evidence (stranded
outbox in run 5; recovery 66.8 to 67.7 s after a kill of both runners in runs 9 to 11) to #3220, and
answer the overlap objection there; item 04 is one answer to it.

### 02 `02-runner-background-calls.patch`

**Applies:** cleanly; hunks at offsets +1, −3 and −3 on `main` alone (larger offsets after the
rebased 03, 07 and 10, still clean).

**Defect: present, verified by reading code.** The runner still builds its in-cluster namespace with
an empty gateway URL, `packages/domain/src/EffectCluster/index.ts:803`
`makeNamespace(objects as never, { url: "", token: "", service: "" }) as never`. `makeNamespace`
routes through Effect Cluster only when the calling fiber has `Sharding`,
`packages/effect-cluster/src/internal/Gateway.ts:217`
`const sharding = Option.getOrUndefined(yield* Effect.serviceOption(Sharding.Sharding));`, and
otherwise builds an HTTP RPC client from that URL (`:208`). Nothing on `main` captures the runner's
`Sharding` for fibers the model's Layer starts (`index.ts:762` to `:772`, the Layer launched in
the cluster, registers sagas and releases the workflow engine only).

**Upstream:** issue #3423 (open, 2026-11-15) names the same root cause in its title: "a runner's own
calls have no route". Draft PR #3424 fixes one case of it: it captures the runner's `Sharding` in a
`Deferred` named `joined`, at the same point as 02, and uses it only for a new `Host.begin` that
starts a deploy's backfill runs. It does not route other background calls (a poller, a consumer),
which is 02's case. The two patches touch the same lines and would conflict.

**Recommendation:** comment on #3423 with 02's case (a poller started by `Effect.forkScoped` in a
model's Layer, every call failing with `InvalidUrl`) and offer 02's general routing as an extension
of #3424, so the `joined` `Deferred` is shared rather than added twice.

### 03 `03-commit-version-check.patch`

**Applies:** no. The first hunk fails because `main` already imports `effect/Data`
(`DurableObjects.ts:25`, added by #3420). The commit hunks fail because #3373 and #3420 rewrote
`commit`: the transaction now writes the receipt first and delegates the rest to a new `persist`
(`:956` to `:961`, `:969` to `:989`). The `EffectCluster/index.ts` hunk applies at offset +1. The
3-way cherry-pick conflicts in `DurableObjects.ts`.

**Defect: present, verified by reading code.** The commit still decides on a `meta` read outside
its transaction and writes inside it without checking that version again:

```ts
// packages/domain/src/DurableObjects.ts:932, :956 to :961
const current = yield* storedMeta;
...
const kick = yield* state.storage.transaction(
  Effect.gen(function* () {
    yield* state.storage.put(`receipt:${meta.commandId}`, sent);
    return yield* persist(id, current.version, result);
  }),
);
```

And the Effect Cluster transaction still takes no per-instance lock,
`EffectCluster/index.ts:256` to `:258`:
`// Held across the whole transaction, as Cloudflare's gate is.` /
`gate.exclusive(sql.withTransaction(effect).pipe(Effect.orDie)) as never`. The gate is per
process, so two runners do not share it.

**New on `main`, not covered by the original:** a decision (#3420) can hold an instance
(`meta.held`) between its read and its commit. The commit checks `held` outside the transaction
(`:933` `if (current.held) return yield* new InstanceHeld();`), and the decision's own `hold` and
`txPrepare` compare the version outside a transaction too (`:1092`, `:1368`). The rebased copy also
refuses a commit whose stored `meta` is held, and reports that as `InstanceHeld`, which `whenFree`
(`:1204` to `:1215`) already settles and retries. That is an addition to what ran on a cluster. The
decision protocol's own reads are not changed; with 07 their writes are fenced, but without 07 they
are not version-checked inside a transaction.

**Upstream:** issue #3490, opened 2026-11-17 18:00 UTC by another user, describes this defect on
2.0.0-beta.87 with a `SwarmPool` of two runners: a 56 s `docker pause`, two `Accepted` commands at
one version, the log and the view disagreeing, a projection missing up to 556 events, no error
anywhere; a 20 s control shows nothing. It names "a check of the version in the commit transaction,
and a check of the shard lock before a commit" as two ideas they did not try, that is, 03 and 07.
No maintainer has replied yet. Closed PR #2795 (2026-10-30, closed 2026-11-04 at the maintainer's request) had "conflict
retries", but those retry database aborts (deadlocks, serialization failures), not a lost version
check; it is not a match.

**Recommendation:** send the rebased 03 in one pull request with 08, 07 and 10 that references
#3490. It now carries its tests (`CommitVersionCheck.test.ts`; see "Send-ready state"). Point out
the `held` addition for review; it is explained in "The held-instance check" below.

### 04 `04-leases-follow-shard-ownership.md`

**Still as described, verified by reading code.** The lease is a bare expiry number
(`DurableObjects.ts:351` to `:353`, `:1744` to `:1750`), `ObjectStateShape` (`:120`) has no
activation or holder identity, and no file in `packages/domain/src` mentions `activation` or
`singleActivation`. Recovery after a kill still waits out up to `LEASE_MS`.

**Upstream:** no issue proposes this. It answers two existing threads: the overlap objection on #2763
(a holder identity per activation tells a live drain from a dead one, which is what that comment's
instance-local flag does within one process) and the latency note on #3220 (waking early when the
holder is alive).

**Recommendation:** post it as a comment on #3220 (and link it from #2763) rather than as a new
issue, framed as the follow-up that makes the reschedule safe for long-running drains.

### 05 `05-published-stream-after-rebuild.md`

**Still as described, verified by reading code.**

- A stream write's origin is still the input position and append index, with no generation:
  `packages/domain/src/Model.ts:1307` `const position: [number, number] = [meta.position, meta.appends];`.
- The stream still drops a write that is not after its stored origin, with no log:
  `DurableObjects.ts:1941` and `InMemory.ts:1357`, both `if (!isAfter(write.origin, meta.origin)) return;`;
  `isAfter` compares the two numbers only (`InMemory.ts:1539` to `:1542`).
- A rebuilt projection's input log still starts over: `DurableObjects.ts:1734` to `:1740`
  (`/** Start a log built by an earlier generation over. */`, `clearPrefixes(["in:"])`, `delete("meta")`).
- The stream object has no generation of its own: its empty meta is
  `{ seq: 0, checkpoints: {}, origin: [0, 0] }` (`Platform.ts:684`), and `streamObject`
  (`DurableObjects.ts:1921` onwards) reads no generation. The generation sum is unchanged
  (`Kernel.ts:801` to `:815`).

None of the 13 commits since 33c10dd touches this.

**Upstream:** nothing found.

**Recommendation:** needs a decision. It is ready to file as an issue; the write-up's option 2 (a new
stream per writer generation, or dedupe by source event) is a design choice the maintainers should
make, so file it as an issue with the in-memory reproduction, not as a patch.

### 06 `06-call-args-keep-undefined.patch`

**Applies:** no, but only for context: `main` adds `Callbacks` to `InstanceServices`
(`DurableObjects.ts:160`, #3215), which is the hunk's leading context. The `EffectCluster/index.ts`
hunks apply at offset +1 on `main` alone. The 3-way cherry-pick is clean. The rebased copy changes that
one context line only.

**Defect: present, verified by reading code.** The cluster transport still sends
`args: JSON.stringify(args)` (`EffectCluster/index.ts:311`) and spreads
`JSON.parse(payload.args)` (`:669`). The directory node still tests `after === undefined`
(`packages/domain/src/Backfill.ts:1659` and `:1665`), and the cluster `list` still adds
`AND key > ${startAfter}` whenever it is not `undefined` (`EffectCluster/index.ts:249`). The first
page is still requested with `after` unset (`Backfill.ts:1809` to `:1812`).

**Upstream:** issue #3381 (open, 2026-11-14) is this defect, with the same root cause, on Effect
Cluster and Rivet (Rivet's fetch RPC does the same). Draft PR #3382 (open, 2026-11-14) fixes it
differently and more broadly: one argument codec in `alchemy/Rpc` (`encodeRpcArgs` /
`decodeRpcArgs`) with a sentinel that keeps `undefined` in any position, used by `makeFetchRpcStub`,
`serveRpc` and the Effect Cluster host, with tests. A third user commented on 2026-11-15 that it
rebases cleanly and its tests pass, and asked the author to mark it ready.

**Recommendation:** drop 06 as a pull request. Optionally add 06's cluster evidence (a restored dump
whose new view held 0 of 11 earlier writes, then 11 of 11) to #3381 or #3382. Note that #3382
changes the wire format (a sentinel value), where 06 kept it; that is the one point worth raising
there.

### 07 `07-commit-fenced-on-shard-ownership.patch`

**Applies:** no. It is written on top of 03, so its `DurableObjects.ts` hunks fail on `main` and on
any `main` without 03. On `main` with the rebased 03 and 08, the `EffectCluster/index.ts` hunks
apply at offset +1 and only the hunk that wraps the commit transaction needs moving to
`main`'s `commit`. A 3-way cherry-pick onto the rebased 03 and 08 is clean and gives the same
tree as the rebased copy.

**Defect: present, verified by reading code.** Nothing on `main` relates a commit to shard
ownership: the storage transaction is the bare `withTransaction` quoted under 03
(`EffectCluster/index.ts:256` to `:258`); `migrate` creates only the table (`:263` onwards); the
runner pool is unnamed (see 08). #3490's point 4 observes, from Effect's `Sharding.ts`, that only
persisted messages (`Wake`) get Effect's own lock check before their reply is stored, and `Call` is
not persisted. I did not re-read Effect's `Sharding.ts` for this check; Effect is still 4.1.4, so
it is the same code 07 was written against.

**Worth a decision before sending:** #3420's decision protocol writes `meta` inside storage
transactions (`hold` at `DurableObjects.ts:1093` to `:1101`, `applyIntent` at `:1029` to `:1043`,
`release` at `:1000` to `:1003`, `txPrepare` at `:1369` onwards). The fence's trigger fires on any
`meta` write, so a runner that lost its shard cannot hold or apply a decision either, which is the
right outcome; but there the refusal arrives as a defect (a reported defect to the caller, or
`TwoPhase.Unreachable` for a participant), not as the retried failure that `send` gives. A probe
run confirms this; see "The fence and the Decision paths" below. Whether the decision paths should
map `ShardLost` the same way is a maintainer question.

**Upstream:** issue #3490 (see 03). Two open pull requests will conflict if they merge first:
#3221 (retention; currently conflicting with `main`) moves `objectStorage` and `migrate` into a new
`EffectCluster/internal.ts` and adds its own `pg_advisory_xact_lock` around migration DDL; #3422
(draft) replaces the runner's pool construction (see 08).

**Recommendation:** send the rebased 07 with 08 and the rebased 10, after 03, as a pull request
that references #3490. The regenerated copy no longer refers to an outside design note in the
fence's doc comment, and it corrects one inverted sentence there ("cannot complete only in" now
reads "can complete only inside").

### 08 `08-name-the-runner-pool.patch`

**Applies:** cleanly; neither file changed since 33c10dd.

**Defect: present, verified by reading code.** The runner's pool is still built with a URL only,
`packages/effect-cluster/src/internal/Bootstrap.ts:312`
`}).pipe(Layer.provide(PgClient.layer({ url: Redacted.make(env("CLUSTER_DATABASE_URL")!) })));`,
while the runner's address is `RunnerAddress.make(host, RUNNER_PORT)` (`:305`). No file in
`packages/domain/src` or `packages/effect-cluster/src` mentions `applicationName` or
`application_name`.

**Upstream:** no issue or pull request about naming the pool. Draft PR #3422 ("one Domain storage
pool per runner, and a pool setting for its database connections") replaces exactly this line, and
the same line in `runExternal`, with a shared `clusterDatabase` Layer that sets `maxConnections`. If
it merges first, 08 must move `applicationName` into the runner's use of it only (`runExternal`'s
pool holds no shards).

**Recommendation:** send it in the same pull request as 07: on its own it only adds a name to
`pg_stat_activity`, which is useful but is not what makes the case. Use `rebased/08`: the formatter
wraps one loop in `runnerPoolName`, and the copy carries the test of the name.

### 09 `09-projection-backlog.md`

**Still as described, verified by reading code.** `Projection.Progress` on `main` has `history` and
`caughtUp` only (`packages/domain/src/Projection.ts:107` to `:128`); #3380 changed what `caughtUp`
waits for (projections fed by a view), not the interface. The in-memory `Control` exposes `drain`
and `idle` only (`InMemory.ts:66` onwards), and its queue is still a closure-local array
(`InMemory.ts:153`).

**Upstream:** nothing found under "backlog", "projection progress" or "drained". (#2569, closed,
is about live view reads marking the end of their backlog, a different thing.)

**Recommendation:** needs a decision. It is a feature proposal that adds a member to a public service
interface; file it as an issue once 05 is filed, since the motivating case (handing a published
stream to a new writer) comes from 05.

### 10 `10-fail-at-start-without-a-named-pool.patch`

**Applies:** no, and it also does not apply at 33c10dd in the README's order. Its hunk in
`layerEntities` uses as context the line 02 adds,
`yield* Deferred.succeed(joined, yield* Sharding.Sharding);`, so it needs 02 applied first; the
README lists only 03, 07 and 08 as dependencies. On `main` with the rebased 03, 08 and 07, its other
hunks apply (the doc comment, `Host.ts`, `Bootstrap.ts`). The 3-way cherry-pick conflicts in
`EffectCluster/index.ts` for the same reason.

**Defect: present once 07 is applied.** Without 07 there is no fence, so a runner with an unnamed
pool behaves as today. `Host.ts` and `Bootstrap.ts` are unchanged since 33c10dd, so the
`RunnerHost` service still has no `poolName` (`packages/effect-cluster/src/Host.ts:24` to `:33`).

**What the rebased copy changes:** it moves the start check to just before the workflow engine is
released (after the sagas register), outside 02's hunk, so it does not depend on 02. Its
doc-comment hunk is gone, since the rebased 07 no longer carries the reference it removed. The check still fails the Layer the runner launches in the cluster, so the runner still
fails at start. With 02 applied, `joined` is now completed before the check runs; a background call
in that short window is still refused by the fence.

**Upstream:** nothing found.

**Recommendation:** send the rebased copy in the 07 pull request. It ran in process only; say so.

## Contribution requirements found

- There is no `CONTRIBUTING` file, no `.github/PULL_REQUEST_TEMPLATE`, no issue templates and no
  `.changeset` directory in the repository. The rules for pull requests are in `AGENTS.md` (which
  `CLAUDE.md` includes), section "Pull Request Conventions":
  - the title in conventional-commit form (`fix(domain): ...`);
  - the description starts with plain prose, no `#` or `##` headings (`###` at most), no
    "Test plan", "Testing" or to-do checklist, short sentences, code snippets preferred over prose;
  - outstanding work is signalled by opening the pull request as a draft, not in the description.
- Versioning: no changesets. Every package shares one version, bumped by the release workflow
  (`.github/workflows/release.yml`, `scripts/release/prepare.ts`).
- CI (`.github/workflows/check.yml`) runs `pnpm format:check` (oxfmt, print width 100, sorted imports),
  `pnpm validate:publish-packages`, `pnpm typecheck` (`tsrs -b`), `pnpm lint:providers`, `pnpm lint`
  (type-aware oxlint, with a separate config for tests), and the in-memory Domain suite
  (`pnpm test:integration test/Domain`), among other steps.
  `AGENTS.md` asks for `pnpm exec tsrs -b` before committing. The repository uses pnpm; tests run on
  its own runner through `pnpm test` / `pnpm test:integration` (not `bun test`).
- Tests: no written rule for this package, but the open Domain pull requests from outside
  contributors (#3220, #3382) each carry an in-memory unit test under
  `packages/integration-tests/test/Domain/` that fails on `main` and passes with the fix, plus
  `local`-tagged Docker cases that CI does not run. None of the seven original patches carries a
  test file; the rebased 03, 07, 08 and 10 now do.
- No CLA: no CLA bot or CLA text was found in the workflows, `README.md` or `AGENTS.md`.
- Issue first: not required anywhere. In practice outside contributors open an issue and a pull
  request together (#3381 with #3382, #3423 with #3424).
- Maintainer stance observed: on #2795 a maintainer asked an outside contributor to hold Effect
  Cluster host work until the host was rebuilt (#2924, since landed). #3220 has waited a week without
  a review.

## The held-instance check in the rebased 03

**What it does.** The commit transaction first re-reads the instance's stored `meta`. It writes
nothing when the version moved since `decide` was given its state, or when `meta.held` is set:

```ts
const stored = yield* storedMeta;
if (stored.version !== current.version || stored.held) return undefined;
```

When the transaction refuses, `commit` reads `meta` again and fails the call. It uses
`InstanceHeld` if the instance is held, and `CommitConflict` otherwise. `InstanceHeld` is what
`commit` already returns when it finds the instance held before deciding (`DurableObjects.ts:933`
on `main`). The caller, `whenFree` (`:1204` to `:1215`), already handles it: it settles whatever
holds the instance, then retries the whole commit for about 13 seconds, deciding again each time.

**Why the multi-aggregate Decision change makes it necessary.** Since #3420, a decision first
holds each instance it reads:

- `hold` and `txPrepare` write `meta` with `held: true` and the same version (`:1093` to `:1101`,
  and in `txPrepare`).
- When the decision commits, `applyIntent` records its events on top of whatever `meta` holds then
  (`:1011` to `:1046`).

Holding does not change the version. So a version-only check passes a commit that a runner
decided before the hold and commits during it. That is the stale runner of #3490. Its events land
on an instance the decision has already decided over. When the decision then applies, its events
go on top, and the decision's own invariant breaks (for a transfer: the balance covers it). On one
runner, `exclusively` prevents this. On two runners, nothing did.

**What the in-memory test shows.** The case is `CommitVersionCheck.test.ts`, "a commit on an
instance a decision holds waits for the decision, then decides again". It runs two runners over
one storage:

1. Runner 0 decides to withdraw all 100 from an account and stalls.
2. The instance moves to runner 1. There a transfer of the same 100 holds the account (`meta` is
   `held: true, version: 1`) and stalls while preparing the other account.
3. Runner 0 goes on.

The results:

- **On `main`:** the withdrawal commits on the held instance (log `Deposited 100, Withdrawn 100`).
  A probe run without the assertions shows the end state: the transfer is recorded on top, and the
  account ends at −100.
- **With the version check but without the held refusal:** the same failure.
- **With the rebased 03:** the withdrawal's commit is refused and the transfer commits (account
  versions 2 and 1). The withdrawal then decides again on a balance of 0 and is rejected with
  `InsufficientFunds { balance: 0 }`. The account ends at 0.

This check has run only in process; it never ran on a cluster.

Still not covered: the decision's own `hold` and `txPrepare` compare the version outside a
transaction (`:1092`, `:1368`). On a single runner, `exclusively` protects them. On two runners,
07's fence refuses their writes from a runner that lost the shard. Without 07, nothing
version-checks them inside a transaction.

## The fence and the Decision paths

This was shown by an in-process probe, not by one of the carried tests. The probe source and its
output are in `evidence/ProbeFenceDecision.test.ts.txt` and `evidence/probe-fence-decision.txt`.

The setup:

- a two-runner host that fences commits;
- a transfer from account A (the decision's primary) to B, started on runner 0, which holds A;
- when A calls B's `txPrepare`, the instance moves to runner 1, so runner 0's commit of the
  decision (`applyIntent` on A) is fenced with `ShardLost`.

What happened:

- **The sender gets a defect.** Its `send` dies (`Die`) instead of failing in a way that is
  retried, so it is not told the outcome.
- **Nothing is recorded.** A's log stays `Deposited 100`. A's `meta` is still `held: true` at
  version 1, and B's is `held: true` at version 0. After the hold, runner 0 completed no
  transaction on A.
- **The hold persists.** Three seconds later both instances are still held. In this host, the
  decision's wake-up alarm fires on runner 0, which is fenced again. On Effect Cluster the wake-up
  is a persisted message delivered to the current owner, so this part of the probe does not match
  the cluster, and it was not checked there.
- **A resend finishes it once.** Sending the same command id again reaches runner 1 and finishes
  the decision: the receipt shows A at version 2 and B at version 1, with one `TransferSent` and
  one `TransferReceived`. The next deposit on A commits at version 3. The balances end at A 71 and
  B 30.

So the fence keeps decisions safe: a runner that lost the shard records nothing for a decision,
and a later attempt completes it exactly once. The open part is what the sender sees: a defect
instead of the retried failure that `send` gets. Mapping `ShardLost` to a retry in the decision
driver is left as a question for the maintainers in the #3490 draft. A later command to a held
instance should also carry the decision on, since `whenFree` settles a held instance first; that
was read in the code, not run with the fence.

## Send-ready state

All of this was verified on 2026-11-18 against `main` 3ff34b94f6c4, re-fetched that day (it had
not moved). The clone is under `~/.cache/beep/`, with a full workspace `pnpm install` and the
`distilled` submodule. Heavy steps ran under `nice -n 19 ionice -c3`; the five-minute load stayed
under 30 on 64 cores.

**Over the whole set:**

- **Type check: passed.**
  - `pnpm typecheck` (the repository's own: `ensure:built`, `tsrs -b`, and the frontend-frameworks
    test project) exits 0 with the whole set applied.
  - `tsrs -b` on `packages/domain`, `packages/effect-cluster` and `packages/integration-tests`
    exits 0 with no diagnostics.
  - An error planted in each patched source file and in a Domain test file was reported, so these
    projects really are checked.
  - The first run found one error in our own test model (an effectful `decide` returned a
    rejection instead of failing with it). It is fixed.
- **Format: passed.**
  - `oxfmt --check` passes on every touched file, and on each patch's files at each step of the
    stack.
  - Formatting changed 03, 06, 07, 08 and 10; 01 and 02 were already clean.
- **Lint: passed on the touched files.**
  - `oxlint` passes with the repository config on the four patched source files, and with the
    tests config on the five new test files.
  - It first flagged one line of 03 (`yield* Effect.fail(new CommitConflict(...))` instead of
    `yield* new CommitConflict(...)`). It is fixed.
  - The repository-wide `pnpm lint` was not run.
- **Existing tests: no change.** Upstream's Domain suite (`test/Domain`, as CI runs it) passes 415
  of 415 on `main`. With the set applied, the same 415 tests pass under the same names, plus the 9
  new ones (424 of 424). See `evidence/domain-suite.txt`.
- **Application: README order verified.** The final copies apply cumulatively with
  `git apply --check` to a fresh `main` in the README's order. The resulting tree, ignoring blob
  ids, is byte-identical to the one that was type-checked and tested. The as-run order fails at
  07's import hunk, as explained under "Summary".

**Per item.** Summaries of the runs with and without each fix are in `evidence/`.

| Item | Copy to send | Type-checked | Formatted | Tests carried | Fails without the fix | Passes with it | Not covered |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 03 | `rebased/03` | yes | yes | `CommitVersionCheck.test.ts` (2 cases) with `two-runner-host.ts` and `two-runner-model.ts` | On `main`, the lost-write case fails `expected 1 to be 2` (the stale runner is acknowledged at version 1), and the held case fails `expected [ "Deposited 100", "Withdrawn 100" ] to equal [ "Deposited 100" ]`. With the version check only, the lost-write case passes and the held case still fails | 2 of 2 | the advisory lock in the Effect Cluster storage (needs Postgres); the cluster runs predate the held check |
| 08 | `rebased/08` | yes | yes (one loop wrapped) | `ClusterRunnerPool.test.ts`, "runner pool name" (2 cases) | `SyntaxError: Export named 'runnerPoolName' not found` (the function does not exist on `main`) | 2 of 2 | that the bootstrap passes the name to the pool (needs the runner bootstrap) |
| 07 | `rebased/07` | yes | yes | `CommitFence.test.ts` (1 case) and the host's `fenced` option | Without 07: `TypeError: undefined is not a constructor` (no `ShardLost`). With 07 but without its mapping in `commit`, the sender gets `Error: ShardLost` instead of a retried commit | 1 of 1 (receipt at version 1, only runner 1 committed) | the Postgres half (the `pg_locks` read, the deferred trigger, `AD001`), which cannot run in process; the decision paths (probe only) |
| 10 | `rebased/10` | yes | yes | `ClusterRunnerPool.test.ts`, "runner pool check at start" (4 cases) | `SyntaxError: Export named 'RunnerPoolUnnamed' not found` (it does not exist before 10) | 4 of 4 | the launch that runs the check inside a runner; never ran on a cluster |
| 01 | original `01` | yes | already clean | none (upstream #3220 has the fix and a test) | — | — | the overlap objection on #2763 (see `drafts/3220-2763-comment.md`) |
| 06 | `rebased/06` | yes | yes (the import moves) | none (upstream #3382 is the fix to follow) | — | — | — |
| 02 | original `02` to apply alone; `rebased/02` to apply after the set | yes | already clean | none (needs the runner bootstrap) | — | — | the whole fix, in process |
| 04, 05, 09 | `drafts/` | — | — | — | — | — | write-ups; nothing to run |

For 08 and 10, the "fails without" runs fail because the function under test does not exist
without the patch. That is accurate, but it is weaker evidence than a failure of behaviour. What
they guard against, a runner whose fence can never pass, can only be shown with the runner
bootstrap and Postgres.

The drafts in `drafts/` follow upstream's `AGENTS.md`: conventional-commit titles, no `#` or `##`
headings in descriptions, and no "Test plan". The evidence in them comes from the patch headers
and the README; none of it was re-measured.

## Not checked

- Nothing was run on a cluster in this round. The held-instance refusal in 03, the moved catch in
  07 and the moved start check in 10 have run in process only.
- The Postgres half of 07 has no test in the set: the `pg_locks` read, the trigger, `AD001`, and
  `migrate` creating the trigger. PGlite was not tried: it has a single connection, and the fence
  needs a second session that holds the lock.
- These repository-wide checks were not run: `pnpm lint`, `pnpm docs:check-jsdoc`,
  `pnpm exports:check` and `pnpm validate:publish-packages`. Only `oxlint` on the touched files was.
- The probe of the fence on the Decision paths runs in a host whose wake-up alarms stay on the
  runner that set them. It shows what a sender sees and that nothing is recorded. It does not show
  how Effect Cluster's persisted wake-up would settle the held instances.
- Effect's `SqlRunnerStorage.ts` and `Sharding.ts` were not re-read. Only the pinned version, 4.1.4,
  was confirmed unchanged.
- The rollout point raised in the #3382 draft (the sentinel argument reaching a runner on older
  code) was reasoned from the diff, not tested.
- The upstream search covered issues and pull requests with about twenty search terms, plus a list
  of open pull requests with "domain" in the title. Discussions, Discord and the website's docs
  were not searched. No match means none was found with those terms, not that none exists.
- Whether #3382, #3221, #3422 or #3424 will merge, and in what form, is unknown. #3221 moves
  `objectStorage` and `migrate` into a new file, and #3422 rewrites the pool line 08 changes; if
  either merges, 03, 07, 08 and 10 need another rebase.

