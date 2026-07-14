<!-- Inherited at graduation (2026-07-14) from explorations/agent-effectiveness-pulse/research/SOURCES.md — that ledger is PRIMARY; this copy exists so implementation sessions have the corpus in-packet. Goal-specific additions go below the inherited section. -->

# Agent Effectiveness Pulse — Sources & Provenance

- **Cluster / origin:** pre-exploration recon (2026-07-13 kickoff session) +
  five read-only codex lanes (GPT-5.6 Sol, medium effort): prior-art
  distillation, data feasibility, claude-discovery root cause, AGENTS.md
  pre-audit, external landscape.
- **Provenance:** briefs materialized verbatim into `research/2026-07-13-*.md`;
  live recon evidence recorded in `RESEARCH.md` and `CAPTURE.md`.

## 1. Mined source corpus

Not applicable — no upstream code corpus is being mined; evidence is local
telemetry, local transcripts, and repo prior art.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [ryoppippi/ccusage](https://github.com/ryoppippi/ccusage) | MIT (verify at adoption) | reference-only for now; run as a tool, no code ported | token/cost reconciliation validator |
| [harbor-framework/harbor](https://github.com/harbor-framework/harbor) | unverified | reference-only | task-packaging pattern for a possible later replay suite |
| [open-telemetry/semantic-conventions](https://github.com/open-telemetry/semantic-conventions) | Apache-2.0 | reference/standard adoption | GenAI semconv attribute names (version-pinned) |
| [openai/codex](https://github.com/openai/codex) | Apache-2.0 | reference-only | OTel exporter config schema for native telemetry |

## 3. External research sources

All URLs below appear on disk in
[`2026-07-13-external-landscape.md`](../../../explorations/agent-effectiveness-pulse/research/2026-07-13-external-landscape.md):

- OpenTelemetry GenAI attribute registry; semantic-conventions releases;
  `gen_ai_normalizer` collector processor docs.
- Arize Phoenix docs (overview, evaluator traces).
- Langfuse evaluation docs; Braintrust experiments/comparison/OTel/agent
  best-practice docs; W&B Weave evaluations/scorers docs; OpenLLMetry docs.
- Claude Code docs: monitoring-usage, prompt-caching, costs, slash-commands,
  sub-agents; Claude usage-analytics availability article.
- Codex: config schema, Grafana dashboard 25266, telemetry coverage issue
  #12913, pricing/limits page.
- agents.md; Linux Foundation Agentic AI Foundation announcement.
- Harness Bench; RepoGauge; Stet methodology.
- ccusage repo + cost-modes guide; claude-usage repo.

Claims without URLs are carried by
[`RESEARCH.md`](../../../explorations/agent-effectiveness-pulse/RESEARCH.md) (live recon, verified in-session) and the
prior-art brief's `path:line` citations into this repo's goal packets.

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | reuse |
| ai-metrics CLI | `packages/tooling/tool/cli/src/commands/AIMetrics` | reuse |
| Phoenix deploy | `infra/src/AIMetrics.ts`, `infra/Pulumi.beep-ai-metrics-dankserver.yaml` | reuse (deployed, healthy) |
| Yeet telemetry | `.beep/yeet/runs` (main + 7 sibling clones) | reuse; step durations NET-NEW (future yeet goal) |
| Reflections corpus | `goals/*/history/reflections/` | reuse |
| Skill inventory | `.claude/skills/`, plugin skills | reuse (denominator) |
| Skill-invocation metric | — | NET-NEW (pulse computes from transcripts) |
| Token-cost (USD) fields | — | NET-NEW (delegated to ai-metrics-stack P7c) |
| Repo replay/eval suite | `ai_metrics_benchmark_*` tables (2 cases, skeletal) | extend or NET-NEW (graduation candidate) |

## 5. Cross-links & provenance

- Prior-art packets: `goals/ai-metrics-stack`, `goals/agent-effectiveness-loop`,
  `goals/agent-effectiveness-phoenix-enrichment` (superseded),
  `goals/agent-effectiveness-workflow-integration` (superseded),
  `goals/agent-pipeline-velocity`, `goals/yeet-agent-ergonomics`,
  `explorations/agent-pipeline-velocity` (graduated).
- This packet's own artifacts: [`RESEARCH.md`](../../../explorations/agent-effectiveness-pulse/RESEARCH.md),
  [`CAPTURE.md`](../../../explorations/agent-effectiveness-pulse/CAPTURE.md), `research/2026-07-13-*.md`.
- Graduated goals: none yet (see `ops/manifest.json` `links.goals`).
