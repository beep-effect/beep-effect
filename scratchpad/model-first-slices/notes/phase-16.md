# Phase 16: the cluster run phases 12 to 15 never had (2026-11-18)

The stack ran on a single-node Docker swarm: Postgres, two runners and the front, stage
`mfs-conformance`, local state only. It was the first cluster run since phase 11. Phases 12, 14 and
15 were in process only, and this run found one defect from each of the first two.

On one fresh deploy of the final tree, every case of the suite passes: FINAL_COUNTS. The rebuild
case ran on that same tree before it, around a deploy of a copy with the generation bumped.

## Defects the run found

1. **Every runner exited at start.** Phase 12's start check (`checkRunnerPool`, D54) reads
   `ShardingConfig`. On a real runner the bootstrap launches a model's Layers under
   `NodeClusterHttp.layer`, which provides `Sharding`, `Runners` and `MessageStorage` and keeps its
   `ShardingConfig` to itself. The Layers' requirements are typed `any`, so it compiled; the
   in-process test provided `ShardingConfig` itself, so it passed. On the swarm both runners
   restarted in a loop with `Service not found: effect/cluster/ShardingConfig`.
   - **Fix:** the bootstrap builds the sharding options once and provides them again, as
     `ShardingConfig.layerFromEnv(options)`, to everything it launches. It is in the local
     `@alchemy.run/effect-cluster` patch, and as a diff against upstream in
     `notes/upstream/11-launched-layers-get-the-sharding-config.patch`.
   - **No in-process test would have caught it** as the tests stand: the bootstrap needs a
     database and a cluster. The deployed stack is the test; every case fails without the fix.
2. **Nothing on the cluster ended a directory rebuild.** `switchWhenCaughtUp` was called by tests
   only. A deploy that bumped `PartyDirectoryGeneration` would have built the new generation and
   read the old one for ever (since phase 15, kept current by forwarding).
   - **Fix:** `switchIfBehind(generation)` in `party/model/src/Directory/RebuildDirectory.ts`
     (behind: wait and switch; on the active generation or over an empty store: nothing), and the
     `DirectorySwitch` part of `PartyCluster`, which every runner runs until it succeeds. A deploy
     that bumps nothing looks once at start and stops.
3. **Three faults in the harness**, all in cases that had never run on a cluster in their current
   form.
   - `get` read a failed answer as `null`: a failed handler answers 503 with an empty body, and an
     empty body parses as `null`. The frozen-runner case then destructured `null`. It now fails on
     an answer outside 2xx. The same fault made a dead stack look like "the control route answered
     `null`" for ten minutes at the start of this run.
   - `runnerHealth` counted every row of `cluster_runners`. A killed runner's row stays, flagged
     healthy, until some runner unregisters; the cluster's own storage ignores a row whose heartbeat
     is older than the shard lock's expiry. The helper now reads the table the same way.
   - The frozen-runner case (D55), rewritten in phase 12, had its first cluster run here.

## The `/runs-state` route is gone

Every case reads a run through the runs contract's `RunState` query, as the intake human for a
review run and as the requester in the stored-forms case. A caller the session's view has not
caught up with is refused with `NotInSession`; the helper reads that as "not yet".

- The stored-forms case reads both runs as `cancelled` and looks at the stored tags directly:
  `Withdrawn` for the run that took a command, and phase 6's `Cancelled` for the one that was
  refused, which shows a refused command rewrites nothing.
- `runs/host/src/Runs.cluster.ts` serves the Runs Api and nothing else.

## What phases 14 and 15 left unverified, now run (`conformance/test/Directory.conformance.ts`)

- **Both hosts' migrations under a concurrent first use.** Twelve registrations at once across
  both runners with a search from the front in the same instant, as the database's first use of
  the directory. `party_migrations` and `runs_migrations` each hold their one migration once; all
  twelve parties are found, in bytewise order; no process logged a failed connect.
- **The production client's names and the new tables.** Rows come back as the contract's
  `DirectoryRow` (snake_case columns, the text array as a list) from `party_directory_rows_v_0`,
  with positions in `party_directory_positions`.
- **The position row's lock.** A session of the conformance's own took the survivor's position
  row. The merge's batch waited on `select "seq" from "party_directory_positions" ... for update`;
  three seconds later the row still read `{}` at position 1; once the row was free it read
  `{<absorbed>}` at position 2.
- **Cursors over both wires.** Five parties in pages of two follow the store's cursors to a `null`
  cursor. A cursor it did not issue is `InvalidCursor` over the contract's client, and
  `400 {"_tag":"InvalidCursor"}` over plain HTTP.
- **Search across letters outside ASCII.** `Élodie Ünal Øst` is found typed exactly, in lower case
  and in upper case. The stack's Postgres is `postgres:17-alpine` (musl libc, `en_US.utf8`, libc
  provider): `lower('ÉÜØ')` is `éüø`.

### The reviewer Api as plain HTTP JSON is served

`ReviewerApi.http.ts` had no caller and no test. The front now serves it under `/reviewer-http`
(`reviewerFetchAt`), and `party/host/test/ReviewerHttp.test.ts` holds it in process: a page answers
200, a foreign cursor 400, no credential 401.

- **`QUERY` works end to end here.** The library publishes a query as `QUERY /<Name>` with a JSON
  body. Node's `fetch` sent it and the front's server accepted it. A proxy or a browser client in
  front of it was not tried.

## A rebuild on the cluster (`conformance/test/Rebuild.conformance.ts`)

Generation 0 held 23 rows. A session of the conformance's own took the pointer's row, and a copy of
the tree with the generation bumped (`PartyDirectoryRowsV1`, its migration generated by the
documented steps) was deployed over the same state.

- **Read-your-own-write held.** A party registered on the new build was found by a search that
  waited on its receipt, while queries still read generation 0. It was stored in both tables.
- **The new generation replayed the history by itself**, and each runner's switch then waited on
  the held row (`insert into "party_directory_active" ... on conflict ... do update`).
- **The switch happened by itself** once the row was free: the pointer read 1, the search answered
  the same rows, both tables held 24 rows and generation 0's positions were gone.
- **After the switch a write went to generation 1 alone.**

The rebuild steps in the table file's doc comment are complete as written.

## Observations

- **Killed runners stay in `cluster_runners`, flagged healthy.** Effect deletes stale rows only when
  a runner unregisters. Nothing reads them, but the table is not a list of live runners.
- **The frozen-runner case's numbers.** A write sent 45 s into the pause was answered in
  FROZEN_QUICK_MS ms by the other runner, which had taken the shard. The write in flight on the
  paused runner was answered with a 503; its retry under the same command id got a receipt. Each
  write was stored once.
- **The fence case's numbers.** The shard moved FENCE_MOVED_MS ms into the pause; the paused commit
  was refused at `COMMIT`; the refused writes landed once, the last FENCE_LAST_MS ms after the
  unpause (bound 33 s); only two named sessions held locks.

## Not verified

- A Postgres created with the `C` locale: it folds ASCII only, and search would then miss
  `Élodie` typed in any case, exact included, because the adapter lowers the typed text in
  JavaScript and the stored name in SQL.
- A rebuild over a history large enough for the replay to take minutes.
- The restore-gated cases (`across`, `tally`, `handover`, `retirement`, `upgrade-*`). They read
  dumps from earlier phases, and the first migration does not adopt a database made before
  migrations existed (phase 14). They compile against the new helpers and were not run.
- `QUERY` through anything but Node's `fetch` and this front.

## Still the owner's

- Whether an empty search (every party of an org) is a supported use.
- `UnknownReservation`: 404 or 409.
- Whether old databases must be adopted by the first migration.
- D5 stays not met: the pass rests on local patches that are not upstream, now eight with 11.

## Teardown

TEARDOWN

## Gates

GATES
