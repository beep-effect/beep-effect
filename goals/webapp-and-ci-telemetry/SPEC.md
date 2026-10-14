# Web App and CI Telemetry Spec

## Objective

@vercel/otel + Effect bridge for oip-web and todox (no drains), Turborepo/CI spans from run summaries, dev-loop LGTM sink, WebStorm note.

## Non-Goals

- Any spend: SaaS backends, Vercel drains, Grafana Cloud above free, Tailscale paid tiers (exploration D9).
- Choosing the logs/traces store; that waits for the hub gate (D1).
- Mutating dankserver, the tailnet policy, `tom-pc-1` or any host directly; ship exact commands as proposals the operator applies.
- `tbk-ubuntu` and its security-sensitive VM (gated host; never instrumented).
- Developer-AI analytics (`@beep/repo-ai-metrics`), cache policy (`goals/turborepo-cache-trust-observability`) and CI step forensics (`goals/ci-step-watchdog`) — consume, never absorb.
- Dashboards hand-built in the Grafana UI or copied from the existing generated ones.

## Source Hierarchy

1. The graduating exploration: [`explorations/observability-palantiri`](../../explorations/observability-palantiri/) — `BRIEF.md`, `MAP.md`, `DECISIONS.md` (back-links, not copies).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `apps/oip-web`, `apps/todox`
- `@beep/observability/web` (consolidate with `packages/agents/client/src/ClientObservability.ts`)
- `packages/tooling/tool/cli` (CI/Turbo spans)
- `docker-compose.yml` + `docker/grafana/*`

## Constraints

- `@vercel/otel` owns the global provider; Effect joins via `OtelTracer.layerGlobal`; no second provider; avoid the `grpc` protocol fallback.
- In-function export only (operator ruling, no spend).
- oip.law: aggregate, cookieless signals only.
- CI resource fields from semconv (`cicd.pipeline.run.id`, `vcs.ref.head.revision`); strip `user` from Turbo summaries; Turbo OTel config key is `global.experimentalObservability`.
- Consume `goals/turborepo-cache-trust-observability` outputs; never redefine cache outcomes.
- Schema → `Context.Service` contract → implementation; Effect v4 only, validated against `~/YeeBois/references/effect/effect`; `effect/<Module>` imports; `HashMap`/`HashSet`; `Effect.fn`/`fnUntraced`.
- Names, metrics, events and attribute keys come from the instrumentation catalog (`goals/observability-kernel-catalog`); names are static literals, never interpolated.
- Public repo: no client data, tokens, `op://` resolutions, LAN IPs, tailnet suffixes or account identifiers in packet or code.
- Totals use `increase()` over the panel range; per-process identity never becomes a metric label; promoted labels come only from the registry's metric-safe set.

## Acceptance Criteria

- [ ] A server action in each app produces an Effect span under the `@vercel/otel` request span (verified locally).
- [ ] A CI run's Turbo summary converts to a span tree with `cicd.*` resource fields.
- [ ] `docker compose up` gives a local sink with Tempo MCP; documented.
- [ ] WebStorm note exists.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/webapp-and-ci-telemetry/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/webapp-and-ci-telemetry/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/webapp-and-ci-telemetry` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-14 | Inherit exploration decisions D1–D9 and the align/agent-decided entries in `explorations/observability-palantiri/DECISIONS.md`. | Graduated from `explorations/observability-palantiri`. | Reopen the exploration at `decompose`. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
