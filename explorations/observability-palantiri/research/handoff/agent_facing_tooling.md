# Agent-facing observability tooling (2026): MCP servers, CLIs, dev-loop viewers, harness telemetry, context-economy patterns

Research date: 2026-10-14. Maturity tags: **official** = vendor/project-owned; **community** = third-party maintained; **experimental** = beta/dev-status or explicitly unstable. Where a fact came from an aggregator rather than a primary source it is flagged.

## Q1. Which MCP servers exist for the target backends, what do they expose, how do they authenticate, and can a headless agent use them over a tailnet?

### Takeaway
Nearly every target backend now has an **official** MCP surface, and the market has split into two deployment shapes: (a) **self-hostable/embedded servers** that speak streamable HTTP and can be bound to a tailnet address (Grafana `mcp-grafana`, Tempo's built-in `/api/mcp`, Phoenix's built-in `/mcp`, Netdata agent MCP, OpenObserve `/api/{org}/mcp`, VictoriaMetrics, ClickStack OSS, SigNoz), and (b) **SaaS-hosted remote servers** that use OAuth and are reachable from anywhere but not "over the tailnet" (Datadog, Sentry cloud, Honeycomb, Axiom, Dash0, Langfuse cloud, Netdata Cloud, ClickStack Cloud). For a headless agent session, servers that accept a static bearer/service-account token are the practical choice; OAuth-only hosted servers need an interactive first login. Tailscale itself has **no official MCP server** — only community ones.

### Cited Findings

**Grafana — `grafana/mcp-grafana` (official, open source, self-hosted)**
- Tool categories: Dashboards (search, get by UID, summary, JSONPath property extraction, create/update/patch, panel query info; `run_panel_query` disabled by default), Datasources, Prometheus (PromQL, metadata, label names/values, histogram percentiles), Loki (LogQL log + metric queries, labels, stream stats, patterns), Tempo (TraceQL search/metrics, trace fetch/diff, attribute lookup), Pyroscope, Incidents, OnCall, Alerting (rules, routing, silences), plus disabled-by-default SQL (ClickHouse, Postgres, etc.), CloudWatch, Elasticsearch, Graphite, "Agent Observability", Admin, rendering to PNG, deeplinks, and a generic `grafana_api_request` — [grafana/mcp-grafana](https://github.com/grafana/mcp-grafana)
- Transports: stdio (default), SSE, streamable-http; default listen `localhost:8000`; Docker image defaults to SSE — [grafana/mcp-grafana](https://github.com/grafana/mcp-grafana)
- Auth: `GRAFANA_URL` + `GRAFANA_SERVICE_ACCOUNT_TOKEN` (or `GRAFANA_SERVICE_ACCOUNT_TOKEN_FILE`, re-read per request so rotation needs no restart); `GRAFANA_ORG_ID`/`X-Grafana-Org-Id`; for HTTP transports `MCP_GRAFANA_SERVER_TOKEN` / `--server-auth-token` makes callers present a bearer token — [grafana/mcp-grafana](https://github.com/grafana/mcp-grafana)
- Context controls: `get_dashboard_summary` / JSONPath property tools instead of full dashboard JSON (README advises avoiding `get_dashboard_by_uid` unless needed); `--disable-<category>`, `--enabled-tools`; `--disable-write` (read-only, also drops raw SQL unless `--enable-query`); `--disable-query`; `--max-loki-log-limit` default 100 plus byte-budget and time-range guardrails — [grafana/mcp-grafana](https://github.com/grafana/mcp-grafana)
- Tailnet fit (inference from the above): streamable-http + server bearer token + service-account token file = usable from headless sessions on any tailnet host.

**Tempo built-in MCP (official, experimental-ish)**
- Enable with `--query-frontend.mcp-server.enabled=true` or YAML `query_frontend.mcp_server.enabled: true`; endpoint `http://<tempo>:3200/api/mcp`; tools `traceql-search`, `traceql-metrics-instant`, `traceql-metrics-range`, `get-trace`, `get-attribute-names`, `get-attribute-values`, `docs-traceql`, `docs-config`; requests go through Tempo's normal auth/multi-tenancy; Claude Code: `claude mcp add --transport=http tempo http://localhost:3200/api/mcp` — [Grafana Tempo MCP server docs](https://grafana.com/docs/tempo/latest/api_docs/mcp-server/)
- Older v2.10 docs lack the tool table, so tool set depends on Tempo version — [Tempo v2.10 docs](https://grafana.com/docs/tempo/v2.10.x/api_docs/mcp-server/)

**Loki**
- `grafana/loki-mcp` is a Go project under the grafana org; aggregators describe a `loki_query` LogQL tool (not verified against the README) — [aggregator summary via search; repo github.com/grafana/loki-mcp not fetched]. Separate community Python project `tumf/grafana-loki-mcp` queries Loki through the Grafana API with stdio/SSE — [tumf/grafana-loki-mcp](https://github.com/tumf/grafana-loki-mcp)
- In practice mcp-grafana's Loki toolset covers LogQL with built-in limits — [grafana/mcp-grafana](https://github.com/grafana/mcp-grafana)

**Prometheus**
- No Prometheus-project official server found. Community `pab1it0/prometheus-mcp-server`: PromQL instant/range queries, metric discovery, basic or bearer auth via env, Docker image `ghcr.io/pab1it0/prometheus-mcp-server`, `PROMETHEUS_URL`; latest tag seen 1.6.2 (from search snippet) — [pab1it0/prometheus-mcp-server](https://github.com/pab1it0/prometheus-mcp-server)

**VictoriaMetrics — `mcp-victoriametrics` (official org / community-sub-org)**
- Go server: query metrics, explore data, analyze alerting and recording rules, explore cardinality, debug relabeling and retention; Docker; public test endpoint — [VictoriaMetrics/mcp-victoriametrics](https://github.com/VictoriaMetrics/mcp-victoriametrics); [VictoriaMetrics AI tools docs](https://docs.victoriametrics.com/ai-tools/). Sources disagree on owner org (VictoriaMetrics vs VictoriaMetrics-Community) — [mcpservers.org listing](https://mcpservers.org/servers/VictoriaMetrics-Community/mcp-victoriametrics)

**ClickHouse / ClickStack (HyperDX)**
- `mcp-clickhouse` (official, open source) is a general SQL MCP server for ClickHouse — [ClickHouse blog: LLM observability with ClickStack](https://clickhouse.com/blog/llm-observability-clickstack-mcp)
- ClickStack MCP server (official): query logs/traces/metrics, manage dashboards and alerts, explore sources, saved searches; available for OSS, BYOC and ClickHouse Cloud; HyperDX v1 not supported; Cloud endpoint uses OAuth 2.0; vendor positions its tools as higher-level semantic observability tools (pattern trends, slow-trace inspection) rather than raw SQL — [ClickStack MCP docs](https://clickhouse.com/docs/clickstack/mcp); [Announcing managed ClickStack MCP](https://clickhouse.com/blog/announcing-managed-clickstack-mcp-server)

**SigNoz**
- Official `SigNoz/signoz-mcp-server` exists (search snippet only showed resource URIs such as dashboard and query-builder guides) — [SigNoz/signoz-mcp-server](https://github.com/SigNoz/signoz-mcp-server). Community DrDroidLab server exposes `fetch_services`, `execute_clickhouse_query` — [DrDroidLab/signoz-mcp-server](https://github.com/DrDroidLab/signoz-mcp-server)

**OpenObserve (official, native)**
- Native HTTP MCP endpoint `https://<instance>/api/{org_id}/mcp`; Basic auth; OAuth sign-in in Enterprise with Dex — [OpenObserve MCP docs](https://openobserve.ai/docs/integration/ai/mcp/); Claude Code setup page — [OpenObserve Claude Code](https://openobserve.ai/docs/integration/ai/mcp/claude/)
- Edition availability conflict: docs say OSS, Enterprise and Cloud; another OpenObserve post says Enterprise required — [OpenObserve MCP docs](https://openobserve.ai/docs/integration/ai/mcp/) vs [OpenObserve blog: MCP monitoring](https://openobserve.ai/blog/mcp-monitoring/). Community read-only servers: [mdfranz/openobserve-oss-mcp](https://github.com/mdfranz/openobserve-oss-mcp), [alilxxey/openobserve-community-mcp](https://github.com/alilxxey/openobserve-community-mcp)

**Arize Phoenix (official)**
- Remote MCP server built into the Phoenix server at `/mcp` (recommended, beta); `@arizeai/phoenix-mcp` npm stdio package is in maintenance mode (bug fixes only); covers projects, traces, spans, annotations, sessions, prompts, datasets, experiments; env `PHOENIX_API_KEY`, `PHOENIX_ENDPOINT` — [Phoenix MCP server docs](https://arize.com/docs/phoenix/integrations/phoenix-mcp-server); [@arizeai/phoenix-mcp reference](https://arize.com/docs/phoenix/sdk-api-reference/typescript/mcp-server)
- License listed inconsistently (ELv2 vs Apache-2.0) across directories — check repo LICENSE — [augmentcode listing](https://www.augmentcode.com/mcp/arize-phoenix-mcp-server)

**Langfuse (official)**
- Native hosted MCP, streamable HTTP at `https://cloud.langfuse.com/api/public/mcp` (regional + self-hosted variants), Basic Auth (public/secret key) — [Langfuse MCP server docs](https://langfuse.com/docs/api-and-data-platform/features/mcp-server)
- 2026-05-29 update added tools for observations, metrics, scores, datasets, comments, annotation queues — [Langfuse changelog 2026-05-29](https://langfuse.com/changelog/2026-05-29-mcp-update)
- Langfuse recommends its Agent Skill + CLI over MCP for agents that can run shell commands — [Langfuse MCP server docs](https://langfuse.com/docs/api-and-data-platform/features/mcp-server). Old `langfuse/mcp-server-langfuse` is prompt-management-only and superseded — [Langfuse changelog 2025-11-20](https://langfuse.com/changelog/2025-11-20-native-mcp-server). Community: [avivsinai/langfuse-mcp](https://github.com/avivsinai/langfuse-mcp)

**Honeycomb (official, hosted)**
- Hosted MCP: query traces/metrics/logs, BubbleUp, Triggers, SLOs, Boards — [Honeycomb MCP docs](https://docs.honeycomb.io/integrations/mcp); concepts — [Honeycomb MCP concepts](https://docs.honeycomb.io/integrations/mcp/concepts)
- Endpoint `https://mcp.honeycomb.io/mcp` (EU `mcp.eu1.honeycomb.io/mcp`), streamable HTTP, OAuth or a shared Management API key; requires Honeycomb Intelligence enabled on the team (third-party sources) — [MintMCP Honeycomb setup](https://www.mintmcp.com/docs/honeycomb-mcp-setup); [mcpservers.org](https://mcpservers.org/remote-mcp-servers/honeycomb)

**Datadog (official, hosted)**
- Remote MCP server; forwards the user's credentials so existing RBAC applies; tools mostly query Datadog backends directly (e.g. `search_datadog_logs`), a few call Datadog-hosted models; **responses truncated by estimated length with instructions to fetch more; most tools take `max_tokens`; `toolsets` and `omit_tools` limit tools at connect time**; fair use 50 req/10 s burst and 100,000 tool calls/month; calls recorded in Audit Trail; usage metrics `datadog.mcp.session.starts`, `datadog.mcp.tool.usage`; page says "under significant development"; not GovCloud — [Datadog MCP server docs](https://docs.datadoghq.com/bits_ai/mcp_server/)
- GA reported around 2026-03-09/10 (sources disagree by a day) and only core toolset loads by default; regional endpoints such as `mcp.datadoghq.com` (third-party) — [StockTitan press summary](https://www.stocktitan.net/news/DDOG/datadog-launches-mcp-server-to-provide-ai-agents-with-secure-real-cy89xwmx6vyr.html); [MCP.Directory guide](https://mcp.directory/blog/datadog-mcp-complete-guide-2026)

**Sentry (official)**
- Hosted `mcp.sentry.dev/mcp` with OAuth login; or local stdio `npx @sentry/mcp-server@latest --access-token=... --host=...`; self-hosted Sentry must use stdio + access token (cloud endpoint and device-code OAuth are sentry.io only); Seer-dependent features may be absent on self-hosted (`--disable-skills=seer`); AI-search tools need an LLM provider configured; `--insecure-http` for plain-HTTP internal hosts — [Sentry MCP docs](https://docs.sentry.io/product/sentry-mcp/); [mcpservers.org getsentry/sentry-mcp](https://mcpservers.org/servers/getsentry/sentry-mcp)
- Token scopes differ between official docs and an older README mirror (event:write vs event:read) — [Sentry MCP docs](https://docs.sentry.io/product/sentry-mcp/)

**Axiom (official, hosted)**
- Remote `https://mcp.axiom.co/mcp`, OAuth recommended; tools for APL queries, dataset/metrics exploration, dashboards, monitors, notifiers, plus prebuilt prompts; remote query results routed through US infrastructure — [Axiom MCP docs](https://axiom.co/docs/console/intelligence/mcp-server); [axiomhq/mcp](https://github.com/axiomhq/mcp); [Axiom changelog: remote MCP](https://axiom.co/changelog/remote-mcp-server)

**Dash0 (official, hosted)**
- Cloud-hosted, streamable HTTP, no local process; troubleshooting across metrics/logs/traces, dashboards and alert-rule management — [Dash0 MCP integration](https://www.dash0.com/hub/integrations/int_dash0_mcp/overview)

**Netdata (official, two paths)**
- Agent/Parent MCP built into Netdata (no install), local, read-only, API key needed for sensitive functions (logs, live data) — [Netdata MCP docs](https://learn.netdata.cloud/docs/netdata-ai/mcp); [netdata src/web/mcp README](https://github.com/netdata/netdata/blob/master/src/web/mcp/README.md)
- Cloud MCP at `app.netdata.cloud/api/v1/mcp`, paid plan, Cloud API token with MCP scope (one source says OAuth flow) — [Netdata Cloud MCP blog](https://www.netdata.cloud/blog/netdata-cloud-mcp-server/)
- Tailnet fit (inference): the agent-embedded MCP on each host is the most direct "host view over tailnet" option found.

**Tailscale (no official MCP)**
- Community only: read-only CLI wrapper [paulsmith/tailscale-mcp-server](https://github.com/paulsmith/tailscale-mcp-server); local-daemon server (discovery, SSH config, Serve/Funnel, latency matrices) [TMHSDigital/tailscale-mcp](https://github.com/TMHSDigital/tailscale-mcp); admin-API servers [HexSleeves/tailscale-mcp](https://github.com/HexSleeves/tailscale-mcp), [YawLabs/tailscale-mcp](https://github.com/YawLabs/tailscale-mcp), [sandraschi/tailscale-mcp](https://github.com/sandraschi/tailscale-mcp), [pnocera/tailscale-mcp-server](https://github.com/pnocera/tailscale-mcp-server)

**Multi-backend trace MCP**
- `traceloop/opentelemetry-mcp-server` (community): one MCP server over Jaeger, Tempo, Traceloop; `BACKEND_TYPE`, `BACKEND_URL` — [traceloop/opentelemetry-mcp-server](https://github.com/traceloop/opentelemetry-mcp-server). A third-party issue reports it calls `/api/traces` which Jaeger v2 only serves under `/api/v3` (unverified) — [briancaffey/hermes-otel #303](https://github.com/briancaffey/hermes-otel/issues/303)

### Inferences
- For a repo-owned "one pane" over a self-hosted LGTM/VictoriaMetrics/ClickHouse stack, the official self-hostable servers (mcp-grafana, Tempo `/api/mcp`, Netdata agent MCP) can be *backends* behind a repo gateway; their per-request auth (bearer/service-account) works headless, unlike OAuth-only SaaS endpoints.
- Datadog's `max_tokens` + truncation-with-instructions and `toolsets`/`omit_tools`, and Grafana's `--disable-*`/summary tools, are the clearest vendor precedents for context budgeting.

### Gaps
- Exact tool lists for SigNoz official server, Dash0, Honeycomb, Netdata MCP and VictoriaMetrics were not retrieved from primary README/tool pages.
- `grafana/loki-mcp` README not fetched; its tool set is from aggregators.
- Whether Honeycomb/Axiom/Dash0 accept static API keys for fully headless (no-browser) MCP auth was only partially confirmed (Honeycomb: Management API key per MintMCP).
- Latest release versions/dates for most servers not collected.

## Q2. Which CLIs are agent-friendly (JSON output, no TTY)?

### Takeaway
Grafana's new **gcx** CLI is the clearest "built for agents" observability CLI (JSON/YAML output, structured errors, agent-mode auto-detect); `grafanactl` is deprecated in its favour. Tailscale exposes client metrics in Prometheus text format via `tailscale metrics print` and over the tailnet at `100.100.100.100/metrics`. Beszel has a PocketBase REST API requiring a bearer token. Several staples (promtool, logcli, journalctl, docker stats) were not re-verified in this session.

### Cited Findings
- `gcx` (official, GA 2026-07-28): "every command returns clean JSON or YAML, with structured errors and predictable exit codes"; agent mode auto-detected for Claude Code, Copilot, Cursor; `-o json|yaml`; requires Grafana Cloud or Grafana OSS/Enterprise v12+ — [Grafana: gcx GA](https://grafana.com/whats-new/2026-07-28-gcx--the-cli-for-you-and-your-ai-agents--now-generally-available/); [gcx overview](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/grafana-cli/gcx/overview/); [grafana/gcx](https://github.com/grafana/grafanactl-experiments)
- `grafanactl` deprecated; repo archived 2026-06-01; Homebrew disable date 2027-01-17 pointing to gcx; migration mostly rename — [gcx overview](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/grafana-cli/gcx/overview/); [Homebrew grafanactl](https://formulae.brew.sh/formula/grafanactl); [gcx→grafanactl consolidation epic](https://github.com/grafana/gcx/issues/65)
- `tailscale metrics print` (since v1.78.0) prints client metrics in Prometheus text format; `tailscale metrics write` writes them to a file for node_exporter textfile collector; metrics also served at `http://100.100.100.100/metrics` — [Tailscale client metrics](https://tailscale.com/kb/1482/client-metrics); [Tailscale blog: client metrics](https://tailscale.com/blog/client-metrics)
- `otel-cli` (equinix-labs, Go, 0.4.5 stable on Homebrew): send spans from shell scripts; gRPC default, bare host:port; no http/json — [equinix-labs/otel-cli](https://github.com/equinix-labs/otel-cli); [Homebrew otel-cli](https://formulae.brew.sh/formula/otel-cli). Other unrelated projects share the name (Node, Python) — [serkan-ozal/otel-cli](https://github.com/serkan-ozal/otel-cli); [PyPI otel-cli](https://pypi.org/project/otel-cli/)
- Beszel REST API is PocketBase-based; no anonymous access; authenticate (e.g. `_superusers` `auth-with-password`) to get a bearer token; 0.21.0 released 2026-10-02 (third-party) — [Beszel discussion #1241](https://github.com/henrygd/beszel/discussions/1241); [Korben: Beszel 0.21.0](https://korben.info/en/download/beszel-monitor-servers-containers-alerts-rest-api/)
- Langfuse documents a CLI + Agent Skill path preferred over MCP for shell-capable agents — [Langfuse MCP docs](https://langfuse.com/docs/api-and-data-platform/features/mcp-server)
- Codex config: local state under `CODEX_HOME` (`history.jsonl` if persistence enabled; `[history] persistence = "none"`, `history.max_bytes`) — [Codex advanced config](https://learn.chatgpt.com/docs/config-file/config-advanced)

### Inferences
- A repo CLI should mirror gcx's contract: `-o json`, structured error objects, exit-code taxonomy, and agent-mode detection (e.g. via `CLAUDECODE`/agent env) that defaults to compact output.
- Tailscale's `100.100.100.100/metrics` is a zero-auth, per-node Prometheus endpoint an agent or collector can scrape on any tailnet host.

### Gaps (not verified this session — confirm before citing)
- `promtool query instant/range` JSON output flags; `logcli --output=jsonl|raw` and `--limit`; `tempo-cli` query subcommands; `journalctl -o json`/`json-seq`/`--since`/`-n`; `systemctl show --property=... ` / `systemctl list-units --output=json`; `docker stats --no-stream --format json`; Netdata `/api/v2/data` JSON parameters; Phoenix CLI (`px`) existence and output format. These are believed agent-friendly from prior knowledge but no source was fetched; reference docs: journalctl man page https://www.freedesktop.org/software/systemd/man/latest/journalctl.html, logcli docs https://grafana.com/docs/loki/latest/query/logcli/, docker stats https://docs.docker.com/reference/cli/docker/container/stats/.

## Q3. Local dev loop: which viewers can an agent drive headlessly / which expose an HTTP API an MCP server could wrap?

### Takeaway
**grafana/docker-otel-lgtm** is the most agent-ready local backend: one container (Collector, Prometheus, Tempo, Loki, Pyroscope, Grafana) with Tempo's MCP endpoint toggled by env var and mcp-grafana pointed at it. **otel-desktop-viewer** has a JSON-RPC API (`POST /rpc`) over DuckDB that an MCP server could wrap. **otel-tui** is human-only (no API). **Jaeger v2** has a query API (`/api/v3`) and an MCP direction but no confirmed shipped first-party MCP server. Effect DevTools is a socket protocol (unstable in v4), not a query API.

### Cited Findings
- docker-otel-lgtm bundles OTel Collector, Prometheus, Tempo, Loki, Pyroscope, Grafana; dev-only, not production; Tempo MCP enabled with `TEMPO_EXTRA_ARGS=--query-frontend.mcp-server.enabled=true`; generated MCP config readable from container; also usable with `uvx mcp-grafana` — [grafana/docker-otel-lgtm](https://github.com/grafana/docker-otel-lgtm); [Grafana docs: Docker OTel LGTM](https://grafana.com/docs/opentelemetry/docker-lgtm/); [issue #1091 enable MCP for tempo](https://github.com/grafana/docker-otel-lgtm/issues/1091)
- otel-desktop-viewer: Collector + DuckDB + Svelte; JSON-RPC at `POST /rpc` sharing the UI port (default 8000); PR #578 renamed RPC methods and changed schema; PR #587 added `/export/{signal}/{id}` OTLP downloads — [CtrlSpice/otel-desktop-viewer](https://github.com/CtrlSpice/otel-desktop-viewer); [PR #578](https://github.com/CtrlSpice/otel-desktop-viewer/pull/578); [PR #587](https://github.com/CtrlSpice/otel-desktop-viewer/pull/587); [Rebuilt on DuckDB](https://ctrlspice.codes/rebuilding-otel-desktop-viewer/)
- stivio00/otel-viewer (community): OTLP/gRPC → DuckDB with REST `GET /api/traces`, `GET /api/logs`, `POST /api/query` (read-only SQL) — [stivio00/otel-viewer](https://github.com/stivio00/otel-viewer)
- otel-tui: terminal viewer inspired by otel-desktop-viewer; OTLP 4317/4318, Zipkin, Prometheus, Datadog formats; Apache-2.0; no MCP/API found — [ymtdzzz/otel-tui](https://github.com/ymtdzzz/otel-tui)
- teley: open-source local trace viewer whose CLI serves traces to coding agents over MCP (from search summary) — [logaretm/teley](https://github.com/logaretm/teley)
- Jaeger v2 rebuilt on the OTel Collector; v1 EOL 2025-12-31; CNCF post describes a "Jaeger MCP" component plus an Agent Gateway as direction for tracing AI agents — [CNCF: How Jaeger is evolving to trace AI agents (2026-05-26)](https://www.cncf.io/blog/2026/05/26/how-jaeger-is-evolving-to-trace-ai-agents-with-opentelemetry/); [The New Stack](https://thenewstack.io/jaeger-v2-ai-observability/). Community `serkan-ozal/jaeger-mcp-server` (get-services, get-operations, get-trace) — [serkan-ozal/jaeger-mcp-server](https://github.com/serkan-ozal/jaeger-mcp-server)
- Effect: v3-era `DevTools.layerWebSocket()` from `@effect/experimental` + VS Code extension "Start the server" — [Effect-TS/vscode-extension](https://github.com/Effect-TS/vscode-extension); v4 has `effect/devtools` `DevToolsServer` that accepts clients over a SocketServer with newline-delimited JSON (unstable protocol, may break in minors) — [Effect v4 DevToolsServer API](https://effect.website/docs/v4/api/effect/devtools/DevToolsServer)

### Inferences
- A repo dev loop can standardize on docker-otel-lgtm (or the user's own LGTM stack) as the OTLP sink so the *same* MCP/CLI surface works locally and on remote boxes; otel-desktop-viewer's DuckDB/JSON-RPC is a lighter alternative to wrap.
- Effect v4's `DevToolsServer` could be the hook for a repo-owned collector that turns Effect fiber/span stream into OTLP or into a queryable buffer — but the protocol is unstable, so pin to a version.

### Gaps
- Jaeger v2 first-party MCP status (shipped vs planned) not confirmed from Jaeger docs.
- otel-desktop-viewer JSON-RPC method names not retrieved.
- Port 34437 / default port for Effect DevTools not confirmed.

## Q4. Agent-harness telemetry: Claude Code, Codex CLI, GenAI semconv, MCP protocol logging/tracing

### Takeaway
Claude Code has the richest native exporter: OTLP metrics + log events + **beta traces** (`claude_code.interaction → llm_request / tool / hook / subagent`), opt-in content flags, `TRACEPARENT` injection into Bash subprocesses, and inbound `TRACEPARENT` in `-p`/SDK sessions. Codex CLI exports OTel log events (and metrics/traces per vendor guides) configured only in user `~/.codex/config.toml` `[otel]`. OTel **GenAI semconv moved to a separate repo** (`open-telemetry/semantic-conventions-genai`) and remains **Development** status, including agent spans and MCP conventions. MCP spec has a `logging` capability (`notifications/message`), and **SEP-414 (Final)** reserves unprefixed `_meta.traceparent/tracestate/baggage` for W3C trace context.

### Cited Findings

**Claude Code (official)**
- Enable: `CLAUDE_CODE_ENABLE_TELEMETRY=1`; `OTEL_METRICS_EXPORTER` (console/otlp/prometheus/none), `OTEL_LOGS_EXPORTER`, `OTEL_TRACES_EXPORTER` (beta); `OTEL_EXPORTER_OTLP_PROTOCOL` has no default (grpc/http/json/http/protobuf); per-signal endpoint/header overrides; export intervals metrics 60 s, logs 5 s, traces 5 s; temporality default delta — [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- Metrics: `claude_code.session.count`, `lines_of_code.count`, `pull_request.count`, `commit.count`, `cost.usage` (USD; attrs model, query_source, speed, effort, agent.name, skill.name, plugin.name, mcp_server.name, mcp_tool.name), `token.usage` (input/output/cacheRead/cacheCreation), `code_edit_tool.decision`, `active_time.total` — [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- Events (`claude_code.*`): user_prompt, assistant_response, tool_result (tool_name, success, duration_ms, input/result size bytes), api_request (model, cost_usd, tokens, duration), api_error, api_refusal, api_request_body/api_response_body, tool_decision, permission_mode_changed, auth, mcp_server_connection, internal_error, plugin_installed, plugin_loaded, skill_activated; correlation attrs prompt.id, event.sequence, request_id — [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- Content flags (all off by default): `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES`, `OTEL_LOG_TOOL_DETAILS`, `OTEL_LOG_TOOL_CONTENT` (needs tracing), `OTEL_LOG_RAW_API_BODIES` (`1` inline or `file:<dir>`; includes full conversation history), `OTEL_LOG_MANAGED_SETTINGS`; `CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH` default 61440 — [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- Cardinality toggles: `OTEL_METRICS_INCLUDE_SESSION_ID` (true), `_VERSION` (false), `_ACCOUNT_UUID` (true), `_ENTRYPOINT` (false), `_RESOURCE_ATTRIBUTES` (true), `_REPOSITORY` (false; vcs.* attrs, v2.1.269+); `OTEL_RESOURCE_ATTRIBUTES` for custom tags (no spaces) — [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- Standard attrs include session.id, user.id, user.email, organization.id, terminal.type, app.entrypoint; events add workspace.host_paths, workflow.run_id, workflow.name — [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- Traces (beta): require `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` + `OTEL_TRACES_EXPORTER=otlp`; spans `claude_code.interaction` → `llm_request`, `hook`, `tool` (→ `tool.blocked_on_user`, `tool.execution`, subagent spans); Bash/PowerShell subprocesses inherit `TRACEPARENT`; `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1` to send traceparent through a custom `ANTHROPIC_BASE_URL` proxy; `-p`/SDK sessions read inbound `TRACEPARENT` — [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- `otelHeadersHelper` script for rotating OTLP auth headers (every 29 min default; http protocols only; failures silently drop exports) — [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- Admin gotchas: OTEL exporter vars in repo `.claude/settings.json`/`settings.local.json` are **ignored** (must be managed/user settings or env); Claude Code does **not** pass `OTEL_*` to Bash tool, hooks, or MCP servers — [Claude Code monitoring](https://code.claude.com/docs/en/monitoring-usage)
- Client caps MCP tool output at 25,000 tokens by default, adjustable via `MAX_MCP_OUTPUT_TOKENS` (third-party source) — [Sume blog](https://www.sume.com/blog/mcp-tool-exceeds-maximum-allowed-tokens)
- User-filed issue: Claude/Cowork does not put trace context in MCP `_meta`; only a per-request HTTP `traceparent` header not matching the session trace id (unofficial report) — [claudeissues.com #76391](https://claudeissues.com/issue/76391-feature-propagate-cowork-claude-session-trace-context-prompt-id-into-mcp-tool-ca)

**Codex CLI (official)**
- `[otel]` in `~/.codex/config.toml` only (ignored in project `.codex/config.toml`); keys `environment` (default "dev"), `exporter` (default "none"; or `otlp-http {endpoint, protocol="binary", headers}` / `otlp-grpc {endpoint, headers}`), `log_user_prompt` (default false); batched async, flush on shutdown — [Codex advanced config](https://learn.chatgpt.com/docs/config-file/config-advanced)
- Events: `codex.conversation_starts`, `codex.api_request`, `codex.sse_event` (token counts on response.completed), `codex.websocket_request`/`websocket_event`, `codex.user_prompt`, `codex.tool_decision`, `codex.tool_result` (duration, success, output snippet); metadata includes conversation id, model, sandbox/approval policy — [Codex advanced config](https://learn.chatgpt.com/docs/config-file/config-advanced)
- Metrics: `codex.api_request(.duration_ms)`, `codex.sse_event(.duration_ms)`, `codex.websocket.request/event(.duration_ms)`, `codex.tool.call(.duration_ms)`; default tags auth_mode, originator, session_source, model, app.version; `[analytics] enabled = false` also disables custom OTLP metrics exporters — [Codex advanced config](https://learn.chatgpt.com/docs/config-file/config-advanced)
- Vendor guides document `trace_exporter` / `metrics_exporter` keys (syntax varies; official page doesn't list them); without `metrics_exporter` metrics go to OpenAI's analytics; only managed defaults can carry an admin `[otel]` block — [Coralogix Codex CLI](https://coralogix.com/docs/integrations/ai-observability/codex-cli/); [Daniel Vaughan: Codex OTel tracing](https://codex.danielvaughan.com/2026/04/16/codex-cli-opentelemetry-observability-tracing-agent-sessions/)

**OpenTelemetry GenAI semantic conventions (experimental / Development)**
- GenAI conventions moved out of the main semconv repo to `open-telemetry/semantic-conventions-genai` (spans, metrics, events for GenAI clients, MCP, provider-specific); old opentelemetry.io page now says "Moved"; schema URL still TODO; no releases yet — [opentelemetry.io GenAI page](https://opentelemetry.io/docs/specs/semconv/gen-ai/); [semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai)
- Agent spans doc: status Development; operations `create_agent`, `invoke_agent`, `invoke_workflow`, `execute_tool`, `plan`, `chat`, `embeddings`, `retrieval`, memory ops (`create_memory`, `search_memory`, `upsert_memory`); `create_agent {gen_ai.agent.name}` CLIENT span; required `gen_ai.operation.name`, `gen_ai.provider.name`; conditional `gen_ai.agent.id/name/description/version`, `gen_ai.request.model`; `gen_ai.system_instructions` opt-in content — [GenAI agent spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md)
- MCP semconv: Development; span name `{mcp.method.name} {target}`; CLIENT/SERVER kinds; attrs `mcp.method.name` (required), `mcp.session.id`, `mcp.protocol.version`, `jsonrpc.request.id`, `gen_ai.tool.name`, `gen_ai.operation.name=execute_tool`, `network.transport` (`pipe` for stdio); opt-in `gen_ai.tool.call.arguments`/`.result`; metrics `mcp.client.operation.duration`, `mcp.server.operation.duration`, `mcp.client.session.duration`, `mcp.server.session.duration`; clients inject W3C context into `params._meta` — [GenAI MCP conventions](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/mcp.md)

**MCP protocol**
- Logging utility (spec 2025-11-25): servers declare `capabilities.logging`; client `logging/setLevel`; server `notifications/message {level, logger, data}`; RFC 5424 levels debug→emergency; SHOULD rate-limit; MUST NOT include secrets/PII — [MCP spec: logging](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/logging)
- SEP-414 (Final, Standards Track; Adrian Cole, sponsor Marcelo Trylesinski): `_meta` keys `traceparent`, `tracestate`, `baggage` unprefixed W3C values, explicit exception to reverse-DNS prefix rule; linked to SEP-2028 and ACP PR #297 — [SEP-414](https://modelcontextprotocol.io/seps/414-request-meta)
- `mcp-otel` npm describes SEP-414 as part of the 2026-07-28 release candidate; Strands Agents injects/extracts `_meta` context and notes mcp Python 2.x propagates natively; Ruby SDK passes keys through untouched — [mcp-otel (Socket)](https://socket.dev/npm/package/mcp-otel); [Strands MCP instrumentation](https://strandsagents.com/docs/api/python/strands.tools.mcp.mcp_instrumentation/index.md); [Ruby MCP::TraceContext](https://rubydoc.info/gems/mcp/MCP/TraceContext)

### Inferences
- A repo observability MCP server should (1) emit OTel MCP-semconv SERVER spans, (2) extract `_meta.traceparent` and fall back to HTTP header, and (3) because Claude Code strips `OTEL_*` from MCP children, carry its own exporter config (e.g. a repo config file or its own env prefix).
- Claude Code's `TRACEPARENT`-into-Bash means a repo CLI invoked from Bash can nest its spans under the agent's tool span for free if it honours `TRACEPARENT` — a strong argument for the CLI path.
- Codex and Claude telemetry use different names (`codex.*` vs `claude_code.*`) and neither is documented as emitting `gen_ai.*` semconv; a collector-side transform to GenAI semconv would be needed for a unified "agent sessions" view.

### Gaps
- Cursor and Grok CLI native telemetry/OTel export: not researched (no sources found in budget).
- Whether Claude Code trace spans use `gen_ai.*` attributes: not stated on the page read.
- Codex `trace_exporter`/`metrics_exporter` official syntax not in the official page fetched.
- MCP progress notifications / tasks utility details not fetched.
- `OTEL_SEMCONV_STABILITY_OPT_IN` values for GenAI not retrieved.

## Q5. Patterns for context-economical agent access (summary cards, bounded windows, row caps, pre-canned vs raw queries) and projects doing it well

### Takeaway
The best documented practice is Axiom's: CSV over JSON, a global **cell budget** with summary tables prioritised, explicit "Showing N of M rows" receipts, heuristic column selection, caps pushed into the query, ~15 time bins, narrow default windows, and a minimal core toolset with fidelity knobs in the server URL. Datadog (`max_tokens`, truncation with continuation instructions, `toolsets`/`omit_tools`), Grafana (summary/JSONPath tools, category flags, Loki limit 100 + byte/time guardrails), ClickStack (semantic tools rather than raw SQL) and Block's playbook (tool enforces its own budget; error/truncate/paginate) reinforce the same shape.

### Cited Findings
- Axiom (Neil Jagdish Patel, 2025-10-07): CSV 166 vs JSON 235 tokens for 5 log rows (~29% fewer); global max-cell budget, summaries/totals first; "Showing 100 of 2,340 rows" notes; column scoring (priority fields timestamp/service/status/trace id, fill rate, variety, short names); LIMIT in the query; `maxBinAutoGroups` ~15 bins (3-field histogram: 874 JSON tokens at 100 bins vs 127 at 15); default last-hour windows ("start small, expand on demand"); minimal default toolset; URL params `max_cells`, `tools=core,otel`; proposes MCP budget hints, paging hints, provenance blocks listing caps applied — [Axiom: Designing MCP servers for wide schemas](https://axiom.co/blog/designing-mcp-servers-for-wide-events)
- Datadog: estimated-length truncation with "how to request more"; `max_tokens` per tool; `toolsets`, `omit_tools` — [Datadog MCP docs](https://docs.datadoghq.com/bits_ai/mcp_server/)
- Grafana: summary + JSONPath tools vs full JSON; per-category disable; read-only; Loki log limit default 100 with byte-budget and time-range guardrails — [grafana/mcp-grafana](https://github.com/grafana/mcp-grafana)
- ClickStack positions higher-level semantic tools (pattern trends, slow traces) over raw SQL — [ClickStack MCP docs](https://clickhouse.com/docs/clickstack/mcp)
- Block's MCP playbook: tool author guards overflow by measuring bytes/tokens; options are actionable error, truncation with note, or pagination; actionable errors beat prompt instructions — [Block: Playbook for designing MCP servers](https://engineering.block.xyz/blog/blocks-playbook-for-designing-mcp-servers)
- Output contract checklist: per-route max bytes/records, schema shape, summary rule, exact truncation receipt; tag result kind (raw / extracted / lossy summary / sampled preview); record bytes returned and where the full result lives — [DEV: MCP Tool Output Budget Checklist](https://dev.to/supertrained/mcp-tool-output-budget-checklist-47c1)
- Spill large payloads to disk and return a handle; native `max_results`/`per_page` plus hard proxy ceiling; don't rely on the client to cap — [Plain English: reduce MCP response sizes](https://plainenglish.io/artificial-intelligence/how-to-reduce-mcp-response-sizes-for-llm-context-limits-e5hrr7)
- Keep ~10–15 tools exposed at once to limit schema overhead (opinion) — [The New Stack: reduce MCP token bloat](https://thenewstack.io/how-to-reduce-mcp-token-bloat/)
- Langfuse recommends skill + CLI over MCP for shell-capable agents (MCP only where shell is unavailable) — [Langfuse MCP docs](https://langfuse.com/docs/api-and-data-platform/features/mcp-server)
- Phoenix moved new capability to the server-embedded remote MCP, freezing the stdio package — [Phoenix MCP docs](https://arize.com/docs/phoenix/integrations/phoenix-mcp-server)

### Inferences (design patterns for a repo-owned observability MCP + CLI)
- **Two-tier surface**: a small core toolset of pre-canned "summary card" tools (e.g. `host_health(host)`, `service_status(service, window=15m)`, `ci_run_summary(run)`, `agent_sessions(active)`, `recent_errors(service, window, top=10)`) returning fixed-shape cards; raw PromQL/LogQL/TraceQL/SQL behind an opt-in toolset with hard caps (mirrors Datadog toolsets, Axiom `tools=`, Grafana `--enabled-tools`).
- **Budget contract on every response**: `{kind: card|table|sample|raw, window, rows_shown, rows_total, caps_applied, next_cursor, full_result_ref}` — combining Axiom provenance blocks, Datadog continuation hints, and the checklist's truncation receipt; CSV/TSV for tables.
- **Defaults**: last 15–60 min window, ≤~15 time bins, ≤100 rows/cells budget, top-N columns by priority list; agent widens explicitly.
- **Federation, not reimplementation**: the repo server fronts self-hosted official servers/APIs (mcp-grafana / Tempo `/api/mcp` / Netdata agent MCP / VictoriaMetrics / Tailscale `100.100.100.100/metrics`) over the tailnet with static tokens from 1Password, so cloud VMs and CI runners get the same pane; OAuth-only SaaS servers stay optional.
- **CLI first for shell-capable agents**: same queries as a gcx-style CLI (`-o json`, structured errors, exit codes, honours `TRACEPARENT`), so Claude Code Bash calls nest under the agent's trace and avoid MCP schema overhead; MCP for non-shell clients.
- **Self-telemetry**: the server emits MCP-semconv spans and extracts `_meta.traceparent` (SEP-414), with its own exporter config since Claude Code does not forward `OTEL_*` to MCP children.
- **Agent sessions as a data source**: ingest Claude Code (`claude_code.*`) and Codex (`codex.*`) OTLP into the same backend and expose an `agent_sessions` card (cost, tokens, tool error rate, active session ids) — normalisation to `gen_ai.*` happens in the collector.

### Gaps
- No primary source found for a project explicitly offering "summary card" tools for host/CI health; the pattern is inferred from Axiom/Datadog/Grafana behaviours.
- No quantitative benchmark beyond Axiom's own token counts; third-party "70% reduction" claims were not verified.
- CI observability MCP specifically (GitHub Actions run/job telemetry into an agent) was not researched.
