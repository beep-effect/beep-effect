# Harness Emitters for All Providers Spec

## Objective

Every agent harness emits beep.* v2 attributed telemetry (native, hook, wrapper, proxy, transcript) with a completeness check.

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

- `packages/tooling/tool/cli` (`otel attrs`, completeness)
- `.cursor/hooks/`, `.claude` hook-pulse
- vendored CLIProxyAPI plugin (proposal/patch in its own repo)
- user-level harness config (operator-owned; proposals)

## Constraints

- One computed `beep.*` v2 value, three transports: `OTEL_RESOURCE_ATTRIBUTES`, `X-Beep-*` headers, hook env.
- Run the five probes first (`explorations/observability-palantiri/research/harness-emitters-and-web-ci.md` §9) and record results before wiring.
- Proxy sessions set `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1`.
- The proxy plugin never exports the usage record's `APIKey`.
- Grok rows carry `beep.harness=grok-build` even when Claude-format hooks fire.
- Live dashboards read native OTel; analytics stay on the transcript pipeline (dual-ingestion precedence).
- Schema → `Context.Service` contract → implementation; Effect v4 only, validated against `~/YeeBois/references/effect/effect`; `effect/<Module>` imports; `HashMap`/`HashSet`; `Effect.fn`/`fnUntraced`.
- Names, metrics, events and attribute keys come from the instrumentation catalog (`goals/observability-kernel-catalog`); names are static literals, never interpolated.
- Public repo: no client data, tokens, `op://` resolutions, LAN IPs, tailnet suffixes or account identifiers in packet or code.
- Totals use `increase()` over the panel range; per-process identity never becomes a metric label; promoted labels come only from the registry's metric-safe set.

## Acceptance Criteria

- [ ] Each harness in the per-harness table emits records carrying `beep.harness`, `beep.provider`, `beep.provider_account`, `beep.emitter`.
- [ ] Codex per-checkout metrics attribution is proven or the gap is re-recorded with probe evidence.
- [ ] A completeness report lists expected vs seen emitters per session.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/harness-emitters-all-providers/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/harness-emitters-all-providers/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/harness-emitters-all-providers` | Passes |

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
