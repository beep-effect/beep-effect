# Multi-Provider LLM Dispatch + Graceful Fallback

## Status

Stage: `research`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

Graduated (partial):
[`goals/llm-provider-subscription-auth`](../../goals/llm-provider-subscription-auth/README.md)
— the CLI subscription-auth leg of Q5's user>CLI>env precedence chain
(2026-07-11). Dispatch/registry/fallback and the precedence resolver itself
remain here.

## Spark

beep already ships the four per-provider LLM drivers (`@beep/anthropic`,
`@beep/openai-compat`, `@beep/xai`, `@beep/venice-ai`) but nothing owns the
layer above them: a shared Effect dispatch Layer that resolves keys by
user-key > env > CLI precedence, falls back across providers with
`Layer.orElse` + retry, and resolves each provider's OWN default model so a
fallback never inherits an incompatible model name.

## Next Open Question

**Q1 (highest-leverage):** Does this packet own only the declarative
dispatch/registry surface ABOVE `ExecutionPlan`, or also the shared retry/
`Schedule` policy library plus round-robin + circuit-breaker? This root scope
fork gates the whole packet — including its sequencing dependency on sibling
`effect-orchestration-patterns` (Q1), build-vs-buy (Q2), and V1 resilience scope
(Q7). Recommended answer pre-drafted in [`DECISIONS.md`](./DECISIONS.md); resolve
the full set with `/grill-with-docs multi-provider-llm-dispatch-fallback`.

## Sources & provenance

[`research/SOURCES.md`](./research/SOURCES.md) — the provenance ledger tracing
this packet's 8 gold nuggets to their upstream repos + licenses, the on-disk
external citations, and the `@beep/*` capabilities they compose. Derived from the
gold-intake cluster "Multi-provider LLM dispatch + graceful fallback"
([ROUTING.md](../_gold-intake/ROUTING.md) ·
[GOLD_SYNTHESIS.md](../_gold-intake/GOLD_SYNTHESIS.md)).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-07-11: partial graduation — CLI subscription-auth leg (vendor-CLI delegation, t3code methodology) graduated to `goals/llm-provider-subscription-auth` via /grill-with-docs; Q5's precedence resolver and all dispatch/fallback questions remain open here. `links.goals` updated.
- 2026-06-29: research-complete — RESEARCH.md synthesized, codex gate-1 folded, DECISIONS pre-drafted.
- 2026-06-29: packet opened from gold-intake cluster 'Multi-provider LLM dispatch + graceful fallback' (8 nuggets).
