# Map

Stage 4, 2026-10-14. Decomposes [`BRIEF.md`](./BRIEF.md) into six goal
packets (D8). Capability citations come from
[`research/in-repo-inventory.md`](./research/in-repo-inventory.md) (capability
map) and the other research notes. Everything not marked NET-NEW extends an
existing brick.

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `observability-kernel-catalog` | Fix the five `@beep/observability` defects, split kernel from `/server`, and ship the instrumentation catalog: names, metrics, events, the attribute registry with `beep.*` v2, `EmitterContext`, `TelemetryTier`. Regenerate `12-observability.md` from it. | none | `@beep/observability` (`packages/foundation/capability/observability`, extend); ai-metrics `AiMetricsOtlpAttributeKey` allowlist pattern (`packages/tooling/library/ai-metrics/src/otlp.ts:56`, reuse pattern); mcp-kit `FieldTier` + ai-metrics `EvidenceTier` vocab (compose); `effect/observability` `Otlp.layerFromConfig` (core); catalog, registry, `EmitterContext` **NET-NEW** |
| `palantiri-parcels` | The agent-facing Palantiri: a `Parcels` service with typed, freshness-checked answers, served by one HttpApi through `beep palantiri` and `palantiri-mcp`. First parcels: account headroom (quota gauge, D5), lane reds, host pressure, app error classes, "since my last check"; pushed at `beep session open`. | `observability-kernel-catalog` (exporter + attribute registry); account-headroom slice only needs `AccountsUsage` | `AccountsUsage` service + `UsageWindow` schema (`packages/tooling/tool/cli/src/commands/Accounts/`, reuse); `@beep/mcp-kit` + `packages/drivers/*-mcp` host pattern (reuse); `beep` command groups + `JsonStringCodec` (reuse); `SessionLedger` (`beep session open`, extend); Parcels service, `tooling/library/palantiri`, `tooling/tool/palantiri-mcp`, quota emitter **NET-NEW** |
| `practice-kg-mcp-strict-tier` | Instrument `practice-kg-mcp` on `tom-pc-1` under the shape-only tier: a custom `OtlpSerialization` gate rebuilding scrubbed spans and metrics, an HMAC salt that stays on the PC, a shape-only stderr logger, an encrypted spool, fail-closed tier resolution, and canary/golden/mutation proof. | `observability-kernel-catalog` (`TelemetryTier`, registry, gate seam) | `apps/practice-kg-mcp` (extend; `.mcpb` packaging + compiled smoke harness reuse); `@beep/mcp-kit` `SanitizedSpan`/`sanitizedToolkit` (reuse); `effect/observability` `OtlpSerialization` seam (core); `@effect/vitest` test patterns (reuse); gate, spool, DPAPI wrap **NET-NEW** |
| `fleet-telemetry-tailnet` | Bring the tailnet fleet under the one pipeline: a tier-aware ingest gateway (`whois`) replacing the open `:8448`, scrape-vs-push topology with `file_storage` queues, `host.name` from MagicDNS, tag/grant and Funnel-narrowing proposals, the 16-point "fully enrolled" gate (D1 trigger), and generated fleet dashboards with staleness alerts and a "busy / safe to restart" signal. | `observability-kernel-catalog` (registry, `EmitterContext`, `TelemetryTier` shared with the gateway) | dankserver collector/Prometheus/Grafana/Phoenix + restic (Ansible, dankserver repo, extend via proposals); `effect/http-api` for the gateway (core); grafana.com 24638 as hostmetrics reference (`research/fleet-and-hub.md` §7); gateway + enrollment check **NET-NEW** |
| `harness-emitters-all-providers` | Every harness emits attributed telemetry. A `beep otel attrs` command replaces the zsh wrapper. Native exporters for Claude Code (with `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1` for proxy sessions), Codex and Muse; hooks + wrapper spans for Cursor; transcript ingest for Grok; a CLIProxyAPI per-request span plugin. A completeness check reports silent emitters. | `observability-kernel-catalog` (`beep.*` v2 in the registry) | `goals/harness-otel-adoption` v1 contract + dankserver collector (inherit, do not rewrite); `.cursor/hooks/hook-pulse.sh` + `.claude` hook-pulse (extend); vendored CLIProxyAPI `usage.Plugin` (MIT, extend); `@beep/repo-ai-metrics` transcript ingest (reuse, do not absorb); `beep otel attrs`, completeness check **NET-NEW** |
| `webapp-and-ci-telemetry` | `@vercel/otel` owns the provider in oip-web and todox, with Effect joined via `OtelTracer.layerGlobal` and in-function export only (no drains, D9). oip.law is aggregate-only. CI and Turborepo spans come from the run-summary JSON with `cicd.*` resource fields; `docker-otel-lgtm` + Tempo MCP is the dev-loop sink; WebStorm gets a research note. | `observability-kernel-catalog` (`EmitterContext` `Serverless`/`Browser`/`CiRunner`) | `@effect/opentelemetry` `OtelTracer.layerGlobal` (verified); `@beep/observability/web` (0 consumers, extend or consolidate with `agents/client/ClientObservability.ts`); `docker-compose.yml` `grafana/otel-lgtm` (reuse as dev sink); `goals/turborepo-cache-trust-observability` (consume, do not absorb); Turbo summary→span converter **NET-NEW** |

### Gated re-entry points (not graduated now)

Each reopens this exploration at `decompose` when its trigger fires.

| Candidate | Trigger | Owner of the trigger |
| --- | --- | --- |
| `observability-hub-store` (logs/traces store bake-off: Loki vs VictoriaLogs; hub placement and restic migration) | `beep-worker` **and** the incoming Linux box both pass the "fully enrolled" gate from `fleet-telemetry-tailnet` (D1) | operator enrolls the boxes; the gate command reports pass |
| `tbk-ubuntu` enrollment (host and spare compute only; the sensitive VM never) | operator declares the VM isolation work finished | operator |
| Public ingress + Vercel drains / GitHub webhooks | operator approves spend (D9) | operator |
| Parcel-gated yeet actions | parcels consumed by agents for two weeks, with the demand ledger showing which parcels matter | `palantiri-parcels` closeout |
| Vendor cloud VM path home (spool + CI artifact or tailnet join) | a cloud lane needs Palantiri data it cannot get | any session reporting `Unknown{unreachable}` |

## Sequencing

1. **`observability-kernel-catalog` first.** Every other goal imports its
   schemas (registry, `EmitterContext`, `TelemetryTier`). The defect fixes
   are what make any export trustworthy. Ship the catalog skeleton and
   registry early in the goal so dependants can start.
2. **`palantiri-parcels` alongside it.** Its first parcel (account headroom)
   needs only `AccountsUsage` plus the kernel's CLI exporter. The research
   called CLI-first the highest-value surface, since agents' `TRACEPARENT`
   flows into `bun run beep`.
3. **`harness-emitters-all-providers` next.** It is cheap probes first, then
   wrappers. It feeds the parcels' completeness check.
4. **`practice-kg-mcp-strict-tier`** once the gate seam is in the kernel. It
   gates every export from `tom-pc-1`, and nothing ships from the PC before
   it.
5. **`fleet-telemetry-tailnet`.** The gateway must exist before the strict
   tier exports leave the PC, so its gateway phase runs in parallel with
   step 4. The rest (dashboards, enrollment gate) follows.
6. **`webapp-and-ci-telemetry`** last. Lowest urgency, no spend, and the
   most dependent on outside tooling (Vercel, Turbo experimental flags).

Steps 3–6 can run as parallel lanes once step 1's registry lands. The
ordering above is priority, not a strict chain.

## First Vertical Slice

**"An agent asks for account headroom and gets a fresh, attributed answer."**

- `beep palantiri parcel account-headroom --json` prints an
  `AccountHeadroomParcel`. It contains the provider, an account ordinal (never
  an email), remaining window and reset time, `asOf`, `sources[]`, and
  `Freshness`. It decodes to `Unknown{stale}` past its 60 s bound.
- The same run exports a `beep.accounts.window_remaining` gauge and a
  `Parcels.read` span over OTLP to the dankserver collector. Both carry
  `beep.*` v2 resource attributes from the registry, and the span nests under
  the calling agent's `TRACEPARENT`.
- Verification:
  - a vitest decodes the parcel (`Fresh` and `Unknown`);
  - an in-memory OTLP capture asserts the gauge name, unit and attribute keys
    against the catalog;
  - a live run from a Claude Code session shows the span under the session's
    trace in Phoenix.

This touches the kernel (catalog, registry, CLI exporter) and parcels
(service, CLI) end to end. It doesn't need the gateway, the strict tier or
the hub.

## Open Risks Inherited From The Brief

- The store bake-off stays behind the D1 gate. Every goal targets OTLP and
  today's dankserver stack.
- `OtlpSerialization` is marked unstable. Pin it with a test, and keep the
  gate synchronous (`Bun.CryptoHasher`).
- Scrubbed spans still link activity. Ids must not link across batches,
  timestamps are rounded, and a minimum count per window is chosen.
- The DPAPI key wrap from bun on Windows is unproven on `tom-pc-1`.
- The Windows collector's cost is unmeasured and it needs an admin install;
  self-reported telemetry from the binary is the floor.
- The Prometheus out-of-order window costs memory, so the replay horizon is
  capped explicitly.
- Cursor and Grok output formats may change, and Muse's native export is
  unverified. Probes come first.
- Cardinality: lane, branch and session keys stay span-only, enforced by the
  registry's cardinality class.
- Vendor cloud VMs can't reach the tailnet, so their data is
  `Unknown{unreachable}`.
- Lineage boundaries: no developer-AI analytics, cache policy or CI forensics
  absorbed.
- dankserver changes land through its Ansible repo, as proposals.
