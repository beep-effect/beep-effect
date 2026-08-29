# Multi-Provider LLM Dispatch + Graceful Fallback

## Status

Stage: `graduate`
Status: `graduated`

Source: [`ops/manifest.json`](./ops/manifest.json)

Graduated:
[`goals/llm-provider-subscription-auth`](../../goals/llm-provider-subscription-auth/README.md)
— the shipped vendor-CLI subscription-auth leg (2026-07-11). The honest runtime
dispatch remainder is retained in [`MAP.md`](./MAP.md) as the demand-gated
`llm-runtime-dispatch` candidate; no new goal was scaffolded.

## Spark

beep ships four provider drivers and vendored ordered fallback through
`ExecutionPlan`. The remaining question is consumer demand: when two compatible,
credential-resolvable runtime targets are genuinely required, the owning
consumer may incubate an ordered dispatch policy at the agents server
composition boundary.

## Next Open Question

**Demand trigger:** Does a real consumer require two compatible,
credential-resolvable runtime targets? Until yes, `llm-runtime-dispatch` remains
named in [`MAP.md`](./MAP.md) but unscaffolded. Candidate consumer:
`AnthropicTurnKernel` successor work.

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

- 2026-07-14: closure — Q1-Q7 ratified; packet graduated on its shipped auth
  leg. Runtime ordered dispatch remains an explicit demand-gated candidate
  triggered only when a real consumer requires two compatible,
  credential-resolvable runtime targets; no goal scaffold created.
- 2026-07-11: partial graduation — CLI subscription-auth leg (vendor-CLI delegation, t3code methodology) graduated to `goals/llm-provider-subscription-auth` via /grill-with-docs; Q5's precedence resolver and all dispatch/fallback questions remain open here. `links.goals` updated.
- 2026-06-29: research-complete — RESEARCH.md synthesized, codex gate-1 folded, DECISIONS pre-drafted.
- 2026-06-29: packet opened from gold-intake cluster 'Multi-provider LLM dispatch + graceful fallback' (8 nuggets).
