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

### Bound revoked lane drains while retaining unresolved native ownership, 2026-11-14

Each withUse call retains admitted operations independently of caller cancellation. After callback revocation, reserve gets queueDeadline, release gets cleanupDeadline, and start gets queueDeadline plus two cleanupDeadline windows for prior-occupant retirement, admission and spawn transfer. These are conservative post-revocation completion budgets from existing policy fields, not new limits. Expiry poisons the lane and quarantines an acquired lease; the outer semaphore is released with typed cleanup-unconfirmed, while the retained operation and its private owner Scope keep unresolved resources. Invocation closure skips unresolved ownership, and late completion releases an unspawned lease or confirms the exact child through NativeProcess before returning capacity. Public retirement cannot release a pending spawn's lease. Interruption during masked drain is acknowledged within the same finite timer window. Callback context carries revocable call frames to reject nesting before lock acquisition, including nested child fibers, without fiber identity. No new spawn is admitted after poisoning.

Reverse: Replace the retained-work drain only with a protocol that preserves quarantine and late confirmed retirement without blocking invocation finalizers.

### Carry the regex engine on each v3 job; startup keeps limits only, 2026-11-14

Owner ruling on the second B2 stop. One invocation uses two dialects: the tokenizer installs `python-re` and the context matcher `python-regex-v0`. Design section 2.4 put the engine in the startup argv, which fits one process per evaluation and not one process per invocation. The engine becomes a required, parent-selected field of `CitationRegexWorkerJob`, beside the descriptor it already carries, and leaves `CitationRegexWorkerStartup`. It follows the earlier decision that each job carries its parent-selected descriptor: the worker never chooses or infers a dialect. Required with it: the engine is inside the exact size preflight and the finite property ceiling; the worker compiles each job under that job's engine and keeps no compiled program, cache or other state from one job to the next; a job whose engine fails its schema is a protocol deviation and kills; a real-process regression runs a `python-re` job then a `python-regex-v0` job (pattern `a(?i)b`, accepted by the second and refused by the first) in one process on both child runtimes. Rejected: restarting the process on an engine change (breaks one process per invocation and the never-respawn rule) and a common dialect (changes extraction output).

Lane feat/citation-regex-session

Reverse: Return the engine to startup only if every evaluator in an invocation is proved to use one dialect.

### Fence physical spawn at the owner hand-off after all owner waits, 2026-11-14

Round 4 revalidates lane closed/poisoned state and the specific withUse call after admission acquisition, its accounting span and its snapshot. The concrete physical owner's optional typed fence executes after the birth lock, owner checks, Scope/Ref/semaphore construction and record registration. The check and call to the captured spawner execute inside one synchronous Effect.suspend callback. Fence refusals remain typed child Exit failures; the lane retires the registered empty resource and returns its lease through the existing release path. An admitted hand-off that has already called the spawner retains the existing late-resolution retirement protocol. The permanent test failed on the review base with one real Bun/Node spawn, then passes with zero starts and exactly one return; it also revokes before drain expiry and sweeps every measured pre-hand-off owner scheduler boundary. Accepted limit: work that never resolves retains its private Scope and any quarantined capacity indefinitely. The guarantee is a bounded caller wait, not eventual settlement; releasing unresolved ownership would violate the one-occupant and confirmed-death guards.

Reverse: Replace the synchronous fence only with an equivalent authority protocol that proves zero physical spawns after revocation at every admission and owner continuation.

### Keep Diff and Xml preparation per request and retain Markup private queues, 2026-11-14

B1 does not require hoisting Diff or Xml to engine construction. Their preparation and per-job diagnostics remain per request. Markup private semaphores and queue/deadline guards remain: the default HTML cleaner serves the closed standalone port, whose callers need that queue. Xml passes lane.start explicitly. Diff receives both the starter and text reservation explicitly and performs no Invocation or native-admission lookup. No installed-stage, tokenizer, evaluator or detach count is moved.

Reverse: Hoist these objects only with an explicit replacement for their per-owner lifecycle and queue state.

### Keep markup quarantine per record and synchronize concurrent lane proofs, 2026-11-14

Each markup job owns its quarantine contribution. Remove reap's aggregate reset:
a concurrently registered record must remain quarantined until its own confirmed
retirement. NativeProcess retirement rechecks isRunning, closes the child Scope,
then invokes binding.release; the standalone binding invokes notification.confirm,
which drains its listeners once. A successful record.retire(true) therefore runs
that record's Markup onRetired callback. The callback decrements only when the
same record's uncertain flag was set by its failed retirement. If confirmation
wins the race, acknowledged prevents the increment; otherwise one increment is
matched by one callback decrement. No saturation clamp or blanket reset is needed.

A real-process regression holds reap on captured record A, lets B's retirement
expire, confirms A and checks B remains quarantined with starts refused. B's late
confirmation restores zero; repeated reap stays zero and started equals confirmed.
The test fails against the old reset for both Bun and Node children.

Force the first two composition spawns through a test-only Deferred barrier so
two admitted requests have live children before either proceeds. Keep exact peak
2. The other lane peak-2 proof already gates its two live child bodies on a
Deferred; serial peak-1 proofs do not depend on scheduling.

Respect the owner's reverted parent-runtime tests and restored producer-recovery
comment. Correct the evidence to 165 green Node-parent files / 740 tests, plus
three Node-parent red files with six passes / 26 failures due to Bun.version.
Existing goal references are retained; no new test goal-path reference is added.

Reverse: Restore aggregate bookkeeping only with an equivalent per-record confirmation proof; retain deterministic overlap.

### Prove closed and blocked stdin with paired real-pipe regressions, 2026-11-14

The owner accepts prompt channel-failed from genuine EPIPE and separately requires the job deadline on a child that leaves stdin open without reading. Neither error is delayed or suppressed. Both regressions use a real frame larger than 1 MiB, observe the incomplete real sink write, assert parent SIGKILL and confirmed death before evaluate returns, started equals confirmed, one capacity return, and fail-closed reuse without a spawn. The earlier Bun-parent probe did not distinguish write completion from awaiting a reply and left its manual clock undriven; the new probe measures backpressure and drives the job timer explicitly. No production sink patch or Effect version change is needed. Review round 2 evidence records the results.

Reverse: Replace the paired proofs only with equivalent real-process lifecycle assertions on both runtimes.

### Prove reachable coverage paths and retain typed native invariants, 2026-11-14

The owner extended this wave to hosted coverage job 132419052799 at b749cd91e7e.
Measure one test file per process, with explicit source includes; never run
whole-package coverage or edit the regression baseline. Merge the eight hosted
law-practice artifacts with single-file reports only to assess unchanged source
rows. MarkupWorker's current-source union uses its Html/Xml/adapter test reports,
because deleting the reset changed its source map. Keep that evidence distinct
from a fresh hosted producer run.

Add real refusal, process retirement, Scope closure, listener and lease-defect
assertions. The single-file tests reach every reported branch. No typed refusal
is converted to a defect, and the intentionally defective onRetired/lease-release
callbacks model the exact existing catchCause boundaries with real child records.
A test-only queue helper forks its waiter in the caller's explicit Scope: a child
fiber would disappear when the Unicode preparation timer fiber ends and remove
the contention before start. Explicit cleanup interrupts that waiter before
retiring the real blocker; its Scope finalizer preserves cleanup on every exit.

Six guard sites remain unreachable through current typed control flow and stay:
DiffWorker:62 Boolean decoder, :153 ownership transfer callback, :198-199 prepared
Option invariants; RegexWorker:132 ownership transfer callback; NativeLane:191
private permit invariant. Their source/line arguments and measured rows are in
history/evidence/2026-11-14-b1-native-lane.md. The artifact union clears every
reported regression floor. New NativeLane is 99.24/99.32/100/97.67 (L/S/B/F),
with the retained permit mapper the only miss. Report these guards to the owner;
never force them with casts, remove them or hide them with coverage directives.

Effect Vitest identified one new EV003 request fixture. Retain it as a reviewed exception under the existing direct-invocation fixture policy: the cleaner test keeps an open request budget and separately closes its lane Scope to prove refusal mapping. A shared Layer would merge the authority being tested. Fix the other four findings with explicit 30-second layer hook budgets and the existing narrow tokenizer platform layer; preserve all inventory rows outside the touched cleaner test.

Reverse: Rerun the same bounded coverage reports when callers or ownership invariants change; keep safety guards and baseline intact.

### Record policy v2 as breaking in the packet; the private workspace takes no changeset, 2026-11-14

The design asks for a major changeset with policy v2. `repo-sanity:changeset-graph` forbids a changeset for a private workspace, and `@beep/law-practice-use-cases` is private, so the changeset is removed. The breaking change is recorded here and in the PR body: policy tag `citation-engine-policy/v2`; a policy with fewer regex process slots than operation slots, and any v1 payload, is refused. No limit field or default value changes.

Lane feat/citation-native-lane

Reverse: Add a major changeset for @beep/law-practice-use-cases if the package becomes publishable.

### Retain the regex identity adapter and move physical ownership into the lane, 2026-11-14

regexOwner retains only the protocol-v2 start adapter and the evaluator spawner/Clock identity guard. It no longer creates a physical regex owner or claims native capacity. The lane owns the exact children. The existing per-job wrapper confirms retirement before returning a result, while its adapter has no independent lease. The lane and its physical owner are invocation-scoped; the lane unit and physical owner are lazy. The named standalone cleaner starter stays separate.

Reverse: Replace the adapter with the protocol-v3 session in B2; restore per-job native leases only with a policy reversal.

### Set the v3 job frame depth ceiling to 4, the exact nesting of the designed shape, 2026-11-14

Owner ruling on the B2 stop. Design section 2.4 embeds `CitationRegexPatternDescriptor` in the job and also says depth 3. Under the shared guard's root-inclusive count (`NativeJson.ts`, where flat v2 messages are depth 1) the designed shape is job 1, descriptor 2, profile 3, names 4. The 3 is a counting slip in the design: its intent, stated in the same paragraph and in review finding 6, is that the ceiling grows by exactly what the per-job descriptor forces and that the exact preflight measures it. The ceiling is therefore 4, the tightest value that admits the designed shape; nothing deeper is admitted. The shared guard's semantics do not change and v2 stays at depth 1. Required with it: a regression that accepts a job with a names object and one that refuses depth 5 before any payload allocation; the finite property ceiling (flat fields plus descriptor fields plus the capture-name bound); the name-length bound at job encoding against `processMessageBytes`; strict schema decoding after the preflight. Rejected: flattening the descriptor on the wire (a second codec for the same value, with its own identity validation, for no added bound) and a v3-only depth convention (two meanings of depth in one guard).

Lane feat/citation-regex-session

Reverse: Return to depth 3 only together with a flattened descriptor wire codec designed and reviewed first.

### Settle job bookkeeping on exact confirmed retirement, 2026-11-14

The explicit native start result carries onRetired registration. The existing physical owner invokes it from its confirmed-retirement binding, after isRunning and child-Scope close. A late acknowledgement or owner-Scope reap therefore releases Markup private slots and clears Diff/Markup diagnostics even when the job fiber already failed. Registration after confirmation runs immediately. Notifications do not kill, acknowledge death themselves or return unconfirmed capacity. The native admission transaction-isolation combinator is shared with reentrant cleaner-yield coordination.

Reverse: Remove the notification only if every owner-scope and late-retirement path settles the same private state.

### Reserve native lanes at the base admission points, 2026-11-14

Owner ruling 3 resolves this stop and authorizes CitationNativeLane.reserve,
including Diff. Reservation is the first native need: it claims the invocation's
unit without spawning. The request finalizer is already installed. It uses the
same short Semaphore and masked acquisition as start, and the same closed,
quarantined and yielding guards. A held unit is reused; reserve followed by start
counts one successful claim. Unused reservations return on Scope closure.

Regex reserves through the existing preparation acquisition callback, before
regexDeadline. Diff takes an explicit reservation effect alongside its explicit
starter and reserves at the existing preflight acquisition point, before payload
copying. Xml reserves after RPC preparation, at the old Markup acquisition point
inside annotateDeadline. Markup and Diff perform no request-authority lookup.
Standalone HTML keeps its own admission inside cleanDeadline at the existing
point after preparation. No public CitationCleaner contract changes.

The old no-op preparation acquisition is removed. The shared job supervisor's
adapter now executes actual lane.reserve there. Its per-job bookkeeping ticket
has non-releasing hooks because request Scope/yield owns the real native unit;
it neither claims another unit nor impersonates a standalone native lease.

Handover retirement remains inside start and its caller's job/stage timer. Under
built-in protocol v2 each job confirms retirement before returning, so the next
start can call retire on the retained previous record, but that call observes its
already successful retirement task. There is no live-child handover retirement
on the serial built-in v2 path. Direct lane clients can start with a live occupant;
that guarded handover remains required and proved with real children. An
unconfirmed job retirement fails the call and poisons the lane; it never becomes
a built-in path to another spawn.

Real Bun/Node child proofs cover queue-full and queue expiry for regex, Diff,
Xml and standalone HTML; global quarantine before reservation starts no job
child; a successful reservation followed by the captured job timer confirms
physical death and retains/returns capacity according to the boundary. The regex
queue proof observes that regexDeadline has not even started while admission is
queued. The direct-stage deadline fixture suppresses only the enclosing invocation
timer of equal duration to isolate the worker's captured timer, leaving production
timer placement unchanged. Source references, exact refusals and runtime receipts
are in history/evidence/2026-11-14-b1-reservation.md.

## Behaviour that changes by design

The base acquisition/error/timer comparison applies when an acquisition meets
the same admission state. Design 3.2 rule 1 intentionally retains one native unit
per admitted operation from first need until invocation Scope closure or cleaner
yield; the base returned capacity after each child's confirmed retirement.

Under 1/1, an invocation can finish regex and continue non-native work beyond the
queue deadline while holding its idle unit. A direct host call to the exported
HTML cleaner could acquire on the base but can now fail with
CitationSafetyLimitExceeded { operation: clean, limit: queueDeadline }. Under
2/2, two idle invocation holders cause the equivalent external contention.
This lifetime is what goal B's protocol v3 session relies on. Keep it unchanged;
reservation preserves placement and translation, not between-job availability.

Reverse: Revert the reservation wiring only with an owner-approved replacement that preserves preflight, queue, timer and quarantine precedence.

### Pass native starters explicitly across closed cleaner boundaries, 2026-11-14

Owner ruling: a native starter crosses a closed boundary as an explicit argument,
never a Context lookup or an optional fallback. Markup and Diff take the lane's
start shape explicitly at call time or per-request construction. Invocation-owned
regex, Diff, Xml and HTML cleaning all use that invocation's lane. A named
standalone starter claims one native unit per process only for genuinely external
calls, retaining confirmed retirement and quarantine. The public cleaner port
keeps its shape. This supersedes the earlier proposal to exempt engine HTML
cleaning from lane accounting.

Owner ruling 2, recorded in the cleaner-yield decision, supersedes the earlier
requirement that engine HTML cleaning use the lane starter directly. The closed
port uses the standalone starter only after the lane yields its unit.

## Historical call-path audit (at e607ca22cad, before B1 implementation)

Paths below are relative to `packages/law-practice/`.

There is exactly one production call expression to `CitationBuiltinCleaners.invoke`:
`server/src/internal/Citation/CleanerRegistry.ts:357`. Registry construction captures
that object at line 99. Its callers reach it through `CitationCleaner.invoke`:

| Entry / route | Invocation status |
| --- | --- |
| Engine clean: `server/src/CitationEngine/CitationEngine.layer.ts:152` -> `server/src/internal/Citation/SourceCleaning.ts:74` -> `CleanerPipeline.ts:236` -> `CleanerRegistry.ts:357` | Inside `openCitationInvocation`, engine layer lines 138-149. |
| Engine extract: engine layer line 157 -> source/document extraction -> `InputDocument.ts:169` -> `CleanerPipeline.ts:236` -> `CleanerRegistry.ts:357` | Inside the same engine invocation. Plain input with cleaning steps uses `InputDocument.ts:176`; markup uses line 193. |
| Six-form extractor: `server/src/CitationExtractor/CitationExtractor.layer.ts:90-100,132` | Has an invocation but uses Recognizer, not this cleaner; no route into builtin invoke. |
| Direct returned registry runtime / pipeline / builtin invocation | No invocation is required by the closed port; an external caller can invoke it directly. If a caller already has an invocation, the current port still has the identical signature and object. |
| Nested cleaner plan: `CleanerPipeline.ts:252` calls `execute`, whose line 236 dispatches through the same runtime | Inherits the caller's invocation status; it creates no invocation. |

Other source-level host dispatch is `CleanerRegistry.ts:361`, calling captured
`protocols.invoke`. `DocumentCleanerProtocols.ts:196` spreads the supplied host
protocols, retaining that invoke implementation. Those callbacks are opaque to
the engine. This inspection does not establish that an arbitrary host callback
actually starts a process; its implementation is not available here.

Direct test adapters also reach builtins: `CitationBuiltinCleaners.test.ts:197`
(the pipeline is invocation-bound at lines 163-164), and
`CitationCleanerRegistry.fixtures.ts:121` (wrapper around the real builtin).
`CitationUnicodePipeline.fixtures.ts:134` wraps the registry runtime; its pipeline
is invocation-bound at lines 145-149. These do not add production entry paths.

### Object identity

Yes, in the default assembly the engine uses the same closed registry runtime
that is exposed to the host. `DocumentServices.ts:61-71` creates one registry,
provides its runtime to the pipeline, and puts that exact runtime into the output
Context. Line 74 also returns the registry and builtin objects. The default engine
passes these services into install (`CitationEngine.layer.ts:276-280`).
`SourceCleaning.ts:45` captures `CitationCleaner` and provides that same object
at line 78. General `CitationEngineLive` instead accepts whatever public cleaner
the host supplied; it does not require the internal registry or builtin service.

### Does one invocation use both cleaning and other native work?

Yes: markup extraction cleans at `InputDocument.ts:193`, then computes geometry
at line 196 (regex and Diff), then tokenizes in `DocumentExtraction.ts:173` after
initialization at lines 185-187. Those stages share one invocation. In the normal
built-in source order, HTML cleaning precedes regex/Diff; inspection found no
normal built-in path holding a regex/Diff/Xml occupant before entering that HTML
cleaner. Today no lane exists, so no current execution can literally hold a lane
occupant. Host callback reentry and process use are opaque, not proved absent.
Engine annotate does not call this cleaner pipeline; it has its own geometry/Xml
path. Engine resolve does not call it either.

## Historical second stop: resolved by owner ruling 2

The internal default assembly can be given an explicit-starter entry. That alone
cannot satisfy the ruling for the general live engine: `SourceCleaning.ts:45`
and `InputDocument.ts:143` capture the public `CitationCleaner`, and
`CleanerPipeline.ts:73,236` has only that port's closed invoke method.
`use-cases/src/CitationEngine/CitationEngine.cleaner.ts:238-260` defines it;
`use-cases/src/server.ts:23` exports it. Neither invoke nor the public
`CitationCleanerWork` argument (cleaner.ts:203-217, exported at server.ts:373)
carries native starter authority.

Passing the starter through an arbitrary existing implementation requires a public
contract amendment or an additional required installation capability specifying
how host cleaners bind invocation authority. Substituting a new internal runtime
would bypass the host's cleaner semantics and owned-value/registry identity.
A Context lookup, optional fallback, identity cache, or silently using standalone
inside the engine is forbidden. Per owner ruling item 5, stop here before lane
implementation. No claim is made that an unseen host callback was observed
spawning; the demonstrated blocker is the exported port on the explicit argument
route, independently of that second possible stop condition.

Proposed next ruling: define the required host installation capability for an
invocation-bound cleaner view, including preservation of registry/value identity
and host invoke semantics, or explicitly authorize a public cleaner contract
amendment carrying starter authority. No such change is implemented here.

Reverse: Replace the explicit starter route only through a new owner ruling with equivalent capacity proofs.

### Stop B2 at startup-only engine selection for mixed-dialect invocations, 2026-11-14

B2 is stopped again under the implementation brief's explicit conflict rule.
The depth stop is resolved by owner ruling 3195ce21182. This stop concerns source
engine identity, not depth, the B1 spawner/Clock fixture fixes or capacity.

## Binding contract and live source

- Design rev 2, explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md:102-110
  puts limits and engine in startup; the v3 job has sequence, descriptor and the
  v2 payload fields, with no engine.
- packages/law-practice/server/src/internal/Citation/RegexEngine.ts:8-14 defines
  two exact pinned dialects, python-re and python-regex-v0, and explicitly says
  the engine is never inferred from flags.
- Tokenizer.ts:150-154 installs its evaluator without an engine argument;
  RegexWorker.ts:32-36 defaults that evaluator to python-re.
- ContextMatcher.ts:88 installs its evaluator with python-regex-v0. Its search
  calls evaluate at lines 89-98. These evaluators share CitationInvocation.regex.
- RegexSessionProgram.ts:42-44 decodes startup once; lines 63-65 pass that same
  startup engine plus each job's descriptor to makeCitationRegexEvaluation.
- RegexWorkerEvaluation.ts:45-48 creates the descriptor registry and compiler
  under startup.engine. RegexSession.ts starts the process only when no transport
  exists. A subsequent evaluator's engine has no wire field to change it.
- RegexProgram.ts:701-702 rejects a global inline case directive after tokens in
  python-re, while python-regex-v0 permits that construct. Other dialect branches
  exist at lines 419, 436, 595, 663, 803 and 907.

One invocation therefore needs both dialects, but the designed wire fixes one
dialect for all jobs in that process. A descriptor carries hash, flags and
profile, not engine identity. Inferring the engine or silently using one dialect
for both changes matching behavior. Restarting on an engine change abandons the
one-process plain-text count target.

## Observations

The real-child session transport proofs pass 18/18, including both Bun and Node
children, and the structural regressions pass 4/4. Those homogeneous-engine tests
do not prove mixed-engine extraction.

The serial public replay exposed the conflict: CitationCanonicalDump.test.ts
fails on both Bun and Node with CitationRegexTranslationFailure,
reason unsupported-syntax, while running ContextMatcher from post-case metadata
after the session is already in use. CitationCanonicalAnnotationWorkflow,
CitationCanonicalCourts, CitationCanonicalExtraction and further public replays
fail at the public boundary with CitationInputError. Do not attribute these B2
mixed-engine failures to the B1 fixture work.

A separate read-only probe compiled the same synthetic native ASCII pattern
a(?i)b with flags 0 under both current compilers and unchanged default limits:
python-re rejected it with CitationRegexTranslationFailure/unsupported-syntax;
python-regex-v0 accepted it. This confirms a real dialect distinction without
relaxing a guard or running regex in the parent.

The queued test batch was stopped after its current file completed. Remaining
tests and the final canonical count gate are not claimed. Full receipts and
limits are in history/evidence/2026-11-14-b2-regex-session.md.

## Resolution options

1. Recommended: amend protocol v3 so every job carries the explicit
   parent-selected CitationRegexEngine. The worker must construct that job's
   registry/compiler with the job engine. Move engine out of startup, or specify
   why a startup copy remains. Include the engine in exact size preflight and
   the finite property ceiling; retain depth 4, descriptor binding, strict
   decoding, all timers and confirmed retirement. Add a real-process regression
   alternating dialects in one process and then run the unchanged ten-process,
   291-evaluation count gate.
2. Define and prove a new common execution dialect that is equivalent to both
   pinned sources for every admitted pattern and Unicode/case/verbose behavior.
   This needs a new design and source-family evidence, not an implementation
   substitution.
3. Restart on engine changes and explicitly revise the lifetime/count objective.
   This cannot claim the current ten-process acceptance target.

No resolution was implemented. No per-job engine field, inferred engine,
shared dialect, new pool or engine-switch respawn was added. The transport work
is committed locally for review of the stop; B2 is incomplete and not in review.
No success checkpoint, push, PR, rebase or base merge was performed.

Lane feat/citation-regex-session

Reverse: Specify per-job engine authority or another reviewed mixed-dialect contract, then resume B2.

### Stop B2 at the descriptor depth conflict, 2026-11-14

B2 is stopped before implementation under the implementation brief's explicit
conflict rule. The required per-job descriptor shape and the required structural
depth ceiling cannot both be honored by the existing JSON preflight.

## Evidence

- Binding design rev 2, explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md:106-110 requires
  descriptor: CitationRegexPatternDescriptor inside Evaluate.
- The same design at lines 125-128 requires depth 3, an expanded property ceiling
  and capture-name length accounting. The implementation brief repeats depth 3
  as a hard deliverable and forbids weakening safety guards.
- packages/law-practice/server/src/internal/Citation/RegexDescriptors.ts:77-80
  puts profile inside the descriptor; lines 41-46 put names inside profile.
- packages/law-practice/server/src/internal/Citation/RegexProgram.ts:162 defines
  names as a required S.Record. Empty names still encode as an object.
- packages/law-practice/server/src/internal/Citation/NativeJson.ts:78-87 starts
  depth at zero and increments at every opening object, including the root.
  Lines 104-106 apply that rule to every unquoted opening brace.

The required nesting is Evaluate (1), descriptor (2), profile (3), names (4).
Even a job with no named captures therefore exceeds depth 3.

A read-only Bun probe in the server package built an S.Struct from the existing
CitationRegexWorkerJob.fields, replaced the version with the v3 tag, and added
sequence: S.Natural and descriptor: CitationRegexPatternDescriptor, exactly as
the design specifies. Schema encoding succeeded and retained an empty names
object. Calling the actual preflightCitationNativeJson with propertyCeiling 100
rejected the encoded bytes at maximumDepth 3 and accepted the identical bytes
at maximumDepth 4. The synthetic fingerprint was schema-valid placeholder data;
this probe proves structure only, not registry binding or execution authority.
A second minimal structural probe gave the same result.

## Options for the owner

1. Recommended: amend the v3 design and implementation brief to depth 4 using
   the existing root-inclusive guard semantics. Retain the exact encoded-byte
   preflight, a finite total property ceiling, the capture-name bounds, strict
   schema decoding and all other safety guards. Add regression cases accepting
   the required names object and refusing depth 5 before implementing B2.
2. Redesign the descriptor wire representation to fit depth 3. Specify the
   codec, identity/profile validation and exact preflight before implementation;
   this changes the currently required descriptor schema on the wire.
3. Explicitly define a different v3-only depth convention or structural guard,
   with equivalent limits proved. Do not silently change the shared guard's
   root-inclusive semantics, which would affect existing protocols.

No option was implemented. No production code or tests changed; no guard was
weakened and no existing test was deleted. B2 remains pending and has no
ten-process count result, real-process proof result or in-review checkpoint.
Protocol v2 and B1 remain intact. The implementation lane is
feat/citation-regex-session; publication remains with the owner.

Lane feat/citation-regex-session

Reverse: Resolve the v3 depth and descriptor contract explicitly, then resume B2.

### Yield lane capacity across closed cleaner port calls, 2026-11-14

Owner ruling 2 supersedes the second stop. CitationCleaner and CitationCleanerWork
remain unchanged. The cleaner port is a separate boundary, like Recognizer: its
native children use a named standalone starter and their own per-process leases.
The default HTML cleaner passes that starter explicitly to MarkupWorker. Diff,
regex and invocation-owned Xml use the invocation lane. Neither Diff nor Markup
looks up an invocation, a lane or native admission.

Lane rule 1 is amended: one unit is held from the first native need until the
invocation Scope closes, except while calling through the closed cleaner port.
The pipeline wraps each invoke with lane.yieldTo, including nested cleaner plans.
Yield confirms retirement of the current occupant, returns the unit, runs the
port effect, and leaves the lane un-acquired. The next start acquires lazily.
An unconfirmed retirement quarantines and prevents the port effect from running.
There is no alternate spawn or graceful-exit path. A lane whose retirement was
unconfirmed remains terminal even after late confirmation returns the unit; both
start and yieldTo refuse further work in that invocation. The real-process proof
checks this after acknowledgement as well as before it.

NativeAdmission.ts uses concurrentOperations for the total active ceiling; the
regex subset additionally checks concurrentRegexProcesses. Policy v2 requires
that subset ceiling to be at least concurrentOperations (default 2/2; test 1/1).
For admitted operations following this serial native-call contract, each holds
at most one unit, in its lane or its cleaner call. Other admitted operations
therefore cannot fill the final unit needed by this operation. The shared native
admission still enforces its hard total ceiling across separate external callers;
quarantine refuses native work rather than admitting a replacement.

Normal built-in HTML cleaning precedes geometry/regex native work. Yield there
has no held unit to return and performs no new admission or owner-open check.
It preserves the port call's order and refusal. The reversed regex-then-HTML
proof deliberately uses a direct-stage invocation because the built-in order
does not exercise that transition. The snapshot and probe count cumulative
successful unit acquisitions, so a later reacquisition is observable.

Review round 1 corrects the initial fiber-reentrant lock implementation. No lock
is held across the opaque cleaner effect. A one-permit Semaphore serializes only
entry and exit against lane start/handover. On the depth 0 -> 1 transition,
confirmed retirement and unit return finish before incrementing depth or running
the effect. Other entrants cannot pass that transition until it finishes. Each
successful entry increments logical depth; a masked finalizer decrements it on
every exit. A start during any yield still fails closed. Unconfirmed retirement
leaves depth unchanged, quarantines, and never runs the effect.

This preserves forked and concurrent work.nested plans from any fiber. Independent
host cleaner calls may themselves request multiple standalone children; the
shared admission still bounds their total and applies its original queue policy.
The one-unit-per-operation counting argument above applies to the serial built-in
call path, not arbitrary host parallelism. Tests explicitly exercise concurrent
yields with two real children under the 2/2 policy, without promising serialization
of opaque host code. No transaction is held or introduced around that code.

The four original lane proofs and the cleaner additions run against real Bun and
Node children. New proof files also pass under a Node-parent Vitest runner using
explicit Node platform services. Kill/retirement remains the existing physical
owner's SIGKILL, isRunning re-check and child-Scope close before acknowledgement.

Arbitrary host-cleaner parallelism is bounded by the shared admission but is not
proved deadlock-free; the one-unit counting argument covers serial built-in calls.
A recursive public engine call from a cleaner still needs a second operation
permit, as on main; yielding native capacity does not release that outer permit.

The private lane snapshot exposes the existing yield-depth counter so the combined
two-entrant unconfirmed-retirement proof asserts depth zero directly. This adds
an observation only; it changes no transition, failure or lane lifetime.

Reverse: Restore request-long lane ownership only after replacing the cleaner boundary with an owner-approved explicit authority contract.

### Use incremental Noble hashing only for descriptor candidate selection, 2026-11-14

Effect v4 Digest accepts one contiguous byte array and provides no streaming or multi-part input. The existing catalog dependency @noble/hashes is declared by the server package to hash the width byte and borrowed bytes incrementally without a pattern-sized concatenation before exact frame preflight. Selection chooses only a candidate; the captured Effect Digest service remains authoritative after preparation. The permanent registry regression compares selection with that service for all three widths, empty storage and 36 SHA-256 boundary vectors. No cache or compiled program is retained. Dependency and cache-policy validation is included in the root beep lint receipt.

Reverse: Replace selection with a multi-part Effect Digest API when available, retaining exact preflight allocation ordering and the cross-implementation vectors.

### Validate evaluator runtime against the lane and retain installation closure, 2026-11-14

Hosted round 1 exposed fixtures whose invocation opened outside their counting spawner or captured Clock. Each evaluator must match the lane runtime on every evaluation, including the first. CitationNativeLane.matchesRuntime compares the actual captured handles; regexOwner caches only an adapter. Remove ineffective provides around Effect.succeed. The evaluator also retains an installation-Scope closed flag and refuses closed before runtime comparison, preserving the closed-owner failure rather than trying a deleted worker path and returning spawn-failed. This does not move physical children out of invocation Scope. Fixtures must open their invocation with the same spawner and Clock, including the Clock captured by their operation admission; matching sleep functions in different Clock objects is insufficient. Keep expected process counts and budget/refusal assertions; move capacity-return assertions after invocation closure where lane lifetime requires it.

Reverse: Replace these guards only with equivalent lane-runtime and closed-installation refusal checks.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
