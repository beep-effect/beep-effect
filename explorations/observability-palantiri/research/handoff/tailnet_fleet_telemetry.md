# Tailnet fleet telemetry: host agents, collection topology, and Tailscale exposure (as of 2026-10)

Scope: one Arch/CachyOS workstation (dankstation), one Ubuntu homelab (dankserver: Prometheus 3.x + Grafana 13.x + node_exporter + OTel Collector + Phoenix under Docker), two more Linux boxes (beep-worker, grok-bot-box-1, one tagged), ephemeral GitHub Actions / self-hosted AWS runners, and two Windows 11 PCs running a Claude Desktop extension (bun-compiled stdio MCP server, practice-kg-mcp). No Kubernetes.

Research method note: about 30 searches/fetches. Primary sources were Tailscale docs, opentelemetry.io, the otel-collector-contrib README, the windows_exporter README, Grafana Alloy docs and grafana.com dashboard pages. Third-party blogs are marked as such. Several claims I could not confirm from a primary source are listed under Gaps, not presented as fact.

## Q1. Host agents: node_exporter + windows_exporter vs OTel Collector hostmetrics vs Grafana Alloy vs Vector vs Netdata vs Beszel vs Telegraf

### Takeaway
For an OTLP-first fleet that needs per-process CPU/RAM on Windows, the two real candidates are (a) the OTel Collector contrib distribution (hostmetrics `process` scraper + `windowseventlog`/`journald` receivers, native OTLP push, file-backed queue) and (b) Grafana Alloy, which wraps windows_exporter/node_exporter plus OTel components in one service. node_exporter/windows_exporter are pull-only Prometheus exporters, fine where Prometheus can reach the host but with no OTLP and no buffering. Beszel and Netdata are self-contained monitoring products, not OTLP pipeline agents. Vector and Telegraf work but are weaker fits: Vector's OTLP sink is beta and HTTP-only, and I could not verify Telegraf's OTLP output from a source.

### Cited Findings
**OTel Collector `hostmetrics` receiver**
- Scrapers: cpu, disk, load, filesystem, memory, network, paging (all OSes); nfs (Linux); `processes` (count only; Linux/Mac/FreeBSD/OpenBSD, **not Windows**); `process` (per-process CPU, memory, disk I/O; **Linux, Windows**, Mac, FreeBSD); system (Linux/Windows/Mac). Metrics stability is **beta**. — [hostmetricsreceiver README](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/receiver/hostmetricsreceiver/README.md)
- The process scraper supports `include`/`exclude` by process `names` with `match_type: strict|regexp`, and `scrape_process_delay`. Error-mute flags (all default false): `mute_process_all_errors`, `mute_process_name_error`, `mute_process_io_error`, `mute_process_cgroup_error`, `mute_process_exe_error` (Linux only), `mute_process_user_error`. Permission errors surface when the collector cannot read another user's process data. — [hostmetricsreceiver README](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/receiver/hostmetricsreceiver/README.md)
- To run in Docker on Linux, bind-mount the host (`-v /:/hostfs` or `-v /proc:/hostfs/proc`) and set `root_path: /hostfs`. All hostmetrics instances must share the same `root_path`. — [hostmetricsreceiver README](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/receiver/hostmetricsreceiver/README.md)
- Gotcha: collectors not linked to glibc (`CGO_ENABLED=0`) cannot resolve NSS usernames such as systemd `DynamicUser`, so `process.owner` may be missing. — [hostmetricsreceiver README](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/receiver/hostmetricsreceiver/README.md)
- Windows Event Log needs **otelcol-contrib**; the core `otelcol` binary has no `windowseventlog` receiver. Configure one receiver per channel (e.g. `windowseventlog/application` with `channel: Application`, `start_at: end`, `max_reads: 100`). — [Coralogix docs (vendor)](https://coralogix.com/docs/opentelemetry/configuration-options/windows-event-logs-and-opentelemetry.md)

**windows_exporter (prometheus-community)**
- Default collectors: `cpu`, `logical_disk`, `memory`, `net`, `os`, `physical_disk`, `service`, `system`. **`process` is off by default** and is enabled with `--collectors.enabled "[defaults],process"`. Other optional collectors include `gpu`, `scheduled_task`, `tcp`, `textfile`, `update`, `performancecounter`. — [windows_exporter README](https://github.com/prometheus-community/windows_exporter)
- Default port **9182**. MSI installs it as a Windows service under `C:\Program Files\windows_exporter`. MSI properties: `ENABLED_COLLECTORS`, `LISTEN_PORT`, `CONFIG_FILE`, and `ADDLOCAL=FirewallException`. Pull-only Prometheus `/metrics`, plus a one-shot `--scrape.stdout`. **No OTLP/push.** — [windows_exporter README](https://github.com/prometheus-community/windows_exporter)

**Grafana Alloy**
- On Windows, Alloy's `prometheus.exporter.windows` component exposes windows_exporter collectors through `enabled_collectors`. A `prometheus.scrape` feeds a `prometheus.remote_write`. The documented Windows scenario also collects event logs to Loki. Grafana recommends running Alloy with administrator access. — [Alloy: monitor Windows](https://grafana.com/docs/alloy/latest/monitor/monitor-windows/)
- Windows install: GUI installer, `winget install GrafanaLabs.Alloy`, or silent `/S` (run as Administrator). It runs as a Windows service under `NT AUTHORITY\LocalSystem` by default (`/USERNAME`/`/PASSWORD` change the account). Config at `$INSTDIR\config.alloy`, install dir `%PROGRAMFILES%\GrafanaLabs\Alloy`. **No documented non-admin / user-level install.** — [Alloy Windows install](https://grafana.com/docs/alloy/latest/set-up/install/windows/)
- Footprint is anecdotal only. A user reports Alloy using about 3x the memory of Grafana Agent on the same config; others report 461–742 MiB RSS in heavier setups. No controlled benchmark found. — [Grafana community thread](https://community.grafana.com/t/grafana-alloy-memory-consumption/124186); [Grafana community thread 2](https://community.grafana.com/t/grafana-alloy-memory-usage/145672)

**Vector**
- The `opentelemetry` sink is **beta** and batches only with `encoding.codec: otlp` (protobuf). Vector's 0.51.1 Rust docs say only HTTP is supported, with gRPC planned. — [Vector opentelemetry sink](https://vector.dev/docs/reference/configuration/sinks/opentelemetry/); [Vector OTLP highlight 2025-09-23](https://vector.dev/highlights/2025-09-23-otlp-support/); [rust-doc](https://rust-doc.vector.dev/vector/sinks/opentelemetry/index.html)
- `host_metrics` was originally scoped for Linux, Windows, and macOS (2020 RFC; I found no current per-platform matrix). Converting native host_metrics events to OTLP-shaped events appears to need a `remap` transform. — [Vector host-metrics RFC](https://github.com/vectordotdev/vector/blob/master/rfcs/2020-08-26-3191-host-metrics.md)

**Netdata**
- Native Windows agent; the older Windows collector is deprecated. — [Netdata Windows systems](https://learn.netdata.cloud/docs/data-collection/windows-systems)
- Resource use (generic, not Windows-specific): 1–5% of one core, 100–200 MB RAM by default (depends on metric count and ML), occasional spikes to about 20% during flushes. — [Netdata resource utilization](https://learn.netdata.cloud/docs/netdata-agent/resource-utilization/impact-on-cloud-vms)
- Export: Prometheus scrape of `allmetrics` or **Prometheus remote write** (snappy protobuf; needs protobuf/snappy libraries; **no buffering on failure**). The docs I read show no OTLP exporter. — [Netdata exporting reference](https://learn.netdata.cloud/docs/exporting/exporting-reference); [Netdata + Prometheus](https://learn.netdata.cloud/docs/exporting-metrics/prometheus)

**Beszel**
- Hub (PocketBase web app) plus a per-host agent. Latest Go module v0.18.7 (2026-04-05). Per-container CPU/mem/net history for Docker and Podman. Alerts on CPU/mem/disk/bandwidth/temp/status via webhooks (ntfy, Gotify, Discord, Telegram). GPU metrics for Nvidia/AMD need the binary agent, not Docker. Backups to disk/S3, REST API, OAuth/OIDC. — [pkg.go.dev beszel v0.18.7](https://pkg.go.dev/github.com/henrygd/beszel@v0.18.7); [Beszel GitHub](https://github.com/henrygd/beszel); [ElfHosted docs](https://docs.elfhosted.com/app/beszel/)
- Windows agent ships as a ZIP and via WinGet/Scoop. — [Beszel agent installation](https://beszel.dev/guide/agent-installation); [wingetly](https://wingetly.io/apps/henrygd/beszel-agent)
- Sources disagree on transport: the README says the agent runs a minimal SSH server the hub connects to; Railway and computingforgeeks describe the agent dialing out over WebSocket. Both modes may exist in current versions. — [Beszel GitHub](https://github.com/henrygd/beszel); [Railway template](https://railway.com/deploy/beszel)
- I found no evidence of OTLP output from Beszel.

**Telegraf**
- `inputs.win_perf_counters` is Windows-only and is the recommended way to get Windows system metrics, because generic plugins use WMI, which costs more. If a counter object is missing when Telegraf starts, that object is never collected. — [Telegraf win_perf_counters](https://docs.influxdata.com/telegraf/v1/input-plugins/win_perf_counters/index.md); [Logit example](https://logit.io/docs/integrations/windows/)
- Windows service management: `telegraf.exe --service install|start|stop|uninstall`. — [Tencent tutorial (secondary)](https://cloud.tencent.com/developer/article/1465333)

**Grafana dashboards relevant to agents**
- Node Exporter Full **1860** expects node_exporter flags `--collector.systemd --collector.processes`. — [grafana.com 1860](https://grafana.com/grafana/dashboards/1860/revisions)

### Inferences
- **Answering "does practice-kg-mcp make the attorney's PC slow"** needs per-process CPU and working set for the bun binary, Claude Desktop (Electron), and the top N other processes. Three options can supply that on Windows: OTel `hostmetrics` `process` (filter `include.names: [practice-kg-mcp.exe, Claude.exe]` regexp), windows_exporter's `process` collector (off by default; enabling it for every process inflates cardinality), and Netdata. Beszel tracks per-container, not per-process, usage, so it cannot answer this question.
- **Recommended per-host agent, if one agent everywhere is the goal:** otelcol-contrib, or a custom `ocb`-built distribution with only hostmetrics, journald/windowseventlog, filelog, otlp, prometheus, file_storage, and otlp/otlphttp exporter. It is the only option here with native OTLP for metrics, logs, and traces, a persistent queue, and process metrics on both OSes. The central dankserver collector already speaks OTLP, so there is no protocol translation.
- **Alloy** is the alternative if Loki-native log handling and windows_exporter's richer Windows collectors (services, scheduled tasks, updates) are wanted. It still requires an admin install on Windows. From general knowledge, not verified in this pass: Alloy also embeds `otelcol.*` components and can export OTLP.
- **node_exporter + windows_exporter** remain the lowest-effort path for the always-on Linux boxes, which already scrape fine over the tailnet, and they match dashboards 1860 and 24390 directly. They cannot cover laptops that go offline, because a pull model has nothing to buffer.
- **Beszel** is good as a parallel "glance" UI but does not feed the OTLP stack. **Netdata** has no buffering on its remote-write path, which is a poor fit for intermittently online Windows PCs.

### Gaps
- No controlled 2025–2026 memory/CPU benchmark comparing otelcol-contrib, Alloy, Vector, and Telegraf on Windows.
- I could not verify from a primary source: the journald receiver's status, Telegraf's `outputs.opentelemetry` options, Telegraf's `procstat`/`win_eventlog` details, the latest windows_exporter release number, or whether windows_exporter can run without admin.
- No Netdata OTLP exporter documentation found. Whether it exists in 2026 is unknown.

## Q2. Topology: agents push to a central gateway, central Prometheus scrapes over the tailnet, or hybrid; handling intermittently online Windows

### Takeaway
Use a hybrid. Always-on Linux boxes can keep being scraped by Prometheus over the tailnet, which costs nothing and already works. Anything intermittent (the Windows PCs, CI runners) should push OTLP from a local agent-mode collector to the dankserver gateway collector, with a `file_storage`-backed `sending_queue` and a long `retry_on_failure.max_elapsed_time`. The 5-minute default retry window would drop most of a laptop's offline period.

### Cited Findings
- The collector's sending queue buffers in memory by default. Default `queue_size` is "often 1000 batches/requests". The docs example raises it to `5_000`. — [OTel Collector resiliency](https://opentelemetry.io/docs/collector/resiliency/)
- `retry_on_failure` uses exponential backoff with jitter. **Default `max_elapsed_time` is 300s (5 min).** After that, the oldest data is dropped. The example sets `initial_interval: 5s`, `max_interval: 30s`, `max_elapsed_time: 10m`. — [OTel Collector resiliency](https://opentelemetry.io/docs/collector/resiliency/)
- The persistent queue writes a WAL to disk before export and survives crashes and restarts. Setup takes three steps: define `extensions.file_storage.directory`, set `exporters.<x>.sending_queue.storage: file_storage`, and list the extension under `service.extensions`. — [OTel Collector resiliency](https://opentelemetry.io/docs/collector/resiliency/)
- Persistence is not guaranteed delivery. Data is lost if the disk fills or fails, or if an outage exceeds `max_elapsed_time` or the queue capacity. Monitor `otelcol_exporter_queue_size` and `otelcol_exporter_queue_capacity`. Kafka is suggested for stronger tier-to-tier guarantees. — [OTel Collector resiliency](https://opentelemetry.io/docs/collector/resiliency/)
- Resilience effort should go into the Agent→Gateway and Gateway→Backend hops. Use persistent storage on critical agents. — [OTel Collector resiliency](https://opentelemetry.io/docs/collector/resiliency/)
- Third-party 2026 guides configure offline edge collectors with longer windows (such as 1h) and `file_storage` compaction. — [OneUptime: storage extension (2026-02)](https://oneuptime.com/blog/post/2026-02-06-storage-extension-opentelemetry-collector/view); [OneUptime: persistent queues (2026-02)](https://oneuptime.com/blog/post/2026-02-06-persistent-disk-queues-otel-crash-recovery/view); [Axoflow: persistence internals](https://axoflow.com/opentelemetry-collector-persistence-and-retry-mechanisms-under-the-hood)
- Netdata's remote-write connector has no buffering on failure, so it is unsuitable for offline-tolerant push. — [Netdata exporting reference](https://learn.netdata.cloud/docs/exporting/exporting-reference)

### Inferences
- **Concrete laptop agent pattern:** an otelcol-contrib agent with `hostmetrics` (collection_interval of about 30–60s on battery) + `windowseventlog/{application,system}` + an `otlp` receiver on `127.0.0.1:4317/4318` for the MCP server. It exports `otlphttp` to the dankserver gateway's MagicDNS name, with `sending_queue.storage: file_storage` (directory under `%LOCALAPPDATA%` or `C:\ProgramData`), `retry_on_failure.max_elapsed_time: 0` or several days, and a bounded `queue_size` so disk use is capped.
- **Gateway mode on dankserver:** the existing collector becomes the gateway. It receives OTLP from agents, runs `batch`/`memory_limiter`/`resource` processors (attaching `host.name` and a `tailnet.tag`), sends traces to Phoenix, and sends metrics to Prometheus, either via Prometheus 3.x's native OTLP receiver or `prometheusremotewrite` (not verified in this pass; see Gaps).
- **Scrape model for the always-on Linux hosts:** keep Prometheus scraping node_exporter, plus tailscaled `:5252/metrics`, over the tailnet. The upside is free `up{}` liveness: a dead host goes absent rather than silent. A push-only host needs explicit staleness alerting (e.g. `absent_over_time` on a heartbeat metric).
- **Clock skew and backfill:** queued pushes arrive late. Prometheus accepts out-of-order samples only within a configured window (general knowledge, unverified here). Long laptop backlogs may be rejected unless OOO ingestion is enabled. This needs verification before relying on multi-day replay.

### Gaps
- Not fetched: Prometheus 3.x's native OTLP receiver flags (`--web.enable-otlp-receiver`), its out-of-order ingestion settings, and the remote-write receiver. Verify these against prometheus.io before designing the gateway→Prometheus hop.
- No primary source on `file_storage` behaviour on Windows specifically: file locking, paths, or behaviour when the service runs as a user.

## Q3. Tailscale mechanisms: Serve/Funnel, Services, tsnet, grants, tags, tailscaled metrics, MagicDNS/HTTPS, Prometheus discovery, CI runners and cost

### Takeaway
Expose Grafana and Phoenix with **Serve** (tailnet-only, auto HTTPS on `*.ts.net`, identity headers usable for Grafana auth-proxy login) or as **Tailscale Services** (`svc:` virtual IPs hosted by tagged devices). Do not use Funnel: it is public, in beta, bandwidth-limited, and carries no identity headers. Control scrape and OTLP ports with **grants** keyed on tags. Scrape tailscaled's own metrics on `:5252` after `tailscale set --webclient`. Prometheus has no native Tailscale service discovery, so use a third-party `http_sd` helper or static MagicDNS targets. GitHub Actions runners can join as ephemeral tagged nodes via workload identity federation. On the free Personal plan, that draws from a 1,000-minute/month ephemeral pool.

### Cited Findings
**Serve**
- Serve shares a local service with the tailnet only. ACLs apply. It requires HTTPS certificates to be enabled; the CLI walks you through consent if not. Example: `tailscale serve 3000` proxies `http://127.0.0.1:3000`. — [Tailscale Serve](https://tailscale.com/kb/1312/serve)
- Serve injects `Tailscale-User-Login`, `Tailscale-User-Name`, and `Tailscale-User-Profile-Pic` and strips spoofed copies. These headers are **not populated for tagged devices or Funnel traffic**. The backend should listen on localhost only. From v1.92, `--accept-app-caps` forwards app capabilities as a `Tailscale-App-Capabilities` JSON header. — [Tailscale Serve](https://tailscale.com/kb/1312/serve)
- CLI flags: `--bg`, `--https=<port>`, `--http=<port>`, `--tcp=<port>`, `--tls-terminated-tcp`, `--set-path`, `--service=<svc>`, `--proxy-protocol=2`. Inspect with `tailscale serve status [--json]` and `tailscale serve get-config --all`; clear with `tailscale serve reset`. Serve and Funnel CLI syntax changed in v1.52. — [tailscale serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve)
- A port is either Serve or Funnel; the most recent command wins. — [Tailscale Serve](https://tailscale.com/kb/1312/serve)

**Funnel**
- Requires v1.38.3+, MagicDNS, HTTPS certificates, and a `funnel` nodeAttr in the policy. The default attribute covers all tailnet members. Ports are limited to **443, 8443, 10000**; TLS only; the local client terminates TLS. Bandwidth limits are non-configurable. Relays cannot decrypt traffic. Status is **beta**. Repeated certificate requests can hit Let's Encrypt rate limits. — [Tailscale Funnel](https://tailscale.com/kb/1223/funnel)
- Security commentary: one toggle moves a service like Grafana from mesh-only to public. — [Attack Research: Funnel exposure](https://www.attackresearch.com/post/private-until-it-isn-t-frictionless-exposure-via-tailscale-funnels)

**Tailscale Services (TailVIPs)**
- Each Service has a MagicDNS name and its own IPv4/IPv6 pair (TailVIPs), referenced as `svc:<name>`. Hosts advertise with `tailscale serve --service=svc:web-server --https=443 127.0.0.1:8080`. Hosts **must be tagged devices** with an active advertisement and an approval, manual (Services page) or automatic via `autoApprovers`. Access still requires a **grant** with `svc:` as the destination. Services launched in beta on 2025-10-28. — [Tailscale Services](https://tailscale.com/kb/1552/tailscale-services); [Services beta blog](https://tailscale.com/blog/services-beta)
- Community report: the host was approved but unreachable until a grant named the `svc:` destination. — [TrueNAS forum](https://forums.truenas.com/t/tailscale-services-not-working/61114)
- The client exposes `tailscaled_serve_inbound_bytes_total` / `tailscaled_serve_outbound_bytes_total` for Services (requires v1.102.0+). — [Tailscale client metrics](https://tailscale.com/docs/reference/tailscale-client-metrics)

**tsnet**
- A Go library that embeds a tailnet node with a userspace network stack and no system daemon. Each app joins as its own node with its own identity and MagicDNS name. Fields include `Hostname`, `Dir`, `AuthKey`, `ClientID`/`ClientSecret`, and `Ephemeral`. `srv.Up(ctx)` then `ListenTLS("tcp", ":443")` mints a certificate when tailnet HTTPS is on; `Listen` gives plain TCP and `ListenFunnel` public exposure. `Dir` must be unique per node in a multi-node binary. `ListenTLS` was added in v1.38.0. — [Tailscale blog, 2026-08-31](https://tailscale.com/blog/easier-building-with-tailscale); [tsnet pkg.go.dev](https://pkg.go.dev/tailscale.com/tsnet); [tsnet docs](https://tailscale.com/docs/features/tsnet.md)
- The same 2026-08-31 post introduces tailscale-rs (Rust, "experimental (pre-alpha)", Python/Elixir/C bindings planned), a Tailnets API for creating isolated tailnets, and Declarative Node Sharing (alpha, waitlist). — [Tailscale blog, 2026-08-31](https://tailscale.com/blog/easier-building-with-tailscale)

**Grants and ACLs**
- Grants need `src`, `dst`, and an `ip` (network) and/or `app` capability. The `ip` field takes forms like `"tcp:443"` and `"udp:53"`, ranges, or protocols. Deny by default. Multiple selectors form a union. Overlapping grants combine their capabilities; more specific grants do not override broader ones. — [Grants syntax](https://tailscale.com/kb/1538/grants-syntax); [Grant examples](https://tailscale.com/docs/reference/examples/grants)

**tailscaled client metrics**
- Requires v1.78.0+. Enable with `tailscale set --webclient`. Same-host read at `http://100.100.100.100/metrics`; remote scrape at `<device-tailscale-ip>:5252/metrics`, which needs a grant from the monitoring server to port 5252. Alternatives: `tailscale metrics write <file>` for node_exporter's textfile collector, or `tailscale metrics print`. — [Tailscale client metrics](https://tailscale.com/docs/reference/tailscale-client-metrics); [KB 1482](https://tailscale.com/kb/1482/client-metrics); [blog: client metrics](https://tailscale.com/blog/client-metrics)
- Key series: `tailscaled_inbound/outbound_{packets,bytes}_total`, `tailscaled_inbound/outbound_dropped_packets_total`, `tailscaled_health_messages`, `tailscaled_home_derp_region_id`, `tailscaled_advertised_routes`/`approved_routes`, `tailscaled_peer_relay_*`, `tailscaled_serve_*`. Pull only; the docs show no OTLP push. — [Tailscale client metrics](https://tailscale.com/docs/reference/tailscale-client-metrics)

**Prometheus discovery over the tailnet**
- I found no native `tailscale_sd_configs` in Prometheus. Third-party `http_sd_configs` providers:
  - **tailscalesd** (cfunkhouser; forks cyb3rjak3 and andy-v-h): uses a Tailscale API token and emits `__meta_tailscale_device_hostname` etc. The maintainer has been inactive. — [pkg.go.dev tailscalesd](https://pkg.go.dev/github.com/cfunkhouser/tailscalesd); [andy-v-h fork](https://github.com/andy-v-h/tailscalesd)
  - **tailfire**: http_sd and file_sd, 60s refresh. — [tailfire](https://github.com/fbegyn/tailfire)
  - **tailmon** (experimental). — [tailmon](https://beta.pkg.go.dev/github.com/jamessanford/tailmon)
  - **tsproxy**: a `prometheus` upstream option registers targets at `/sd`. — [tsproxy README](https://tangled.org/sr.aux1.dev/tsproxy/blob/main/README.md?code=true)
- **TSDProxy** (almeidapaulopt) is a Docker-label proxy (`tsdproxy.enable`, `tsdproxy.name`, `tsdproxy.container_port`, `tsdproxy.funnel`). It mounts the Docker socket and creates a tailnet node per container with MagicDNS HTTPS. Discovery is for exposure, not Prometheus. The v2.x line is stable; v3.0.0 was still beta/alpha, with the last release seen 2026-06-02. — [TSDProxy Docker Hub](https://hub.docker.com/r/almeidapaulopt/tsdproxy); [releasealert](https://releasealert.dev/github/almeidapaulopt/tsdproxy); [Unraid forum](https://forums.unraid.net/topic/190620-docker-compose-enable-tailscale-funnel-for-docker-uses-tsdproxy/)

**Ephemeral CI runners (GitHub Action)**
- `tailscale/github-action@v4`. Auth options, in recommended order: (1) **workload identity federation** (`oauth-client-id` + `audience`; needs scope `auth_keys` and workflow `permissions: id-token: write`), (2) OAuth client ID + secret, (3) a tagged, reusable, ephemeral, pre-approved auth key. `tags:` is required (e.g. `tag:ci`) and must exist in the policy. Each run creates a new ephemeral node, which logs out at the end and is removed by the control server. Federated-identity nodes are pre-approved under device approval. Also available: `ping:` (waits up to 3 min for connectivity), `version:`, and `use-cache:`. Requires runner image ≥ 2.237.1 (Node.js 24). — [Tailscale GitHub Action](https://tailscale.com/kb/1276/github-action); [workload identity](https://tailscale.com/kb/1276/workload-identity)
- Third-party v3-era note: Tailnet Lock setups need a pre-signed ephemeral reusable auth key rather than OAuth. — [taktile-org action](https://github.com/taktile-org/tailscale-github-action)

**Cost (official pricing FAQ)**
- Personal (free): up to **6 users**, unlimited user devices, **50 tagged resources** (extra $1/month each, self-serve), 3 ACL groups, **1,000 ephemeral minutes/month**. Standard $8/user/month (1,000 ephemeral min). Premium $18/user/month (10,000 ephemeral min). A device present for **>4 hours** stops drawing ephemeral minutes and counts as a tagged resource. Ephemeral overage price is unpublished ("contact sales"). Hard limits on tagged and ephemeral resources are **"not currently enforced"**, with email notice promised before enforcement. — [Tailscale pricing FAQ](https://tailscale.com/docs/reference/faq/pricing)
- A third-party report dates the 3→6 user change to 2026-04-08; that article has inconsistent dates. — [pbxscience](https://pbxscience.com/tailscale-overhauls-pricing-free-plan-now-supports-six-users-with-unlimited-devices/)

### Inferences
- **Grafana:** `tailscale serve --bg --https=443 http://127.0.0.1:3000` on dankserver, with Grafana bound to localhost and `[auth.proxy] header_name = Tailscale-User-Login` (Grafana auth-proxy config is general knowledge, not fetched). That gives passwordless SSO for human tailnet users. Tagged devices and bots get no identity header, so they need API tokens. **Phoenix** works the same way on a second `--https` port or path, or each becomes a Tailscale Service (`svc:grafana`, `svc:phoenix`). Services require dankserver to be a tagged device, which changes its ownership semantics. A Service also gives a stable name that survives moving the host.
- **Family and attorney PCs:** these are presumably user devices owned by other people. If they sit on the operator's tailnet they consume user seats (6 free); node sharing from their own tailnets is the alternative. Either way, write grants so those PCs can reach **only** the gateway's OTLP port, never the reverse, e.g. `{"src":["tag:fleet-win"],"dst":["tag:otel-gateway"],"ip":["tcp:4317","tcp:4318"]}`. Tagging a user's PC requires admin/tagOwner action, and tagged devices lose user identity in Serve headers.
- **Suggested tag model:** `tag:otel-gateway` (dankserver), `tag:monitor` (Prometheus host), `tag:server` (beep-worker, grok-bot-box-1), `tag:ci` (Actions runners), `tag:fleet-win`. Grants: `tag:monitor → tag:server,tag:otel-gateway : tcp:9100,tcp:5252,tcp:8888`; `tag:ci,tag:server,tag:fleet-win → tag:otel-gateway : tcp:4317,tcp:4318`; `autogroup:member → tag:otel-gateway : tcp:443` (Grafana/Phoenix via Serve).
- **CI cost:** a 10-minute job uses 10 ephemeral minutes, so about 100 such jobs/month fit in the free 1,000-minute pool, and enforcement is not currently active. **Self-hosted AWS runners that live more than 4 hours** count as tagged resources (50 free), not minutes. For short CI jobs it is cheaper and simpler to push only a summary span or metric at job end, or to emit OTLP through a public-but-authenticated ingress, than to join the tailnet on every run. Joining adds up to about 3 minutes of `ping:` connectivity wait in the worst case.
- **Discovery:** five or six hosts do not need dynamic service discovery. Static `targets` with MagicDNS names (e.g. `beep-worker:9100`) in `prometheus.yml` are more robust than an unmaintained `tailscalesd`. Revisit only if CI runners must be scraped, and they should push anyway.
- **tsnet relevance:** the MCP server is bun/TypeScript, not Go, so tsnet does not apply directly. tailscale-rs is pre-alpha. A small Go tsnet sidecar ("OTLP forwarder that is its own tailnet node") is possible but duplicates what tailscaled + otelcol already do.

### Gaps
- No official Tailscale doc found that lists the exact version requirement for `tailscale serve --service`, or whether Services left beta.
- No primary source for Grafana 13.x auth-proxy behaviour with Tailscale headers. Grafana's auth-proxy docs were not fetched.
- madjam002's `tailscale-prometheus-sd`, which uses the local API and Tailscale Services, appeared in search, but I did not verify its URL or maintenance status.

## Q4. Windows specifics: collector as a service, user-level install, battery/CPU budget, MCP-server telemetry

### Takeaway
Every mainstream agent installs on Windows as a SYSTEM/LocalSystem service through an admin MSI or installer (otelcol-contrib MSI, windows_exporter MSI, Alloy installer, `telegraf --service install`). None documents a non-admin user-level service. For the attorney's PC, either get one admin install of otelcol-contrib, or skip a host agent: have the MCP server emit OTLP (traces plus self-reported process metrics) to a local file spool or directly to the gateway over the tailnet. MCP-specific OTel semantic conventions exist (Development status) and define how stdio servers propagate context via `params._meta`.

### Cited Findings
- **otelcol-contrib on Windows:** the MSI from GitHub releases creates and starts an `otelcol-contrib` service. Silent install: `msiexec /i otelcol-contrib_<ver>_windows_x64.msi /qn COLLECTOR_SVC_ARGS='--config "C:\otelcol\config.yaml"'`. Manual alternative: `sc.exe create otelcol-contrib start=delayed-auto binPath="...otelcol-contrib.exe --config ..."`. Runs as `NT AUTHORITY\SYSTEM` by default. Validate with `otelcol-contrib.exe validate --config <path>`. Logs go to the Application event log, source `otelcol-contrib`. — [Coralogix Windows install (vendor)](https://www.coralogix.com/docs/external/telemetry-shippers/otel-installer/windows/); [Coralogix event logs (vendor)](https://coralogix.com/docs/opentelemetry/configuration-options/windows-event-logs-and-opentelemetry.md); [Last9: host metrics on Windows (vendor)](https://last9.io/docs/integrations/observability/host-metrics-on-windows.md)
- **windows_exporter:** the MSI installs a service; no non-admin mode is documented. — [windows_exporter README](https://github.com/prometheus-community/windows_exporter)
- **Alloy:** a LocalSystem service; the silent install needs Administrator; no user-level option is documented. — [Alloy Windows install](https://grafana.com/docs/alloy/latest/set-up/install/windows/)
- **Telegraf:** `telegraf.exe --service install`. — [Tencent tutorial (secondary)](https://cloud.tencent.com/developer/article/1465333)
- **Netdata** resource budget: 1–5% of a core and 100–200 MB RAM by default (generic). — [Netdata resource utilization](https://learn.netdata.cloud/docs/netdata-agent/resource-utilization/impact-on-cloud-vms)
- **MCP OTel semantic conventions** (status: Development): `mcp.method.name` is required. Span name is `{mcp.method.name} {target}`, where target is `gen_ai.tool.name`/`gen_ai.prompt.name` (e.g. `tools/call get_invoice`). Client and server spans are both defined. MCP has no native trace context, so `traceparent`/`baggage` travel in `params._meta`, and servers SHOULD use them as the parent. Transport-independent, covering stdio and Streamable HTTP. Use MCP conventions instead of generic RPC ones. MCP attributes are moving to the GenAI semconv repository. — [OTel semconv: MCP](https://opentelemetry.io/docs/specs/semconv/gen-ai/mcp); [MCP attribute registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/mcp/)
- Auto-instrumentation does not cover MCP application logic, so manual wrappers set `gen_ai.tool.name` and `gen_ai.operation.name=execute_tool`. — [Elastic Observability Labs](https://www.elastic.co/observability-labs/blog/mcp-tracing-opentelemetry-elastic-apm)

### Inferences
- **Three ways the stdio MCP server (bun-compiled .exe) can emit telemetry:**
  1. **Direct OTLP/HTTP over the tailnet** to `https://<gateway>.ts.net:4318`. Simplest. Needs Tailscale on the PC and a grant. Loses data whenever offline unless the SDK exporter buffers; JS SDK batch processors hold data in memory only (general knowledge).
  2. **File spool:** the server appends OTLP-JSON lines (one file per day, rotated) under `%LOCALAPPDATA%\<app>\telemetry\`. A collector (`filelog` receiver, or an OTLP-JSON file receiver if present in contrib; unverified) ships them later. This survives offline periods and Claude Desktop restarts, needs no network code in the extension, and works even before a collector is installed.
  3. **Local sidecar collector** on `127.0.0.1:4318` with `file_storage`. Best delivery semantics, but needs the admin install.
  Recommendation: (2) as the always-available floor plus (3) where an admin install is acceptable. Use (1) only for always-on hosts.
- **Stdio caveat:** the MCP server must never write telemetry to stdout, because stdout is the JSON-RPC channel. Exporter diagnostics must go to stderr or a file (general MCP knowledge).
- **Self-reported process metrics** answer "is practice-kg-mcp slowing the PC" without a host agent: the MCP server can sample its own `process.cpuUsage()`/`memoryUsage()`. That covers only the server itself, not system-wide contention. A host agent's process scraper (filter on `practice-kg-mcp.exe`, `Claude.exe`) answers the comparative question.
- **Battery budget:** set hostmetrics `collection_interval` to 60s, keep the process scraper `include` list tight, and keep the event log receivers to Application/System with `start_at: end`. These limit wakeups. No measured battery numbers were found.
- **Client confidentiality (law-firm PC):** telemetry should carry no document content. Restrict attributes to tool name, latency, error type, and sizes, and leave out tool arguments and results. This matches the operator's corpus-hygiene rule of keeping client material out of shared stores.

### Gaps
- No primary OpenTelemetry doc on the Windows MSI found in this pass; vendor docs only. Current MSI filename and version unverified.
- No documented way to run otelcol, Alloy, or windows_exporter as a **per-user** service without admin. A Task Scheduler "at logon" task running the binary as the user is plausible but unverified, and the process scraper would then be unable to read other users'/SYSTEM processes.
- No measured CPU/battery impact for otelcol-contrib on a Windows laptop.
- Whether Claude Desktop itself emits OTel for extensions is unknown and was not researched.

## Q5. Cohesive fleet dashboard: patterns and adoptable Grafana dashboards

### Takeaway
Adopt **1860 (Node Exporter Full)** for the Linux hosts and **24390 or 23942** (windows_exporter v0.31+) for Windows as drill-downs. Build one custom "Fleet Overview" landing dashboard: a per-host stat row from `up`/heartbeat plus tailscaled health, service-health tiles, and an agent-session panel sourced from Phoenix/OTLP span metrics. I found no community dashboard covering otel `hostmetrics` naming that was worth adopting from a verified source.

### Cited Findings
- **1860 Node Exporter Full**: graphs nearly all node_exporter metrics; wants `--collector.systemd --collector.processes`. Forks such as 12486 have been merged back into 1860. — [grafana.com 1860](https://grafana.com/grafana/dashboards/1860/revisions); [12486](https://grafana.com/grafana/dashboards/12486-node-exporter-full/)
- Windows: **24390** "Windows Exporter Dashboard 2025", compatible with windows_exporter 0.31.3. **23942** adapts 20763 for v0.31+. **20763** is "2024" (datasource UID fix sometimes needed). **14694** is 2021-era, targeting exporter 0.16.0, and is prone to "No data". **15794** is a fork of 14694. — [24390](https://grafana.com/grafana/dashboards/24390-windows-exporter-dashboard-2025/); [23942](https://grafana.com/grafana/dashboards/23942-windows-exporter); [20763](https://grafana.com/grafana/dashboards/20763); [14694](https://grafana.com/grafana/dashboards/14694-windows-exporter-dashboard/); [15794](https://grafana.com/grafana/dashboards/15794)
- **11745** "Windows Host Metrics | Base (Fixed)" exists. Its data source and naming were not verified. — [11745](https://grafana.com/grafana/dashboards/11745-windows-host-metrics-base-fixed/)
- tailscaled metrics available for per-host network and health tiles: `tailscaled_health_messages`, `tailscaled_home_derp_region_id`, byte/packet counters, dropped packets. — [Tailscale client metrics](https://tailscale.com/docs/reference/tailscale-client-metrics)
- MCP spans (`mcp.method.name`, `gen_ai.tool.name`) provide the labels for an "agent sessions / tool calls" panel. — [OTel semconv: MCP](https://opentelemetry.io/docs/specs/semconv/gen-ai/mcp)

### Inferences
- **Naming mismatch:** dashboards 1860 and 24390 key on Prometheus exporter names (`node_cpu_seconds_total`, `windows_cpu_time_total`). OTel hostmetrics pushed through OTLP into Prometheus lands as `system_cpu_time_seconds_total` etc., so those dashboards will show nothing for OTel-agent hosts. Choose one naming per host class: either keep exporters wherever Prometheus-native dashboards matter, or build the overview on OTel semconv names. This argues for running windows_exporter or Alloy on Windows if 24390 is to be used as-is.
- **Fleet Overview layout:**
  - Row 1: one stat card per host (repeat by `host` variable). Show up/last-seen (`time() - timestamp(last heartbeat)` for push hosts), CPU%, mem%, disk%, and tailscaled health messages.
  - Row 2: service health for Prometheus, Grafana, Phoenix, otel gateway (`otelcol_exporter_queue_size`/`_capacity`, `otelcol_receiver_refused_*`), and the MCP servers (error rate and p95 of `tools/call` spans via a spanmetrics connector).
  - Row 3: agent sessions. Phoenix trace counts per host per day, and top tools by latency.
  - Row 4: per-process CPU/RAM for watched processes (`practice-kg-mcp`, `Claude`) on the Windows PCs.
  - Link each card to 1860/24390 drill-downs through data links.
- **Unified `host.name`:** set the `resource` processor or `resourcedetection` so OTLP-pushed, Prometheus-scraped, and Phoenix data share one host label, ideally the MagicDNS short name. This is the key to the "single pane".

### Gaps
- No verified community Grafana dashboard for OTel `hostmetrics` (semconv names) on Prometheus was found.
- Grafana 13.x-specific dashboard features (e.g. dynamic dashboards, repeat-by-row behaviour) were not researched.
- Beszel's built-in UI as an alternative "fleet overview" was not compared in depth.
