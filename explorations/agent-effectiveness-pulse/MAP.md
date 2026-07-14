# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `harness-otel-adoption` | Native Claude Code + Codex OTLP into the existing collector→Phoenix path with beep-owned attribute schema (incl. task attribution); content capture off | none | local `deploy-otel-collector-1` + `infra/src/AIMetrics.ts` Phoenix deploy (reuse); `@beep/observability` (reuse); harness exporter configs NET-NEW (config, not code); attribute-translation contract NET-NEW (small) |
| `harness-hygiene-mechanical` | Delete 4 dead skills, evict volatile AGENTS.md state, add 3 requested laws | none | `.claude/skills/*` + `AGENTS.md` (edit in place); evidence: `research/pulse/skill-usage.md`, `research/2026-07-13-agents-md-preaudit.md`, `research/pulse/closeout-hypotheses.md` |
| `yeet-verdict-instrumentation` (wave 2) | Per-step durations, structured failure codes, attempt links, PR lifecycle events in yeet artifacts | benefits from `harness-otel-adoption` conventions | yeet runner + `.beep/yeet/runs` verdict/state/status writers (extend); spec seed: `research/pulse/bottlenecks.md` §Instrumentation gaps; successor to `goals/yeet-agent-ergonomics` (completed-retained) |
| `repo-replay-evals` (wave 2) | 5 historical merged fixes as deterministic replay tasks with repeated trials | `harness-otel-adoption` (scoring enrichment); pairs with yeet instrumentation | `ai_metrics_benchmark_*` tables in `@beep/repo-ai-metrics` (extend — 2 skeletal cases exist); yeet quality gates as graders (reuse); task corpus NET-NEW |

**Not a goal — addendum to `goals/ai-metrics-stack`** (new durability phase
tied to P7e): parquet-export regression fix, forwarder error-cause
surfacing, ingest-time dedup, chunked bulk writes. Owner: that packet's
PLAN.md/manifest, edited at wave-1 graduation.

## Sequencing

1. **Wave 1, now**: `harness-otel-adoption` + `harness-hygiene-mechanical`
   in parallel (disjoint surfaces: harness config vs docs/skills). Both are
   days-scale.
2. **ai-metrics-stack durability phase**: registered at the same time (it
   gates P7e closeout, which is V1-blocking for that packet); executed by
   whoever picks up that packet next.
3. **Wave 2, after wave 1 lands**: `yeet-verdict-instrumentation` +
   `repo-replay-evals`. Gate: OTel attributes flowing (so instrumentation
   and replay scoring share the attribution vocabulary).
4. H1/H3/H6 hypothesis retests become wave-2 acceptance evidence; H8 waits
   for a browser-proof dimension (unowned — revisit at wave-2 graduation).

## First Vertical Slice

`harness-otel-adoption`, slice 1: Claude Code OTel enabled on this
workstation exporting to the local collector with `repo` + `goal-slug`
attributes, visible in Phoenix as a distinct project within one session of
work. Verify: run one real session, query Phoenix GraphQL for the new
project's trace count and attribute presence. (Codex exporter + attribute
schema contract are slices 2–3.)

## Open Risks Inherited From The Brief

- Parquet root-cause unknown — time-boxed diagnosis in the ai-metrics-stack
  phase; fallback is dep pin.
- OTel GenAI semconv churn — pin + translate; never expose upstream names to
  scorecards.
- Codex OTel coverage gaps per execution mode — verify before trusting.
- Dual-ingestion double-counting — precedence rule is an early OTel-goal
  decision.
- Secret/env handling around the systemd timer must not regress.
