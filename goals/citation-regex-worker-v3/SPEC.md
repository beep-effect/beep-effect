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

### Keep Diff and Xml preparation per request and retain Markup private queues, 2026-11-14

B1 does not require hoisting Diff or Xml to engine construction. Their preparation and per-job diagnostics remain per request. Markup private semaphores and queue/deadline guards remain: the default HTML cleaner serves the closed standalone port, whose callers need that queue. Xml passes lane.start explicitly. Diff receives both the starter and text reservation explicitly and performs no Invocation or native-admission lookup. No installed-stage, tokenizer, evaluator or detach count is moved.

Reverse: Hoist these objects only with an explicit replacement for their per-owner lifecycle and queue state.

### Retain the regex identity adapter and move physical ownership into the lane, 2026-11-14

regexOwner retains only the protocol-v2 start adapter and the evaluator spawner/Clock identity guard. It no longer creates a physical regex owner or claims native capacity. The lane owns the exact children. The existing per-job wrapper confirms retirement before returning a result, while its adapter has no independent lease. The lane and its physical owner are invocation-scoped; the lane unit and physical owner are lazy. The named standalone cleaner starter stays separate.

Reverse: Replace the adapter with the protocol-v3 session in B2; restore per-job native leases only with a policy reversal.

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

Reverse: Restore request-long lane ownership only after replacing the cleaner boundary with an owner-approved explicit authority contract.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
