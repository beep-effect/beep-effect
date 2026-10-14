# Multi-Provider LLM Dispatch + Graceful Fallback — Sources & Provenance

Provenance ledger for this packet: it joins the 8 gold nuggets of the
**Multi-provider LLM dispatch + graceful fallback** cluster to their upstream
repos+licenses, the external research actually cited on disk, and the `@beep/*`
bricks this dispatch Layer composes. It exists so an implementing agent can
trace every decision in `DECISIONS.md` / `BRIEF.md` back to (a) a mined nugget
with its upstream `file:line`, (b) the upstream repo + LICENSE, (c) an on-disk
external citation, and (d) an in-repo capability.

- **Cluster:** Multi-provider LLM dispatch + graceful fallback (8 nuggets, wave P2 — 7×P2 + 1×P3)
- **Route:** `new-exploration` → this packet (`explorations/multi-provider-llm-dispatch-fallback`)
- **Themes:** `mcp-design` (7), `governance-ops` (1)
- **Gold-intake provenance:**
  [`../../_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) ·
  [`../../_gold-intake/routing.json`](../../_gold-intake/routing.json) ·
  [`../../_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md)
  (§ "Multi-provider LLM dispatch with key precedence + automatic fallback")
- **Codex review:** [`../reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md)

> [!IMPORTANT]
> The gold nuggets propose `Layer.orElse` (stale effect-v3 advice). RESEARCH
> overturned this: `Layer.orElse` does **not** exist in vendored
> `effect@4.0.0-beta.91`; the canonical ordered-fallback engine is
> **`ExecutionPlan`**. Read the nugget snippets below as *intent*, the
> `RESEARCH.md` / `DECISIONS.md` re-expression as the *binding* contract.

---

## 1. Mined source corpus (gold nuggets)

| Nugget | Title | Upstream (repo) | Source (file:line) | Theme | Priority | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `harvest-mcp#1` | Multi-provider LLM factory: registry + priority resolution + actionable missing-key errors | harvest-mcp | `src/core/providers/ProviderFactory.ts:17-245` | mcp-design | P2 (direct) | **clean-room reimplement** (unknown license) |
| `agentmemory#4` | Multi-provider abstraction: resilient wrapper + fallback chain + per-provider default models (#778 fix) | agentmemory | `src/providers/index.ts:35-93` | mcp-design | P2 (direct) | **clean-room reimplement** (license unverified; port pattern not strings) |
| `Juris.AI#1` | Multi-provider dispatch: key-resolution + automatic fallback to default provider | Juris.AI | `src/lib/ai-services.ts:381-457` | mcp-design | P2 (adjacent) | **port pattern** (MIT) — but `Layer.orElse`/try-catch shape is stale |
| `TalentScore#2` | Multi-provider client config: fallback / round-robin / retry policies | TalentScore | `packages/server/baml_src/clients.baml:112-146` | mcp-design | P2 (adjacent) | **config-shape reference only** (BAML, Apache-2.0; no Rust runtime) |
| `research-squad#15` | BAML multi-provider client config with round-robin + fallback | research-squad | `baml_src/clients.baml:38-54` | mcp-design | P2 (serendipitous) | **config-shape reference only** (BAML, Apache-2.0) |
| `courtlistener#5` | Multi-provider structured-output wrapper (Instructor `from_provider` + Pydantic `response_model`) | courtlistener | `cl/lib/llm.py:8-58` | mcp-design | P2 (adjacent) | **pattern only, NO code** (AGPL-3.0); superseded by `generateObject` |
| `mike#10` | Provider-agnostic tool-schema adapter (OpenAI → Claude/Gemini) | mike | `backend/src/lib/llm/tools.ts:29-44` | mcp-design | P2 (adjacent) | **study, patterns only** (AGPL-3.0); superseded by `Toolkit`/`Tool` |
| `stenoai#2` | Multi-provider abstraction (local/remote/cloud/JWT-adapter secret broker) | stenoai | `src/summarizer.py:109-179` | governance-ops | P3 (adjacent) | **study + reimplement** (MIT); JWT-broker governance pattern |

### How these inform this packet

**Registry + key precedence + onboarding errors (`harvest-mcp#1`, `Juris.AI#1`).**
Take the *shape*: a typed `PROVIDER_REGISTRY` mapping provider →
`{factory, requiredEnvVar, defaultModel}`, strict-priority key resolution, and
**structured** missing-key errors carrying setup instructions (vs a bare throw).
The load-bearing contract from `harvest-mcp#1`:
`PROVIDER_REGISTRY[name] = { factory, requiredEnvVar, defaultModel }` with
resolution "CLI args > tool params > env" and prefix auto-detect (`sk-` vs
`AIza`). **Leave**: the precedence *direction* (the nuggets contradict — see
`DECISIONS.md` Q5; RESEARCH recommends `user > CLI > env`), the literal prefix
match (RESEARCH proves it must be advisory: Mistral has no prefix, DeepSeek
collides with OpenAI legacy `sk-`), and the `try/catch` control flow → re-express
over `Config.orElse`/`ConfigProvider.orElse` + a `ProviderApiKeyMissing`
`TaggedErrorClass`. License: harvest-mcp has **no LICENSE file → clean-room
reimplement only**.

**Per-provider OWN default-model resolution (`agentmemory#4`).** This is the
direct, highest-value pattern: each provider in the fallback chain resolves its
OWN env-driven default model (`defaultModelFor(p) = env(${P}_MODEL) ?? pinned`)
so a fallback never inherits the primary's incompatible model id — the
documented #778 bug that 404'd every call and tripped the breaker. **Take** the
invariant (RESEARCH confirms model strings are non-portable across provider
surfaces — ≥5 incompatible Claude id encodings). **Leave** the literal default
strings (`claude-sonnet-4-20250514`, etc. are stale) and the `ResilientProvider`
circuit-breaker class (out of V1, see Q7). The registry MUST READ each driver's
config constant (e.g. `ANTHROPIC_DEFAULT_MODEL`), not re-declare it.

**Declarative resilience config (`TalentScore#2`, `research-squad#15`).** Both
are BAML `client<llm>` declarations — ordered `fallback`, `round-robin`, named
`retry_policy` (constant + exponential backoff). **Take** the declarative grammar
as a config-surface reference: ordered `fallback` maps 1:1 onto `ExecutionPlan`
steps; `retry_policy` maps onto v4 `Schedule` (`both`/`either`/`exponential`/
`spaced`/`recurs`). **Leave** the BAML runtime entirely (Apache-2.0, but a Rust
engine beep does not adopt). Note the BAML-vs-`ExecutionPlan` retry-semantics
nuance (retry wraps the chain in BAML; `ExecutionPlan` interleaves per-step) — a
faithful port puts per-client retry inside each step.

**Structured output (`courtlistener#5`).** The `from_provider(model) +
response_model` pattern (one `provider/model` string selects backend, Pydantic
enforces typed output) maps cleanly to `effect/Schema`. **Do NOT port**: AGPL-3.0
*and* structurally superseded — `LanguageModel.generateObject({ prompt, schema })`
plus the shipped `OpenAiStructuredOutput`/`AnthropicStructuredOutput`
`CodecTransformer`s already deliver this (drop netNew #5, see Q7).

**Tool-schema adapter (`mike#10`).** One internal tool definition adapted per
provider (`toClaudeTools`/`toGeminiTools`, normalizing schemas). **Study only**:
AGPL-3.0, and superseded by authoring tools once with `Tool.make`/`Toolkit.make`.
Forward-looking (no Gemini driver in repo).

**Secret-broker governance (`stenoai#2`).** The `adapter` mode — desktop holds
only a JWT to a proxy that holds the real provider key server-side — is the
governance pattern for the privilege-sensitive solo-attorney app. **Reimplement**
(MIT) as a dispatch-level `ApiKeyResolver` service, NOT driver code; `@beep/openai-compat`
is already broker-ready (optional `apiUrl` + conditional bearer).

> No sibling SPLIT for this cluster — all 8 nuggets route solely here. The shared
> `Schedule`-policy library is a **sequencing dependency** on sibling exploration
> `effect-orchestration-patterns` (see §5), not a shared nugget.

---

## 2. Upstream repositories & licenses

| Repo | Tier | License | Port discipline | What we take |
| --- | --- | --- | --- | --- |
| harvest-mcp | T2 | **unknown (no LICENSE file)** | **clean-room reimplement** | Registry + key-precedence + structured onboarding-error shape (`harvest-mcp#1`) |
| agentmemory | T1 | Apache-2.0 (license unverified for this file) | **clean-room reimplement** (pattern only, trivial) | Per-provider OWN default-model resolution / #778 fix (`agentmemory#4`) |
| Juris.AI | T2 | MIT | **port-with-attribution** (shape stale → re-express) | User-key>env precedence + graceful fallback chain (`Juris.AI#1`) |
| TalentScore | T1 | MIT (repo); BAML grammar is Apache-2.0 | **config-shape reference only** (no BAML runtime) | Declarative fallback/round-robin/retry-policy template (`TalentScore#2`) |
| research-squad | T1 | MIT (repo); BAML grammar is Apache-2.0 | **config-shape reference only** (no BAML runtime) | round-robin + ordered-fallback client config (`research-squad#15`) |
| courtlistener | T1 | **AGPL-3.0-only** | **pattern only, NO code** | `response_model` structured-output shape (`courtlistener#5`) — superseded |
| mike | T1 | **AGPL-3.0-only** | **pattern only, NO code** | Provider-agnostic tool-schema adapter (`mike#10`) — superseded |
| stenoai | T3 | MIT | **reimplement freely** | JWT secret-broker / adapter governance pattern (`stenoai#2`) |

> [!CAUTION]
> Bundle cautions, echoed verbatim:
> - **BAML (Apache-2.0)** client declarations are config-pattern reference only — do not adopt the BAML runtime.
> - Validate `Layer.orElse`/`ExecutionPlan` against vendored effect-v4 before building; reuse anthropic/openai-compat retry code, do not duplicate. *(RESEARCH resolved: `Layer.orElse` is dead; use `ExecutionPlan`.)*
> - Fuse with `effect-orchestration-patterns`' centralized retry-policy library (shared `Schedule` policies).
> - License gravity: `harvest-mcp#1` (rec=port) is **unknown-license → reimplement**; `courtlistener#5` (ref) + `mike#10` (study) are **AGPL-3.0 → port patterns only**.

---

## 3. External research sources

Citations actually present in this packet's `RESEARCH.md` + `research/*.md`
(titles + on-disk URLs). Grouped by the research thread that carries them.

**Effect fallback/retry substrate** (`research/effect-fallback-execution-plan-survey.md`, `RESEARCH.md`):
- Effect AI — Planning LLM Interactions (`ExecutionPlan` LLM-fallback doc example): https://effect.website/docs/ai/planning-llm-interactions/
- Effect AI launch blog (2025-04-01): https://effect.website/blog/effect-ai/
- `ExecutionPlan` API reference (`make`/`merge`/`CurrentMetadata`): https://effect-ts.github.io/effect/effect/ExecutionPlan.ts.html
- Effect CircuitBreaker proposal (open) — issue #2843: https://github.com/Effect-TS/effect/issues/2843 · unmerged PR #2854: https://github.com/Effect-TS/effect/pull/2854

**Resilience-strategy config model** (`research/resilience-strategy-config-model.md`):
- BAML repository (Apache-2.0): https://github.com/BoundaryML/baml
- BAML LLM client strategies — fallback: https://docs.boundaryml.com/ref/llm-client-strategies/fallback · retry-policy: https://docs.boundaryml.com/ref/llm-client-strategies/retry-policy · round-robin: https://docs.boundaryml.com/ref/llm-client-strategies/round-robin
- Effect — built-in schedules: https://effect.website/docs/scheduling/built-in-schedules/ · retrying: https://effect.website/docs/error-management/retrying/
- Circuit-breaker port sources (both Apache-2.0): Rezilience (ZIO): https://github.com/svroonland/rezilience · Opossum (Node): https://github.com/nodeshift/opossum

**Provider registry + key precedence + prefix auto-detect** (`research/provider-registry-and-key-precedence-design.md`):
- Effect — configuration (`Config.orElse`/`ConfigProvider`/`constantCase`): https://effect.website/docs/configuration/
- Gemini API key docs: https://ai.google.dev/gemini-api/docs/api-key
- xAI quickstart: https://docs.x.ai/developers/quickstart
- OpenRouter authentication: https://openrouter.ai/docs/api/reference/authentication
- DeepSeek API docs: https://api-docs.deepseek.com/
- Mistral API keys: https://docs.mistral.ai/admin/security-access/api-keys

**Per-provider default-model resolution** (`research/per-provider-default-model-resolution.md`):
- agentmemory `src/providers/index.ts`: https://github.com/rohitg00/agentmemory/blob/main/src/providers/index.ts
- Claude Code model-config: https://code.claude.com/docs/en/model-config
- AWS Bedrock inference profiles: https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html
- Vertex AI Claude partner models: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude
- Cross-boundary 404 corroboration — OpenClaw #20107: https://github.com/openclaw/openclaw/issues/20107
- LiteLLM proxy reliability/fallbacks: https://docs.litellm.ai/docs/proxy/reliability
- Vercel AI SDK provider management (`createProviderRegistry`): https://ai-sdk.dev/docs/ai-sdk-core/provider-management

**Structured output + secret governance** (`research/structured-output-and-secret-governance.md`):
- Instructor models / `response_model`: https://python.useinstructor.com/concepts/models/
- Effect `LanguageModel` API (`generateObject`): https://effect-ts.github.io/effect/ai/ai/LanguageModel.ts.html
- OpenAI structured outputs guide: https://developers.openai.com/api/docs/guides/structured-outputs
- Anthropic structured outputs (GA 2025-11-14): https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Effect Anthropic structured-output issue #6091 (historical): https://github.com/Effect-TS/effect/issues/6091
- LiteLLM JWT→virtual-key mapping: https://docs.litellm.ai/docs/proxy/jwt_key_mapping
- Cloudflare AI Gateway authentication (BYOK): https://developers.cloudflare.com/ai-gateway/configuration/authentication/
- Electron `safeStorage` (Linux plaintext trap): https://www.electronjs.org/docs/latest/api/safe-storage

> Several exact API-key prefix strings are flagged **UNVERIFIED** in the raw note
> (corroborated only by secondary sources). Treat them as advisory, never as a
> key-validity check (see `RESEARCH.md` Constraints).

---

## 4. In-repo capability references

The `@beep/*` bricks this dispatch Layer composes (from bundle `secondaryTargets`
+ the RESEARCH In-Repo Capability Inventory). Paths verified `rg`/`ls` 2026-06-29.

| Capability | Package path | Disposition |
| --- | --- | --- |
| `@beep/anthropic` driver (`makeAnthropicLanguageModelLayer`, `AnthropicTurnPlan`, `ANTHROPIC_DEFAULT_MODEL`, `AI_ANTHROPIC_API_KEY`) | `packages/drivers/anthropic` | **reuse** (registry reads its constants; no `.model()`) |
| `@beep/openai-compat` driver (top-level `layer`/`model`; broker-ready `apiUrl`+conditional bearer) | `packages/drivers/openai-compat` | **reuse** (V1 fallback step) |
| `@beep/xai` driver (`XAiLanguageModel.layer`/`.model`) | `packages/drivers/xai` | **reuse** (V1 fallback step) |
| `@beep/venice-ai` driver (`VeniceAiLanguageModel.layer`/`.model`, `VENICE_CHAT_MODEL`) | `packages/drivers/venice-ai` | **reuse** |
| `@beep/nlp-mcp` (Tool/Toolkit single-source tool schema) | `packages/drivers/nlp-mcp` | **reuse** (tool-schema, supersedes `mike#10`) |
| `@beep/agents/server` consumer (`AnthropicTurnKernel.ts:129` `Stream.withExecutionPlan`) | `packages/agents/server` | **extend** (first consumer; swap single→multi-provider plan) |
| `@beep/langextract` capability | `packages/foundation/capability/langextract` | **reuse** (downstream extraction consumer) |
| `effect/ai` — `LanguageModel.generateObject`, `OpenAiStructuredOutput`, `AnthropicStructuredOutput`, `AiError` (`isRetryable`/`retryAfter`), `Model`, `Toolkit`/`Tool` | vendored `effect@4.0.0-beta.91` | **reuse** (engine + structured output; drops netNew #5) |
| `ExecutionPlan` (`make`/`merge`/`CurrentMetadata`) + `Effect.withExecutionPlan`/`Stream.withExecutionPlan` | vendored `effect` | **reuse** (ordered-fallback engine — replaces dead `Layer.orElse`) |
| `Config`/`ConfigProvider` (`orElse`, `redacted`, `constantCase`, `layer`) | vendored `effect` | **reuse** (key precedence primitives) |
| `Schedule` (`exponential`/`spaced`/`recurs`/`jittered`/`either`/`both`) | vendored `effect` | **reuse** (retry-policy vocabulary; `compose`/`intersect`/`union` removed in v4) |
| `TaggedErrorClass` (`@beep/schema`) | `packages/foundation/modeling/schema/src/TaggedErrorClass` | **reuse** (`ProviderApiKeyMissing` error) |
| `LiteralKit` + `S.toTaggedUnion` (`@beep/schema`) | `packages/foundation/modeling/schema` | **reuse** (provider-name union, key-source `user\|cli\|env` enum) |
| `@beep/onepassword-cli` (`op://` resolution) | `packages/drivers/onepassword-cli` | **reuse** (pluggable key resolver source) |
| `@beep/ai-provider-cli` (Claude/Codex CLI auth-status) | `packages/drivers/ai-provider-cli` | **reuse** (adjacent CLI auth, not a dispatch component) |
| Multi-provider dispatch Layer / `PROVIDER_REGISTRY` / `ApiKeyResolver` / multi-provider `ExecutionPlan` builder | (none — `rg` NOT FOUND) | **NET-NEW** (this packet's core; proposed `@beep/llm-dispatch`, Q6) |
| Round-robin + circuit-breaker state machines | (none in vendored effect) | **NET-NEW** (deferred past V1, Q7) |
| Shared `@beep` `RetryPolicy`/`Schedule` policy library | (none — `rg` NOT FOUND) | **NET-NEW**, **sequencing dependency** on `effect-orchestration-patterns` |

---

## 5. Cross-links & provenance

- **Cluster id:** Multi-provider LLM dispatch + graceful fallback (gold-intake, 8 nuggets) →
  [`../../_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) ·
  [`../../_gold-intake/routing.json`](../../_gold-intake/routing.json)
- **Gold synthesis:** [`../../_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md)
  § "Multi-provider LLM dispatch with key precedence + automatic fallback" (and the
  MCP-design + governance-ops cluster overview)
- **Sibling exploration (sequencing dependency, not an import):**
  [`../../effect-orchestration-patterns`](../../effect-orchestration-patterns) —
  owns the shared `Schedule`/retry-policy foundation this packet's dispatch builder
  consumes; mirror its Q4 (package placement) and Q1 (pure-`Schedule` layer).
- **This packet's own trail:**
  [`../CAPTURE.md`](../CAPTURE.md) ·
  [`../RESEARCH.md`](../RESEARCH.md) (External Landscape + In-Repo Inventory + Constraints) ·
  [`../DECISIONS.md`](../DECISIONS.md) (Q1–Q7, pre-drafted recommendations) ·
  [`../BRIEF.md`](../BRIEF.md) · [`../MAP.md`](../MAP.md)
- **Per-subtopic raw research** (verbatim sources + line numbers + Open/Unverified caveats):
  [`./effect-fallback-execution-plan-survey.md`](./effect-fallback-execution-plan-survey.md) ·
  [`./resilience-strategy-config-model.md`](./resilience-strategy-config-model.md) ·
  [`./provider-registry-and-key-precedence-design.md`](./provider-registry-and-key-precedence-design.md) ·
  [`./per-provider-default-model-resolution.md`](./per-provider-default-model-resolution.md) ·
  [`./structured-output-and-secret-governance.md`](./structured-output-and-secret-governance.md)
- **Codex review (research gate-1, 1 blocking + 5 advisory, folded 2026-06-29):**
  [`../reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md)
