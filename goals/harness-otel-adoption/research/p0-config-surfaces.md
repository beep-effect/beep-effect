# P0: native harness OTel configuration surfaces (2026-07-14)

Verified against Claude Code 2.1.209 and Codex CLI 0.144.4 installed on this workstation. The upstream references are the current Claude monitoring documentation, OpenAI configuration reference, and Codex `main` configuration schema. Pin at least these locally verified versions for rollout; upstream does not publish a single minimum version covering every surface below. Claude tracing remains beta even on 2.1.209. [Claude monitoring](https://code.claude.com/docs/en/monitoring-usage) [Codex reference](https://learn.chatgpt.com/docs/config-file/config-reference) [Codex schema](https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json)

## A. Claude Code config ready to paste

> NOTE (post-review): in the deployed setup `OTEL_RESOURCE_ATTRIBUTES` is
> NOT placed in settings.json — the `claude()` launcher wrapper computes and
> exports it per session (see `p0-attribute-contract.md`). The line below
> shows the canonical `beep.*` names for reference.

Put this `env` object in user-level `~/.claude/settings.json`; user settings apply across projects. Project/local settings can override it, so `/status` should be checked during rollout. [Claude settings scopes](https://code.claude.com/docs/en/settings)

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "CLAUDE_CODE_ENHANCED_TELEMETRY_BETA": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "none",
    "OTEL_TRACES_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://dankserver.tailc7c348.ts.net:<HTTPS_PORT>",
    "OTEL_EXPORTER_OTLP_HEADERS": "<key>=<value>",
    "OTEL_RESOURCE_ATTRIBUTES": "beep.repo=<repo>,beep.branch=<branch>,beep.goal_slug=<goal>,beep.task_class=<class>,beep.schema_version=1,host.name=<machine>",
    "OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES": "true",
    "OTEL_LOG_USER_PROMPTS": "0",
    "OTEL_LOG_TOOL_DETAILS": "0",
    "OTEL_LOG_TOOL_CONTENT": "0",
    "OTEL_LOG_RAW_API_BODIES": "0"
  }
}
```

Delete `OTEL_EXPORTER_OTLP_HEADERS` when Tailnet ACLs are the only authorization; otherwise its format is comma-separated `key=value`. A base OTLP/HTTP endpoint is correct: the SDK appends `/v1/traces`, `/v1/metrics`, and `/v1/logs`. `OTEL_RESOURCE_ATTRIBUTES` accepts custom comma-separated pairs, propagates them in the resource block, and by default copies them onto metric datapoints; high-cardinality values increase Prometheus cost. [Claude variables and attributes](https://code.claude.com/docs/en/monitoring-usage) [OTLP endpoint rules](https://opentelemetry.io/docs/specs/otel/protocol/exporter/)

The static user block cannot discover repo/branch/goal/task. A launcher must compute and override `OTEL_RESOURCE_ATTRIBUTES` per session, or project-local Claude settings must provide fixed repo metadata. Otherwise a global placeholder/fixed value misattributes other checkouts. Claude supports project and local settings; the user file itself is machine-wide. [Claude configuration scopes](https://code.claude.com/docs/en/configuration)

## B. Codex `config.toml` ready to paste

Place this only in `~/.codex/config.toml`. Current Codex explicitly ignores `otel` in project `.codex/config.toml`, so telemetry routing is user/machine scoped. [Codex config scope](https://learn.chatgpt.com/docs/config-file/config-reference#configtoml)

```toml
[otel]
environment = "dev"
log_user_prompt = false
exporter = "none" # logs deferred by this goal
metrics_exporter = { otlp-http = { endpoint = "https://dankserver.tailc7c348.ts.net:<HTTPS_PORT>/v1/metrics", protocol = "binary", headers = {} } }
trace_exporter = { otlp-http = { endpoint = "https://dankserver.tailc7c348.ts.net:<HTTPS_PORT>/v1/traces", protocol = "binary", headers = {} } }
span_attributes = { "host.name" = "<machine>", "beep.schema_version" = "1" } # static only; see p0-attribute-contract.md codex gap
```

`otlp-http` requires an endpoint and `protocol = "binary"` or `"json"`; `otlp-grpc` is the alternative and has no `protocol` field. Headers are static literal TOML strings (no environment interpolation), with optional CA/client-certificate/client-key paths under `tls`. `environment` defaults to `dev`; `metrics_exporter` otherwise defaults to `statsig`. [Codex reference](https://learn.chatgpt.com/docs/config-file/config-reference) [Codex schema](https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json) [header interpolation limitation](https://github.com/openai/codex/issues/14465)

Critical gap: `span_attributes` annotates every exported **trace span only**. The current schema has no general user-defined resource/metric-attribute map, so native Codex metrics cannot satisfy repo/branch/goal/task attribution from this block alone. Collector-side enrichment can add machine/static attributes, but dynamic per-session values require an upstream Codex feature or another correlation mechanism. [Codex schema](https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json)

## C. Signals matrix

| Harness | Metrics | Logs/events | Traces |
|---|---|---|---|
| Claude Code 2.1.209 | Supported | Supported; intentionally `none` here | **Beta**; requires both telemetry flags plus `OTEL_TRACES_EXPORTER` |
| Codex CLI 0.144.4 | Supported via `metrics_exporter` | Supported via `exporter`; intentionally `none` here | Supported via `trace_exporter`; not marked experimental |

Claude documents metrics, logs/events, and opt-in beta spans. Codex’s current reference/schema exposes independent exporters for all three. [Claude monitoring](https://code.claude.com/docs/en/monitoring-usage) [Codex reference](https://learn.chatgpt.com/docs/config-file/config-reference) [Codex schema](https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json)

Codex 0.105.0 had confirmed mode gaps (`exec`: no metrics; `mcp-server`: no OTel). That issue is closed, but contains no linked fix; therefore 0.144.4 interactive, `exec`, resume, app-server/Desktop, and companion/background modes still require payload-level coverage tests before acceptance. [Codex issue #12913](https://github.com/openai/codex/issues/12913)

## D. Content-capture flags and defaults

Claude prompt, tool detail/content, and raw API body capture are all disabled by default; explicitly keeping all four flags at `0` makes the privacy intent auditable. Prompt text is redacted unless `OTEL_LOG_USER_PROMPTS=1`; tool arguments require `OTEL_LOG_TOOL_DETAILS=1`; trace tool bodies require `OTEL_LOG_TOOL_CONTENT=1`; full conversation bodies require `OTEL_LOG_RAW_API_BODIES=1` or `file:<dir>`. [Claude security/privacy](https://code.claude.com/docs/en/monitoring-usage#security-and-privacy)

Codex `otel.log_user_prompt` is opt-in and defaults false in runtime behavior; set it explicitly false. No current Codex OTel setting offers response/tool-body capture, but sample payloads must still be inspected for event attributes before trust. [Codex reference](https://learn.chatgpt.com/docs/config-file/config-reference) [Codex schema](https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json)

## E. Failure modes and scope

Both configurations export this workstation’s local harness processes; neither filters telemetry by repository at the routing layer. Claude can override env per project/session, while Codex intentionally rejects project-local `otel`. Tailnet ACLs and collector processors are therefore the reliable machine/source boundary. [Claude scopes](https://code.claude.com/docs/en/configuration) [Codex scope](https://learn.chatgpt.com/docs/config-file/config-reference#configtoml)

OTLP transient failures must retry with exponential backoff and jitter, and OTel exporters must not throw merely because the endpoint is unreachable. The client API should not block by default and should bound memory, which permits dropping telemetry under sustained outage; shutdown flushes may briefly block. Neither harness documents a durable disk spool or exact queue/retry horizon, so assume offline data can be lost and prove that an unavailable collector does not stall each pinned binary. Invalid startup configuration may still fail fast. [OTLP retry](https://opentelemetry.io/docs/specs/otel/protocol/exporter/#retry) [OTel error handling](https://opentelemetry.io/docs/specs/otel/error-handling/) [OTel performance](https://opentelemetry.io/docs/specs/otel/performance/)

Claude defaults to 60 s metric and 5 s log/trace batch intervals. Avoid short debug intervals in steady state and control metric cardinality, especially session IDs and copied resource attributes. [Claude monitoring](https://code.claude.com/docs/en/monitoring-usage)

## F. Collector fan-out sketch (otelcol-contrib 0.154.0)

Tailscale Serve terminates the public Tailnet HTTPS connection and reverse-proxies plain HTTP to `127.0.0.1:4318`; the collector receiver therefore needs no TLS block. Use `tailscale serve --https=<HTTPS_PORT> http://127.0.0.1:4318`. Serve owns the certificate and adds protected Tailscale identity headers; normal OTLP headers still reach the HTTP backend. [Tailscale Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve) [Serve identity headers](https://tailscale.com/docs/features/tailscale-serve#identity-headers)

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
processors:
  batch: {}
exporters:
  otlphttp/phoenix:
    traces_endpoint: http://127.0.0.1:6006/v1/traces
  prometheus:
    endpoint: 0.0.0.0:9464
    send_timestamps: true
    resource_to_telemetry_conversion:
      enabled: true
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/phoenix]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus]
```

OTLP/HTTP receiver paths default to `/v1/{traces,metrics,logs}`. [OTLP receiver](https://github.com/open-telemetry/opentelemetry-collector/blob/main/receiver/otlpreceiver/README.md) The current dankserver topology already has Prometheus scrape the collector exporter on 9464, so `prometheus` is the minimal path. [managed collector template](https://github.com/kriegcloud/dankserver/blob/6459ab5a9f68802e357af4dc7d1dd5000fc2061c/ansible/roles/monitoring/templates/otel-config.yaml.j2) [managed Prometheus template](https://github.com/kriegcloud/dankserver/blob/6459ab5a9f68802e357af4dc7d1dd5000fc2061c/ansible/roles/monitoring/templates/prometheus.yml.j2)

Alternative: `prometheus_remote_write` pushes to `http://prometheus:9090/api/v1/write`, but Prometheus must enable its remote-write receiver. It has its own queued retry (default queue 10,000) and optional WAL; delta/non-cumulative monotonic, histogram, and summary OTLP metrics can be dropped, so Claude’s default delta temporality makes the existing scrape exporter safer. [remote-write exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/exporter/prometheusremotewriteexporter/README.md)

## G. Open questions

1. Is Phoenix reachable from the collector container at `127.0.0.1:6006`? In Docker that normally means the collector container itself; verify host networking or replace it with a resolvable host/container address.
2. What versioned beep attribute names and allowed values replace the provisional `repo`, `branch`, `goal-slug`, and `task-class` keys?
3. How will Codex metrics receive dynamic attribution given the missing metric/resource attribute surface?
4. Does Tailnet ACL identity alone suffice, allowing all static OTLP headers to be removed?
5. Empirically record loss, shutdown delay, and mode coverage for both pinned binaries with the endpoint offline and restored.
