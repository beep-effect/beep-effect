# Tool-definition annotation & routing conventions

Scope: how MCP-spec tool annotations + `effect/ai` `Tool`/`Toolkit` + `effect/Schema` `$I.annote`/`annotateKey` surface readOnly/idempotent/openWorld hints, USE-WHEN routing prose, typed registries, and schema-validated dispatch — and how to codify one convention across `@beep/nlp-mcp` and `@beep/m365-mcp`.

## Findings

### MCP spec: the annotation vocabulary (the wire contract we emit)

- The MCP `Tool` data type carries an optional `annotations` object beside `name`, `title`, `description`, `inputSchema`, `outputSchema`. The five annotation fields are `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`. Source: MCP spec 2025-06-18 "Tools" — https://modelcontextprotocol.io/specification/2025-06-18/server/tools (this is the current protocol revision the server targets).
- **Exact defaults (conservative):** `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: false`, `openWorldHint: true`. So an *unannotated* tool is treated as a writing, potentially-destructive, non-idempotent, open-world tool. Verified across three independent sources: the MCP design blog "Tool Annotations as Risk Vocabulary" (2026-03-16) — https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/ ; the search-summarized spec schema ("destructiveHint defaults to true … openWorldHint defaults to true"); and the effect source `Context.Reference` default values (below), which match field-for-field.
- **Annotations are hints, not security.** The spec marks them untrusted: "clients **MUST** consider tool annotations to be untrusted unless they come from trusted servers" (MCP spec, Data Types → Tool). The design blog is blunter: "A server can claim `readOnlyHint: true` and delete your files anyway… keep your actual safety guarantees in deterministic controls" — https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/ . Implication for the auth-gate packet: tier-gating / write-vs-read enforcement must be a real Layer/dispatch gate, NOT the hint; the hint only drives host UX (auto-approve read-only, confirm destructive).
- Tool I/O: results carry both unstructured `content[]` and optional `structuredContent` (must conform to `outputSchema` if present); execution errors are reported in-band with `isError: true`, distinct from JSON-RPC protocol errors (`-32602` etc.). Source: MCP spec 2025-06-18, "Tool Result"/"Error Handling" — https://modelcontextprotocol.io/specification/2025-06-18/server/tools . This matches the gold pattern of returning structured `{error: api_key_required, …}` content rather than throwing (CAPTURE netNew #3 / mcp-uspto#2).

### effect/ai: how the repo declares annotations (the canonical surface)

- `effect@4.0.0-beta.91` ("effect-smol"; `package.json`) ships `Tool` and `Toolkit` under `effect/ai`, and the MCP server under `effect/ai/McpServer`. Confirmed by repo imports: `packages/drivers/m365-mcp/src/M365Tools.ts:38` (`import { Tool, Toolkit } from "effect/ai"`) and `Server.ts:11` (`import * as McpServer from "effect/ai/McpServer"`). NOTE: the public docs site (`effect-ts.github.io/effect/ai/ai/Tool.ts.html`, `@effect/ai`) documents the *legacy* v3 package — the v4 `effect/ai` API is the ground truth here, read from `node_modules/effect/src/ai/Tool.ts`.
- `Tool.make("name", { description?, parameters?, success?, failure?, failureMode?, dependencies? })` builds the tool; annotations are layered with a fluent `.annotate(Key, value)`. Verified shape: `node_modules/effect/src/ai/Tool.ts` and repo usage `M365Tools.ts:93-103`.
- The hint annotation keys are `Context.Reference`s whose default values **exactly equal the MCP defaults**, so omitting an annotation produces the spec default (`node_modules/effect/src/ai/Tool.ts:1781-1857`):
  - `Tool.Readonly` = `Context.Reference<boolean>("effect/ai/Tool/Readonly", { defaultValue: constFalse })` → MCP `readOnlyHint` (default false).
  - `Tool.Destructive` = `…("effect/ai/Tool/Destructive", { defaultValue: constTrue })` → `destructiveHint` (default **true** — annotate `false` for safe tools).
  - `Tool.Idempotent` = `…("effect/ai/Tool/Idempotent", { defaultValue: constFalse })` → `idempotentHint` (default false).
  - `Tool.OpenWorld` = `…("effect/ai/Tool/OpenWorld", { defaultValue: constTrue })` → `openWorldHint` (default true).
  - The jsdoc on each (lines 1766/1790/1815/1840) states verbatim: "This is emitted as the MCP `readOnlyHint`/`destructiveHint`/`idempotentHint`/`openWorldHint`".
- Two more annotation keys matter for this packet: `Tool.Title` (`Context.Service<…,string>("effect/ai/Tool/Title")`, → MCP `title`) and `Tool.Meta` (`Context.Service<…, Record<string, unknown>>("effect/ai/Tool/Meta")`) which becomes the MCP `_meta` record (`Tool.ts:1742,1759`; `M365Tools` does not use them yet). **`Tool.Meta` is the effect-native carrier for non-spec metadata** — `category`, `requiresAuth`, `tier`, `registrationUrl` can ride there without inventing a sidecar registry. There is also `Tool.Strict` (`"effect/ai/Tool/Strict"`, default `undefined`) controlling strict JSON-Schema mode for provider structured outputs (`Tool.ts:1884`).
- **Where the mapping is realized:** `McpServer` reads each annotation off the tool's `Context` and writes the MCP tool, 1:1 (`node_modules/effect/src/ai/McpServer.ts:692-705`):
  ```
  inputSchema: Tool.getJsonSchema(tool),
  annotations: {
    ...(Title → { title }),
    readOnlyHint:    Context.get(tool.annotations, Tool.Readonly),
    destructiveHint: Context.get(tool.annotations, Tool.Destructive),
    idempotentHint:  Context.get(tool.annotations, Tool.Idempotent),
    openWorldHint:   Context.get(tool.annotations, Tool.OpenWorld)
  },
  _meta: toolMeta            // ← Context.getOrUndefined(annotations, Tool.Meta)
  ```
  This is the single chokepoint that proves the effect annotations *are* the MCP annotations — no adapter prose needed.

### Descriptions, per-field metadata, and JSON Schema (the routing-prose surface)

- A tool's `description` resolves explicit-first, then falls back to the parameters schema's AST description: `getDescription` returns `tool.description` if set, else `SchemaAST.resolveDescription(tool.parametersSchema.ast)` (`Tool.ts:1637-1645`). So USE-WHEN/DO-NOT-USE routing prose lives in the `description` string (or the params-schema description) — there is **no structured "use-when" field**; it is free text the host injects into the model prompt.
- `inputSchema` is generated by `Tool.getJsonSchema(tool)` → `getJsonSchemaFromSchema(tool.parametersSchema)` → effect `JsonSchema.JsonSchema` (`Tool.ts:1688-1712`). Per-field descriptions/enums/defaults therefore come straight from the parameters schema annotations.
- The repo's per-field convention is already established with `S.<T>.annotateKey({ description: "…" })` — e.g. `m365-mcp/src/M365Tools.ts:66-80` and `nlp-mcp/src/StreamingTools.ts:59-120`. Schema-level identity+description uses the identity composer: `$I.annote("Name", { description })` (`M365Tools.ts:82-84`) where `$I = $M365McpId.create("M365Tools")`. The composer (`packages/foundation/modeling/identity/src/Id.ts`) exposes the `n`/`nSchema`/`nKey`/`nHttp` family (and `ln*` literal variants) producing `S.Annotations.Key`-shaped records; `annote`/`annoteSchema` are the package-scoped aliases used in the MCP code. This satisfies CAPTURE netNew #5 "per-field descriptions/enums/defaults" — port Zod `.describe()`/`.default()` (us-legal-tools#5) into `annotateKey`.
- Anthropic (the host) confirms description quality is high-leverage, not cosmetic: precise tool-description refinement drove Claude Sonnet to SOTA on SWE-bench Verified and "dramatically reduc[ed] error rates"; descriptions should state *what it does and when to use it*, third-person, with concrete `input_examples`. Source: Anthropic, "Writing tools for AI agents" — https://www.anthropic.com/engineering/writing-tools-for-agents and Claude "Define tools" docs — https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools . This is the primary-source backing for adopting the screenpipe USE-WHEN / DO-NOT-USE + sibling cross-ref + "Start with limit=5" prose convention (CAPTURE screenpipe#1, mike#2).

### Current repo state — the standardization gap (filesystem-grounded 2026-06-29)

- **Only `@beep/m365-mcp` annotates the four hints.** All 11 read tools carry `.annotate(Tool.Readonly,true).annotate(Tool.Destructive,false).annotate(Tool.Idempotent,true).annotate(Tool.OpenWorld,true)` (`M365Tools.ts:100-103`, repeated). Grep for `Tool.Readonly|Idempotent|OpenWorld|Destructive` across `packages/**` returns **only** `m365-mcp`.
- **The NLP server does NOT annotate hints.** The `NlpToolkit` tools live in `packages/foundation/capability/nlp/src/Tools/*` (Analyze, BagOfWords, CreateCorpus, DeleteCorpus, …) and the streaming tools in `nlp-mcp/src/StreamingTools.ts`; none call `.annotate(Tool.*)`. They DO use `annotateKey({description})` for fields. So per-field descriptions are consistent across both servers, but **hint annotations are not** — and `nlp` has genuine asymmetry to encode (e.g. `DeleteCorpus`/`CreateCorpus` are NOT read-only/non-destructive, unlike every m365 tool). This is the concrete convergence target for this packet.
- **No routing prose, no registry, no auth field exists yet.** Grep across `packages/**` for `USE WHEN` / `DO NOT USE` / `Start with limit` → **zero hits**; for `requiresAuth` / `ToolMetadata` / `ToolRegistry` / `api_key_required` / `keyMissing` → **zero hits**. Confirms CAPTURE: these (netNew #2, #3, #5) are genuine gaps, not re-scaffolds.

### Typed registry & schema-validated dispatch (effect-native shapes)

- `effect/ai` already gives the registry-and-validation spine the research-squad nugget hand-rolls: a `Toolkit.make(...tools)` is the typed registry (each `Tool` is name-keyed with typed `parameters`/`success`/`failure`), and `McpServer` validates `tools/call` arguments against the parameters Schema before dispatch and validates results against `success`. So `withInputValidation(schema, toolName)` is largely **subsumed** — the bespoke wrapper is only needed where you dispatch *outside* the toolkit handler or want a custom error shape.
- **`requiresAuth`/`category` are net-new and have two clean homes:** (a) `Tool.Meta` annotation (rides to MCP `_meta`, visible to hosts) for soft signaling, and/or (b) a parallel typed record keyed by tool name for the *gate* (the real enforcement, per the "hints aren't security" finding). The us-gov-open-data `ModuleMeta { auth?: { envVar: string|string[]; signup } }` contract (CAPTURE us-gov-open-data-mcp#6) is the schema to port for conditional registration; `requiresAuth`/`category` (research-squad#4) layer onto it.
- **Error formatting — migration gotcha.** The research-squad pattern uses effect v3 `ParseResult.TreeFormatter.formatErrorSync(e)`. That API does **not** exist in `effect@4.0.0-beta.91`. The v4 equivalents live in `effect/SchemaIssue`: `makeFormatterDefault(): Formatter<string>` (exported `defaultFormatter`) for a human string, and `makeFormatterStandardSchemaV1(): Formatter<StandardSchemaV1.FailureResult>` for structured `{ message, path }[]` issues (`node_modules/effect/src/SchemaIssue.ts:994,1100-1108`; a `Formatter<F>` is just `(issue) => F`, line 846). A `ToolValidationError` should be built with `S.decodeUnknownEffect(parameters)(input).pipe(Effect.mapError(issue => new ToolValidationError({ toolName, issues: makeFormatterStandardSchemaV1()(issue).issues })))` — NOT `TreeFormatter.formatErrorSync`. The repo's own decode-and-map pattern is in `packages/foundation/modeling/schema/src/Jsonl.ts:64-81` (uses `S.decodeUnknownEffect` + `Effect.mapError`).
- `failureMode: "return"` + a structured `failure` schema (already standard in both servers, e.g. `M365ToolError` `M365Tools.ts:64-95`) is the idiomatic channel for the `api_key_required` graceful-degradation envelope: a typed failure returned in-band as `structuredContent`/`isError`, not thrown.

### Licensing (for any port)

- Per CAPTURE cautions: `patents-mcp-server`, `mcp-uspto`, `uspto_pfw` are MIT and portable; `mike`, `screenpipe`, `harvest-mcp` are unknown/flagged license → reimplement the *prose/shape*, do not copy source. The USE-WHEN convention (screenpipe) and field-tier convention (uspto_pfw, MIT) should both be re-authored as effect-native conventions, which this packet does regardless.

## Sources

- MCP spec 2025-06-18, Server → Tools (annotations, defaults, untrusted, result/error shapes): https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- MCP design blog, "Tool Annotations as Risk Vocabulary" (2026-03-16; hints-not-security, conservative defaults): https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/
- MCPBlog.dev, "MCP Tool Annotations: What They Are…" (2026-03-13, corroborating field meanings): https://mcpblog.dev/blog/2026-03-13-mcp-tool-annotations
- Anthropic Engineering, "Writing tools for AI agents" (description quality / SWE-bench): https://www.anthropic.com/engineering/writing-tools-for-agents
- Claude Platform Docs, "Define tools" (description = what + when, third-person, input_examples): https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
- effect v4 source (ground truth, installed `effect@4.0.0-beta.91`): `node_modules/effect/src/ai/Tool.ts` (annotations 1724-1886; getDescription 1637; getJsonSchema 1688-1712), `node_modules/effect/src/ai/McpServer.ts:692-705` (annotation→MCP mapping), `node_modules/effect/src/SchemaIssue.ts:846,994,1100-1108` (Formatter API)
- Repo current state: `packages/drivers/m365-mcp/src/M365Tools.ts` (annotated hints + annote/annotateKey), `packages/drivers/nlp-mcp/src/StreamingTools.ts` (annotateKey, no hints), `packages/foundation/capability/nlp/src/Tools/*` (no hints), `packages/foundation/modeling/identity/src/Id.ts` (`n`/`nKey`/`nSchema` annotation composer), `packages/foundation/modeling/schema/src/Jsonl.ts:64-81` (decode+mapError pattern)
- CAPTURE.md nuggets (anchors): screenpipe#1, agentmemory#8, us-legal-tools#5, research-squad#4, patent-search-mcp-server#5, mcp-uspto#2, us-gov-open-data-mcp#6, uspto-patents-mcp#4

## Open / Unverified

- **Title default / omission behavior:** McpServer only emits `title` when `Tool.Title` is set (`Option.getOrUndefined`); whether downstream hosts fall back to `name` for display is host-specific — UNVERIFIED against a specific Claude host build.
- **`Tool.Meta` → MCP `_meta` round-trip:** confirmed McpServer writes `_meta: toolMeta`, but whether Claude/ChatGPT hosts surface or act on arbitrary `_meta` keys (e.g. a `requiresAuth` flag) is UNVERIFIED — treat `_meta` as advisory only; keep the real gate in the dispatch Layer.
- **`annote`/`annoteSchema` exact composer methods:** observed in use (`M365Tools.ts:82`) and confirmed the composer exists in `identity/src/Id.ts`, but the precise public method name (`annote` vs an `n`-family alias on the `.create(...)` sub-composer) was not pinned to its definition line — low risk, it compiles in-repo today.
- **`outputSchema` emission:** effect `Tool` has a `success` schema; whether `McpServer` emits a JSON `outputSchema` field (vs only validating) was not line-verified in this pass — confirm before relying on host-side structured-output validation.
- **PatentsView sunset / ODP base-URL** (CAPTURE caution) is real but out of scope for annotation conventions; flagged for the `uspto-patent-driver-depth` packet.
