# GOAL: adopt native harness OTel into the dankserver collector hub

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Claude Code and Codex export native OTLP telemetry to dankserver's
`monitoring_otel_collector` over the tailnet; the collector fans traces out to
Phoenix and metrics to Prometheus/Grafana; every span/metric carries the
beep-owned attribution attributes; content capture stays off.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/harness-otel-adoption/README.md`
- `goals/harness-otel-adoption/SPEC.md`
- `goals/harness-otel-adoption/PLAN.md`
- `goals/harness-otel-adoption/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: harness OTel exporter configuration (user-level Claude Code settings,
  `~/.codex/config.toml` telemetry block); dankserver
  `monitoring_otel_collector` pipeline config + one new tailscale-serve route
  (operator-run, documented in packet evidence); the beep-owned attribute
  schema module in `packages/tooling/library/ai-metrics` (per ai-metrics-stack
  manifest `owningSurfaces.developerAiAnalytics`); packet docs/evidence;
  Grafana dashboard provisioning for the new metrics (optional slice).
- Out: transcript-ingestion pipeline changes; Phoenix deployment changes; any
  new observability backend; log shipping (no Loki); content/prompt capture;
  law or skill edits.

Model economy (operator requirement): the operator's weekly Fable 5 limit is
scarce. Fable/Opus sessions plan, design, and review ONLY. Route all
token-heavy lanes (research sweeps, doc verification, config drafting, bulk
analysis, implementation passes) to codex via the codex plugin with
`--model gpt-5.6-sol --effort medium`, one artifact per agent.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md` — slice 1 is Claude Code
   → collector with `repo` + `goal-slug` attributes visible in Phoenix within
   one working session.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At P3 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md` P3 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/harness-otel-adoption/GOAL.md)" -le 4000
jq . goals/harness-otel-adoption/ops/manifest.json
git diff --check -- goals/harness-otel-adoption
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it. Dankserver changes
(collector config, tailscale serve) are operator actions: propose exact
commands, get confirmation, record evidence.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
