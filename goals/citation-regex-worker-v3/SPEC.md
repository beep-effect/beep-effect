# Citation Regex Worker V3 Spec

## Objective

Every regex evaluation spawns a child process: 291 spawns for ten extract
calls at about 130 ms each, the largest single cost in the engine. The child
exists so the parent can kill a synchronous `RegExp.exec` on a deadline, and
on Bun only an OS process kill can do that (a worker thread stuck in
`RegExp.exec` does not terminate).

This goal keeps the child process and the parent-owned SIGKILL and changes
how long the process lives: one regex worker at a time per request, serving
that request's jobs in sequence under a timer per job. Native capacity is
counted per admitted operation (a lane with one occupant) instead of per
process, so a request's Diff and Xml jobs never wait on its own regex worker.

The contracts are in
[`explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md`](../../explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md) sections 2.3, 2.4, 3.2, 3.3, 4 and 6; the review
that shaped them is
[`explorations/citation-engine-install-and-worker-reuse/research/design-review-2026-11-12.md`](../../explorations/citation-engine-install-and-worker-reuse/research/design-review-2026-11-12.md).
This goal starts after slice A2 of `goals/citation-engine-install-once`
merges, because the lane and session bind to the invocation's Scope.

## Non-Goals

- Worker threads or in-process regex evaluation.
- An engine-lived worker pool; it is a gated follow-on in the exploration's MAP.
- The stock `RpcClient.makeProtocolWorker` pool as the capacity authority.
- A session model for the Diff, Markup or Recognizer workers; they stay one process per job and only change where they start.
- A cross-job cache inside the worker.
- A new limit field or a changed limit value. The one policy change is a cross-field check.
- Any change to extraction output.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, and the design in
   the source exploration.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/law-practice/server/src/internal/Citation/` (`NativeAdmission.ts`, `NativeProcess.ts`, `NativeRpc.ts`, `ByteFrames.ts`, `RegexWorker*.ts`, `DiffWorker.ts`, `MarkupWorker.ts`, `Invocation.ts`)
- `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.limits.ts` (policy v2, one cross-field check) with a major changeset
- `packages/law-practice/server/test/` (fake worker, manual clock, spawn-count assertions, the real-process proofs)
- `packages/law-practice/server/vitest.shards.json` (re-recorded timings)
- Isolation evidence appended under `goals/citation-extraction-engine/history/evidence/` and this packet's `history/`

## Constraints

- Effect v4 only, checked against the Effect reference checkout.
- Design order is schema, then service contract, then implementation: the v3 message schemas and the limits check land before the session.
- The kill stays a parent-owned SIGKILL of a child process, through the existing retirement path: re-check `isRunning`, close the child Scope, then return capacity, or quarantine when unconfirmed. No graceful exit path.
- At most one child alive per lane and at most `concurrentOperations` lanes. `start` retires the current occupant with confirmation before the next spawn.
- Lane acquisition is uninterruptible and registers its finalizer before the OS spawn (release if no process record exists, retire if one does).
- The process is retired on any exit of a job wait other than success, and retirement completes before `evaluate` returns.
- The job timer covers the frame write, `Started` and the terminal reply. Startup has its own timer of the same duration.
- After a deadline or protocol violation the session is killed and never respawns; the request fails as a regex deadline fails today.
- Bind the descriptor before job preparation and include the encoded descriptor in the exact size preflight, so the frame bound is checked before payload allocation.
- The RPC request id is the job sequence number.
- B1 changes capacity accounting on protocol v2. B2 changes the protocol. A lane defect and a protocol defect never arrive in one PR.
- The predecessor's rule holds: the isolation decision changes only through a new policy version with equivalent interruption proof. Every proof runs against a real process, not a fake.
- The manual test clock must be able to expire the job timer without the startup timer, or the kill proofs prove nothing.
- Rewrite the spawn-count assertions to the new counts in the PR that changes them; do not delete them.
- Run the large citation replays on a remote worker or package-scoped, not on the shared workstation above the load cap.
- The repo is public: no secrets, no absolute home paths.

## Acceptance Criteria

- [ ] B1: `CitationNativeLane` exists; regex v2, Diff and Markup start through it; a markup request that interleaves regex, Diff and Xml work completes under the 1 and 1 policy with one child alive at a time; two concurrent markup requests complete under the 2 and 2 policy; a quarantine between lane acquisition and start strands no capacity; `citation-engine-policy/v2` ships with a major changeset.
- [ ] B2: on the count fixture from `citation-engine-install-once`, ten plain-text calls start 10 regex processes (baseline 291).
- [ ] B2, each against a real process: the deadline fires on a catastrophic pattern while the parent stays responsive and the process is confirmed dead before `evaluate` returns; a job after a killed job fails closed without a spawn; a wrong sequence, an early EOF, an oversize frame and a frame while idle each kill; interruption during `Sent` and during `Running` kills; started equals confirmed on every path.
- [ ] B3: protocol v2 code is deleted; `vitest.shards.json` timings are re-recorded; the five serial replays finish under half their watchdog on hosted CI; the isolation contract evidence records what weakened (jobs of one request share a process; a result is consumed before the worker dies) and what strengthened.
- [ ] Each slice's PR body carries the before and after count table from the same fixture.
- [ ] `bun run beep quality package-verify @beep/law-practice-server` and `@beep/law-practice-use-cases` pass for each slice.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Package verify | `bun run beep quality package-verify @beep/law-practice-server` and `@beep/law-practice-use-cases` | Passes |
| Count fixture | regex processes started per ten plain-text calls | 10 |
| Kill proofs | the eight real-process proofs in design section 4 | All pass on bun and node |
| Citation replays | hosted CI, and a remote-worker run recorded in `history/evidence/` | Identical results; under half the watchdog |
| Changeset | a major changeset for `@beep/law-practice-use-cases` | Present |
| Packet launcher size | `test "$(wc -m < goals/citation-regex-worker-v3/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/citation-regex-worker-v3/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/citation-regex-worker-v3` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add citation-regex-worker-v3 --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug citation-regex-worker-v3`; add a `kind: decision` file there, never edit this block._

### Count native capacity as one lane per invocation, 2026-11-12

A request-long regex lease would starve the same request's Diff and Xml processes, which share the total ceiling. Each admitted operation holds one lane with at most one child alive; a Diff or Xml job retires the idle regex worker first, with confirmation. Operator answer, exploration shape review. Rejected: release and reacquire per job (can queue behind another request) and raising the ceiling (doubles the live child bound). Source: `explorations/citation-engine-install-and-worker-reuse/research/design-review-2026-11-12.md`, finding 1.

Lane explore/citation-engine-install-and-worker-reuse

Reverse: Restore one lease per child process.

### Each job carries its parent-selected descriptor, 2026-11-12

The worker re-derives the program from the pattern bytes and checks it against the job's descriptor, as it does once per process today. Pattern material stays out of the argument list. The preflight and structural ceilings widen to cover the nested descriptor. Source: `explorations/citation-engine-install-and-worker-reuse/DECISIONS.md`, descriptor delivery, and design review finding 6.

Lane explore/citation-engine-install-and-worker-reuse

Reverse: Send a descriptor table at startup and reference entries by index.

### Keep a parent-killed child process with one regex worker at a time per request, 2026-11-12

Bun cannot terminate a worker thread inside `RegExp.exec`, so the kill stays an OS process kill. The worker is spawned lazily, serves the request's jobs in sequence under a parent timer per job, and never respawns after a deadline, because a regex deadline already fails the request. Operator answer, exploration align round 1. Rejected: an engine-lived pool (needs replace, recycle and poisoned-job rules, and one process sees every request's text) and a slimmer one-job entry (291 spawns remain). Source: `explorations/citation-engine-install-and-worker-reuse/DECISIONS.md`, regex worker lifetime.

Lane explore/citation-engine-install-and-worker-reuse

Reverse: Return to one process per evaluation (protocol v2).

### Separate startup and job timers, both regexDeadline, 2026-11-12

`regexDeadline` is at most one second and a spawn measured about 130 ms on a loaded host. Separate timers keep every job's matching bound independent of host load; the operation deadline still bounds the request. Source: `explorations/citation-engine-install-and-worker-reuse/DECISIONS.md`, per-job deadline accounting.

Lane explore/citation-engine-install-and-worker-reuse

Reverse: Fold startup into the first job's timer.

### Ship the cross-field limits check as citation-engine-policy/v2, 2026-11-12

The predecessor's isolation decision is reversible only through a new policy version with equivalent interruption proof. No field is added and no value changes; the check is regex processes at least equal to operations. Source: `explorations/citation-engine-install-and-worker-reuse/DECISIONS.md`, policy version.

Lane explore/citation-engine-install-and-worker-reuse

Reverse: Restore policy v1 and protocol v2.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
