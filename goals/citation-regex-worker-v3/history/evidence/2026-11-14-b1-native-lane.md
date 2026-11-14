# B1: invocation native lanes and cleaner-boundary yield

Status: in review as PR #3336, published by the owner. The initial receipts below
precede publication; current hosted repairs are recorded in Hosted round 1.
Branch: `feat/citation-native-lane`. Base: `0e2b4c42e6d` (A4).
No push by this implementation session, rebase, stash operation, whole-package
suite or coverage run.

`C/` below means `packages/law-practice/server/src/internal/Citation/`.
Policy v2 is recorded as breaking in the packet. This private workspace takes no
changeset; the temporary changeset was removed by owner commit `7f6718a75ec`
(see decision `2026-11-14-record-policy-v2-as-breaking-in-the-packet-the-private-workspace-takes-no-changeset.md`).
The implementation follows both owner rulings; neither historical stop remains.

## Count gate

The same `CitationCanonicalFullSpan` fixture asserts every row on every call.
Two complete file runs passed 12/12, including the ten-call Bun cohort, the Node
first-call parity leg and construction. Their file wall times were 61.72 s and
64.59 s. The latter run began at 23:23:03 local; load sampled immediately after
launch was 20.27 / 22.31 / 18.30 (1/5/15 minutes). The first run's launch load was
not sampled; the nearest recorded post-run observation was 12.88 / 12.07 / 13.96.
These wall times include the Node parity leg and are not ten-call cohort times.

A4's historical round-3 record reports a 36.5 s ten-call Bun cohort at starting
load 15.2 / 33.5 / 41.8 and ending load 10.1 / 28.9 / 39.7. That is retained
historical evidence, not a fresh baseline timing. The scopes and loads differ;
no latency improvement is claimed. Counts are the acceptance gate.

| Per ten plain-text Bun calls | A4 | B1, both replays |
| --- | --- | --- |
| Regex evaluations | 291 | 291 |
| Child processes | 291 | 291 |
| Metadata-operation installs | 0 | 0 |
| Configuration detaches | 0 | 0 |
| Tokenizer builds | 0 | 0 |
| Evaluator installs | 0 | 0 |
| Native physical owners | 10 regex owners | 10 lane owners |
| Successful lane unit acquisitions | no lane | 10 |
| Diff/Xml worker constructions | 0 | 0 |

| Construction count | A4 | B1, both replays |
| --- | --- | --- |
| Metadata-operation installs | 16 | 16 |
| Configuration detaches | 1 | 1 |
| Tokenizer builds | 1 | 1 |
| Evaluator installs | 26 | 26 |
| Child processes / regex evaluations | 0 / 0 | 0 / 0 |
| Native physical owners | 1 | 1 |
| Successful lane unit acquisitions | no lane | 0 |
| Diff/Xml worker constructions | 0 | 0 |

The new probe column counts successful unit claims, including reacquisitions
following yields. `nativeProcessOwners` still counts physical owner construction;
on plain-text calls its one owner is now the lane's. Per-job wrappers do not
count as physical owners. The construction owner is still the standalone HTML
cleaner's owner. The Node parity call retains 70 children and acquires one lane.

The direct markup annotation proof also uses the probe: each request starts
three children (regex placeholder, Diff, Xml), constructs one physical lane owner
and two preparation workers, and acquires one unit. Two concurrent requests
start six children, construct two physical owners, and acquire two lane units.
The observed maximum alive is respectively one and two. Before-markup owner
counts were not replayed, so no measured before-markup timing/count is claimed.

## Six lane rules and real-process proof

| Rule | Implementation | Proof |
| --- | --- | --- |
| Lazy unit, held to Scope close except cleaner yield | `C/Invocation.ts` constructs the lane in the request Scope; `C/NativeLane.ts` caches the physical owner lazily and claims a total unit only on start. | Empty lane uses zero; handover/yield test observes acquired true then false and lifetime units 1 then 2. |
| One live occupant | Serialized start calls confirmed retirement before the next OS spawn. | Real regex/Diff/Xml annotation has max-alive 1 under 1/1; handover of real children also has max-alive 1. |
| Release only after confirmation, otherwise quarantine | The unchanged NativeProcess retirement binding confirms death before notification/release; failed lane retirement is terminal. | Unconfirmed yield retains active=1 and quarantine=1, never calls the cleaner; acknowledgement returns capacity but both start and yield still refuse. |
| Uninterruptible ownership and pre-spawn finalizer | Lane Scope finalizer is installed before any claim; acquisition/start is masked, with unused-unit release on failed start. | Real blocker quarantines between acquire/start: snapshot returns to blocker baseline, then zero. Synchronous interruption between acquire/spawn observes interrupted Exit, no second spawn, and zero leaked capacity. |
| Bound and no inter-operation lane wait | Native admission total ceiling is concurrentOperations; one unit per admitted operation and policy-v2 cross-field check. | Actual markup requests complete under 1/1 and concurrently under 2/2, max alive 1 and 2, started equals confirmed. |
| Yield to the closed cleaner boundary | `CleanerPipeline` invokes the port through lane.yieldTo; HTML passes the named standalone starter explicitly. | Engine HTML clean, direct host invocation, and deliberately reversed regex-then-HTML each complete under 1/1. Actual admission calls observe max active=1 and four successful claims for the four real children. Concurrent and same-fiber nested yields serialize, including caller transactions. |

The reversed order is a direct-stage proof, not a built-in engine order. Normal
HTML cleaning precedes the first lane acquisition, so its yield acquires nothing
and adds no refusal or reordered work. Public cleaner contracts are unchanged.

All new proof files pass with both Bun and Node parent runners. Each file runs
both real Bun and Node child-runtime legs. Native liveness observations check the
actual OS process, not a fake spawner. For unconfirmed retirement, started and
confirmed intentionally differ during quarantine; after explicit late OS death
acknowledgement the proof observes equality and zero stranded capacity.

## Ownership and compatibility

- `regexOwner` retains the protocol-v2 adapter and spawner/Clock identity guard,
  not a physical owner or separate lease. Every regex evaluation still spawns
  and confirms one child. No v3 messages, loop or process reuse were introduced.
- Diff and Xml preparation remain per request. Diff accepts starter and text
  reservation explicitly. Neither Diff nor Markup looks up Invocation or native
  admission. Xml passes invocation.lane.start; HTML passes the named standalone.
- Markup private semaphores, queue/refusal checks and timers remain. Hoisting
  their mutable state is unnecessary for B1 and the closed HTML port still
  needs its queue. Exact confirmation notifications settle these slots even
  after a failed job's late acknowledgement or owner-Scope retirement.
- NativeProcess.ts is unchanged: parent SIGKILL, isRunning re-check, child Scope
  close, then confirmed release, or quarantine. Recognizer keeps its lease.
- `regexActive` remains the legacy regex-lease subset. Lanes reserve total active
  units; their occupant kinds and lifetime acquisitions are lane diagnostics.

## Verification receipts

Frozen install and prerequisite Turbo build passed earlier in this worktree
(57 successful build tasks). Both quick package verifications pass, including
source and test typechecks. Both package law checks pass (only existing advisory
terse-effect findings), root Oxlint passes, local docgen passes, and Fallow audit
against origin/main has zero introduced findings. The full Effect Vitest scan
passes after adding explicit resource-hook deadlines to the three new test
layers; generated inventory churn is restored with no new baseline exceptions.
Biome and whitespace checks pass. Final gate results are also in the checkpoint.

Each focused file ran in its own process under nice. The per-file cap was 285 s;
no load admission exceeded the five-minute load cap of 128. The longest focused
file was EngineLayer at about 125 s. Final results:

| File under server/test | Tests | Vitest file duration |
| --- | --- | --- |
| `CitationNativeProcess.test.ts` | 4 passed | 1.72 s |
| `CitationNativeProcessCoverage.test.ts` | 3 passed | 1.48 s |
| `CitationNativeAdmission.test.ts` | 13 passed | 1.57 s |
| `CitationNativeAdmissionCoverage.test.ts` | 2 passed | 1.54 s |
| `CitationAdmission.test.ts` | 7 passed | 1.52 s |
| `CitationNativeRpc.test.ts` | 6 passed | 0.355 s |
| `CitationRegexWorker.test.ts` | 18 passed | 3.39 s |
| `CitationRegexWorkerProtocol.test.ts` | 14 passed | 1.57 s |
| `CitationDiffWorker.test.ts` | 14 passed | 2.61 s |
| `CitationDiffWorker.input-admission.test.ts` | 1 passed | 1.64 s |
| `CitationDiffWorkerProtocol.test.ts` | 4 passed | 1.59 s |
| `CitationXmlWorker.test.ts` | 3 passed | 4.59 s |
| `CitationXmlWorkerProtocol.test.ts` | 2 passed | 1.69 s |
| `CitationHtmlWorker.test.ts` | 11 passed | 3.53 s |
| `CitationHtmlWorkerCoverage.test.ts` | 2 passed | 1.59 s |
| `CitationHtmlWorkerCorpus.test.ts` | 3 passed | 55.06 s |
| `CitationHtmlWorkerProgram.test.ts` | 5 passed | 1.61 s |
| `CitationHtmlWorkerProtocol.test.ts` | 6 passed | 1.79 s |
| `CitationHtmlWorkerRpc.test.ts` | 3 passed | 1.53 s |
| `CitationHtmlGeometryPreparation.test.ts` | 3 passed | 3.17 s |
| `CitationBuiltinCleaners.test.ts` | 2 passed | 2.68 s |
| `CitationAnnotationAssembly.test.ts` | 5 passed | 6.06 s |
| `CitationAnnotationCallback.test.ts` | 2 passed | 16.84 s |
| `CitationAnnotationCallbackBoundary.test.ts` | 2 passed | 1.83 s |
| `CitationAnnotationEntry.test.ts` | 5 passed | 5.18 s |
| `CitationAnnotationEntryCoverage.test.ts` | 2 passed | 2.73 s |
| `CitationAnnotationFailure.test.ts` | 2 passed | 2.06 s |
| `CitationAnnotationSkip.test.ts` | 1 passed | 9.97 s |
| `CitationAnnotationStyle.test.ts` | 2 passed | 2.63 s |
| `CitationAnnotationTemplate.test.ts` | 2 passed | 2.08 s |
| `CitationAnnotationWrap.test.ts` | 3 passed | 7.04 s |
| `CitationInvocation.test.ts` | 4 passed | 1.37 s |
| `CitationEngineLayer.test.ts` | 15 passed | 123.46 s |
| `CitationNativeLane.test.ts` | 10 passed | 2.69 s |
| `CitationNativeLaneComposition.test.ts` | 4 passed | 4.54 s |
| `CitationNativeLaneCleaner.test.ts` | 2 passed | 15.38 s |

Additional files/runners:

| File / runner | Result |
| --- | --- |
| `CitationCanonicalFullSpan.test.ts`, Bun parent | 12/12 twice, 61.72 s and 64.59 s |
| `CitationCleanerPipeline.test.ts`, Bun parent | 17/17, 7.18 s |
| `CitationBuiltinCleaners.test.ts`, post-yield-lock rerun | 2/2, 10.46 s |
| `integration/CitationHtmlUnicode.test.ts`, Bun parent | 1/1, 58.15 s |
| `integration/CitationDiffWorker.test.ts`, Bun parent | 2/2, 100.35 s |
| `CitationNativeLane.test.ts`, Node parent | 10/10; real Bun and Node children |
| `CitationNativeLaneComposition.test.ts`, Node parent | 4/4, 5.25 s; counted markup probe |
| `CitationNativeLaneCleaner.test.ts`, Node parent | 2/2, 24.89 s |
| `CitationEngineLimits.test.ts`, accepted schema commit | 7/7 on Bun and Node; unchanged in this continuation |

Initial failures were attributed and fixed, not hidden: a legacy 2/1 corpus
policy became coherent 2/2; direct annotation fixtures now open invocations with
the installation's actual spawner/admission; release assertions run after the
invocation closes rather than while its unit is intentionally held. Exact child
counts are retained. Late acknowledgement tests exposed private-slot settlement,
which is now driven by the exact confirmed-retirement notification. Fallow
findings were fixed by sharing lease translation, a local record-removal helper,
and separating the native unit claim from process start. No suppression was added.

Not run: the whole law-practice suite, whole-package coverage/full package-verify,
the five large serial replays, hosted CI, or remote-worker timing. The brief
requires bounded file-level checks and quick package verification on this shared
host. B2/B3 and publication remain with the owner; no production/hosted acceptance
is implied by these local proofs.

## Hosted round 1

PR #3336 at `7f6718a75ec` exposed missed fixture and runtime-identity paths.
The fixes keep every expected child count and refusal assertion.

- HTML bytes: its two-operation policy retained only one regex slot. Set both
  ceilings to two, satisfying policy v2 without changing production limits.
- Tokenizer larger-budget invocation: the caller opened its invocation outside
  the fixture spawner/Clock. Supply both. The fixture operation admission also
  captured the old Clock before the manual Clock existed; create admission under
  the same manual Clock used by the stage and lane.
- Full-law metadata, including the 768-row integration replay: the raw stage
  reused an enclosing generic invocation instead of opening one with its observed
  spawner and fixed calendar Clock. Bind apply through the existing explicit test
  adapter. Create metadata operation admission after the fixed calendar Clock,
  so it cannot replace that Clock with the pre-calendar Clock inside its body.
- Shared text budget: install the observed runtime before opening the explicit
  24-unit invocation and provide its Context to that invocation. All budget and
  1/1 exit assertions remain. Check capacity return after invocation Scope closes,
  because the lane retains its unit during the request.
- HTML case-name lifetime: source attempted the removed worker path and returned
  spawn-failed after installation Scope closure. Retain an explicit installation
  closed flag and return the base closed refusal before runtime comparison.
- Review A: compare every evaluator (including the first) with the lane captured
  spawner/Clock using matchesRuntime. Cache only the adapter; remove dead provides
  around Effect.succeed and stale comments. Extend the zero-spawn mismatch proof
  to first/later evaluators and a differing Clock.
- Review B: move inline import types into top-level type imports.

Focused reruns: HTML bytes 2/2; tokenizer 11/11; full-law unit 2/2; text budget
6/6; HTML case-name 3/3; regex worker 18/18. The requested integration file passes
1/1 (all 768 observations and its original 936/936 process receipt) in 133.29 s
under the package integration project. No other integration cohort is launched.

The service search found 67 provider files. The unit audit follows provider
fixtures to consumers, excludes platform-layer-only imports, and runs each file
in a separate nice-19 process with a 285-second cap. CanonicalFullSpan is reserved
for the final run after checks. Final per-file results are appended below.
