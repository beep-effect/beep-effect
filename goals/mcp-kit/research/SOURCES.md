# MCP Kit — Sources & Provenance

Inherited 2026-07-01 at graduation from
[`explorations/mcp-auth-gated-registration`](../../../explorations/mcp-auth-gated-registration/README.md).

- **Source exploration:** `explorations/mcp-auth-gated-registration` — primary
  ledger:
  [`explorations/mcp-auth-gated-registration/research/SOURCES.md`](../../../explorations/mcp-auth-gated-registration/research/SOURCES.md)
  (full 28-nugget corpus with per-nugget `file:line`; this file reproduces the
  implementation-relevant view).
- **Provenance:** gold-intake cluster "MCP server design (conditional
  registration, multi-provider auth, progressive disclosure)"
  ([`_gold-intake/ROUTING.md`](../../../explorations/_gold-intake/ROUTING.md));
  codex reviews
  [`2026-06-29-codex-research.md`](../../../explorations/mcp-auth-gated-registration/reviews/2026-06-29-codex-research.md)
  and
  [`2026-07-01-codex-verification.md`](../../../explorations/mcp-auth-gated-registration/reviews/2026-07-01-codex-verification.md)
  (all load-bearing code facts confirmed against current HEAD; effect pin
  corrected to `4.0.0-beta.92`).

## 1. Mined source corpus (implementation view)

Canonical anchors per kit deliverable — full table in the exploration ledger.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `patents-mcp-server#1` | Conditional tool registration keyed on available credentials | patents-mcp-server | `src/tools/index.ts:12-26` | composition (#1) | reimplement-only (license unresolved) |
| `patents-mcp#4` | Graceful-degradation credential-gated client init | patents-mcp | `src/patent_mcp_server/google/bigquery_client.py:36-57` | composition (#1) | reimplement-only (license unresolved) |
| `us-gov-open-data-mcp#6` | `ModuleMeta` contract with `auth: {envVar, signup}` | us-gov-open-data-mcp | `src/shared/types.ts:106-144` | composition (#1) | port-with-attribution (MIT) |
| `us-legal-tools#9` | Multi-provider env-auth matrix | us-legal-tools | `README.md:252-300` | auth matrix (#1/#3) | port-with-attribution (MIT) |
| `mcp-uspto#2` | `keyMissingResponse` — `api_key_required` as structured content, not an error | mcp-uspto | `src/lib/config.ts:32-50` | envelope (#3) | port-with-attribution (MIT) |
| `patents-mcp-server#12` | Config loader + `getAvailableSources` availability matrix | patents-mcp-server | `src/lib/config.ts:92-110` | probe (#3) | reimplement-only; fix `healthy:false` bug on port |
| `uspto-patents-mcp#4` | Tier-gated registration (premium flag; list filter + call-time guard) | uspto-patents-mcp | `src/mcp-server.ts:41-66` | tier gate (#2) | reimplement-only (license unresolved) |
| `doc-haus#8` | `allow\|ask\|deny` declarative permission matrix | doc-haus | `dochaus/opencode.json:87-134` | tier gate (#2) | clean-room |
| `mike#7` | Confirmation gate + untrusted-context wrap + audit log | mike | `backend/src/lib/mcp/servers.ts:482-490` | tier gate (#2) | clean-room (AGPL) |
| `uspto_pfw_mcp#4` | Named field tiers minimal/balanced/complete (documentBag 100x warning) | uspto_pfw_mcp | `field_configs.yaml:12-42` | field tiers (#4) | port-with-attribution (MIT) |
| `uspto_pfw_mcp#9` | SERVER_INSTRUCTIONS progressive tool discovery | uspto_pfw_mcp | `src/patent_filewrapper_mcp/main.py:29-60` | field tiers (#4) | port-with-attribution (MIT) |
| `us-gov-open-data-mcp#4` | Columnar envelope + `stripNulls` + trend stats | us-gov-open-data-mcp | `src/shared/response.ts:201-237` | reshaping (#4) | port-with-attribution (MIT) |
| `mike#2` | Metadata→find→read progressive ladder | mike | `backend/src/lib/legalSourcesTools/courtlistenerTools.ts:96-152` | reshaping (#4) | clean-room (AGPL) |
| `patents-mcp-server#3` | UUID+TTL fetchable handles for large payloads | patents-mcp-server | `src/resources/store.ts:7-21` | reshaping (#4) | reimplement-only |
| `screenpipe#1` | USE WHEN / DO NOT USE routing prose | screenpipe | `packages/screenpipe-mcp/src/index.ts:286-294` | annotations (#5) | clean-room (commercial) |
| `screenpipe#2` | csv/outline/fields/max_content_length reshaping levers | screenpipe | `.claude/skills/screenpipe-api/SKILL.md:22-24` | reshaping (#4) | clean-room (facts only) |
| `patent-search-mcp-server#5` | Four annotation hints + dual content/structuredContent | patent-search-mcp-server | `src/tools/claimChart.ts:39-45` | annotations (#5) | port-with-attribution (MIT) |
| `us-legal-tools#5` | Per-field `.describe()` metadata → Schema annotations | us-legal-tools | `packages/courtlistener-sdk/src/mcp/tool-schemas.zod.ts:15-21` | annotations (#5) | port-with-attribution (MIT) |
| `research-squad#4` | `withInputValidation` schema-decode dispatch → `ToolValidationError` | research-squad | `src/services/ToolRouterService.ts:202-218` | validation (#5) | port-with-attribution (MIT); v4: use `effect/SchemaIssue`, not `TreeFormatter` |
| `agentmemory#8` | Typed framework-free `McpToolDef` registry | agentmemory | `src/mcp/tools-registry.ts:1-38` | registry (#5) | port-with-attribution (Apache-2.0) |

**Rejected/studied shapes** (do not build): `patents-mcp#5` method-enum
mega-tool (wrong axis for Effect); `us-gov-open-data-mcp#1` WASM code-mode
(out of scope v1); `uspto-patents-mcp#7` Bearer/team keys (not local-first).

## 2. Upstream repositories & licenses

Stricter-reading-wins (packet audit over catalog). Copyleft/unknown/commercial
⇒ clean-room (pattern only); MIT/Apache ⇒ port-with-attribution (reimplement
to Effect idiom, never literal-copy).

| Repo | License | Port discipline |
|------|---------|-----------------|
| agentmemory | Apache-2.0 | port-with-attribution |
| doc-haus | MIT (packet: flagged unknown) | clean-room |
| harvest-mcp | unknown (no LICENSE) | clean-room |
| mcp-uspto | MIT | port-with-attribution |
| mike | AGPL-3.0-only | clean-room |
| patent-search-mcp-server | MIT | port-with-attribution |
| patents-mcp | MIT (not re-resolved) | reimplement-only until LICENSE confirmed |
| patents-mcp-server (TS) | MIT (identity not re-resolved) | reimplement-only until confirmed |
| research-squad | MIT | port-with-attribution |
| screenpipe | LicenseRef-Screenpipe-Commercial / NOASSERTION | clean-room (facts only) |
| us-gov-open-data-mcp | MIT | port-with-attribution |
| us-legal-tools | MIT | port-with-attribution |
| uspto-patents-mcp | MIT (not re-resolved) | reimplement-only until confirmed |
| uspto_pfw_mcp | MIT | port-with-attribution |

## 3. External research sources

Load-bearing subset (full list in the exploration ledger §3):

- MCP spec, server/tools `2025-06-18` (the pinned target) —
  <https://modelcontextprotocol.io/specification/2025-06-18/server/tools>
- MCP tool-annotations design blog ("annotations are untrusted hints") —
  <https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/>
- Effect configuration docs (`Config.redacted` / `Config.option`) —
  <https://effect.website/docs/configuration/>
- `structuredContent` client-drop gotcha —
  <https://github.com/modelcontextprotocol/typescript-sdk/issues/654>
- Claude Code 25k MCP output ceiling —
  <https://github.com/anthropics/claude-code/issues/9152>
- Anthropic, writing tools for agents —
  <https://www.anthropic.com/engineering/writing-tools-for-agents>
- OpenCode permissions (`allow|ask|deny`) — <https://opencode.ai/docs/permissions/>

## 4. In-repo capability references

| Capability | Path | Role |
|------------|------|------|
| `effect/unstable/ai` `{Tool, Toolkit, McpServer, McpSchema}` @ beta.92 | `node_modules/effect/src/unstable/ai` (subtree: `.repos/effect-v4`) | **build on** — verified internals in the 2026-07-01 review |
| `Layer.mergeAll` seam precedent | `packages/drivers/nlp-mcp/src/Server.ts:101-107` | **mirror** — composition shape the kit's helper generalizes |
| Four-hint annotation precedent | `packages/drivers/m365-mcp/src/M365Tools.ts` | **mirror** — the #5 helper's reference |
| Optional-secret idiom (7 drivers, no shared helper) | `packages/drivers/uspto/src/Uspto.service.ts:398` et al. | **consolidate** — `SourceAuth` registry reads this class |
| Same-origin key scoping | `packages/drivers/uspto/src/Uspto.service.ts:249-255` | **port discipline** into kit guidance |
| `ClaimGate` total-engine pattern | `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.ports.ts:42-47` | **mirror** — refusal-as-value dispatch wrapper |
| `UsageRecord.metadata` jsonb | `packages/epistemic/domain/src/entities/UsageRecord/UsageRecord.model.ts:95-97` | **target shape** for the audit record schema (persistence wiring is consumer-side) |
| `$I` identity composer | `packages/foundation/modeling/identity/src/Id.ts` | **reuse** for schema annotations |
| Decode-and-map precedent | the retired `@beep/schema` `Jsonl` decoder (removed in the effect-schema-parity group G PR) | **reuse** for `ToolValidationError` |

## 5. Cross-links & provenance

- Exploration manifest ↔ this goal: `links.goals` ↔ `provenance.exploration`
  (wired 2026-07-01).
- Sibling candidate goals (exploration
  [`MAP.md`](../../../explorations/mcp-auth-gated-registration/MAP.md)):
  `uspto-mcp`, `mcp-host-retrofit` (jointly discharge the ≥2-consumer gate),
  `mcp-write-wall` (follow-on).
- Boundary-with: `multi-provider-llm-dispatch-fallback` exploration (shares
  only the `Config.redacted` primitive; provider selection is a port, never
  embedded).
- Decision rationale:
  [`DECISIONS.md`](../../../explorations/mcp-auth-gated-registration/DECISIONS.md)
  (Q1–Q7 + Q4b).
