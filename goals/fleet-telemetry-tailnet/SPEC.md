# Fleet Telemetry on the Tailnet Spec

## Objective

Tier-aware ingest gateway, scrape/push topology, enrollment gate (D1 trigger), tag and Funnel proposals, and generated fleet dashboards.

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

- gateway package (placement per `07-non-slice-families.md`; drivers for backend clients)
- `beep` CLI enrollment-gate command
- dankserver repo (proposals: Serve routes under Ansible, collector pipelines, Prometheus OTLP receiver / out-of-order window)
- dashboards-as-code output

## Constraints

- Gateway resolves the peer with `tailscale whois`, overwrites `host.name`, applies the inverted tag model (looser tiers tagged; untagged = shape-only), refuses non-decoding batches with a 4xx and counts them.
- Close the open `:8448` OTLP ingest before any strict-tier export: proposal includes Ansible-managed Serve routes and tag-based grants.
- Propose narrowing the tailnet `funnel` node attribute; "no Funnel grant on a strict-tier host" is an enrollment check.
- Always-on Linux hosts scraped; intermittent hosts push OTLP with `file_storage` queues and a raised retry ceiling; replay horizon capped explicitly.
- The 16-point "fully enrolled" gate (`explorations/observability-palantiri/research/fleet-and-hub.md` §3) is a runnable command; passing on `beep-worker` and the incoming box fires D1.
- Dashboards generated from the catalog: host variable, regex devices, workload-vs-system split, mandatory panel descriptions, restart-survival and no-data tests, staleness alerts, a per-host "busy / safe to restart" signal.
- Schema → `Context.Service` contract → implementation; Effect v4 only, validated against `~/YeeBois/references/effect/effect`; `effect/<Module>` imports; `HashMap`/`HashSet`; `Effect.fn`/`fnUntraced`.
- Names, metrics, events and attribute keys come from the instrumentation catalog (`goals/observability-kernel-catalog`); names are static literals, never interpolated.
- Public repo: no client data, tokens, `op://` resolutions, LAN IPs, tailnet suffixes or account identifiers in packet or code.
- Totals use `increase()` over the panel range; per-process identity never becomes a metric label; promoted labels come only from the registry's metric-safe set.

## Acceptance Criteria

- [ ] The gateway refuses a batch that does not decode under the sender's tier and counts it; a test covers tagged, untagged and unresolvable peers.
- [ ] Proposal PR text for the dankserver repo exists with exact commands (operator applies).
- [ ] `beep` enrollment-gate command reports pass/fail per check for any host.
- [ ] Fleet overview dashboard is generated and passes restart-survival and staleness tests.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/fleet-telemetry-tailnet/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/fleet-telemetry-tailnet/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/fleet-telemetry-tailnet` | Passes |

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
