# Dankserver deployment and telemetry audit

Date: 2026-10-27. Scope: read-only inspection of the local dankserver repository and relevant beep-effect historical contracts. No remote requests, secrets, raw traces, transcript content, deployment, service operation, or data changes. This report is the only authored artifact. Paths prefixed `dankserver/` refer to the sibling repository; other paths refer to beep-effect. Line references describe inspected local source, not verified host state.

## Principal finding

Phoenix is a retained, filtered analytical projection, not a census of agent activity. The displayed 6,674 traces / 285 sessions cannot establish collection completeness. There are two different ingestion routes, intentional span exclusion, a short trace-retention horizon, historical counter collisions, unproven remote-worker instrumentation, and scheduled ingestion outages without a repository-managed durable queue contract. These warrant a coverage ledger before changing dashboards or treating totals as performance measures.

## Live evidence supplied by the parent audit

The parent agent used the canonical SSH wrapper and reported healthy Phoenix **20.23.0** and collector **0.163.1**. On October 27, monitoring backup ran **03:45:08–03:45:31 UTC (23 seconds)** and Phoenix backup ran **04:00:18–04:00:42 UTC (24 seconds)**; both succeeded. This supersedes the historical October 26 receipt's unknown service/backup status for these observations only. It establishes short, non-overlapping successful backup runs on that date, not zero telemetry loss or a general maximum outage. The parent owns the underlying live receipt; this agent made no remote calls.

The parent also inspected a live `transform/prom-label-collisions` processor absent from the local template. It moves `os.version` to `os.version.inherited` when `os_version` already exists and is inserted into the metrics pipeline. Targeted searches of dankserver Ansible/docs and relevant beep-effect telemetry goals found no corresponding managed repair or October 24 receipt. The local template's full processor/pipeline definitions (`roles/monitoring/templates/otel-config.yaml.j2:7-56,72-81`) omit it. **A future normal render can remove this live repair.** Preserve the exact deployed transform in a reviewed reconciliation before deployment; do not infer its complete behavior from its name. Collector config history last changed September 3 (`56596c5`), with earlier August 17 privacy and August 16 filtering changes.

### Default-project health-check contamination

The deployment probe creates a fresh random trace named `ansible-phoenix-health` with only a service resource attribute and no explicit project or session (`roles/phoenix/tasks/main.yml:295-324`). It posts directly into Phoenix (`329-334`). Consequently it bypasses the native filter and project stamp and can populate the default project with synthetic successful traces; project routing must be confirmed against the live server defaults. These traces cannot establish real harness coverage, have no human-task/session identity, and can distort default-project latency/error totals. The probe can repeat on retries (`344-346`). Future organization should assign deployment canaries an explicit operations project or an explicit synthetic filter; no deletion or project mutation was performed here.

## Deployment and counting contract

| Surface | Local repository contract | Meaning and limit |
| --- | --- | --- |
| Phoenix direct | Tailnet `:8447` → host loopback `:6006`; `docs/phoenix.md:13-20` | UI/API/MCP and ai-metrics forwarder. Bypasses the monitoring collector's scrubber, allowlist and project stamp (`ansible/roles/monitoring/templates/otel-config.yaml.j2:48-56`). |
| Native harness OTLP | Historically tailnet `:8448` → loopback `:4318`; beep-effect `goals/harness-otel-adoption/history/p1-rollout-evidence.md:16-27` | Collector receives native traces and metrics. Tailnet route was manually created in the rollout evidence; current route state remains unknown. |
| Collector traces | `otel-config.yaml.j2:28-32,69-81` | Keeps names beginning `claude_code.` or `ai_metrics.`, plus exact `handle_responses`; stamps project `harness-otel` (`group_vars/all.yml:924-927`). Every other span name is intentionally excluded. |
| Collector metrics | `otel-config.yaml.j2:58-77` | Exposes metrics for Prometheus; trace name filter does not apply to metrics. Resource attributes are copied into labels. Metric expiration is 180 minutes. |
| Trace retention | `group_vars/all.yml:973-978`; `roles/phoenix/tasks/main.yml:361-409` | Managed default retention target is 14 days. A seven-day view is inside this horizon if the live policy and timestamp behavior match. Retention cannot explain all seven-day gaps by itself. |
| Metrics retention | `group_vars/all.yml:928`; `roles/monitoring/templates/compose.yaml.j2:32-42` | Prometheus target is 10 years. Long retention does not recover events never exported or lost before scraping. |

The allowlist comment records approximately 94% of 32.19 million historical rows as unwanted runtime spans, including `zbus read_socket`; it deliberately accepts orphan `handle_responses` children after their parents are dropped (`otel-config.yaml.j2:15-27`). This is a volume-control decision, not proof of current packet loss. A new or renamed native span silently becomes excluded. Trace topology, root-span counts and session associations therefore cannot be assumed intact.

Do not compare the direct forwarder's project to `harness-otel` as interchangeable observations. Their inclusion, privacy processing, event semantics and retry behavior differ. Likewise, traces, spans, sessions, process starts and human tasks require separate definitions and denominators.

## Findings with evidence

### 1. Daily backup deliberately removes native ingestion and monitoring together

Evidence: `dankserver/ansible/roles/monitoring_backup/templates/dankserver-monitoring-backup.sh.j2:201-220` stops the monitoring service, backs up primary and secondary repositories serially, then cleanup starts the service (`164-186`). The service's `ExecStop` invokes Compose `down`, covering Grafana, Prometheus, node-exporter and OTel (`roles/monitoring/templates/monitoring-stack.service.j2:1-13`; `compose.yaml.j2:3-77`). The daily schedule is 03:45 in the host's systemd calendar timezone (`group_vars/all.yml:1089`).

Consequence: both native metrics and traces lose their receiver during the entire cold-backup window; monitoring also cannot observe its own interruption while stopped. Persisting Prometheus storage does not preserve in-flight collector state. Actual event loss depends on sender flush and retry behavior and backup duration; neither is established by this inspection.

Proposed confirmation: read service start/stop timestamps and backup elapsed times, container restart timestamps, collector accepted/refused/sent/failed counters, and scrape gaps around daily windows. Obtain only timestamps/status/counters. Do not initiate a backup or stop services as an audit probe.

### 2. Phoenix backup removes the destination through both sequential backups

Evidence: `roles/phoenix_backup/templates/dankserver-phoenix-backup.sh.j2:118-138` stops Phoenix, checkpoints SQLite and runs both repositories; restart happens only in EXIT cleanup (`92-104`). Health may take up to 60 probes with sleeps (`37-51`). Schedule is daily 04:00 (`group_vars/all.yml:1007`), 15 minutes after monitoring backup begins.

Consequence: direct-forwarder ingestion is unavailable; a running collector cannot deliver traces until Phoenix returns. Longer monitoring backups can overlap the Phoenix window. The scripts do not coordinate these two system-level backup locks. This is a known availability tradeoff for cold SQLite backup; it needs measured outage duration and a recovery contract.

Proposed confirmation: compare the two backup windows, actual Phoenix health recovery duration and forwarder backlog/replay counters. The host's calendar timezone must be read rather than inferred from the workstation.

### 3. No explicit durable collector queue or collection-loss instrumentation

Evidence: the complete `roles/monitoring/templates/otel-config.yaml.j2:1-81` contains no `file_storage` extension, persistent exporter storage, or explicit `sending_queue`/`retry_on_failure` sizing and horizon. `compose.yaml.j2:66-80` mounts configuration and CA trust only, with no collector state volume. `prometheus.yml.j2:8-19` scrapes the collector's application-metric exporter, not a separately configured collector self-telemetry endpoint.

Consequence: repository ownership does not specify how much traffic survives outage or collector restart. Exporter defaults may provide bounded memory queue/retry; absence of explicit settings is not proof that retries are disabled. However, no persistent spool is configured. The percentage-based memory limiter (`otel-config.yaml.j2:9-14`) also has no corresponding container memory limit in Compose, so the effective cap depends on runtime memory detection.

Proposed confirmation: read running collector version, rendered config, effective container memory limit and sanitized self-metric names/counts; establish accepted → filtered → queued → sent → rejected accounting. Validate recovery in an isolated fixture, not by interrupting production.

### 4. Backup alerts omit missing-series detection and do not cover ingestion health

Evidence: `roles/monitoring/templates/prometheus-alerts.yml.j2:1-113` defines backup, maintenance and restore-drill rules only. Expressions compare existing gauges to zero or age; none use absent-series checks. Missing metrics therefore do not satisfy these expressions. The compose and Prometheus templates contain no Alertmanager service or alerting destination (`compose.yaml.j2:1-87`, `prometheus.yml.j2:1-19`). No repository-managed Grafana contact points or notification policies were found in the inspected provisioning surface.

Consequence: a deleted or never-created backup textfile can evade the intended rule, and there is no repository-managed alert for stalled ingestion, collector refusal, exporter queue exhaustion, absent source heartbeat or trace lag. Rule evaluation alone is not evidence of delivery to the operator. A manually configured Grafana notification path may exist; local source does not prove its absence on the host.

Proposed confirmation: inspect loaded rules and active alert status, the expected textfile series inventory, sanitized alert routing/contact-point presence and most recent notification delivery status. Test absent-source behavior with fixtures.

### 5. Phoenix backup can advertise successful backups despite failed service recovery

Evidence: `roles/phoenix_backup/templates/dankserver-phoenix-backup.sh.j2:82-89` marks each repository successful when restic succeeds. Cleanup records a failed restart in shell exit status (`95-104`), but `write_metrics` publishes those unchanged repository success flags (`63-71,99`). A failed run also overwrites the last-success timestamp with zero (`63-69`), rather than preserving the last successful time as the monitoring backup does (`monitoring_backup...sh.j2:35-55,103-145`).

Consequence: backup gauges can stay green after snapshots succeed but Phoenix fails to return. Last-success history is inaccurate after a snapshot failure. This is a definite source-level reporting defect, independent of whether a live failure has occurred.

Proposed confirmation: compare service result and health status against published gauges; exercise restart failure in a shell fixture with mocked commands. Preserve separate snapshot-success and service-recovery status in any future implementation.

### 6. Native telemetry for the new worker is not provisioned by its installer

Evidence: `dankserver/scripts/worker/install-development-tools.sh:49-65` installs coding CLIs and creates a fresh Codex configuration containing model and effort only. Existing configuration is preserved. This file contains no native OTel exporter setup for Codex or Claude. Historical native rollout evidence configures the workstation user and shell wrappers, not the separate remote worker account (`beep-effect/goals/harness-otel-adoption/history/p1-rollout-evidence.md:19-30`).

Consequence: worker installation does not establish coverage. A worker's existing config or separately inherited environment may enable it, so current remote absence must not be asserted yet. Direct binaries, proxy wrappers and noninteractive services need their own attribution and exporter verification.

Proposed confirmation: inspect only an allowlisted telemetry-settings projection for each active worker entry point and service environment. Report endpoint destination class, content-capture flags, attribution keys and configured/unconfigured status; never dump full environment or configuration files.

### 7. Route ownership and retention verification are incomplete contracts

Evidence: the `:8448` tailscale route is recorded as an imperative rollout action (`p1-rollout-evidence.md:16-18`); current dankserver source references it in comments (`group_vars/all.yml:924-927`) but no managed route declaration was found. Phoenix retention reconciliation and verification read `edges[0]`, while the mutation targets a fixed policy ID (`roles/phoenix/tasks/main.yml:376-408`). They do not verify the returned policy ID or enumerate project-policy assignments.

Consequence: service redeployment checks do not prove the external native-ingestion route survives route changes, nor that every analytical project has the intended retention. The first-policy check can inspect a different policy if ordering changes.

Proposed confirmation: sanitized Tailscale Serve route mapping and Funnel-disabled status; metadata-only listing of project/policy IDs, names, assignments and retention durations. Prove project-policy binding rather than assuming array order.

### 8. Deployment health proof stops before end-to-end accounting

Evidence: `roles/phoenix/tasks/main.yml:271-346` posts a synthetic span directly inside Phoenix and accepts HTTP 200. `349-359` verifies shared Docker network attachment. That probe bypasses tailnet routing, collector filtering, the forwarder and sender configuration; it does not query the stored synthetic trace. Its `ansible-phoenix-health` span name would be excluded by the native allowlist if sent through that route.

Consequence: a healthy deployment result can coexist with broken native collection or successful HTTP acceptance without proven downstream analytical visibility.

Proposed confirmation: after separately authorized synthetic writes, use an allowlisted canary name with a non-content correlation token, verify storage and project assignment through each route, and reconcile expected/accepted/stored counts. Until then, use existing sanitized canary metadata only.

## Historical evidence that changes interpretation

- The July coverage audit explicitly found Codex per-process cumulative counters collapsing under identical Prometheus labels: approximately 4.2 observed thread starts versus 208 rollout starts. Codex session counts must come from an appropriate event/session ledger, not `increase(codex_thread_started_total)`; token sums were described as lower bounds. Evidence: `goals/harness-otel-adoption/history/p2-coverage-verification.md:99-127`.
- The same audit records approximately 98.5% Claude main-session coverage for one historical day; subagent/noninteractive sessions explain many additional metric session IDs. That result is scoped to its versions and interval, not a current fleet guarantee (`p2-coverage-verification.md:16-44`).
- Harness source research already warned that durable client spooling and exact queue horizons were undocumented (`goals/harness-otel-adoption/research/p0-config-surfaces.md:74-80`).
- The latest inspected maintenance receipt explicitly says October 26 host authentication failed before mutation; current health, backups and worker versions remained unverified. The newer upstream versions mentioned there were not deployed by that run (`dankserver/docs/dankserver-update-2026-10-26.md:23-43`). Do not report local pins as running versions.
- The old July update plan's statement that Phoenix was outside management is historical. Its completed summary and current Phoenix role document the later managed deployment and restore proof (`docs/dankserver-full-update-plan-2026-07-30.md:55-63,119-132`; `docs/phoenix.md:3-24`).

## Next live audit, bounded to metadata

1. Establish current deployed identity: image tags/digests, collector version, service states, container health/restart timestamps, mounted storage and disk capacity. Do not read trace tables or environment secrets.
2. Read tailnet-only route mappings and auth boundary, then compare against the two intended endpoints. Preserve retired OpenClaw state per dankserver AGENTS.md.
3. Enumerate project aggregate counts and time bounds, filter-policy version, retention assignment and source heartbeat metadata. Keep counts distinct by ingestion route and source mode.
4. Read backup timer history, service results, elapsed outage periods and the health gauges/notification delivery path. Correlate collector restarts with backup windows.
5. Inventory active launch surfaces across workstation, clones/worktrees and remote worker accounts through sanitized settings projections. A clone is not automatically a new source; a user account, launcher or process environment may be.
6. Add controlled fixture validation for filtering, counter collision, retry expiry, collector restart, missing metrics and backup restart failure before authorizing implementation. Any live synthetic trace or outage experiment requires explicit scope beyond this read-only audit.

The first-principles rebuild should preserve immutable source identity and event IDs, publish expected-versus-observed coverage by source/mode, retain filtering reasons separately from delivery failures, and distinguish task outcomes from transport activity. Speed and quality comparisons become meaningful only after those denominators are observable.


## Final parent-audit worker follow-up

After the administrator-account read failed, the parent used the repo-owned dedicated worker SSH route for a read-only own-account projection. Worker Codex config exists with no OTEL keys; worker Claude user settings are absent. See `dankserver-producer-settings.json`. This resolves file-access uncertainty for those two paths, but effective process/environment/system overrides and end-to-end worker traffic remain unverified. No permissions or configuration changed.
