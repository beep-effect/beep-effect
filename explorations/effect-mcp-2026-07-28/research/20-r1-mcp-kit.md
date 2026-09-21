# Lane 20-r1-mcp-kit — `@beep/mcp-kit` under Effect MCP `a7a71921de` / `McpProtocol.v2026_07_28`

Lane owns kit call sites, overlap with new upstream behavior, and the kit's test and
documentation surface. `McpRequestContext` field semantics belong to 11-u2; governance
invariants to 22-r3; in-repo host `layerStdio`/`layerHttp` protocol lists to 21-r2.

Diff base is Effect tag `effect@4.0.0-rc.115` (what beep-effect pins today:
`repo:package.json:161`). Snapshot is Effect main `a7a71921de`. Working assumption G4
(`McpProtocol.v2026_07_28` only on every in-repo server) is treated as a hypothesis and
challenged where the Effect source contradicts it.

## 1. Kit anatomy

`@beep/mcp-kit` is a `foundation/capability` package (`repo:packages/foundation/capability/mcp-kit/package.json:2-16`)
whose barrel (`repo:packages/foundation/capability/mcp-kit/src/index.ts:1-88`) re-exports
ten modules. README still advertises seven deliverables and pins `effect@4.0.0-beta.92` /
MCP `2025-06-18` (`repo:packages/foundation/capability/mcp-kit/README.md:5-7`) — already
stale versus the live catalog pin `4.0.0-rc.115`.

Live consumers of `sanitizedToolkit` (the only kit construct that forks Effect MCP
registration): `nlp-mcp`, `m365-mcp`, `uspto-mcp`, `gov-legal-mcp`,
`law-practice/server`, and `apps/professional-desktop/server/OntologyMcpTransport.ts`.
Those hosts currently pass `protocols: [McpProtocol.v2025_06_18]` (host lists belong to
21-r2; cited only to show the kit still sits on a session-era protocol).

| Module | Purpose | Public exports | Effect MCP APIs it depends on |
| --- | --- | --- | --- |
| `SanitizedSpan` | Drop-in for `McpServer.toolkit` that (1) wraps dispatch in a span that drops the `parameters` attribute, (2) mints `CurrentMcpCaller` from `McpServerClient` + `mcp-session-id`, (3) patches wire `inputSchema` so MCP `ToolJson` sees `type: "object"`, (4) maps handler results onto `CallToolResult` with a kit-specific `isError` rule. | `defaultSanitizedSpanKeys`, `sanitizeTracerAttributes`, `withSanitizedToolSpan`, `withTopLevelObjectInputSchemaForTesting`, `sanitizedToolkit` | `McpSchema.{CallToolResult, McpServerClient, Tool as WireTool}`, `McpServer.{McpServer, addTool, toolkit-equivalent layer}`, `Tool.{Any, Meta, Title, Readonly, Destructive, Idempotent, OpenWorld, getDescription, getJsonSchema, HandlersFor, HandlerServices}`, `Toolkit.Toolkit`, `HttpServerRequest` |
| `McpCaller` | Request-local caller identity. Documents `clientId` as per-exchange and `sessionId` as the `mcp-session-id` header minted at `initialize`. | `McpCallerIdentity`, `CurrentMcpCaller` | None directly. Populated only by `SanitizedSpan` from `McpServerClient.clientId` + HTTP `mcp-session-id`. |
| `TierGate` | Fail-closed `tools/call` wrapper. `EnabledWhen` is documented as list-visibility only. | `TierGateSettlement`, `TierGateOutcome`, `TierGateAuditRecord`, `TierGateVerdict`, `ToolCallRequest`, `TierGateShape`, `TierGate`, `TierGatePolicy`, `fromApprovedToolsPolicy`, `TierGateDispatchResult`, `dispatchWithTierGate`, `withEnabledWhenApprovedTool` | `McpSchema.EnabledWhen`; `Tool.{Any, Destructive, Readonly}` |
| `ApiKeyRequired` | Typed `failureMode: "return"` envelope for soft/none-gated tools whose credential is missing at call time. Designed so `isError` stays `false` on the wire. | `ApiKeyRequiredFailure`, `apiKeyRequiredFailure` | None imported. Contract depends on `Tool.make(..., { failure, failureMode: "return" })` and on `sanitizedToolkit`'s `isError` special-case. |
| `FieldTier` | Progressive-disclosure projector (`minimal`/`balanced`/`complete`), null-stripping, columnar reshape, fetchable-handle escape. | `FieldTierName`, `FieldTierSet`, `defineFieldTiers`, `stripNulls`, `projectFieldTier`, `estimateJsonSize`, `OversizedFieldProjection`, `FetchableHandle`, `FieldProjectionOutcome`, `projectWithinBudget`, `ColumnarEnvelope`, `toColumnarEnvelope` | None. |
| `ToolkitComposition` | Composition-time fold: `hard` vanishes when the env key is absent; `none`/`soft` always mount. | `GatedLayer`, `gatedLayer`, `composeGatedLayers` | None. Consumers typically pass a `sanitizedToolkit(...)` (or `McpServer.toolkit(...)`) layer as `GatedLayer.layer`. |
| `ToolAnnotations` | One-call applicator for the four MCP tool-behavior hints. | `FourHintAnnotations`, `AnnotatedTool`, `annotateFourHints`, `readOnlyToolHints`, `destructiveWriteToolHints` | `Tool.{Any, Readonly, Destructive, Idempotent, OpenWorld, annotate}` |
| `SourceAuth` | Schema-first `{name, envVar, gate, signupUrl}` registry plus `Config.Redacted(envVar).pipe(Config.option)` resolution. | `SourceAuthGate`, `SourceAuthRegistration`, `resolveSourceCredential`, `SourceAuthDecision`, `decideSourceAuthMount` | None. |
| `Version` | Package version constant. | `VERSION` (`"0.0.0"`) | None. |
| `index` | Curated barrel. JSDoc still says "seven kit deliverables" and does not name `McpCaller`. | Re-exports all of the above plus `VERSION` | Indirect, via re-exports. |

Evidence for the MCP-touching modules:

- `SanitizedSpan` imports and the `sanitizedToolkit` signature that excludes `McpServerClient`:
  `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:33-40`, `:262-270`, `:410-413`.
- Session header constant and `Effect.serviceOption(McpServerClient)` mint:
  `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:199-202`, `:302-322`.
- `McpCallerIdentity` session-era gotcha: `repo:packages/foundation/capability/mcp-kit/src/McpCaller.ts:19-28`.
- `TierGate` `EnabledWhen` caveat and `withEnabledWhenApprovedTool`:
  `repo:packages/foundation/capability/mcp-kit/src/TierGate.ts:1-18`, `:613-644`.
- `ApiKeyRequired` `failureMode: "return"` contract:
  `repo:packages/foundation/capability/mcp-kit/src/ApiKeyRequired.ts:1-13`, `:41-44`.
- `ToolAnnotations` hint mapping:
  `repo:packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts:1-8`, `:120-134`.

Effect APIs those modules bind to at the snapshot:

- `McpServer.toolkit` now excludes `McpRequestContext`, not `McpServerClient`:
  `effect:packages/effect/src/unstable/ai/McpServer.ts:1939-1948`.
- `addTool.handle` R is `McpRequestContext`:
  `effect:packages/effect/src/unstable/ai/McpServer.ts:211-220`.
- `callTool` R is still `McpServerClient`:
  `effect:packages/effect/src/unstable/ai/McpServer.ts:222-224`.
- `McpServerClient.protocolVersion` is `StatefulProtocolVersion`:
  `effect:packages/effect/src/unstable/ai/McpSchema.ts:2848-2860`.
- `StatefulProtocolVersion = Exclude<ProtocolVersion, "2026-07-28">`:
  `effect:packages/effect/src/unstable/ai/McpProtocol.ts:25-33`.
- `McpRequestContext` is the protocol-neutral replacement and "does not imply an initialized session":
  `effect:packages/effect/src/unstable/ai/McpSchema.ts:2813-2835`.
- Four hint annotations still exist on `Tool` and are still copied onto the wire tool by
  `registerToolkit`: `effect:packages/effect/src/unstable/ai/McpServer.ts:1872-1880`.
- `EnabledWhen` still exists: `effect:packages/effect/src/unstable/ai/McpSchema.ts:3205-3221`.
- `Tool.getJsonSchema` still exists: `effect:packages/effect/src/unstable/ai/Tool.ts:1669-1676`.
- `failureMode: "return"` still exists on `Tool`: `effect:packages/effect/src/unstable/ai/Tool.ts:203`.
- `Toolkit.handle` still annotates `{ tool, parameters }` onto the current span:
  `effect:packages/effect/src/unstable/ai/Toolkit.ts:336-339` (kit comments still cite
  `Toolkit.ts:263-265`; even rc.115 had already moved that to ~273).

Modules with **no Effect MCP import** (`SourceAuth`, `FieldTier`, `ToolkitComposition`,
`Version`) do not break at the snapshot by themselves. They still inherit any break in
`sanitizedToolkit` / `McpServer.toolkit` / `McpServerClient` through tests and host
layers that compose them.

## 2. Break table

Compile risk at the snapshot is concentrated in `SanitizedSpan` (a fork of
`registerToolkit`) and in every `McpServerClient.of` fixture. Runtime risk under a
`v2026_07_28`-only server is concentrated in caller identity and session-header
semantics. Several of those contradict working assumption G4.

| Module | Construct | Why it breaks at the snapshot and/or under a 2026-07-28-only server | Evidence |
| --- | --- | --- | --- |
| `SanitizedSpan` | `Exclude<..., McpServerClient>` on `registerSanitizedToolkit` / `sanitizedToolkit` | Snapshot `registerToolkit` / `toolkit` exclude `McpRequestContext`, not `McpServerClient`. Kit is no longer a type-level drop-in for `McpServer.toolkit`. Handlers that need the request-local client now see `McpRequestContext`; `McpServerClient` is only present for stateful (pre-2026-07-28) invocations. | Kit: `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:266-270`, `:410-413`. rc.115: `Exclude<..., McpServerClient>` (`effect` tag `effect@4.0.0-rc.115` `McpServer.ts` `registerToolkit` / `toolkit`). Snapshot: `effect:packages/effect/src/unstable/ai/McpServer.ts:1789-1802`, `:1939-1948`. |
| `SanitizedSpan` | `addTool` `handle` requirement | Snapshot `addTool.handle` is `Effect<..., McpRequestContext>`. Kit handlers still `yield* Effect.serviceOption(McpServerClient)`. Typechecks only because `serviceOption` does not require the service; on the 2026-07-28 transport path the option is always `None` (see next rows). | `effect:packages/effect/src/unstable/ai/McpServer.ts:211-220`. Kit: `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:302-303`. |
| `SanitizedSpan` | `Effect.serviceOption(McpServerClient)` → `CurrentMcpCaller` | 2026-07-28 `tools/call` builds `McpInvocation` via `invocationFromRequestContext`, which **does not set `serverClient`**. `provideInvocationContext` then skips `McpServerClient`. Kit therefore never mints `CurrentMcpCaller` on the production 2026-07-28 path. Direct `server.callTool` tests still provide a stub, so they will not catch this. | Snapshot invocation: `effect:packages/effect/src/unstable/ai/internal/mcpProtocol.ts:89-100` (no `serverClient`). Provide: `effect:packages/effect/src/unstable/ai/McpServer.ts:164-186`. 2026-07-28 adapter: `effect:packages/effect/src/unstable/ai/internal/mcpProtocol/v2026_07_28.ts:330-345`, `:589-629`. Kit mint: `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:302-322`. |
| `SanitizedSpan` / `McpCaller` | `mcp-session-id` header read | Kit copies a header it documents as "upstream keeps private" and treats as the only stable per-session key, minted at `initialize`. Snapshot still mints that header **only on the stateful HTTP initialize path**. `v2026_07_28` is `StatelessRuntimeDescriptor`: no initialize, no protocol-level sessions. A 2026-07-28-only runtime never takes the `stateful.registerHttp` branch, so the header is not issued. Kit `sessionId` is then always `None` in production, matching today's stdio behavior but contradicting the HTTP session-era tests and JSDoc. | Kit: `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:199-202`, `:313-316`; `repo:packages/foundation/capability/mcp-kit/src/McpCaller.ts:21-28`. Snapshot mint: `effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:501-511`. Stateless type: `effect:packages/effect/src/unstable/ai/McpProtocol.ts:196`. Stateful comment: `effect:packages/effect/src/unstable/ai/internal/mcpStatefulRuntime.ts:1-3`. |
| `McpCaller` | `McpCallerIdentity.clientId` sourced from `McpServerClient` | `McpRequestContext.clientId` is the protocol-neutral field (11-u2). Kit never reads it. Under G4 the kit identity is empty on every real dispatch. | Kit: `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:317-322`. Replacement: `effect:packages/effect/src/unstable/ai/McpSchema.ts:2824-2826`. |
| `SanitizedSpan` | `McpServerClient.protocolVersion: StatefulProtocolVersion` | rc.115 `McpServerClient.protocolVersion` was `ProtocolVersion` (includes every dated revision). Snapshot narrows it to `StatefulProtocolVersion`, which **excludes `"2026-07-28"`**. Existing stubs pin `"2025-06-18"` and still typecheck. A stub that tried `protocolVersion: "2026-07-28"` would not. Combined with `callTool`'s remaining `McpServerClient` requirement, **there is no typed way to drive `server.callTool` as a 2026-07-28 client.** | rc.115: `McpSchema.ts` `McpServerClient` `protocolVersion: ProtocolVersion`. Snapshot: `effect:packages/effect/src/unstable/ai/McpSchema.ts:2848-2850`; `effect:packages/effect/src/unstable/ai/McpProtocol.ts:33`. `callTool`: `effect:packages/effect/src/unstable/ai/McpServer.ts:222-224`, `:445-450`. |
| Kit + hosts | Every `McpServerClient.of` / `makeStubMcpClient` fixture | All six production-shaped stubs share the same shape: `protocolVersion: "2025-06-18"`, `initializePayload.protocolVersion: "2025-06-18" as never`, `getClient: Effect.die(...) as never`. Optional snapshot field `requestMetadata` is omitted (safe). The `as never` casts remain load-bearing. Under G4 these fixtures cannot represent the production protocol. | `repo:packages/foundation/capability/mcp-kit/test/fixtures/McpClient.ts:21-33`, `:41`. `repo:packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts:120`. `repo:packages/drivers/nlp-mcp/test/SanitizedSpan.test.ts:47-58`. `repo:packages/drivers/m365-mcp/test/SanitizedSpan.test.ts:75-89`. `repo:packages/drivers/uspto-mcp/test/Server.test.ts:105-119`. `repo:packages/drivers/gov-legal-mcp/test/Server.test.ts:193-207`. `repo:packages/law-practice/server/test/PracticeKg.projections.test.ts:428-439`. |
| `SanitizedSpan` | No-arg / `$ref` `inputSchema` patch (`isNonNullWildcard`, `withTopLevelObjectInputSchema`) | `McpSchema.ToolJson` **still** requires a top-level `type: "object"` (`effect:packages/effect/src/unstable/ai/McpSchema.ts:1565-1584`). Snapshot `registerToolkit` no longer feeds `Tool.getJsonSchema(tool)` straight into `ToolJson`; it runs `toolInputJsonSchema`, which **inlines** a top-level `$ref` via `InternalStructuredOutput.resolveTopLevelReference` (`effect:packages/effect/src/unstable/ai/McpServer.ts:1923-1931`, `effect:packages/effect/src/unstable/ai/internal/structured-output.ts:34-41`). Kit still patches by *adding* `type: "object"` beside the `$ref`. If the snapshot inlined schema is already `{ type: "object", ... }`, the kit patch is redundant. If an empty `S.Class` still encodes as `{ not: { type: "null" } }` or `anyOf: [object, array]` with no `type`, `ToolJson` decode in snapshot `registerToolkit` would `Effect.orDie` without an equivalent patch. Exact empty-class JSON Schema at `a7a71921de` is **UNVERIFIED** (would require running schema generation; this lane does not run builds). Kit tests currently assert `inputSchema.type === "object"` for both `ref_tool` and `empty_params_tool`. | Kit: `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:223-240`, `:281`. Tests: `repo:packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts:48-55`, `:269-296`. Snapshot ToolJson + inliner as cited. |
| `SanitizedSpan` | `built.handle(tool.name, payload)` two-arg call | Snapshot `Toolkit.handle` gained optional `toolCallId` and `ParseOptions` (`effect:packages/effect/src/unstable/ai/Toolkit.ts:205-218`). Two-arg calls still typecheck. Snapshot `registerToolkit` passes `payload ?? {}`, `undefined`, and `decodeOptions` from `Tool.getStrictMode` (`effect:packages/effect/src/unstable/ai/McpServer.ts:1828-1835`, `:1888`). Kit does not, so a `strict: true` tool registered through `sanitizedToolkit` would not get `onExcessProperty: "error"`. Not a compile break; it is a semantic fork. | As cited. |
| `SanitizedSpan` | `Stream.run(Sink.last())` | Snapshot `registerToolkit` uses `Stream.runLast` (`effect:packages/effect/src/unstable/ai/McpServer.ts:1890`; `effect:packages/effect/src/Stream.ts:10964`). Kit still uses `Stream.run(Sink.last())` (`repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:325-326`). Orchestrator spike reported repo-wide `check` green after two unrelated fixes, so this is **unlikely** to be a compile break. It is fork drift. | As cited. |
| `SanitizedSpan` | Result mapping (`isError`, `structuredContent`, param errors) | rc.115 `registerToolkit` mapped a successful `handle` to `isError: false` always. Kit maps `isError: result.isFailure && !isApiKeyRequiredFailure(result.result)` and keeps `structuredContent` on failures. Snapshot maps `isError: result.isFailure`, **drops `structuredContent` on failure**, classifies `failureOrigin === "parameters"` as `InvalidParams`, and uses `INTERNAL_TOOL_ERROR_MESSAGE` for undeclared failures. Switching hosts from `sanitizedToolkit` to `McpServer.toolkit` would flip `api_key_required` to `isError: true` with no structured content, and would turn the kit's `{ secret: 1 }` boundary test from a `CallToolResult` into `InvalidParams`. Keeping the fork without copying `handleCause` / `FailureOrigin` leaves kit behavior frozen on the rc.115-era mapping. | rc.115 `registerToolkit` `isError: false` block (tag `McpServer.ts`). Kit: `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:330-351`. Snapshot: `effect:packages/effect/src/unstable/ai/McpServer.ts:1772-1778`, `:1847-1908`. Tests: `repo:packages/foundation/capability/mcp-kit/test/ApiKeyRequired.test.ts:88-93`; `repo:packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts:189-216`. |
| `SanitizedSpan` | No `outputSchema` on the wire tool | Snapshot always decodes `Tool.getJsonSchemaFromSchema(tool.successSchema)` as `ToolOutputJson` and sets `outputSchema` (`effect:packages/effect/src/unstable/ai/McpServer.ts:1861-1871`). Kit's `WireTool.make({...})` never sets it (`repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:276-294`). Not a compile break. Tools registered through the kit advertise no output schema; tools registered through `McpServer.toolkit` do. | As cited. |
| `SanitizedSpan` | `omitRequestServices` not mirrored | Snapshot strips `McpRequestContext`, `McpServerClient`, `HttpServerRequest`, and `CurrentLogLevel` from the captured handler context so request-time services win (`effect:packages/effect/src/unstable/ai/McpServer.ts:156-162`, `:1803-1814`). Kit captures the full build-time context and `provideContext`s it, relying on merge-wins (`repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:271`, `:317-328`). Kit reads `HttpServerRequest` *before* that provide, so the session-header read is safe today. After the provide, a handler that itself `yield*`s `HttpServerRequest` could see a build-time request (usually absent). Under 2026-07-28 the more important miss is still `McpRequestContext`. | As cited. |
| `ApiKeyRequired` | `failureMode: "return"` + kit `isError: false` special-case | `failureMode: "return"` still exists. Upstream no longer treats returned failures as `isError: false`. The envelope's "model sees a structured non-error" property is **kit-only** and is tested as such. Adopting upstream `registerToolkit` without a replacement special-case is a semantic break, not a type break. | Kit contract: `repo:packages/foundation/capability/mcp-kit/src/ApiKeyRequired.ts:1-13`. Snapshot `isError: result.isFailure`: `effect:packages/effect/src/unstable/ai/McpServer.ts:1900-1904`. Test: `repo:packages/foundation/capability/mcp-kit/test/ApiKeyRequired.test.ts:88-93`. |
| `TierGate` | Comments citing `filterByClient` / `McpServer.ts:255-262` | Snapshot has no `filterByClient` symbol. Visibility is `isVisible` on `internalCore.tools.register`, still driven by `EnabledWhen` (`effect:packages/effect/src/unstable/ai/McpServer.ts:401-414`). Behavior (list filter, not `tools/call` enforcement) looks intact. Stale line numbers in kit docs are a documentation break, not a runtime one. `withEnabledWhenApprovedTool` still annotates `McpSchema.EnabledWhen`. | Kit: `repo:packages/foundation/capability/mcp-kit/src/TierGate.ts:1-18`, `:635-644`. Snapshot register as cited. `EnabledWhen`: `effect:packages/effect/src/unstable/ai/McpSchema.ts:3212-3221`. |
| `ToolAnnotations` | `annotateFourHints` | Snapshot `registerToolkit` still copies the same four `Context` tags onto `annotations.*Hint` (`effect:packages/effect/src/unstable/ai/McpServer.ts:1872-1880`). No break found. | Kit: `repo:packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts:120-134`. |
| `ToolkitComposition` | `composeGatedLayers` / test using `McpServer.toolkit` | No MCP type in the module. The composition test mounts via `McpServer.toolkit` (`repo:packages/foundation/capability/mcp-kit/test/ToolkitComposition.test.ts:26-42`) and then `callTool`, so it inherits the `McpServerClient` stub requirement and the new `toolkit` exclusion (`McpRequestContext`). Fixture still supplies `StubMcpClientLayer`. | As cited. |
| `SourceAuth`, `FieldTier`, `Version` | — | No Effect MCP imports. No snapshot break found. | Module sources as in §1. |

### Decision-challenge (G4, `v2026_07_28` only)

A `v2026_07_28`-only server does **not** speak session-era `initialize`. The 2026-07-28
adapter file contains no `initialize` handler (search of
`effect:packages/effect/src/unstable/ai/internal/mcpProtocol/v2026_07_28.ts` returned no
matches). HTTP protocol selection for a runtime with `stateful === undefined`:

- `MCP-Protocol-Version` is required (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:227-229`).
- Request `_meta` must carry `io.modelcontextprotocol/protocolVersion` and
  `io.modelcontextprotocol/clientCapabilities` (`:231-252`).
- `Mcp-Method` must match the JSON-RPC method; `tools/call` also requires `Mcp-Name`
  (`:268-278`).
- Accepted stateless requests return `binding: undefined` (`:280`) — no session id.

A client that sends session-era `initialize` without those headers is rejected (400
header mismatch / missing metadata), not negotiated. That is the Effect-source
contradiction to "flip in-repo servers to `v2026_07_28` only and keep today's
`McpServerClient` / `mcp-session-id` kit identity." Options (operator decides):

1. **Keep G4.** Change kit identity to `McpRequestContext` (11-u2), drop or redefine
   `sessionId`, rewrite every `McpServerClient.of` fixture that is supposed to model
   production, and stop treating `server.callTool` as a 2026-07-28 proof (it cannot
   type a 2026-07-28 client).
2. **Soften G4** for a transition: advertise `[v2026_07_28, v2025_06_18]` (or similar)
   so `McpServerClient` and session headers still exist for session-era clients. This
   contradicts the written G4 assumption.
3. **Keep G4 on hosts but keep kit tests on `callTool` + stateful stubs.** Production
   2026-07-28 identity would be untested; `CurrentMcpCaller` would be `None` in
   production HTTP. That is a silent semantic hole, not a compile failure.

### `McpServerClient` requirement exclusions — summary

| Surface | rc.115 | snapshot `a7a71921de` | kit today |
| --- | --- | --- | --- |
| `McpServer.toolkit` / `registerToolkit` handler-services exclude | `McpServerClient` | `McpRequestContext` | `McpServerClient` |
| `addTool.handle` R | `McpServerClient` | `McpRequestContext` | reads `McpServerClient` optionally |
| `callTool` R | `McpServerClient` | `McpServerClient` (via `invocationFromClient`) | tests provide stub |
| 2026-07-28 transport `tools/call` | n/a (no adapter) | `McpRequestContext` only | would see `serviceOption` = `None` |

## 3. Redundancy table

"Upstream now provides X" means snapshot `registerToolkit` / `layer*` / HTTP runtime,
not rc.115. Kit-only value is what remains if hosts switched to `McpServer.toolkit`
and dropped the fork.

| Behavior | Upstream at snapshot | Kit overlap | Remaining kit-only value |
| --- | --- | --- | --- |
| Server `instructions` | Optional on `run` / `layer` / `layerStdio` / `layerHttp` (`effect:packages/effect/src/unstable/ai/McpServer.ts:1373-1376`, `:1542-1545`). Stateful initialize copies `options.serverInfo.instructions` (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:517`). | None. Kit never calls `layer*` and has no instructions helper. | None. Hosts (21-r2) would gain this by passing the new option. |
| Strict input validation | `Tool.getStrictMode` → `decodeOptions = { onExcessProperty: "error" }` and JSON Schema generated with the same flag (`effect:packages/effect/src/unstable/ai/McpServer.ts:1828-1835`, `:1924-1926`). Dynamic+strict dies (`:1830-1833`). Parameter failures become `InvalidParams` (`:1852-1853`). | Kit does not read `Strict` and does not pass `decodeOptions`. Invalid `{ secret: 1 }` becomes a generic `isError` `CallToolResult` (`repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:331-334`; test `:202-216`). | Kit-only is the **opposite** policy: swallow param errors as tool-level `isError` with a stack-free message. That is remaining value only if operators want to keep that mapping. |
| `isError` projection | `isError: result.isFailure`; `structuredContent` omitted on failure (`effect:packages/effect/src/unstable/ai/McpServer.ts:1900-1904`). Declared handler failures still `isError: true` with encoded failure in `content` (`:1842-1846`, `:1855-1856`). | Kit: `isError: result.isFailure && !isApiKeyRequiredFailure(result.result)` and `structuredContent` kept for object payloads (`repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:345-350`). | **The `api_key_required` non-error envelope.** That is the whole `ApiKeyRequired` product. Upstream does not preserve it. |
| Failure reporting / cause scrubbing | `ErrorReporter.report`, `INTERNAL_TOOL_ERROR_MESSAGE`, `FailureOrigin` classification, interruption vs defect (`effect:packages/effect/src/unstable/ai/McpServer.ts:1772-1825`, `:1847-1859`; `effect:packages/effect/src/unstable/ai/Toolkit.ts:241-255`). | Kit `tapCause(Effect.log)` + one canned string `"Tool call failed before producing a structured result."` (`repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:205`, `:329-334`). | Stack-free boundary text. Weaker than upstream classification. If the fork is kept, copying `handleCause` is the way to gain origin-aware reporting without losing sanitization. |
| Output schemas | Always set from `tool.successSchema` via `ToolOutputJson` (`effect:packages/effect/src/unstable/ai/McpServer.ts:1861-1871`). Outputs may be any JSON Schema root (`effect:packages/effect/src/unstable/ai/McpSchema.ts:1587-1602`). | Kit never sets `outputSchema`. | None — this is a kit **gap**, not a kit feature. |
| Origin / DNS-rebinding checks | `layerHttp({ allowedOrigins })` + `isAllowedMcpOrigin` (`effect:packages/effect/src/unstable/ai/McpServer.ts:1729-1735`, `:1542-1567`). Already present at rc.115. | Kit does not wrap HTTP. `OntologyMcpTransport` already passes `allowedOrigins` (`repo:apps/professional-desktop/server/OntologyMcpTransport.ts:176-186`). | None at kit layer. 24-r5 owns HTTP security. |
| Four MCP hints | `registerToolkit` copies `Readonly`/`Destructive`/`Idempotent`/`OpenWorld` (`effect:packages/effect/src/unstable/ai/McpServer.ts:1872-1880`). | `annotateFourHints` is a caller convenience over `tool.annotate` (`repo:packages/foundation/capability/mcp-kit/src/ToolAnnotations.ts:120-134`). | Terse combinator + presets. Not replaced by snapshot. |
| `EnabledWhen` list filter | Still honored as `isVisible` (`effect:packages/effect/src/unstable/ai/McpServer.ts:401-414`). Still not a `tools/call` gate. | `withEnabledWhenApprovedTool` + `dispatchWithTierGate` (`repo:packages/foundation/capability/mcp-kit/src/TierGate.ts:562-644`). | **The `tools/call` enforcement + audit + `recordOutcome` settlement.** Upstream still does not provide that. 22-r3 owns the governance invariants. |
| Span `parameters` suppression | Snapshot `Toolkit.handle` still `annotateCurrentSpan({ tool, parameters })` (`effect:packages/effect/src/unstable/ai/Toolkit.ts:336-339`). `registerToolkit` still has **no dispatch-wrapping seam** (handle closure is built inside the loop, `:1887-1909`). | `withSanitizedToolSpan` / `sanitizedToolkit` exist specifically because of that (`repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:1-17`, `:374-389`). | **Still the only in-repo fix** for `12-observability.md` §3. Not redundant. Line numbers in kit comments are stale. |
| Top-level `type: "object"` on tool input | Snapshot inlines `$ref` then validates `ToolJson` (`effect:packages/effect/src/unstable/ai/McpServer.ts:1864-1866`, `:1923-1931`). | Kit's `withTopLevelObjectInputSchema`. | Possibly redundant if the inliner always yields `type: "object"`; still needed if empty-class encoding remains a non-object root. UNVERIFIED without running schema generation. |
| Credential-gated composition / field tiers | No upstream equivalent in `McpServer` / `McpSchema` / `Tool` / `Toolkit`. | `SourceAuth`, `ToolkitComposition`, `FieldTier`. | Fully kit-only. |

## 4. Documentation surface

Pins and prose that a rewrite would have to touch:

| Surface | What it currently says | What the snapshot contradicts |
| --- | --- | --- |
| `README.md` | `effect@4.0.0-beta.92` and MCP `2025-06-18` (`repo:packages/foundation/capability/mcp-kit/README.md:5-7`). Usage example calls `McpServer.toolkit`, not `sanitizedToolkit` (`:62-83`). Consumer table still lists `uspto-mcp` as "in progress" even though `uspto-mcp` already imports `sanitizedToolkit`. | Catalog pin is `4.0.0-rc.115` (`repo:package.json:161`); snapshot adds `2026-07-28` and `instructions`. |
| `AGENTS.md` | `McpCaller`: "`sessionId` is the `mcp-session-id` header and the only stable per-session key — `None` for stdio". `SanitizedSpan`: "upstream offers no dispatch-wrapping seam". `sanitizedToolkit` "mirrors `registerToolkit`'s registration loop". | Dispatch-wrap seam still absent (so that sentence survives). Session sentence is session-era and false under G4 HTTP. |
| `SanitizedSpan.ts` module docs | Cites `Toolkit.ts:263-265` and `McpServer.ts:749-758` / `:711`. | Snapshot span annotate is `Toolkit.ts:336-339`; `registerToolkit` starts at `:1789`; `toolkit` at `:1939`. |
| `ApiKeyRequired.ts` module docs | Claims `Toolkit.ts:240-242` folds `"return"` into the success union and `McpServer.ts:717-734` ships it as `CallToolResult({ isError: false, ... })`. | Snapshot ships returned failures as `isError: true` and drops `structuredContent`. |
| `McpCaller.ts` JSDoc | `initialize` mints `mcp-session-id`; HTTP `clientId++` per request. | 2026-07-28 has no initialize and no session header mint. `clientId` on `McpRequestContext` is the live field. |
| `TierGate.ts` module docs | `McpServer.ts:255-262` vs `filterByClient` at `:1490-1512`. | `filterByClient` is gone; `isVisible` is on `addTool` (`:401-414`). |
| Named in-source vitest example | `withSanitizedToolSpan` example fence: `` ```ts import.meta.vitest name="Run under sanitized span" `` (`repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:160-166`). | Behavior (drop `parameters`) still valid because `Toolkit.handle` still annotates that key. |
| `docgen.json` | Standard package docgen; `enforceVersion: true` via inventory, examples/descriptions not enforced (`repo:packages/foundation/capability/mcp-kit/docgen.json`; inventory `repo:standards/jsdoc-documentation.inventory.jsonc:10389-10393`). | No snapshot interaction. A rewrite of examples that mention `McpServer.toolkit` / session ids will re-run doctest. |
| `package.json` description | "span hygiene" + composition; no protocol version. `VERSION` is `"0.0.0"`. | Unchanged. |

JSDoc inventory (`repo:standards/jsdoc-documentation.inventory.jsonc:10379-10423`):

- Package `@beep/mcp-kit`, `status: "needs-remediation"`, `topoOrder: 9`.
- 10 public modules, 64 public exports; 8 open modules, 53 open exports.
- `exampleImportFindings: 75`, of which `no-root-package-import: 75` (examples import `@beep/mcp-kit` / `effect` roots).
- `documentationRuleFindings`: `multiple-description-paragraphs: 8`, `invalid-when-to-use-prefix: 4`.
- `withTopLevelObjectInputSchemaForTesting` is already `remediationStatus: "resolved"` (`:11319-11338`).

Inventory rows a protocol/API rewrite would retouch (examples or summaries that mention
session, `McpServer.toolkit`, `parameters`, or `isError`):

| Anchor / symbol | Why |
| --- | --- |
| `...-sanitizedspan-ts-1-module` | Module prose + Toolkit line cites. |
| `defaultSanitizedSpanKeys`, `sanitizeTracerAttributes`, `withSanitizedToolSpan`, `sanitizedToolkit` (`:11220-11350`) | Examples + "When to use"; `sanitizedToolkit` claims drop-in for `McpServer.toolkit`. |
| `withTopLevelObjectInputSchemaForTesting` | Wildcard `{ not: { type: "null" } }` example; may become dead if the inliner makes the patch redundant. |
| `...-mcpcaller-ts-1-module`, `McpCallerIdentity`, `CurrentMcpCaller` (`:10481`, `:11157`, `:11190`) | Session-era gotcha. |
| `ApiKeyRequiredFailure`, `apiKeyRequiredFailure` (`:10684`, `:10712`) | `isError: false` / `failureMode: "return"` story. |
| `withEnabledWhenApprovedTool` and `TierGate` module (`:10555`, later TierGate exports `:11593-12043`) | Stale `McpServer.ts` line cites. |
| `index.ts` packageDocumentation (`:10655`) | "seven deliverables"; omits `McpCaller`. |

`FieldTier` / `SourceAuth` / `ToolkitComposition` / `Version` inventory rows do not
mention MCP protocol versions; they would move only if example import-path remediation
is in the same PR.

## 5. Test and ratchet surface

### Tests that assert session-era behavior

These fail semantically (and some of them at typecheck) if G4 is taken literally, or if
`sanitizedToolkit` is replaced with snapshot `McpServer.toolkit` without a replacement
fork.

| File | What it asserts | Session-era coupling |
| --- | --- | --- |
| `repo:packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts:218-265` | `caller_tool` reports `session=none` without HTTP; `session=session-under-test` when `mcp-session-id` is provided; empty header → `none`. Uses `withMcpClient` + `withSessionHeader`. | Directly tests the header mint the 2026-07-28 runtime will not issue. Under G4 production these assertions describe a path that no longer exists. |
| `repo:packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts:117-120` | Comment: identity is minted only when `McpServerClient` is in scope. | True for `callTool`; false for 2026-07-28 transport (`McpRequestContext` only). |
| `repo:packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts:189-216` | Typed non-`api_key_required` failure → `isError: true` **and** `structuredContent` decodes; invalid params → canned boundary text, not `InvalidParams`. | Conflicts with snapshot `registerToolkit` (`structuredContent` dropped on failure; param errors are `InvalidParams`). |
| `repo:packages/foundation/capability/mcp-kit/test/SanitizedToolkit.test.ts:269-296` | `$ref` and empty-params tools register with `inputSchema.type === "object"`. | Still a valid MCP `ToolJson` requirement. May pass via snapshot inliner without the kit patch — UNVERIFIED. |
| `repo:packages/foundation/capability/mcp-kit/test/ApiKeyRequired.test.ts:88-93` | Missing credential → `assert.isFalse(result.isError)` and envelope in `content[].text`. | Conflicts with snapshot `isError: result.isFailure`. |
| `repo:packages/foundation/capability/mcp-kit/test/fixtures/McpClient.ts:21-33` | `protocolVersion: "2025-06-18"`. | Cannot name `"2026-07-28"` on `McpServerClient`. |
| Host `SanitizedSpan` tests (`nlp-mcp`, `m365-mcp`) | Same stub shape; prove `parameters` is absent and `tool` is present on a real toolkit via `callTool`. | Span assertion remains valid (Toolkit still annotates `parameters`). Stub protocol version is session-era. `callTool` cannot model 2026-07-28. |
| `uspto-mcp` / `gov-legal-mcp` / `law-practice` `McpServerClient.of` fixtures | Same stub; drive `callTool` through `sanitizedToolkit`. | Same `callTool` / stateful-only seam. |

### Tests that are protocol-agnostic (keep as ratchets)

- `SanitizedSpan.test.ts`: `withSanitizedToolSpan` + `withTopLevelObjectInputSchemaForTesting` unit arms, including the named doctest (`repo:packages/foundation/capability/mcp-kit/test/SanitizedSpan.test.ts`; source example `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:160`).
- `TierGate.test.ts`: `dispatchWithTierGate` / policy / settlement. Uses `Tool.Destructive` / `Tool.Readonly` only.
- `FieldTier.test.ts`, `ToolkitComposition.test.ts` (except the `callTool` + stub layer), `ApiKeyRequired` schema round-trips.

### Coverage obligations

`repo:standards/coverage.regression-baseline.jsonc:15119-15239` (`@beep/mcp-kit`):

| File | lines % | uncovered lines | Note |
| --- | --- | --- | --- |
| package | 92 | 14 | |
| `ApiKeyRequired.ts` | 100 | 0 | |
| `FieldTier.ts` | 100 | 0 | |
| `McpCaller.ts` | 100 | 0 | Identity construction is covered; production 2026-07-28 mint path is **not** a distinct branch today (`serviceOption` none vs some is tested). |
| `SanitizedSpan.ts` | 86.36 | 9 | Hottest file. A rewrite of `registerSanitizedToolkit` will move these lines; ratchet will fail until the new loop is covered. |
| `SourceAuth.ts` | 81.81 | 2 | |
| `TierGate.ts` | 95.12 | 2 | |
| `ToolAnnotations.ts` | 85.71 | 1 | `functions: 0` in the per-file block is the dual combinator's uncovered overload. |
| `ToolkitComposition.ts` | 100 | 0 | |
| `index.ts` | 100 | 0 | |

Any replacement of `sanitizedToolkit` must keep:

1. The span ratchet (no `parameters` attribute, `tool` still present) — still required because upstream still leaks `parameters`.
2. A caller-identity ratchet that matches the **chosen** protocol (today: `McpServerClient` + `mcp-session-id`; under G4: `McpRequestContext`, no session header).
3. The `api_key_required` `isError: false` ratchet **or** an explicit decision to drop that contract.
4. Host proofs at `packages/drivers/{nlp,m365}-mcp/test/SanitizedSpan.test.ts`.

`server.callTool` is a **stateful-only test seam** at the snapshot
(`effect:packages/effect/src/unstable/ai/McpServer.ts:445-450`). It is not a 2026-07-28
proof. A G4-faithful ratchet would have to drive the HTTP/stdio runtime with
`Mcp-Protocol-Version` / `_meta` / `Mcp-Method` / `Mcp-Name` (24-r5 / 21-r2), not
`McpServerClient.of({ protocolVersion: "2025-06-18" })`.

## Options (no decision)

Keeping the `sanitizedToolkit` fork is still justified: snapshot `Toolkit.handle` still
writes raw `parameters` onto the current span, and `registerToolkit` still offers no
wrap hook. The fork has drifted (exclusions, `isError`, output schema, strict mode,
`FailureOrigin`, `omitRequestServices`, `Stream.runLast`). Three shapes:

- **A. Rebase the fork** onto snapshot `registerToolkit` (copy `handleCause`,
  `outputSchema`, `toolInputJsonSchema`, `omitRequestServices`, `decodeOptions`) and
  keep the span wrapper + `api_key_required` `isError` special-case + optional
  `CurrentMcpCaller` mint from `McpRequestContext`. Highest fidelity, largest kit diff.
- **B. Drop the fork** and call `McpServer.toolkit`, wrapping something else for spans.
  **Not currently possible** without an upstream seam or wrapping every host
  `callTool` / transport (already shown not to work at layer-build time;
  `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:374-389`).
- **C. Keep the rc.115-era fork** on the snapshot. Likely typechecks after the
  `McpRequestContext` exclude fix; silently loses output schemas, strict validation,
  origin-aware errors, and 2026-07-28 caller identity.

G4 vs kit identity is independent of A/B/C and is the decision-challenge in §2.

## Grill questions this lane cannot answer

1. Under G4, is `CurrentMcpCaller.sessionId` retired, or is some other stable key
   (request `_meta`, `clientId`, an app-level header) required for
   `GovernedTierGate` / per-session grants? (22-r3 / 11-u2)
2. Must `api_key_required` remain `isError: false` with `structuredContent`, or is
   snapshot `isError: true` + encoded `content` acceptable to in-repo clients?
3. Should invalid tool arguments stay a stack-free `CallToolResult` (kit) or become
   protocol `InvalidParams` (snapshot)?
4. Is `server.callTool` + stateful stubs an acceptable kit test seam after the flip,
   or must kit tests speak 2026-07-28 HTTP headers?
5. Keep `sanitizedToolkit` as a full `registerToolkit` fork (option A) or wait for an
   upstream dispatch-wrap seam (option B, currently unavailable)?

## Gate B verdicts (2026-09-17)

Three grok refuters voted on 11 claims from this lane (11 survive, 0 killed; per-vote detail in `verification/20-r1-mcp-kit.verdicts.jsonl`).

No claim was struck.
