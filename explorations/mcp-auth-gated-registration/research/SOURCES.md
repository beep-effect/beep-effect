# MCP Auth-Gated Registration & Progressive Disclosure — Sources & Provenance

Provenance ledger joining this packet's decisions back to the mined gold nuggets
(with upstream repo + `file:line`), the upstream repositories and their
licenses, the external research citations on disk, and the in-repo `@beep/*`
capabilities this work composes. Derives from the gold-intake cluster **"MCP
server design (conditional registration, multi-provider auth, progressive
disclosure)"**.

- **Cluster:** MCP server design (conditional registration, multi-provider auth, progressive disclosure) — 28 nuggets
- **Route:** `new-exploration` → `explorations/mcp-auth-gated-registration` (P2 wave; histogram P1×11 / P2×12 / P3×5)
- **Theme span:** `mcp-design`, `governance-ops`
- **Gold-intake provenance:** [`../../_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) · [`../../_gold-intake/routing.json`](../../_gold-intake/routing.json) · [`../../_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md)
- **Packet codex review:** [`../reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md) · [`../reviews/2026-07-01-codex-verification.md`](../reviews/2026-07-01-codex-verification.md) (align-stage re-verification, all claims confirmed, effect pin → beta.92)
- **Packet research:** [`../RESEARCH.md`](../RESEARCH.md) · [`../DECISIONS.md`](../DECISIONS.md) · per-theme detail under [`./`](.)

> This is an **exploration** packet (fuzzy front end), not a spec. The §1 nuggets
> are the corpus the eventual `goals/` packet(s) inherit; this ledger exists so the
> implementing agent can trace every pattern to its licensed origin before porting.

---

## 1. Mined source corpus (gold nuggets)

All 28 cluster nuggets. Disposition = the recommendation carried by the nugget,
read through the license discipline in §2 (a `port` against an AGPL/unknown
upstream still becomes clean-room — see the per-repo notes).

| Nugget | Title | Upstream (repo) | Source (file:line) | Theme | Priority | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `doc-haus#8` | Tool permission matrix: read=allow / mutate=ask / edit+bash=deny | doc-haus | `dochaus/opencode.json:87-134` | mcp-design | P1 | adopt (clean-room) |
| `mike#7` | MCP tool governance: confirmation gate + untrusted-context wrap + audit log | mike | `backend/src/lib/mcp/servers.ts:482-490` | mcp-design | P1 | adopt (clean-room, AGPL) |
| `patent-search-mcp-server#5` | Paired `const tool` + `run()` with annotations + dual content/structuredContent | patent-search-mcp-server | `src/tools/claimChart.ts:39-45` | mcp-design | P1 | adopt |
| `patents-mcp#4` | Graceful-degradation credential-gated client init | patents-mcp | `src/patent_mcp_server/google/bigquery_client.py:36-57` | mcp-design | P1 | port |
| `patents-mcp-server#1` | Conditional MCP tool registration keyed on available credentials | patents-mcp-server | `src/tools/index.ts:12-26` | mcp-design | P1 | port |
| `screenpipe#1` | Tool descriptions with explicit USE WHEN / DO NOT USE routing | screenpipe | `packages/screenpipe-mcp/src/index.ts:286-294` | mcp-design | P1 | adopt (clean-room, commercial) |
| `screenpipe#2` | Server-side response reshaping (csv/outline, fields, max_content_length) | screenpipe | `.claude/skills/screenpipe-api/SKILL.md:22-24` | mcp-design | P1 | port (clean-room, commercial) |
| `us-legal-tools#5` | Zod tool-schema with rich `.describe()` metadata | us-legal-tools | `packages/courtlistener-sdk/src/mcp/tool-schemas.zod.ts:15-21` | mcp-design | P1 | adopt |
| `us-legal-tools#9` | Multi-provider MCP env-auth matrix (claude config) | us-legal-tools | `README.md:252-300` | mcp-design | P1 | port |
| `uspto-patents-mcp#4` | Tier-gated conditional tool registration (premium flag) | uspto-patents-mcp | `src/mcp-server.ts:41-66` | mcp-design | P1 | port (reimplement-only) |
| `uspto_pfw_mcp#4` | Progressive field tiers (minimal/balanced/complete) | uspto_pfw_mcp | `field_configs.yaml:12-42` | mcp-design | P1 | port |
| `agentmemory#8` | Typed MCP tool registry with progressive-disclosure descriptions | agentmemory | `src/mcp/tools-registry.ts:1-38` | mcp-design | P2 | adopt |
| `harvest-mcp#6` | Modular tool registration split by domain w/ shared typed context | harvest-mcp | `src/server.ts:11-42` | mcp-design | P2 | adopt (clean-room, unknown) |
| `mcp-uspto#2` | Graceful `api_key_required` as structured content, not an error | mcp-uspto | `src/lib/config.ts:32-50` | mcp-design | P2 | adopt |
| `mike#2` | Progressive-disclosure tool ladder (metadata → find → read) | mike | `backend/src/lib/legalSourcesTools/courtlistenerTools.ts:96-152` | mcp-design | P2 | port (clean-room, AGPL) |
| `patents-mcp#5` | Unified single-tool dispatch with method enum | patents-mcp | `src/patent_mcp_server/patents.py:50-126` | mcp-design | P2 | study (rejected for Effect) |
| `patents-mcp-server#3` | Transient UUID+TTL file store keeping PDFs out of context | patents-mcp-server | `src/resources/store.ts:7-21` | mcp-design | P2 | port (reimplement-only) |
| `research-squad#4` | Tool registry + schema-validated dispatch router | research-squad | `src/services/ToolRouterService.ts:202-218` | mcp-design | P2 | adopt |
| `us-gov-open-data-mcp#5` | Metadata-driven module auto-discovery + generated instructions/routing | us-gov-open-data-mcp | `src/server.ts:55-72` | mcp-design | P2 | adopt |
| `us-gov-open-data-mcp#6` | `ApiModule`/`ModuleMeta` contract w/ Domain/QuestionType/RouteHint | us-gov-open-data-mcp | `src/shared/types.ts:106-144` | mcp-design | P2 | study |
| `uspto_pfw_mcp#10` | Reflection/guidance delivered as MCP Resources (context-on-demand) | uspto_pfw_mcp | `src/patent_filewrapper_mcp/reflections/base_reflection.py:12-37` | mcp-design | P2 | adopt |
| `uspto_pfw_mcp#9` | Server-instructions block guiding progressive tool discovery | uspto_pfw_mcp | `src/patent_filewrapper_mcp/main.py:29-60` | mcp-design | P2 | adopt |
| `agentmemory#9` | Standalone MCP server w/ proxy-or-degraded-fallback | agentmemory | `src/mcp/standalone.ts:16-58` | mcp-design | P3 | study |
| `us-gov-open-data-mcp#1` | WASM code-mode: LLM-script over tool output (65-99% reduction) | us-gov-open-data-mcp | `src/shared/sandbox.ts:75-160` | mcp-design | P3 | study (out of scope v1) |
| `us-gov-open-data-mcp#4` | Columnar response envelope + timeseries stats + null-stripping | us-gov-open-data-mcp | `src/shared/response.ts:201-237` | mcp-design | P3 | adopt |
| `us-gov-open-data-mcp#8` | String-DSL parsers for filters/ranges/sorts → typed query | us-gov-open-data-mcp | `src/apis/uspto/tools.ts:28-55` | mcp-design | P3 | adopt |
| `uspto-patents-mcp#7` | Bearer-key auth + tier resolution with team sub-key roll-up | uspto-patents-mcp | `src/auth.ts:77-122` | governance-ops | P3 | skip (not needed local-first) |
| `patents-mcp-server#12` | Multi-provider config loader + source-availability matrix | patents-mcp-server | `src/lib/config.ts:92-110` | mcp-design | (null) | reference (absorbed null nugget) |

### How these inform this packet

The cluster maps to the five build-list strands (CAPTURE netNew #1–#5) layered
onto beep's two existing Effect MCP servers. Per [`../RESEARCH.md`](../RESEARCH.md),
**none of these are re-scaffolds** — they are patterns slotted into the
`Layer.mergeAll(...)` composition seam.

- **#1 Conditional / credential-keyed Toolkit composition** — `patents-mcp-server#1`
  (`registerAllTools` mounts a group only when its creds resolved) is the canonical
  shape; `patents-mcp#4` is the per-client graceful-degradation variant; `agentmemory#9`
  the proxy-vs-reduced-fallback topology; `us-gov-open-data-mcp#5` the metadata-driven
  module auto-discovery with selective loading. **Take** the boot-time
  `Config.option`-gated composition (build the toolkit only from layers whose
  optional-secret config resolved); **leave** the FastMCP/`readdirSync` runtime
  machinery — port to a folded `layers.reduce((acc,l)=>Layer.merge(acc,l), Layer.empty)`
  (the v4 `Layer.orElse` gotcha is logged in RESEARCH Constraints).
- **#2 Tier-gating / ethical wall** — `doc-haus#8` (declarative `allow|ask|deny`
  permission matrix), `mike#7` (confirmation-gate filter + untrusted-context suffix +
  audit log), `uspto-patents-mcp#4` (`premium?` flag filtering `listTools` + dispatch
  guard). **Take** the two-layer defense (filter `tools/list` AND re-check at
  `tools/call`) and the fail-closed `ask`/`deny` default for write tools; **leave**
  the literal OpenCode/AGPL bodies. The load-bearing contract from `uspto-patents-mcp#4`:
  `listTools(tier).filter((t) => !t.premium || tier === "team" || tier === "pro")` plus
  an `rpcError` at call time — mirror as a beep-side dispatch wrapper, since custom
  annotations are *not* the security boundary.
- **#3 Structured `api_key_required` helper + env-auth matrix** — `mcp-uspto#2` is the
  verbatim contract: a **normal tool result** carrying
  `{ error: "api_key_required", tool, message, registration }` in `content[].text`,
  **returned not thrown**. `us-legal-tools#9` supplies the source→envVar matrix
  (CourtListener / GovInfo / DOL keyed; eCFR + Federal Register no-auth). `patents-mcp-server#12`
  (absorbed null nugget) supplies `getAvailableSources`/`check-api-status`. **Take** the
  helper shape and the matrix, but encode `gate: none|soft|hard` (not a boolean) and fix
  the probe bug (`healthy` is hardcoded `false` upstream) — see RESEARCH §3.
- **#4 Progressive disclosure / context reduction** — `uspto_pfw_mcp#4` (named YAML
  field tiers, `documentBag` 100x warning) and `uspto_pfw_mcp#9` (SERVER_INSTRUCTIONS
  always-available-vs-deferred), `mike#2` (metadata→snippet→read ladder), `screenpipe#2`
  (csv/outline/fields/max_content_length levers), `us-gov-open-data-mcp#4` (columnar
  envelope + `stripNulls` + `detectTrend`), `patents-mcp-server#3` (UUID+TTL fetchable
  handle for large PDFs), `uspto_pfw_mcp#10` (guidance-as-Resources). **Take** named
  field tiers + columnar reshaping + Resources (captures 95–99% of the win for stdio);
  **leave** `us-gov-open-data-mcp#1` WASM code-mode (heavyweight, out of scope v1) and
  `patents-mcp#5` method-enum mega-tool (wrong axis for Effect — discrete typed tools are
  cheap). The 25,000-token `MAX_MCP_OUTPUT_TOKENS` ceiling makes reshaping a correctness
  requirement, not a nicety.
- **#5 Tool-def annotation + USE-WHEN routing prose** — `patent-search-mcp-server#5`
  (annotations `{readOnlyHint, openWorldHint, idempotentHint}` + dual content), `screenpipe#1`
  (USE WHEN / DO NOT USE prose), `agentmemory#8` (framework-free typed `McpToolDef`),
  `us-legal-tools#5` (per-field `.describe()`/enums/defaults), `research-squad#4`
  (`withInputValidation` schema-decode → `ToolValidationError`), `us-gov-open-data-mcp#6`/`#8`
  (typed Domain/QuestionType/RouteHint registry; flat string-DSL → typed query).
  **Take** the prose convention + per-field Schema annotations + decode-and-map validation;
  **leave** Zod (port `.describe()` into effect `Schema` annotations via the repo's `$I`
  identity composer) and `ParseResult.TreeFormatter` (removed in v4 — use
  `effect/SchemaIssue` `makeFormatterStandardSchemaV1()`).

`uspto-patents-mcp#7` (multi-tenant Bearer/team sub-key model) is **skipped** —
beep is single-attorney local-first; it is reference-only if hosted MCP is ever
exposed.

---

## 2. Upstream repositories & licenses

One row per `reposUsed` entry. **Port discipline** is derived from the license:
copyleft/unknown/commercial → clean-room reimplement (pattern only, no vendored
code); permissive (MIT/Apache-2.0) → port-with-attribution. **Where the packet's
own license audit disagrees with the catalog license, the stricter reading wins
— see the callout below.**

| Repo | Tier | License | Port discipline | What we take |
| --- | --- | --- | --- | --- |
| agentmemory | T1 | Apache-2.0 | port-with-attribution | Typed framework-free `McpToolDef` registry; proxy-vs-reduced-fallback topology |
| doc-haus | T1 | MIT (packet: flagged unknown) | clean-room (per packet audit) | `allow\|ask\|deny` permission matrix as approval-gate config |
| harvest-mcp | T2 | unknown (no LICENSE file) | clean-room | Per-domain tool registrars with narrow injected context |
| mcp-uspto | T2 | MIT | port-with-attribution | `keyMissingResponse` structured `api_key_required` content block |
| mike | T1 | AGPL-3.0-only | clean-room | Metadata→find→read ladder; confirmation-gate + untrusted-context suffix + audit pairing |
| patent-search-mcp-server | T2 | MIT | port-with-attribution | Paired `const tool` + `run()` w/ annotation hints + dual content |
| patents-mcp | T2 | MIT (packet: not re-resolved) | reimplement-only until LICENSE confirmed | Credential-gated client self-disable; method-dispatch tradeoff (studied) |
| patents-mcp-server | T1 | MIT (packet: TS one not re-resolved) | reimplement-only until repo identity + LICENSE confirmed | `registerAllTools` conditional mounting; `getAvailableSources`; UUID+TTL store |
| research-squad | T1 | MIT | port-with-attribution | `withInputValidation` schema-decode dispatch → `ToolValidationError` |
| screenpipe | T3 | LicenseRef-Screenpipe-Commercial (GitHub: NOASSERTION) | clean-room | USE WHEN/DO NOT USE prose; csv/outline/fields/max_content_length conventions (facts only) |
| us-gov-open-data-mcp | T2 | MIT | port-with-attribution | Module metadata auto-discovery; columnar envelope; string-DSL parsers; (WASM code-mode studied, deferred) |
| us-legal-tools | T1 | MIT | port-with-attribution | Env-auth matrix; per-field `.describe()` → effect Schema annotations |
| uspto-patents-mcp | T2 | MIT (packet: not re-resolved) | reimplement-only until LICENSE confirmed | `premium?` tier-gated registration; (Bearer/team key model skipped) |
| uspto_pfw_mcp | T1 | MIT | port-with-attribution | Named field tiers; SERVER_INSTRUCTIONS block; guidance-as-Resources |

> **Cautions (echoed from the source bundle + packet RESEARCH "Licensing gravity"):**
> - **PatentsView API sunset** — `api.patentsview.org` 301-redirects to `data.uspto.gov/odp`
>   (HTML, not JSON). Target USPTO **ODP `api.uspto.gov` only** from the start (`@beep/uspto`
>   already does) and encode the sunset as a `UsptoEndpointSunset` tagged error.
> - **Catalog vs packet license drift** — the catalog records `patents-mcp`, the TypeScript
>   `patents-mcp-server`, and `uspto-patents-mcp` as MIT, but the packet's own audit
>   (RESEARCH §"Licensing gravity") did **not** independently re-resolve those repo
>   identities + LICENSEs this pass. Treat their attributed bodies (`registerAllTools`
>   conditional mounting, `getAvailableSources`/`check-api-status`, the UUID+TTL store) as
>   **reimplement-from-spec only** until the exact repo + LICENSE are confirmed — do not
>   literal-copy. The clean MIT ports are `mcp-uspto`, `us-legal-tools`,
>   `riemannzeta/patent_mcp_server` (Python), `uspto_pfw_mcp`, `us-gov-open-data-mcp`.
> - **Copyleft / unknown / commercial → clean-room only:** `mike` (AGPL-3.0), `screenpipe`
>   (NOASSERTION/commercial), `harvest-mcp` (no LICENSE), and `doc-haus` (packet flags
>   unknown). The percentages and field names are facts; the code is not licensed for copy.
>   These patterns are corroborated by the public MCP spec/blog + OpenCode docs (§3) —
>   reimplement from those, treat the nugget snippets as provenance only.
> - **Scope boundary** — the "multi-provider auth / LLM fallback layer" strand in the
>   cluster title spans the four LLM drivers (`@beep/anthropic`, `openai-compat`, `xai`,
>   `venice-ai`) and is a **separate** provider-abstraction concern. This packet stays on
>   MCP-side credential-keyed registration + progressive disclosure and **cross-links** the
>   LLM-fallback work (§5) rather than absorbing it.

---

## 3. External research sources

Every URL below appears verbatim in this packet's [`../RESEARCH.md`](../RESEARCH.md),
`research/*.md`, or [`../reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md).
None are invented.

**Effect v4 + MCP framework (the ground we build on)**
- Effect Tool Use docs — <https://effect.website/docs/ai/tool-use/>
- Effect Configuration docs — <https://effect.website/docs/configuration/>
- Effect `Tool.ts` (v3 API ref, v4 ground truth is `node_modules/effect/src/ai/*`) — <https://effect-ts.github.io/effect/ai/ai/Tool.ts.html>
- Effect `Layer.ts` (v3 — `Layer.orElse` is stale) — <https://effect-ts.github.io/effect/effect/Layer.ts.html>
- MCP spec, server/tools (2025-06-18, installed target) — <https://modelcontextprotocol.io/specification/2025-06-18/server/tools>
- MCP spec, server/tools (2025-11-25, NOT spoken by beta.91) — <https://modelcontextprotocol.io/specification/2025-11-25/server/tools>
- MCP spec, server/resources — <https://modelcontextprotocol.io/specification/2025-06-18/server/resources>
- MCP tool-annotations design blog — <https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/>
- MCP TypeScript SDK + `structuredContent` issue #654 — <https://github.com/modelcontextprotocol/typescript-sdk> · <https://github.com/modelcontextprotocol/typescript-sdk/issues/654>

**Tool-def quality + governance / ethical wall**
- Anthropic, Writing tools for agents — <https://www.anthropic.com/engineering/writing-tools-for-agents>
- Claude define-tools docs — <https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools>
- OpenCode permissions (`allow\|ask\|deny`) — <https://opencode.ai/docs/permissions/>
- Harvey + Intapp, long-horizon agents & ethical walls — <https://www.harvey.ai/blog/long-horizon-agents-and-ethical-walls>
- ABA Formal Opinion 512 (GAI duties; NOT an info-barrier mandate — see RESEARCH §2 correction) — <https://www.americanbar.org/content/dam/aba/administrative/professional_responsibility/ethics-opinions/aba-formal-opinion-512.pdf>

**Prompt-injection hardening**
- StackOne, indirect prompt injection in MCP tools — <https://www.stackone.com/blog/indirect-prompt-injection-mcp-tools-defense/>
- Stytch, MCP vulnerabilities — <https://stytch.com/blog/mcp-vulnerabilities/>
- OWASP, MCP Tool Poisoning — <https://owasp.org/www-community/attacks/MCP_Tool_Poisoning>

**Context reduction / progressive disclosure**
- Claude Code 25k-token MCP output limit — <https://help.xpoz.ai/en/articles/12681842-claude-code-mcp-tool-exceeds-maximum-allowed-tokens-25000> · <https://github.com/anthropics/claude-code/issues/9152>
- Anthropic, code execution with MCP — <https://www.anthropic.com/engineering/code-execution-with-mcp>
- Cloudflare, code-mode MCP (WASM, out of scope v1) — <https://blog.cloudflare.com/code-mode-mcp/>

**Upstream repos + provider APIs (named in RESEARCH)**
- `riemannzeta/patent_mcp_server` — <https://github.com/riemannzeta/patent_mcp_server>
- `lzinga/us-gov-open-data-mcp` — <https://github.com/lzinga/us-gov-open-data-mcp>
- `beshkenadze/us-legal-tools` — <https://github.com/beshkenadze/us-legal-tools>
- `john-walkoe/uspto_pfw_mcp` (+ CUSTOMIZATION.md) — <https://github.com/john-walkoe/uspto_pfw_mcp>
- `cmanohar/mcp-uspto` config.ts — <https://raw.githubusercontent.com/cmanohar/mcp-uspto/master/src/lib/config.ts>
- USPTO ODP PFW search + getting-started — <https://data.uspto.gov/apis/patent-file-wrapper/search> · <https://data.uspto.gov/apis/getting-started>
- GovInfo API + signup — <https://www.govinfo.gov/features/api> · <https://www.govinfo.gov/api-signup> · <https://github.com/usgpo/api>
- DOL Open Data Portal + API keys — <https://dataportal.dol.gov/> · <https://dataportal.dol.gov/api-keys>
- CourtListener REST v4 + 2026 membership change — <https://wiki.free.law/c/courtlistener/help/api/rest/v4/overview> · <https://free.law/2026/05/07/api-included-in-memberships/>

---

## 4. In-repo capability references

The `@beep/*` bricks this packet composes (from `secondaryTargets` + the
RESEARCH "In-Repo Capability Inventory"). Verified via `rg`/`ls` 2026-06-29.

| Capability | Package path | Role |
| --- | --- | --- |
| `@beep/nlp-mcp` — `Layer.mergeAll(...)` composition seam | `packages/drivers/nlp-mcp` | **extend** — the conditional-registration seam (Server.ts:104-107); no Tool/Toolkit re-scaffold |
| `@beep/m365-mcp` — four-hint annotation precedent | `packages/drivers/m365-mcp` | **reuse** — only package annotating all four hints (M365Tools.ts:100-103); #5 convergence target |
| `@beep/uspto` — key-optional driver + implicit minimal tier | `packages/drivers/uspto` | **extend** — Shape-C self-gating precedent; field-tier generalization source |
| `@beep/epistemic-use-cases` `ClaimGate` | `packages/epistemic/use-cases/src/ClaimGate` | **reuse** (pattern) — refusal-as-value, total engine; the write-tool-wall shape (#2) |
| `@beep/epistemic-domain` audit models (`Activity`/`UsageRecord`) | `packages/epistemic/domain/src/entities` | **extend** — audit sink for gated `tools/call` |
| `@beep/epistemic-tables` persistence | `packages/epistemic/tables/src` | **extend / NET-NEW** — only `UsageRecord` persisted; `Activity` table + converter is a gap (RESEARCH §2 correction) |
| `@beep/schema` identity composer (`Id.ts` `$I`) | `packages/foundation/modeling/identity/src` | **reuse** — port Zod `.describe()` routing prose into Schema annotations |
| decode-and-map precedent (`Jsonl.ts`) | `packages/foundation/modeling/schema/src` | **reuse** — `ToolValidationError` shape (replaces v3 `TreeFormatter`) |
| `@beep/govinfo` (~27 files, substantial) | `packages/drivers/govinfo` | **extend** — keyed consumer of the gating layer |
| `@beep/courtlistener`, `@beep/ecfr`, `@beep/dol`, `@beep/federal-register` (skeletons) | `packages/drivers/{courtlistener,ecfr,dol,federal-register}` | **NET-NEW** MCP surface — consumers built by `gov-legal-data-driver-codegen` |
| `goals/m365-mcp`, `goals/nlp-adjunct-port` | `goals/{m365-mcp,nlp-adjunct-port}` | secondary-target goal packets (existing MCP-host precedent / DONE NLP work) |

**Genuine gaps (no real src today, per RESEARCH §"Genuine gaps"):** `api_key_required`
structured helper, `requiresAuth`/tier-gate/premium-flag gating, typed
`ToolRegistry`/`ToolMetadata` w/ auth-category-tier, `USE WHEN`/`DO NOT USE`
description convention, named `minimal/balanced/complete` Schema tiers, and a
`SourceAuth` availability-matrix + `check-api-status` probe — all NET-NEW.

---

## 5. Cross-links & provenance

- **Cluster:** "MCP server design (conditional registration, multi-provider auth, progressive disclosure)" — `route: new-exploration`, `primaryTarget: mcp-auth-gated-registration`. Source bundle `crossref` is empty; the sibling links below are from this packet's own RESEARCH routing cautions.
- **Sibling / boundary packets (RESEARCH §"Locked decisions / routing cautions"):**
  - `multi-provider-llm-dispatch-fallback` (proposed) — **boundary WITH, not absorption OF**; shares only `Config.redacted`. This packet = build-time *source* capability gating; that one = runtime *provider* selection/failover. A tool needing an LLM depends on a provider-selection PORT (`Context.Tag`), never embedding precedence.
  - `goals/nlp-adjunct-port` (DONE) — owns NLP tool-surface expansion + streaming; out of this cluster.
  - `uspto-patent-driver-depth` — USPTO driver depth (ODP-only); this packet coordinates, does not build.
  - `gov-legal-data-driver-codegen` — builds the bare gov-legal driver skeletons this packet gates.
- **Packet artifacts:** [`../CAPTURE.md`](../CAPTURE.md) · [`../RESEARCH.md`](../RESEARCH.md) · [`../DECISIONS.md`](../DECISIONS.md) · [`../BRIEF.md`](../BRIEF.md) · [`../MAP.md`](../MAP.md) · per-theme detail [`./conditional-credential-keyed-toolkit-composition.md`](./conditional-credential-keyed-toolkit-composition.md), [`./structured-api-key-required-helper-and-env-auth-matrix.md`](./structured-api-key-required-helper-and-env-auth-matrix.md), [`./tier-gating-and-tool-governance-ethical-wall.md`](./tier-gating-and-tool-governance-ethical-wall.md), [`./progressive-disclosure-field-tiers-and-response-reshaping.md`](./progressive-disclosure-field-tiers-and-response-reshaping.md), [`./tool-definition-annotation-and-routing-conventions.md`](./tool-definition-annotation-and-routing-conventions.md)
- **Codex review:** [`../reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md) (6 blocking + 5 advisory folded into RESEARCH).
- **Gold-intake:** [`../../_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) · [`../../_gold-intake/routing.json`](../../_gold-intake/routing.json) · [`../../_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) (MCP-design cluster section).
