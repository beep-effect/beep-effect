# P2 audit — S2-signals (85 entries)

Cluster: exported interfaces/type-literals tracked as `schema-first.inventory.jsonc`
exceptions with reason "contains non-schema signals such as function members or
runtime handles" (`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts:755-781`,
driven by `FUNCTION_LIKE_TEXT_PATTERN` / `NON_SCHEMA_SIGNAL_PATTERN` at :59-61).

## Method

Read the 12-entry slice (`ops/slices/P2-S2-signals.json`), then pulled the
full 85-entry list straight from `standards/schema-first.inventory.jsonc` via
`jsonc-parser` and personally read source for ~35 of the 85 (41%) plus a
mechanical same-file `Context.Service<Tag, Shape>()` grep across all 85. No
codex claims were taken on faith — every ruling below is from reading the
actual declaration and, where relevant, its consumers.

## Sub-class census (estimated)

| Sub-class | Est. count | % | Disposition |
|---|---:|---:|---|
| service-contracts (fence-1 carve-out) | 63 | 74% | detector-ruling |
| runtime-handles | 16 | 19% | unconvertible (leave tracked) |
| incidental-function-member | 4 | 5% | fix-code (3 real conversions attempted, all landed) |
| ui-component-contracts (React props/imperative handles) | 2 | 2% | fold into service-contracts ruling (see below) |

### service-contracts (63) — mechanical evidence

A same-file regex sweep (`Context.Service<[^,>]+,\s*<Symbol>\s*>`) hit **55 of
85 (65%)** directly — every `*Shape` symbol immediately consumed by a
`Context.Service<Tag, Shape>()` tag in the same file (e.g.
`UsageRecordSinkShape` → `apps/professional-desktop/src/chat/UsageRecordSink.ts:38`,
`WorkerRepositoryShape` → `.../Worker.repository.ts:247-249`, `FFmpegShape` →
`packages/drivers/ffmpeg/src/FFmpeg.service.ts:1137`, `M365Shape` →
`packages/drivers/m365/src/M365.service.ts:1147`,
`CorpusCommandServiceShape`/`ResearchCommandServiceShape` → CLI command
services, `ClaimGateShape`/`OfficeActionReviewShape` → `*.ports.ts` files,
where `.ports.ts` is a **documented** repo role suffix,
`standards/ARCHITECTURE.md:990`, "Product ports needed by use-cases").

A further **8 entries** are one level of indirection from that same pattern
and read as genuine ports on manual inspection:
- `BoxStreamingOperations` — `BoxShape = BoxGeneratedOperations &
  BoxStreamingOperations`, then `Box extends Context.Service<Box,
  BoxShape>()` (`packages/drivers/box/src/Box.service.ts:37,115`).
- `ScopedVectorizer` — the isolated-instance port passed to
  `WinkVectorizerShape.withFreshInstance` (`packages/drivers/wink/src/WinkVectorizer.service.ts:71-92`);
  `WinkVectorizerShape` itself isn't exported, so this is the only exported
  symbol carrying the port shape.
- `FileProcessingEngineShape` — plugin/strategy port; concrete engines are
  stored in `ReadonlyArray<FileProcessingEngineShape>` and selected by
  `detect`/`extract`/`exportArchive` (`packages/foundation/capability/file-processing/src/Service/index.ts:58-65`,
  consumers at `test.ts:130` and elsewhere).
- `Glob` — one-method port, `Context.Service` tag confirmed a few lines below
  the interface (`packages/foundation/modeling/utils/src/Glob.ts:221`).
- `ApiTransport` — 100% behavioral (`rateLimit: Effect.Effect<...>`,
  `transformClient: (client) => HttpClient`), no data fields at all
  (`packages/foundation/capability/api-transport/src/Transport.ts:226-229`).
- `AcpPatchedProtocol`, `ProfessionalRuntimeSdk`, `WorkItemClientTransport` —
  same "Shape/Sdk/Transport"-named, all-behavioral port pattern (spot-checked,
  not exhaustively read line-by-line).

**Detector ruling (the actual P2 ask for this sub-class):** fence 1 says these
stay interfaces; today's detector tracks them as *tolerated exceptions*
instead of recognizing them as *out of scope*, so `schema-first.inventory.jsonc`
can never legitimately reach `entries: []` while any service exists. Spec for
`detectInterfaceReason`/`detectTypeAliasReason`
(`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts:755-781`): add an
`isServiceContractShape(node, sourceFile)` check that runs **before** the
non-schema-signal check and, if true, emits **no inventory entry at all**
(not even as an exception) — mirroring how crispening's own fence-1 language
reads ("crispening does not schema-ify service contracts"). Positive signals,
any one sufficient:
1. Same-file `Context.Service<Tag, X>()` where `X` is this declaration,
   resolved through at most one local type-alias intersection (`type XShape =
   A & B`) — covers the 55 direct hits and `BoxStreamingOperations`.
2. The declaration is used as a parameter type of a method belonging to
   another interface/type-literal that itself satisfies (1) in the same file
   — covers `ScopedVectorizer`.
3. The file matches `*.ports.ts` (documented role,
   `standards/ARCHITECTURE.md:990`) — every exported interface/type-literal
   in such a file is a port by definition.
4. The declaration is the element type of a `ReadonlyArray<X>`/array literal
   whose elements are iterated and have an Effect/Stream-returning member
   invoked — "interchangeable capability provider" registry — covers
   `FileProcessingEngineShape` and (out of sample but same pattern)
   `SyncDataTarget`.

Fixture pair required by fence 11: still-fires case = a function-member
interface with **no** `Context.Service`/`.ports.ts`/registry link anywhere in
its file (synthesize one if none exists in current residue); newly-excluded
case = `UsageRecordSinkShape` (or a trimmed copy) must disappear from the
inventory once rule (1) lands.

**Open question for the driver:** rule (1)/(2)/(4) are AST-checkable now;
rule (3) is a path check. None of these need semantic type resolution beyond
what ts-morph already exposes, so this is a same-tier detector change to the
existing file, not a rewrite.

### runtime-handles (16) — evidence, no detector change proposed

These wrap a literal native/vendor runtime object, matching the SPEC's own
example list ("sockets, processes, AST nodes") almost verbatim. Leave tracked
as exceptions; disposition `unconvertible`, evidence per entry:

- `ChalkInstance` (×2 files) — call-signature interface mirroring the
  `chalk` npm package's own callable-instance type
  (`packages/foundation/capability/chalk/src/Chalk.ts:87-89`).
- `WinkEngineRuntimeState` — `nlp: WinkMethods`, a loaded native wink-nlp
  instance (`packages/drivers/wink/src/Wink.service.ts:137-141`, `WinkMethods`
  is explicitly in `NON_SCHEMA_SIGNAL_PATTERN`).
- `StoredResult` — pure data on its face (`hits, key, result, timestamp`) but
  `result: AnyOperationResult = OperationResult<unknown, unknown>` carries
  `originalGraph: unknown` and `newNodes: ReadonlyArray<GraphNode<B>>`, and
  `GraphNode` wraps an effect `Graph.DirectedGraph` — fence 6 ("No
  Graph/MutableHash* schema-ification") makes this transitively unconvertible
  (`packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/{ResultStore.ts:114-119,Types.ts:716-724}`).
- `KnowledgeGraphHandle` — React `forwardRef` imperative handle
  (`exportAsPNG`/`exportAsSVG`/`resetZoom`), a UI ref handle, not Effect data
  (`packages/foundation/ui-system/ui/src/components/knowledge-graph.tsx:103-110,177`).
- `OipWebRuntimeSecrets` — fields typed `pulumi.Input<string> | undefined`;
  Pulumi's `Input<T>` is itself `T | Promise<T> | Output<T>`, a deferred
  IaC-engine wrapper (`infra/src/OipWeb.ts:315-318`).
- `XAiWebSocketSession` — live WebSocket session object
  (`session.sendJson(...)`) (`packages/drivers/xai/src/XAi.service.ts:140`).
- `DrizzleClient`, `DuckDbClient` — live DB connection/transaction handles
  (`use: (transaction) => Effect<...>` over a native driver connection);
  `DuckDbClient` even schema-`declare`s predicate guards per method already
  (`packages/drivers/duckdb/src/DuckDb.service.ts:168-174`) — as much
  schema-first as a live connection handle can get.
- `LoadedFaceDetector` — wraps a loaded ONNX Runtime inference session
  (`packages/drivers/face-detection/src/FaceDetection.service.ts:751-752`).
- `FirecrawlSdkClient`, `FirecrawlSdkWatcher` — mirror the Firecrawl SDK's own
  client + event-emitter (`on`/`off`) surface
  (`packages/drivers/firecrawl/src/Firecrawl.service.ts:50-53,73`).
- `TsMorphMutationAdapter` — ts-morph AST mutation adapter, literally the
  "AST nodes" example from the SPEC
  (`packages/tooling/tool/cli/src/commands/CreatePackage/TsMorphIntegrationService.ts:231`).
- `PgliteTestcontainerResource` — live Testcontainer/Docker resource handle
  (matches `StartedTestContainer` in `NON_SCHEMA_SIGNAL_PATTERN`)
  (`packages/tooling/test-kit/test-utils/src/SqlTest.ts:643`).
- `SqlTestHooks` — generic (`<MigrateError, SeedError>`) test lifecycle
  callback hooks, no data to extract (`SqlTest.ts:515`).
- `SendHandlerBox` — `{ run: (state) => boolean | void }`, a boxed callback
  with zero data fields; the box pattern exists specifically to hold a
  function reference for reactivity state
  (`packages/foundation/ui-system/editor/src/chat/atoms.ts:440-442`).
- `AcpTerminal`, `MakeTerminalOptions` — live remote-terminal-process handles
  (`kill`/`output`/`release`/`waitForExit` over an ACP session) — the
  "processes" example from the SPEC, verbatim
  (`packages/drivers/acp/src/AcpTerminal.models.ts:26-45,61-68`).

### ui-component-contracts (2, folds into service-contracts ruling)

`ChatComposerProps` and `UploadBoxRenderProps` are React component Props
interfaces, not Effect service ports, but play the same structural role fence
1 protects: framework-mandated contracts carrying event-handler callbacks
(`onNodeClick`, `open: () => void`) and framework types (`children?:
ReactNode`) that are inherently non-serializable. Recommend the detector
ruling above add a 5th positive signal: "the file is `*.tsx` and the
declaration's name matches `*Props`/`*RenderProps` or is the second type
argument to `forwardRef<Handle, Props>`" — same disposition as
service-contracts (out of scope, not tracked). Not attempted as a real
edit (no data payload worth modeling once callbacks/`ReactNode` are
excluded — same reasoning as `ExportedTool` below).

## Real conversion attempts (sub-class (b), incidental-function-member)

All three compiled (`npx tsc -b --noEmit`, filtering the pre-existing,
unrelated `TS6310` project-reference noise present on every package in this
repo) and, where a test file existed, all tests passed. All edits were
reverted after verification per the audit's concurrency rules — see below.

### 1. `SyncDataFetchedSource` — fixed (pure data, false-positive-adjacent)

`packages/tooling/tool/cli/src/commands/SyncDataToTs/internal/Source.ts:55-61`.
Zero function members. Flagged only because `bytes: Uint8Array` matches
`NON_SCHEMA_SIGNAL_PATTERN`'s `\bUint8Array\b` clause — but Effect v4 Schema
has a native `S.Uint8Array` (`.repos/effect-v4/packages/effect/src/Schema.ts:11759-11791`,
base64 JSON encoding by default). Converted the interface to `S.Class` with
`bytes: S.Uint8Array`; updated `fetchSource`'s return to
`SyncDataFetchedSource.make({...})`. Only consumer is the same file (`id`,
`url`, `sha256`, `text` field reads plus 3 `dual`-wrapped parse helpers) — no
ripple. `npx tsc -b --noEmit` clean.

**Secondary finding (evidence for a possible separate detector fix, not
executed here — outside this cluster's scope):** `NON_SCHEMA_SIGNAL_PATTERN`'s
blanket `\bUint8Array\b` match is over-broad; it should not fire when Effect
Schema has a native equivalent. Flagging for the driver, not attempting the
detector edit (fence 11: detector changes never mix with code fixes in one
commit, and this is a single-clause narrowing decision the driver should make,
not a lane).

### 2. `ProjectWithinBudgetOptions` — fixed (un-bundled, interface eliminated)

`packages/foundation/capability/mcp-kit/src/FieldTier.ts:310-313`. One data
field (`budgetBytes: NonNegativeInt`) plus one callback
(`mintFetchableHandle`). Rather than wrap the callback in a named type alias
(which would just relocate the same signal to a different exception reason
and, worse, gives the *appearance* of a fix without one — rejected that path
deliberately, see below), un-bundled the options object into two positional
parameters on `projectWithinBudget`, deleting the interface entirely. Only
consumer outside the file was `packages/foundation/capability/mcp-kit/test/FieldTier.test.ts`
(2 call sites) — updated both. `npx tsc -b --noEmit` clean; `npx vitest run
test/FieldTier.test.ts` → 7/7 passed.

**Rejected alternative, kept as evidence:** first attempt introduced `export
type MintFetchableHandle = (oversized) => FetchableHandle` and referenced it
by name from the interface member. This is a genuine detector *false
negative*, not a fix: `detectTypeAliasReason`'s non-schema check is purely
textual on the member's type-annotation text
(`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts:740-753`), so
hiding the function type behind an alias identifier makes the textual
`=>`/`Effect.Effect<` match disappear without changing that the member is
still a function. Fence 13 ("never weaken a detector... to make a finding
pass") applies to this kind of indirection even though no detector file was
touched — reverted that approach and un-bundled instead.

### 3. `ExportedTool` — partially fixed (data extracted; port member honestly retained)

`packages/foundation/capability/nlp-processing/src/Tools/ToolExport.ts:174-183`
(descriptor: `description`, `name`, `parameterNames`, `parametersJsonSchema:
object`, `returnsJsonSchema: object`, `timeoutMs`, `usageExamples`) plus one
function member `handle`. Its own doc comment frames it as "the descriptor...
and an Effectful handle function" — a per-tool command-object/port, same
family as `FileProcessingEngineShape`. Extracted the seven data fields into a
new `ExportedToolDescriptor extends S.Class` (using `UnknownRecord` from
`@beep/schema` for the two JSON-Schema-document fields), and left `ExportedTool`
as `{ descriptor: ExportedToolDescriptor; handle: (args) => Effect.Effect<...> }`
— the function type is written inline (not hidden behind an alias, for the
same fence-13 reason as above), so it is honestly still flagged. Net effect:
**zero reduction in the S2 count for this symbol** (still one exception), but
a genuine crispening improvement — `parametersJsonSchema`/`returnsJsonSchema`
went from untyped `object` to a real, decode/encode/equivalence-checked
schema. Updated `buildExportedTool`'s construction plus 3 doc-comment
examples that referenced the old flat shape (`tool.name` →
`tool.descriptor.name`) in `ToolExport.ts`, `Tools/index.ts` (same package),
and `packages/drivers/wink/src/WinkTools.service.ts` (a doc-comment-only
cross-package reference — grepped for real runtime consumers first;
`wink`'s own tests (`ToolValidation.test.ts`, `ParityTools.test.ts`) call
`toolkit.handle(...)`, an unrelated method on a different type, confirmed by
grep, not `ExportedTool`). `npx tsc -b --noEmit` clean on
`nlp-processing`, `drivers/wink`, and `repo-cli`; `npx vitest run test/` on
`nlp-processing` → 68/68 passed.

This is the representative negative result the mission asked for: a
descriptor+handler pairing that *looks* like sub-class (b) is often actually
a service/tool-port in miniature once you check whether the "incidental"
function is load-bearing for callers. Splitting the pairing further (e.g.
returning `{ descriptors: [...], handlers: Record<name, handle> }` to drop
the interface to zero) is achievable in principle (a `Record<K, V>`-typed
inline return isn't scanned by this detector at all — only
`InterfaceDeclaration`/`TypeAliasDeclaration` nodes are), but was not
attempted: it changes the public return shape of a documented adapter
consumed across a package boundary and belongs in a real P4 wave with a
proper consumer sweep, not this audit.

## Files touched (all reverted via `git checkout --` after verification)

- `packages/tooling/tool/cli/src/commands/SyncDataToTs/internal/Source.ts` — reverted
- `packages/foundation/capability/mcp-kit/src/FieldTier.ts` — reverted
- `packages/foundation/capability/mcp-kit/test/FieldTier.test.ts` — reverted
- `packages/foundation/capability/nlp-processing/src/Tools/ToolExport.ts` — reverted
- `packages/foundation/capability/nlp-processing/src/Tools/index.ts` — reverted
- `packages/drivers/wink/src/WinkTools.service.ts` — reverted

No `standards/*.jsonc` file was touched. No commits were made.
