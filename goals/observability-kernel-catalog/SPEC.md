# Observability Kernel and Instrumentation Catalog Spec

## Objective

Fix @beep/observability defects, split kernel from server wiring, and ship the instrumentation catalog (names, metrics, events, beep.* v2 registry, EmitterContext, TelemetryTier).

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

- `packages/foundation/capability/observability` (kernel/`server` split)
- catalog + attribute registry home (kernel subpath; decide placement per `07-non-slice-families.md`)
- `standards/architecture/12-observability.md` (regenerated from the catalog)
- `apps/professional-desktop` sidecar wiring and the 63 existing `Metric.*` sites
- root `package.json`/catalog for the `effect` bump

## Constraints

- Fix all five defects from `explorations/observability-palantiri/research/in-repo-inventory.md` §1 and `RESEARCH.md`: DevTools/OTLP sibling merge, DevTools start-only spans, `Logger.layer` dropping `tracerLogger`, `layerConsoleLogger` dual-signature type, exporter pinning its own serializer.
- The catalog is a schema: every span/metric/event/attribute declared once with kind, owning package, allowed attributes, unit, lowest tier; doctrine page, lint and allowlists are generated from it.
- Six naming axes and the families-and-hosts amendment in `explorations/observability-palantiri/DECISIONS.md` are normative: context-free `Concept.action`, globally unique; semconv for protocol spans; `beep.<area>.<noun>` metrics with units and exporter-added suffixes; closed event names; Weaver-style attribute registry; static names.
- `beep.*` v2 lives in the registry with metric-safe vs span-only sets; `beep.model_role` and `beep.privacy_tier` (no bare `beep.tier`).
- `EmitterContext` tagged union (`Workstation | Server | StrictDesktop | CiRunner | CloudVm | Serverless | Browser`) with per-variant semconv fields, tier ceiling and `beep.identity_source`.
- `TelemetryTier` LiteralKit `shape-only | standard | dev-verbose`; untagged or unresolvable resolves to `shape-only`.
- Effect bump to ≥ 4.0.3 via the repo's update policy (pkg.pr.new snapshot, never the rc).
- Schema → `Context.Service` contract → implementation; Effect v4 only, validated against `~/YeeBois/references/effect/effect`; `effect/<Module>` imports; `HashMap`/`HashSet`; `Effect.fn`/`fnUntraced`.
- Names, metrics, events and attribute keys come from the instrumentation catalog (`goals/observability-kernel-catalog`); names are static literals, never interpolated.
- Public repo: no client data, tokens, `op://` resolutions, LAN IPs, tailnet suffixes or account identifiers in packet or code.
- Totals use `increase()` over the panel range; per-process identity never becomes a metric label; promoted labels come only from the registry's metric-safe set.

## Acceptance Criteria

- [ ] The five defects are fixed with regression tests (OTLP traces reach a capture sink with DevTools on; DevTools spans end; `tracerLogger` retained where intended; `layerConsoleLogger` returns a Layer).
- [ ] Kernel and `/server` wiring are separate entry points; existing consumers compile unchanged or are migrated in the same PR.
- [ ] The catalog schema, attribute registry (`beep.*` v2) , `EmitterContext` and `TelemetryTier` exist with decode tests; a lint fails on duplicate or interpolated span names (the 4 collisions and 19 interpolated sites are fixed).
- [ ] `beep.package`/`beep.family` enrichment derives from the catalog's name→package map.
- [ ] `12-observability.md` is regenerated from the catalog.
- [ ] The outcome-in-name counters (e.g. `desktop_*_{started,completed,failed,interrupted}_total`) become single instruments with an `outcome` attribute.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/observability-kernel-catalog/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/observability-kernel-catalog/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/observability-kernel-catalog` | Passes |

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
| 2026-10-14 | P0: the catalog mechanism (instrument declaration schema, `AttributeKey` with type, allowed signals, cardinality class and lowest tier; `TelemetryTier`; `EmitterContext`; generic keys `beep.package`, `beep.family`, `beep.privacy_tier`, `beep.identity_source`) lives in the `@beep/observability` kernel as a new subpath. The agent-attribution key set (`beep.harness`, `beep.provider`, `beep.provider_account`, `beep.route`, `beep.model_role`, `beep.emitter`, `beep.lane`, `beep.session`) is a registry instance owned by `@beep/repo-ai-metrics`, the home `goals/harness-otel-adoption` planned for the contract. | `07-non-slice-families.md` routes runtime substrate to capability; `goals/ai-metrics-stack` forbids developer-AI semantics in `@beep/observability`. One mechanism, two owners of key sets. | Move the agent key set into the kernel and drop the ai-metrics instance. |
| 2026-10-14 | P0: the effect bump targets the published stable `4.0.4` (npm lists 4.0.3 and 4.0.4; the repo pins stable `4.0.2` since the 4.0 release, not a pkg.pr.new snapshot) in P3, all `effect`/`@effect/*` catalog entries together; coordinate with the orchestrator first in case a deps lane is already moving them. | 4.0.3 histogram fixes matter once histograms land; #9066 only affects HTTP server spans. | Revert the catalog bump. |
| 2026-10-14 | P0: ship as three PRs. PR 1 = P1 defects + the `OtlpSerialization` seam. PR 2 = P2 catalog, registry, lint, metric/name migrations. PR 3 = the effect bump alone (orchestrator conditions, 2026-10-14): catalog-only, never folded into a feature PR; stable releases only (no rc; pkg.pr.new snapshot only if a needed fix is unreleased); merge `main` immediately before its single push; report `final <sha40> #<pr>` with the bump in the PR title so the rsc B and tsgo-brand lanes merge `main` once after it lands. No other lane owns an Effect bump (last was #1482 to 4.0.1). | The defect fixes are independently valuable and unblock the strict-tier seam; the catalog is a larger review; a dependency bump moves every manifest and must not ride a feature PR. | Fold PRs together. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
