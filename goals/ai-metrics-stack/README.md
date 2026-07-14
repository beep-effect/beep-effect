# AI Metrics Stack

## Status

Lifecycle: `completed-retained`

## Overview

This initiative owns the end-to-end developer AI metrics stack for this repo.
It turns Codex, Claude Code, OpenClaw, xAI, Venice.ai, and optional LiteLLM
gateway activity into privacy-safe raw archives, derived rollups, OTLP traces,
and weekly scorecards that answer whether agent-facing config changes improved
coding-agent performance.

The descoped V1 is complete: the dankserver tailnet stack was deployed, local
collection and P6a hardening were proven, and the June full-window scorecard is
accepted as credited P6 evidence. Mirror sync, provider metrics, and dashboard
expansion are explicit deferrals.

## Read This First

- [SPEC.md](./SPEC.md) - authoritative contract
- [PLAN.md](./PLAN.md) - phased execution plan and progress
- [ops/manifest.json](./ops/manifest.json) - machine-readable phase and gate
  tracking
- [history/outputs/p0-current-state.md](./history/outputs/p0-current-state.md)
  - current implemented scaffold and open gaps
- [history/outputs/p1-source-discovery-and-privacy.md](./history/outputs/p1-source-discovery-and-privacy.md)
  - source discovery, config snapshot, and privacy proof evidence
- [history/outputs/p2-durable-ingest-and-derived-storage.md](./history/outputs/p2-durable-ingest-and-derived-storage.md)
  - encrypted raw archive, DuckDB derived storage, Parquet export, and EventLog
    proof evidence
- [history/outputs/p3-otlp-and-backend-stack.md](./history/outputs/p3-otlp-and-backend-stack.md)
  - OTLP contracts, Phoenix local compose smoke target, redacted span export,
    and import-safe infra outputs
- [history/outputs/p4-scorecards-labels-and-benchmarks.md](./history/outputs/p4-scorecards-labels-and-benchmarks.md)
  - task projection, structured labels, benchmark records, weekly reports, and
    coverage-aware scoring evidence
- [history/outputs/p5a-operator-contract-and-dry-run-apply.md](./history/outputs/p5a-operator-contract-and-dry-run-apply.md)
  - typed install plan, doctor, dry-run apply, and non-mutating operator
    workflow evidence
- [history/outputs/p5b-real-pulumi-remote-apply.md](./history/outputs/p5b-real-pulumi-remote-apply.md)
  - Pulumi remote Phoenix apply resources, dedicated tailnet HTTPS route, and
    live deployment evidence
- [history/outputs/p6a-fresh-review-hardening.md](./history/outputs/p6a-fresh-review-hardening.md)
  - fresh review findings, P6a hardening decisions, implementation evidence,
    and proof restart gates
- [history/outputs/p6a-closeout-proof-restart.md](./history/outputs/p6a-closeout-proof-restart.md)
  - P6a closeout evidence, timer/Pulumi proof, and restarted seven-day window
- [history/outputs/p6-proof-runner-isolation-and-runbook.md](./history/outputs/p6-proof-runner-isolation-and-runbook.md)
  - isolated proof runner evidence, daily P6 health checklist, and final
    closeout template
- [history/outputs/p7-topology-first-production-plan.md](./history/outputs/p7-topology-first-production-plan.md)
  - P7 topology-first implementation plus deferred mirror/provider/dashboard work
- [research/agent-metrics-capture-2026-06-15.md](./research/agent-metrics-capture-2026-06-15.md)
  - accepted June full-window scorecard and credited P6 proof
- [research/effect-native-observability.md](./research/effect-native-observability.md)
  - Effect v4 observability package findings
- [research/backend-shortlist.md](./research/backend-shortlist.md) - backend
  shortlist and default posture

## Current Progress

P0–P6 are complete, with
[`research/agent-metrics-capture-2026-06-15.md`](./research/agent-metrics-capture-2026-06-15.md)
accepted as the credited full-window P6 proof. P7a/b implementation is retained;
mirror sync, P7c provider metrics, and P7d dashboards are descoped:

- `@beep/repo-ai-metrics` exists with schema-first models, tolerant transcript
  ingest summaries, target-agnostic install specs, benchmark and scorecard
  models.
- `beep-cli ai-metrics` exists with install preview, ingest, source discovery,
  config snapshot, privacy check, durable forwarder, OTLP export, labels,
  benchmark records, and weekly report generation.
- `@beep/infra` exposes an import-safe `AIMetricsStack` Pulumi component and
  Pulumi entrypoint.
- Source discovery covers Codex, Claude Code, and OpenClaw safe gateway
  metadata without emitting private local paths or service secrets.
- Config snapshots hash repo-owned `.codex`, `.claude`, `.ai`, `.aiassistant`,
  `AGENTS.md`, and `CLAUDE.md` inputs while excluding vendored/generated roots.
- Privacy checks emit sanitized transcript summaries and hash-only event
  envelopes, with synthetic and real local smoke evidence.
- The durable forwarder writes AES-256-GCM encrypted raw archive objects,
  derived DuckDB tables, and per-run Parquet exports.
- P6a adds source-aware forwarder budgets, hash-only Codex subagent parentage,
  config snapshot diff artifacts, scorecard completion readiness, an OTLP
  metadata allowlist, a workstation timer render path, and an archive decrypt
  drill.
- P3 adds install-owned OTLP/Phoenix contracts, generated local Phoenix compose
  smoke, trace-only `@beep/observability` wiring, redacted DuckDB-to-OTLP span
  export, CLI `otlp export`, and import-safe Pulumi backend outputs.
- P4 adds deploy-safe agent task projection rows, structured outcome labels,
  recorded benchmark cases/runs, coverage-aware scorecards, and Markdown/JSON
  weekly report artifacts.
- P5a adds typed install plans, install doctor checks, and dry-run-only apply
  output for local and dankserver targets without resolving secrets, probing
  SSH, or mutating local/remote state.
- P5b adds `@beep/infra` Pulumi remote command resources for dankserver
  preflight, Phoenix compose/systemd apply, dedicated
  `https://dankserver.tailc7c348.ts.net:8447` Tailscale Serve routing, and
  health checks.
- Pulumi state reconciliation has passed for `beep-ai-metrics-dankserver`;
  stack state now has 6 resources and live Phoenix reports version `15.5.0`.
- The AI metrics 1Password refs resolve at
  `op://TBK/ai-metrics/hash-salt` and
  `op://TBK/ai-metrics/raw-archive-key`.
- The first live P6 proof collected 10 Codex source files, projected 23,830
  turns, exported 23,840 redacted OTLP spans to Phoenix, generated a baseline
  weekly report, and confirmed Phoenix GraphQL has traces.
- P6a closeout installed the workstation systemd user timer, ran one owned
  bounded forwarder pass, reran the archive drill, reconciled Pulumi, verified
  Phoenix `15.5.0`, added one outcome label plus one benchmark run, and
  generated a restarted scorecard with `completionReady=true`.
- P6 isolation now runs the workstation timer from locked detached worktree
  `/home/elpresidank/YeeBois/projects/beep-effect-worktrees/ai-metrics-p6-proof`
  pinned at `63c419721c735bfb860ccfa9bf1b31efbb23e33c`, while preserving the
  original proof data root under the main checkout.
- P7a/b adds the hybrid derived mirror and local-first retention workflows.
  Raw encrypted transcripts remain workstation-local; mirror bundles contain
  only sanitized manifests, status artifacts, reports, and allowed derived
  Parquet exports. Retention delete and compact workflows remain dry-run until
  an explicit window plus `--confirm p7-retention-window` are supplied.
- Source discovery remains Codex-only in the recent proof window; `--all`
  discovery confirms Claude Code and OpenClaw sources exist outside the active
  proof window and are deferred to P7c provider/gateway work.
- The June full-window report covers the local ingest history, credits the
  dominant configuration with 662 tasks and `completionReady=true`, and
  replaces the earlier interim proof gate.
- A read-only `dankserver` probe on 2026-07-14 was unreachable from this session:
  the network sandbox denied the SSH socket. No mirror sync was attempted; the
  existing mirror build/sync/status commands remain a won't-do-this-PR runbook
  step for a separately authorized reachable session.
- P7c provider/gateway metrics and P7d dashboard/backend expansion are won't-do
  deferrals requiring new product scope.

## Accepted Completion Basis

This descoped initiative is complete on this retained basis:

- dankserver tailnet deployment is applied and verified
- Phoenix is receiving real traces or derived exports
- raw encrypted archive and redacted derived views are populated
- P6a hardening gates have passed, including subagent attribution, source-aware
  coverage, config diffs, metadata allowlist, timer ownership, and archive
  decrypt drill
- Codex source discovery and ingest are proven, Claude Code/OpenClaw adapter
  visibility is explicit, and optional gateway/provider metrics either contain
  measured rows or are explicitly unavailable and not scored
- config snapshots are linked to real sessions and benchmark runs
- CLI label review produces outcome labels for real work
- the June full-window config-impact scorecard is retained as credited proof and
  includes completion-ready label plus benchmark evidence
- sanitized mirror sync remains an explicit won't-do-this-PR runbook step
- provider/tool/cost fields either contain real measured rows or are explicitly
  reported as unavailable and not scored
