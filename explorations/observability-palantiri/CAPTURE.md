# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-10-14 — launch prompt (operator, verbatim)

Drafted by the operator in a pre-research session; the handoff bundle it cites is imported under [`research/handoff/`](./research/handoff/).


/explore new observability-palantiri

Drive this exploration packet with `/explore` from capture through graduate
without stopping at stage boundaries (autonomy charter 2026-10-06). Use `/adhd`
at the align and shape stages for every open design decision, `/deep-research`
to close the research gaps listed below, `/grill-with-docs` to lock every
architecture placement against `standards/ARCHITECTURE.md` and
`standards/architecture/12-observability.md`, and `graft ask`/`graft callers`
before reading any source. Use `bun run beep session note` at every stopping
point and the `closeout` skill when you finally yield.

#### 1. Mission

Design the **Palantiri**: one unified, production-grade observability surface
for everything this operator runs, consumable by the human and by every AI
coding agent in the fleet. It covers logging, tracing, metrics, OpenTelemetry,
and dev tooling across:

- deployed web apps (`apps/oip-web` → oip.law, `apps/todox` → todox.ai, both Next.js on Vercel);
- `apps/practice-kg-mcp`, a stdio MCP server shipped as an `.mcpb` with a bun-compiled Windows binary, running inside Claude Desktop on a law-firm attorney's PC (privileged) and on the operator's father's PC (dev/QA, lenient);
- the Tailscale tailnet fleet: `dankstation` (this CachyOS workstation), `dankserver` (Ubuntu homelab, control plane at `~/YeeBois/projects/dankserver`), `beep-worker`, `grok-bot-box-1` (tagged device), an incoming Linux box, `tom-pc-1` and `tom-pc` (two Windows machines; confirm which one is the attorney's working PC), plus ephemeral GitHub Actions runners and vendor cloud VMs;
- repo tooling (`beep` CLI, yeet proof jobs, beep-heavy queue, scheduler timers, `beep qa`), CI + Turborepo, and the local dev loop (portless dev servers, Storybook, Effect DevTools), with WebStorm integration researched last;
- every agent harness, both as an **emitter** of attributed telemetry and as a **consumer** of the Palantiri: Claude Code (4 accounts), Codex CLI (4 accounts), Cursor, Grok Build CLI, the Grok bot box, and Muse (`bun run beep accounts status` is the live roster), including LLM quota and account headroom as a first-class signal.

"Unified" means one attribution schema (join key), one OTLP pipeline, one
query surface (MCP + CLI), and one place to look, not necessarily one store.

#### 2. Locked decisions (operator, 2026-10-14). Do not re-litigate; record them in `DECISIONS.md` as inherited.

- **D1 Backend/store choice is deferred.** The logs/traces/metrics store bake-off (Grafana LGTM pieces vs VictoriaLogs/VictoriaTraces vs ClickStack/SigNoz/OpenObserve vs hosted) does not close until `beep-worker` and the incoming Linux box are fully enrolled (tags, disks, systemd). Write it as an explicit MAP gate with a named trigger. Either of those boxes may **host** the hub; `dankserver` stays the live truth until the gate fires.
- **D2 Strictest tier is shape-only, enforced in the SDK.** On the attorney's PC only tool id, latency bucket, error class/`_tag`, version, counts, and coarsened process CPU/RSS leave the machine. Enforcement is a per-tier Effect Schema allowlist applied at the exporter boundary (decode-or-drop over every serialized OTLP record), not collector redaction. Correlation ids are HMAC'd with a salt that never leaves the PC.
- **D3 Tier authority is Tailscale node identity + ACL tag.** The hub ingress resolves the peer with `whois`; `tag:privileged` hosts can only reach the strict-tier ingress; a batch that does not decode under the host's tier is refused with a 4xx and counted. No per-host signing keys.
- **D4 Every harness emits and consumes.** All providers land attributed spans/metrics in the one pipeline, and all can read the Palantiri through a repo-owned observability MCP server plus an equivalent `beep …` CLI with JSON output for harnesses without MCP.
- **D5 Quota is telemetry.** `beep accounts` polling becomes a pipeline signal and a parcel.
- **D6 Dev tooling scope** = local dev loop + repo tooling emitting telemetry + CI/Turborepo telemetry + WebStorm integration (lowest priority, research only unless cheap).
- **D7 Packet lineage.** This is an umbrella exploration. It inherits the `beep.*` attribute contract from `goals/harness-otel-adoption/research/p0-attribute-contract.md` as the join key and cites `goals/ai-metrics-stack` (closed), `goals/ai-metrics-raw-retention` (active), `goals/turborepo-cache-trust-observability` (active), `explorations/context-rent-telemetry` (parked), `explorations/ci-hang-observability` (graduated) as lineage. Goals it spawns may depend on those packets; they never rewrite them.
- **D8 Deliverable** = exploration packet graduated into 3–6 goal packets with a `MAP.md`, not a mega goal and not a report.
- **D9 Money escalates, nothing else.** Vercel drains (Pro-only, metered), Grafana Cloud above free tier, Tailscale paid tiers, any SaaS backend: surface as a question, do not buy.

#### 3. Lay of the land (verified 2026-10-14; cite, do not re-derive)

- Doctrine: `standards/architecture/12-observability.md` fixes span naming `<slice>.<concept>.<action>`, the domain-vs-technical attribute split, and logging-vs-tracing-vs-console rules. Treat it as target doctrine; surface drift.
- Repo compose: `docker-compose.yml` runs `grafana/otel-lgtm:0.35.0` with `docker/grafana/{otelcol-config.yaml,datasources.yaml,chat-dashboards.yaml,chat-dashboard.json}` (July 2026, wired for `apps/professional-desktop`). It is a dev-only leftover, not a hub.
- `@beep/observability` (`packages/foundation/capability/observability`) is already v4-shaped: native OTLP, `NodeSdk`/`WebSdk`, Prometheus, DevTools relay, HttpApi telemetry middleware, trace-context helpers, cause redaction, `PhaseProfiler`. 31 files import it, 22 of them in `apps/professional-desktop`; only two places mount a server layer (`layerLocalLgtmServer` in the desktop sidecar, `layerNodeSdkServerTraces` in one CLI eval runner). `layerWebSdk`, HttpApi telemetry, Prometheus, ErrorReporter, and TraceContext have no consumers. The overhaul is mostly wiring, not missing capability.
- Three probable defects to confirm first (from the Effect surface note): (a) `layerLocalLgtmServer` merges OTLP and DevTools tracer layers side by side, so DevTools likely overrides OTLP and traces stop reaching the collector; (b) `server/DevTools.ts` sends spans only at start, so they never finish; (c) several `Logger.layer` calls omit `mergeWithExisting`, dropping `tracerLogger` and detaching logs from spans.
- `apps/practice-kg-mcp/src` contains zero `Tracer`/`Metric`/`Logger` usage today.
- The inherited `beep.*` contract (`goals/harness-otel-adoption/research/p0-attribute-contract.md`) records a known gap: Codex metrics cannot carry per-checkout attribution. Plan a **v2** of that contract (adds harness, provider account, lane, tier) with an Effect Schema as its typed home; that v2 is the join key every emitter and every parcel uses.
- The CLI is the primary agent path, not MCP: Claude Code passes `TRACEPARENT` into Bash subprocesses, so `beep …` spans nest under the agent's own trace, while MCP covers clients without a shell. Claude Code strips `OTEL_*` from MCP servers and hooks, so the repo MCP server and CLI carry their own exporter config.
- Phoenix stays the LLM-trace store whatever the hub becomes (it stores traces only); the collector fans `gen_ai.*` spans to Phoenix and every span to the general store, joined by trace id. A tailnet-only design still needs exactly one authenticated public ingress for Vercel drains and GitHub webhooks.
- Installed `effect` is 4.0.2 (reference checkout is 4.0.4). Module paths are `effect/http`, `effect/http-api`, `effect/observability`, `effect/devtools`, `effect/eventlog`, `effect/ai`; there is no export under the retired `unstable` path segment. 4.0.4 carries a fix that finishes HTTP server spans before shutdown (matters for short-lived CLI processes).
- `dankserver` live stack (Ansible-managed, `~/YeeBois/projects/dankserver/docs/monitoring-stack.md`): Grafana 13.2.3, Prometheus 3.15.0 (10y retention, `/srv/data/monitoring` on a dedicated disk), node-exporter 1.12.1, OTel Collector 0.162.0, Arize Phoenix on a dedicated tailnet HTTPS route, restic backups + restore drills, dashboards `dankserver-host-overview`, `dankserver-backup-integrity`, `openclaw-operations`. Claude Code and Codex already export there with the `beep.*` schema (`goals/harness-otel-adoption`, closed 2026-07-25, 98.5% session coverage proven).
- Tailnet health check reports `systemd-resolved`/NetworkManager mis-wiring on `dankstation` (MagicDNS may fail); record it as a prerequisite.
- The hub compose already allows CORS from `professional-desktop.beep.localhost:1355` and Tauri origins; browser OTLP from the Next.js apps is not wired.

#### 4. Pre-research handoff bundle (read before the research stage; import into `research/`)

`~/.cache/beep/handoffs/observability-palantiri/` — copy `research_notes/*.md`,
`adhd/*.md`, and `reports/Observability overhaul landscape.md` into the packet's
`research/` with a `SOURCES.md` row each. Headline facts the bundle established:

- Effect v4 ships OTLP/HTTP (JSON + protobuf) for all three signals in core (`effect/observability`), `Otlp.layerFromConfig` reading standard `OTEL_*` env, Prometheus HTTP, a DevTools client **and** server, `effect/ai/Telemetry` with `gen_ai.*` span attributes (no token metrics), HTTP server/client auto-spans tuned by layer-provided settings, span log levels (`MinimumTraceLevel`), and an `ErrorReporter`. `@effect/opentelemetry` is now only the bridge to the official JS SDK.
- Backends (2026): `docker-otel-lgtm` is still dev-only (no Alloy, no Mimir); `mcp-grafana` v0.14 and a managed Grafana Cloud MCP exist; Tempo exposes `/api/mcp`; Phoenix exposes a built-in `/mcp`; Langfuse was acquired by ClickHouse (Jan 2026); SigNoz/ClickStack need ~8 GB realistic; OpenObserve ~0.3–0.65 GB; VictoriaTraces is pre-1.0 but Tempo-API compatible; Grafana Foundation SDK is the only typed TypeScript dashboards-as-code path, CLI now `gcx` (GA 2026-07-28).
- Agent-facing: self-hostable MCP servers with static tokens work headless over a tailnet (Grafana, Tempo, Phoenix, Netdata, OpenObserve, VictoriaMetrics, ClickHouse); SaaS ones are mostly OAuth (awkward headless). Claude Code ignores `OTEL_*` in repo `.claude/settings.json` and does not pass `OTEL_*` to MCP servers or hooks; Codex reads only `~/.codex/config.toml` `[otel]`. GenAI/MCP semconv moved to `open-telemetry/semantic-conventions-genai` (Development); SEP-414 reserves `_meta.traceparent`. Context-economy patterns worth copying: Axiom's cell caps + summary-first tables + "N of M" notes, Datadog's `max_tokens`, Langfuse's CLI-plus-skill recommendation. **Nothing was found on Cursor or Grok CLI native telemetry** — the wrappers (`claudex`/`claudeg`/`claudep`, `cursor-agent`, `grok`) are the emission point to design.
- Fleet: hybrid topology — Prometheus keeps scraping always-on Linux boxes over the tailnet; intermittent hosts (Windows PCs, CI runners) push OTLP through a collector with the `file_storage` persistent queue and a long retry window (default retry is 5 min then drop). OTel Collector contrib is the one agent that does per-process CPU/RSS on Windows + Event Log + OTLP + disk queue; no agent documents a non-admin per-user Windows install. Use Tailscale **Serve** (identity headers, tailnet-only), never Funnel; tag-based grants for scrape/OTLP ports; `tailscale/github-action@v4` with GitHub OIDC joins runners as temporary tagged nodes (1,000 free minutes/month). Pushed hosts need explicit staleness alerts.
- Privacy: OTel metric Views allowlist attribute keys but exemplars leak unless `AlwaysOff`; the collector `redaction` processor hashes with HMAC and can stamp dropped-key names/counts, but is beta/alpha; the authoritative filter must be an allowlist exporter inside the bun binary, collector second, backend policy (OTel Weaver live-check) third, all generated from one allowlist file. MCP semconv already marks tool args/results opt-in; `mcp.resource.uri` and `jsonrpc.request.id` are not opt-in and must be coarsened. Precedents: VS Code / Windows / M365 ordered levels where policy can only tighten; Claude Code and Codex keep content flags off with `<REDACTED>` placeholders. Legal frame: Rule 1.6(c) reasonable efforts, ABA 477R/498/512; **no ethics opinion addresses software telemetry metadata directly** — flag for the attorney.
- Web/CI: Vercel drains are Pro-only, $0.50/GB, push only to public HTTPS; a manual OTel SDK without `@vercel/otel` loses Trace Drains and does not run on Edge — so `@vercel/otel` owns the global provider and Effect attaches via `OtelTracer.layerGlobal`; `instrumentation.ts` is stable (Next 15+), `onRequestError` covers server actions. Browser: OTLP/HTTP only, CORS pinned to origin, any browser token is public; Grafana Faro is the fullest open RUM but its receiver is experimental. CI: CI/CD semconv at RC; `githubreceiver` needs a public webhook; `dash0hq/otel-cicd-action` is outbound-only; Turborepo 2.8.13+ `experimentalObservability.otel` is metrics-only and demands `https://`; Vitest has experimental OTel.

#### 5. The ADHD survivors to carry into shape (bundle `adhd/phase2-deepened.md`)

1. **Tier-in-the-signal** — `TelemetryTier` LiteralKit + per-tier closed `S.Class` allowlists; exporter-boundary decode-or-drop; hub gateway as an Effect HttpApi in front of the collector importing the same schema; `telemetry_refused_total{host_tag,schema_failure_tag}` is the operator's page; attorney PC gets a local-only `practice_health_today` morning card; per-release shape fingerprints diffed across tiers.
2. **Parcel lockers** — the agent-facing Palantiri is a `Parcels` `Context.Service` of schema-typed, pre-staged, sealed answers keyed by session/lane/host/pr/app/account with a read-time `Freshness = Fresh | Unknown{reason}`; one HttpApi serves the MCP server and the CLI; a completeness check downgrades to `Unknown{attribution-incomplete}` when expected emitters are missing; first parcel wraps `AccountsUsage.service`; children: parcel-gated yeet actions, parcel-demand ledger, parcels pushed at `beep session open`, quota-arbitrage router.
3. **Proof of absence** — canary tokens through real handlers, hub watcher over every sink, per-hop values-free negative ledger with balance checks, per-tier golden allowlist snapshot tests, mutation-tested redaction, weekly attorney "privacy receipt".

Treat the traps in `adhd/phase1-pool.md` as named non-goals (federated no-backend store, telemetry-as-git, half-life retention, purpose codes on every query, milk-run collection).

#### 6. Research gaps to close (deep-research round inside the packet)

- Reconcile, do not duplicate: `goals/turborepo-cache-trust-observability` (active, owns cache-outcome telemetry) and `explorations/ci-hang-observability` (graduated; its only re-entry is hosted observability).
- Hub placement inputs: specs, disks, and intended roles of `beep-worker` and the incoming box; migration path for Prometheus/Grafana/Phoenix state via the existing restic repos; what "fully enrolled" means as a checkable trigger.
- Prometheus 3.x native OTLP receiver and how far back it accepts late samples (laptop backlog replay); Grafana 13 login via Tailscale identity headers; `tailscale serve --service` status.
- Cursor, Grok Build, Grok bot, and Muse emission hooks: what each harness exposes (env, hooks, transcripts, proxy) and how the CLIProxyAPI (`~/.cli-proxy-api`) could stamp `beep.*` attributes for every proxied request.
- Codex `[otel]` exporter syntax; the exact `@vercel/otel` exporter env; Turborepo `--summarize` format.
- A JS/Bun allowlist-exporter design for the strict tier (no library exists); where Claude Desktop stores MCP stderr and for how long.
- Measured CPU/battery cost of an OTel collector contrib agent on a Windows laptop; an OTel-hostmetrics-native dashboard worth adopting as-is.
- Whether `effect` 4.0.4 (or the next pkg.pr.new snapshot per repo policy) should be pulled in for the span-shutdown fix.

#### 7. Frontier questions for the align stage (grill the operator; recommended answer first)

1. Hub placement trigger wording and owner.
2. Logs store shortlist for the deferred bake-off (recommend: Loki-vs-VictoriaLogs only, both Grafana-readable, so no dashboard rewrite).
3. Vercel apps path: Grafana Cloud free tier vs a tiny public collector in front of the tailnet vs wait (money question → operator).
4. Attorney sign-off: does the shape-only allowlist and the weekly privacy receipt go to the attorney for review before the first strict-tier export (recommend yes, via the lawyer-facing review-surface default).
5. Where the Palantiri MCP server lives (`apps/palantiri/**` runnable + `packages/tooling/library/palantiri/**` parcel schemas vs inside `@beep/observability`), and whether `@beep/observability` splits its SDK kernel from its server wiring — decide with `/grill-with-docs` against `07-non-slice-families.md` and `05-layer-composition.md`.
6. Parcel-gated yeet actions: in scope for the first goals or a later unlock.
7. WebStorm: research-only or a thin run-config/link integration.

#### 8. Expected decomposition (candidate goal packets; adjust in shape)

Suggested graduation order from the report: CLI + parcels first, attribute contract v2 second, privacy tiers third (they gate every practice-kg-mcp export), hub placement last.

- `observability-kernel-v4` — fix the three defects, split SDK kernel vs server wiring, `TelemetryTier` + per-tier allowlists + exporter-boundary enforcement, `Otlp.layerFromConfig`, attribution resource schema inherited from `beep.*`.
- `fleet-telemetry-tailnet` — collector agents per host class, Serve + grants + tags, push-vs-scrape topology, staleness alerts, fleet overview dashboard, hub placement gate.
- `palantiri-parcels-mcp` — `Parcels` service, MCP server + CLI, first five parcels (account headroom, lane reds, host pressure, app error classes, "since last check"), session-open push.
- `practice-kg-mcp-privacy-tiers` — strict-tier instrumentation of the bun binary, local spool, morning card, canaries + negative ledger + golden tests, attorney receipt.
- `harness-emitters-all-providers` — Cursor/Grok/Muse/proxy emission, Codex/Claude re-verification, completeness checks.
- `webapp-and-ci-telemetry` — `@vercel/otel` + Effect bridge, browser RUM posture, CI/CD spans, Turborepo metrics, runner tailnet join.

#### 9. Constraints

- Schema → `Context.Service` contract → implementation; Effect v4 only, validated against `~/YeeBois/references/effect/effect` (never priors); `effect/<Module>` imports; `HashMap`/`HashSet`; `Effect.fn`/`fnUntraced`.
- The repo is public: no corpus content, client data, tokens, `op://` resolutions, or home-absolute paths in packet files; tailnet hostnames are fine, account emails are not.
- Do not mutate `dankserver`, the tailnet ACL, or any Windows host during the exploration; proposals only, with the exact Ansible/CLI commands the goal packets will run.
- One PR for the packet; publish through `yeet`; friction receipts into the packet's `research/OPPORTUNITIES.md` as they happen.

#### 10. Done

`explorations/observability-palantiri` at `graduated` with `BRIEF.md`, `MAP.md`, a `DECISIONS.md` carrying D1–D9 as inherited plus the align-stage answers, and the spawned `goals/*` packets passing `bun run beep goals doctor`; PR merge-ready per the gate; then the `closeout` prompt.

## 2026-10-14 — operator additions during research (sanitized)

- `tbk-ubuntu` stays out for now. A security-sensitive VM is being built on
  that box; once it is isolated, the box joins, and its spare compute is
  worth using.
- Dashboards that might be useful: the gated host's own LAN Grafana
  dashboard for that workload, plus the dankserver `dankserver-host-overview`
  and `openclaw-operations` dashboards (Serve route `:8443`). Reviewed in
  [`research/existing-dashboards.md`](./research/existing-dashboards.md).
- Caveat on those dankserver dashboards: an earlier model generated them and
  they have problems, so they should not heavily influence the Palantiri's
  setup. Example: `openclaw-operations` never seems to persist data after
  updates.
