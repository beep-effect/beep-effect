# Model-First Slices

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `shape`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

If `@alchemy.run/domain` and Effect Cluster had existed when the repo began, how would the
architecture standard have been designed, for a codebase where agents write, call and operate the
system alongside people?

## Next Open Question

The graduation gate is met (D53): every conformance case passes on the Postgres swarm host, on six
local patches. Retiring the repo-owned platform (D5) waits on an upstream release. Next for the
operator: read the upstream set under the prototype's `notes/upstream/` and say whether any of it
is sent (D54). After that the shape review: [`BRIEF.md`](./BRIEF.md) and the artifact predate D24
to D55 and have not been confirmed in words.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - the operator's brief and ground rules.
3. [`RESEARCH.md`](./RESEARCH.md) - the proposal, the prototype, the outside reviews.
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log, D1 to D55.
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch, awaiting the operator's confirmation.

## Trail

- 2026-11-14: phase 12, in process only: a startup error for an unnamed runner pool (its own
  upstream diff, not run on a cluster), the frozen-runner case, and the upstream set rewritten for
  a maintainer with an index. Nothing sent. Notes in `research/20`.
- 2026-11-14: D53 to D55: the patched pass meets the D16 gate while D5's retirement waits on
  upstream; the operator reads the upstream set before anything is sent; a write to a frozen runner
  is covered by a stated guarantee.
- 2026-11-14: phase 11 built D49 to D51 and reran the cluster suite on one build. Naming the
  runner's pool makes the fence exact: the invariant held in six of six runs. The drain check reads
  any publisher's backlog, the retirement check allows retiring generation 1 (not done), and a real
  upgrade from phase 8's code passed through the drain check. Every case passes, on six local
  patches. Notes in `research/19`.
- 2026-11-14: D49 to D52 settled phase 10's open points: name the runner's lock session so the
  fence is exact, make the drain check generic, retire a closed generation by a checker rule, hold
  upstream until the fence is settled. Phase 11 launched.
- 2026-11-14: phase 10 built D45 to D47 and reran the cluster suite. The backfill fix and the
  drain check pass, and the new stream generation is complete. The commit fence refuses a commit
  during which the shard changed hands, but a runner that already lost its shard can still be
  acknowledged, so D45's invariant fails in three of five runs. D5 not met. Notes in `research/18`.
- 2026-11-14: D45 to D48 settled phase 9's open points: fence commits on shard ownership, patch
  the backfill defect and rerun, drain the old publisher before an upgrade, hold upstream until
  the rerun. Phase 10 launched.
- 2026-11-14: phase 9 built D41 to D43 and reran the cluster suite. Every case passes as written:
  no write is overwritten, recovery finishes inside the 80-second bound, and the upgrade case
  publishes its fact. The stale runner is still acknowledged, and a fourth library defect (backfill
  lists nothing on Effect Cluster) leaves the new stream generation incomplete. D5 not met. Notes
  in `research/17`.
- 2026-11-13: D41 to D44 settled the three failing cases: patch the lost write locally, state
  one-lease recovery as the guarantee, publish facts from aggregate events with the publisher
  never rebuilt in place. Upstream is held until those are built and rerun. Phase 9 launched.
- 2026-11-13: phase 8 reran the cluster suite on the phase 7 code. The bundles build with the
  linked `@beep/*` sources; the saga fix holds on the cluster; a new upgrade case shows published
  facts dropped after a view version bump. Three cases fail. Notes in `research/16`.
- 2026-11-13: phase 7 wired the Effect build into the prototype's check and cleared 981
  diagnostics to zero; applied the operator's review (tagged-union state, `Option` by decode,
  `@beep/identity` keys); fixed the review saga. 152 tests pass. Notes in `research/15`. The cluster
  suite has not been re-run since.
- 2026-11-13: phase 6 patched two library defects locally and reran conformance: fifteen of
  eighteen cases pass, and a new timing reproduced the lost write D38 describes. Notes in
  `research/14`. The Effect language-service rules were found never to have run on the prototype;
  wiring `@effect/tsgo` and clearing its diagnostics is the next task.
- 2026-11-13: phase 5 ran on a local Docker swarm and was torn down. Upstream's ten Domain cases
  pass; three of the prototype's eight fail on two upstream defects (a killed runner strands its
  outbox; a runner cannot read a stream). D5 verdict: not yet. Notes in `research/13`.
- 2026-11-13: cluster run scoped (`research/12`): swarm required, the host's commit has no version
  check, upstream has no backup or restore. D37 to D40 settled; the operator approved
  `docker swarm init` on the workstation. Phase 5 (cluster conformance) launched.
- 2026-11-13: phase 4 verified (14 packages type-check, 130 tests pass). Seven of the eight D16
  gate items are proven in memory; the Postgres swarm conformance run is the one left. Notes in
  `research/11`. Committed locally.
- 2026-11-13: phase 3 verified (13 packages type-check, 98 tests pass); notes in `research/10`.
  D32 to D36 settled. Committed locally. Phase 4 (web package, proof inventory, deployment
  descriptors as data) launched.
- 2026-11-13: phase 2 verified (13 packages type-check, 68 tests pass); notes in `research/09`.
  D29 to D31 settled. Work committed locally on `explore/model-first-slices`, not pushed. Phase 3
  (a second product context, an integration fact, projection rebuild, stored-format compatibility)
  launched.
- 2026-11-13: another session stashed the shared checkout (untracked files included) and switched
  it to `main` while phase 2 was running. The packet and the prototype were restored from that
  stash, byte for byte, into a dedicated worktree on branch `explore/model-first-slices`; the stash
  was left untouched. Phase 2 resumed there. Still uncommitted.
- 2026-11-13: phase 1 of the rework verified (ten packages type-check, 38 tests pass); findings in
  `research/08`. Its questions settled as D24 to D28. Phase 2 (runs context, AgentRun, approval
  command, re-admission at each hop) launched.
- 2026-11-13: operator said to start the D15 rework. Phase 1 (file grammar, contract package,
  authority context, invocation relay) launched on the standalone prototype; phases 2 to 4 follow
  (agent run and approval; second context, integration fact, rebuild and compatibility; web and
  proof inventory). The fourth draft is filed as text in `research/07`.
- 2026-11-13: grill rounds two to four settled D6 to D23; Grok deep research filed
  (`research/05`), which added D21 to D23 and contradicted none of the rest. Packet moved to shape: `BRIEF.md` written and the
  fourth draft of the artifact published. Stopped at the shape review. Nothing committed.
- 2026-11-13: packet opened from a design artifact, a standalone prototype
  (`scratchpad/model-first-slices/`), an ADHD pass and two outside reviews. Grill round one
  settled D1 to D5.
