# B1 owner ruling 3: reservation preserves base admission timing

Status: locally verified, in review. Owner ruling 3 resolves the admission timer
stop. Branch `feat/citation-native-lane`; preceding review-fix commit `d4bdd335cb0`;
binding comparison base `0e2b4c42e6d`. No push, PR, rebase, subagent or stash use.

`C/` denotes `packages/law-practice/server/src/internal/Citation/`. References to
base files are line numbers in `git show 0e2b4c42e6d:<path>`; head references are
the source in this reservation commit. No public engine or cleaner contract,
limit value, protocol version, kill guard or quarantine policy changes.

## Reservation and ownership

C/NativeLane.ts:89 adds the Context.Service contract before implementation.
reserve at 200 shares availableOwner (192-198) with start. It serializes with
start/yield using the same one-permit Semaphore, masks the ownership transfer,
claims through the existing shared admission, starts no child, and refuses
closed/quarantined/yielding states just as start does. The request finalizer
remains registered before acquisition (165-173). The acquire function counts
successful claims, including reacquisition after yield, at 175-181. Existing
capacity is reused, so reserve followed by start is one nativeLaneUnits claim.

Regex and Diff now execute REAL reserve through their old preparation acquisition
callbacks. The shared citationNativeJobReservation adapter (NativeLane.ts:311)
only maps closed boundary errors and supplies the job supervisor's bookkeeping
ticket. Its non-releasing hooks neither acquire another lease nor release the
lane's capacity: request Scope or yield owns the real unit. There is no longer a
no-op preparation acquisition. Diff takes the reservation effect explicitly,
alongside the explicit starter; neither Diff nor Markup reads request authority.
Xml's reservation runs after its RPC preparation completes, inside the Markup
stage timer, immediately before the existing masked start/record transfer.
Standalone HTML keeps its named standalone starter and its own per-process claim.

Effect APIs were checked against the reference checkout, including
Semaphore.ts:374-390 (withPermit restores the caller's status and releases on
exit) and Effect.ts:7699,7735 (uninterruptible/mask). The outer job supervisor
continues to mask acquire/record transfer, and native queue waits retain their
existing explicit interruptibility; no deadline or cancellation guard is removed.

## Base versus head

| Kind | Base acquisition point | Head acquisition point | Enclosing timers, base = head | Refusal, base = head |
| --- | --- | --- | --- | --- |
| Regex | C/RegexWorker.ts:112 supplies the real lease; preparation invokes operation.acquire at 119, before the native timer at 129-143 | C/RegexWorker.ts:131 supplies lane.reserve; the same preparation callback invokes operation.acquire at 143, before the native timer at 155-169 | Admission/preparation under outer timed (base 147; head 174), with native admission's queueDeadline; regexDeadline covers spawn/startup/RPC, not admission | Safety { operation: extract, limit: queuedOperations or queueDeadline }; CitationRegexWorkerFailure { reason: quarantined }. After reservation the native timer returns Safety { operation: extract, limit: regexDeadline } |
| Diff | C/DiffWorker.ts:131 acquires after source/text/frame preflight and text reservation, before payload copy | C/DiffWorker.ts:182 acquires at the same preflight point; its explicit reserve effect is installed at 152 | Admission, preparation, spawn and RPC under timed (base 161; head 212); full wrapper/retirement under operationTimed (base 162; head 213); native queue has queueDeadline | Safety { operation: extract, limit: queuedOperations or queueDeadline }; CitationDiffWorkerFailure { reason: quarantined }. Stage expiry remains Safety { operation: extract, limit: extractDeadline } for the tested stage-shorter-than-operation policy |
| Xml | C/MarkupWorker.ts:115 finishes prepare; native claim at 116, before start at 128 | C/XmlWorker.ts:83-89 reserves after completed RPC preparation; C/MarkupWorker.ts:134 receives the prepared call, then starts at 135 | Both preparation/admission/start/RPC under annotateDeadline (base MarkupWorker:147-150; head 159-162); retirement outside that stage timer, inside operationDeadline | Safety { operation: annotate, limit: queuedOperations or queueDeadline }; CitationXmlWorkerFailure { reason: quarantined }. Stage expiry remains Safety { operation: annotate, limit: annotateDeadline } |
| HTML clean | C/MarkupWorker.ts:116 claims after prepare, inside cleanDeadline | C/MarkupWorker.ts:135 calls the unchanged standalone starter; its real claim is C/NativeLane.ts:355, after prepare | Same cleanDeadline wrapper (base MarkupWorker:147-150; head 159-162); retirement outside it, inside operationDeadline | Safety { operation: clean, limit: queuedOperations or queueDeadline }; CitationHtmlWorkerFailure { reason: quarantined }. Stage expiry remains Safety { operation: clean, limit: cleanDeadline }. BuiltinCleaners.ts:67-79 still preserves Safety and translates native worker failure to CleanerFailure { reason: runtime-failed } |

The native admission algorithm is unchanged: base NativeAdmission.ts:175-190 and
head 181-196 select the queue-full and queued-expiry refusals. The total ceiling
remains concurrentOperations; policy v2 keeps the regex ceiling at least that
large. Regex/Diff operation tags above are the existing default extraction stage;
RegexPolicy.ts:50-58 still normalizes Safety to the installed operation. The
quarantine mapping preserves each worker's existing closed failure schema.

The table is source-verified on both sides. Head behavior is additionally proved
with real processes below. No separate checkout executing the entire base test
matrix was installed; these are not claimed to be two executable A/B runs.

Handover retirement remains under the job/stage timer in NativeLane.ts:206.
The call can occur on a built-in v2 path because the lane retains its previous
record, but that record is already confirmed: NativeProcess.ts:172-175 retires
regex/Diff before publication; MarkupWorker.ts:166-181 retires Xml before return.
NativeProcess.ts:234-239 reuses the successful retirement task. Thus there is no
additional live-child retirement/wait on serial built-in v2 handover. Direct
lane clients can start while an occupant is live; the existing real-process
handover proof covers this required guard. Unconfirmed retirement fails and
poisons the lane, never becoming a built-in retry or replacement-spawn path.

## Real-process proofs

CitationNativeLaneReservation.test.ts runs 32 cases per parent: 4 kinds x 2 real
child runtimes x 4 paths. Both Bun-parent and Node-parent runs pass 32/32.
The blocker is a real child with its actual shared lease; no fake spawner or
self-supplied reply/count is used. Only the deadline acknowledgement/Clock is
controlled, while spawn, kill, isRunning checks and confirmed retirement are real.

| Path | Observed assertion |
| --- | --- |
| Queue full | A real child holds the sole unit, and another admission waiter fills the queue. The job returns Safety with exact operation and queuedOperations; no job child spawns. Interrupting the waiter and confirming blocker retirement return admission to baseline. |
| Queue expiry | A real child holds the sole unit. The test waits until the actual admission snapshot reports queued=1, then releases its manual queue timer. Each kind returns exact operation + queueDeadline. For regex the separate native timer has not even started while queued and remains unstarted after refusal; the old placement would fail that assertion. |
| Quarantine before reservation | The real blocker's lease is quarantined before invoking the job. Each worker returns its exact quarantined failure. Observed total remains one blocker spawn and zero job spawns; confirming blocker retirement leaves spawned=confirmed=1 and active/queued/quarantined=0. |
| Reservation then job deadline | The actual spawner pauses after a successful OS spawn. The captured job timer is triggered, then spawn return is allowed. The exact native/stage limit is returned and the real child is killed with confirmation. Inside the invocation, each in-lane kind has started=confirmed=1, unitsAcquired=1 and acquired=true; HTML has no lane claim and has returned its standalone unit. After request Scope closure every admission count is baseline. |

The stage deadline cases use a direct-stage invocation and suppress only its
matching enclosing invocation timer, to distinguish the worker's captured stage
timer from an outer timer of the same duration. Production timer placement is
unchanged. Regex uses 101 ms, queue 211 ms, clean 401 ms, extract 503 ms, annotate
607 ms, operation 5 s, cleanup 1 s; queue deadlines are released manually. This
proves queue selection for the stated policy, without claiming a queue deadline
always beats a shorter enclosing stage/operation deadline on arbitrary policies.

CitationNativeLane.test.ts now passes 14/14 under each parent. Added assertions
prove repeated reserve starts no child and counts one claim, reserve refuses
during yield, and request Scope closure returns an unused real admission unit.
All prior real handover, interruption, quarantine, cleaner yield-depth, 1/1 and
2/2 composition and HTML/direct-host proofs remain green.

## Counts

The final CitationCanonicalFullSpan replay passes 12/12: 58.86 s file wall time
(Vitest 58.50 s), launch load 24.72 / 19.30 / 18.52 (1/5/15 minute). An earlier
pre-consolidation replay also passed 12/12 in 58.62 s; the final replay is the
receipt for the final adapter form. These file times include construction and
Node parity; no latency comparison with differently loaded cohorts is claimed.

| Count | Before reservation (d4bdd335cb0) | After reservation |
| --- | --- | --- |
| Ten plain-text Bun calls: regex evaluations / children | 291 / 291 | 291 / 291 |
| Per-call metadata installs / detaches / tokenizer builds / evaluator installs | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Ten calls: physical lane owners / successful lane unit claims | 10 / 10 | 10 / 10 |
| Construction: metadata / detach / tokenizer / evaluator installs | 16 / 1 / 1 / 26 | 16 / 1 / 1 / 26 |
| Construction: physical owners / children / lane claims | 1 / 0 / 0 | 1 / 0 / 0 |
| Node parity call: children / lane claims | 70 / 1 | 70 / 1 |

No fixture rows or asserted counts were changed. nativeLaneUnits remains the
cumulative number of actual successful shared claims, including reacquisition
following yield, rather than number of reserve/start calls.

## File-by-file results

Each file ran in its own nice process, with a 285-second cap and five-minute
launch load below 128. The table uses the final rerun for affected files and the
requested focused run for unchanged files. All exit 0.

| Bun-parent file under server/test | Tests passed | Wall seconds | Launch load 1/5/15 |
| --- | --- | --- | --- |
| CitationNativeLane.test.ts | 14 | 4.54 | 26.05 / 17.63 / 18.02 |
| CitationNativeLaneReservation.test.ts | 32 | 4.06 | 26.29 / 17.82 / 18.08 |
| CitationNativeLaneTransfer.test.ts | 4 | 2.32 | 26.29 / 17.82 / 18.08 |
| CitationNativeLaneComposition.test.ts | 4 | 4.12 | 25.22 / 17.74 / 18.05 |
| CitationNativeLaneCleaner.test.ts | 2 | 15.11 | 24.16 / 17.65 / 18.02 |
| CitationRegexWorker.test.ts | 18 | 3.82 | 21.33 / 17.34 / 17.91 |
| CitationDiffWorker.test.ts | 14 | 2.93 | 21.33 / 17.34 / 17.91 |
| CitationDiffWorker.input-admission.test.ts | 1 | 1.97 | 21.86 / 17.51 / 17.97 |
| CitationXmlWorker.test.ts | 3 | 5.17 | 21.86 / 17.51 / 17.97 |
| CitationHtmlWorker.test.ts | 11 | 8.05 | 21.52 / 23.11 / 19.69 |
| CitationNativeAdmission.test.ts | 13 | 3.62 | 26.68 / 24.15 / 20.04 |
| CitationNativeAdmissionCoverage.test.ts | 2 | 2.35 | 27.83 / 24.43 / 20.16 |
| CitationAdmission.test.ts | 7 | 2.08 | 27.83 / 24.43 / 20.16 |
| CitationInvocation.test.ts | 4 | 2.19 | 27.60 / 24.44 / 20.18 |
| CitationCleanerPipeline.test.ts | 18 | 3.13 | 27.60 / 24.44 / 20.18 |
| CitationHtmlGeometryPreparation.test.ts | 3 | 3.66 | 20.91 / 17.39 / 17.92 |
| CitationEngineLayer.test.ts | 15 | 113.89 | 20.52 / 17.37 / 17.91 |
| CitationCanonicalFullSpan.test.ts | 12 | 58.86 | 24.72 / 19.30 / 18.52 |

| Node-parent file (also tests real Bun and Node children) | Tests passed | Wall seconds |
| --- | --- | --- |
| CitationNativeLane.test.ts | 14 | 5.65 |
| CitationNativeLaneReservation.test.ts | 32 | 5.75 |
| CitationNativeLaneTransfer.test.ts | 4 | 2.99 |
| CitationNativeLaneComposition.test.ts | 4 | 5.22 |
| CitationNativeLaneCleaner.test.ts | 2 | 15.87 |

Legacy worker files use their established parent harness and exercise both child
runtimes where that harness provides them. No unsupported claim that every legacy
file is Node-parent compatible is made. The Diff input-admission and HTML geometry
files were included because their fixture/signature depends on the changed code.

## Quality and proof limits

Both quick package verifications pass, including source and test typechecks.
Both requested lint:laws pass with only pre-existing advisory terse-effect rows.
Root lint:oxlint, Biome, docgen:local and whitespace checks pass. Effect Vitest
scans 3905 files, introduced=0, resolved=1, with no tracked inventory churn.
Fallow audit against origin/main passes: 0 introduced, 39 inherited-adjacent.

During implementation the first checks caught a request-service requirement in
the supervisor's R=never acquisition parameter; binding the invocation outside
that supervisor fixed it. Test setup was changed to return an explicit run field
and unify the error union rather than returning nested Effect values. Fallow
caught duplicated guards/adapter code and the long proof function; shared guards,
a pipeable reservation adapter and separate fixture/proof functions resolved
those findings without suppressions. The final typecheck also confirms the
adapter's pipeable signature and all fixture imports. Initial stage-timer proof
failures came from the enclosing timer racing the private stage; the documented
direct-stage Clock isolation makes that proof precise without changing production.

All runs completed before handoff. No whole-suite run, whole-package coverage,
hosted CI, remote push/PR, rebase or base update was performed, as instructed.
The prior stop is resolved by the owner ruling; no new stop remains.
