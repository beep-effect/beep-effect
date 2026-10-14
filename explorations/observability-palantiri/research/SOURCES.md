# Observability Palantiri — Sources & Provenance

- **Cluster / origin:** the operator's 2026-10-14 pre-research bundle
  (imported under [`handoff/`](./handoff/)) plus four in-packet research lanes
  (2026-10-14).
- **Provenance:** synthesis in [`../RESEARCH.md`](../RESEARCH.md); decisions in
  [`../DECISIONS.md`](../DECISIONS.md).

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Effect (`effect`, `@effect/opentelemetry`; reference checkout `~/YeeBois/references/effect/effect`) | MIT | port-with-attribution | OTLP exporter, `OtlpSerialization` seam, DevTools end/event patches, `OtelTracer.layerGlobal` |
| CLIProxyAPI (vendored build, `~/YeeBois/workstation-apps/CLIProxyAPI`) | MIT | port-with-attribution | `usage.Plugin` hook for per-request spans |
| OpenTelemetry Collector / contrib | Apache-2.0 (per upstream; UNVERIFIED on disk) | reference / configure | agent-mode collector, `file_storage`, `redaction` |
| Grafana, Loki, Tempo | AGPL-3.0 (per bundle) | reference only; run as services, never vendor | backend candidates (D1) |
| Arize Phoenix | ELv2 (per bundle) | reference only; run as a service | GenAI trace lane |

## 3. External research sources

External URLs live in the notes that cite them; none are reproduced here
beyond what is on disk. 106 distinct cited links across:

- [`handoff/landscape-report.md`](./handoff/landscape-report.md) and the six
  handoff notes (Effect v4 surface, backends, agent tooling, fleet, privacy,
  web/CI).
- [`fleet-and-hub.md`](./fleet-and-hub.md) — Prometheus OTLP + out-of-order,
  Grafana auth proxy, Tailscale Services, Windows collector, dashboard 24638.
- [`harness-emitters-and-web-ci.md`](./harness-emitters-and-web-ci.md) —
  Cursor, Grok, Muse, Codex, Claude Code, `@vercel/otel`, Turborepo.
- [`strict-tier-exporter.md`](./strict-tier-exporter.md) — autotel, OTel
  Weaver prior art.

## 4. In-repo capability references

See the capability map in [`in-repo-inventory.md`](./in-repo-inventory.md):
`@beep/observability` (extend), `@beep/mcp-kit` (reuse/extend),
`packages/drivers/*-mcp` host pattern (reuse), `apps/practice-kg-mcp`
packaging (reuse/extend), `beep` CLI command groups + `JsonStringCodec`
(reuse), `AccountsUsage` (reuse model; emitter NET-NEW),
`@beep/repo-ai-metrics` allowlist/tier vocab (reuse; do not absorb).
NET-NEW: `beep.*` v2 schema, `TelemetryTier` + shape-only gate, span/metric
name catalog, Palantiri MCP server + CLI group, quota gauge emitter.

## 5. Cross-links & provenance

- Lineage (D7): `goals/harness-otel-adoption`, `goals/ai-metrics-stack`,
  `goals/ai-metrics-raw-retention`, `goals/turborepo-cache-trust-observability`,
  `goals/ci-step-watchdog`, `explorations/ci-hang-observability`,
  `explorations/context-rent-telemetry`.
- Operator references: [`existing-dashboards.md`](./existing-dashboards.md);
  dankserver control plane cited as `dankserver:<path>`.
