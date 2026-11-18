# B1 review round 1

Branch `feat/citation-native-lane`; reviewed head `03bac290777`;
implementation base `0e2b4c42e6d`. Two MAJOR findings verified and fixed locally.
No push, PR, rebase, subagent or stash operation. B1 remains held on the separate
admission/deadline conflict found by the requested audit; see the stop decision.

Paths below are under `packages/law-practice/server/src/internal/Citation/`
unless qualified. Line references describe this review commit's source.

## Ownership transfer

MarkupWorker.ts:135-152 now masks start, local lease assignment, record insertion
and retirement-notification registration together. Preparation and child RPC
remain restored; retirement and all safety checks remain. Both original review
findings were verified against the Effect reference checkout: Effect.ts:7699,
7735 (interruptibility restoration), TxReentrantLock.ts:209-217 (fiber owner),
and Semaphore.ts:374-390 (permit release and restored effect semantics).

Audit of other starter callers found no equivalent gap: NativeProcess.ts:147-168
masks owner.start plus its Effect.tap assignment, including DiffWorker.ts:144-148's
adapter/track registration and the regex adapter in RegexWorker.ts:85-110.
The physical owner records ownership before spawn (NativeProcess.ts:308-335).
NativeLane.ts:191-242 masks its entire handover, occupant assignment and returned
notification. Its standalone starter at 321-337 masks lease claim, physical start
and notification installation. withCitationNativeStart at 298-305 masks its
record assignment and restores only the child body. Xml uses the repaired Markup
handoff. No physical kill-path change.

CitationNativeLaneTransfer.test.ts:54 interrupts the spawning fiber synchronously
at the return from a successful REAL OS spawn. All four HTML/Xml x Bun/Node child
cases pass under both parent runners. HTML checks the private job snapshot and
real death before the installed cleaner's longer Scope closes. Xml checks the
live invocation lane has started=confirmed=1 before its Scope closes. Both then
check observed spawned=confirmed=1 and admission active/queued/quarantined=0.
These tests cover successful spawn with pending cancellation, unlike the existing
before-spawn interruption proof.

## Cleaner logical ownership

NativeLane.ts:261-284 uses its existing one-permit Semaphore only for entry and
exit. At depth zero entry completes confirmed retirement and unit return, then
increments logical depth. Concurrent entrants wait for that transition; nested
entrants from any fiber increment depth. The opaque body runs outside the lock.
A masked ensuring finalizer decrements depth on every exit. Failed initial
retirement increments no depth, quarantines and never runs the body. The existing
start guard at 197 still rejects a start during any yield with invalid-runtime.

CitationCleanerPipeline.test.ts:275 proves a real host cleaner callback awaits
work.nested through fork/join and two sibling nested plans through Effect.all
concurrency 2. These callbacks need no process; they exercise the actual port and
pipeline, with valid reservation tickets. CitationNativeLane.test.ts:131 proves
with real children that a second entering fiber cannot run its cleaner body while
the initial retirement acknowledgement is withheld; admission remains active=1.
After acknowledgement both bodies enter with active=0; interrupting both restores
depth and the next start reacquires. The test finishes at started=confirmed=2,
unitsAcquired=2 and admission baseline. Existing unconfirmed-yield, quarantine,
pre-spawn interruption and real handover proofs still pass. The concurrency proof
now tests logical nesting without promising serialization of host cleaner bodies.
The prior decision's fiber-reentrant claim is corrected.

## Requested audit 3(a)-(d)

(a) Recursive public engine calls still need another OPERATION permit. The
closure in CitationEngine/CitationEngine.layer.ts:140-160 always invokes
openCitationInvocation, and Invocation.ts:82-97 always calls admission.run.
Yield changes only native capacity. Admission.ts is byte-for-byte unchanged from
0e2b4c42e6d. Its slots/queue path at 95-140 waits if no operation slot is free,
returns SafetyLimitExceeded(queuedOperations) if that queue is full, otherwise
queueDeadline or operationDeadline can expire (the outer invocation's stage
clock may win). With 1 operation the outer cleaner holds its operation permit;
a recursive call cannot progress until timeout/interruption unless the outer
returns. With spare slots it can enter. origin/main uses the same unconditional
public invocation route (layer.ts:134-150) and Admission.ts:95-136 path. This is
source-verified equivalence, not a newly run recursive-engine scenario.

(b) Base versus head timer placements (no limit values changed):

| Family | Base 0e2b | B1 head |
| --- | --- | --- |
| Regex | Real admission in preparation (RegexWorker.ts:112,119), under stage/operation timed but outside regexDeadline; spawn/RPC under regexDeadline:129-143; retirement outside regexDeadline inside outer timed | Preparation's lease is a no-op:126,136. Real lane claim/handover in start:147 is inside regexDeadline:146-160 and outer timed:164. Retirement remains outside the inner timer. **Different queue timer coverage; stop.** |
| Diff | Actual claim in preflight before payload copies, inside stage timed; spawn/RPC also inside timed; retirement outside stage timer inside operationTimed | Actual claim moves to start:207, after copies, still inside the same timed:210. Handover retirement also inside that timer; per-job retirement still outside it, inside operationTimed:211. Earlier preparation/admission precedence is not proved identical under external contention. |
| Xml | Markup claim after preparation, inside annotateDeadline; per-job retirement outside annotateDeadline, inside operationDeadline | Lane claim/handover in MarkupWorker.ts:135, inside the same annotateDeadline:159-162. Per-job retirement:168 outside it, inside operationDeadline:184-187. No per-job timer changed. |
| HTML | Markup claim after preparation, inside cleanDeadline; retirement outside it, inside operationDeadline | Named standalone starter claims at same point:135 inside cleanDeadline; retirement:168 unchanged. Cleaner yield retirement occurs before the port call (CleanerPipeline.ts:237), under enclosing cleaner/engine timers plus its own cleanupDeadline. Base had no yield retirement. Built-in cleaning precedes first lane use, so that transition retires nothing. |

All physical retirements still have NativeProcess.ts's cleanupDeadline, SIGKILL,
isRunning re-check, child Scope close and quarantine sequence. A second, active
occupant is retired in start before acquiring/spawning; normal per-job callers
already confirmed retirement, so ordinary handover has no live child to kill.

(c) The admission algorithm is unchanged (NativeAdmission.ts:155-195): total
ceiling concurrentOperations, regex subset concurrentRegexProcesses, queue-full
SafetyLimitExceeded { operation, limit: queuedOperations }, queued expiry
{ operation, limit: queueDeadline }, quarantined/closed AdmissionFailure mapped
by acquireCitationNativeLease:89-99 to the supplied worker reason. Regex previously
called acquireRegex; lane calls total acquire, justified for serial admitted
operations by policy v2. Worker adapters preserve RegexWorkerFailure,
DiffWorkerFailure and XmlWorkerFailure reason quarantined/closed, and Safety
operation normalization in RegexPolicy.ts:51-58 / XmlWorker.ts / MarkupWorker.ts.
HTML standalone keeps operation clean; BuiltinCleaners.ts:67-79 still maps native
worker failure to CleanerFailure { reason: runtime-failed } and preserves Safety.
The same constructors/mappers do NOT prove identical refusal selection: the regex
queue wait moved under regexDeadline, and regex/Diff admission moved after some
preparation. Therefore the requested blanket equivalence is not claimed. The
stop records a proposed explicit pre-timer lane reservation; no guard or deadline
was weakened to conceal this issue. This audit is source/reference reasoning;
no timed external-contention base-versus-head experiment was run.

(d) no-citation-optional-invocation.grit omitted CitationNativeLane. It now covers
both direct and namespace-qualified lane names for all 12 lookup forms (optional,
captured, curried, unsafe). Fixture invalidCount rises from 72 to 96: 24 new lane
cases. rules.test.ts passes all 32 tests; registry.test.ts passes 8. Existing
syntactic alias limitations are unchanged and remain documented in the rule.

## Counts

One fresh CitationCanonicalFullSpan file run passes 12/12. File wall time 57.22 s
(Vitest 56.85 s), launch load 37.51 / 25.35 / 21.73 (1/5/15 minute). Includes Node
parity and construction; no latency comparison with differently loaded cohorts.

| Count | Reviewed 03bac29 | Review fixes |
| --- | --- | --- |
| Ten plain-text calls: regex evaluations / children | 291 / 291 | 291 / 291 |
| Per-call metadata installs / detaches / tokenizer builds / evaluator installs | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Ten calls: physical lane owners / unit acquisitions | 10 / 10 | 10 / 10 |
| Construction: metadata / detach / tokenizer / evaluators | 16 / 1 / 1 / 26 | 16 / 1 / 1 / 26 |
| Construction: physical owners / children / lane claims | 1 / 0 / 0 | 1 / 0 / 0 |
| Node parity children / lane claims | 70 / 1 | 70 / 1 |

## Test receipts

Each file runs in its own nice process with a 285-second cap. Five-minute launch
load stays below 128. Parent Bun runs (all exit 0):

| File under server/test | Tests | Wall seconds | Launch load 1/5/15 |
| --- | --- | --- | --- |
| CitationNativeLane.test.ts | 12 | 2.25 | 12.96 / 12.84 / 17.99 |
| CitationNativeLaneTransfer.test.ts | 4 | 2.02 | 12.25 / 12.69 / 17.91 |
| CitationNativeLaneComposition.test.ts | 4 | 4.4 | 12.25 / 12.69 / 17.91 |
| CitationNativeLaneCleaner.test.ts | 2 | 16.63 | 13.59 / 12.97 / 17.97 |
| CitationCleanerPipeline.test.ts | 18 | 2.28 | 12.02 / 12.65 / 17.79 |
| CitationCleanerPipelineCoverage.test.ts | 6 | 2.09 | 12.10 / 12.66 / 17.77 |
| CitationBuiltinCleaners.test.ts | 2 | 2.99 | 12.10 / 12.66 / 17.77 |
| CitationHtmlWorker.test.ts | 11 | 3.61 | 11.93 / 12.62 / 17.72 |
| CitationHtmlWorkerCoverage.test.ts | 2 | 2.06 | 11.93 / 12.62 / 17.72 |
| CitationHtmlWorkerCorpus.test.ts | 3 | 50.6 | 11.46 / 12.51 / 17.66 |
| CitationHtmlWorkerProgram.test.ts | 5 | 2.16 | 24.87 / 15.86 / 18.52 |
| CitationHtmlWorkerProtocol.test.ts | 6 | 2.15 | 24.87 / 15.86 / 18.52 |
| CitationHtmlWorkerRpc.test.ts | 3 | 1.87 | 23.92 / 15.81 / 18.49 |
| CitationXmlWorker.test.ts | 3 | 5.87 | 23.92 / 15.81 / 18.49 |
| CitationDiffWorker.test.ts | 14 | 3.66 | 24.73 / 16.12 / 18.58 |
| CitationInvocation.test.ts | 4 | 2.76 | 25.55 / 16.43 / 18.67 |
| CitationEngineLayer.test.ts | 15 | 132.08 | 25.59 / 16.59 / 18.71 |
| CitationCanonicalFullSpan.test.ts | 12 | 57.22 | 37.51 / 25.35 / 21.73 |

Parent Node runs, each also exercising Bun and Node children where applicable:

| File | Tests | Wall seconds |
| --- | --- | --- |
| CitationNativeLane.test.ts | 12 | 7.37 |
| CitationNativeLaneTransfer.test.ts | 4 | 3.22 |
| CitationNativeLaneComposition.test.ts | 4 | 7.81 |
| CitationNativeLaneCleaner.test.ts | 2 | 23.81 |
| CitationCleanerPipeline.test.ts | 18 | 5.96 |

The strengthened retirement barrier test was rerun in both parent runners after
adding a second-entrant attempt latch; both pass 12/12. Other legacy worker files
use their established parent harness and explicitly exercise child runtimes where
that harness does so; no unsupported claim that every legacy file is Node-parent
compatible. Lint fixture suite passes 32/32 plus registry 8/8.

## Quality receipts

Both requested quick package verifications pass (source and test typecheck), as
does the additional touched @beep/lint-rules quick verification. Both law checks,
root Oxlint, docgen:local and Effect Vitest pass. The latter scans 3904 files,
introduced=0, resolved=1; no inventory churn remains. Fallow audit against
origin/main passes with zero introduced findings. Biome and whitespace pass.
The first server verification caught effectFnOpportunity in the new test spawner;
that introduced diagnostic was fixed with Effect.fn. Strengthening the barrier test
then caught missingReturnYieldStar at Effect.never; adding return yield* fixed it.
The final quick verification and both parent lane reruns pass.

No whole suite, whole-package coverage, hosted CI, push, PR or base update was
run, as instructed. The unresolved timer/refusal conflict is not disguised as a
passing proof. No pre-timer lane reservation contract expansion was implemented.
