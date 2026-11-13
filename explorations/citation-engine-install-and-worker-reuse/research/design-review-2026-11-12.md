# Design review, 2026-11-12

An independent reviewer (separate session, Opus 5.5) read revision 1 of
[`design-2026-11-12.md`](./design-2026-11-12.md) against the code and the
Effect 4.1.4 reference, with the brief to break it. Findings and how revision
2 answers each. `C/` is `packages/law-practice/server/src/internal/Citation/`.

| # | Severity | Finding | Evidence | Resolution in revision 2 |
| --- | --- | --- | --- | --- |
| 1 | BLOCKER | A regex lease held for the whole request starves the same request's Diff and Xml processes, which share the total ceiling. Under the 1 and 1 test policy the 32 canonical markup rows would wait on themselves; under 2 and 2, two overlapping markup requests wait on each other. | `C/NativeAdmission.ts:153-157`, `C/HtmlGeometryPreparation.ts:106-112`, `C/DiffWorker.ts:101-103` | The unit of account becomes a lane per invocation with one occupant at a time (section 3.2). |
| 2 | BLOCKER | The child's stdin, its stdout stream and both frame readers are single-use, so they cannot carry several jobs. | `C/NativeProcess.ts:96`, `C/NativeRpc.ts:128`, `C/ByteFrames.ts:66, 84-93`, `C/RegexWorkerProgram.ts:48-58` | v3 transport: `endOnDone: false` stdin, one session-owned stdout reader, a looping worker (section 2.4). The transport rewrite and the fake-worker fixture are in the worker goal's scope. |
| 3 | MAJOR | Hoisting silently disables text accounting at install-time budget lookups the design had not listed, because `Effect.serviceOption` adds no requirement. | `C/TextBudget.ts:57-59` and eleven sites | Sites listed; `captureCitationTextReservation` deleted; budget read from the invocation at call time; lint rule (section 3.1). |
| 4 | MAJOR | Stages that capture `CitationOperationAdmission` and call `run` would take a second permit once hoisted. | fourteen sites, for example `C/Tokenizer.ts:165, 277` | Nested `run` removed at each; tree installed without the admission in Context (section 3.1). |
| 5 | MAJOR | The session cannot be built on `withCitationNativeProcess`, and building it on the owner directly strands a lease claimed but never started. | `C/NativeProcess.ts:149-152, 190-193, 311-312` | Lane acquisition is uninterruptible with its finalizer registered before spawn; retirement on any non-success exit (sections 3.2, 3.3). |
| 6 | MAJOR | A nested per-job descriptor breaks the flat-JSON ceilings, and the exact preflight would not measure it. | `C/RegexWorkerProtocol.ts:80, 83-101, 159-164`, `C/RegexDescriptors.ts:35-45` | Bind before prepare; descriptor in the exact preflight; depth 3 and a names bound (section 2.4). |
| 7 | MAJOR | The four per-request report-limit snapshots are a bug fix and must stay; and `own` must detach through the JSON codec or caller byte buffers survive. | `C/SourceExtraction.ts:81`, `C/SourceCleaning.ts:93`, `C/SourceResolution.ts:128`, `C/AnnotationOperation.ts:31` | Both stated as rules; snapshots excluded from the detach count (section 2.1). |
| 8 | MINOR | A fixed RPC request id 0 races across a loop of jobs. | `C/NativeRpc.ts:121, 125, 184` | Request id is the sequence number (section 2.4). |
| 9 | MINOR | Test churn: 86 exact spawn-count assertions, about 100 release-assertion call sites, a manual clock that would fire both timers at once, five install-guard fixtures, 13 `EnclosingRefusal` sites. | `packages/law-practice/server/test/CitationNativeSpawner.fixtures.ts:294-308` and others | Budgeted per slice; sleep-counting clock (sections 4, 6). |
| 10 | MINOR | Results are now read before the worker dies; session failures need the invocation's operation label; one evaluator per call site and operation; four engine methods plus the extractor boundary, not two entries; the write belongs inside the job timer. | `C/Tokenizer.ts:151-152`, `CitationEngine.layer.ts:96-105` | Each folded into sections 3.1, 3.3, 3.5 and 4. |

Checked and found to hold: `Effect.timeoutOrElse` awaits the interrupted loser
and a retirement inside that interruption runs to completion; the lease is
released only on confirmed retirement; nested stage deadlines can be removed
without changing which deadline fires; operation labels survive install-once
while installs stay under the existing label providers; no engine code mutates
decoded configuration in place; `A & Brand` works on the repo's opaque class
schemas; no regex runs concurrently within a request; installed objects hold
no per-request mutable state except the Markup worker's private semaphores.
