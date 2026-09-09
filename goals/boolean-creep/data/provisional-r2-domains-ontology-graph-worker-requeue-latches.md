# Provisional design: ontology graph-worker retry state

Stable ID `r2-domains-ontology-graph-worker-requeue-latches`. P2 proposal on
HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Proposed corrected cardinality
12 representable / 5 legal; stored/internal, Tier 1. The raw R28 report says
6/5 and needs independent correction. This file does not replace the current
canonical design or establish independent P3 approval. Full evidence and
proposed canonical row are in `data/design-refresh-2026-09-09-r28-graph-worker-retry.md`.

## Current shape

`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1779–1965`
declares the exported `ontologyGraphWorkerBridgeAtom`. Inside its mounted
callback, `lastProjectionRequest: O.Option<WorkerCommand>` at1791 and
`requeuedAfterFailure = false` at1792 jointly retain a request and its retry
budget. Both are actual mutable values. `.requeueLatches` is a scanner suffix,
not a declared symbol; correct the owner symbol to the atom's actual name.

Independent sibling locals are `worker: Option<Worker>` and
`previousProjection: Option<OntologyGraphProjection>` at1789–1790. They govern
worker ownership and incremental graph projection and must remain separate.
The request's required snapshot/options/delta/previous payloads, request-slot
sequence counters, callbacks and watchdog are not extra Boolean axes in this
retry owner. There is no public constructor, persisted field, optional Boolean,
or encoded key for either retry local.

The imported `WorkerCommand` is a five-case schema, not a two-case alias:
`packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts:24–30`,
74–99,122. It admits parseTurtle `{request}`, diffDatasets `{before,after}`,
computeSnapshot `{session}`, projectGraph `{snapshot,options}`, and
applyGraphDelta `{snapshot,delta,previous,options}`. Its public constructors,
examples, type alias, and codecs remain authoritative for all five.

Only the last two commands enter this private slot. The immediate graph-request
subscription selects apply when both previous projection and delta exist,
otherwise project; it then installs Some and clears the Boolean at1949–1950.
Failure tests the Boolean before matching Option, sets true only for Some,
arms the watchdog and dispatches at1905–1919. Both graph-success handlers clear
the Boolean while retaining the command at1860/1866.

## Cardinality gap

Count the actual declared domain first. None plus five Some command kinds gives
six finite payload alternatives; multiplying by the Boolean gives 12. The
producer subset determines legal states, not the declared numerator:

| Command alternative | false | true |
| --- | --- | --- |
| None | Initial `absent` | Illegal |
| `projectGraph` | `retryable(project)` | `retried(project)` |
| `applyGraphDelta` | `retryable(apply)` | `retried(apply)` |
| `parseTurtle` | Unsupported private payload | Unsupported private payload |
| `diffDatasets` | Unsupported private payload | Unsupported private payload |
| `computeSnapshot` | Unsupported private payload | Unsupported private payload |

Five states are legal. The only true writer is in the Some branch at1914;
the only command-slot assignment at1949 receives the two constructors at1931
and1942. Required payload values are preserved without inflating this finite
control-state count. The old 4/3 design hid all command kinds behind presence;
the raw 6/5 correction counted only emitted kinds as representable. Both need
the same owner correction to 12/5.

All five legal states have a producer path: initial None/false; fresh full
project request; first project failure; a successful projection followed by a
delta-bearing request; and first failure of that apply command. A graph success
can additionally restore either retained command to retryable. The worker's
public parse/diff/compute command arms exist but are not writers of this
closure-local slot, so they do not add legal private states.

## Target schema

Introduce private schema building blocks in `Session.atoms.ts` near the graph
worker schemas. Reuse the existing command case schemas without reconstructing
payload fields or narrowing the public protocol. The local Effect v4 reference
provides typed `.cases` and exhaustive `.match` at
`.repos/effect/packages/effect/src/Schema.ts:6014–6037`, and `S.toTaggedUnion`
at6105–6117. The repo LiteralKit implementation returns that tagged-union API at
`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:791–813`.

The intended schema outline is:

```ts
const OntologyGraphProjectionCommand = S.Union([
  WorkerCommand.cases.projectGraph,
  WorkerCommand.cases.applyGraphDelta,
]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("OntologyGraphProjectionCommand", {
    description: "Existing graph command cases retained by this bridge for retry.",
  })
);

const OntologyGraphProjectionRetryPhase = LiteralKit([
  "absent",
  "retryable",
  "retried",
]).annotate($I.annote("OntologyGraphProjectionRetryPhase", {
  description: "Availability of one automatic retry for the retained graph request.",
}));

const OntologyGraphProjectionRetryState =
  OntologyGraphProjectionRetryPhase.toTaggedUnion("phase")({
    absent: {},
    retryable: { command: OntologyGraphProjectionCommand },
    retried: { command: OntologyGraphProjectionCommand },
  }).pipe($I.annoteSchema("OntologyGraphProjectionRetryState", {
    description: "Retained graph command and its automatic retry budget.",
  }));
```

Derive types from these schemas. Initialize one local value with
`OntologyGraphProjectionRetryState.cases.absent.make({})`; case constructors
supply their `S.tag` discriminator. The two payload-bearing phases each admit
the two graph command kinds, giving exactly `1 + 2 + 2 = 5` states. There is no
Option command or Boolean retry field inside the new state. Keeping the full
five-case `WorkerCommand` here would produce eleven states and leave six
unsupported combinations in the target.

Use the private command's individual case constructors for the existing fresh
project/apply producers so the constructed value is statically narrowed while
retaining the exact existing `kind` and complete payload. Do not add an `as`
cast, decode/guard wall, duplicate field list, new public command alias, or a
temporary compatibility layer. Keep public `WorkerCommand` and dispatch codecs
as they are; a graph-only command is still a valid input to the full encoder.

Use the retry schema's exhaustive match for transitions:

- Fresh graph request: replace any state with `retryable(command)` before error
  clearing, watchdog arming and dispatch, keeping the current ordering.
- First failure from retryable: install `retried(command)` before arming and
  dispatching. Retain the same command object; synchronous send/construction
  failure sees retried and cannot create a retry storm.
- Failure from absent or retried: no dispatch. The caller still performs its
  existing reset/termination/error-publication work.
- Successful project/apply result: absent remains absent; retryable stays
  retryable; retried becomes retryable with its retained command. Keep existing
  error/projection updates after this transition. Do not fabricate an absent
  command or clear a retained one.
- Non-graph successful result: preserve the existing no-op handler. Common
  watchdog disarm still occurs, but this result does not restore the budget.
- Finalizer: no retry transition; keep disarm, slot clearing, termination and
  closure disposal. Do not call the failure-reset routine from the finalizer.

The Atom reactivity skill applies: state remains inside the existing mounted
atom, with no React hook, global registry, separate persisted atom, or new
service. Preserve reactive scheduling and effects instead of introducing a new
queue architecture as part of this schema change.

## Migration inventory

Paths below are relative to `packages/ontology/` unless otherwise stated.

| Writer/consumer | Exact migration and retained behavior |
| --- | --- |
| `client/src/aggregates/Session/Session.atoms.ts:46`,52–55,73 | Reuse WorkerCommand, LiteralKit, S and existing identity imports. New schemas remain private to this file. |
| Same file1650–1654,1789–1795 | Preserve graph-request payload and independent worker/previous-projection locals; replace only the Option command and retry Boolean with one absent retry state. Keep runtime-atom mounts. |
| Same file1797–1815 | Preserve watchdog generation counters, cancellation, 20-second deadline and timeout failure messages. A retry still arms before dispatch. |
| Same file1817–1837 | Preserve termination and failure order: disarm, clear previous projection, clear projection/delta/backend atoms, terminate, requeue, then publish/log redacted failure. Do not clear the retained command merely because previousProjection is cleared. |
| Same file1840–1886 | Keep literal bundler-recognized module-worker constructor, all event listeners, decode boundary, five result cases and specific error messages. Replace only graph-success budget resets with schema transitions. |
| Same file1888–1903;1745–1763 | Preserve lazy worker reuse and boundary atom that contains constructor/encoding/postMessage exceptions. Dispatch still encodes the command before posting. |
| Same file1905–1920 | Replace Boolean guard plus Option match with one exhaustive state match; transition to retried before any potentially failing downstream operation. |
| Same file1922–1957 | Narrow the two constructors using existing command case schemas, retain all fields, install retryable once, and preserve immediate subscription, error clearing, watchdog/dispatch and delta clearing. |
| Same file1959–1964 | Preserve watchdog cancellation, boundary/failure slot cancellation and worker termination. No retry during cleanup. |
| `client/src/aggregates/Session/Session.visualizer.worker.ts:23–68` | No shape change: decode full five-command envelope, no-op three non-graph cases, compute project/apply, encode results, throw typed undecodable-command error on decode failure. |
| `use-cases/src/aggregates/Session/Session.worker-protocol.ts:24–122`,256–344 | Preserve all public case schemas, constructors, tags, annotations, command/result type aliases, encoder wrappers, unary decoders and structured-clone forms. |
| `client/src/aggregates/Session/index.ts:14`, `client/src/index.ts:31`, `client/package.json:36–40` | Keep atom available through root and aggregates/Session. No private retry or command schema export. There is no current client `/public` export to edit. |
| `use-cases/src/aggregates/Session/index.ts:84`, `worker.ts:32` | Preserve ordinary aggregate and worker-safe protocol exports; do not add client-state dependencies to the worker import graph. |
| `ui/src/aggregates/Session/Session.graph.tsx:51` | Existing `useAtomValue(ontologyGraphWorkerBridgeAtom)` mounts the owner. Renderer inputs, graph error/projection/delta/backend atoms remain stable. No UI flow change. |
| `client/test/Session.atoms.test.ts:151–331`, `client/test/worker-wire.test.ts:51–89` | Keep fake-worker post counts, redaction, bounded constructor/send failures, structured-clone codec tests; extend observable transition coverage below. |
| `use-cases/test/SchemaParity.test.ts:69`,109 onward; `WorkerImportGraph.test.ts:13`; `BrowserWorkerImportGraph.test.ts:105` | Preserve public five-command schema and browser-worker dependency checks. Their consumers require no production shape migration. |

Full payload preservation is by reusing the two case schemas, not by copying
selected fields. Snapshot retains sessionId, resources, hierarchy, relationships
with its existing empty default, and metrics (`Session.projections.ts:348–359`).
Apply retains the entire previous graph projection and both delta arrays
(`domain/.../Session.model.ts:275–283`), including every RDF quad and nested
schema value. Do not replace apply retry with a newly synthesized project
request solely because failure cleared the independent previousProjection local.

Graph options retain viewMode, foldLevel, focusIri, focusDepth, pinnedNodes,
structuralFoldThreshold, autoClusterThreshold, communityBucketSize,
fullLabelThreshold and keyLabelThreshold (`Session.visualizer.ts:173–191`).
Keep the focus None default and the current default function values at209–221:
all/L2, None, depth1, empty pins, thresholds24/2500/250/250/2500. No runtime
option or schema default is simplified as part of this state migration.

The retained projection keeps revision, foldLevel, labelDetail, node/edge
counts, nodeIds/nodeKinds/nodeFlags, edgeIds/edgeKinds, pointPositions,
pointDepths with its constructor-only empty legacy fixture default, links,
nodes/edges/clusters, changed node/edge IDs, and stats
(`Session.visualizer.ts:418–446`). All typed-array contents and schema behavior
remain intact. No new payload-axis qualification is inferred from these fields.

## Guard-deletion accounting

| Frozen site | Concrete deletion and replacement |
| --- | --- |
| `Session.atoms.ts:1791–1792` | Delete two mutable state declarations; add one schema-derived retry state. |
| 1906–1908 | Delete the leading retry-Boolean early-return guard. Absent/retried no-op cases replace it in the state match. |
| 1909–1918 | Delete the nested Option match over the retained request and the true assignment. One retryable arm owns both command presence and budget, then advances before dispatch. |
| 1860 and1866 | Delete two unconditional Boolean-reset writes; restore a retained command through state matching without creating one for absent. |
| 1949–1950 | Delete paired Some/false writes; install one retryable value with the exact constructed command. |
| 1931 and1942 | Reuse narrower case constructors, eliminating the private slot's admission of six non-graph-command/Boolean combinations. No public command case is deleted. |

No deletion credit for the independent worker Option match, previous-projection
Option selection, missing-Worker check, command/result decode checks, watchdog,
event handlers, error redaction, atom counters, subscriptions or cleanup. The
new exhaustive match remains real control flow. No Boolean getter or Option
compatibility projection may recreate the old pair for downstream readers.

## Encoded-side impact

The retry state has no wire or persistence encoding. Worker messages continue
to contain only `encodeWorkerCommand(command)`; never post or spread the retry
envelope. Preserve all five command tags and all five result tags and their
public constructor examples. Do not change public acceptance of parse, diff or
snapshot commands because this private bridge sends only graph commands.

Preserve every nested command value and current encoded omission/default
semantics. In particular, focusIri None is encoded as an omitted optional key;
posting its decoded Option directly loses prototype data under structured clone
and is already guarded by `worker-wire.test.ts`. Some focus strings, pinned
nodes, delta payload, prior typed buffers and all numeric options retain their
current schema codecs. Results must still be decoded back into domain values
before projection atoms receive them. `pointDepths` remains a constructor-only
legacy fixture default, not permission to drop or fill encoded data arbitrarily.

This has no report version, JSON artifact, SQL schema, RPC field, localStorage
key or public retry codec to migrate. Encoder wrappers and unary decoders retain
their existing options exposure and signatures. Error strings and redacted
logging remain observable compatibility surfaces. No unrelated protocol alias,
new export or worker import is justified by this internal Tier 1 change.

## Test impact

This P2 task does not run or edit tests. Preserve existing tests at
`client/test/Session.atoms.test.ts:151–271`: one first retry with equivalent
encoded request, termination of the old worker, second-failure suppression,
fresh-request budget reset, malformed-result and messageerror handling, and
redaction. Preserve synchronous constructor and send failure tests at273–331,
which assert exactly two attempts. These directly protect advancing before
dispatch and failure containment.

Extend behavior tests through the public atom and fake worker to cover both
project and apply commands with their full encoded payloads, not only the
current initial project request. A successful graph result followed by a
delta-bearing update must select apply. First apply failure must retain the
original command until actual fresh subscription traffic replaces it; do not
assert an invented scheduling guarantee around reactive delta clearing.
Include success restoring the retry budget for each retained command, a second
retry failure being suppressed, and new graph traffic restoring a fresh
budget. Preserve graph-success behavior regardless of the latest command kind;
there is no existing request-ID correlation to add.

Cover malformed result, error, messageerror, silent-worker timeout, synchronous
constructor/encoding/send failure, missing Worker, and unmount/finalizer cleanup.
A valid non-graph result must disarm the watchdog but leave the retry budget
unchanged. The initial absent state must not gain a fabricated command. Test
observable posts, termination, error/projection state and timer behavior rather
than exporting private state solely for testing.

Retain `client/test/worker-wire.test.ts:51–89` and extend the encoded structured
clone round trip to apply with previous/delta/options and focus None/Some.
Existing use-cases SchemaParity and import-graph tests preserve the five-command
public protocol. A private schema type check should reject parse/diff/compute
as retry payloads while public constructors continue accepting them; use normal
package type verification rather than a runtime compatibility wrapper.

During authorized implementation, run focused Session.atoms and worker-wire
tests and mandatory `bun run beep quality package-verify @beep/ontology-client`.
Run protocol/import-graph proof appropriate to the unchanged dependency surface;
if source in another package becomes necessary, its own package verification
also applies. Static P2 source inspection is not product acceptance or P3 review.

## Risk

The principal risk is retry recursion: the state must advance before watchdog
arming and dispatch, because the queued boundary can fail synchronously.
Preserve failure-reset ordering and reactive subscription behavior; do not clear
the retained request while clearing previousProjection or assume a delta reset
cannot produce actual new graph traffic. Preserve all current success-handler
semantics, including retained commands and lack of request correlation.

The cardinality correction must be independently adjudicated. The raw 6/5
report cannot substantiate the actual declared 12-state domain. The target must
narrow its private payload to the existing two graph cases; leaving full
WorkerCommand inside retryable/retried repeats the current design's overly
broad payload. That private narrowing cannot retire any of the public five
command kinds or their encoded forms.

Keep worker lifetime, watchdog cancellation, typed errors, redaction, constructor
shape required by the bundler, and worker-safe imports intact. Do not add a
global atom or broader state-machine refactor. Land as the single existing
Tier 1 owner after parent admission and independent P3; coordinate with other
Session.atoms designs by preserving their separate state and source edits.
