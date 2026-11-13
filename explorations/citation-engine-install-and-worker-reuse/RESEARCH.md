# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

Dated 2026-11-12. Path prefixes used below: `C/` is
`packages/law-practice/server/src/internal/Citation/`, `L` is
`packages/law-practice/server/src/CitationEngine/CitationEngine.layer.ts`, `T/`
is `packages/law-practice/server/test/`, `G/` is
`goals/citation-extraction-engine/`. Effect citations are against the Effect
4.1.4 reference checkout (commit `9ef5cd04d2ec`); `E/` is the `src` directory
of that repository's `effect` package.

## External Landscape

### Only an OS process kill bounds a regex in Bun

- JavaScriptCore's YARR engine has a `matchLimit` of 100,000,000 steps
  ([Yarr.h](https://github.com/WebKit/WebKit/blob/b09e16e321736528fc10d31a8a1065e71d05c56d/Source/JavaScriptCore/yarr/Yarr.h#L49-L51)).
  Hitting it returns `ErrorNoMatch`
  ([YarrJIT.cpp](https://github.com/WebKit/WebKit/blob/b09e16e321736528fc10d31a8a1065e71d05c56d/Source/JavaScriptCore/yarr/YarrJIT.cpp#L1907-L1909)),
  so JavaScript sees a silent `null`: a false negative, not an error. No regex
  timeout API was found in Bun.
- Bun documents Worker termination as experimental
  ([Bun workers](https://bun.com/docs/runtime/workers)). A local probe on Bun
  1.4.4 (this lane, 2026-11-12, busy host) found that `worker.terminate()`
  stopped a `for(;;){}` worker in about 5 ms but did not stop a worker inside
  `RegExp.exec` within 10 s. Related open issues:
  [#44216](https://github.com/oven-sh/bun/issues/44216),
  [#44886](https://github.com/oven-sh/bun/issues/44886),
  [#46669](https://github.com/oven-sh/bun/issues/46669).
- Node `worker_threads` `terminate()` does stop a stuck regex
  ([Node docs](https://nodejs.org/api/worker_threads.html); 1 ms in the same
  local probe), and V8 has a linear-time fallback engine
  ([V8 blog](https://v8.dev/blog/non-backtracking-regexp)), but both are
  V8-only. The engine's production runtime is Bun.
- Linear-time engines: node-re2 is a native addon that does not load on Bun
  ([node-re2](https://github.com/uhop/node-re2),
  [bun#48600](https://github.com/oven-sh/bun/issues/48600)); re2-wasm lacks
  backreferences and lookahead and is unsupported
  ([re2-wasm](https://github.com/google/re2-wasm)); Rust `regex` guarantees
  O(m·n) ([docs.rs](https://docs.rs/regex/latest/regex/)). None matches Python
  `re` semantics, which the port reproduces through its own translator.

Conclusion: a child process that the parent can SIGKILL stays the only
deadline mechanism. Worker threads are not an option for v3.

### Where the 130 ms per spawn goes

Bun documents `spawnSync` of a trivial binary at 888 µs
([Bun child process](https://bun.com/docs/runtime/child-process)). The local
probe measured `Bun.spawn` of a `bun` child to first stdout at a 26.6 ms
median. The engine's measured 130 ms is therefore mostly the child loading and
evaluating its module graph (Effect, Schema, RPC, the regex translator) and
decoding its startup argument, not the spawn itself. Two consequences: a slim
or precompiled worker entry is a cheaper partial fix that needs no protocol
change, and a long-lived worker pays that cost once.

### Pool designs with a kill on timeout

| System | Recycle | Killed worker: in-flight and queued jobs | Warm standby | Poison guard |
| --- | --- | --- | --- | --- |
| [Piscina](https://github.com/piscinajs/piscina) | idle timeout only | in-flight rejected, worker replaced, queued stay queued | `minThreads` | stops respawning if workers fail at bootstrap |
| [tinypool](https://github.com/tinylibs/tinypool) | `isolateWorkers`, `maxMemoryLimitBeforeRecycle` | `cancelPendingTasks` leaves running tasks alone | min threads | none |
| [jest-worker](https://github.com/jestjs/jest/blob/main/packages/jest-worker/README.md) | `idleMemoryLimit` | call retried | yes | `maxRetries` (default 3) per call |
| [pebble](https://pebble.readthedocs.io/en/latest/) | `max_tasks` | timed-out task fails, worker restarted | yes | none documented |
| [concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html) | `max_tasks_per_child` | abrupt death raises `BrokenProcessPool` for the pool | yes | whole pool is poisoned |
| [Chromium](https://chromium.googlesource.com/chromium/src/+/main/docs/process_model_and_site_isolation.md) | soft memory limit | not on that page | spare renderer | not on that page |

Standard answers: one job per worker at a time; a timeout kills that worker and
fails only its in-flight job; recycle after N jobs or on memory growth; keep a
warm spare; never retry a job that killed a worker without a bound. Only pebble
has a real per-task timeout; the others leave it to the caller.

### eyecite builds its tokenizer once

The Python source this engine ports fills `EXTRACTORS` at import time and
builds the two Aho-Corasick automata once per tokenizer instance, reused by
every `get_citations` call through the module-level `default_tokenizer`
([tokenizers.py](https://github.com/freelawproject/eyecite/blob/b70a146d20f70b366baf150a1cc9e82229ef5a0d/eyecite/tokenizers.py),
[find.py](https://github.com/freelawproject/eyecite/blob/b70a146d20f70b366baf150a1cc9e82229ef5a0d/eyecite/find.py#L40-L44)).
Each extractor caches its compiled regex
([models.py](https://github.com/freelawproject/eyecite/blob/b70a146d20f70b366baf150a1cc9e82229ef5a0d/eyecite/models.py#L866-L870)).
Install-once is the upstream behavior; per-request rebuild is a port artifact.

### Effect v4 building blocks (reference checkout)

- `effect/Pool` exists: `make`, `makeWithTTL`, `makeWithStrategy`
  (`E/Pool.ts:264-379`); `get` is scoped (485), `invalidate` replaces a
  borrowed item at once and finalizes the old one when its last lease is
  released (865-878, 994-1002), so `idle + used` can briefly exceed `max`
  (953-955). There is no recycle-after-N option (87-94).
- `RpcClient.makeProtocolWorker` is built on `Pool`, re-runs a crashed worker
  on a one-second schedule and answers an interrupt by releasing the lease and
  sending a cooperative `Interrupt` message, never a kill
  (`E/rpc/RpcClient.ts:1563-1652`). The Bun worker platform closes with a
  hard-coded 5 s wait and then `worker.terminate()`
  (`packages/platform/bun/src/BunWorker.ts:55-63`). This confirms the prior
  in-repo audit: the stock pool cannot be the lease authority.
- There is no client-side stdio or child-process RPC protocol
  (`E/rpc/RpcClient.ts`), and `ChildProcess` has no IPC option
  (`E/process/ChildProcess.ts`). The engine's own `NativeRpc` transport over
  stdin/stdout stays.
- Child handles expose `kill({ killSignal, forceKillAfter })`, `isRunning` and
  `exitCode` (`E/process/ChildProcessSpawner.ts:86-208`); scope closure
  terminates a referenced running child with the command's own kill options
  (`packages/platform/node-shared/src/NodeChildProcessSpawner.ts:677-708`).
- Run-time binding: `Context.Service` (`E/Context.ts:209-240`),
  `Context.Reference` with a default value (1390-1397),
  `Effect.provideService` (`E/Effect.ts:6592`), `Effect.provideContext`
  (6240), `Effect.serviceOption` (6373), `Effect.scoped` (6753), `Scope.fork`
  (`E/Scope.ts:430`), `Scope.provide` (322). `Layer.scoped`, `FiberRef` and
  `Context.Tag` are gone in v4.
- Deadlines: `Effect.timeoutOrElse` (`E/Effect.ts:4862`) is a `raceFirst`
  against a sleep, and the parent awaits the interrupted loser
  (`E/internal/effect.ts:1743-1792`, 4004-4007). A loser that cannot be
  interrupted delays the result, which is why the kill must be the loser's
  interruption finalizer.
- Schema has no freeze, structural sharing or cheap clone. `Schema.Data` and
  `Data.struct` are gone; decoding always allocates
  (`E/SchemaAST.ts:3020, 3159`); readonly is type-level only. `S.Opaque` is
  type-level too (`E/Schema.ts:6688`). Proving a decoded value unshared needs
  either a copy or a type that hides the mutable carrier.
- Test tracing: `Tracer.make` (`E/Tracer.ts:479`) plus `Effect.withTracer`
  (`E/Effect.ts:8302`); no stock test tracer.

## In-Repo Capability Inventory

### The extract path today

The engine Layer is built once (`L:121`, `L:157-206`): one shared operation
admission and native admission (`C/NativeAdmission.ts:234`), the 6,805-extractor
catalog (`C/TokenizerCatalog.ts:37`), and the HTML worker. Everything below the
top-level `SourcePairDocument` stage is installed again on every request:

| Hop | Site | Installs per request |
| --- | --- | --- |
| source prepare | `C/SourceExtraction.ts:64` | VerifiedExtraction (config decode, two detaches) |
| verified | `C/VerifiedExtraction.ts:127-128` | SemanticExtraction, OccurrenceProjection |
| semantic | `C/SemanticExtraction.ts:92-93` | ExtractionEntry, SemanticProjection (re-hashes the vocabulary artifact) |
| entry | `C/ExtractionEntry.ts:147` | DocumentExtraction |
| document | `C/DocumentExtraction.ts:156, 171` | InputDocument, TokenizedExtraction; markup input also builds an HtmlDiscovery regex worker and a Diff worker |
| tokenized | `C/TokenizedExtraction.ts:107-108` | the tokenizer and the extraction loop |
| loop | `C/ExtractionLoop.ts:165-168` | Full, Reference, GeneratedCombined, Selection |
| full | `C/FullExtraction.ts:238-240` | CaseMetadata, FullLaw, Journal |

Counts from the source, correcting the capture: 34 distinct metadata stage
types are defined (26 `makeCitationMetadataStage` sites in 21 files, 6 direct
`makeCitationMetadataOperation` sites, 2 publication sites), 36 factory call
sites in all, and 14 metadata-operation installs plus the tokenizer, loop and
selection run per request. The capture's "21" is the file count; "53" could
not be reproduced by one method.

The same source read found a cost the capture did not name: regex worker
*objects* are constructed per helper call, often per token.
`makeCitationContextMatcher` (`C/ContextMatcher.ts:87`),
`makeCitationMetadataStrings` (`C/MetadataStrings.ts:157`),
`scanCitationCaseName` (`C/CaseNameScan.ts:186`), `processCitationCaseName`
(`C/CaseNameProcess.ts:172`), `cleanCitationStopWords` (`C/StopWords.ts:85`),
HTML case names (`C/HtmlCaseName.ts:231`) and generated references
(`C/GeneratedReferences.ts:179, 269`) each call `makeCitationRegexWorker`,
which re-decodes limits (`C/NativeProcess.ts:34-48`), builds a descriptor
registry and a process owner, and then spawns one child per evaluation.

### What an install captures

`makeCitationMetadataOperation` (`C/MetadataComposition.ts:197-219`) captures
the operation admission, a dependency Context (native admission, Clock,
`CitationRegexOperation`, Digest, Path, `ChildProcessSpawner`) and, through
`Effect.serviceOption`, the enclosing `CitationTextBudget`. Each `run` then
uses the captured budget or makes a fresh one, and opens a fresh
`Effect.scoped`. The Scope is not captured by the operation, but the regex
worker's process owner does capture one (`C/NativeProcess.ts:236-238`), and
`RegexInput` captures the budget's `reserve` (`C/RegexInput.ts:209`). Children
are installed inside the parent's `run` precisely so those captures resolve to
the request's budget, Scope and nested admission
(`G/history/evidence/2026-11-06-extraction-loop.md:18-27`): the nested
admission is a pass-through that avoids self-queueing when
`concurrentOperations` is 1 (`C/Admission.ts:151-165`).

So the per-request install is how run-time values reach the stages today.
Capture-at-install is the binding mechanism; replacing it means the three
request-scoped values (budget, Scope, admitted-operation view) must arrive
another way.

### Ownership and kill guarantees that must survive

- Native lease (`C/NativeAdmission.ts:29-32, 51-52`): "Native leases transfer
  to retirement ownership, never automatically release when an operation
  finishes." Regex leases consume both the total and the regex concurrency
  bound; absolute ceilings are 2 operations, 2 regex processes and 16 queued
  (`packages/law-practice/use-cases/src/CitationEngine/CitationEngine.limits.ts:53-55`).
  Any quarantine refuses every new acquisition (`C/NativeAdmission.ts:121-125`).
- Process owner (`C/NativeProcess.ts:218-357`): the record is registered before
  the OS spawn; retirement is SIGKILL with zero `forceKillAfter`, a re-check of
  `isRunning`, per-child Scope closure, then lease release; an unconfirmed
  retirement moves to quarantine after `cleanupDeadline`; the child gets an
  empty environment, no shell and ignored stderr.
- `withCitationNativeProcess` (`C/NativeProcess.ts:153-196`): one claim and one
  start per invocation; "only retirement releases a transferred lease."
- The regex timer covers spawn, startup, traffic and matching
  (`C/RegexWorker.ts:32-38, 91`).
- Prior decisions: a same-thread timeout cannot preempt a catastrophic regex
  (`G/SPEC.md:68-73`); a force-stoppable child, SIGKILL on expiry, exit
  awaited before slot reuse, quarantine when cleanup is unconfirmed,
  "reversible only through a new policy version with equivalent interruption
  proof" (`G/history/evidence/2026-10-28-limits-isolation-contract.md:90-123`);
  the stock worker RPC pool is not the lease authority
  (`G/history/evidence/2026-11-02-effect-upstream-reuse-audit.md:79-91`).

### Why the copies exist

Detach is an encode-then-decode round trip through the canonical codec
(`C/MetadataComposition.ts:103-112`). It defends against a caller mutating
configuration it still holds, including during an asynchronous fingerprint
(`G/history/evidence/2026-11-03-regex-source-descriptors.md:18-36`), and one
test reproduced a nested-deadline alias changing later policy
(`G/decisions/2026-11-07-detach-returned-report-deadlines-from-installed-operation-policy.md`).
The threat is real at the trust boundary. Below it the copies repeat: the
semantic subtree is detached at `C/SemanticExtraction.ts:78`, then again by
`ownCitationDocumentExtraction` (`C/DocumentExtraction.ts:121`), then at
`C/TokenizedExtraction.ts:93` and `C/ExtractionLoop.ts:236`. That is 8 detach
round trips per request, and the 6,805-pattern tokenizer subtree goes through
7 of them, followed by a field-by-field copy in `prepareTokenizerConfiguration`
(`C/Tokenizer.ts:115-135`) and another in `snapshotBindings`
(`C/ExtractorSelection.ts:102-124`). Pattern fingerprints (SHA-256 per pattern,
`C/MetadataComposition.ts:118`) and the court table hash
(`C/CourtLookup.ts:65-76`) are also recomputed per request or per capture.

### Tokenizer

`makeCitationTokenizer` (`C/Tokenizer.ts:158-285`) builds the extractor
ordering (`C/ExtractorOrdering.ts:84`), two Effect `Trie`s over every required
string (`C/ExtractorSelection.ts:181-197`; this replaces eyecite's
Aho-Corasick), the recipes for 6,805 extractors and 2,533 editions
(`C/ExtractorRecipes.ts:81-120`), a regex worker and a `RegexInput`. Its
configuration is engine-constant. The only request-dependent inputs are the
nested admission, the worker owner's Scope and the budget captured by
`RegexInput`; the only request data is the `tokenize(source)` argument.

### Sibling workers

Diff, Recognizer and Markup (shared by Html and Xml) are also one process per
job on the same `NativeAdmission` and `NativeProcess` owner
(`C/DiffWorker.ts:83-101`, `C/RecognizerWorker.ts:114`,
`C/MarkupWorker.ts:62-155`). Regex is the only one that runs hundreds of times
per request.

### Tests, fixtures and measurement

- The five serial replays build one engine per test call through
  `makeCitationCanonicalExtractionReplay`
  (`T/CitationCanonicalExtractionRuntime.fixtures.ts:37`) with
  `concurrentOperations: 1` (`T/CitationDefaultConfiguration.fixtures.ts:108`).
  Recorded file times (`packages/law-practice/server/vitest.shards.json`):
  FullSpan 245 s, ExtractionLoop 305 s, PinSpan 145 s, PageCorrection 129 s,
  ParsedEquality 70 s.
- `makeCitationObservedSpawner` (`T/CitationNativeSpawner.fixtures.ts:214`)
  already counts spawns and confirmed retirements.
- No shared Tracer span recorder or CPU-profile helper exists in `T/`; there
  are four inline `Tracer.make` recorders elsewhere in the repo. NOT FOUND:
  the measurement fixture the capture describes was a one-off.
- `G/SPEC.md:344` already records about 5 s per document plus 25 s of engine
  installation per shard.

## Constraints Discovered

1. The kill must remain an OS process kill owned by the parent. A worker
   thread cannot be stopped inside `RegExp.exec` on Bun.
2. JSC silently returns no-match after 100 million steps. The deadline is not
   the only bound on a hostile pattern, and that bound is a false negative.
   This predates the lane and is not changed by it, but a long-lived worker
   must not make it more likely (it does not: the limit is per `exec`).
3. The lease contract is "release only on confirmed retirement" with a regex
   ceiling of 2 processes. A long-lived worker holds its lease for its whole
   life, so a pool is at most 2 workers under today's limits and the lease
   semantics need a second notion: a job slot on a leased process.
4. Per-request install is today's run-time binding mechanism. Removing it
   requires an explicit request-binding value that reaches every stage,
   including the helpers that construct workers per token.
5. The detach copies defend a real aliasing threat at the trust boundary.
   Schema offers no freeze, so "already owned" has to be carried by a type,
   not checked by identity.
6. The worker is bound to one descriptor at startup through its argument
   (`CitationRegexWorkerStartup`, `C/RegexWorkerRpc.ts:99-112`), and the
   worker re-derives the program from the pattern bytes and checks it against
   that descriptor. A long-lived worker must accept many descriptors and keep
   that re-derivation.
7. Local measurement is unreliable on the shared host. Before and after
   numbers need a counted metric (spawns, installs, detaches) beside wall
   time, and heavy suites need a remote worker or package scope.
