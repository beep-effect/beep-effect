# Phase 8: the conformance suite on the swarm, against the phase 7 code

Phase 8 deployed the phase 7 code to a local Docker swarm with Postgres and ran the whole
conformance suite, one case at a time. That code includes:

- the review saga fix;
- the remodelled states and `Option` fields;
- `@beep/identity` and `@beep/schema` linked as source;
- rejections declared as `S.TaggedError`.

The library stayed at phase 6's two patches. The stack was then torn down and checked against the
new baseline.

The bundles built and started, once one phase 7 regression in the conformance wiring was fixed.
Results:

- upstream's ten cases pass;
- of the prototype's own cases, P5 now passes, P3 still fails as written, and P7b shows D38's lost
  write again;
- the restore with pending scheduled work passes;
- the new stored-forms case passes when old rows are written directly;
- restoring phase 6's dump under the phase 7 code fails at its last step, on a library interaction
  that phase 7's view version bump triggers.

## Did the bundles build, and what did that need

**Yes, after one fix to prototype code (deploy #2).**

The first deploy failed at plan time with
`DefinitionError: Increment is served, but no hosted aggregate handles it` (the library's
`Api.ts:585`). The cause was a phase 7 regression:

- **What phase 7 changed.** It rewrote `conformance/src/Conformance.cluster.ts`'s `apis` to build
  one context from `Layer.merge(upstream, twoRunners)`.
- **Why that broke.** Every hosted model provides its own `Model.Internals`. In a merged context the
  second model's internals shadowed the first's, so upstream's `app` looked for `Increment` in the
  two-runners model.
- **The fix.** Each model's context is now built separately and provided to its own Api, which
  matches phase 6's nesting. It did not show in memory because no test serves both Apis.

Nothing else was needed:

- **Images.** The runner image (Node bundle) and the front image (Bun bundle) built from the linked
  sources and started.
- **Readiness.** The front answered `/ready` with 200. Both runners joined and served from the first
  case on.
- **Logs.** No resolve or load error appeared in any log.

The conformance driver is the only consumer that needed a change. It runs the cases under vitest
in a container, and the linked `@beep/*` packages resolve to the worktree's `packages/`, with their
dependencies in its root `node_modules/`. Neither was mounted. The driver now mounts both read-only,
beside the prototype directory (README).

## The conformance table

| Case | Phase 6 | Phase 8 |
| --- | --- | --- |
| U1 to U10, upstream's Domain conformance | 10 pass | **10 pass** |
| P1 a command sent twice | pass | **pass** |
| P2 a lost response | pass | **pass** |
| P3 a runner killed right after a commit | fail as written | **fail as written**, the same way |
| P4 a projection crash between sink write and checkpoint | pass, window forced | **pass**, window forced |
| P5 a grant revoked between two hops of a running chain | fail: refusal not recorded | **pass**: refusal recorded, reservation given back, executor stopped |
| P6 a run waiting for approval across a restart | pass | **pass** |
| P7 two runners, stale runner paused in `decide` | pass, takeover seen | **pass**, but no takeover this time |
| P7b two runners, stale runner paused inside its commit | overwrite observed (D38) | **overwrite observed again** (D38), later than the case's own read |
| P8 backup and restore | pass, no pending work in the dump | **pass**, with a pending expiry delivered after the restore |
| P9 (new) stored forms written directly | not run | **pass** |
| P10 (new) phase 6's dump restored under phase 7 | not run | **fail**: no fact published on approval, so the run is not concluded |

Evidence is in the scratchpad (`p8-*.txt`, `p8-evidence.log`, `phase8-state.md`).

**P3.** The case's read timed out at about 49 s (`ConsistencyTimeout`). After the dead drain's
60 s lease, the store held one `ClaimAsserted`, review run `:1` `AwaitingApproval`, and no run `:2`.
Every reaction happened once, but after the lease. This is the same as phase 6.

**P4.** The forced window held: one sink row, the checkpoint's `INSERT` blocked, and `meta` at
`accepted 1, processed 0`. The runner was killed and the blocked backend ended. After the lease the
party was found, with one row and position 1.

**P5, as phase 7 fixed it in memory:**

- **The hop.** The run's next commit was held after `RunActivated`, and the propose grant was
  revoked (`ok`, version 3). The `settle` activity was refused: `Failure(RunRefused readmission:lapsed)`.
- **The claim.** The `record-refusal` activity succeeded, and the claim gained
  `event:3 ReviewRefused readmission:lapsed`.
- **The run.** It recorded `BudgetReserved 40`, then `RunRejected released: 40`. It is `Refused` with
  `reserved 0` and no reservations.
- **The executor.** The workflow's `run` reply is `Complete(Success)`, so it stopped cleanly.

**P6.** The run survived the runner kill and was `Completed` after approval.

**P7.** The stale runner was paused inside `decide`, and this time the other runner did not take
over:

- **During the pause.** The quick write timed out after 60 s. In phase 6 it committed in 29 ms on
  the other runner.
- **After the unpause.** `A` committed as version 1 and `B` as version 2, both on the stale runner.
- **Takeover.** The case is observational and passes, and nothing was overwritten. But this run did
  not exercise the takeover the case is about.

**P7b.** The stale runner was paused inside its commit, which stayed idle in transaction.

- **During the pause.** The other write blocked on the row lock, and its client timed out at 60 s.
- **After the unpause.** The held write was acknowledged as version 2. At the case's last read,
  eight seconds later, only `first` and `held` were stored.
- **Sixteen seconds after the unpause.** `event:2` was `other`, written by the other runner, and
  `meta` read `[first, other]` at version 2. The acknowledged held write was lost: D38's overwrite,
  as phase 6 saw it.

The commit path's missing version check stays unpatched, as briefed.

**P8, the restore with pending scheduled work:**

- **First attempt.** The runners were scaled to 0 within 40 ms of the before half's record. A
  runner's graceful stop then ran the hold's expiry 9.6 s after placement, so the dump would have
  held no pending work. It was not dumped.
- **Second attempt.** The runners and the front were frozen with `docker pause` within 130 ms of the
  record. The hold was `held`, version 1, with `cb:domain%3Aschedule:expire` pending. `pg_dump` ran
  while they were frozen.
- **The restore.** The stack was destroyed, deployed fresh and scaled to 0, the dump was restored
  (`--clean --if-exists`), and the stack was scaled back up. The after half passed.
- **Pending work delivered.** `HoldExpired` was stored at 05:09:33.366, after the restore, and the
  waiting run completed on approval.

**P9, the new case** (`conformance/test/StoredForms.conformance.ts`). It writes rows straight into
the cluster's object storage:

- two runs, from the frozen fixtures `AgentRun.requested.state.json` (phase 6's requested form, with
  three `null`s) and `AgentRun.cancelled-requested.state.json` (phase 6's cancelled-before-grant
  form);
- the session's `SessionRuns` view, in the snapshot form phase 6 stored (copied from phase 6's dump).

What happened on the cluster:

- **The requested run.** `CancelRun` from its requester was accepted at version 2. The run reads
  `Withdrawn`, and its stored `meta` is now today's form, without `accountable`.
- **The cancelled-before-grant run.** It reads `Withdrawn`, through the declared conversion, so a
  second cancel is refused with `RunNotRunning(cancelled)`.
- **The view.** Read after the receipt, it shows both runs `cancelled`, with `previous` and `parent`
  as `None`.

The old forms decode on the cluster as they do in memory.

**P10, phase 6's dump under the phase 7 code** (`RESTORE_PHASE=across`). Phase 6's `p6-cluster.dump`
was taken before approval, so it holds a claim with a proposal and its run waiting, all in phase 6's
forms. Restored into the phase 7 stack, every read passed:

- the run read `AwaitingApproval`, decoded from phase 6's form;
- `ClaimReview` (now version 1) was rebuilt in place to `Pending`, with the proposal and digest
  `pa5cc65`;
- `EffectiveParty` (version 1) read `Registered`;
- the directory found the party, the retried registration returned the first receipt, and the
  hold read `expired`.

Approval then committed (`ProposalApproved`), and the claim and its review read `Accepted`. But the
run stayed `AwaitingApproval` (`NeverHeld` after 60 s). See below.

## Cases still failing, and why

- **P3, the timing of the case.** Recovery after a killed drain waits out the 60 s lease, while the
  case's read gives up after about 10 s of retries. This is unchanged from phase 6, and the owner's
  decision is still open.
- **P7b, D38.** The commit path has no version check, so a stale runner's acknowledged commit can be
  overwritten. This is unchanged and expected.
- **P10, a library interaction triggered by phase 7.**
  - *What phase 7 rebuilt.* Phase 7 moved `ClaimReview` to version 1, so the `ClaimFacts`
    projection that reads it is rebuilt as generation 1 (`ClaimFactsProjectionV1`). Its input log
    restarts at position 1.
  - *What the facts stream kept.* The stream it writes, `PartyFacts/claims`, is not rebuilt, and kept
    phase 6's `origin: [1, 1]`. That is the position and append index of the last write by
    generation 0.
  - *What was refused.* Generation 1 handled the approval as its input 1, so its two appends carry
    origins `[1, 0]` and `[1, 1]`. `isAfter` (`InMemory.ts:1374`, used at `DurableObjects.ts:1487`)
    rejects both as earlier writes.
  - *The result.* The stream recorded the input's checkpoint (`ClaimReview/claim_restore_1111be3b: 4`)
    and no entry: `seq` stayed 2. No `ClaimDecided` was published, so the runs inbox never concluded
    the run.
  - *Why the backfill did not line it up.* The generation 1 backfill, run when first touched, found
    no instances (`instances: 0`), so nothing lined its positions up with generation 0's.
  - *What it means.* This is not a decode failure; every old form decoded. It is a hazard for
    upgrading over live data with a view version bump: a published stream can silently drop a
    rebuilt projection's first writes. The case and the library were left as they are.

## D5 verdict

**Not yet, and for the same two reasons as phase 6, plus a third.**

- **What passes.** The host passes upstream's ten cases. It passes the prototype's duplicate,
  lost-response, projection-crash, waiting-run, restore (now with pending scheduled work) and
  stored-forms cases. The revocation case (P5) now passes too: the refused report hop is recorded
  on the claim, the run gives back its reservation, and the executor stops.
- **First reason, P3.** Kill-after-commit still fails as written, on the 60 s lease.
- **Second reason, D38.** The overwrite reproduced again (P7b), and the commit path's version check
  stays unpatched.
- **Third reason, P10.** Restoring phase 6's data under phase 7 drops the first facts a rebuilt
  projection publishes. An upgrade with a view version bump is therefore not yet safe on this host
  without a stream-origin reset or a matching backfill.
- **Gate.** The repo-owned platform's retirement stays held. Also, P7 did not reproduce the takeover
  this time, so the in-`decide` timing is covered by phase 6's run only.

## Prototype changes this phase

- `conformance/src/Conformance.cluster.ts`: one context per hosted model in `apis` (the regression
  above).
- `conformance/test/StoredForms.conformance.ts`: new, holding P9 and the phase-gated P10.
- `runs/host/src/Runs.cluster.ts`: the conformance-only `/runs-state` route now answers in the
  state's stored JSON form, through `StoredAgentRunState`'s codec. This run showed it serializing
  decoded `Option`s as `{"_id":"Option",...}`, since phase 7 introduced them; the cases read only
  `_tag` and `outcome`. This change was made after teardown and is checked by type check and tests
  only, not on the cluster.
- `proofs/Proofs.data.ts`: `saga-refused-report-hop` now names its cluster evidence,
  `cluster-backup-restore` names the pending expiry and the pause, and `cluster-stored-forms` is new.
  `PROOFS.md` was regenerated.

`bun run check` exits 0 with no diagnostics, `bun run test` passes 152 tests (109 of 109 outcomes),
and `handlers:check` and `generated:check` pass.

## Teardown and the baseline

These steps ran in order:

1. `alchemy destroy` for the stage;
2. the `postgres:17-alpine` image the deploy pulled was removed by its digest (`d3244e8c`), because
   the node already had another;
3. `docker swarm leave --force` (this phase's `swarm init` created the swarm);
4. `docker network rm docker_gwbridge`;
5. `apps/practice/.alchemy/` was deleted.

No `practice-*` or driver service, container, network, volume or image remains. Against
`docker-baseline-3.txt`, the only difference is Docker's build cache: 764.7 MB before, 775.9 MB
after (+11.2 MB). It was not pruned. Free disk is 249 GB.
