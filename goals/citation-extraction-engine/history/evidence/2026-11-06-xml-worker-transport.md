# Typed XML worker with shared markup supervision

The pinned XML query now executes in actual Bun/Node children through upstream
Rpc/RpcGroup clients and handlers. XmlWorkerProgram authenticates the explicit
asset, emits Ready, reads exactly one complete query and EOF, emits Started,
runs the synchronous query inside that child, then writes one boolean/refusal.
The parent accepts only the three-frame conversation and complete EOF. False is
an explicit Some(false) success, never interpreted as missing output.

## Reused process and RPC machinery

MarkupWorker extracts the existing HTML queue/timing/process operation with its
Effect Semaphore, captured Clock, shared transactional native admission and
NativeProcess owner. HTML uses this same constructor; its original duplicate
supervision block and snapshot definition are removed. XmlWorker selects the
annotation operation/deadline on that constructor. Retirement, exact child
ownership, quarantine, queue limits, cancellation transfer and release remain
one implementation. The native pool remains shared across both adapters.

NativeRpc also owns the existing transport/client/delivery composition once.
HTML, diff and XML use that helper with their own typed RpcGroups and codecs.
It adds no retry, buffering, replay or replacement-child policy. The existing
one-job server helper supplies XML's typed handlers. Native parser execution
stays out of the parent; no second parser or OS process manager is introduced.

## Frames, allocation and deadlines

The XML job contains only native width/bytes and fixed protocol metadata.
Schema-derived exact header plus base64/LF charge is checked before input copy
and frame/base64 allocation. Replies have bounded fixed metadata, including
boolean values and the declared kernel/safety error schemas. The existing
strict native frame reader/JSON scanner enforces message/depth/property/EOF
bounds. Malformed body bytes and extra frames refuse without partial output.

Inputs are immutable adapter-owned native values through preflight. The shared
Unicode helper reserves the exact input receiving copy before allocation and
revalidates its native result. The operation's captured text authority cannot
be replaced by caller Context. The worker is constructed within that owning
operation; final public dispatch must preserve this lifetime.

PythonUnicode now accepts a schema-decoded operation selector, defaulting to
clean for existing consumers. Its timer uses the selected stage and total
operation deadline. Annotation does not inherit an unrelated clean deadline.
A Clock control blocks pre-allocation, proves it is pending after the configured
one-millisecond clean deadline, then receives the captured annotation refusal
at fifty milliseconds. Unknown operation selectors refuse installation.

## Verification

- Twenty-nine tests across six files pass in 31.27 seconds: actual XML workers,
  XML frame controls, HTML lifecycle/RPC, connected annotation mapping with
  actual diff children, and native Unicode.
- The selected XML source replay covers 28 representative original cases on
  each actual runtime, with 28 confirmed physical exits and fully released
  operation/native ownership per runtime. It includes false/true, namespace,
  depth, NUL and width-dependent surrogate behavior.
- Frame controls prove exact success at complete-frame size and refusal one
  byte below, false/true/error round-trips, invalid base64 and excess frames.
- A primed captured parent budget refuses a two-unit input before native spawn,
  despite a replacement caller budget; both the retained charge and zero spawn/
  exit counts are asserted.
- Seven final Unicode tests pass in 7.79 seconds, including the new selected
  deadline control. Earlier HTML/Unicode/RPC regression also passed twenty tests
  after extracting the common worker operation.
- Server lint/type checks, declaration emission, blocking laws and scoped Fallow
  pass. No dead-code/complexity/duplicate finding is introduced; nine inherited
  clone groups remain nonblocking. No thresholds or baselines change.

The complete 300-case corpus is registered in the integration suite for each
runtime: 600 real children and exact source results. Hosted execution remains
pending; the selected local replay does not establish that full hosted result.
The kernel's existing complete in-process source replay remains separate proof.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bunx --bun vitest run test/CitationXmlWorker.test.ts \
  test/CitationXmlWorkerProtocol.test.ts test/CitationHtmlWorker.test.ts \
  test/CitationHtmlWorkerRpc.test.ts test/CitationAnnotationAssembly.test.ts \
  test/CitationPythonUnicode.test.ts
bunx --bun vitest run test/integration/CitationXmlWorker.test.ts
```

Full skip/wrap dispatch, replacement-template interpretation, custom annotators,
complete request/service/Layer and native/port boundary translation remain open.
Whole-engine adversarial safety/scaling and the full hosted corpus are required
before completion. All eleven representation laws, four fidelity questions and
fifteen unfinished proof rows remain open without a semantic waiver or source/
donor accounting promotion.
