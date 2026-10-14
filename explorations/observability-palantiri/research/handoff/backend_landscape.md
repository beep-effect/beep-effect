# Observability backend landscape 2026 (single operator + many AI agents, OTLP-native, LLM traces)

Research date: 2026-10-14. 15 tool calls (searches plus fetches). Most snippets are from vendor or vendor-adjacent blogs; primary sources are marked where used. Items not verified in this pass are under Gaps, not presented as fact.

## Grafana LGTM: docker-otel-lgtm, Alloy, Grafana MCP, pain points

### Takeaway
docker-otel-lgtm is still a single-container dev/demo/test image: OTel Collector, Prometheus, Tempo, Loki, Pyroscope and Grafana, with optional OBI eBPF auto-instrumentation. It does not include Alloy or Mimir, and Grafana Labs steers production users to Grafana Cloud. The Grafana MCP story is mature in 2026: the OSS `grafana/mcp-grafana` (Apache-2.0, 40+ tools) plus a managed Grafana Cloud MCP endpoint since 2026-07-28. Grafana 13 shipped in late April 2026 with a redesigned Loki architecture.

### Cited Findings
- docker-otel-lgtm bundles the OpenTelemetry Collector, Prometheus (metrics), Tempo (traces), Loki (logs), Pyroscope (profiles) and Grafana in one container. The README does not mention Mimir or Alloy. — [grafana/docker-otel-lgtm README](https://github.com/grafana/docker-otel-lgtm)
- The README calls the image "intended for development, demo, and testing environments" and points production users to Grafana Cloud Application Observability. — [grafana/docker-otel-lgtm](https://github.com/grafana/docker-otel-lgtm)
- Ports: Grafana on 3000 and OTLP/HTTP on 4318. The k8s port-forward lists 3000, 3200 (Tempo), 4040 (Pyroscope), 4317, 4318 and 9090. Mount a volume at `/data` for persistence. Memory: the run script defaults to 2G (`LGTM_CONTAINER_MEMORY` overrides it), and Apple Container's 1G default is called insufficient. The verification examples reference version 0.29.0. — [grafana/docker-otel-lgtm](https://github.com/grafana/docker-otel-lgtm)
- Optional OBI (eBPF) with `ENABLE_OBI=true` generates traces and RED metrics for HTTP/gRPC with no code changes. It needs Linux 5.8+ with BTF plus `--privileged --pid=host`. — [grafana/docker-otel-lgtm](https://github.com/grafana/docker-otel-lgtm)
- The README links a migration note for users "upgrading from the generated MCP setup" and a `gcx` integration that runs on the host without a Grafana Cloud account. This suggests the repo once generated an MCP config and moved to gcx. — [grafana/docker-otel-lgtm](https://github.com/grafana/docker-otel-lgtm)
- Grafana MCP (OSS): `grafana/mcp-grafana` v0.14.0 shipped 2026-05-08 with 40+ tools across 19 categories, adding an OpenSearch datasource and a generic Grafana API request tool. v0.12.1 through v0.14.0 landed in four weeks. Apache-2.0, maintained by Grafana Labs. (Secondhand review; not checked against GitHub releases.) — [ChatForest review](https://chatforest.com/reviews/grafana-mcp-server/)
- Grafana Cloud MCP server, a managed single-URL MCP endpoint, was announced 2026-07-28 as separate from the self-hosted OSS server. — [Grafana What's New 2026-07-28](https://grafana.com/whats-new/2026-07-28-cloud-mcp-server--connect-your-agents-to-grafana-cloud-with-a-single-url/)
- Grafana 13 launched late April 2026 (GrafanaCON 2026). It focuses on dashboarding updates, a **redesigned Grafana Loki architecture** for log workloads, and OTel deployment work for Linux/K8s. Grafana Labs also acquired Logline, a large-scale log search startup. — [IT Brief](https://itbrief.news/story/grafana-labs-launches-grafana-13-with-observability-updates); [Grafana author page / GrafanaCON2026 recap](https://grafana.com/author/adrian_stoewer/)
- Tempo docs list **v3.0.x** as the current release line, with separate v3.0 release notes. The date and contents were not extracted. Grafana also has a blog post on "dedicated attribute columns" to speed up TraceQL at scale. — [Tempo v3.0.x release notes index](https://grafana.com/docs/tempo/v3.0.x/release-notes/); [search snippet](https://grafana.com/author/adrian_stoewer/)
- Grafana's self-hosted components (Grafana, Loki, Tempo, Mimir) are AGPLv3. — [cubeapm via search](https://cubeapm.com/blog/self-hosted-signoz-alternatives/) (secondary; consistent with long-standing Grafana licensing)
- Grafana's current "observability as code" docs name **gcx** (not `grafanactl`) alongside Git Sync and the Foundation SDK, all built on the new app-platform APIs. The Grafana 12 announcement introduced `grafanactl`. — [Grafana Observability as code docs](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/); [Grafana 12 blog](https://grafana.com/blog/observability-as-code-grafana-12/)

### Inferences
- For shape (b), docker-otel-lgtm adds nothing: the box already runs Prometheus 3.x, Grafana 13.x and an OTel Collector. Adding Loki and Tempo as separate containers, or switching to Victoria* (below), is the natural path. docker-otel-lgtm stays a good laptop (shape a) option because it is one `docker run` with OTLP on 4317/4318.
- The Loki redesign in Grafana 13 and the Logline acquisition are Grafana's response to Loki's long-standing weakness: label-indexed logs with poor high-cardinality, full-text and attribute search. That critique comes from prior knowledge and was not re-verified in 2026. Until the new architecture ships in the OSS Loki you would run, high-cardinality OTel resource attributes (for example `session.id`, `agent.run_id`) should stay structured metadata, not labels.

### Gaps
- The Loki version shipped with the redesign (a "Loki 4") and whether it is in OSS or Cloud-only: not found.
- Tempo 3.0 release date and TraceQL changes (metrics-from-traces GA status, structural operators): the release-notes page fetch returned only an index.
- Alloy 2026 version and any Alloy-specific changes: not found. Prior knowledge (unverified this pass) is that Alloy is Grafana's OTel Collector distribution that replaced Grafana Agent, which reached EOL in late 2025.
- Whether gcx is a rename of grafanactl or a separate tool: unresolved.
- The exact Grafana 13 OSS version number and date.

## ClickHouse-based stacks: SigNoz, ClickStack/HyperDX, OpenObserve, Uptrace

### Takeaway
SigNoz and ClickStack both ship first-party MCP servers in 2026 and both need roughly 4 GB minimum and 8 GB realistic for ClickHouse. OpenObserve is far lighter (about 300 to 650 MB measured) and has an official MCP server, but its traces and metrics are less mature. Langfuse was acquired by ClickHouse in January 2026, so ClickHouse now owns both a general OTel stack (ClickStack) and an LLM-trace specialist. Uptrace has the thinnest 2026 data.

### Cited Findings
- **SigNoz MCP server** launched with the v0.121.1 changelog on 2026-05-01. It covers logs, metrics, traces, alerts and dashboards for Cursor, VS Code/Copilot, Claude, Codex, Gemini and other clients. SigNoz Cloud has a hosted, region-specific endpoint. Self-hosters run it as a binary or in Docker. — [SigNoz changelog 2026-05-01](https://signoz.io/changelog/2026-05-01-introducing-the-signoz-mcp-server-r5iwnkpxtsz88akwt6abqddn/); Go module `github.com/SigNoz/signoz-mcp-server` v0.1.0 was published 2026-03-25 — [pkg.go.dev](https://pkg.go.dev/github.com/SigNoz/signoz-mcp-server@v0.1.0)
- SigNoz claims LLM/RAG tracing with prompts, tool calls, tokens, latency and cost alongside full APM. The source is SigNoz's own marketing. — [SigNoz LLM observability tools 2026](https://signoz.io/comparisons/llm-observability-tools/)
- SigNoz Docker requirements: at least 4 GB for Docker, Docker Engine 20.10+ and Compose v2. — [SigNoz Docker install docs](https://signoz.io/docs/install/docker/)
- SigNoz measured idle is about 1.6 GB (ClickHouse ~775 MB, ZooKeeper ~775 MB, SigNoz ~50 MB, collector ~35 MB) and about 3.4 GB under moderate load. A homelab guide calls 8 GB the honest number and 16 GB for more than a few services. — [virtua.cloud SigNoz vs OpenObserve](https://www.virtua.cloud/learn/en/tutorials/self-host-signoz-openobserve-vps); [sumguy.com](https://sumguy.com/self-host-signoz/); [selfhostatlas](https://selfhostatlas.com/self-host/signoz)
- SigNoz license: Community Edition is listed as "MIT Expat" (with EE directories separate), but another comparison says the terms are unspecified. Conflicting. — [openalternative.co](https://openalternative.co/compare/signoz/vs/uptrace); [cubeapm](https://cubeapm.com/blog/openobserve-vs-signoz/)
- **ClickStack MCP server** is built in. Assistants can query logs, traces and metrics, manage dashboards and alerts, explore sources and use saved searches. It is available for OSS ClickStack, BYOC and ClickStack on ClickHouse Cloud, but **not** legacy HyperDX v1 (hyperdx.io). OSS/BYOC uses Streamable HTTP with a Bearer Personal API Access Key from Team Settings. Cloud uses OAuth 2.0, and Claude Code connects with `claude mcp add` (HTTP) then `/mcp`. The origin is HyperDX PR #2030. One localized (JA) docs page still says managed is "coming soon", so it may lag. — [ClickStack MCP docs](https://clickhouse.com/docs/clickstack/mcp); [JA docs](https://clickhouse.com/docs/jp/use-cases/observability/clickstack/mcp)
- The ClickStack all-in-one image bundles the HyperDX UI, an OTel collector and ClickHouse in one container. Third-party guides give a testing minimum of 4 GB RAM and 2 cores. The `clickstack-local` mode runs with **no authentication**. — [ClickStack OSS getting started](https://clickhouse.com/docs/use-cases/observability/clickstack/getting-started/oss); [tasrieit guide](https://tasrieit.com/blog/clickstack-setup-guide-docker-helm-kubernetes-2026)
- **OpenObserve** runs as a single binary or container and claims as little as 512 MB. Measured idle is about 310 MB and about 650 MB under moderate load, against 1.6 GB and 3.4 GB for SigNoz. It is logs-first, and its metrics and traces are less mature than SigNoz APM. — [virtua.cloud](https://www.virtua.cloud/learn/en/tutorials/self-host-signoz-openobserve-vps); [cubeapm](https://cubeapm.com/blog/openobserve-vs-signoz/)
- **OpenObserve MCP**: an official server over stdio/SSE, read-only with rate limits and query timeouts, with RBAC per stream and audit logging. A community GPL-3.0 server (`alilxxey/openobserve-community-mcp`) exists **specifically to avoid needing an Enterprise license**, which suggests the official one may be Enterprise-gated. — [OpenObserve MCP page](https://openobserve.ai/mcp-server/); [Enterprise DNA directory](https://enterprisedna.co/directories/mcp/alilxxey-openobserve-community-mcp)
- **Uptrace** is AGPL-3.0 core. The self-host build is free with no license, and cloud is usage-billed. It restructured into a five-tier open-core product in 2026 and raised prices up to 15% effective 2026-04-10. — [openalternative.co](https://openalternative.co/compare/signoz/vs/uptrace); [cubeapm Uptrace pricing review](https://cubeapm.com/blog/uptrace-pricing-review/)
- Uptrace RAM: no 2026 figure found. The only data point is an HN anecdote that it "runs just fine on a MacBook Air". — [HN](https://news.ycombinator.com/item?id=45293788)

### Inferences
- On 8 to 16 GB, a ClickHouse stack (SigNoz or ClickStack) fits, but it takes most of the budget next to the existing Prometheus, Grafana and Phoenix. The ZooKeeper sidecar is about half of SigNoz's idle RAM.
- Of the "one UI for all signals plus MCP for agents" options, ClickStack and SigNoz are the most complete OSS answers in 2026. ClickStack's MCP can also save and delete dashboards, which is agent-write capability and worth scoping with a read-only key.
- None of these backends replaces Phoenix's LLM-specific evaluation and annotation workflows. They can display GenAI-semconv spans, but they offer no dataset, experiment or eval loop. That conclusion comes from the absence of eval features in the cited material, not from a direct statement.

### Gaps
- Primary LICENSE-file confirmation for OpenObserve (believed AGPL-3.0), ClickStack/HyperDX (believed MIT) and SigNoz.
- Query languages were not verified in 2026 sources. Prior knowledge only: SigNoz uses its query builder plus ClickHouse SQL and PromQL, ClickStack uses Lucene-style search plus SQL, OpenObserve uses SQL plus PromQL, and Uptrace uses its own query language plus PromQL.
- Whether OpenObserve's official MCP server is Enterprise-only.
- Uptrace MCP server existence.
- Dashboard provisioning-as-code for SigNoz, ClickStack and OpenObserve.

## VictoriaMetrics / VictoriaLogs / VictoriaTraces as a lighter LGTM substitute

### Takeaway
VictoriaTraces is active pre-1.0 (v0.9.4 on 2026-07-03, v0.10.0 pre-release on 2026-07-22). It ingests OTLP (gRPC since v0.5.0), serves Jaeger and Tempo-compatible query APIs so the existing Grafana can read it, and is built on VictoriaLogs storage. MCP servers exist for the Victoria* stack, but whether they are official was not confirmed.

### Cited Findings
- VictoriaTraces v0.9.4 (2026-07-03) changes the cluster-internal protocol, so all components must be upgraded together. It bumps bundled VictoriaLogs from v1.50.0 to v1.51.0 and adds max-trace limits for the Jaeger and **Tempo** search APIs. — [newreleases v0.9.4](https://newreleases.io/project/github/VictoriaMetrics/VictoriaTraces/release/v0.9.4)
- v0.10.0 (2026-07-22, pre-release) switches to a distroless base image, drops the linux/386 Docker image and builds with Go 1.26.5. — [newreleases v0.10.0](https://newreleases.io/project/github/VictoriaMetrics/VictoriaTraces/release/v0.10.0)
- VictoriaTraces had 10 releases in H1 2026, focused on API compatibility, **Tempo query support**, ingestion reliability and pipeline observability, and is moving into VictoriaMetrics Cloud. VictoriaLogs added Splunk HEC ingestion and CSV export in H1 2026. — [VictoriaMetrics 2026 Mid Year Roundup](https://victoriametrics.com/blog/victoriametrics-2026-mid-year-roundup/)
- The VictoriaTraces changelog shows OTLP/gRPC ingestion added in v0.5.0 and lower CPU for OTLP protobuf in v0.6.0. — [VictoriaTraces changelog](https://docs.victoriametrics.com/victoriatraces/changelog/)
- A read-only VictoriaTraces MCP server exposes the HTTP query APIs plus embedded docs. One directory labels it "Official", which was not confirmed from VictoriaMetrics docs. — [G2 listing](https://ai.g2.com/marketplace/tools/mcp-victoriatraces); [agentpedia](https://agentpedia.codes/mcp/victoriatraces)

### Inferences
- For shape (b), VictoriaMetrics (or keeping Prometheus 3.x with OTLP receive), VictoriaLogs and VictoriaTraces behind the existing Grafana 13 is the lowest-RAM full-signal option that keeps Grafana as the single pane. Tempo-API compatibility means the Grafana Tempo datasource and TraceQL-style search can point at it, though TraceQL parity is likely partial. Footprint is not measured here; VictoriaMetrics' reputation for low RAM is prior knowledge.
- Pre-1.0 status and lock-step upgrade requirements make VictoriaTraces less of a "set and forget" choice than Tempo.

### Gaps
- No 2026 RAM benchmark for VictoriaLogs or VictoriaTraces single-node versus Loki or Tempo.
- The extent of TraceQL support in VictoriaTraces' Tempo API.
- Official MCP servers for VictoriaMetrics and VictoriaLogs (community `mcp-victoriametrics` and `mcp-victorialogs` likely exist, unverified).
- VictoriaLogs query language (LogsQL) and OTLP logs ingest were not re-verified this pass.

## LLM/agent-trace specialists: Phoenix, Langfuse, Opik, OpenLLMetry/Traceloop

### Takeaway
All three main specialists ingest OTLP traces, but only traces. None is a general logs or metrics backend. Phoenix (ELv2) is the most OTel-aligned (OTLP HTTP and gRPC, single container) and now serves a **built-in remote MCP endpoint at `/mcp`**. Langfuse (MIT core, acquired by ClickHouse in January 2026) has an official authenticated MCP endpoint and needs Postgres, ClickHouse, Redis and blob storage. Opik is Apache-2.0 with HTTP-only OTel ingest.

### Cited Findings
- Langfuse's OTLP endpoint `/api/public/otel` accepts **traces only**, over HTTP/JSON or HTTP/protobuf, with no gRPC. — [OpenObserve LLM observability tools 2026](https://openobserve.ai/blog/llm-observability-tools/); [pydantic.dev](https://pydantic.dev/articles/best-langfuse-alternatives)
- Phoenix accepts OTLP over HTTP **and gRPC**, runs as a single container plus collector, and is licensed Elastic License 2.0 (source-available, not OSI). Since May 2026 it auto-converts to GenAI semantic conventions. — [OpenObserve blog](https://openobserve.ai/blog/llm-observability-tools/); [futureagi](https://futureagi.com/blog/langfuse-alternatives-2026/)
- Opik is Apache-2.0 with native OTel ingest over HTTP only. It self-hosts with a script for dev and Helm for production. Comet's own comparison may favour Opik. — [Comet Opik vs Phoenix](https://www.comet.com/site/products/opik/compare/phoenix-vs-opik/)
- Langfuse core is MIT with separately licensed enterprise directories. Self-hosting needs Postgres, ClickHouse, Redis/Valkey and blob storage. ClickHouse **acquired Langfuse in January 2026**. — [agenticwire Opik vs Langfuse](https://www.agenticwire.news/article/langfuse-vs-opik); [OpenObserve blog](https://openobserve.ai/blog/llm-observability-tools/)
- **Phoenix MCP**: the `@arizeai/phoenix-mcp` stdio npm package is now **maintenance-only**. New features go to the **remote MCP server built into Phoenix at `/mcp`**, which the docs call the primary connection route. It covers traces, spans, annotation configs, projects, sessions, prompts and datasets. — [Arize Phoenix MCP server docs](https://www.arize.com/docs/phoenix/sdk-api-reference/typescript/mcp-server.md)
- Phoenix also documents MCP **tracing** through OpenInference: context propagation between MCP client and server spans yields unified traces. — [Phoenix MCP tracing](https://arize.com/docs/phoenix/integrations/model-context-protocol/mcp-tracing)
- **Langfuse MCP**: a native authenticated server at `https://cloud.langfuse.com/api/public/mcp` (self-hosted is presumably `/api/public/mcp`) over streamableHttp with Basic Auth. Langfuse recommends its **Agent Skill** over MCP for agents that can run shell commands. A separate docs-only MCP lives at `https://langfuse.com/api/mcp`. — [Langfuse MCP server docs](https://langfuse.com/docs/api-and-data-platform/features/mcp-server); [Langfuse docs MCP](https://langfuse.com/docs/docs-mcp)

### Inferences
- The operator already runs Phoenix, so on a current Phoenix version the agent query surface for LLM traces is just its `/mcp` endpoint, with no new component needed. Phoenix does not double as a general trace backend: it has no logs or metrics, and no infra-span views. The OTel Collector should **fan out** GenAI/OpenInference spans to Phoenix and all spans to the general trace store (Tempo, VictoriaTraces or ClickStack), keyed by the same trace_id.
- Langfuse joining ClickHouse makes a ClickStack plus Langfuse pairing a plausible 2026 single-vendor OSS story (shared ClickHouse). That is speculative; no integration announcement was found.
- Phoenix's ELv2 license only matters if it is offered as a managed service to third parties, which is not the case here.

### Gaps
- OpenLLMetry/Traceloop 2026 status (OpenLLMetry is an instrumentation library emitting OTel GenAI spans, not a backend; Traceloop's hosted product and MCP not checked).
- Opik MCP server existence.
- Phoenix minimum version that serves `/mcp`.
- Phoenix 2026 resource footprint.

## Hosted options with OTLP and free tiers; official MCP servers

### Takeaway
Every listed vendor accepts OTLP. Official, vendor-run MCP servers exist in 2026 for **Datadog** (GA 2026-03-09), **Grafana Cloud** (managed, 2026-07-28), **Sentry** (remote, `mcp.sentry.dev`, OAuth), **Dash0** (remote, Streamable HTTP), **Axiom** (`mcp.axiom.co`, official, replacing a deprecated community server), **Honeycomb** (hosted MCP, public beta from July 2025, possibly Enterprise-only) and **SigNoz Cloud** and **ClickStack Cloud**. Better Stack's MCP claim is self-reported. Free-tier numbers below come from third-party pages; verify before relying on them.

### Cited Findings
- **Datadog** announced its MCP Server **GA on 2026-03-09**, giving agents and IDEs live observability data under existing RBAC. — [Datadog investor press release](https://investors.datadoghq.com/news-releases/news-release-details/datadog-launches-mcp-server-provide-ai-agents-secure-real-time); [Nasdaq](https://www.nasdaq.com/press-release/datadog-launches-mcp-server-provide-ai-agents-secure-real-time-access-unified)
- Datadog has no meaningful production free tier: a 14-day trial, with free infra limited to 5 hosts. It offers several OTLP ingest paths, but some features still need its Agent or SDK. — [Railway blog](https://blog.railway.com/p/best-cloud-observability-tools-2026); [Better Stack Datadog vs Sentry](https://betterstack.com/community/comparisons/datadog-vs-sentry/)
- **Honeycomb** Hosted MCP went to public beta in July 2025 and is listed in the AWS Marketplace "AI Agents and Tools" category. A directory says it is for Enterprise customers (tools such as `list_datasets`, `get_columns`, `run_query`). No GA found. The free tier is reportedly 20M events/month, and Pro is $130 or $150/month, depending on the source. Honeycomb has retired its proprietary SDKs in favour of OTel. — [Honeycomb blog](https://honeycomb.io/blog/honeycomb-announces-availability-mcp-aws-marketplace-ai-agents-tools-category); [agentpedia](https://agentpedia.codes/mcp/honeycomb); [modern-datatools review](https://www.modern-datatools.com/tools/honeycomb); [Dash0 Honeycomb vs Datadog](https://www.dash0.com/comparisons/honeycomb-vs-datadog)
- **Axiom**'s official MCP server is at `mcp.axiom.co`, and the older community `mcp-server-axiom` (tools `queryApl`, `listDatasets`, `getDatasetSchema`) is deprecated. Query language is APL. The Personal (free) plan reportedly includes 500 GB ingest, 10 GB-hours of query, 25 GB storage and 30-day retention, with no card required. — [glama axiomhq/mcp-server-axiom](https://glama.ai/mcp/servers/axiomhq/mcp-server-axiom); [Better Stack Axiom alternatives](https://betterstack.com/community/comparisons/axiom-alternatives/)
- **Dash0**: "the official MCP server for Dash0" is a remote, cloud-hosted server over Streamable HTTP (docs updated 2026-04-16). Dash0 also has an MCP catalogue changelog entry and an "Agent0" AI feature, and raised a $110M Series B at a $1B valuation. A free tier is marked in a comparison table without limits. — [Dash0 MCP docs](https://www.dash0.com/docs/dash0/ai/mcp/use-mcp); [Dash0 changelog MCP catalogue](https://dash0.com/changelog/mcp-catalogue); [Railway blog](https://blog.railway.com/p/best-cloud-observability-tools-2026)
- **Sentry** runs an official remote MCP server at `mcp.sentry.dev` with OAuth and no local install. The free Developer plan is 1 user and 5K errors/month. — [MCP.Directory Datadog vs Grafana vs Sentry MCP 2026](https://mcp.directory/blog/datadog-vs-grafana-vs-sentry-mcp-2026); [Better Stack](https://betterstack.com/community/comparisons/datadog-vs-sentry/)
- **Better Stack**'s free plan reportedly includes 3 GB of logs, traces and metrics with no card required. Its "AI SRE" offers MCP integration. Both claims come from Better Stack's own pages. — [Better Stack Groundcover alternatives](https://betterstack.com/community/comparisons/groundcover-alternatives/)
- **Grafana Cloud** has a managed MCP server (2026-07-28). — [Grafana What's New](https://grafana.com/whats-new/2026-07-28-cloud-mcp-server--connect-your-agents-to-grafana-cloud-with-a-single-url/)
- Datadog MCP sources conflict: some list a community `winor30` server, while Datadog's own release covers the GA server. The GA press release is authoritative. — [MCP.Directory](https://mcp.directory/blog/datadog-vs-grafana-vs-sentry-mcp-2026); [Datadog PR](https://investors.datadoghq.com/news-releases/news-release-details/datadog-launches-mcp-server-provide-ai-agents-secure-real-time)

### Inferences
- For Vercel-hosted public apps (shape c) on a cheap budget, Axiom (generous free ingest, official MCP, long-standing Vercel log-drain integration), Grafana Cloud (free tier plus managed MCP, same Grafana/PromQL/TraceQL skills as the homelab) and Sentry (errors and session context, official MCP) are the strongest fits. Datadog is overkill and expensive for a single operator. Honeycomb's MCP may be gated to Enterprise.
- Grafana Cloud as shape (c) keeps one query language family and one dashboard-as-code toolchain (Foundation SDK) across all three shapes.

### Gaps
- Primary-source free-tier limits for Grafana Cloud (2026), Dash0, Honeycomb and Better Stack.
- Vercel's 2026 native OTel/drain integrations per vendor were not checked.
- Honeycomb MCP GA status and tier gating.
- Whether Better Stack's MCP is a first-party server.

## Dashboards-as-code for a schema-first TypeScript monorepo

### Takeaway
The **Grafana Foundation SDK** (`@grafana/grafana-foundation-sdk` on npm) is the only first-party option with **typed TypeScript builders**. It is generated from Grafana's schemas, covers dashboards and alert rules, and pairs with `grafanactl`/**gcx** for push, pull and validate. Grafonnet is not officially supported. **Perses** (CNCF Sandbox since 2024-08-29) has Go and CUE SDKs and K8s CRDs but no official TS dashboard SDK, so it fits a TS monorepo worse.

### Cited Findings
- The Foundation SDK provides types and builder libraries in Go, **TypeScript**, Python, PHP and Java, and covers dashboards and alert rules, with more resource types planned. Grafonnet is not officially supported: "use the Foundation SDK to create dashboards as code." — [Grafana Foundation SDK docs](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/foundation-sdk/); [npm @grafana/grafana-foundation-sdk](https://www.npmjs.com/package/@grafana/grafana-foundation-sdk)
- Grafana has a learning path for building dashboards with the Foundation SDK. — [Grafana learning path](https://grafana.com/docs/learning-paths/build-dashboard-sdk/)
- `grafanactl` was introduced with Grafana 12 as the official CLI to pull, push and validate resources, integrated with the SDK. Current docs refer to **gcx** alongside Git Sync and the Foundation SDK on the same APIs. — [Grafana 12 blog](https://grafana.com/blog/observability-as-code-grafana-12/); [Observability as code docs](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/)
- Perses was accepted to CNCF Sandbox on 2024-08-29 and has Go and CUE SDKs for dashboards plus a Perses Operator for K8s CRDs. Its plugins repo is TypeScript, but no official TS dashboard SDK was found. — [CNCF Perses](https://www.cncf.io/projects/perses/); [perses/perses GitHub](https://github.com/perses/perses)
- 2026 Perses adoption: Red Hat's developer preview moved right-sizing dashboards from Grafana to Perses using the Perses Go SDK (2026-06-22), and GreptimeDB's Perses plugin was merged into the CNCF plugins repo (2026-06-24). — [Red Hat Developers](https://developers.redhat.com/articles/2026/06/22/right-sizing-recommendations-mcoa-and-perses-dashboards); [Greptime blog](https://greptime.com/blogs/2026-06-24-greptimedb-perses-observability)

### Inferences
- For an Effect/schema-first TS monorepo, the Foundation SDK builders give compile-time typed panels and queries. Wrap them in a thin repo-owned schema layer: for example, an Effect Schema `DashboardSpec` that decodes to SDK builder calls, then emits JSON and pushes it through gcx or Grafana's file provisioning. Plain JSON provisioning works without the SDK but loses type safety.
- Terraform-Grafana remains viable for a Terraform-first shop. It adds a second toolchain to a TS monorepo for little gain at single-operator scale. (2026 terraform-provider-grafana status was not verified.)
- Perses only makes sense if the shop moves off Grafana or onto K8s. Neither applies to shapes (a), (b) or (c).

### Gaps
- Foundation SDK TS version and release cadence for Grafana 13. Whether it supports Grafana 13's dashboard schema v2 was not verified.
- Whether SigNoz, ClickStack or OpenObserve offer comparable typed dashboard-as-code. None was found.
- terraform-provider-grafana 2026 status.

## Tailscale Serve compatibility and recommendation inputs (not directly researched)

### Takeaway
No 2026 source in this pass specifically covered running these backends behind Tailscale Serve. The notes below are inference from how the products expose ports (HTTP UIs plus OTLP 4317 gRPC and 4318 HTTP) and must be validated.

### Cited Findings
- ClickStack's `clickstack-local` mode has no authentication, which matters on any shared network including a tailnet. — [tasrieit](https://tasrieit.com/blog/clickstack-setup-guide-docker-helm-kubernetes-2026)
- docker-otel-lgtm exposes Grafana 3000 and OTLP 4317/4318. — [grafana/docker-otel-lgtm](https://github.com/grafana/docker-otel-lgtm)
- The ClickStack, SigNoz, Phoenix and Langfuse MCP servers are HTTP (Streamable HTTP) endpoints with bearer, Basic or OAuth auth. — [ClickStack MCP](https://clickhouse.com/docs/clickstack/mcp); [Langfuse MCP](https://langfuse.com/docs/api-and-data-platform/features/mcp-server); [Phoenix MCP](https://www.arize.com/docs/phoenix/sdk-api-reference/typescript/mcp-server.md)

### Inferences
- Every self-hosted candidate is plain HTTP(S) or gRPC on fixed ports, so all should work behind Tailscale Serve: HTTPS proxy for the UIs, OTLP/HTTP and MCP endpoints, and TCP forwarding for OTLP/gRPC 4317. None requires Kubernetes for a single-box Docker deploy. Perses' operator path and Opik's production Helm path are K8s, but both have non-K8s modes. Prior knowledge, not verified this pass: Serve terminates TLS with the tailnet's certificate, which suits HTTP MCP endpoints that clients want over HTTPS.
- **Provisional recommendation matrix** (for the report writer to refine):
  - (a) Laptop: `grafana/otel-lgtm` (one container, 2 GB) plus local Phoenix for LLM spans; alternative is OpenObserve single binary (about 300 MB) or ClickStack all-in-one (4 GB) when one UI with built-in MCP matters more.
  - (b) Homelab tailnet box (Prometheus 3.x, Grafana 13, collector and Phoenix already running): keep Grafana as the pane; add **Loki and Tempo** (staying on the Grafana stack, with the OSS `mcp-grafana` for agents) or **VictoriaLogs and VictoriaTraces** (lower RAM, pre-1.0 traces, Tempo-API-compatible). Keep Phoenix for GenAI spans through collector fan-out, with Phoenix `/mcp` for agents. Choose **SigNoz or ClickStack** only to replace the Grafana/Prometheus stack with one ClickHouse UI plus built-in MCP; budget 4 to 8 GB.
  - (c) Vercel public apps: **Grafana Cloud** (same toolchain and managed MCP) or **Axiom** (generous free ingest, official MCP, Vercel-friendly), plus **Sentry** for errors (official MCP, free Developer plan). Datadog only if budget is irrelevant.

### Gaps
- No primary or 2026 source for Tailscale Serve and gRPC (4317) behaviour, or for any vendor documenting tailnet deployment.
- No measured side-by-side RAM benchmark across LGTM, Victoria* and ClickHouse stacks on the same workload in 2026.
