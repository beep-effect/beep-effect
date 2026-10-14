# Fleet census, dankserver control plane, and hub-host enrollment (2026-10-14)

Research lane for D1, which defers the store choice until `beep-worker` and the
incoming Linux box are fully enrolled. This file builds on
`research/handoff/tailnet_fleet_telemetry.md` and `backend_landscape.md` without
repeating them, and it fills the gaps they list: Prometheus OTLP flags, Services
GA status, and Grafana auth-proxy docs.

Conventions used here:
- `dankserver:<path>` means a path relative to `~/YeeBois/projects/dankserver`, read
  at commit `afeb76e`.
- The tailnet DNS suffix appears as `<tailnet>.ts.net`.
- No IP addresses, login names or emails appear in this file.
- Every live probe was read-only: `tailscale status`, `ssh -o BatchMode=yes`,
  `tailscale serve status`, `systemctl list-timers` and `docker ps`. No sudo was used.

## 1. Fleet census (live `tailscale status`, 2026-10-14)

| Node (MagicDNS) | OS | Owner class | State | Hub candidate? |
| --- | --- | --- | --- | --- |
| dankstation (self) | linux (CachyOS) | operator-owned, **untagged** | online | no (workstation) |
| dankserver | linux, Ubuntu 24.04.5, kernel 6.8 | operator-owned, **untagged** | online, idle | today's live truth |
| beep-worker | linux | operator-owned, **untagged** | online (direct LAN path) | **yes (D1)** |
| ai | linux | operator-owned, **untagged** | online | possible "incoming box" (UNVERIFIED) |
| grok-bot-box-1 | linux | **tagged** (`tag:grok-bot`) | online | no (bot host) |
| muse | (OS not reported) | operator-owned | offline 6h | unknown |
| Windows PC A | windows | operator-owned | offline 1h | no (laptop/desktop agent) |
| Windows PC B | windows | **second tailnet user** | offline 4h | no (agent; attorney PC) |
| Android phone, iPad | android / iOS | operator-owned | offline 6d / 36d | no |

Findings:
- **Only one node is tagged** (`grok-bot-box-1`). dankserver reports `Tags: null`,
  even though its Ansible pins `tailscale_tags: ["tag:server"]`. The join task is
  gated by `tailscale_enable_up: false`, so the tag was never applied
  (`dankserver:ansible/group_vars/all.yml:40-42`,
  `dankserver:ansible/roles/tailscale/tasks/main.yml:50-57`). Because no candidate
  hub is tagged, none can host a Tailscale Service today (see §5).
- dankserver's self CapMap carries `funnel`, `https`, `is-admin`, `is-owner`, `ssh` and
  `funnel-ports?ports=443,8443,10000`. Funnel is therefore *permitted* on 8443, the
  port Grafana is served on, even though Grafana is currently tailnet-only (live
  `tailscale status --json`).
- **Hub-candidate specs (read-only ssh):**
  - **dankserver.** i7-7700K with 8 threads and 15 GiB RAM (about 10 GiB available).
    Disks: root on a 3.6 TB LVM; `/srv/backup` (3.6 TB, 2% used);
    `/srv/backup-secondary` (3.6 TB, 2%); `/srv/data/monitoring` (dedicated 3.6 TB
    `sdd1`, 4.5 GB used). It also has an **unpartitioned 1.8 TB NVMe**.
  - dankserver services: docker, nginx, fail2ban, smartmontools, tailscaled,
    nvidia-persistenced, and a cloudflared tunnel.
  - dankserver containers: `grafana/grafana:13.2.3`, `prom/prometheus:v3.15.0`,
    `otel/opentelemetry-collector-contrib:0.162.0`, `prom/node-exporter:v1.12.1`,
    `arizephoenix/phoenix:20.19.0`, plus OpenClaw sandboxes.
  - **beep-worker.** `ssh` failed with "Host key verification failed", so there is no
    known_hosts entry from dankstation. Specs: **UNVERIFIED**.
  - **ai.** Port 22 refused. It may only accept Tailscale SSH. Specs: **UNVERIFIED**.
  - Which box is "incoming" is **UNVERIFIED**. `ai` is the only in-scope
    untagged, unexplained Linux node online, and it does not appear in
    `dankserver:ansible/inventory/hosts.yml`, which lists dankserver only.
- **MagicDNS health warning on dankstation:** "systemd-resolved and NetworkManager
  are wired together incorrectly; MagicDNS will probably not work"
  ([tailscale.com/s/resolved-nm](https://tailscale.com/s/resolved-nm)).
  - Locally, both `systemd-resolved` and `NetworkManager` are active, but
    `/etc/resolv.conf` is a plain file rather than the resolved stub symlink. That is
    the documented misconfiguration.
  - Impact: any static `beep-worker:9100`-style MagicDNS target, or a
    `*.ts.net` URL resolved *from dankstation*, can fail. The fix is NM `dns=systemd-resolved`
    or a stub symlink. That is a host change, so this lane did **not** make it.

## 2. dankserver control plane (read-only)

**What `docs/monitoring-stack.md` says** (`dankserver:docs/monitoring-stack.md`)
- The repo manages Grafana, Prometheus, node-exporter, the OTel Collector,
  dashboards and provisioning, a host textfile exporter, and restic backups with
  restore drills (lines 5-13).
- State is bind-mounted, not stored in Docker volumes: `/srv/data/monitoring/{prometheus,grafana}`
  on dedicated `sdd1` with label `monitoring-data` (lines 15-31; disk vars in
  `dankserver:ansible/group_vars/all.yml:900-906`).
- Prometheus retention is **`10y`** (doc lines 76-84; `all.yml:923`; flag at
  `dankserver:ansible/roles/monitoring/templates/compose.yaml.j2:33`).
- Grafana runs SQLite (`grafana.db`). The expected dashboard UIDs are
  `dankserver-backup-integrity`, `dankserver-host-overview` and
  `openclaw-operations` (doc lines 86-96).

**Compose topology** (`dankserver:ansible/roles/monitoring/templates/compose.yaml.j2`)
- Grafana publishes on `127.0.0.1:3000` (lines 15-16). Its admin password is read
  from a file sourced from 1Password.
- Prometheus has **no host port**. Its command line lacks `--web.enable-otlp-receiver`
  and `--web.enable-remote-write-receiver` (lines 26-34), so today it can only scrape.
- node-exporter uses the host rootfs plus a textfile collector (lines 43-58).
- The collector publishes `127.0.0.1:4318` only (lines 66-67). It joins Phoenix's
  external docker network `beep-ai-metrics-dankserver_default` (lines 76-79).

**Prometheus scrape config** (`dankserver:ansible/roles/monitoring/templates/prometheus.yml.j2:8-19`)
- Three static jobs: `prometheus`, `node` (local node-exporter only) and
  `openclaw`, which scrapes the collector's Prometheus exporter on `:9464`.
- **No other fleet host is scraped today.**

**Collector pipeline** (`dankserver:ansible/roles/monitoring/templates/otel-config.yaml.j2`)
- Receivers: `otlp` with **HTTP only**, `0.0.0.0:4318`. There is no gRPC receiver
  (lines 1-5).
- Processors:
  - `memory_limiter` at 70%, with a 20% spike limit (lines 11-14).
  - `filter/traces`, a fail-closed **allowlist** of `claude_code.*`, `ai_metrics.*`
    and `handle_responses` (lines 28-32). The rationale is in lines 15-27: Codex
    zbus spans made up about 94% of rows and about 18 GiB.
  - `resource/scrub-pii` and `attributes/scrub-pii`, which delete `user.email`
    (lines 40-47).
  - `resource/project`, which upserts `openinference.project.name` (lines 52-56).
    The value is `harness-otel` (`all.yml:919-922`).
  - `batch`.
- Exporters:
  - `prometheus` (pull exporter) with `send_timestamps: true`,
    `metric_expiration: 180m` and `resource_constant_labels: ["*"]` (lines 59-65).
  - `otlphttp/phoenix` to `beep-ai-metrics-phoenix:6006/v1/traces` (lines 69-70).
- Pipelines: metrics go `otlp` → `prometheus` exporter; traces go `otlp` → Phoenix.
  **There is no logs pipeline** (lines 72-81).
- **Consequence for laptops:** metrics travel through a *pull* exporter with
  `metric_expiration: 180m`. A backlog replayed from a laptop would be flattened to
  the latest value per series and then scraped, so history is lost. To keep
  multi-day backfill, the collector must push, either `otlphttp` to Prometheus's
  OTLP receiver or `prometheusremotewrite` (see §4).

**Phoenix** (`dankserver:docs/phoenix.md`, `dankserver:ansible/roles/phoenix/tasks/main.yml`)
- Phoenix is pinned by version *and* digest: `20.19.0`, with rollback `20.16.0`
  (`all.yml:954-963`). Its data lives in the external docker volume
  `beep-ai-metrics-dankserver_phoenix_data`, which is **not** a bind mount
  (`phoenix.md` lines 7-26).
- MCP is on, OAuth is off, and **tailnet membership is the only access boundary**.
  "Do not add a Tailscale Funnel route for port `8447`" (`phoenix.md` ~lines 33-40).
- Trace retention is reconciled through GraphQL to **14 days**
  (`all.yml:972-973`; role `main.yml:361-410`).

**Restic** (`dankserver:ansible/group_vars/all.yml:24-32,1074-1097`; `docs/phoenix.md` "Backups")
- restic `0.19.1` is pinned by sha256.
- The repos are `/srv/backup/restic/dankserver-{monitoring,phoenix,clawhole}`, and
  each is mirrored at `/srv/backup-secondary/...`. Password files live at
  `/etc/restic/*.pass` and are never read here.
- Monitoring schedules:
  - Backup daily at 03:45.
  - Prune and check on Sundays at 04:45.
  - Restore drill on Sundays at 05:15 (`all.yml:1084-1089`).
  - Retention keeps 30 daily, 12 weekly and 12 monthly snapshots (`all.yml:1091-1093`).
- The backup script stops the user service before the snapshot
  (`dankserver:ansible/roles/monitoring_backup/templates/dankserver-monitoring-backup.sh.j2:153-214`).
- The drill restores `latest` into a temporary root. It then asserts that the
  Prometheus dir and `grafana.db` exist and queries dashboard UIDs with sqlite
  (`.../dankserver-monitoring-restore-drill.sh.j2:92-99`).
- The Phoenix backup stops Phoenix, checkpoints the WAL, snapshots to both repos,
  and waits on health. A rollback tag survives pruning (`docs/phoenix.md`, Backups).
- Every job writes `.prom` textfile metrics, and the alerts `Dankserver*BackupStale`
  and `*RestoreDrillFailed` are verified on apply
  (`dankserver:ansible/roles/monitoring/tasks/main.yml:570-602`). Live timers were
  confirmed for all nine `dankserver-{monitoring,phoenix,clawhole}-{backup,backup-maintenance,restore-drill}`.

**Tailscale Serve (live `tailscale serve status`, read-only)**

| HTTPS port | Backend | Exposure |
| --- | --- | --- |
| 443 `/` | 127.0.0.1:18789 (OpenClaw) | tailnet |
| 443 `/beep-effect` | 127.0.0.1:8080 (nginx, JetBrains indexes) | tailnet |
| 8443 | 127.0.0.1:3000 (**Grafana**) | tailnet |
| 8445 | 127.0.0.1:18789 | tailnet |
| 8446 | 127.0.0.1:3001 | tailnet |
| 8447 | 127.0.0.1:6006 (**Phoenix** UI/API/MCP) | tailnet |
| 8448 | 127.0.0.1:4318 (**collector OTLP/HTTP**) | tailnet |
| 10000 | 127.0.0.1:18810 (PR reviewer webhook) | **Funnel (public)** |

- Ansible manages only the 443 `/beep-effect` route (`dankserver:ansible/roles/jetbrains_indexes/tasks/main.yml:71-87`)
  and the OpenClaw routes (`dankserver:ansible/roles/openclaw/tasks/main.yml:5076-5131`).
- A grep found **no task that creates the 8443, 8446, 8447 or 8448 routes**. The
  monitoring role only *derives* Grafana's root URL as `https://<dns>:8443`
  (`dankserver:ansible/roles/monitoring/tasks/main.yml:34-40`). Treat these routes
  as unmanaged drift (moderate confidence: they may come from a playbook not grepped).
- `:8448` is an **unauthenticated OTLP ingest open to every tailnet node**,
  including the second user's PC. Any ACL that narrows it must be written down in
  the hub design.

**Tags and ACL as code** (`dankserver:infra/tailscale.tf:1-40`)
- Terraform renders `tagOwners` (each tag owned by `autogroup:admin`), one `accept`
  rule from `var.tailscale_acl_sources` to `<primary tag>:*`, and an SSH `check`
  rule.
- It is gated by `enable_tailscale_bootstrap` and exposes only an
  `tailscale_acl_preview` output. Whether the live policy matches this file is
  **UNVERIFIED** (the policy was not read). It uses legacy `acls`, not `grants`.

## 3. Proposed checkable "fully enrolled" definition and migration path (proposal only)

A host is **fully enrolled** when every check below exits 0. The checks are written
to run from dankstation or a CI lane. `$H` is the MagicDNS name, and `$ROLE_TAG` is
e.g. `tag:monitor`.

| # | Gate | Command (pass = exit 0) |
| --- | --- | --- |
| E1 | Tailnet tagged identity | `tailscale status --json \| jq -e --arg h "$H" '.Peer[]\|select(.DNSName\|startswith($h+"."))\|.Tags\|index("'$ROLE_TAG'")'` |
| E2 | Tag-based key never expires | same selector `\| .KeyExpiry == null` (tagged nodes default to no expiry; UNVERIFIED for this tailnet) |
| E3 | Non-interactive ops path | `ssh -o BatchMode=yes -o ConnectTimeout=5 $H true` (known_hosts plus key; this fails today on beep-worker) |
| E4 | Inventory membership | `ansible-inventory -i ansible/inventory/hosts.yml --host $H >/dev/null` (in the dankserver repo) |
| E5 | Data disk by label | `ssh $H 'findmnt -n -S LABEL=monitoring-data /srv/data/monitoring'` |
| E6 | Backup disks | `ssh $H 'findmnt /srv/backup && findmnt /srv/backup-secondary'` (or a documented off-host restic repo) |
| E7 | Disk headroom | `ssh $H 'test $(df --output=pcent /srv/data/monitoring \| tail -1 \| tr -dc 0-9) -lt 70'` |
| E8 | node_exporter scraped | `curl -sf "http://<prom>:9090/api/v1/query?query=up{instance=~\"$H.*\",job=\"node\"}" \| jq -e '.data.result[0].value[1]=="1"'` |
| E9 | SMART healthy | `ssh $H 'systemctl is-active smartmontools'`, plus a `node_textfile`/smartctl metric present |
| E10 | Units running | `ssh $H 'systemctl is-active docker tailscaled'`, plus `systemctl --user is-active monitoring-stack ai-metrics-phoenix` where those services are hosted |
| E11 | Timers armed | `ssh $H 'systemctl list-timers --no-legend \| grep -c -- "-backup.timer\|-restore-drill.timer"'` ≥ expected |
| E12 | restic reachable and clean | `ssh $H 'sudo -n restic -r <repo> --password-file /etc/restic/<x>.pass cat config >/dev/null'` (non-interactive only; a `sudo -n` failure is a fail, not a prompt) |
| E13 | Drill freshness | Prometheus `time() - dankserver_*_restore_drill_last_success_timestamp_seconds < 8*86400` (metric name UNVERIFIED; read it from the `.prom` templates) |
| E14 | Time sync | `ssh $H 'timedatectl show -p NTPSynchronized --value' \| grep -qx yes` (OOO windows and OTLP timestamps rely on it) |
| E15 | Serve declared, not drifted | `ssh $H 'tailscale serve status --json' \| jq -S .` equals the checked-in expected JSON |
| E16 | MagicDNS healthy | `tailscale status --json \| jq -e '.Health\|length==0'` on the host |

Suggested encoding: a `beep fleet enroll-check <host>` that emits one row per gate,
so "fully enrolled" becomes a schema-validated, all-pass result rather than a
judgement call.

**Migration path for TSDB, Grafana and Phoenix via restic** (proposal, run on the
target host with dankserver still live)
1. Enroll the target (E1-E16 green, except E8 for itself). Install the same pinned
   images (`all.yml` versions) and restic `0.19.1`.
2. Give the target **read access to dankserver's repos**. Either copy them with
   `restic copy` into a target-local repo (`--from-repo` plus a password file), or
   expose them through restic's REST/sftp backend over the tailnet. Do not
   rsync the live TSDB.
3. **Rehearse.** Run `restic restore latest --target /srv/restore-rehearsal` on the
   target. Then:
   - Start Prometheus read-only against the restored dir and run
     `promtool tsdb analyze` on it.
   - Open Grafana with the restored `grafana.db` and compare dashboard UIDs with
     the drill's sqlite query.
   - Run Phoenix with the restored volume and check the `/healthz` and GraphQL
     retention probe (same probes as the roles).
4. **Cut over.**
   - Stop dankserver's stack. The backup script already stops the service, so take
     one final snapshot and record its ID.
   - On the target, restore that snapshot ID (not `latest`) and start the stack.
   - Repoint the Serve routes. Once the target is tagged, move them to a
     `svc:grafana` / `svc:phoenix` / `svc:otlp` Service so clients keep stable names
     across hosts (§5).
5. **Gap fill.** Senders that buffer (`file_storage` queues) replay into the new
   Prometheus through OTLP. Whatever falls inside the OOO window is accepted (§4).
   dankserver's TSDB stays as a read-only historical source until retention is
   judged.
6. **Rollback.** Restart dankserver's stack. Its data dir is untouched because the
   restore went to the target. Flip the Service hosts back.
7. **Phoenix specifics.** Its data is a docker *named volume*. Restore the volume
   tree, and keep the pinned digest identical across hosts. Upgrades follow the
   existing rehearse script (`dankserver:scripts/ansible/rehearse-phoenix-upgrade.sh`)
   and are never combined with a move.

## 4. Prometheus 3.x native OTLP receiver and out-of-order ingestion

- **Enable** with `--web.enable-otlp-receiver`. The endpoint is
  `POST /api/v1/otlp/v1/metrics` (HTTP only). For SDK env vars, the base is
  `http://<host>:9090/api/v1/otlp`
  ([Prometheus OTel guide](https://prometheus.io/docs/guides/opentelemetry/)).
- **`otlp:` block keys** ([configuration docs](https://prometheus.io/docs/prometheus/latest/configuration/configuration/)):
  - `promote_resource_attributes` (default `[]`).
  - `promote_all_resource_attributes` with `ignore_resource_attributes`. This is
    mutually exclusive with the explicit list, and the docs warn of series churn.
  - `keep_identifying_resource_attributes`, which adds `service.*` to `target_info`.
  - `translation_strategy` (see the next bullet).
  - `convert_histograms_to_nhcb`, `promote_scope_metadata`,
    `label_name_underscore_sanitization` and `label_name_preserve_multiple_underscores`.
- **`translation_strategy` values:** `UnderscoreEscapingWithSuffixes` (default),
  `UnderscoreEscapingWithoutSuffixes`, `NoUTF8EscapingWithSuffixes` and
  `NoTranslation`. `NoTranslation` is experimental, with collision and PromQL-UX
  warnings (same source).
- **Delta temporality** needs the experimental `--enable-feature=otlp-deltatocumulative`.
  Otherwise send cumulative ([guide](https://prometheus.io/docs/guides/opentelemetry/)).
- **Out-of-order window.** Set it under `storage: tsdb: out_of_order_time_window`.
  The default is `0s`, which disables it. The guide suggests `30m` for collector
  batching.
  - A sample is accepted when `timestamp >= TSDB.MaxTime - out_of_order_time_window`.
    The window is measured back from the **newest sample in the whole TSDB**, not
    from wall-clock time and not per series.
  - Outside the window a sample is rejected as "too old"
    ([PromLabs on 2.39](https://promlabs.com/blog/2022/10/05/whats-new-in-prometheus-2-39/);
    [PromLabs on OOO errors](https://promlabs.com/blog/2022/12/15/understanding-duplicate-samples-and-out-of-order-timestamp-errors-in-prometheus/)).
  - The 2.39 notes show `1d`. No documented hard maximum was found (UNVERIFIED).
    The cost is OOO head memory and later compaction work.
- **Can a laptop replay a multi-day backlog?** Yes, but only if all three of these
  hold:
  1. `out_of_order_time_window` is at least the longest offline period (e.g. `7d`).
  2. The sender *pushes* with original timestamps, through `otlphttp` to
     `/api/v1/otlp` or through `prometheusremotewrite`, and its queue is persisted
     (`file_storage`).
  3. The path does **not** go through dankserver's current `prometheus` pull
     exporter (§2), which keeps only the latest point.
  - Inference: because the window is anchored to the global MaxTime, always-on hosts
    keep moving MaxTime forward, so a 3-day backlog needs a window of 3 days or more
    even if the laptop's own series has no newer samples.
  - Inference: 15 GiB of RAM on dankserver makes a 7-day OOO window plausible at
    fleet cardinality, but this was not measured.

## 5. Grafana auth proxy with Tailscale identity, and Tailscale Services

- **Serve identity headers.** Serve adds `Tailscale-User-Login`, `Tailscale-User-Name`
  and `Tailscale-User-Profile-Pic`, and strips any client-supplied copies.
  - **Not populated for traffic from tagged devices**, and not populated for Funnel.
  - The backend should listen only on localhost, otherwise the headers can be spoofed.
  - Since 1.92, `--accept-app-caps` can forward a `Tailscale-App-Capabilities` header.
  - Source: [Tailscale Serve KB](https://tailscale.com/kb/1312/serve).
- **Grafana `[auth.proxy]` keys:** `enabled`, `header_name`, `header_property`
  (`username` or `email`), `auto_sign_up`, `whitelist` (source IPs allowed to assert
  identity; ships empty), `headers` (Name/Email/Role/Groups mapping), `sync_ttl` and
  `enable_login_token`
  ([Grafana auth proxy docs](https://grafana.com/docs/grafana/latest/setup-grafana/configure-access/configure-authentication/auth-proxy/)).
  Behavior specific to Grafana **13.2** was not separately confirmed. The `latest`
  docs apply (UNVERIFIED version pin).
- **Sketch for dankserver** (inference, not applied):
  ```ini
  [auth.proxy]
  enabled = true
  header_name = Tailscale-User-Login
  header_property = email
  auto_sign_up = true
  whitelist = <docker bridge gateway>
  headers = Name:Tailscale-User-Name
  ```
  - Grafana runs in a container published on `127.0.0.1:3000`, so requests from
    `tailscaled` reach it with the **docker bridge gateway** as source, not
    `127.0.0.1`. That is why the whitelist is the gateway (verify with Grafana's
    request log).
  - Keep the localhost-only publish.
  - A second-tailnet-user login would auto-provision as Viewer. Use `auto_assign_org_role`
    or the `Role` header deliberately.
- **Alternative: `tailscale.com/cmd/proxy-to-grafana`.** This is Tailscale's tsnet
  proxy that maps tailnet identity onto `X-WEBAUTH-USER`.
  - Tailscale advisory **TS-2025-002** fixed a header-forgery escalation in it on
    2025-05-15. Use the latest build only
    ([godocs](https://godocs.io/tailscale.com/cmd/proxy-to-grafana);
    [Tailscale blog](https://tailscale.com/blog/grafana-auth);
    [TS-2025-002](https://cve.circl.lu/vuln/ts-2025-002)).
- **Tailscale Services status:** **GA since 2026-02-19**, after a beta that started
  in October 2025 ([Services GA blog](https://tailscale.com/blog/services-ga)).
- **Services requirements**
  ([Tailscale Services docs](https://tailscale.com/kb/1552/tailscale-services),
  last validated 2026-10-07):
  - The host **must use a tag-based identity**. A user-authenticated device cannot
    host a Service.
  - Clients need v1.86 or later. Clients on 1.94 or later don't need `accept-routes`.
  - Access is granted with `grants` that use `svc:<name>` as the destination.
  - New host advertisements need admin approval unless `autoApprovers.services` maps
    the Service to the host's tags.
  - Command: `tailscale serve --service=svc:grafana --https=443 127.0.0.1:3000`.
- **Fleet-specific blocker:** no hub candidate is tagged today (§1), and dankserver
  runs Tailscale 1.102.5 (`all.yml:36`). Enrollment gate E1 is therefore a
  prerequisite for Services.
- **Interaction with identity headers (UNVERIFIED):** the docs say headers are not
  populated for traffic *originating from* tagged devices. The client is the
  operator's untagged laptop, so headers should still flow. Whether `svc:` Serve
  injects identity headers at all is not documented. Test it before choosing
  Services over plain Serve for Grafana SSO.

## 6. Windows agent cost, non-admin install, and Claude Desktop MCP logs

- **Measured cost of otelcol-contrib on a laptop: no primary-source measurement found
  (UNVERIFIED).**
  - The official benchmarks are Linux load tests at 10k DPS/SPS, which is not a
    laptop agent profile ([Collector benchmarks](https://opentelemetry.io/docs/collector/benchmarks/)).
  - Vendor guides give only *configured limits* (e.g. 200m CPU, 200Mi in k8s), not
    measurements ([Last9](https://last9.io/blog/host-metrics-using-opentelemetry)).
  - Proposal: measure it ourselves with `Get-Process otelcol-contrib`, sampled
    together with `powercfg /srumutil` energy data over 24h at 30s and 60s
    collection intervals. Record the results as a `measurements/` artifact before
    rollout to the attorney PC.
- **Non-admin install.** The MSI design requires admin rights and is machine-wide
  only: no per-user install, no side-by-side
  ([collector issue #10043](https://github.com/open-telemetry/opentelemetry-collector/issues/10043)).
  Releases also ship plain binaries
  ([Install on Windows](https://opentelemetry.io/docs/collector/install/binary/windows/)).
  - Non-admin path (inference, UNVERIFIED in practice):
    1. Unpack `otelcol-contrib.exe` to `%LOCALAPPDATA%\otelcol`.
    2. Start it at logon with a per-user Task Scheduler task ("run only when user is
       logged on"). This needs no elevation and no service registration.
    3. Put `file_storage` under `%LOCALAPPDATA%`.
  - Limits of the non-admin path:
    - The process scraper sees the same user's processes fully (`Claude.exe` and the
      bun MCP binary). Other users' and SYSTEM processes may raise permission errors,
      so set `mute_process_*_error`.
    - `windowseventlog` Security channel needs admin. Application and System are
      normally readable (UNVERIFIED).
- **Claude Desktop MCP logs on Windows:** `%APPDATA%\Claude\logs`. The MCP debugging
  guide reads `mcp*.log` there, and stdio servers' **stderr is captured by the host
  application** ([MCP debugging guide](https://modelcontextprotocol.io/legacy/tools/debugging)).
  - Per-server files are named `mcp-server-<name>.log`, alongside `mcp.log` and
    `main.log` (secondary sources:
    [Juniper Mist docs](https://www.juniper.net/documentation/us/en/software/mist/mist-aiops/topics/concept/juniper-mist-mcp-claude.html),
    [rapidevelopers](https://rapidevelopers.com/mcp-tutorial/how-to-view-mcp-server-logs)).
  - MSIX caveat: one 2026 post reports that MSIX installs redirect writes to
    `%LOCALAPPDATA%\Packages\<family>\LocalCache\Roaming\Claude\logs`
    ([startdebugging](https://startdebugging.net/2026/06/fix-mcp-servers-stop-working-after-claude-desktop-update-on-windows/)).
    UNVERIFIED. A filelog receiver should glob both locations.
  - **Rotation and retention: UNVERIFIED.** No Anthropic doc found. Comparable tools
    (Warp, Claude Code's MCP logs) have open unbounded-growth reports, so assume
    rotation may be absent. Set the `filelog` receiver to `start_at: end` with
    `file_storage`-backed offsets, and alert on file size.

## 7. An OTel-hostmetrics-native Grafana dashboard to adopt as-is

- **Recommended: grafana.com dashboard 24638, "Host Metrics (opentelemetry)"**
  ([listing](https://grafana.com/grafana/dashboards/24638-host-metrics/)).
  - It expects the hostmetrics scrapers `cpu, disk, load, filesystem, memory, network`
    at a 30s interval.
  - It expects Prometheus **OTLP ingestion** with `translation_strategy: UnderscoreEscapingWithSuffixes`.
  - Its metric names follow that strategy, e.g. `system_cpu_time_seconds_total` and
    `system_memory_usage_bytes`.
  - Variables: `DS_PROMETHEUS`, `host_label` (`host` or `k8s_node_name`) and `host`.
  - Revision date and Windows coverage are not stated (UNVERIFIED). Note that the
    `load` scraper is not meaningful on Windows.
- **Fit with this fleet:**
  - Its strategy matches Prometheus's default, so it needs no extra `otlp:` config.
  - Promote `host.name` through `promote_resource_attributes`, or keep
    `resource_constant_labels` if going through the collector's exporter, so that a
    `host` label exists and equals the MagicDNS name. This is the unified-`host.name`
    rule from `tailnet_fleet_telemetry.md`.
  - Keep 1860 and 24390 for exporter-scraped hosts, per the earlier research.
- **Not recommended:**
  - 22929 "OpenTelemetry Collector HostMetrics (Node Exporter)": metric set not shown
    on its listing.
  - 25482 "EC2 Host Metrics (OTel)": requires EC2 tags
    ([22929](https://grafana.com/grafana/dashboards/22929-opentelemetry-collector-hostmetrics-node-exporter),
    [25482](https://grafana.com/grafana/dashboards/25482)).

Scope note (operator, 2026-10-14): `tbk-ubuntu` is excluded from this census and from current goals. It is a gated future host: it joins only after the operator finishes isolating a security-sensitive VM on it, and that VM itself is never instrumented or reachable from the Palantiri (see `DECISIONS.md`).

## Open items for the operator lane (not done here; all would mutate hosts or policy)

- Add beep-worker's host key to known_hosts, and decide the SSH route for `ai` (E3).
- Name the "incoming box".
- Apply tags. `tailscale_enable_up` is false today.
- Decide whether `:8448` OTLP stays open to the whole tailnet, given that a second
  user's node exists.
- Fix dankstation's resolved/NetworkManager wiring.
- Bring the 8443/8446/8447/8448 Serve routes under Ansible.
