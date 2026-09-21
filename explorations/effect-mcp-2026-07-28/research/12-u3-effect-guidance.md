# Lane 12-u3-effect-guidance — Effect's own MCP guidance and documentation gaps

Pinned Effect checkout: commit `a7a71921de` (upstream main, 2026-09-16). Diff base named in the
lane contract: tag `effect@4.0.0-rc.115`. This lane owns documentation, JSDoc examples, changesets,
and tests used as executable docs. API and runtime facts belong to lanes 10-u1 and 11-u2. Citations
here are the minimum needed to show a doc/code mismatch or a missing demonstration.

Sources read: `packages/effect/MCP.md`, `migration/v3-to-v4.md` (MCP-bearing spans),
`migration/annotations/effect__ai__McpSchema.yaml`, `migration/annotations/effect__ai__McpServer.yaml`,
JSDoc on `unstable/ai/{McpServer,McpSchema,McpProtocol,Tool,Toolkit}.ts`,
`.changeset/mcp-prompt-titles.md`, `.changeset/mcp-server-instructions.md`,
`.changeset/strict-mcp-tool-inputs.md`, `.changeset/modern-mice-discover.md`,
`.changeset/pre/*mcp*.md`, `packages/effect/test/unstable/ai/McpServer/**`,
`packages/effect/typetest/unstable/ai/McpServer.tst.ts`.

Timeline that explains most of the staleness:

- `packages/effect/MCP.md` last changed in `3715d9b015` (2026-09-07),
  "Made all code examples in MCP.md typecheck successfully" (`#8079`).
- `McpProtocol.v2026_07_28` landed in `a2c4154cf8` (2026-09-11), `#7265`.
- Tool strictness, server `instructions`, and prompt titles landed in `49e4b37b83`
  (2026-09-14), `#8228`.

`MCP.md` was typechecked against a three-protocol world and was not updated for either later
commit.

## 1. Contradictions first

### 1.1 `MCP.md` protocol list and copy-paste pins omit `v2025_11_25` and `v2026_07_28`

`MCP.md` states:

> This release supports `McpProtocol.v2024_11_05`, `McpProtocol.v2025_03_26`, and
> `McpProtocol.v2025_06_18`.

Cite: `effect:packages/effect/MCP.md:82-84`.

The Getting Started and Complete Working Example both pin
`protocols: [McpProtocol.v2025_06_18]`
(`effect:packages/effect/MCP.md:57-61`, `effect:packages/effect/MCP.md:360-364`).

At `a7a71921de` the public type is five versions:

```ts
export type ProtocolVersion = "2024-11-05" | "2025-03-26" | "2025-06-18" | "2025-11-25" | "2026-07-28"
```

Cite: `effect:packages/effect/src/unstable/ai/McpProtocol.ts:25`. Stateless is carved out as
`Exclude<ProtocolVersion, "2026-07-28">`
(`effect:packages/effect/src/unstable/ai/McpProtocol.ts:33`). The barrel exports
`v2026_07_28` and `v2025_11_25`
(`effect:packages/effect/src/unstable/ai/McpProtocol.ts:196`,
`effect:packages/effect/src/unstable/ai/McpProtocol.ts:204`).

The typetest asserts the same five-member union and that `v2026_07_28.runtime` is
`StatelessRuntimeDescriptor`
(`effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts:102-115`).

A reader who copies `MCP.md` ships a June 2025 stdio server. Working assumption G4
(`v2026_07_28` only) is invisible in Effect's prose.

### 1.2 `MCP.md` documents `Logger.consolePretty({ stderr: true })`, which is not an option

The Getting Started example installs `Logger.layer([Logger.consolePretty()])` plus
`Layer.succeed(Logger.LogToStderr, true)`
(`effect:packages/effect/MCP.md:64-66`). The following prose then says to use
`Logger.layer([Logger.consolePretty({ stderr: true })])`
(`effect:packages/effect/MCP.md:89-90`). The Complete Working Example keeps `LogToStderr` and
drops `Logger.layer` entirely (`effect:packages/effect/MCP.md:367`).

`Logger.consolePretty` accepts only `{ colors, formatDate, mode }`
(`effect:packages/effect/src/Logger.ts:801-807`). The Logger JSDoc's own TTY example is the
`LogToStderr` layer, not an `stderr` option
(`effect:packages/effect/src/Logger.ts:780-788`). The `{ stderr: true }` form in `MCP.md` will
not typecheck against current `Logger`.

### 1.3 `layerStdio` JSDoc claims handlers receive `McpServerClient`

`layerStdio` **Details** say the layer "supplies request-scoped `McpRequestContext` and legacy
`McpServerClient` services to handlers"
(`effect:packages/effect/src/unstable/ai/McpServer.ts:1417-1422`).

The migration annotation for `McpSchema.McpServerClient` says the opposite for July:

> McpServerClient remains available for initialized stateful protocols and reverse client
> requests; it is not provided by the stateless 2026-07-28 adapter.

Cite: `effect:migration/annotations/effect__ai__McpSchema.yaml:19-21`.

The typetest is titled "should not claim that stateless handlers receive the legacy client
service" and shows that a resource handler yielding `McpServerClient` keeps
`McpServerClient` in the layer's requirements
(`effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts:145-152`).

The mixed-protocol HTTP test
"should omit a legacy client when a toolkit registered in a session handles a stateless request"
asserts `hasSession: false` on a `v2026_07_28` call
(`effect:packages/effect/test/unstable/ai/McpServer/ProtocolAdapters.test.ts:822-893`).

`McpServerClient.protocolVersion` is typed as `StatefulProtocolVersion`
(`effect:packages/effect/src/unstable/ai/McpSchema.ts:2849-2851`), which excludes `"2026-07-28"`.

### 1.4 Documented elicitation uses `McpServer.elicit`, which cannot run on a 2026-07-28-only server

`MCP.md` "Elicitation requests" is a form-mode `McpServer.elicit` example with
`ElicitationDeclined` fallback (`effect:packages/effect/MCP.md:209-228`). The helper's
requirement is `McpServerClient`:

```ts
) => Effect.Effect<S["Type"], ElicitationDeclined, McpServerClient | S["DecodingServices"]>
```

Cite: `effect:packages/effect/src/unstable/ai/McpServer.ts:2435-2441`. The implementation
calls `client.elicit` on the reverse client (`effect:packages/effect/src/unstable/ai/McpServer.ts:2446-2454`).

On the July adapter, direct reverse operations including `elicitation/create` fail with
`McpReverseOperationUnsupported`
(`effect:packages/effect/test/unstable/ai/McpServer/ProtocolAdapters.test.ts:1288-1341`).
July elicitation is an `InputRequired` result that the client retries with `inputResponses`
(see §2.4). `McpSchema.McpRequestContext` JSDoc already warns it "does not imply an
initialized session or support for server-initiated requests"
(`effect:packages/effect/src/unstable/ai/McpSchema.ts:2814-2819`).

This is a **decision-challenge** to G4. A `v2026_07_28`-only server cannot execute the
elicitation recipe Effect publishes. Mixed lists remain the only way to keep
`McpServer.elicit` working for stateful clients. Upstream supports mixed lists by design
(Gate A finding 28); `MCP.md` never shows one.

### 1.5 `initialize` is the documented lifecycle, and July rejects it

Nothing in `MCP.md` mentions `server/discover`, request metadata, or the removal of
`initialize`. The July conformance test
"should return method not found when the removed initialize method is requested" expects
HTTP 404 and `METHOD_NOT_FOUND_ERROR_CODE`
(`effect:packages/effect/test/unstable/ai/McpServer/v2026_07_28.test.ts:131-138`).
Discovery without a session is the replacement
(`effect:packages/effect/test/unstable/ai/McpServer/v2026_07_28.test.ts:80-88`).

G4 (`v2026_07_28` only) therefore collides with every in-repo launcher that still sends
`initialize`. That is a client-handshake fact for lanes 11-u2 and 21-r2. This lane records
that Effect's own getting-started guide still teaches the handshake July removed.

### 1.6 Migration notes say parameter validation is always `InvalidParams`

`migration/v3-to-v4.md` and the matching annotation for `registerToolkit` both say
"Declared handler failures produce isError results, while parameter validation fails with
InvalidParams" with no protocol qualifier
(`effect:migration/v3-to-v4.md:4975`,
`effect:migration/annotations/effect__ai__McpServer.yaml:21`).

The unreleased changeset for `#8228` qualifies the wire:

> Invalid arguments use `InvalidParams` on protocols before 2025-11-25 and `isError: true`
> results on newer protocols.

Cite: `effect:.changeset/strict-mcp-tool-inputs.md:7`.

The conformance test
"distinguishes malformed requests from tool validation errors by protocol revision"
implements that split: `2024-11-05` / `2025-03-26` / `2025-06-18` decode a protocol error;
newer revisions decode `isError: true` with no `structuredContent`
(`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/ToolsTest.ts:339-376`).
The toolkit helper still constructs `InvalidParams` internally
(`effect:packages/effect/src/unstable/ai/McpServer.ts:1852-1853`). The July adapter then
catches `InvalidToolInput` and returns `isError: true`
(`effect:packages/effect/src/unstable/ai/internal/mcpProtocol/v2026_07_28.ts:629-637`).

The migration sentence is true of the helper's internal error and false of the 2025-11-25
and 2026-07-28 wire.

### 1.7 Pre-release changeset still says structured content must be a JSON object

`.changeset/pre/mcp-structured-content-object.md` (last touched 2026-09-10, the day before
`#7265`) says:

> McpServer no longer sends `null` or array tool results as `structuredContent`, which MCP
> requires to be a JSON object.

Cite: `effect:.changeset/pre/mcp-structured-content-object.md:5`.

That is still true for June and November: ProtocolAdapters
"should project non-object JSON Toolkit outputs only for the July protocol" asserts those
revisions omit `outputSchema` and `structuredContent` for `"shared"` and `"json-array"`,
then asserts July lists `{ type: "string" }` / array schemas and returns
`structuredContent: "shared-result"` and `["array", null]`
(`effect:packages/effect/test/unstable/ai/McpServer/ProtocolAdapters.test.ts:1495-1551`).
July conformance
"should return primitive structured content when declared by the tool" asserts
`structuredContent === "called"`
(`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/ToolsTest.ts:436-441`).
The typetest accepts a scalar `outputSchema`
(`effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts:31-37`).

The toolkit test "omits structured content for null and array tool results" is a June-default
client (`makeServerLayer` defaults to `[v2025_06_18]`, initialize `"9999-01-01"`)
(`effect:packages/effect/test/unstable/ai/McpServer/TestUtils/McpServerLayer.ts:29`,
`effect:packages/effect/test/unstable/ai/McpServer/McpServer.test.ts:144`,
`effect:packages/effect/test/unstable/ai/McpServer/McpServer.test.ts:1683-1704`).
It does not restore the unqualified changeset sentence.

### 1.8 `McpServer.toolkit` JSDoc still says `AiToolkit`

The layer helper is documented as "Registers an `AiToolkit` with the `McpServer`"
(`effect:packages/effect/src/unstable/ai/McpServer.ts:1934-1938`). The export is
`Toolkit.Toolkit`. `MCP.md` and the rest of the v4 surface use `Toolkit`.

### 1.9 `MCP.md` HTTP sentence is narrower than `layerHttp` JSDoc, and neither shows 2026

`MCP.md` presents `layerHttp` as a 2024-schema compatibility transport used by "the 2025
adapters" (`effect:packages/effect/MCP.md:85-88`). There is no `layerHttp` code sample.

`layerHttp` JSDoc at `a7a71921de` is the better document: POST JSON-RPC, 202 for
notification-only, 400 for routing-header and version errors, 404 for unknown modern
methods, 405 for other HTTP methods, Origin default-deny, no GET SSE, no historical
two-endpoint HTTP+SSE (`effect:packages/effect/src/unstable/ai/McpServer.ts:1512-1534`).
It still never names `v2026_07_28`, `server/discover`, or `subscriptions/listen`.

`McpProtocol.v2024_11_05` **Details** correctly match the HTTP compatibility claim
(`effect:packages/effect/src/unstable/ai/McpProtocol.ts:222-230`). That is not a
contradiction. The gap is that `MCP.md` treats that paragraph as the whole HTTP story.

### 1.10 What is not a contradiction

`MCP.md` is right that `protocols` takes adapters, not version strings
(`effect:packages/effect/MCP.md:81-82`). The typetest rejects `protocols: ["2025-06-18"]`
and empty arrays (`effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts:67-80`).

`MCP.md` is right that `v2024_11_05` on `layerHttp` is not historical two-endpoint HTTP+SSE
(`effect:packages/effect/MCP.md:83-86`,
`effect:packages/effect/src/unstable/ai/McpServer.ts:1530-1534`).

Import paths in `MCP.md` (`effect/unstable/ai`, `@effect/platform-node`) match v4.

`McpServer.elicit` on a June-pinned server, which is what `MCP.md` actually constructs, is
internally consistent. The break is using that page as a 2026-07-28 guide.

## 2. Usage evidence map

For each topic: where Effect demonstrates it (JSDoc example, test name and lines, typetest),
or an explicit doc-gap note. A missing demonstration is not a missing capability.

JSDoc **Example** census for the five named modules:

- `McpServer.ts`, `McpSchema.ts`, `McpProtocol.ts`: **no** `**Example**` blocks.
  `rg` for `@example` / `**Example` in those three files is empty.
- `Tool.ts` and `Toolkit.ts` have many **Example** blocks. They are provider/toolkit
  examples, not MCP server construction. The `Tool.Strict` example disables provider
  JSON-schema strictness (`effect:packages/effect/src/unstable/ai/Tool.ts:1860-1881`) and
  does not mention MCP excess-property rejection.

### 2.1 Stdio server on `v2026_07_28`

| Kind | Where |
| --- | --- |
| Prose / JSDoc example | **Doc-gap.** `MCP.md` stdio samples pin `v2025_06_18`. `layerStdio` has **When to use** / **Details** and no **Example** (`effect:packages/effect/src/unstable/ai/McpServer.ts:1409-1428`). |
| Test | `v2026_07_28.test.ts` "should exchange self-contained newline-delimited requests over stdio" uses `makeMcpStdioHarness(protocol)` with `protocol = McpProtocol.v2026_07_28`, sends `server/discover`, asserts `supportedVersions: ["2026-07-28"]` (`effect:packages/effect/test/unstable/ai/McpServer/v2026_07_28.test.ts:29`, `effect:packages/effect/test/unstable/ai/McpServer/v2026_07_28.test.ts:215-239`). |
| Test | `McpServer.test.ts` describe `"stdio"` / "should deliver stateless request notifications over stdio" (`effect:packages/effect/test/unstable/ai/McpServer/McpServer.test.ts:2477-2506`). |
| Harness | `makeMcpStdioHarness` builds `McpServer.layerStdio({ name, version, protocols })` (`effect:packages/effect/test/unstable/ai/McpServer/TestUtils/McpStdioHarness.ts:97-101`). |
| Typetest | `layerStdio` is callable with a non-empty `protocols` array. The fixture in that file is `[v2025_11_25]`, not July (`effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts:12-16`, `effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts:49-52`). |

### 2.2 `layerHttp` server

| Kind | Where |
| --- | --- |
| Prose / JSDoc example | **Doc-gap** for a copy-paste HTTP server. `MCP.md` mentions `layerHttp` in one paragraph and never shows `path`, `allowedOrigins`, or POST. `layerHttp` JSDoc is the real HTTP guide (`effect:packages/effect/src/unstable/ai/McpServer.ts:1512-1552`). |
| Test harness | `makeServerLayer` is `McpServer.layerHttp({ path: "/mcp", protocols, allowedOrigins: ["https://allowed.example"], instructions, extensions })` (`effect:packages/effect/test/unstable/ai/McpServer/TestUtils/McpServerLayer.ts:24-32`). Almost every HTTP test, including the whole `v2026_07_28.test.ts` conformance layer, goes through it. |
| Test | July lifecycle "should discover the server when no initialization or session exists" POSTs through that HTTP harness (`effect:packages/effect/test/unstable/ai/McpServer/v2026_07_28.test.ts:80-88`). |
| Typetest | `layerHttp` requires `path` and accepts `allowedOrigins` (`effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts:53-57`). |

### 2.3 Handler reading `McpRequestContext`

| Kind | Where |
| --- | --- |
| JSDoc example | **Doc-gap.** `McpRequestContext` has **Details**, no **Example** (`effect:packages/effect/src/unstable/ai/McpSchema.ts:2814-2835`). `MCP.md` never names the service. |
| Typetest | "should expose protocol-neutral request facts without a session service" (`effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts:19-28`). "should expose multi-round-trip input through the request context" (`effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts:154-177`). |
| Test | `McpServer.test.ts` "should provide the neutral request service to handlers" (`effect:packages/effect/test/unstable/ai/McpServer/McpServer.test.ts:1323-1345`). |
| Test | July "should preserve caller metadata alongside authoritative protocol facts" via `RequestMetadataTool` (`effect:packages/effect/test/unstable/ai/McpServer/v2026_07_28.test.ts:406-437`). |
| Test | ProtocolAdapters "should omit a legacy client..." and "should use the current HTTP request when another request registered the resource" (`effect:packages/effect/test/unstable/ai/McpServer/ProtocolAdapters.test.ts:822-898`). |
| Migration | `McpServer.McpServer` note: registration callbacks use `McpRequestContext`; `McpServerClient` only for initialized stateful requests (`effect:migration/v3-to-v4.md:4959`, `effect:migration/annotations/effect__ai__McpSchema.yaml:19-21`). |

### 2.4 MRTR elicitation

| Kind | Where |
| --- | --- |
| JSDoc example | **Doc-gap.** `InputRequired` has **When to use** / **Details**, no **Example** (`effect:packages/effect/src/unstable/ai/McpSchema.ts:2681-2693`). `McpServer.elicit` JSDoc describes form-mode reverse elicitation only (`effect:packages/effect/src/unstable/ai/McpServer.ts:2423-2430`). `MCP.md` shows the reverse helper, not MRTR. |
| Test | `v2026_07_28.test.ts` "should treat an empty elicitation capability as form support": `tools/call` on `MrtrToolName` returns `resultType: "input_required"` with `elicitation/create` (`effect:packages/effect/test/unstable/ai/McpServer/v2026_07_28.test.ts:592-629`). |
| Test | `MultiRoundTripTest.ts` "should return input_required and then complete when prompts/get is retried with client input" (`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/MultiRoundTripTest.ts:107-167`). |
| Typetest | constructing `InputRequired` with `inputRequests` or `requestState`; empty `{}` is not constructable (`effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts:154-177`). |
| Changeset | **Doc-gap.** `.changeset/modern-mice-discover.md` is one sentence and does not mention MRTR (`effect:.changeset/modern-mice-discover.md:5`). |

### 2.5 `subscriptions/listen`

| Kind | Where |
| --- | --- |
| JSDoc example | **Doc-gap** (no code sample). `v2026_07_28` **Details** do name the method: "When the selected transport supports server notifications, discovery advertises change-notification capabilities and `subscriptions/listen` delivers the requested notifications over the long-lived response" (`effect:packages/effect/src/unstable/ai/McpProtocol.ts:181-191`). `MCP.md` does not mention subscriptions. |
| Test | `SubscriptionsTest.ts` suite, composed from `v2026_07_28.test.ts:74`. Names include "should advertise supported subscription capabilities when features are registered" (`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/SubscriptionsTest.ts:154-165`), "should deliver a change notification when its kind is requested" (`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/SubscriptionsTest.ts:386-415`), "should deliver a resource update when its URI is subscribed" (`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/SubscriptionsTest.ts:417`). |
| Test | `McpServer.test.ts` mixed HTTP "should isolate request notifications across mixed HTTP protocols" POSTs `subscriptions/listen` (`effect:packages/effect/test/unstable/ai/McpServer/McpServer.test.ts:782-801`). |

### 2.6 Non-object structured output

| Kind | Where |
| --- | --- |
| JSDoc example | **Doc-gap.** `CallToolResult.structuredContent` is `optional(Schema.Json)` (`effect:packages/effect/src/unstable/ai/McpSchema.ts:1692-1695`) with no example of a string or array value. `MCP.md` tool samples use `success: Schema.String` / `Schema.Number` and never mention `structuredContent`. |
| Typetest | "should accept scalar tool output schemas while keeping inputs object-rooted" (`effect:packages/effect/typetest/unstable/ai/McpServer.tst.ts:31-37`). |
| Test | ProtocolAdapters "should project non-object JSON Toolkit outputs only for the July protocol" (`effect:packages/effect/test/unstable/ai/McpServer/ProtocolAdapters.test.ts:1495-1551`). |
| Test | ToolsTest.statelessModernSuite "should list a non-object output schema when the tool declares one" and "should return primitive structured content when declared by the tool" (`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/ToolsTest.ts:416-441`). |
| Stale changeset | `.changeset/pre/mcp-structured-content-object.md` (see §1.7). |

### 2.7 Strict tool

| Kind | Where |
| --- | --- |
| JSDoc example | **Doc-gap for MCP.** `Tool.Strict` **Example** (Disabling strict JSON schema mode) is the provider `strict: false` flag (`effect:packages/effect/src/unstable/ai/Tool.ts:1860-1881`). It does not mention MCP `additionalProperties: false` or excess-property rejection. |
| Changeset | `.changeset/strict-mcp-tool-inputs.md` is the MCP-facing write-up (`effect:.changeset/strict-mcp-tool-inputs.md:5-13`). |
| Test | "advertises closed strict input schemas with escaped identifiers" (`effect:packages/effect/test/unstable/ai/McpServer/McpServer.test.ts:1446-1463`). |
| Test | "validates strict return-mode arguments before invoking the handler and decodes them once" (`effect:packages/effect/test/unstable/ai/McpServer/McpServer.test.ts:1465-1499`). Fixture: `StrictObjectTool` `.annotate(Tool.Strict, true)` (`effect:packages/effect/test/unstable/ai/McpServer/McpServer.test.ts:50-56`). |
| Test | "dies on strict raw JSON Schema tools before registering any tools" (`effect:packages/effect/test/unstable/ai/McpServer/McpServer.test.ts:1502-1527`). |
| Migration | `registerToolkit` / `toolkit` notes mention strict tools (`effect:migration/v3-to-v4.md:4975`, `effect:migration/v3-to-v4.md:4981`). |

### 2.8 Declared failure in error and return modes

| Kind | Where |
| --- | --- |
| JSDoc example | **Doc-gap in MCP modules.** `Toolkit` **Example** (Reading a handler failure's origin) shows `failureMode: "error"` and `Toolkit.FailureOrigin` (`effect:packages/effect/src/unstable/ai/Toolkit.ts:241-278`). It is not an MCP `isError` example. `CallToolResult` **Details** quote the spec rule that tool errors SHOULD be `isError: true` rather than protocol errors (`effect:packages/effect/src/unstable/ai/McpSchema.ts:1678-1684`). `MCP.md` tools only show `Effect.succeed`. |
| Changeset | `.changeset/strict-mcp-tool-inputs.md:9` and `.changeset/pre/report-mcp-tool-failures.md:5`. |
| Test | Fixtures: `PublicFailureTool` (Error instance, default error mode) and `StructuredFailureTool` (`failureMode: "error"`) (`effect:packages/effect/test/unstable/ai/McpServer/McpServer.test.ts:58-71`). |
| Test | "returns schema-validated messages for declared handler failures" (`effect:packages/effect/test/unstable/ai/McpServer/McpServer.test.ts:1707-1721`). |
| Test | "encodes declared non-Error failures without structured content or internal diagnostics" (`effect:packages/effect/test/unstable/ai/McpServer/McpServer.test.ts:1724-1736`). |
| Test | `"distinguishes ${origin} failures from decoding failures in ${failureMode} mode"` loops `handler/error`, `handler/return`, encoding, invalid-result (`effect:packages/effect/test/unstable/ai/McpServer/McpServer.test.ts:1756-1816`). Error mode uses `Error.message`; return mode uses the encoded payload. |
| Test | Conformance "MUST return tool execution failures with isError" (`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/ToolsTest.ts:240-245`). |

### 2.9 Resources and prompts with titles

| Kind | Where |
| --- | --- |
| JSDoc example | **Doc-gap.** `McpServer.prompt` / `registerPrompt` accept `title?: string` (`effect:packages/effect/src/unstable/ai/McpServer.ts:2268`, `effect:packages/effect/src/unstable/ai/McpServer.ts:2405`) with no **Example**. `McpServer.resource` / `registerResource` option types omit `title` (`effect:packages/effect/src/unstable/ai/McpServer.ts:2003-2016`, `effect:packages/effect/src/unstable/ai/McpServer.ts:2183-2195`) even though `McpSchema.Resource.title` exists (`effect:packages/effect/src/unstable/ai/McpSchema.ts:913`). `MCP.md` resource and prompt samples have `name` only. |
| Changeset | Prompt titles only: `.changeset/mcp-prompt-titles.md:5`. No matching resource-title changeset. |
| Test (prompts) | Fixtures register `McpServer.prompt({ name: "TestPrompt", title: "Test prompt", ... })` (`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/McpConformanceFixtures.ts:517-520`). PromptsTest "SCHEMA preserves prompt names, titles, descriptions, and arguments" asserts `title === "Test prompt"` except on `2024-11-05` / `2025-03-26` (`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/PromptsTest.ts:91-112`). |
| Test (tools, not resources) | ProtocolAdapters low-level `McpSchema.Tool({ title: "Canonical title", annotations: { title: "Legacy annotation title" } })` and "should prefer the canonical title when projecting March annotations" (`effect:packages/effect/test/unstable/ai/McpServer/ProtocolAdapters.test.ts:323-334`, `effect:packages/effect/test/unstable/ai/McpServer/ProtocolAdapters.test.ts:1367`). |
| Test (resource_link, not `McpServer.resource`) | `title: "Linked resource"` on a `resource_link` content block (`effect:packages/effect/test/unstable/ai/McpServer/ProtocolAdapters.test.ts:505-509`). |
| Resource helper demo | **Doc-gap.** No test in `packages/effect/test/unstable/ai/McpServer` calls `McpServer.resource({ title: ... })`. Resource icons are demonstrated via the low-level registry (`effect:packages/effect/test/unstable/ai/McpServer/ProtocolAdapters.test.ts:1736-1741`). |

`Tool.Title` **Example** (Annotating a tool title) exists
(`effect:packages/effect/src/unstable/ai/Tool.ts:1716-1728`) and is a provider/MCP-hint
annotation, not `McpServer.resource` / `McpServer.prompt`.

### 2.10 Server `instructions`

| Kind | Where |
| --- | --- |
| JSDoc example | **Doc-gap.** `run` / `layer` / `layerStdio` / `layerHttp` all take `instructions?: string` (`effect:packages/effect/src/unstable/ai/McpServer.ts:677`, `effect:packages/effect/src/unstable/ai/McpServer.ts:1376`, `effect:packages/effect/src/unstable/ai/McpServer.ts:1433`, `effect:packages/effect/src/unstable/ai/McpServer.ts:1545`) with no **Example**. `MCP.md` never passes `instructions`. `InitializeResult.instructions` has field docs (`effect:packages/effect/src/unstable/ai/McpSchema.ts:772-779`). |
| Changeset | `.changeset/mcp-server-instructions.md:5`. |
| Test | Conformance fixtures: `makeServerLayer({ instructions: "Follow the test server instructions.", ... })` (`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/McpConformanceFixtures.ts:548-551`). |
| Test | LifecycleTest "returns configured server instructions" (`effect:packages/effect/test/unstable/ai/McpServer/McpConformance/LifecycleTest.ts:17-22`). |
| Test | July "should discover the server when no initialization or session exists" asserts the same string on `server/discover` (`effect:packages/effect/test/unstable/ai/McpServer/v2026_07_28.test.ts:80-88`). |

### 2.11 Adjacent gaps (not in the required map, recorded because they sit on the same page)

- `websiteUrl` and `icons` are constructor options (`effect:packages/effect/src/unstable/ai/McpServer.ts:1378-1379`) and are tested ("should expose implementation metadata and descriptor icons when supported by the protocol", `effect:packages/effect/test/unstable/ai/McpServer/ProtocolAdapters.test.ts:1713-1750`). `.changeset/pre/add-mcp-icons.md` covers icons. `MCP.md` is silent.
- `.changeset/modern-mice-discover.md` is the only 2026-07-28 changeset and does not mention statelessness, `server/discover`, dropped `initialize`, MRTR, or `subscriptions/listen`.
- `.changeset/pre/add-mcp-2025-11-25-protocol.md` tells the reader to add `McpProtocol.v2025_11_25`. `MCP.md` never does.
- Migration examples for `layer` / `layerHttp` / `layerStdio` / `run` all still say `[McpProtocol.v2025_06_18]` (`effect:migration/annotations/effect__ai__McpServer.yaml:1-14`, `effect:migration/v3-to-v4.md:4961-4967`).

## 3. Upstream docs PR outline

Optional lane from the `beep-effect/effect` fork. This is a proposal, not a decision.
Tradeoffs that contradict G4 are labeled.

Suggested title: "docs(ai): document MCP 2026-07-28 and the current McpServer options".

Do not rewrite `MCP.md` as a spec. Keep it a getting-started page and point at tests for
wire cases.

### 3.1 Introduction

Keep the MCP / Effect sentence. Add one line that `McpProtocol` currently implements
`"2024-11-05" | "2025-03-26" | "2025-06-18" | "2025-11-25" | "2026-07-28"`, and that
`2026-07-28` is the only stateless revision. Cite `McpProtocol.ts:25` and `:33` in the
PR body, not in the user-facing page.

### 3.2 Getting Started

Replace the protocol pin. Three options, operator chooses:

1. **G4-aligned (contradicts current `MCP.md`).** `protocols: [McpProtocol.v2026_07_28]`.
   Copy-paste then matches beep-effect's working assumption. Cost: any client that still
   sends `initialize` over stdio gets method-not-found (see §1.5). The elicitation section
   cannot keep `McpServer.elicit` (see §1.4).
2. **Mixed list (contradicts G4, matches upstream runtime).**
   `protocols: [McpProtocol.v2026_07_28, McpProtocol.v2025_11_25]` or June. Matches
   Effect's "at most one stateless adapter" design (Gate A). Cost: beep-effect hosts that
   wanted a single protocol have to ignore the example.
3. **Keep June as hello-world, add a second listing.** Lowest churn. Cost: G4 readers
   still copy the wrong pin, which is today's failure.

Fix the logger to the pattern Logger's own JSDoc already shows:
`Logger.layer([Logger.consolePretty()])` plus `Layer.succeed(Logger.LogToStderr, true)`.
Delete `{ stderr: true }`. Keep `Logger.LogToStderr` in the complete example and restore
`Logger.layer` there so the two samples agree.

Add `instructions: "..."` on `layerStdio` so the option is visible in the first sample.

Replace the "this release supports three adapters" sentence with the five-member list and
one sentence that `v2024_11_05` on `layerHttp` is still the compatibility transport (keep
the existing two-endpoint disclaimer).

### 3.3 Resources

Keep the static and template samples. Add an optional `title` only if the helper types
gain `title?: string` in the same PR (today they do not; adding it to the page without the
type is another contradiction). If the helper is left unchanged, say that `title` / `icons`
live on `McpSchema.Resource` and the low-level `addResource` path, and that
`McpServer.resource` currently types `name`, `description`, `mimeType`, `audience`,
`priority`, `content`.

### 3.4 Prompts

Add `title: "Demo Prompt"` to the sample. That option already exists and is tested.
One sentence: titles are omitted on `2024-11-05` and `2025-03-26` projections
(PromptsTest:109-111).

### 3.5 Tools and Toolkit

Keep `Tool.make` / `Toolkit.make` / `McpServer.toolkit`. Add a short "MCP-facing
annotations" subsection, not a second tutorial:

- `Tool.Strict` on an Effect Schema closes `additionalProperties` and rejects excess
  properties. Raw JSON Schema dynamic tools cannot be strict (dies at registration).
- Declared `failure` values become `isError: true` with no `structuredContent`.
  `failureMode: "error"` uses `Error.message` or encoded text; `"return"` uses the encoded
  payload. Parameter validation is `InvalidParams` through June and `isError: true` from
  2025-11-25 on.
- `success` that is not a JSON object is `structuredContent` only on `v2026_07_28`.

Point at `McpServer.test.ts` `registerToolkit` and ProtocolAdapters rather than duplicating
those tests in the page.

### 3.6 Elicitation requests (split)

Keep the current `McpServer.elicit` sample, labeled **stateful protocols only**
(`v2025_06_18` and `v2025_11_25` form/URL). State the requirement: `McpServerClient`, which
July does not provide.

Add a second sample, **2026-07-28 MRTR**: handler returns
`new McpSchema.InputRequired({ inputRequests: { approval: { method: "elicitation/create", params } } })`
and completes on the retry that carries `inputResponses`. Cite MultiRoundTripTest and the
July "empty elicitation capability" test in the PR body.

If the operator picks Getting Started option 1 (July-only), drop or demote the
`McpServer.elicit` sample so the page does not teach a helper the constructed server cannot
run.

### 3.7 New section: HTTP (`layerHttp`)

A short copy-paste: `McpServer.layerHttp({ name, version, path: "/mcp", protocols, allowedOrigins })`
merged into an `HttpRouter`. Restate, without inventing runtime facts, the behaviors already
in `layerHttp` JSDoc: POST only, 405 otherwise, Origin default-deny, no GET SSE. Point at
`makeServerLayer` as the in-tree example.

### 3.8 New section: 2026-07-28 differences (one page, not a spec)

Bullet list, each already proven by tests this lane cited:

- No `initialize`. Clients send `server/discover` or a self-contained request with
  `_meta` / routing headers.
- No `McpServerClient` in handlers. Read `McpRequestContext`.
- Notifications go through `subscriptions/listen` when the transport can deliver them.
- Tool/prompt continuation uses `InputRequired` / `inputResponses` / `requestState`.

Do not re-document header mirroring, HeaderMismatch codes, or cache envelopes. Those belong
in 11-u2 and in the tests.

### 3.9 Complete Working Example

Same protocol choice as §3.2. Include `instructions`. Include one prompt `title`. Do not
add MRTR to the copy-paste unless option 1 is chosen; keep the complete example runnable
without a custom client retry loop.

### 3.10 JSDoc follow-ups in the same PR (small, high leverage)

1. Add a **Example** to `layerStdio` and `layerHttp` that matches the chosen pin.
2. Correct `layerStdio` **Details**: `McpServerClient` is supplied for initialized
   stateful requests only.
3. Rename `toolkit` JSDoc "AiToolkit" to `Toolkit`.
4. Add a **Example** to `InputRequired` and a **Gotchas** on `McpServer.elicit` pointing at
   it for `v2026_07_28`.
5. Either add `title?: string` (and `icons?`) to `resource` / `registerResource` options, or
   document in those JSDoc blocks that titles are low-level only.
6. Extend `Tool.Strict` **Details** with one sentence that MCP registration also honors the
   annotation as excess-property rejection. Leave the existing provider example.

### 3.11 Migration and changesets

- Update `migration/annotations/effect__ai__McpServer.yaml` examples from
  `[McpProtocol.v2025_06_18]` to mention `v2025_11_25` and `v2026_07_28`.
- Qualify the `registerToolkit` InvalidParams sentence with the 2025-11-25 wire split.
- Expand `.changeset/modern-mice-discover.md` before it is consumed, or accept that rc
  notes already shipped the one-liner. Expanding it is only useful if the next Effect
  release has not yet eaten the file.
- Do not silently rewrite `.changeset/pre/mcp-structured-content-object.md`; it is
  historical. A new changeset can say July allows non-object `structuredContent`.

### 3.12 What not to put in `MCP.md`

- Origin middleware vs CORS lists, 405 tables, NDJSON batch policy, stdio framing. Those
  are 11-u2 / 24-r5.
- beep-effect host inventory. That is 21-r2.
- A promise that `v2026_07_28`-only servers interoperate with every editor. Effect's tests
  prove Effect. They do not prove Cursor.

## Open questions this lane cannot answer

See `12-u3-effect-guidance.summary.json` `grillQuestions`.

## Gate B verdicts (2026-09-17)

Three grok refuters voted on 10 claims from this lane (9 survive, 1 killed; per-vote detail in `verification/12-u3-effect-guidance.verdicts.jsonl`).

Struck claims (2 of 3 refuted):

- ~~`12-u3-effect-guidance-25` (decision-challenge): G4 (v2026_07_28 only) cannot be implemented by copying Effect's published MCP.md recipe. Upstream tests show mixed lists and InputRequired instead. That is an implementability challenge to the working assumption, not a missing Effect capability.~~
  - Refuters: Cannot copy MCP.md to get G4, and July elicitation is InputRequired plus retry. But 'upstream tests show mixed lists instead' is wrong for G4: the cited v2026_07_28 and MultiRoundTrip tests use protocols: [v2026_07_28] only. Mixed lists would not implement a July-only server.
