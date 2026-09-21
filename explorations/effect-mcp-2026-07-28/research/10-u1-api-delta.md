# Lane 10-u1-api-delta — Effect MCP public API delta

Public-API before/after for Effect's MCP surface between `effect@4.0.0-rc.115`
(`4a05d4914f`) and `a7a71921de` (upstream `main`, 2026-09-16). Runtime behavior
belongs to 11-u2; kit consequences to 20-r1; documentation to 12-u3.

Working assumptions G1/G4/G6/G9 are treated as operator decisions, not facts.
Where source contradicts them, the claim is tagged `decision-challenge`.

## 1. Method

Read-only git on the Effect clone at `a7a71921de`; beep-effect checkout used only
for consumer-impact citations. Commands:

- `git log --oneline effect@4.0.0-rc.115..a7a71921de -- packages/effect/src/unstable/ai packages/effect/src/unstable/rpc`
- `git log --name-only` over the same range plus `.changeset`, `migration/annotations`, typetests
- `git diff --stat` of `McpServer.ts`, `McpSchema.ts`, `McpProtocol.ts`, `Tool.ts`, `Toolkit.ts`, `RpcServer.ts`, `RpcSerialization.ts`, `McpServer.tst.ts`
- Named-export inventory from `git show <rev>:<path>` on both sides
- `graft grep` for beep-effect `McpProtocol` / `McpServerClient` / `layerStdio` / `Tool.Strict` and Effect `getStrictMode`
- Direct `git show` of option/handler types, changesets, migration YAML, typetests, and MCP tests

Commits in range that touch `packages/effect/src/unstable/ai` or `.../unstable/rpc` (3):

| SHA | Date | Subject |
| --- | --- | --- |
| `a2c4154cf8` | 2026-09-12 | feat: add v2026-07-28 protocol adapter (#7265) |
| `49e4b37b83` | 2026-09-14 | fix(ai): McpServer issues with tool strictness, server instructions and prompt titles (#8228) |
| `553c403f1d` | 2026-09-15 | Fix deferred handover wake-ups and interrupted RPC stream writes (#8235) |

Related but outside those two source trees:

| SHA | Subject | Why it matters to this lane |
| --- | --- | --- |
| `769f6046a2` | Update migration guidance for MCP handlers, tool results, and byte sizes (#8242) | Rewrites `migration/annotations/effect__ai__McpServer.yaml` and `effect__ai__McpSchema.yaml` |

#7265 is the protocol-adapter / runtime rewrite (most of the 1641-line `McpServer.ts`
delta). #8228 is the public-API follow-up (`instructions`, `Tool.Strict` honor,
`Toolkit.handle` ParseOptions, `FailureOrigin`, prompt titles). #8235 touches
`RpcClient.ts` only, not the MCP-called `RpcServer.ts` / `RpcSerialization.ts`
exports.

Diffstat for owned modules (`effect@4.0.0-rc.115..a7a71921de`):

```
 packages/effect/src/unstable/ai/McpProtocol.ts          |  115 +-
 packages/effect/src/unstable/ai/McpSchema.ts            |  303 +++-
 packages/effect/src/unstable/ai/McpServer.ts            | 1641 +++++++++++---------
 packages/effect/src/unstable/ai/Tool.ts                 |   19 +
 packages/effect/src/unstable/ai/Toolkit.ts              |   87 +-
 packages/effect/src/unstable/rpc/RpcSerialization.ts    |    4 +-
 packages/effect/src/unstable/rpc/RpcServer.ts           |   18 +-
 packages/effect/typetest/unstable/ai/McpServer.tst.ts   |   81 +-
 8 files changed, 1410 insertions(+), 858 deletions(-)
```

`packages/effect/typetest/unstable/ai/Tool.tst.ts` is **unchanged** in this range
(empty `git diff --stat`).

MCP-related changesets added in range (all `"effect": patch`):
`modern-mice-discover.md` (#7265), `mcp-prompt-titles.md`,
`mcp-server-instructions.md`, `strict-mcp-tool-inputs.md` (#8228).

---

## 2. Export inventory diff

Named-export counts (declaration-site `export const/class/type/interface/function`):

| Module | rc.115 | `a7a71921de` | added | removed |
| --- | --- | --- | --- | --- |
| `McpServer.ts` | 15 | 15 | 0 | 0 |
| `McpSchema.ts` | 141 | 147 | 18 names (net +6 after 12 renames) | 12 renamed |
| `McpProtocol.ts` | 11 | 18 | 7 | 0 |
| `Tool.ts` | 59 | 60 | 1 | 0 |
| `Toolkit.ts` | 14 | 15 | 1 | 0 |
| `RpcServer.ts` | 20 | 20 | 0 | 0 |
| `RpcSerialization.ts` | 16 | 16 | 0 | 0 |

Same-name exports whose **types** changed are listed as changed, not added.

### 2.1 `McpServer.ts`

No named export added or removed. Same 15 symbols, signatures/service shape changed.

| Symbol | rc.115 | `a7a71921de` | delta |
| --- | --- | --- | --- |
| `McpServer` (service class) | `effect:.../McpServer.ts:183-269` | `effect:.../McpServer.ts:201-296` | `initializedClients` removed from the public service. `addTool` / `addResource` / `addResourceTemplate` / `addPrompt` handler `R` is `McpRequestContext` (was `McpServerClient`). `addTool` / `addPrompt` success includes `InputRequired`. `callTool` / `findResource` / `getPromptResult` / `completion` still require `McpServerClient`. |
| `McpServer.layer` (static) | `effect:.../McpServer.ts:604` | `effect:.../McpServer.ts:643` | Unchanged type lie: `Layer<McpServer \| McpServerClient>` via `as any` while the implementation only builds `McpServer`. |
| `run` | `effect:.../McpServer.ts:671-690` | `effect:.../McpServer.ts:674-695` | Added optional `instructions?: string`. Other options (`name`, `version`, `description`, `websiteUrl`, `icons`, `protocols`, `extensions`) already existed. |
| `layer` | `effect:.../McpServer.ts:1167-1175` | `effect:.../McpServer.ts:1373-1382` | Same options plus `instructions`. Return type still `Layer<McpServer \| McpServerClient, IllegalArgumentError, RpcServer.Protocol>`. |
| `layerStdio` | `effect:.../McpServer.ts:1217-1225` | `effect:.../McpServer.ts:1430-1439` | Same plus `instructions`. Still requires `Stdio`; still claims to provide `McpServerClient`. |
| `layerHttp` | `effect:.../McpServer.ts:1327-1337` | `effect:.../McpServer.ts:1542-1553` | Same plus `instructions`. `path` and `allowedOrigins` already existed on rc.115. |
| `registerToolkit` | `effect:.../McpServer.ts:1525-1530` | `effect:.../McpServer.ts:1789-1794` | `Exclude<HandlerServices, McpServerClient>` → `Exclude<..., McpRequestContext>`. |
| `toolkit` | `effect:.../McpServer.ts:1623-1628` | `effect:.../McpServer.ts:1939-1944` | Same Exclude flip. Layer still does `Layer.effectDiscard(registerToolkit).pipe(Layer.provide(McpServer.layer))` — it does **not** type as supplying `McpRequestContext`. |
| `ValidateCompletions` | `effect:.../McpServer.ts:1641` | `effect:.../McpServer.ts:1957` | Unchanged. |
| `ResourceCompletions` | `effect:.../McpServer.ts:1663` | `effect:.../McpServer.ts:1979` | Unchanged (not re-read; not in the #8228 public-API follow-up). |
| `registerResource` | `effect:.../McpServer.ts:1687-1731` | `effect:.../McpServer.ts:2003-2047` | Exclude target `McpServerClient` → `McpRequestContext`. |
| `resource` | `effect:.../McpServer.ts:1866-1905` | `effect:.../McpServer.ts:2182-2221` | Same Exclude flip. Typetest asserts a handler that yields `McpServerClient` leaves `McpServerClient` as a remaining layer requirement (`effect:.../McpServer.tst.ts` “should not claim that stateless handlers receive the legacy client service”). |
| `registerPrompt` | `effect:.../McpServer.ts:1939-1960` | `effect:.../McpServer.ts:2255-2280` | Exclude flip; new optional `title?: string`. |
| `prompt` | `effect:.../McpServer.ts:2066-2087` | `effect:.../McpServer.ts:2392-2417` | Same. |
| `elicit` | `effect:.../McpServer.ts:2104-2110` | `effect:.../McpServer.ts:2435-2441` | **Unchanged**: still `R = McpServerClient \| DecodingServices`. Still `yield* McpServerClient` then `getClient`. |
| `clientCapabilities` | `effect:.../McpServer.ts:2142-2146` | `effect:.../McpServer.ts:2473-2477` | `R` flipped from `McpServerClient` to `McpRequestContext`. |

### 2.2 `McpProtocol.ts`

| Symbol | kind | rc.115 | `a7a71921de` |
| --- | --- | --- | --- |
| `ProtocolVersion` | changed | `"2024-11-05" \| "2025-03-26" \| "2025-06-18" \| "2025-11-25"` at `effect:.../McpProtocol.ts:24` | union adds `"2026-07-28"` at `effect:.../McpProtocol.ts:25` |
| `StatefulProtocolVersion` | added | — | `Exclude<ProtocolVersion, "2026-07-28">` at `effect:.../McpProtocol.ts:33` |
| `TransportPolicy` | added | — | `effect:.../McpProtocol.ts:83-90` (`jsonRpc.acceptsBatches`, `http.requiresVersionHeader?`) |
| `StatelessRuntimeProfile` | added | — | `effect:.../McpProtocol.ts:98-103` |
| `StatefulRuntimeDescriptor` | added | — | `effect:.../McpProtocol.ts:111-114` (`_tag: "Stateful"`) |
| `StatelessRuntimeDescriptor` | added | — | `effect:.../McpProtocol.ts:122-128` (`_tag: "Stateless"` plus `profileFromRequestMetadata`) |
| `RuntimeDescriptor` | added | — | `effect:.../McpProtocol.ts:136` |
| `AnyProtocolAdapter` | changed | `effect:.../McpProtocol.ts:74-97` with `readonly transport: { acceptsJsonRpcBatches, requiresVersionHeader }` | `effect:.../McpProtocol.ts:144-168` with `readonly runtime: Runtime` **instead of** `transport` |
| `ProtocolAdapter` | changed | `effect:.../McpProtocol.ts:105-107` | `effect:.../McpProtocol.ts:176-179` (second type param `Runtime`) |
| `v2026_07_28` | added | — | `effect:.../McpProtocol.ts:196` typed `ProtocolAdapter<"2026-07-28", StatelessRuntimeDescriptor>` |
| `v2025_11_25` / `v2025_06_18` / `v2025_03_26` / `v2024_11_05` | changed | `ProtocolAdapter<"…">` at `effect:.../McpProtocol.ts:115-146` | now `ProtocolAdapter<"…", StatefulRuntimeDescriptor>` at `effect:.../McpProtocol.ts:204-235` |

`PayloadCodecs`, `ProjectedNotification`, `ErasedRpcGroup`, `ErasedClientRpcGroup` are unchanged in shape.

**Compile-time break:** any consumer that read `adapter.transport.acceptsJsonRpcBatches` (rc.115 `effect:.../McpProtocol.ts:76-79`) must now read `adapter.runtime.transport.jsonRpc.acceptsBatches` (`effect:.../McpProtocol.ts:83-90`, `150`). beep-effect hosts pass the adapter values only; they do not read `transport`.

### 2.3 `McpSchema.ts`

**Renames (removed name → added name, fields unchanged):**

| rc.115 | `a7a71921de` |
| --- | --- |
| `ToolJsonSchema` type+const `effect:.../McpSchema.ts:1532-1544` | `ToolJson` `effect:.../McpSchema.ts:1565-1577` |
| `StringSchema` `effect:.../McpSchema.ts:2267` | `ElicitationString` `effect:.../McpSchema.ts:2326` |
| `NumberSchema` `:2283` | `ElicitationNumber` `:2342` |
| `BooleanSchema` `:2298` | `ElicitationBoolean` `:2357` |
| `UntitledSingleSelectEnumSchema` `:2311` | `UntitledSingleSelectEnum` `:2370` |
| `TitledSingleSelectEnumSchema` `:2327` | `TitledSingleSelectEnum` `:2386` |
| `SingleSelectEnumSchema` `:2346` | `SingleSelectEnum` `:2405` |
| `UntitledMultiSelectEnumSchema` `:2357` | `UntitledMultiSelectEnum` `:2424` |
| `TitledMultiSelectEnumSchema` `:2378` | `TitledMultiSelectEnum` `:2445` |
| `MultiSelectEnumSchema` `:2401` | `MultiSelectEnum` `:2468` |
| `LegacyTitledEnumSchema` `:2413` | `LegacyTitledEnum` `:2488` |
| `EnumSchema` `:2430` | `ElicitationEnum` `:2505` |

No `ToolJsonSchema` / `StringSchema` alias is left behind. beep-effect has **no** references to those old names (`graft grep` empty).

**Added (not renames):**

| Symbol | after | notes |
| --- | --- | --- |
| `HEADER_MISMATCH_ERROR_CODE` | `effect:.../McpSchema.ts:595` | `-32020` |
| `ToolOutputJson` type+const | `effect:.../McpSchema.ts:1594-1602` | any JSON-Schema root; inputs stay object-rooted `ToolJson` |
| `McpInputRequest` / `McpInputResponse` | `effect:.../McpSchema.ts:2668-2679` | keyed reverse-input round-trip |
| `InputRequired` | `effect:.../McpSchema.ts:2697-2716` | tagged class; constructor requires `inputRequests` or `requestState` |
| `McpRequestContext` | `effect:.../McpSchema.ts:2824-2835` | protocol-neutral request service |
| `McpError` type alias | `effect:.../McpSchema.ts:726` | `typeof McpError.Type` beside the existing union const at `:711` |
| several `typeof X.Type` aliases | `SingleSelectEnum` `:2416`, `MultiSelectEnum` `:2479`, `ElicitationEnum` `:2517`, `PrimitiveSchemaDefinition` `:2538` | additive |

**Changed same-name exports:**

| Symbol | rc.115 | `a7a71921de` |
| --- | --- | --- |
| `McpSchema.Tool.outputSchema` | `optional(ToolJsonSchema)` object-rooted `effect:.../McpSchema.ts:1580` | `optional(ToolOutputJson)` any JSON object `effect:.../McpSchema.ts:1631` |
| `McpSchema.Tool.inputSchema` | `ToolJsonSchema` `:1576` | `ToolJson` `:1627` (same shape, new name) |
| `McpServerClient` | `effect:.../McpSchema.ts:2661-2672`: `protocolVersion: ProtocolVersion`; no `requestMetadata` | `effect:.../McpSchema.ts:2848-2860`: `protocolVersion: StatefulProtocolVersion`; optional `requestMetadata?: JsonObject` |
| `Prompt` | already had `title?: string` at `effect:.../McpSchema.ts:1225` | unchanged at `:1250` — the **helper** `registerPrompt` is what gained a `title` option |

`McpError` union membership is unchanged (ParseError, InvalidRequest, MethodNotFound, InvalidParams, InternalError, McpErrorBase). `HEADER_MISMATCH_ERROR_CODE` is a constant, not a tagged error class, and is **not** in the `McpError` union.

### 2.4 `Tool.ts`

| Symbol | kind | rc.115 | `a7a71921de` |
| --- | --- | --- | --- |
| `FailureOrigin` | added | — | `"parameters" \| "handler" \| "result"` at `effect:.../Tool.ts:956` |
| `HandlerResult` | changed | `effect:.../Tool.ts:950-971` (no origin field) | `effect:.../Tool.ts:964-990` adds optional `failureOrigin?: FailureOrigin` |
| `Strict` / `getStrictMode` | unchanged API | `effect:.../Tool.ts:1867-1889` | `effect:.../Tool.ts:1886-1908` — JSDoc still describes **provider** structured-output, not MCP excess-property rejection |

### 2.5 `Toolkit.ts`

| Symbol | kind | rc.115 | `a7a71921de` |
| --- | --- | --- | --- |
| `WithHandler.handle` | changed | 3 params (`name`, `params`, `toolCallId?`) at `effect:.../Toolkit.ts:204-224` | 4th optional `options?: SchemaAST.ParseOptions` at `effect:.../Toolkit.ts:205-229` |
| `FailureOrigin` | added | — | `Context.Reference<Tool.FailureOrigin>` default `"result"` at `effect:.../Toolkit.ts:284-286` |

Existing 3-argument `handle` call sites remain type-correct (4th param optional).

### 2.6 RPC exports that MCP actually calls

MCP stdio uses `RpcServer.layerProtocolStdio` and a custom `RpcSerialization` built on `jsonRpc` + `ndjson.makeUnsafe()`. HTTP uses `RpcServer.makeProtocolWithHttpEffect` and `RpcSerialization.layerJsonRpc` / `jsonRpc`.

| Symbol | rc.115 | `a7a71921de` | public signature |
| --- | --- | --- | --- |
| `RpcServer.layerProtocolStdio` | `effect:.../RpcServer.ts:1410` | `effect:.../RpcServer.ts:1416-1420` | **unchanged** `Layer<Protocol, never, RpcSerialization \| Stdio>` |
| `RpcServer.makeProtocolStdio` | `:1347` | `:1353` | implementation: stdin queue `Queue.make` → `Queue.bounded(..., 8)` (`effect:.../RpcServer.ts` diff). Not a signature change. |
| `RpcServer.makeProtocolWithHttpEffect` | `:1044` | `:1047` | disconnect path now `Queue.shutdown` then interrupts (`effect:.../RpcServer.ts` +18/− lines). Not a signature change. |
| `RpcSerialization.jsonRpc` | `:208` | `:208-233` | **unchanged** options `{ contentType? }`. Internal: JSON-RPC error objects decode as `{ _tag: "Fail", error }` not `{ _tag: "Die", defect }` (`effect:.../RpcSerialization.ts:352-358`). |
| `RpcSerialization.ndjson` / `ndJsonRpc` / `layerJsonRpc` / `layerNdJsonRpc` | same line numbers | same | unchanged |

MCP now wraps `jsonRpc` in a local `mcpJsonRpcSerialization` (`effect:.../McpServer.ts:1664-1667`) instead of using the codec raw. That is an implementation move, not a new public RPC export.

---

## 3. Breaking-change table

| Symbol | before (rc.115) | after (`a7a71921de`) | consumer impact | evidence |
| --- | --- | --- | --- | --- |
| `registerToolkit` / `toolkit` handler `R` | `Exclude<HandlerServices, McpServerClient>` | `Exclude<HandlerServices, McpRequestContext>` | A handler that `yield*`s `McpServerClient` is **no longer** erased from the layer/effect requirements. Composing with `layerStdio`/`layerHttp` still type-checks because those layers **claim** to provide `McpServerClient`. At runtime, `McpServerClient` is provided only when `invocation.serverClient` is defined, and the RPC middleware **dies** if the selected protocol is `2026-07-28`. | `effect:.../McpServer.ts:1525-1530` vs `:1789-1794`; `:1623-1628` vs `:1939-1944`; provide path `:180-182`; middleware die `:891-892`; typetest resource remaining-R |
| `registerResource` / `resource` | `Exclude<R, McpServerClient>` | `Exclude<R, McpRequestContext>` | Same as toolkit. Upstream typetest **requires** this: a resource whose `content` uses `McpServerClient.useSync` has `Layer.Services = McpServerClient`. | `effect:.../McpServer.ts:1701` vs `:2017`; `:1879` vs `:2195`; `effect:.../McpServer.tst.ts` “should not claim that stateless handlers receive the legacy client service” |
| `registerPrompt` / `prompt` | `Exclude<..., McpServerClient>` | `Exclude<..., McpRequestContext>` plus optional `title?: string` | Same Exclude flip. `title` is additive (optional). Schema `Prompt.title` already existed on rc.115; only the helper now forwards it. | `effect:.../McpServer.ts:1960` vs `:2277-2280`; `:2087` vs `:2414-2417`; schema `effect:.../McpSchema.ts:1225` vs `:1250` |
| `run` / `layer` / `layerStdio` / `layerHttp` options | `name`, `version`, `description?`, `websiteUrl?`, `icons?`, `protocols` (non-empty adapters), `extensions?`; HTTP also `path`, `allowedOrigins?` | same plus `instructions?: string` | **Not a compile break** for existing call sites. `instructions` is the only new option. `description` / `websiteUrl` / `icons` / `extensions` / `allowedOrigins` are **not new** in this range. | rc.115 `run` `:671-678`, `layerHttp` `:1327-1336`; HEAD `run` `:674-682`, `layerStdio` `:1430-1438`, `layerHttp` `:1542-1552` |
| `McpServer` service shape | `initializedClients: Set<number>` plus handlers requiring `McpServerClient` | `initializedClients` gone; registration handlers require `McpRequestContext` | Compile break for anyone reading `server.initializedClients`. beep-effect: **no hits**. `callTool` still requires `McpServerClient` — kit tests already stub it. | rc.115 `:189`; HEAD service `:201-296`; `callTool` HEAD `:222-224` |
| `McpServer.layer` (static) | `Layer<McpServer \| McpServerClient>` via `as any` | identical lie at `:643` | Pre-existing. beep-effect kit fixture comments already document that `callTool` dies without a stub. Not introduced by this delta; still a type/runtime split. | rc.115 `:604`; HEAD `:643`; `repo:packages/foundation/capability/mcp-kit/test/fixtures/McpClient.ts:4-7` |
| `McpServerClient` | `protocolVersion: ProtocolVersion`; required `clientInfo` / `initializePayload` / `getClient` | `protocolVersion: StatefulProtocolVersion`; optional `requestMetadata?` | Stubs using `"2025-06-18"` still type-check. A stub that used `"2026-07-28"` would not. `requestMetadata` is optional so existing `McpServerClient.of({...})` still compiles. | rc.115 `:2661-2672`; HEAD `:2848-2860`; stubs `repo:.../mcp-kit/test/fixtures/McpClient.ts:22-32` |
| `McpRequestContext` | did not exist | `clientId`, `protocolVersion: string`, `clientCapabilities`, optional `clientInfo` / `requestMetadata` / `inputResponses` / `requestState`. **No** `getClient`, **no** `initializePayload`. | New service for protocol-neutral handlers. `clientCapabilities` accessor now requires it. `elicit` does **not** use it. | HEAD `:2824-2835`; `clientCapabilities` `:2473-2477`; typetest first `it` |
| `elicit` | requires `McpServerClient` | **unchanged** | On a `v2026_07_28`-only server the RPC middleware dies before `McpServerClient` can be provided (`protocolVersion === "2026-07-28"`). G4-only lists make `elicit` unusable. **decision-challenge** vs “flip every in-repo server”. | HEAD `:2435-2446` still `yield* McpServerClient`; middleware `:891-892` |
| `Toolkit.handle` | `(name, params, toolCallId?)` | `(name, params, toolCallId?, options?: SchemaAST.ParseOptions)` | Additive. MCP `registerToolkit` passes `{ onExcessProperty: "error" }` when `Tool.getStrictMode(tool) === true`. | HEAD `Toolkit.ts:205-221`; `McpServer.ts:1835` and `:1888` |
| `Toolkit.FailureOrigin` / `Tool.FailureOrigin` | did not exist | shared `"parameters" \| "handler" \| "result"`; cause annotation default `"result"`; copied onto `HandlerResult.failureOrigin` | Additive for readers. MCP `registerToolkit` branches on origin: `"parameters"` + `ToolParameterValidationError` → `InvalidParams`; `"handler"` + declared failure → `isError: true` result without `structuredContent`; else internal scrub. | `Tool.ts:956`; `Toolkit.ts:284-286`; `McpServer.ts:1847-1859` and `:1894-1904` |
| `Tool.Strict` at MCP registration | annotation ignored by MCP | `getStrictMode(tool) === true` → closed input JSON Schema (`onExcessProperty: "error"`) and decode with the same option; raw-JSON-Schema dynamic tools **die at registration** | Runtime + registration defect, not a type break, unless a consumer already annotates MCP tools `Strict: true` with `Tool.dynamic({ parameters: { type: "object" } })`. beep-effect annotates `Tool.Strict, false` only on Anthropic **LLM** tools, not MCP registration. | `McpServer.ts:1828-1835`; test “dies on strict raw JSON Schema tools…” `McpServer.test.ts:1502-1527`; beep `repo:packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:68` |
| `AnyProtocolAdapter.transport` | present | replaced by `runtime: RuntimeDescriptor` | Compile break for structural readers. beep-effect does not read it. Hosts pass `[McpProtocol.v2025_06_18]` today (`repo:packages/drivers/nlp-mcp/src/Server.ts:115` and siblings; `repo:apps/professional-desktop/server/OntologyMcpTransport.ts:176-180`). |
| `McpProtocol.v2026_07_28` | missing | export exists and is a `ProtocolAdapter`, so `protocols: [McpProtocol.v2026_07_28]` type-checks on `layer`/`layerStdio`/`layerHttp` | G4 is **implementable at the type level**. Stdio decode still calls `selectStatefulProtocol` on `initialize` (`McpServer.ts:1484-1487`). A v2026-only `protocols` list makes `selectStatefulProtocol` return undefined for initialize. **decision-challenge** for G4. | typetest `v2026_07_28` assignable; stdio `:1484-1487`; `ProtocolAdapter` `:176-179` |
| `mcp-kit` `sanitizedToolkit` | `Exclude<..., McpServerClient>` matching rc.115 `toolkit` | still `Exclude<..., McpServerClient>` while upstream flipped to `McpRequestContext` | Compile drift, not yet a break. Kit also still `yield* serviceOption(McpServerClient)` inside `addTool` handle. 20-r1 owns the kit fix; this lane records the API mismatch. | `repo:packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts:410-412`, `:269`, `:303` |
| RPC `jsonRpc` error tag | JSON-RPC `error` → Cause `Die`/`defect` | → Cause `Fail`/`error` | No signature change. MCP stdio/HTTP codecs wrap this codec; failure matching that assumed `Die` for protocol errors would change. 11-u2 owns runtime proof. | `effect:.../RpcSerialization.ts:352-358` |
| `makeProtocolStdio` queue | unbounded `Queue.make` | `Queue.bounded(..., 8)` | No signature change. Stdio backpressure. 11-u2. | `RpcServer.ts` diff around `makeProtocolStdio` |

`description` / `websiteUrl` / `icons` / `extensions` / `allowedOrigins` / `protocols` were already on rc.115. Treating them as “new in the 2026-07-28 work” would be wrong. The only new constructor field in this range is `instructions`.

---

## 4. `Tool.Strict` dual use

`Tool.Strict` is one annotation with two consumers that do **not** share a documented contract.

**Provider / structured-output meaning (unchanged JSDoc):**

> When `true`, providers that support strict mode will send `strict: true` to the model API (e.g. OpenAI's Structured Outputs). When `false`, `strict: false` is sent. When `undefined` (default), the provider's global configuration determines the behavior (`Config.strictJsonSchema` for OpenAI).

Evidence: `effect:packages/effect/src/unstable/ai/Tool.ts:1860-1908`. Call sites:

- OpenAI: `Tool.getStrictMode(tool) ?? config.strictJsonSchema ?? true` then `strict` on the function tool (`effect:packages/ai/openai/src/OpenAiLanguageModel.ts:2768-2775`).
- Anthropic: same ternary, only if `capabilities.supportsStructuredOutput` (`effect:packages/ai/anthropic/src/AnthropicLanguageModel.ts:1331-1340`).
- openai-compat / OpenRouter: same getter (`graft grep getStrictMode`).

Default `undefined` means “provider config decides”, and OpenAI’s fallback is **`true`**.

**MCP meaning (new in #8228, not reflected in `Tool.Strict` JSDoc):**

MCP treats **only the literal `true`** as strict:

```
const strict = Tool.getStrictMode(tool) === true
```

(`effect:packages/effect/src/unstable/ai/McpServer.ts:1828`). Then:

1. If `strict` and the tool is `Tool.dynamic` with raw `jsonSchema` → `Effect.die("McpServer cannot strictly validate the raw JSON Schema…")` **before any tool in that toolkit is registered** (`:1830-1833`; test `:1502-1527`).
2. Decode options `{ onExcessProperty: "error" }` when strict, else `undefined` (`:1835`), passed as the 4th `Toolkit.handle` argument (`:1888`).
3. Advertised input JSON Schema uses `onExcessProperty: strict ? "error" : "ignore"` (`:1924-1926`). Tests: non-strict tools keep `additionalProperties: true` and accept extra keys (`McpServer.test.ts:1420-1443`); strict tools advertise `additionalProperties: false` and reject extra keys with `INVALID_PARAMS_ERROR_CODE` **without invoking the handler** (`:1446-1493`).

So:

| `Tool.getStrictMode(tool)` | OpenAI provider | MCP `registerToolkit` |
| --- | --- | --- |
| `undefined` (default) | often `strict: true` via config fallback | **not** strict (`=== true` is false); extra properties ignored |
| `true` | `strict: true` | excess-property **error**; raw dynamic JSON Schema forbidden |
| `false` | `strict: false` | not strict |

The two meanings diverge on the default. An MCP tool with no annotation is open (extra args allowed). The same tool sent to OpenAI without `annotate(Tool.Strict, false)` is usually closed. beep-effect already annotates `Tool.Strict, false` on Anthropic repair/assistant-turn tools for the **provider** meaning (`repo:packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:63-68`); those are not MCP registrations.

`Tool.tst.ts` does not mention this dual use (file unchanged). MCP tests in `McpServer.test.ts` are the behavioral spec; they are runtime evidence owned in detail by 11-u2.

---

## 5. Type-level evidence

### 5.1 `McpServer.tst.ts` (`effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts`)

Added in this range:

- `McpRequestContext.protocolVersion` is `string`, `clientInfo` is `Implementation | undefined`, and `McpServer.clientCapabilities` requires `McpRequestContext` (not `McpServerClient`).
- `McpSchema.Tool.make` accepts `outputSchema: { type: "string" }`; `{ type: "string" }` is **not** assignable to `ToolJson` (inputs stay object-rooted).
- `ToolResultContent.structuredContent` accepts JSON arrays.
- `ProtocolVersion` union includes `"2026-07-28"`; `v2026_07_28` is a `ProtocolAdapter<"2026-07-28">` with `runtime: StatelessRuntimeDescriptor`; historical adapters have `runtime: StatefulRuntimeDescriptor`.
- `ToolJsonSchema` renamed: the test now uses `McpSchema.ToolJson`.
- A `resource({ content: McpServerClient.useSync(...) })` layer still has `Layer.Services = McpServerClient` — i.e. registration does **not** pretend the legacy client is in scope for stateless handlers.
- `McpServerClient.protocolVersion` is `StatefulProtocolVersion`.
- `InputRequired` requires `inputRequests` or `requestState`; `{}` is not constructable.

Unchanged from rc.115: `run`/`layer`/`layerStdio`/`layerHttp` still require a non-empty `protocols` array of **adapter values**, not version strings; `allowedOrigins` is still accepted on `layerHttp`; constructor failures are `Cause.IllegalArgumentError`.

**Not type-tested** (gaps): `instructions`, prompt `title`, `Toolkit.handle` 4th argument, `Tool.FailureOrigin` / `Toolkit.FailureOrigin`, `Exclude<..., McpRequestContext>` on `toolkit()` itself, `elicit` still requiring `McpServerClient`, `McpServer.initializedClients` removal.

The typetest still constructs servers with `protocols: [McpProtocol.v2025_11_25]` (`serverOptions`). It never type-checks a `v2026_07_28`-**only** `protocols` list, even though that list is assignable.

### 5.2 `Tool.tst.ts`

Empty diff in this range. The file covers `FailureResult` / `ExecutionFailure` and `Tool.make` defaults (`effect:packages/effect/typetest/unstable/ai/Tool.tst.ts:1-56`). It does **not** mention `FailureOrigin`, `HandlerResult.failureOrigin`, or `Tool.Strict`. Type-level evidence for those additions is therefore **missing** from `Tool.tst.ts`.

---

## 6. Cross-check: changesets vs migration YAML vs code

### 6.1 Changesets (match / miss)

| Changeset | Claims | vs code |
| --- | --- | --- |
| `.changeset/modern-mice-discover.md` | “Add server support for MCP protocol version 2026-07-28 through 2026_07_28” | **True but incomplete.** The commit also adds `McpRequestContext`, `RuntimeDescriptor`, `InputRequired`, `HEADER_MISMATCH_ERROR_CODE`, `ToolJson`/`ToolOutputJson`, elicitation schema renames, drops `initializedClients` and `AnyProtocolAdapter.transport`. None of that is in the changeset. |
| `.changeset/mcp-server-instructions.md` | “Add an `instructions` option to MCP servers for initialization and discovery responses” | **Matches** `run`/`layer`/`layerStdio`/`layerHttp` (`McpServer.ts:677`, `:1376`, `:1433`, `:1545`). Does not say the field is optional or that discovery/initialize projection is runtime (11-u2). |
| `.changeset/mcp-prompt-titles.md` | “Support prompt titles in `McpServer.prompt` and `McpServer.registerPrompt`” | **Matches** helper option (`:2268`, `:2405`). Does **not** mention that `McpSchema.Prompt` already had `title` on rc.115. |
| `.changeset/strict-mcp-tool-inputs.md` | Honor `Tool.Strict`; raw JSON Schema rejected; identified schemas for non-strict tools; InvalidParams before 2025-11-25 vs `isError: true` on newer; declared-failure projection; `Toolkit.handle` ParseOptions; `Toolkit.FailureOrigin` / `Tool.FailureOrigin` / `HandlerResult.failureOrigin` | **Matches** registration and Toolkit API. The protocol-version split for InvalidParams vs `isError` is **not** in `registerToolkit` itself (`handleCause` always `Effect.fail(new InvalidParams(...))` at `:1852-1853`). Tests at `McpServer.test.ts:1465-1493` observe `INVALID_PARAMS_ERROR_CODE` for strict excess properties. Whether a newer protocol adapter re-projects that error is 11-u2. **Mismatch risk:** changeset describes a protocol-dependent wire split that the public `registerToolkit` function does not itself implement. |

No changeset covers: `ToolJsonSchema` → `ToolJson`, elicitation `*Schema` → `Elicitation*` / dropped `Schema` suffix, `McpRequestContext`, `InputRequired`, `HEADER_MISMATCH_ERROR_CODE`, `initializedClients` removal, `AnyProtocolAdapter.transport` → `runtime`, `clientCapabilities` `R` flip, `elicit` remaining on `McpServerClient`.

### 6.2 `migration/annotations/effect__ai__McpServer.yaml`

#8242 **added** notes for `McpServer`, `registerToolkit`, `toolkit`, `registerResource`, `resource`, `registerPrompt`, `prompt`. Pre-existing notes for `layer` / `layerHttp` / `layerHttpRouter` / `layerStdio` / `run` still say “pass `[McpProtocol.v2025_06_18]`” and do not mention `v2026_07_28` or `instructions`.

Mismatches against **this** delta’s code:

1. **`toolkit` note is wrong at the type level.** It says the registration layer “supplies `McpRequestContext` to handlers instead of excluding `McpServerClient` from requirements.” Code of `toolkit` is `Layer.effectDiscard(registerToolkit).pipe(Layer.provide(McpServer.layer))` and `registerToolkit` **excludes `McpRequestContext`**, same as `resource`/`prompt`. It does not exclude `McpServerClient`, and it does not list `McpRequestContext` as a provided service. Request-time supply is `provideInvocationContext` (`McpServer.ts:164-186`) / RPC middleware (`:907-933`), not the registration layer. The typetest for `resource` is the counterexample.
2. **`registerToolkit` note oversimplifies validation.** “Parameter validation fails with InvalidParams” matches `handleCause` (`:1852-1853`) but not the changeset’s “InvalidParams before 2025-11-25 / `isError: true` on newer.”
3. **`McpServer` note mixes v3 leftovers with this delta.** “`initializedClients` and `notificationsMailbox` are no longer exposed”: `initializedClients` **was** on rc.115 (`:189`) and is gone — true for this delta. `notificationsMailbox` was **not** on the rc.115 public service — that sentence is a v3→v4 leftover, not an rc.115→HEAD change.
4. **Constructor notes omit `instructions`** and still example only `v2025_06_18`.

Accurate parts: handler Exclude target is now `McpRequestContext`; strict tools reject excess properties; raw JSON Schema dynamic tools cannot be strict; `McpServerClient` is for initialized stateful requests.

### 6.3 `migration/annotations/effect__ai__McpSchema.yaml`

#8242 added `@effect/ai/McpSchema#McpServerClient`:

> Use `McpRequestContext` for client identity, capabilities, and request metadata in protocol-neutral handlers. `McpServerClient` remains available for initialized stateful protocols and reverse client requests; it is **not provided by the stateless 2026-07-28 adapter**. Registration helpers exclude `McpRequestContext` from handler requirements, not `McpServerClient`.

That last sentence **matches the code and the typetest**. The “not provided by 2026-07-28” clause matches middleware `:891-892` (`Effect.die` when `protocolVersion === "2026-07-28"`) and `provideInvocationContext` only attaching `McpServerClient` when `invocation.serverClient` is defined (`:180-182`).

Missing from this YAML (code changed, annotation silent): `ToolJsonSchema` → `ToolJson`, all elicitation schema renames, `HEADER_MISMATCH_ERROR_CODE`, `InputRequired`, `McpInputRequest` / `McpInputResponse`, `ToolOutputJson`.

`McpError` note is the older v3 “class → union” story and is unrelated to this delta (union membership unchanged).

### 6.4 `effect__ai__Tool.yaml` / `effect__ai__Toolkit.yaml`

**No #8242 updates.** Neither file mentions `Tool.FailureOrigin`, `Toolkit.FailureOrigin`, `HandlerResult.failureOrigin`, `Toolkit.handle`’s `ParseOptions`, or MCP’s reuse of `Tool.Strict`. Those public additions are **undocumented in migration YAML**.

---

## Decision challenges (vs working assumptions)

**G4 (`v2026_07_28` only, no mixed lists).** Type-level: a `protocols: [McpProtocol.v2026_07_28]` argument is legal everywhere (`ProtocolAdapter` includes the stateless adapter; typetest assigns it). Runtime, in this same public module:

- stdio `initialize` frames still go through `McpRuntime.selectStatefulProtocol` (`effect:.../McpServer.ts:1484-1487`);
- RPC middleware that would provide `McpServerClient` **dies** on `protocolVersion === "2026-07-28"` (`:891-892`);
- `elicit` still requires `McpServerClient` (`:2435-2446`).

So G4 is not a no-op API flip. A v2026-only server compiles and then refuses initialize-shaped traffic and any reverse-client API. Mixed lists (G4-contradicting option) remain what the adapter types are designed for (`StatefulRuntimeDescriptor` vs `StatelessRuntimeDescriptor` on the same `ProtocolAdapter` union). 11-u2 owns the exact initialize error string; this lane records that the **public types do not prevent** a v2026-only list.

**G6 (in-repo launchers are in scope).** Every in-repo server still passes `[McpProtocol.v2025_06_18]`:

- `repo:packages/drivers/nlp-mcp/src/Server.ts:115`
- `repo:packages/drivers/m365-mcp/src/Server.ts:75`
- `repo:packages/drivers/uspto-mcp/src/Server.ts:96`
- `repo:packages/drivers/gov-legal-mcp/src/Server.ts:95`
- `repo:packages/law-practice/server/src/Tools.ts:133`
- `repo:apps/professional-desktop/server/OntologyMcpTransport.ts:176-180` (`layerHttp` + `allowedOrigins`)

None of those call sites need new constructor fields to compile against HEAD. The break is the protocol value they pass, plus kit’s still-old `Exclude<..., McpServerClient>`.

**G9 (all listed servers).** Same: compile-clean against the new option types; runtime/protocol flip is a separate change. `elicit` / `McpServerClient` handlers are the API pieces that do not survive a G4-only list.

---

## Options (not a decision)

1. **Keep current `v2025_06_18`-only lists** after the snapshot pin (G1). API delta is then: `instructions` unused, Exclude flip only matters if handlers yield `McpServerClient` without composing a transport layer, kit drift vs upstream `toolkit`. Lowest compile risk.
2. **Honor G4 (`v2026_07_28` only).** Type-legal. Requires in-repo clients to speak 2026-07-28 (no `initialize`), handlers to use `McpRequestContext` not `McpServerClient`, and dropping or replacing `elicit`. Contradicts any launcher that still sends `initialize` (stdio codec path above).
3. **Mixed list** `[v2025_06_18, v2026_07_28]` (G4-contradicting; types designed for this). One server, two runtimes. 11-u2 / 22-r3 own the operational tradeoff.
4. **Patch mcp-kit `sanitizedToolkit` Exclude** to `McpRequestContext` in the same PR as the pin, matching upstream `toolkit` (20-r1). Independent of G4.

---

## UNVERIFIED / NOT FOUND

- Whether a 2025-11-25+ adapter re-projects `InvalidParams` from `registerToolkit` into `isError: true` on the wire — **UNVERIFIED here** (11-u2). `registerToolkit` itself always fails with `InvalidParams`.
- `ResourceCompletions` type body — not re-diffed beyond export line movement; no evidence it changed.
- beep-effect `McpServer.elicit` usage — **NOT FOUND**.
- beep-effect `McpSchema.ToolJsonSchema` / elicitation `*Schema` names — **NOT FOUND**.
- beep-effect `initializedClients` — **NOT FOUND**.
- `Tool.tst.ts` coverage of `FailureOrigin` — **NOT FOUND** (file unchanged).

## Gate B verdicts (2026-09-17)

Three grok refuters voted on 19 claims from this lane (19 survive, 0 killed; per-vote detail in `verification/10-u1-api-delta.verdicts.jsonl`).

No claim was struck.
