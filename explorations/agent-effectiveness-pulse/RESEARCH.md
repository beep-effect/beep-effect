# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-07-13 — Pre-exploration recon + five codex lanes

A live recon (main session) plus five read-only codex lanes (GPT-5.6 Sol,
medium) ran before the packet was scaffolded. Full briefs live in
`research/`; this section is the index.

### Live recon findings (verified)

- **Phoenix is healthy; the feed is dead.** `beep-ai-metrics-phoenix`
  (arizephoenix/phoenix:15.5.0) up on dankserver; `healthz` 200; GraphQL
  answering; websocket upgrade 101 through Tailscale Serve over HTTP/1.1.
  The "Server disconnected" banner is a transient client-side drop. Phoenix
  holds 1,261 traces in `default` spanning 2026-05-07 → 2026-07-01 — nothing
  since. Raw codex capture stopped 2026-06-08; DuckDB last written
  2026-06-15.
- Weekly scorecards flag `cost_metrics_unavailable`,
  `model_call_metrics_unavailable`, `tool_invocation_metrics_unavailable` as
  standing coverage gaps — exactly the four pulse questions.
- Local `deploy-otel-collector-1` (otel/opentelemetry-collector-contrib) is
  already running on this workstation — relevant to the native-OTel adoption
  candidate.

### The five lane briefs

1. [`research/2026-07-13-prior-art-distillation.md`](./research/2026-07-13-prior-art-distillation.md)
   — decisions/deferrals/traps/seams across the six related packets. Key:
   enrichment + workflow goals are manifest-`superseded` (prose is stale);
   P7c/d/e stay delegated to `ai-metrics-stack`; skill invocation is not a
   scorecard dimension anywhere — new ground; never disturb a credited proof
   window; DuckDB access must be serial.
2. [`research/2026-07-13-data-feasibility.md`](./research/2026-07-13-data-feasibility.md)
   — tested extractors per mining lane. Key: **transcripts are primary,
   DuckDB secondary** (5.43M turn rows ≈ 516K distinct events — heavy
   re-ingestion duplication; `model_calls`/`tool_invocations` empty;
   `cost_score` all 0.5 placeholder). Claude transcripts carry per-message
   usage + Skill tool_use records; codex rollouts carry `token_count`,
   `session_meta.cwd`, `function_call` mining. Yeet verdicts have failure
   lanes but **no durations**. Only the main checkout has ai-metrics; all 7
   siblings have yeet runs.
3. [`research/2026-07-13-claude-discovery-rootcause.md`](./research/2026-07-13-claude-discovery-rootcause.md)
   — the forwarder's claude `candidateFileCount=0` is a **stale artifact,
   not a bug** (Jun 8 run predates the Claude project dir, born Jun 11).
   Live discovery: 1,155 claude candidates. Revival needs no code fix.
4. [`research/2026-07-13-agents-md-preaudit.md`](./research/2026-07-13-agents-md-preaudit.md)
   — 47 authored reflections / 218 findings; AGENTS.md carries volatile
   state against its own context-economy rule; 16/30 skills unreferenced;
   three repeatedly-requested missing laws; **nine testable hypotheses**
   (H1–H9) mapped to telemetry sources.
5. [`research/2026-07-13-external-landscape.md`](./research/2026-07-13-external-landscape.md)
   — keep Phoenix + DuckDB; adopt native Claude Code/Codex OTel, a five-task
   replay eval suite, ccusage as validator; pilot `gen_ai_normalizer`;
   AGENTS.md is now LF-stewarded; treat harness changes as experimentable
   config versions.

## In-Repo Capability Inventory

- `@beep/repo-ai-metrics` (`packages/tooling/library/ai-metrics/src/`) —
  ingest, source-discovery, forwarder, derived-storage (DuckDB/Parquet),
  privacy/redaction, encrypted archive, OTLP projection, scorecards,
  mirror, retention. REUSE as-is for revival + mining.
- `bun run beep ai-metrics …` CLI
  (`packages/tooling/tool/cli/src/commands/AIMetrics/`) — sources discover,
  forwarder run/timer, otlp export, report weekly, label, benchmark, mirror,
  retention. REUSE.
- `infra/src/AIMetrics.ts` + `Pulumi.beep-ai-metrics-dankserver.yaml` —
  Pulumi deploy of Phoenix to dankserver (systemd/compose + Tailscale Serve
  :8447→6006). REUSE; already deployed and healthy.
- `.beep/yeet/runs` verdict/state/status JSON (main + 7 siblings) — REUSE as
  bottleneck evidence; EXTEND later if step durations are wanted (currently
  absent — NET-NEW field would belong to a yeet goal, not this packet).
- `goals/*/history/reflections/*.md` corpus + `bun run beep lint
  reflection-artifacts` — REUSE as friction taxonomy.
- Skill inventory: `.claude/skills/` (30) + plugin skills. REUSE as the
  denominator for usage analysis.
- NOT FOUND: any skill-invocation metric anywhere in the metrics stack; any
  token-cost (USD) field; any step-duration field in yeet telemetry; any
  replay/eval harness for repo tasks (benchmark tables exist with 2 cases —
  skeletal, not a suite).

## Constraints Discovered

- Privacy contract (SPEC-fixed): raw transcript text never leaves the
  workstation; derived/committed artifacts must be redacted/hashed/
  allowlisted. Pulse mining whitelists structural fields only; the repo is
  public.
- Credited proof windows must not be disturbed: runner, source window,
  privacy contract, timer cadence, or data-root changes restart the 7-day
  clock (matters when touching timer defaults during revival).
- DuckDB metrics commands: one local database, serial access only.
- Exploration-stage no-mutation boundary (agent-effectiveness-loop Phase 1):
  the pulse observes and reports; it does not redesign telemetry topology,
  Phoenix payloads, CI enforcement, or Yeet behavior.
- OTel GenAI semconv is development-stage — pin versions, translate into a
  beep-owned schema rather than adopting upstream names as warehouse truth.
