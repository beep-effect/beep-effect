# P0: beep attribute contract v1 + dual-ingestion precedence

> Decided 2026-07-14 during P0. Companion to
> [`p0-config-surfaces.md`](./p0-config-surfaces.md). This is the beep-owned
> schema the SPEC requires; the eventual typed home is
> `packages/tooling/library/ai-metrics` (added when the first consumer needs
> it in code — v1 is contract-by-documentation).

## Attribute schema v1 (pinned)

Emitted as OTel resource attributes (Claude Code) / span attributes (Codex —
see gap below). Namespaced under `beep.` to survive upstream GenAI-semconv
churn; upstream conventions are development-stage, so nothing downstream may
depend on non-`beep.` attribute names.

| Attribute | Values | Source |
|---|---|---|
| `beep.repo` | checkout family (`beep-effect`, `beep-effect2`, …) | launcher wrapper, from `basename $(git rev-parse --show-toplevel)` |
| `beep.branch` | current git branch | launcher wrapper |
| `beep.task_class` | `feat` \| `fix` \| `goals` \| `chore` \| `explore` \| `other` | launcher wrapper, from branch prefix |
| `beep.goal_slug` | the branch path AFTER the `goals/` prefix, verbatim (e.g. branch `goals/harness-otel-adoption-impl` -> `harness-otel-adoption-impl`); empty for non-goals branches | launcher wrapper, from branch |
| `beep.schema_version` | `1` | static |
| `host.name` | machine name | static (standard semconv) |

Harness identity rides the standard `service.name` (Claude Code and Codex
set their own); `environment` (Codex `[otel] environment`) stays `dev`.

Cardinality rule: NO session ids, paths, or prompt-derived values in metric
labels. `resource_to_telemetry_conversion` on the Prometheus exporter copies
resource attributes onto datapoints — the table above is the complete
allowed set.

Consumers should prefix-match goal slugs
(`beep_goal_slug=~"<goal>.*"`) because implementation branches may carry
suffixes. The 2026-07-14 live probe exported a manually normalized value
(`harness-otel-adoption`); wrapper-emitted values are verbatim branch
remainders.

Emitter version pins (recorded at adoption): Claude Code 2.1.209 (traces
beta), Codex CLI 0.144.4, otelcol-contrib 0.154.0.

## Dynamic injection

Static user-level config cannot know repo/branch/goal. A thin launcher
wrapper (shell function) computes `OTEL_RESOURCE_ATTRIBUTES` from git state
at invocation time for Claude Code. Codex: `span_attributes` is static
user-level TOML — see gap.

## Known gap: Codex metric/dynamic attribution

Codex `span_attributes` (a) applies to traces only — metrics carry no custom
attribution — and (b) is static user-scope config, so even trace attribution
cannot vary per session/checkout without rewriting config.toml. v1 accepts:

- Codex metrics: identified by `service.name` + `environment` only.
- Codex traces: static machine-level attrs only.
- Repo-level codex attribution continues to come from the transcript
  pipeline (`session_meta.cwd`), which already does this well.

Follow-up (recorded, not v1): upstream feature request for
resource-attribute env passthrough, or collector-side enrichment keyed on
something codex does emit.

## Dual-ingestion precedence rule (decided)

Two paths now produce overlapping data (native OTel vs transcript pipeline).
Consumers are partitioned so nothing double-counts:

| Consumer | Source of truth |
|---|---|
| Live dashboards (Grafana metrics, Phoenix traces) | **native OTel only** |
| Weekly config-impact scorecards, DuckDB analytics, archives | **transcript pipeline only** (unchanged) |
| Coverage verification (P2) | compares the two, reports drift — the only place both appear together |

The transcript pipeline remains the analytical system of record (content
depth, historical backfill, privacy-proofed archive). Native OTel is
operational visibility. A future migration of scorecard inputs onto OTel
data is explicitly out of scope for this goal (SPEC non-goal: no scorecard
redesign).

## Deployment note (discovered in P0)

The dankserver monitoring stack is Ansible-managed from the `dankserver`
repo (`ansible/roles/monitoring/templates/{otel-config.yaml.j2,
compose.yaml.j2}`). Collector changes MUST land there and deploy through
that repo's flow — hand-editing `/home/elpresidank/monitoring/otel/config.yaml`
creates drift that the next ansible run erases. Traces fan-out additionally
requires the collector container to join the external
`beep-ai-metrics-dankserver_default` network, because Phoenix publishes
6006 on host loopback only.
