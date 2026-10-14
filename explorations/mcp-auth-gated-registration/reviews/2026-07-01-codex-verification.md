# Codex re-verification — 2026-07-01 (align-stage grill)

Three read-only Codex sub-agents re-verified every load-bearing code fact the
Q1–Q7 recommendations rest on, against current HEAD (`.repos/effect-v4` @
`31ae48e3a9`; `McpServer.ts`/`Toolkit.ts` untouched by the latest subtree
bump). Verdict: **all claims CONFIRMED**, three corrections. This file is the
evidence record the graduated goal SPEC should cite.

## Corrections to RESEARCH.md (2026-06-29)

1. **Effect pin is `4.0.0-beta.92`, not beta.91** (root `package.json:158`;
   `.repos/effect-v4/packages/effect/package.json:4`). All verified behaviors
   identical in both `node_modules/effect/src/ai/*` and the subtree.
2. **NLP capability path** is `packages/foundation/capability/nlp-processing`
   (`@beep/nlp-processing`) — RESEARCH's `foundation/capability/nlp` shorthand
   is stale. Its `src/Tools/NlpToolkit.ts` is the toolkit `@beep/nlp-mcp`
   mounts. (A separate `packages/foundation/modeling/nlp` also exists.)
3. **The ~25k `documentBag` token concern is not documented in-repo** — it
   derives from external research (Claude Code `MAX_MCP_OUTPUT_TOKENS`).
   `documentBag` itself: `packages/drivers/uspto/src/Uspto.service.ts:116,327`.

## Effect `effect/ai` internals (Q6/Q7 substrate) — all CONFIRMED

- **`failureMode:"return"` ships as `isError:false`.** `McpServer.ts:717-728`
  `Effect.matchCause`: `onFailure → CallToolResult({isError:true,…})`,
  `onSuccess → CallToolResult({isError:false,…})`. Upstream
  `Toolkit.ts:364-366` converts a `"return"`-mode typed failure into a Stream
  *success* (`Stream.succeed({result: normalizedError, isFailure: true, …})`),
  so it always lands in `onSuccess`. `isError:true` fires only on a failed
  Effect cause.
- **`EnabledWhen` filters `tools/list` only.** List side:
  `McpServer.ts:1395-1399` → `filterByClient(…)`, predicate read at `:1450`
  (`Context.getOrUndefined(item.annotations, EnabledWhen)`). Call side:
  `"tools/call"` → `callTool` at `McpServer.ts:255-262` — raw name→handler map
  lookup, no annotation re-check. A disabled-but-registered tool remains
  callable via `tools/call`.
- **Toolkit span leaks raw parameters.** `Toolkit.ts:263-265`
  `Effect.annotateCurrentSpan({tool: name, parameters: params})` runs *before*
  schema decode — raw caller input verbatim on the span. Confirms the
  span-hygiene violation vs `standards/architecture/12-observability.md` §3.
- **Protocol pin `2025-06-18`.** `McpServer.ts:336-341`
  `LATEST_PROTOCOL_VERSION = "2025-06-18"`; supported: `2025-03-26`,
  `2024-11-05`, `2024-10-07`. `2025-11-25` appears nowhere in the module.

## In-repo landscape (Q1/Q2/Q4 substrate) — all CONFIRMED

- **`@beep/nlp-mcp` seam**: `packages/drivers/nlp-mcp/src/Server.ts:101-107` —
  `Layer.mergeAll(McpServer.toolkit(NlpToolkit).pipe(Layer.provide(WinkNlpToolkitLive)), McpServer.toolkit(StreamingToolkit).pipe(Layer.provide(StreamingToolkitHandlersLive))).pipe(Layer.provide(McpServer.layerStdio({…})), Layer.orDie)`.
  `@beep/m365-mcp` same pattern single-toolkit (`Server.ts:45-55`).
- **Neither host imports any gov-legal driver** (grep for
  `gov-legal|uspto|courtlistener|govinfo|dol` over both `src/` → zero hits) —
  domain-specific hosts, not a shared gov-legal host.
- **No `@beep/mcp-*` package exists** (workspace package.json name grep → 0);
  `packages/drivers/` (33 dirs) has no shared MCP kit.
- **`@beep/uspto` is the Shape-C precedent**: `Uspto.config.ts:46`
  (`apiKey: S.optionalKey(S.String.pipe(S.RedactedFromValue))`),
  `Uspto.service.ts:199` (`O.Option<Redacted.Redacted<string>>`),
  `:398` (`Config.redacted("USPTO_API_KEY").pipe(Config.option)`),
  `:249-255` — `X-API-KEY` set only when the key is `Some` **and** the request
  targets the configured USPTO origin (same-origin scoping beyond mere
  presence — port this discipline into the kit).

## Governance/audit substrate (Q7 substrate) — all CONFIRMED

- **`@beep/epistemic-tables` has no `Activity` table** (`rg -c "Activity"` →
  0 hits). `UsageRecord` table: `src/entities/UsageRecord/UsageRecord.table.ts:24`;
  schema aggregate `src/Schema.ts:28`.
- **`UsageRecord.metadata` is jsonb**:
  `packages/epistemic/domain/src/entities/UsageRecord/UsageRecord.model.ts:69`
  (`metadata: UnknownRecord`), persisted `:95-97`
  (`EntitySchema.persist.jsonb({columnName: "metadata"})`); dtslint asserts
  `storageKind === "jsonb"`.
- **`ClaimGate` is a total engine**:
  `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.ports.ts:42-47` —
  `evaluate(...) => Effect.Effect<ClaimGateResult>` (error channel `never`);
  doc: "Rejection is a value, never an error."
- **No shared optional-secret helper exists** — the
  `Config.redacted(X).pipe(Config.option)` idiom repeats inline in 7 drivers
  (`uspto:398`, `govinfo:123`, `xai:1037-1038`, `hubspot:527`, `sanity:390`,
  `runpod:836`, `phoenix:628`). Evidence that the kit's `SourceAuth` gate
  registry has real consolidation value for MCP gating (scope note: the kit
  reads this credential class; it does not become a repo-wide config helper).
