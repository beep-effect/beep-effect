# Independent Effect upstream reuse audit

The operator requested a thorough independent exploration of the canonical
Effect packages and modules to identify infrastructure being reinvented by the
citation engine. A read-only `gpt-6.1-sol` / medium sub-agent completed the audit.
No implementation, dependency installation, heavyweight test suite, or migration
was performed by the reviewer.

## Scope and versions

- Implementation: `d717aa7c7e00c8370f29ae74bded6294b6fb8199`.
- Canonical Effect checkout: `7a87ff9b88b1a570995b1b5570559c1b4dd5367b`,
  `/home/elpresidank/YeeBois/references/effect/effect`, package version 4.1.2.
- Installed implementation dependency: Effect 4.1.1. The reviewer verified
  availability of SchemaBinary, its RPC serialization layer, Worker constructors,
  Effect transactions, TxRef and TxSemaphore in the installed sources.
- Focus: current HTML worker, pending regex transport/execution, byte framing,
  operation/native admission, cleanup/quarantine, allocation tickets, Python
  collections/Unicode, and relevant core/platform/RPC/workflow alternatives.

The parent independently inspected the installed RPC retry/interrupt paths and
canonical binary string writer. Findings distinguish source inspection, executed
probes, architectural recommendations, and preservation requirements.

## Conclusion

There is substantive reinvention of generic orchestration and serialization.
The hard-stop process contract justifies a narrow owned backend and retirement
policy. It does not justify implementing an independent worker framework.

Prefer typed Effect RPC directly over the existing bounded one-job Effect
Stream/Sink process transport, and use Effect transactions for atomic admission.
The [stdio follow-up](2026-11-03-effect-stdio-rpc-follow-up.md) supersedes the
initial recommendation to require WorkerPlatform/WorkerRunnerPlatform: those
services are optional when the backend is already a backpressured byte stream. Evaluate SchemaBinary before extending the private
JSON/base64 formats. Merely wrapping the current framework in Worker.makeUnsafe
would be cosmetic; adopting the stock worker RPC pool unchanged would lose
important ownership guarantees.

This is not a claim that every custom citation component is redundant. Python
observable behavior, allocation authority and physical retirement have concrete
requirements beyond ordinary collections, pools or codecs.

## Responsibility matrix

Upstream paths below are within the canonical checkout at the pinned revision.
Installed signatures must be used during implementation.

| Priority | Current implementation | Upstream candidate | Replace | Preserve or specialize |
| --- | --- | --- | --- | --- |
| P1 | NativeAdmission lock, Ref counters, generation Deferred, wake/recheck loop | Effect.tx/txRetry, TxRef, TxSemaphore | Atomic total/regex reservations, notifications and consistent closed/quarantine transitions | Bounded queue entry, queue/operation deadlines, issued lease authority and retirement-only release |
| P1 | HTML readiness, response dispatch, conversation lifecycle and parallel regex infrastructure | Direct rpc/RpcClient.Protocol and RpcServer.Protocol over Effect Stream/Sink; WorkerPlatform/WorkerRunnerPlatform optional for message runtimes | Common parent/child typed conversation and handler/lifetime integration | Exact ingress/message budgets, one-job rule, process handle registry, force stop and retirement acknowledgement |
| P1 | Per-worker typed job/result plumbing | rpc/Rpc, RpcGroup, RpcClient.Protocol/make, RpcServer.Protocol/make | Typed requests, success/error codecs, request identity, handler registration and tracing | Source-safe errors, no duplicate native evaluation, physical retirement barrier and evaluation grants |
| P1 candidate | JSON/base64 sizing, property scanners and framing | encoding/SchemaBinary; RpcSerialization.layerSchemaBinary | Schema-derived binary layout, direct bytes, length-prefix parsing, incomplete-frame detection | Pre-allocation guards, pre-encode exact sizing, exact frame counts and surrogate-safe representations |
| P2 | Operation admission plus repeated standalone HTML admission | Semaphore, Queue/TxQueue, transactions | Shared admission and cancellation/shutdown machinery | Separate operation/process capacity, immediate overload and captured queue/total deadlines |
| P2 | Retirement fiber deduplication and manual owner tracking | FiberMap, FiberSet, Scope, Ref/TxHashMap | Keyed task tracking and normal scoped worker supervision | Retirement may outlive the request and closed owner scope; bound it by outstanding native leases |
| P2 | Verified asset chunk concatenation | Bytes.concat | Straightforward chunk-copy loop | Exact asset size, digest authentication and provenance |
| Preserve | CleanerPipeline allocation tickets | Semaphore, Ref and transactions as implementation primitives | Some atomic transitions | Monotonic produced-text accounting and actual single-use object-identity authorization |
| Preserve | RuntimeDictionary/RuntimeSet, Python hashes and native Unicode | HashMap/MutableHashMap/HashSet/TxHashMap for generic storage | Existing generic storage already uses these | CPython probe/iteration order, mutable stored hashes, reflected callbacks/reentrancy and Python point semantics |
| Future orchestration | Persisted document jobs, retry after host restart | workflow/Workflow, WorkflowEngine, Activity, DurableDeferred; cluster workflow engine | Durable execution, idempotency, suspension/resumption and persisted waits if required | Does not replace responsive watchdogs, hard kill or live child ownership |

## Source-backed constraints

### Worker abstraction and process support

`packages/effect/src/workers/Worker.ts` defines WorkerPlatform at line 31,
makeUnsafe at 70, and makePlatform at 155. WorkerRunnerPlatform is defined in
`workers/WorkerRunner.ts` at line 59. The Node platform explicitly accepts both
worker_threads and IPC child processes in `packages/platform/node/src/NodeWorker.ts`.
NodeWorkerRunner likewise supports parentPort and process.send. Therefore process
isolation alone is not a reason to bypass Effect workers.

makePlatform has an ordinary pre-ready send array and dispatches incoming
handlers through FiberSet. It provides no citation-specific byte/message ceiling.
The adapter must enforce its bounded conversation before calling send/emit.
makeUnsafe accepts effectful send/run and may fit a bounded stdio backend better
than makePlatform's synchronous postMessage hook.

### Default worker RPC pool is not the lease authority

Canonical RpcClient.makeProtocolWorker retries the backing worker run every
second (`rpc/RpcClient.ts:1620`; installed 4.1.1 around 1638). Its Interrupt path
deletes the request entry and opens the pool latch before sending the interrupt
(canonical 1682–1689; installed around 1700). This is RPC availability accounting,
not independent physical process retirement. It must not authorize a replacement
child while the old child is unacknowledged. The source establishes transport
restart behavior; this audit does not claim that it automatically replays every
native request.

Use typed RPC client/server machinery with an explicit Protocol or constrained
one-job adapter, retaining separate physical native lease ownership.

### Stock shutdown and stronger process primitives

NodeWorker and BunWorker request graceful close, wait five seconds, then force
termination. The Node child fallback kill does not itself provide the citation
independent-exit acknowledgement and quarantine contract.

ChildProcessSpawner remains a valuable upstream foundation. Bun's process
spawner uses the Node-shared implementation; isRunning follows an exit Deferred
and kill waits for that exit signal (`NodeChildProcessSpawner.ts`, canonical
around lines 739 and 759). Keep this primitive under the worker backend rather
than replacing it with raw process management.

### NDJSON is bounded, but has different semantics

`encoding/Ndjson.decode({ maxLineBytes })` limits line bytes. It still retains one
pending array element per chunk, accepts CR/CRLF/BOM and a valid unterminated
final JSON value, parses before citation structural preflight, and can produce
several parsed values from one chunk before downstream count checks.

RpcSerialization's NDJSON implementation has a separate maxBufferSize and
concatenates decoded strings before checking it. These semantics are not the
current strict LF-only, exact-count, final-terminator and amortized-buffer
contract. A small strict frame reader remains defensible if JSON is retained.

### SchemaBinary is a strong candidate, not a drop-in codec

`encoding/SchemaBinary.ts` provides parser (canonical line 335), encode (665),
decode (723), length prefixes, direct byte layouts, maxFrameSize, incomplete
frame failure, amortized buffering, collection guards and a nesting limit.
`rpc/RpcSerialization.ts:698` provides layerSchemaBinary.

Required adaptations:

- maxFrameSize does not bound encoder allocation; pre-encode admission remains.
- When a header is pending, the parser can expand its buffer for the new chunk
  before validating the completed declared frame length (canonical 510–522,
  followed by the length check around 587). Bound ingress before that allocation.
- Earlier complete frames can precede a later failure; enforce the one-job
  conversation and withhold publication until full validation/retirement.
- Map generic parser/schema errors immediately to closed source-free errors.
- Plain strings use TextEncoder.encodeInto (canonical writer around 1550/1561).
  This does not preserve isolated surrogates.

An executed read-only installed-4.1.1 probe round-tripped `a\uD800b` as
`a\uFFFDb`. Fidelity-sensitive strings must use existing native Unicode storage
or an explicit UTF-16 byte codec, with exact representation/size proof. A second
small probe confirmed Effect.tx and TxRef execute in installed 4.1.1. Neither
probe establishes migration correctness or performance.

## Recommended composition

Keep one public-operation admission owner and one native-process owner per engine
lifetime. A public operation may execute several native stages; an unacknowledged
child can outlive its operation. Their permits are not interchangeable.

Represent native closed/quarantine state and total/regex availability
transactionally. A blocked transaction reads all relevant state and uses
Effect.txRetry. Release, closure and quarantine change that same transactional
state. Keep bounded queue reservation and its single queue timer outside the
retrying acquisition. Never spawn a process or issue a single-use allocation
capability inside a transaction that may retry.

Use ChildProcessSpawner to acquire the exact child in an owned scope, with a
separate retirement owner retaining the handle and native lease. Provide
RpcClient.Protocol and RpcServer.Protocol directly over bounded stdio, using
typed RPC operations for HTML and regex. Worker services are optional for a
future message-oriented backend. RPC
completion yields a candidate result; only full validation and successful
retirement authorize publication. A timeout cannot be renewed by progress.
Cancellation triggers hard termination and captured cleanup; unconfirmed cleanup
quarantines the lease, and eventual exact exit may release it.

First preserve the current frames under this architecture. Then prove whether a
small SchemaBinary ingress guard plus byte-based text codec can replace the
JSON/base64 machinery. Use the installed 4.1.1 API signatures; no dependency bump
is required for the identified candidates.

## Migration and preservation proof

1. Transactional native admission behind the existing service contract. Preserve
   blocked-regex/available-HTML behavior, wake-on-close/quarantine, one queue timer
   across unrelated wakes, commit/cancellation races, and same-lease idempotence.
   Existing tests include 32 handoff races and concurrent quarantine/release.
2. Shared worker backend with current framing. Preserve real kernel output and
   exact-PID exit checks. Exercise early exit, readiness timeout/duplicates,
   unsolicited messages/floods, and cancellation during spawn transfer.
3. Typed RPC with explicit no-duplicate-evaluation policy. Verify closed error
   round trips and no physical permit reuse on RPC interrupt. Use a synchronous
   blocking child to prove parent responsiveness, hard kill and retirement.
4. Optional binary migration. Check every frame split, one-byte fragmentation,
   malformed/overlong length headers, split oversized declarations, giant chunks
   after partial headers, excess frames, partial EOF, fake collection counts,
   nesting, trailing bytes and exact complete-message ceilings. Measure actual
   allocations where pre-allocation is the contract. Cover high/low lone
   surrogates, literal adjacent surrogates, astral scalars, BOM and all native
   Unicode widths.
5. Remove duplicate admissions only after two independently constructed adapters
   are shown to share one owner and deadline policy. Preserve all preparation
   and queue time in the total deadline.
6. Run the complete existing source/corpus and real-process qualification on the
   final migrated head. Retain parser failures, source receipts, environment
   isolation, malformed/partial/trailing/oversize rejection, quarantine, captured
   Clock, owner Scope closure and delayed acknowledgement controls.

The delayed-acknowledgement tests hold acknowledgement after an actual kill.
They prove lease retention and admission behavior, not an OS process that cannot
be killed. Preserve that distinction in future proof.

## Decisions requiring follow-through

Clarify the 2026-10-28 policy: it rejects an Effect timeout plus the stock
five-second finalizer as sufficient containment, not WorkerPlatform, typed RPC or
upstream orchestration. Preserve its binding safety obligations. The initial
2026-11-02 reuse review was incomplete and is supplemented by this audit.

Transactional admission is implemented in f6c8c62a45. Make shared typed stdio RPC
transport concrete goal work before extending the unfinished regex supervisor. Reconsider JSON/base64
as an implementation choice, preserving all safety and fidelity duties.

This audit records recommendations and evidence. It does not implement the
migration, waive an obligation, or prove exhaustive parity for the final engine.

The [stdio RPC follow-up](2026-11-03-effect-stdio-rpc-follow-up.md) also records
existing makeProtocolStdio, its unconditional retries, socket alternatives and
pre-run buffering in the Protocol.make convenience constructors. It corrects
the transport recommendation without changing the safety/fidelity obligations.
