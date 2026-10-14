# per-provider-default-model-resolution

Scope: how a multi-provider fallback chain must resolve each provider's OWN env-driven default model at fallback time (never inheriting the primary's model string), the cross-provider model-name compatibility rules that make this mandatory, and how per-provider env overrides (`ANTHROPIC_MODEL`, etc.) bind.

## Findings

### The motivating bug: a fallback that inherits the primary's model id 404s every call and trips the breaker

- agentmemory issue #778 is the canonical failure: "Cross-provider fallback always 404'd and tripped the circuit breaker (#778). Fallback resolved each provider's own env-driven default model instead of inheriting the primary's." The fix made each provider in the fallback chain use its own env-configured default model rather than the primary's. ([github.com/rohitg00/agentmemory](https://github.com/rohitg00/agentmemory) — surfaced via release/issue search; see Open/Unverified for direct-issue caveat)
- The repair pattern is a per-provider `defaultModelFor` switch read at fallback-config time. Verbatim from `src/providers/index.ts` ([github.com/rohitg00/agentmemory/blob/main/src/providers/index.ts](https://github.com/rohitg00/agentmemory/blob/main/src/providers/index.ts)):
  ```typescript
  function defaultModelFor(providerType: ProviderConfig["provider"]): string {
    switch (providerType) {
      case "openai":     return getEnvVar("OPENAI_MODEL")     || "gpt-4o-mini";
      case "anthropic":  return getEnvVar("ANTHROPIC_MODEL")  || "claude-sonnet-4-20250514";
      case "gemini":     return getEnvVar("GEMINI_MODEL")     || "gemini-2.5-flash";
      case "openrouter": return getEnvVar("OPENROUTER_MODEL") || "anthropic/claude-sonnet-4-20250514";
      case "minimax":    return getEnvVar("MINIMAX_MODEL")    || "MiniMax-M2.7";
      case "agent-sdk":  return "claude-sonnet-4-20250514";
    }
  }
  ```
  The crucial fallback-construction line builds the fallback config with `model: defaultModelFor(providerType)` — the FALLBACK provider's type, not the primary's — so the model string is re-derived per provider. ([github.com/rohitg00/agentmemory/blob/main/src/providers/index.ts](https://github.com/rohitg00/agentmemory/blob/main/src/providers/index.ts))
- Note the env-var convention surfaced by the same project's auto-detect logic: consolidation auto-enables when any of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` / `GEMINI_API_KEY` / `GOOGLE_API_KEY` / `MINIMAX_API_KEY` / `OPENAI_BASE_URL` is set. Each provider thus has BOTH a key env var and a `*_MODEL` env var, bound independently. ([Web search of agentmemory provider docs](https://github.com/rohitg00/agentmemory))

### Why model strings are NOT portable across provider boundaries (the compatibility rule)

The same logical Claude model has at least five distinct, mutually-incompatible id encodings depending on the serving surface — so reusing one provider's model string against another provider is a guaranteed `model_not_found` / HTTP 404:

| Surface | Model-id form (example: Claude Opus 4.8) | Source |
|---|---|---|
| Anthropic first-party API | `claude-opus-4-8` (dashes) | [code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config) |
| OpenRouter | `anthropic/claude-opus-4.8` (provider prefix + **dotted** version) | [openrouter.ai/docs/guides/overview/models](https://openrouter.ai/docs/guides/overview/models) |
| Bedrock (Mantle Messages API) | `anthropic.claude-opus-4-8` (`anthropic.` prefix) | [platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock](https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock) |
| Bedrock (cross-region inference profile) | `us.anthropic.claude-opus-4-8` (geo prefix `us.`/`eu.`/`apac.`/`global.`) | [code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config); [docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html) |
| Vertex AI | `claude-opus-4-5@20251101` (dashes + **`@YYYYMMDD`** version) | [docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude); [platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai](https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai) |

- Anthropic's own Claude Code docs make the rule explicit: "For the `model` setting... Anthropic API: a full model name; Bedrock: an inference profile ARN; Foundry: a deployment name; Vertex: a version name." These are not interchangeable strings. ([code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config))
- Independent corroboration of the cross-boundary 404 class: OpenClaw #20107 reports `anthropic/claude-sonnet-4-6` and `anthropic/claude-sonnet-4-5` returning `HTTP 404 not_found_error` via OpenRouter while the **same** token's direct Anthropic `/v1/messages` calls succeed — i.e., the dashed Anthropic-native id is invalid as an OpenRouter slug. ([github.com/openclaw/openclaw/issues/20107](https://github.com/openclaw/openclaw/issues/20107))
- OpenRouter prefers dotted version slugs (`anthropic/claude-sonnet-4.5`) and aliases some dashed forms (`anthropic/claude-3-5-sonnet` → canonical `anthropic/claude-3.5-sonnet`), but alias coverage is incomplete — so a dashed/dated Anthropic id passed to OpenRouter may or may not resolve. Treat OpenRouter slugs as a separate namespace, not a transform of the Anthropic id. ([openrouter.ai/anthropic/claude-sonnet-4.5](https://openrouter.ai/anthropic/claude-sonnet-4.5); [github.com/openclaw/openclaw/issues/20107](https://github.com/openclaw/openclaw/issues/20107))
- The rule generalizes beyond Claude: "OpenAI-compatible does not mean every model ID is the same across every provider — each provider has its own model naming" (e.g., `gpt-4o` for OpenAI vs `groq/<model>` for Groq); switching providers while keeping the same model string surfaces a hidden incompatibility only at request time. ([evolink.ai/blog/model-not-found-openai-compatible-api](https://evolink.ai/blog/model-not-found-openai-compatible-api); [ofox.ai/blog/openai-api-model-not-found-errors-troubleshooting](https://ofox.ai/blog/openai-api-model-not-found-errors-troubleshooting))

### How env overrides bind per provider (canonical implementations)

**Claude Code** is the strongest real-world reference for per-provider model resolution + fallback, and its design directly mirrors the subtopic:
- Model-selection precedence (highest first): `/model` in-session → `--model` flag → `ANTHROPIC_MODEL` env var → settings `model` field. `ANTHROPIC_BASE_URL` "changes where requests are sent, not which model answers them" — keep endpoint and model resolution orthogonal. ([code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config))
- Per-family alias→id binding env vars: `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_DEFAULT_FABLE_MODEL` control what the `opus`/`sonnet`/`haiku`/`fable` aliases resolve to per deployment. **Deprecation (dated):** `ANTHROPIC_SMALL_FAST_MODEL` is deprecated in favor of `ANTHROPIC_DEFAULT_HAIKU_MODEL`. ([code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config))
- Provider-form pinning is required because aliases resolve to provider-specific ids — the docs give the exact divergence: Bedrock `export ANTHROPIC_DEFAULT_OPUS_MODEL='us.anthropic.claude-opus-4-8'` vs Vertex/Foundry `export ANTHROPIC_DEFAULT_OPUS_MODEL='claude-opus-4-8'`. ([code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config))
- Fallback chains must identify BOTH models per provider: "On Amazon Bedrock, Google Vertex AI, and Microsoft Foundry, model IDs are provider-specific, so automatic fallback only operates when Claude Code can identify both models involved... To enable automatic fallback on these providers, set `ANTHROPIC_DEFAULT_FABLE_MODEL` to your Fable 5 model ID and `ANTHROPIC_DEFAULT_OPUS_MODEL` to your Opus 4.8 model ID." This is the same lesson as agentmemory #778: a fallback target must be resolved in the target provider's own id namespace. ([code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config))
- `modelOverrides` settings map maps Anthropic model ids → provider-specific strings (ARNs / Vertex version names / Foundry deployment names), and "Values you supply directly through `ANTHROPIC_MODEL`, `--model`, or the `ANTHROPIC_DEFAULT_*_MODEL` environment variables are passed to the provider as-is and are not transformed by `modelOverrides`." Allowlist matching is done against the provider-form id and "provider-specific prefixes such as `us.anthropic.` are not stripped." ([code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config))

**LiteLLM** proves the architectural invariant: each fallback deployment carries its own distinct model name + provider in its `model_list` entry and does not inherit the requester's model. Fallbacks map a source model group to a list of alternative model groups tried in order (`fallbacks: [{"gpt-3.5-turbo": ["gpt-4"]}]`), plus `context_window_fallbacks` and a `default_fallbacks` catch-all; each fallback entry holds its own auth/endpoint/model. v1.44+ adds context-aware fallback that strips incompatible params (e.g. `response_format`) before routing to a different provider. ([docs.litellm.ai/docs/proxy/reliability](https://docs.litellm.ai/docs/proxy/reliability))

**Vercel AI SDK** binds the model id to the provider via a `providerId:modelId` registry (`createProviderRegistry`, default `:` separator, customizable; `registry.languageModel("anthropic:claude-...")`). The provider id is the prefix, so a model id is never resolved outside its provider's namespace — the same separation agentmemory enforces imperatively. ([ai-sdk.dev/docs/ai-sdk-core/provider-management](https://ai-sdk.dev/docs/ai-sdk-core/provider-management); [ai-sdk.dev/docs/reference/ai-sdk-core/provider-registry](https://ai-sdk.dev/docs/reference/ai-sdk-core/provider-registry))

### Repo grounding (beep-effect): each driver already owns its own default + env key — the dispatch layer must NOT thread one model id

- Every existing driver already pins its OWN default model behind its OWN config symbol, which is exactly the per-provider resolution the dispatch layer should call into rather than re-deriving: Anthropic `ANTHROPIC_DEFAULT_MODEL = "claude-opus-4-6"` with key env `ANTHROPIC_API_KEY_ENV = "AI_ANTHROPIC_API_KEY"` (`packages/drivers/anthropic/src/Anthropic.config.ts`); Venice `VENICE_CHAT_MODEL = "venice-uncensored-1-2"` (`packages/drivers/venice-ai/src/VeniceAI.service.ts`); openai-compat takes a generic `model: S.String` (caller-supplied, `packages/drivers/openai-compat/src/OpenAiCompat.models.ts`); xAI is grok-family. (filesystem-grounded; tree-snapshot 2026-06-29)
- The Anthropic driver binds the model at LAYER construction: `AnthropicLanguageModel.layer({ model: options.model ?? ANTHROPIC_DEFAULT_MODEL })` (`packages/drivers/anthropic/src/Anthropic.service.ts:41,62-64`). Implication for the net-new dispatch layer: because `@effect/ai-*` model layers are per-provider and take their own `model` param, a `Layer.orElse` fallback to a different provider's pre-built layer naturally uses that provider's own default — the footgun is only introduced if the dispatch code threads a single shared `model` string into a provider-generic call. The safe shape is `defaultModelFor(provider)` (env → pinned default) evaluated per provider at fallback time, identical to agentmemory's repair. (filesystem-grounded; cross-ref agentmemory finding above)
- The Anthropic driver also pins the model deliberately and warns it must track the upstream `@effect/ai-anthropic` catalog ("The generated `@effect/ai-anthropic` catalog validates streamed response model ids. Keep this pinned until the upstream catalog accepts newer model identifiers."), a second compatibility boundary: even within one provider, the validated-catalog version constrains which model strings are accepted. (`packages/drivers/anthropic/src/Anthropic.config.ts:28-46`)

### Design rules distilled (for the align/shape stage)

1. Resolve model id strictly inside the resolving provider's namespace: `model = env(`${PROVIDER}_MODEL`) ?? PINNED_DEFAULT[provider]`. Never pass the upstream/primary's resolved model id into a downstream provider. (agentmemory #778; Claude Code fallback rule)
2. Treat key env var and model env var as an independent pair per provider; treat base-url/endpoint as orthogonal to model resolution (`ANTHROPIC_BASE_URL` ≠ model). ([code.claude.com/docs/en/model-config](https://code.claude.com/docs/en/model-config))
3. For Claude served via non-native surfaces, encode the namespace transform explicitly (native `claude-opus-4-8` ↔ OpenRouter `anthropic/claude-opus-4.8` ↔ Bedrock `us.anthropic.claude-opus-4-8` ↔ Vertex `claude-opus-4-8@<date>`); do not assume a string substitution. (multi-source table above)
4. Prefer validating model ids at startup and maintaining an explicit provider→model map over discovering incompatibility at request time. ([evolink.ai/blog/model-not-found-openai-compatible-api](https://evolink.ai/blog/model-not-found-openai-compatible-api))

## Sources

- agentmemory repo + `src/providers/index.ts` (`defaultModelFor`, FallbackChainProvider/ResilientProvider): https://github.com/rohitg00/agentmemory/blob/main/src/providers/index.ts ; https://github.com/rohitg00/agentmemory
- Claude Code model configuration (env precedence, `ANTHROPIC_DEFAULT_*_MODEL`, `modelOverrides`, fallback chains, Bedrock vs Vertex pinning, `ANTHROPIC_SMALL_FAST_MODEL` deprecation): https://code.claude.com/docs/en/model-config
- Claude in Amazon Bedrock (model-id `anthropic.` prefix, Mantle vs legacy InvokeModel/Converse, regional endpoints): https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock
- Bedrock inference profiles / cross-region geo prefixes (`us.`/`eu.`/`apac.`): https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html
- Claude on Vertex AI model-id `@YYYYMMDD` version form: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/partner-models/claude ; https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai
- OpenRouter model-slug format (`anthropic/claude-...`, dotted versions, alias redirects): https://openrouter.ai/docs/guides/overview/models ; https://openrouter.ai/anthropic/claude-sonnet-4.5
- OpenClaw #20107 (dashed Anthropic id 404s on OpenRouter, works native) — cross-boundary 404 corroboration: https://github.com/openclaw/openclaw/issues/20107
- LiteLLM reliability/fallbacks (per-deployment model name, `fallbacks`/`context_window_fallbacks`/`default_fallbacks`, v1.44 param stripping): https://docs.litellm.ai/docs/proxy/reliability
- Vercel AI SDK provider/model management + registry (`providerId:modelId`, separator, `languageModel`): https://ai-sdk.dev/docs/ai-sdk-core/provider-management ; https://ai-sdk.dev/docs/reference/ai-sdk-core/provider-registry
- "Model not found" cross-provider troubleshooting (per-provider naming, startup validation, mapping layer): https://evolink.ai/blog/model-not-found-openai-compatible-api ; https://ofox.ai/blog/openai-api-model-not-found-errors-troubleshooting
- Repo (filesystem-grounded 2026-06-29): `packages/drivers/anthropic/src/{Anthropic.config.ts,Anthropic.service.ts}`, `packages/drivers/venice-ai/src/VeniceAI.service.ts`, `packages/drivers/openai-compat/src/OpenAiCompat.models.ts`

## Open / Unverified

- **agentmemory #778 direct issue page** not fetched verbatim — the exact text ("Cross-provider fallback always 404'd and tripped the circuit breaker") is reconstructed from search snippets over the agentmemory repo/releases and the CAPTURE nugget; the `defaultModelFor` source code IS verified verbatim from `src/providers/index.ts`. Confirm the issue number/wording directly before citing #778 as a hard fact in a brief.
- **agentmemory license** not verified — CAPTURE marks agentmemory#4 `rec=port`, but no license was confirmed in this pass. Verify (LICENSE file) before porting code verbatim; the `defaultModelFor` SHAPE is trivial enough to reimplement license-free regardless.
- **agentmemory default model strings are stale** — `claude-sonnet-4-20250514`, `gpt-4o-mini`, `gemini-2.5-flash`, `MiniMax-M2.7` reflect mid-2025; the repo's own pins (e.g. `claude-opus-4-6`) and current Anthropic lineup (Opus 4.8, Fable 5) are newer. Port the pattern, not the literals.
- **OpenRouter dashed-vs-dotted acceptance** is provider-version-dependent and partially aliased; whether a given dated/dashed Anthropic id resolves on OpenRouter must be checked per model (the OpenClaw #20107 evidence shows it can 404). Don't rely on a mechanical native→OpenRouter string transform.
- **Bedrock "Mantle" (`anthropic.claude-opus-4-8`) vs legacy cross-region inference-profile (`us.anthropic.claude-...`, sometimes `:v1:0` suffixed) coexistence** — both id forms are live (new Messages API path vs legacy InvokeModel/Converse). Which one a given Bedrock deployment needs depends on the endpoint/SDK; verify against the specific Bedrock client before pinning.
- **`@effect/ai` / `effect/ai` fallback combinator** (whether `Layer.orElse` vs `ExecutionPlan` is the idiomatic cross-provider fallback primitive in the vendored effect-v4) is NOT settled here — CAPTURE flags this as a build-time validation item; out of scope for model-resolution but gates how `defaultModelFor` is wired in.
- **Non-Anthropic env-var conventions** (`OPENAI_MODEL`, `GROQ_MODEL`, `MISTRAL_MODEL`, `GEMINI_MODEL`, `OPENROUTER_MODEL`) are tool/app-level conventions (agentmemory, various CLIs), NOT official provider-SDK env vars — the official SDKs take the model as a call argument. Treat these names as the dispatch layer's OWN convention, documented explicitly, not as SDK-honored variables.
