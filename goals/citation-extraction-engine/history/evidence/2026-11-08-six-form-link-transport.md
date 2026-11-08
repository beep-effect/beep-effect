# Strict local linking and Effect process transport — 2026-11-08

The approved six-form path now reuses the existing resolution kernel with strict
local rules. Short forms retain all preceding matching publication authorities;
supra uses escaped literal party tokens with Unicode letter/mark/number edges;
Id. propagates preceding ambiguity and charges every propagated candidate edge.
The prior donor-behavior entrypoint remains for existing diagnostic consumers.
No production consumer imported the generic kernel before this change; the
registered callback resolver is a separate retained path. No public API retired.

A new private NativeSocket adapter connects an already-owned child process's
Effect streams/sink to Socket.make. RpcClient.makeProtocolSocket supplies the
client protocol; RpcServer.layerProtocolStdio and layerSchemaBinary supply the
server and framing. There is no private envelope, request-id, parser or framing
implementation. Queue, Deferred and Scope manage the single stdin writer and
propagate source-free write failures to pending reads. The existing process
owner/admission retain physical exit, cleanup deadline and quarantine ownership.

## Focused proof

Bun 1.4.4, Vitest 5.1.0, Effect/platform 4.1.2:

- Four test files, 25 tests pass in 2.26 seconds: CitationSixFormResolution,
  CitationResolve, CitationNativeSocket and CitationNativeProcess.
- Party controls include substring, prefix, case, Unicode letters, combining
  marks, underscore/digits, punctuation, literal regex metacharacters, multiword
  names and punctuation-only antecedents. Supplied short-party guesses do not
  force a winner. Two successive Id. mentions preserve ambiguity, with exact
  accepted/refused candidate-edge ceilings.
- Real RPC child calls preserve ordinary, astral, combining, isolated-surrogate,
  NUL/newline and empty strings. S.fromJsonString supplies JSON escaping before
  SchemaBinary; no private UTF-16 encoding is introduced. Repeated calls share
  stdin and return exact values.
- A test-only stderr marker observes entry into the non-cooperative handler.
  A supervisor deadline and explicit caller cancellation both physically retire
  the blocked child before releasing its permit. Independent observed spawner
  receipts report spawned1/confirmed1, with active0/quarantined0 afterward.
- EOF without a response fails the pending call. The source-free transport
  failure does not contain the supplied private test string.
- Independent reader-scope closure wakes an otherwise suspended pull without
  killing the child. A deliberately non-consuming sink fills eight queue slots;
  the next offer suspends, and writer-scope closure fails it. An injected stdin
  error after a successful Echo fails the next pending call while the real child
  remains alive. A separate setup-failure control rejects the call promptly.
- Full server source/test type checking passes with tsrs. Biome checks all six
  changed implementation/test files. The strict resolver also replays all29
  frozen prototype inputs with zero field/range/link disagreements.

Commands ran from the server package unless shown otherwise:

```sh
bunx --bun vitest run test/CitationSixFormResolution.test.ts \
  test/CitationResolve.test.ts test/CitationNativeSocket.test.ts \
  test/CitationNativeProcess.test.ts
bunx tsrs -p test/tsconfig.json --noEmit
```

The package law scan failed on two existing native typeof checks in unchanged
BuiltinDump.ts and Dump.ts; its three advisories also name unchanged files.
No finding names a changed implementation/test file. This is attributed local
failure, not a passing package-law gate. Hosted checks remain authoritative.

## Adversarial corrections and integration settings

A separate read-only Effect audit identified the socket adapter's scope-close
signal and the supplied protocol's default reconnect policy. Reader-local and
writer-close Deferred signals now enforce closure explicitly. Sticky writer
health is checked before/after offering bytes, so an immediate successful queue
operation cannot win over an already known write failure. No envelope protocol
was added to fix these lifecycle issues.

A fixed child client must use retryPolicy: Schedule.recurs(0); the separate
retryTransientErrors flag does not disable reconnect. The qualification factory
also yields after RpcClient.make so the supplied scoped run fiber registers
before an immediate local write failure can broadcast. Deadline timing begins
after observing the test handler's marker; marker waits have their own bound.
When integrating the recognizer, configure the supplied protocol's ping interval
and timeout against the captured parser deadline: its default five-second
liveness policy must not prematurely reject permitted synchronous parser work.

## Limits and remaining delivery

The child is an RPC qualification fixture, not the recognizer. These tests do
not qualify parser output/allocation limits, production reporter-edition mapping,
metadata source checks, malicious frames, all public error mappings, Node worker
packaging or the complete public Layer. Source and response schemas in the
fixture are bounded; production policy integration is still required. No donor
was installed or added as a runtime dependency, and no public engine switched.
The goal stays active for the actual six-form service, hosted proof and retention.
