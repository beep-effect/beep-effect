# B2 transport implemented; stopped on mixed-engine protocol conflict

Branch `feat/citation-regex-session`. B2 is blocked and is not in review.

## Stop status

The original depth stop is **resolved** by owner ruling `3195ce21182`,
[the depth-4 decision](../../decisions/2026-11-14-set-the-v3-job-frame-depth-ceiling-to-4-the-exact-nesting-of-the-designed-shape.md).
The v3 decoder now uses depth 4 under the unchanged root-inclusive shared guard.
V2 retains depth 1. The required names-object acceptance and depth-5 refusal
regressions are present and pass.

A second conflict stops B2:
[the mixed-engine decision](../../decisions/2026-11-14-stop-b2-at-startup-only-engine-selection-for-mixed-dialect-invocations.md).
One invocation uses python-re and python-regex-v0 evaluators, but design 2.4
places engine only in process startup. The required per-job descriptor does not
carry engine. Reusing the first engine changes behavior; restarting on a dialect
switch abandons the plain-text process target. No workaround was implemented.

The transport implementation is retained in local commit `3b9ddb4ded6`.
A subsequent local correction makes a call observing a poisoned idle session
await the exact retirement before returning its closed failure; the idle proof
checks that boundary. The target ten-call assertion table is prepared, but has
not passed the count gate. No success checkpoint was written.

## What is implemented

- V3 schema-backed startup, jobs and Ready/Started/Failure/Complete replies.
  Every job has its parent-bound descriptor and sequence; complete results
  retain the existing result envelope plus sequence.
- Binding before preparation; exact full-frame size preflight includes the
  descriptor and sequence. Names are bounded against processMessageBytes before
  header encoding. The finite property ceiling includes the flat job,
  descriptor, profile and maximum capture-name properties. Strict Schema
  decoding follows structural preflight.
- One lazy invocation-owned session, using the lane's captured spawner and
  Clock, with a runtime identity guard. A one-permit semaphore serializes jobs.
- One stdout reader in the physical process Scope and a capacity-one reply
  queue. A separate invocation-scoped supervisor retires a failed idle reader;
  it is outside the process Scope to avoid waiting on its own Scope closure.
- Separate startup and job timers, both regexDeadline. The RPC registration,
  frame write, Started and terminal delivery are inside the job timer.
  RPC request ids equal job sequence numbers.
- Persistent stdin uses endOnDone: false. The worker reads and serves LF frames
  in a loop. Each job re-derives its program against its own descriptor.
- Timer expiry, protocol failure and interruption poison the session and await
  the existing parent-owned retirement path before the job returns. Later jobs
  fail closed without spawning. Retirement still uses SIGKILL, isRunning and
  physical Scope closure, with quarantine on unconfirmed death.
- Intentional idle lane retirement marks the session absent and resets the
  per-process sequence. A pre-retirement callback distinguishes lane handover
  from unsolicited EOF. The lane also exposes the physical process Scope for
  its reader. Diff and Xml still use the same retirement path.
- V2 schemas, program, RPC and tests remain. V2 and v3 share option decoding,
  native layout preparation and exact framing rather than duplicate them.
- The manual Clock records each matching sleep and can trigger a selected
  sleep. The catastrophic proof expires sleep 1, the job timer, while startup
  was sleep 0.

## Counts and wall time

These baseline counts are the B1 assertions and B1 reservation receipt, not a
new B2 measurement. Only the native-process column of the ten-call assertion
table was changed; every other asserted column remains identical.

| Count per ten plain-text Bun calls | B1 baseline | B2 assertion target | B2 measured |
| --- | --- | --- | --- |
| Regex child processes | 291 | 10 | Not run; blocked |
| Regex evaluations | 291 | 291 | Not run |
| Metadata-operation installs | 0 | 0 | Not run |
| Configuration detaches | 0 | 0 | Not run |
| Tokenizer builds | 0 | 0 | Not run |
| Regex evaluator constructions | 0 | 0 | Not run |
| Regex descriptor bindings | 4 | 4 | Not run |
| Physical native owners | 10 | 10 | Not run |
| Native lane acquisitions | 10 | 10 | Not run |
| Diff/Xml worker constructions | 0 | 0 | Not run |

| Engine construction count | B1 baseline / unchanged B2 assertion |
| --- | --- |
| Metadata-operation installs | 16 |
| Configuration detaches | 1 |
| Tokenizer builds | 1 |
| Regex evaluator constructions | 26 |
| Regex evaluations / children / descriptor bindings | 0 / 0 / 0 |
| Physical native owners | 1 |
| Native lane acquisitions / Diff/Xml constructions | 0 / 0 |

The B1 reservation receipt reports full-span file wall time 58.86 seconds,
including construction and Node parity, at load 24.72 / 19.30 / 18.52.
No new count-cohort wall time or latency improvement is claimed.

A homogeneous-engine reuse test runs two jobs in one real worker, observes
spawned=1/confirmed=0 while idle, hands the lane to another process, then runs
another regex job. Scope closure yields spawned=confirmed=3 and
lane started=confirmed=3. Both Bun and Node child cases pass. This demonstrates
transport reuse; it does not satisfy the mixed-engine count fixture.

## Eight real-process proofs

All are in `test/CitationRegexSession.test.ts`. Each name is instantiated with
both bun and node. Every failure path asserts independent observed
spawned=confirmed=1 and lane started=confirmed=1 before handing back.

| Obligation | Test name with runtime placeholder | Bun | Node |
| --- | --- | --- | --- |
| Catastrophic regex, responsive parent, deadline, death before return | expires only the {runtime} job timer during a catastrophic regex and confirms death before return | Pass | Pass |
| Job after a killed job has no spawn | fails closed without a {runtime} respawn after a killed job | Pass | Pass |
| Wrong sequence | kills and confirms {runtime} on wrong-sequence | Pass | Pass |
| Early EOF | kills and confirms {runtime} on eof | Pass | Pass |
| Oversize frame | kills and confirms {runtime} on oversize | Pass | Pass |
| Idle frame | kills and confirms {runtime} on a frame while idle | Pass | Pass |
| Sent interruption | confirms {runtime} death before acknowledging interruption during sent | Pass | Pass |
| Running interruption | confirms {runtime} death before acknowledging interruption during running | Pass | Pass |

The hostile children are real OS processes, never fake spawners.
`CitationRegexSession.child.mjs` enters a synchronous catastrophic native regex
after writing an entered marker. A separate parent fiber still runs before the
test triggers the captured job timer. The normal reuse test launches the actual
bundled production worker. Hostile children intentionally bypass the compiler to
exercise transport/containment; this supplies no new pattern-family approval.

The EOF child exits early. This proves EOF poisons the session and the exact
already-exited child is confirmed before return; it does not independently
demonstrate SIGKILL of a still-running child with closed stdout. Closing Bun's
stdout with end/close did not reliably produce EOF while leaving it alive, so
that stronger variant is not claimed. The other kill/interruption paths exercise
the parent-owned retirement of live children.

The first proof run passed 16/18; it exposed that Bun stdout end did not produce
the intended EOF, and that the Node entered marker could precede parent
consumption of Started. The fixture now exits for EOF and explicitly waits for
the parent Running state. The final file passes 18/18 in 2.60 seconds.

## Focused final file receipts

Each ran alone from the server package with nice -n 19 bunx vitest run.

| File | Final result | Vitest file duration |
| --- | --- | --- |
| CitationRegexSession.test.ts | 18/18 pass | 2.60 s |
| CitationRegexSessionProtocol.test.ts | 4/4 pass | 1.93 s |
| CitationRegexWorkerProtocol.test.ts | 14/14 pass | 1.89 s |
| CitationRegexWorker.test.ts | 19/19 pass | 3.67 s |

The protocol file covers names at depth 4, depth 5 refusal before the shared
decoder reaches payload decoding, exact descriptor/sequence byte accounting,
effective name-length/frame refusal before source reservation, and strict
unknown-property refusal. Earlier protocol runs also passed 4/4 (2.08 and
2.81 seconds); the final receipts above supersede them.

## Serial batch receipts

The batch selected Citation tests importing changed modules or their fixture
dependencies, and launched exactly one file at a time. It was stopped after the
current file finished when the mixed-engine conflict was established. It ran 27
files: 17 passed and 10 failed. The following wall seconds include process
launch; no parallel test-file batch or coverage command was run.

| File under server | Result | Test counts | Wall seconds |
| --- | --- | --- | --- |
| test/CitationAnnotationAssembly.test.ts | Fail | 1 failed / 4 passed (5) | 6 |
| test/CitationAnnotationCallback.test.ts | Pass | 2 passed (2) | 18 |
| test/CitationAnnotationCallbackBoundary.test.ts | Pass | 2 passed (2) | 3 |
| test/CitationAnnotationEntry.test.ts | Pass | 5 passed (5) | 6 |
| test/CitationAnnotationEntryCoverage.test.ts | Pass | 2 passed (2) | 3 |
| test/CitationAnnotationFailure.test.ts | Pass | 2 passed (2) | 3 |
| test/CitationAnnotationSkip.test.ts | Pass | 1 passed (1) | 11 |
| test/CitationAnnotationStyle.test.ts | Pass | 2 passed (2) | 3 |
| test/CitationAnnotationTemplate.test.ts | Pass | 2 passed (2) | 3 |
| test/CitationAnnotationWrap.test.ts | Fail | 1 failed / 2 passed (3) | 8 |
| test/CitationBuiltinCleaners.test.ts | Pass | 2 passed (2) | 5 |
| test/CitationBuiltinDiff.test.ts | Pass | 6 passed (6) | 35 |
| test/CitationCallbackRuntimeIndex.test.ts | Pass | 5 passed (5) | 3 |
| test/CitationCallbackSession.test.ts | Pass | 16 passed (16) | 3 |
| test/CitationCanonicalAnnotation.test.ts | Pass | 2 passed (2) | 56 |
| test/CitationCanonicalAnnotationWorkflow.test.ts | Fail | 1 failed (1) | 19 |
| test/CitationCanonicalCourts.test.ts | Fail | 1 failed (1) | 10 |
| test/CitationCanonicalDefaultFactory.test.ts | Pass | 2 passed (2) | 4 |
| test/CitationCanonicalDump.test.ts | Fail | 2 failed (2) | 20 |
| test/CitationCanonicalEditionYears.test.ts | Pass | 1 passed (1) | 3 |
| test/CitationCanonicalExtraction.test.ts | Fail | 5 failed / 2 passed (7) | 52 |
| test/CitationCanonicalExtractionRanges.test.ts | Pass | 6 passed (6) | 3 |
| test/CitationCanonicalFullRendering.test.ts | Fail | 2 failed (2) | 18 |
| test/CitationCanonicalLongDiff.test.ts | Pass | 2 passed (2) | 29 |
| test/CitationCanonicalMissingConversion.test.ts | Fail | 2 failed (2) | 16 |
| test/CitationCanonicalPageCorrection.test.ts | Fail | 2 failed (2) | 17 |
| test/CitationCanonicalParsedEquality.test.ts | Fail | 2 failed (2) | 16 |

The failures are attributed separately:

- CitationAnnotationAssembly refuses a mismatched runtime identity through the
  tightened lane Clock/spawner guard. This is the same fixture-authority class
  described in the owner's B1 note, found in an additional test. It was not
  repaired here; it is not evidence against the session kill path.
- CitationAnnotationWrap still expects 24 retired per-evaluation children and
  observes one retired invocation child. This is B2's required test churn,
  incomplete because the protocol conflict stopped the slice.
- The eight failing canonical replay files expose the B2 mixed-engine problem.
  CitationCanonicalDump gives the closed underlying unsupported-syntax failure
  on both child runtimes; several public replay boundaries map it to
  CitationInputError. These failures are not attributed to B1.

The owner's separately named B1 areas (CitationHtmlBytes, CitationTokenizer,
CitationFullLawMetadata unit/integration, CitationTextBudget, CitationHtmlCaseName)
were left untouched. No B1 branch merge or rebase was attempted.

## Quality receipts

| Command | Result |
| --- | --- |
| Server bun run check | Pass, source declarations and test typecheck; repeated at the final source state |
| bun run beep quality package-verify @beep/law-practice-server --quick | Final pass: lint 0.6 s, check 2.2 s |
| Server bun run lint:laws | Pass; 3 pre-existing terse-effect advisory rows |
| bunx fallow audit --config .fallowrc.jsonc --base origin/feat/citation-native-lane | Pass: 0 introduced issues, dead code 0, complexity 0, duplication 0; final audit 25 changed files, 10.28 s |
| bun run docgen:local | Pass: 5 package tasks, 26.037 s |
| bun run beep lint effect-vitest | Pass: 3929 files, introduced=0, resolved=0 |
| bun run beep lint schema-first | Pass; no hand acceptance of inventory growth |
| Root lint:oxlint on the touched source/test files | Pass |
| Biome on touched source/tests and the mjs child | Pass |
| git diff --check | Pass |
| goals decisions write --slug citation-regex-worker-v3 | Generated the decision projection; final run recorded at commit |

The first direct check encountered missing dependency declarations (TS6305).
Quick package verification built the 57 dependency tasks and subsequent direct
checks passed. Initial implementation checks caught type/style errors and
Fallow caught clones plus one reader complexity finding; these were repaired
by shared schema/preparation helpers and schema-derived reply matching. No
quality suppression, safety relaxation or source-family expansion was used.
Commit hooks regenerated the two package instrumentation catalogs.

## Not run, incomplete proof and behavior changes

The remaining selected Citation files were not run after the stop, nor was
CitationCanonicalFullSpan.test.ts. The full-span table is a prepared target,
not measured acceptance. The complete selected list and local file logs remain
under the checkout's ignored .beep directory; the durable receipts for every
file actually run are above. No whole law-practice suite, coverage, hosted CI,
remote timing, publication or new PR was run.

There is no B2 success checkpoint or in-review claim. PLAN marks B2 blocked.
The goal remains active. Existing B1 fixes must still arrive from their owner;
this lane did not merge or rebase its base.

Intended behavior implemented and separately qualified: successful jobs consume
a complete validated reply while their child remains idle, jobs within an
invocation share a process, startup and matching have separate timers, and
expected lane handover permits a new session process. A poisoned session never
respawns. Contextual result-decoding failures also poison and retire a process
after a dispatched job, while preflight refusals before dispatch do not kill an
otherwise idle session.

Interpretations recorded for review: session evaluation accepts a trusted
preparation callback so it can assign a per-process sequence under the semaphore
before exact preflight; the lane exposes its captured Clock/spawner and physical
Scope and accepts a pre-retirement callback for expected handover. The shared
frame reader has a continuous mode; exact-count v2 readers keep their count and
EOF validation. The session reader's retirement supervisor uses the invocation
Scope to avoid joining itself during physical Scope closure.

The startup-only engine selection cannot preserve mixed-dialect behavior.
It is an unresolved contract conflict, not a permitted behavior change.
No engine inference, silent dialect unification or engine-switch respawn was
added. The recommended amendment is explicit per-job engine authority with
exact frame/property accounting and a new mixed-engine one-process regression.

All test processes were allowed to finish before handoff.
