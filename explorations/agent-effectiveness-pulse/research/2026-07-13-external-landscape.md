# External Landscape — agent observability, harness ergonomics, evals, spend

> Provenance: pre-exploration codex lane (GPT-5.6 Sol, medium effort,
> web-enabled), 2026-07-13. Claims marked [verify] need confirmation in the
> exploration's research-deepening phase.

Thesis: beep-effect already has the hard part — privacy-preserving raw data,
durable local analytics, an OTLP backend. Improve normalization,
coding-agent-native instrumentation, and repeatable evaluations; do not
replace the stack.

## 1. Agent/LLM observability state of the art

OpenTelemetry GenAI conventions are the interoperability target but not
stable enough to serve as an immutable warehouse schema: the registry labels
operations like `chat`, `invoke_agent`, `execute_tool`, `retrieval` as
development-stage, and recent releases contain GenAI breaking changes. Pin
the emitted convention version and translate into a beep-owned stable schema.
([GenAI registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/),
[semantic-conventions releases](https://github.com/open-telemetry/semantic-conventions/releases))

The OTel Collector's `gen_ai_normalizer` processor translates OpenInference
and OpenLLMetry attributes into official `gen_ai.*` conventions (tokens,
models, messages, tools, sessions, operation kinds). Alpha for traces —
pilot behind retained raw telemetry.
([processor docs](https://pkg.go.dev/github.com/open-telemetry/opentelemetry-collector-contrib/processor/genainormalizerprocessor))

| Tool | Coding-agent fit | Verdict |
|---|---|---|
| Phoenix | Self-hosted OTLP + OpenInference; sessions, evaluators, datasets, experiments ([overview](https://arize.com/docs/phoenix)) | **Keep** — matches privacy + OTLP architecture. |
| Langfuse | Integrated tracing/dashboards/datasets/annotation ([eval concepts](https://langfuse.com/docs/evaluation/core-concepts)) | Best alternative all-in-one; no coding-agent advantage worth migration. |
| Braintrust | Immutable experiments, branch-aware comparisons, repeated trials, CI regression gates, TS scorers ([experiments](https://www.braintrust.dev/docs/evaluate/run-evaluations), [OTel](https://www.braintrust.dev/docs/integrations/sdk-integrations/opentelemetry)) | **Steal the eval model**, keep Phoenix. |
| W&B Weave | Trace/dataset/scorer lineage; advanced scorers partly Python-only ([evaluations](https://docs.wandb.ai/weave/guides/core-types/evaluations)) | Watch; better for existing W&B shops. |
| OpenLLMetry | OTel instrumentation, Anthropic/OpenAI TS support ([intro](https://docs.traceloop.com/docs/openllmetry/introduction)) | Skip — redundant once harnesses emit native OTel. |

**Native harness telemetry** (the big adopt):

- Claude Code exports metrics, log/events, optional traces via OTel:
  sessions, token and cache usage, estimated cost, commits, PRs, code edits,
  tool decisions, API errors, prompt/session correlation
  ([monitoring docs](https://code.claude.com/docs/en/monitoring-usage)).
  Individual Pro/Max users do not get Anthropic's org analytics dashboard
  ([availability](https://support.claude.com/en/articles/12157520-claude-code-usage-analytics)).
- Codex config supports separate OTLP log/metric/trace exporters, custom span
  attributes, environment tags, optional prompt logging
  ([config schema](https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json));
  a community Grafana dashboard visualizes sessions, turns, tools, tokens,
  cache efficiency, approvals, failures, latency
  ([dashboard 25266](https://grafana.com/grafana/dashboards/25266-codex/)).
  Coverage has had command-specific gaps — verify every execution mode used
  here ([coverage issue](https://github.com/openai/codex/issues/12913)).

Transcript analytics: `ccusage` reads local Claude Code + Codex (and other
CLI) data and produces daily/monthly/session token + estimated-cost reports
([ccusage](https://github.com/ryoppippi/ccusage)); `claude-usage` offers
SQLite/dashboard over `~/.claude/projects` JSONL
([claude-usage](https://github.com/phuryn/claude-usage)). Useful validators;
local transcript formats remain vendor-controlled.

**Steal this:** enable native Claude Code and Codex OTel into the existing
collector, retain raw events, add a version-pinned normalization layer.

## 2. Harness ergonomics trends

`AGENTS.md` is now stewarded under the Linux Foundation's Agentic AI
Foundation alongside MCP and goose; the format encourages nested files with
nearest-file precedence
([LF announcement](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation?hs_amp=true),
[agents.md](https://agents.md/index)).

Dominant pattern — short stable root contract + progressive disclosure:
laws/quality-commands/safety/navigation at root; nested files only for
package-local differences; skills expose trigger descriptions and load full
content on invocation; subagents get narrow roles/tools/outputs
([skills](https://code.claude.com/docs/en/slash-commands),
[subagents](https://code.claude.com/docs/en/sub-agents)).

Cache-prefix discipline is concrete engineering: stable system/tool
definitions order before project context; model changes, MCP reconnects, and
compaction invalidate cache; skill invocation and subagent spawning append
without disturbing the parent prefix
([prompt caching](https://code.claude.com/docs/en/prompt-caching)).

Measurement trend: configuration-level evaluation — compare model,
instructions, skill set, tool availability, orchestration policy against the
same repository tasks. Harness Bench evaluates harness effects
([harness-bench.ai](https://www.harness-bench.ai/)); RepoGauge and Stet derive
replay tasks from historical fixes and compare success/cost/latency/
regressions ([repogauge.org](https://repogauge.org/),
[stet methodology](https://www.stet.sh/methodology)).

Avoid raw lines-generated or commit counts as effectiveness measures; task
completion, verifier results, regressions, human intervention, and cost per
accepted result are stronger
([Braintrust agent guidance](https://www.braintrust.dev/docs/best-practices/agents)).

**Steal this:** treat every AGENTS.md/skill change as an experimentable
harness version gated on a fixed replay slice — which is exactly the
config-snapshot scorecard model already in `@beep/repo-ai-metrics`.

## 3. Eval loops for coding agents on a private repo

Sustainable solo loop, 10–20 historical tasks:

1. Select merged bug fixes / small refactors with clear acceptance behavior.
2. Record pre-change commit, task statement, bootstrap recipe, relevant
   tests, human patch (diagnostic evidence only).
3. Grade with deterministic tests, type/lint/architecture checks,
   forbidden-file boundaries, dirty-worktree inspection — not textual
   similarity to the human patch.
4. Run each configuration multiple times; coding-agent variance makes one
   run weak evidence.
5. Store pass/fail, partial verifier results, interventions, elapsed time,
   tokens/cache, tool failures, changed files, final diff size.
6. Promote interesting real failures into the replay set.

Harbor is the credible general-purpose framework if containerized isolation
becomes necessary (task = instruction + environment + reference solution +
executable tests; runs Claude Code, Codex, others; private tasks supported)
([tasks](https://www.harborframework.com/docs/tasks),
[repo](https://github.com/harbor-framework/harbor)). Do **not** start by
containerizing the monorepo: first replay a five-task smoke slice using
temporary worktrees or disposable clones [verify], the existing quality
operator, and the current DuckDB/Phoenix pipeline.

Cadence: per material harness change — five-task smoke, two configs,
preferably three trials; monthly or pre-model-migration — full matrix;
manual audit of every failure plus sampled passes; promotion rule — no
deterministic regression, improvement must repeat across tasks.

**Steal this:** build five executable historical task replays before buying
or integrating an eval platform; the dataset and verifiers are the asset.

## 4. Token-spend analytics

Three distinct numbers for subscription usage:

- **Actual marginal cash** — usually zero inside Claude Max/Codex limits.
- **API-equivalent value** — tokens × public API pricing.
- **Amortized cost** — subscription fee ÷ accepted tasks / productive
  sessions / verified hours.

Anthropic says Max/Pro session dollar figures are local estimates, not
billing ([costs](https://code.claude.com/docs/en/costs)); Codex exposes
remaining subscription limits via `/status`
([pricing](https://chatgpt.com/codex/pricing/)).

`ccusage` beats a custom parser as compatibility canary and CLI (supports
Claude + Codex, understands cache-token categories); it does not beat DuckDB
as the analytical source of truth for joins to repo/branch/task/harness
version/verifier outcome ([cost modes](https://ccusage.ryoppippi.com/guide/cost-modes)).

High-value metric: **verified successes per subscription-dollar**, plus quota
pressure, wall time, failure rate; track cache-read ratio separately.
Provider quota weighting vs transcript tokens is not fully transparent
[verify] — retain provider-reported limit percentages alongside token-derived
estimates.

**Steal this:** keep DuckDB; add `actual_cash`, `api_equivalent`,
`amortized_cost`, `quota_pressure` as separate measures; use ccusage only for
reconciliation.

## 5. Keep/adopt/watch verdicts

- **Phoenix — KEEP.**
- **Redacted DuckDB/Parquet pipeline — KEEP** (nothing surveyed offers the
  same private cross-harness joins + config-impact analysis).
- **Claude Code + Codex native OTel — ADOPT** (content capture disabled or
  redacted until proven safe).
- **OTel `gen_ai_normalizer` — PILOT/WATCH** (alpha).
- **Small repo replay suite — ADOPT NOW** (custom + deterministic; Harbor
  later if isolation justifies it).
- **Braintrust — ADOPT THE PATTERNS** (immutable experiments, repeated
  trials, branch-aware baselines, regression gates), not the platform.
- **RepoGauge/Stet — WATCH or trial read-only** [verify maturity/private-repo fit].
- **Langfuse / W&B Weave — WATCH.**
- **OpenLLMetry — SKIP for now.**
- **ccusage — ADOPT as validator.**

## Prioritized actions

1. Low effort / high impact: export native Claude Code + Codex telemetry
   with explicit repo/harness/task/privacy-policy attributes; validate
   coverage against local transcripts.
2. Low effort / high impact: add subscription-aware cost columns; reconcile
   weekly totals against ccusage.
3. Medium effort / highest impact: create five historical executable replay
   tasks; compare current harness against one deliberate variant.
4. Medium effort / medium impact: pilot the alpha GenAI normalizer on a
   duplicated OTLP path retaining original OpenInference attributes.
5. Higher effort / later: expand to 10–20 tasks; adopt Harbor only if
   reproducible isolation or multi-agent matrices become the bottleneck.
