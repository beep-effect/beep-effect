# Palantiri Parcels Spec

## Objective

Agent-facing Palantiri: schema-typed, freshness-checked parcels served through beep palantiri and palantiri-mcp, starting with account headroom.

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

- `packages/tooling/library/palantiri/**` (NET-NEW)
- `packages/tooling/tool/palantiri-mcp/**` (NET-NEW, `@beep/mcp-kit` host pattern)
- `packages/tooling/tool/cli/src/commands/Palantiri/**` (NET-NEW group) and `Accounts/` (quota gauge)
- `SessionLedger` / `beep session open` push

## Constraints

- Every parcel is an `S.Class` from a ParcelSpec: typed key (session | lane | host | pr | app | account), freshness bound, sources, pure reducer; `Freshness = Fresh | Unknown{reason}` checked at read time.
- One HttpApi contract serves both the CLI and the MCP server; CLI-first, honouring `TRACEPARENT`.
- Responses are budget-capped with "N of M" receipts and summary-first shape (Axiom pattern, `explorations/observability-palantiri/research/handoff/agent_facing_tooling.md`).
- The MCP server and CLI carry their own exporter config (Claude Code strips `OTEL_*` from MCP children).
- Completeness check downgrades to `Unknown{attribution-incomplete}` when expected emitters are silent; vendor cloud VMs report `Unknown{unreachable}`.
- Account identity is an ordinal or salted hash, never an email.
- Schema → `Context.Service` contract → implementation; Effect v4 only, validated against `~/YeeBois/references/effect/effect`; `effect/<Module>` imports; `HashMap`/`HashSet`; `Effect.fn`/`fnUntraced`.
- Names, metrics, events and attribute keys come from the instrumentation catalog (`goals/observability-kernel-catalog`); names are static literals, never interpolated.
- Public repo: no client data, tokens, `op://` resolutions, LAN IPs, tailnet suffixes or account identifiers in packet or code.
- Totals use `increase()` over the panel range; per-process identity never becomes a metric label; promoted labels come only from the registry's metric-safe set.

## Acceptance Criteria

- [ ] First vertical slice (`explorations/observability-palantiri/MAP.md`): `beep palantiri parcel account-headroom --json` decodes to `Fresh`/`Unknown{stale}`, and the run exports a `beep.accounts.window_remaining` gauge and a `Parcels.read` span carrying `beep.*` v2 attributes, nested under the caller's trace.
- [ ] Five parcels ship: account headroom, lane reds, host pressure, app error classes, since-last-check.
- [ ] `palantiri-mcp` exposes the same parcels with identical encoded JSON; stdio host pins `Logger.LogToStderr`.
- [ ] `beep session open` prints the hot parcels.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/palantiri-parcels/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/palantiri-parcels/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/palantiri-parcels` | Passes |

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
