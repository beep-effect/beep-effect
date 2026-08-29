# Harness OTel Adoption Spec

## Objective

Both coding harnesses (Claude Code, Codex CLI) emit native OTLP telemetry to
dankserver's `monitoring_otel_collector` over the tailnet; the collector
routes traces to Phoenix (same host) and metrics to
`monitoring_prometheus`/`monitoring_grafana`; all emitted telemetry carries a
beep-owned, version-pinned attribute schema including attribution
(`repo`, `branch`, `goal-slug`, `task-class`); prompt/response content capture
is off everywhere.

## Non-Goals

- No new observability backend (Phoenix stays; Langfuse/Weave remain WATCH).
- No transcript/prompt content in OTLP exports (privacy contract,
  `goals/ai-metrics-stack/SPEC.md` privacy section).
- No log shipping (no Loki); logs signal is deferred.
- No changes to the transcript-ingestion pipeline, Phoenix deployment, CI
  enforcement, or yeet behavior.
- No branch-discipline law — attribution is solved here, in telemetry.
- No replacement of the weekly scorecard model; dual-ingestion precedence is
  decided, not redesigned.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- User-level Claude Code OTel settings and `~/.codex/config.toml` telemetry
  block (operator-owned; documented + evidenced in this packet, not committed).
- Dankserver `monitoring_otel_collector` pipeline config and one new
  tailscale-serve route (operator actions with recorded evidence, same pattern
  as the Phoenix 8447→6006 route).
- Beep-owned attribute schema: `packages/tooling/library/ai-metrics`
  (`owningSurfaces.developerAiAnalytics` per
  `goals/ai-metrics-stack/ops/manifest.json`).
- Optional: Grafana dashboard provisioning for harness metrics.
- This packet's docs and evidence.

## Constraints

- Content capture OFF in both harnesses' exporter config; verify emitted
  payloads contain no prompt/response text before trusting them.
- OTel GenAI semconv is development-stage: pin the emitted convention
  versions; translate upstream names into the beep-owned schema before
  anything downstream (dashboards, scorecards) depends on them.
- Codex OTel coverage has had command-specific gaps — verify each execution
  mode actually used in this repo (interactive, exec, resume, companion
  background tasks) before claiming coverage.
- Dual ingestion: decide the precedence rule (native OTel vs transcript
  pipeline) for any metric that both paths can produce, EARLY (P0), and
  record it in this packet + the ai-metrics-stack decision log.
- Collector exposure is tailnet-only (no funnel); secrets/env handling for
  the existing systemd forwarder timer must not regress.
- Model economy: Fable 5/Opus plan, design, and review only; all token-heavy
  execution lanes run on codex `gpt-5.6-sol` at `--effort medium` (operator's
  weekly Fable 5 limit is the scarce resource — pulse DECISIONS 2026-07-14
  "subagent-economy").
- Exploration provenance:
  `explorations/agent-effectiveness-pulse` (BRIEF/MAP/DECISIONS 2026-07-14).

## Acceptance Criteria

- [ ] Slice 1: a real Claude Code session on this workstation produces traces
      visible in Phoenix carrying `repo` and `goal-slug` attributes, routed
      through the dankserver collector (not direct-to-Phoenix).
- [ ] Codex sessions produce metrics visible in Grafana/Prometheus
      (service-level identity; per-repo/goal attribution on codex METRICS is
      an accepted v1 gap — codex `span_attributes` is traces-only and static;
      see `research/p0-attribute-contract.md` "Known gap"), for every
      execution mode in use.
- [ ] A written coverage-verification note compares one day of native
      telemetry against local transcripts (session counts, token totals
      within tolerance) and records gaps.
- [ ] Attribute schema v1 documented with pinned emitter versions and the
      dual-ingestion precedence rule (`research/p0-attribute-contract.md`;
      amended 2026-07-14: the typed schema in
      `packages/tooling/library/ai-metrics` is deliberately deferred until
      the first in-code consumer — contract-by-documentation is the v1
      deliverable).
- [ ] Payload privacy check evidenced: emitted spans/metrics contain no
      prompt/response content.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/harness-otel-adoption/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/harness-otel-adoption/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/harness-otel-adoption` | Passes |
| Phoenix traces | GraphQL project query shows harness traces with attribution attributes | Present |
| Grafana metrics | Prometheus query returns harness token/session metrics with attribution labels | Present |
| Privacy | Sampled exported payloads (collector debug exporter or Phoenix span view) | No content fields |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or
  policy approval not named in this spec.
- Dankserver operator actions are needed but unconfirmed — propose exact
  commands and wait.
