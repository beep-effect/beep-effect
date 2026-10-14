# Research

Stage 1, 2026-10-14. Two inputs: the operator's pre-research handoff bundle
(imported verbatim under [`research/handoff/`](./research/handoff/)) and four
research lanes run inside this packet to close the CAPTURE §6 gaps. This file
is the synthesis; the cited notes carry the evidence (`path:line` for local
sources, URLs for external ones). Provenance ledger:
[`research/SOURCES.md`](./research/SOURCES.md).

| Note | Scope |
| --- | --- |
| [`handoff/landscape-report.md`](./research/handoff/landscape-report.md) | the bundle's synthesis: Effect v4 surface, backends, harnesses, fleet, privacy, web/CI |
| [`handoff/*.md`](./research/handoff/) (six notes + ADHD phases 1–2) | per-topic deep research behind the report |
| [`in-repo-inventory.md`](./research/in-repo-inventory.md) | live-checkout verification: defects, consumers, practice-kg-mcp, AccountsUsage, lineage, placement, capability map |
| [`fleet-and-hub.md`](./research/fleet-and-hub.md) | tailnet census, dankserver control plane, "fully enrolled" gate, Prometheus OTLP, Grafana/Tailscale auth, Windows costs |
| [`harness-emitters-and-web-ci.md`](./research/harness-emitters-and-web-ci.md) | Cursor, Grok, Muse, CLIProxyAPI, Codex, Claude Code, `@vercel/otel`, Turborepo; `beep.*` contract v2 proposal |
| [`strict-tier-exporter.md`](./research/strict-tier-exporter.md) | shape-only exporter seam, schema shape, leak paths, spool, proof harness |
| [`existing-dashboards.md`](./research/existing-dashboards.md) | the operator's live dashboards as references and anti-patterns |

## External Landscape

The bundle's headline holds after verification: **the Palantiri needs wiring,
not new capability.** OTLP is universal, every candidate backend ingests it,
and Effect v4 ships a dependency-free OTLP exporter for all three signals in
`effect/observability` ([landscape report §1](./research/handoff/landscape-report.md)).
The consequential work sits at three seams nobody vendors: the attribution
contract, the in-process privacy fence, and the single public door that Vercel
and GitHub force onto a tailnet-only design.

- **Backends (D1, deferred).** Three shapes remain: Grafana + Loki/Tempo,
  Victoria*, or ClickHouse (SigNoz/ClickStack, 4–8 GB). Phoenix stays the
  GenAI lane behind collector fan-out whatever wins; `docker-otel-lgtm` is a
  dev-loop sink, never a hub
  ([backend_landscape](./research/handoff/backend_landscape.md)). The
  Grafana Foundation SDK is the only typed TS dashboards-as-code path.
- **Agent-facing surface.** Self-hostable MCP servers with static tokens work
  headless over a tailnet (mcp-grafana, Tempo `/api/mcp`, Phoenix `/mcp`).
  Axiom's output discipline (summary-first, cell budgets, "N of M" receipts)
  and gcx's CLI contract are the patterns to copy
  ([agent_facing_tooling](./research/handoff/agent_facing_tooling.md)).
- **Harness emission (closes the bundle's biggest gap).**
  [harness-emitters §1–6](./research/harness-emitters-and-web-ci.md):
  - Claude Code: richest native exporter; strips `OTEL_*` from Bash, hooks
    and MCP children; passes `TRACEPARENT` to Bash **except** behind a custom
    `ANTHROPIC_BASE_URL`, where it needs `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1`
    — so every proxy session (`claudex`/`claudeg`/`claudep`) loses Bash trace
    context today.
  - Codex: `[otel]` keys documented; no `trace_exporter` configured live;
    `OTEL_RESOURCE_ATTRIBUTES` probably closes the v1 per-checkout metrics gap
    (probe pending).
  - Cursor: native OTel is Enterprise-only and server-side; hooks
    (`sessionStart` can inject env) plus a wrapper span are the emission
    point; CLI output carries no tokens.
  - Grok Build: no OTLP; session files (`events.jsonl`, `usage.json`) allow
    full turn/tool/token reconstruction; it also runs Claude-format hooks,
    which can mis-tag rows as `claude-code`.
  - Muse (Meta Muse Code): apparently emits GenAI-semconv OTLP natively
    (binary strings only; probe pending).
  - CLIProxyAPI: no OTel, but a per-request usage record (model, account
    index, latency, TTFT, tokens); a vendored plugin can emit one span per
    proxied request stamped from `X-Beep-*` headers — the cheapest
    cross-provider attribution point.
- **Fleet.** Hybrid topology: scrape always-on Linux, push OTLP with a
  `file_storage` queue from intermittent hosts. Prometheus's out-of-order
  window is measured from the newest sample in the whole TSDB, so a
  multi-day laptop replay needs a window ≥ the longest offline period and
  persisted original timestamps. Tailscale Services are GA (2026-02-19) but
  require tagged hosts. Adoptable OTel-native host dashboard: grafana.com
  24638 ([fleet-and-hub §4–7](./research/fleet-and-hub.md)).
- **Privacy.** No JS/TS schema-allowlist exporter exists; the collector
  `redaction` processor is beta/alpha and second-fence only; no ethics
  opinion covers telemetry metadata, so the attorney confirms the line
  ([privacy_tiered_telemetry](./research/handoff/privacy_tiered_telemetry.md),
  [strict-tier §7](./research/strict-tier-exporter.md)).
- **Web/CI.** `@vercel/otel` must own the provider (manual SDK loses Trace
  Drains, no Edge); Effect joins via `OtelTracer.layerGlobal` (verified).
  Drains are Pro-only, metered, public-HTTPS-only. Turborepo OTel is
  metrics-only and https-only; the `--summarize` JSON is the better trace
  source (strip `user`); in this repo the config key is
  `global.experimentalObservability`
  ([harness-emitters §7–8](./research/harness-emitters-and-web-ci.md),
  [webapp_and_ci_telemetry](./research/handoff/webapp_and_ci_telemetry.md)).

## In-Repo Capability Inventory

Full table: [in-repo-inventory "Capability map"](./research/in-repo-inventory.md).

- **`@beep/observability`** (`packages/foundation/capability/observability`)
  is v4-native; about 14 of 124 exports have consumers outside the package.
  Defects, all **CONFIRMED** (a and b reproduced live in scratch scripts):
  - (a) `layerLocalLgtmServer` merges OTLP and DevTools tracers as siblings;
    with both enabled no `/v1/traces` reaches the collector. Fix:
    `Layer.provideMerge` ordering.
  - (b) the filtered DevTools tracer sends only span-start; spans never end.
  - (c) `Logger.layer` without `mergeWithExisting` drops `tracerLogger` at
    `Logging.ts:467`, the sidecar IPC path (deliberate), a lab, and
    `Dock.atoms.ts:53`.
  - (d) new: `layerConsoleLogger(config)` returns a function, not a Layer
    (dual-signature typing); its own JSDoc example hits it.
  - (e) new, from the strict-tier lane: `layerProtobuf`/`layerJson` pin their
    own serializer, so the shape-only build must use `Otlp.layer` with a
    custom `OtlpSerialization`.
- **`apps/practice-kg-mcp`**: no observability dependency, no tracer/logger
  layer; already opens named `Effect.fn` spans that go nowhere; tool spans are
  sanitized via `@beep/mcp-kit` `sanitizedToolkit`; it does **not** pin
  `Logger.LogToStderr` like the other stdio hosts (stdout-framing risk;
  unchecked whether any log fires while serving).
- **`AccountsUsage`** (`packages/tooling/tool/cli/src/commands/Accounts/`):
  schema and service complete; polls only on demand. The quota gauge needs a
  new emitter, scheduler, and a CLI exporter (the CLI has none today).
- **`beep.*` v1 contract** exists only in prose and the operator's launcher;
  no TS schema. Codex metrics-attribution gap confirmed.
- **Reusable bricks**: `@beep/mcp-kit` (`SanitizedSpan`, `TierGate`,
  `FieldTier`, stateless client), the `packages/drivers/*-mcp` host pattern,
  the practice-kg `.mcpb` packaging and smoke harness, the `beep` command-group
  topology with `JsonStringCodec` + `--json`, ai-metrics'
  `AiMetricsOtlpAttributeKey` allowlist and `EvidenceTier`/`OipTaint`
  vocabularies.
- **Doctrine drift**: of 3,997 span names, 3,838 are `Concept.action` and 59
  follow `12-observability.md`'s `<slice>.<concept>.<action>`. The doctrine is
  effectively unadopted; a name catalog must ratify or codemod.
- **Effect**: installed 4.0.2 (+ local patch), reference 4.0.4. The #9066
  shutdown fix covers HTTP server spans only (the sidecar today); 4.0.3's
  histogram fixes matter more once metrics land.
- **Fleet backend today** (dankserver, Ansible-managed): Grafana 13.2.3,
  Prometheus 3.15.0 (10y retention, scrapes only itself, local node-exporter
  and the collector), collector-contrib 0.162.0 (OTLP/HTTP only, no logs
  pipeline, pull exporter keeping only the latest point), Phoenix 20.19.0,
  six restic repos with weekly restore drills.

## Constraints Discovered

1. **Lineage boundaries** ([in-repo §5](./research/in-repo-inventory.md)):
   developer-AI semantics stay in `@beep/repo-ai-metrics`, never in
   `@beep/observability`; `turborepo-cache-trust-observability` forbids a
   generic telemetry platform absorbing cache policy; `ci-step-watchdog`
   forbids OTel. Live dashboards use native OTel; scorecards and archives use
   the transcript pipeline (dual-ingestion precedence, inherited).
2. **Tagging is the first gate.** Only `grok-bot-box-1` is tagged; dankserver's
   Ansible names `tag:server` but `tailscale_enable_up: false` means it never
   landed. D3 tier authority and Tailscale Services both need tags.
3. **An unauthenticated OTLP ingest is open to the whole tailnet today**
   (dankserver Serve `:8448`), including the second tailnet user's PC; the
   Serve routes `:8443/:8447/:8448` are not in Ansible. Any strict-tier design
   must close this before the attorney PC sends anything.
4. **Laptop backlog cannot be backfilled through today's path** (pull
   exporter + no OTLP receiver in Prometheus).
5. **Shape-only gate must be synchronous** (it runs inside the serializer),
   so HMAC uses `Bun.CryptoHasher`; the module is marked unstable and needs a
   pinning test.
6. **Windows**: every mainstream agent needs an admin install; per-user
   install is untested; no measured laptop cost exists. Claude Desktop keeps
   MCP stderr under `%APPDATA%\Claude\logs` with undocumented retention.
7. **Contract-name collision**: the v2 proposal uses `beep.tier` for the
   model-manifest role while the privacy work needs a tier attribute; one of
   them must be renamed (align).
8. **Public ingress is unavoidable** for Vercel drains and GitHub webhooks;
   anything paid is a D9 money question.
9. **Existing dashboards are reference only** (operator ruling): the
   dankserver ones were generated by an earlier model and have defects
   (OpenClaw totals reset and series expire across updates); new dashboards
   are designed from the signal schema and tested for restart survival.
10. **Gated host** `tbk-ubuntu` stays out until the operator finishes
    isolating a security-sensitive VM on it; that VM is never instrumented.
11. **Public repo**: no LAN IPs, tailnet suffixes, account identifiers, or
    workload details for the gated host in packet files.
