# P1 rollout evidence — 2026-07-14

## What shipped

1. **dankserver repo** commit `3b22cac` (`kriegcloud/dankserver`, pushed to
   main): `ansible/roles/monitoring/templates/otel-config.yaml.j2` gains an
   `otlphttp/phoenix` traces exporter + traces pipeline and
   `resource_to_telemetry_conversion` on the prometheus exporter;
   `compose.yaml.j2` joins the collector to the external
   `beep-ai-metrics-dankserver_default` network. Live host files were
   hand-converged to the identical rendered content (backups:
   `config.yaml.bak-20260714`, `compose.yaml.bak-20260714`) because the
   ansible inventory targets the YubiKey-gated `dankserver-yubi` alias,
   which cannot sign non-interactively. Next ansible run is a no-op
   convergence.
2. **Tailnet route**: `tailscale serve --bg --https=8448 http://127.0.0.1:4318`
   on dankserver (tailnet-only). Verified: empty-POST to
   `https://dankserver.tailc7c348.ts.net:8448/v1/traces` → 200.
3. **Workstation** (backups `settings.json.bak-otel-20260714`,
   `config.toml.bak-otel-20260714`):
   - `~/.claude/settings.json` env: telemetry + enhanced-beta on, metrics +
     traces OTLP → :8448, logs `none`, all four `OTEL_LOG_*` content flags
     pinned `0`. `OTEL_RESOURCE_ATTRIBUTES` deliberately NOT set here — the
     launcher wrapper owns it (avoids precedence conflicts).
   - `~/.codex/config.toml` `[otel]`: metrics + trace otlp-http → :8448,
     `exporter = "none"` (logs deferred), `log_user_prompt = false`, static
     `span_attributes` (host + schema version). Config parse verified.
   - `~/.zshrc` `claude()` wrapper (`beep-otel-attribution` block): stamps
     `OTEL_RESOURCE_ATTRIBUTES` per session from git state
     (`beep.repo/branch/task_class/goal_slug`, schema v1).

## P2 verification (same day)

- Claude Code live probe (`claude -p`, haiku): Phoenix `default` project
  traceCount 1264 → 1300, endTime advanced to probe time; collector logs
  clean.
- Codex live probe (`codex exec`): codex metrics present — **exec-mode
  coverage confirmed** on 0.144.4 (the mode flagged as a gap in older
  versions).
- Collector prometheus exporter serving **1,129** `claude_*`/`codex_*`
  series; dankserver Prometheus scraping it (`up{job="openclaw"} == 1`).
- **Attribution verified on real data**:
  `claude_code_cost_usage_USD_total{beep_branch="goals/harness-otel-adoption-impl",
  beep_goal_slug="harness-otel-adoption", beep_repo="beep-effect",
  beep_task_class="goals", model="claude-haiku-4-5-20251001", ...}`.
- Metric label sample contains no prompt/content fields.

## Open P2 items (goal stays active)

- One-day coverage-verification note: native telemetry vs local transcripts
  (session counts, token totals) across interactive/companion codex modes
  and normal Claude sessions — needs a day of real traffic.
- Trace-payload content spot-check via Phoenix UI (GraphQL span-attribute
  query shape differs on Phoenix 15.5; metric-label check was clean and all
  content flags are off).
- Polish: Phoenix project name for harness traces (currently lands in
  `default`; a project header would separate it).
- Polish: grafana dashboard for the new metrics; prometheus scrape job
  rename from `openclaw` to something harness-neutral (cosmetic).
