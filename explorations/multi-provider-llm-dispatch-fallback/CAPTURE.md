# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-06-29 — Gold-intake seed

Seeded from the gold-intake harvest. Full synthesis context:
[`explorations/_gold-intake/GOLD_SYNTHESIS.md`](../_gold-intake/GOLD_SYNTHESIS.md)
→ section **"### MCP server design" › "#### Multi-provider LLM dispatch with
key precedence + automatic fallback"** (around line 1650). Routing record:
[`explorations/_gold-intake/routing.json`](../_gold-intake/routing.json)
cluster `Multi-provider LLM dispatch + graceful fallback`. Per-nugget detail:
[`explorations/_gold-intake/research/gold-catalog.json`](../_gold-intake/research/gold-catalog.json).

**Cluster rationale:** GOLD_SYNTHESIS flags a shared multi-provider dispatch
Layer as a real gap — the four LLM drivers exist but no Layer owns
user-key>env precedence + graceful fallback + per-provider default-model
resolution. Adjacent to but distinct from `mcp-auth-gated-registration`
(MCP-side credential-keyed registration) and `ingestion-security` (secret
storage). The net-new here is the DISPATCH/fallback layer, NOT the drivers.

- route: `new-exploration` → primaryTarget `multi-provider-llm-dispatch-fallback` (targetExists: false)
- wave: `P2` · waveHistogram P1=0 / P2=7 / P3=1
- themeSpan: `governance-ops`, `mcp-design`
- secondaryTargets: `explorations/effect-orchestration-patterns`, `packages/agents/server`, `packages/drivers/anthropic`, `packages/drivers/nlp-mcp`, `packages/drivers/openai-compat`, `packages/drivers/venice-ai`, `packages/drivers/xai`, `packages/foundation/capability/langextract`

### Nuggets (8)

- **harvest-mcp#1** (harvest-mcp) — Multi-provider LLM factory with registry, priority resolution, and actionable missing-key errors. `src/core/providers/ProviderFactory.ts:17-245`. → feeds netNew #3 (typed PROVIDER_REGISTRY + prefix auto-detect + structured `api_key_required`/setupInstructions errors as an Effect Layer with typed config errors). rec=port BUT **unknown-license → reimplement, do not port verbatim**. Snippet: `PROVIDER_REGISTRY: Record<string, {factory, requiredEnvVar, defaultModel}>; resolve precedence CLI > params > env; auto-detect by key prefix (sk- vs AIza); throw HarvestError carrying setupInstructions + nextActions`.
- **Juris.AI#1** (Juris.AI, MIT) — Multi-provider LLM dispatch with key-resolution + automatic fallback. `src/lib/ai-services.ts:381-457`. → feeds netNew #1 (shared dispatch Layer: user-key>env precedence + `Layer.orElse` graceful fallback chain, typed errors instead of try/catch). rec=port. Snippet: `getApiResponse() resolves per-provider key (user map -> env via getApiKey), switch-dispatches openai/anthropic/gemini/mistral/.../chutes; on any failure retries default provider (Mistral)`.
- **agentmemory#4** (agentmemory) — Multi-provider LLM abstraction with resilient wrapper, fallback chain, and per-provider default models. `src/providers/index.ts:35-93`. → feeds netNew #2 (per-provider OWN env-driven default-model resolution so a fallback never inherits an incompatible model name) + the circuit-breaker / FallbackChainProvider resilience angle of netNew #1/#4. rec=port. Snippet: `defaultModelFor(providerType) switches ANTHROPIC_MODEL || "claude-sonnet-4-...", OPENROUTER_MODEL || "anthropic/claude-sonnet-4-..."; new ResilientProvider(new FallbackChainProvider(providers)); fixes #778 where fallback inherited primary's model and 404'd every call, tripping the breaker`.
- **TalentScore#2** (TalentScore, BAML Apache-2.0) — Multi-provider LLM client config with fallback / round-robin / retry policies. `packages/server/baml_src/clients.baml:112-146`. → feeds netNew #4 (declarative resilience-strategy config: round-robin / ordered-fallback / named retry-policy re-expressed over `effect/ai`). rec=reference — **config-pattern reference only, do NOT adopt the BAML runtime**. Snippet: `client<llm> OpenaiFallback { provider fallback options { strategy [CustomGPT5Mini, CustomGPT5] } }; retry_policy Exponential { max_retries 2 strategy { type exponential_backoff delay_ms 300 multiplier 1.5 max_delay_ms 10000 } }`.
- **research-squad#15** (research-squad) — BAML multi-provider client config with round-robin and fallback. `baml_src/clients.baml:38-54`. → feeds netNew #4 (concise reference for provider abstraction + retry-policy attachment + resilient fallback/load-balancing). rec=reference. Snippet: `client<llm> CustomFast { provider round-robin options { strategy [CustomGPT5Mini, CustomHaiku] } } client<llm> OpenaiFallback { provider fallback options { strategy [...] } }`.
- **courtlistener#5** (courtlistener, AGPL-3.0) — Multi-provider structured-output LLM wrapper (Instructor + Pydantic). `cl/lib/llm.py:8-58`. → feeds netNew #5 (`response_model` -> `effect/Schema`-validated structured output binding). rec=reference — **AGPL → port patterns only, no code**. Snippet: `call_llm(system_prompt, user_prompt, model="openai/gpt-4o-mini", response_model: type[BaseModel] | None, temperature=0.0); client = instructor.from_provider(model, api_key) — one "provider/model" string selects backend`.
- **mike#10** (mike, AGPL-3.0) — Provider-agnostic tool-schema adapter (OpenAI -> Claude/Gemini). `backend/src/lib/llm/tools.ts:29-44`. → maps to alreadyCovered (`effect/ai` Toolkit likely abstracts per-provider tool dispatch) — study how single-source tool defs adapt per provider before building. rec=study — **AGPL → patterns only**. Snippet: `toGeminiTools(tools) maps each via normalizeSchema, omitting empty parameters which Gemini rejects (recursively ensure arrays have items / objects have properties); one internal OpenAI-style tool def -> Claude (toClaudeTools) + Gemini`.
- **stenoai#2** (stenoai) — Multi-provider LLM abstraction (local/remote/cloud/adapter). `src/summarizer.py:109-179`. → feeds the auth/governance angle of netNew #1: the `adapter` pattern (desktop holds a JWT to a proxy that holds the real API key server-side) is a local-first secret-governance pattern for a solo-attorney app that must not store provider secrets client-side. rec=study · P3. Snippet: `self.ai_provider = ... if "adapter": desktop never sees provider key, URL+JWT from env set by Electron; elif "cloud": anthropic via SDK / bedrock via Converse HTTPS / openai+custom base_url`.

### netNew — build list

1. Shared Effect dispatch Layer owning user-key>env>CLI precedence + `Layer.orElse` graceful fallback across `@beep/{anthropic,openai-compat,xai,venice-ai}`.
2. Per-provider OWN env-driven default-model resolution so a fallback never inherits an incompatible model name.
3. Typed `PROVIDER_REGISTRY` + prefix auto-detect + structured `api_key_required`/setupInstructions errors.
4. Declarative resilience-strategy config (round-robin / ordered-fallback / named retry-policy) re-expressed over `effect/ai`.
5. `response_model` -> `effect/Schema`-validated structured-output binding.

### alreadyCovered — reuse, do not rebuild

- The four per-provider LLM drivers already exist (`@beep/anthropic` / `openai-compat` / `xai` / `venice-ai`); `effect/ai` Toolkit likely abstracts per-provider tool dispatch (mike#10 study). Net-new is the DISPATCH/fallback layer ABOVE the drivers, not the drivers.

### cautions

- BAML (Apache-2.0) client declarations are config-pattern reference only — do not adopt the BAML runtime.
- Validate `Layer.orElse` / `ExecutionPlan` against the vendored effect-v4 before building; reuse anthropic/openai-compat retry code, do not duplicate.
- Fuse with `effect-orchestration-patterns`' centralized retry-policy library (shared `Schedule` policies).
- License: harvest-mcp#1 (multi-provider factory, rec=port) is unknown-license → **reimplement**; courtlistener#5 (ref) + mike#10 (study) are AGPL-3.0 → **port patterns only**.
