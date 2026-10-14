# Harness emitters, proxy stamping, web and CI telemetry: gap fill

Date: 2026-10-14. Research lane for D4 (every harness emits attributed telemetry
and consumes the Palantiri MCP + CLI). Fills the gaps left by
`research/handoff/agent_facing_tooling.md` (Cursor and Grok CLI not researched)
and `research/handoff/webapp_and_ci_telemetry.md` (`@vercel/otel` env, Turbo
`--summarize`). Baseline contract: `goals/harness-otel-adoption/research/p0-attribute-contract.md` (v1).

Evidence conventions: `path:line` is repo-relative unless it starts with `~/`.
Local probes ran against the installed binaries on dankstation. Local binary
`strings` evidence is labelled **UNVERIFIED (binary strings)**: a symbol being
present does not prove the code path is reachable. No credential values were
read. Config files were inspected for key names only.

Installed versions probed: `cursor-agent` 2026.10.14-0f9edde, `grok` 1.0.57
(alpha), Muse Code 1.4.7 (1.4.7-R6101.1), `codex-cli` 0.162.1, Claude Code
2.1.299, `turbo` 2.11.7, CLIProxyAPI vendored v8.0.16 (`dankstation/daybreak`),
`@effect/opentelemetry` 4.0.4 (reference checkout), `@vercel/otel` 1.14.2
(latest GitHub release).

## 1. Cursor (`cursor-agent` CLI)

**Native OTel: Enterprise only, server-side, metrics + logs, no traces.**
- Cursor's "OpenTelemetry Export" needs the Enterprise plan. An admin configures it in
  Team Settings. Cursor sends it **from its own egress** (28 static IPs) to a
  public HTTPS OTLP/HTTP-protobuf endpoint. gRPC and JSON are not supported. It
  has metrics `cursor.token.usage`, `cursor.tool.calls`, `cursor.cost.usage`, and logs
  `cursor.api.request|error|correction`, `cursor.hook.execution_complete`,
  `cursor.cloud_agent.*`, `cursor.grok_bot.*`, plus opt-in conversation content.
  Attributes include `service.name=cursor`, `cursor.team.id`, `cursor.surface`
  (CLI is listed as a surface, but the page gives no full enum), `cursor.conversation.id`
  and `cursor.event.id`. Metric datapoints carry no conversation id, and the
  export carries **no trace/span ids and no repo/workspace attribute** —
  [Cursor: OpenTelemetry Export](https://cursor.com/docs/enterprise/opentelemetry-export),
  [wire reference](https://prod.cursor.com/docs/enterprise/opentelemetry-export/wire).
- Consequence for us: it needs a public ingress (Funnel or a cloud collector) and
  an Enterprise seat. UNVERIFIED whether the operator's Cursor plan has it. The
  seat in `explorations/cursor-agent-pool` is an individual Ultra plan. Treat it as **not available**.
- `cursor-agent --help` lists no telemetry, OTel, or trace flags. `-H/--header`
  adds headers to requests sent to the **Cursor API** (`--endpoint`, default
  `api2.cursor.sh`). It can't stamp a beep-owned proxy.
- Third-party bridges exist (Last9 `cursorscope`, OpenLIT CLI) that turn hook
  events into OTel — [Last9 Cursor integration](https://last9.io/docs/integrations/cursor/),
  [OpenLIT CLI](https://docs.openlit.io/latest/cli/overview). These confirm that hooks
  are the client-side emission point. We don't need either one.

**Hooks: the client-side emission point, already wired in this repo.**
- Events: `sessionStart`, `sessionEnd`, `preToolUse`, `postToolUse`,
  `postToolUseFailure`, `subagentStart|Stop`, `before|afterShellExecution`,
  `before|afterMCPExecution`, `beforeReadFile`, `afterFileEdit`,
  `beforeSubmitPrompt`, `preCompact`, `stop`, `afterAgentResponse`,
  `afterAgentThought`. Common stdin: `conversation_id`, `generation_id`, `model`,
  `model_id`, `hook_event_name`, `cursor_version`, `workspace_roots`,
  `user_email`, `transcript_path`. `duration_ms` appears on post-tool, shell, and MCP events.
  Tokens appear only on `preCompact` (`context_tokens`, `context_window_size`).
  The hook env has `CURSOR_PROJECT_DIR`, `CURSOR_VERSION`, `CURSOR_USER_EMAIL`, and
  `CURSOR_TRANSCRIPT_PATH`. A `sessionStart` hook **may return `env`**, which is passed
  to every later hook in the session. That gives us a native slot for injecting
  `beep.*` once per session. Config layers: Enterprise > Team > project
  `.cursor/hooks.json` > user `~/.cursor/hooks.json` —
  [Cursor: Hooks](https://cursor.com/docs/agent/hooks).
- Repo state: `.cursor/hooks.json:1-24` registers `.cursor/hooks/hook-pulse.sh` on
  pre/post tool, failure, prompt, stop, and sessionEnd. That adapter
  (`.cursor/hooks/hook-pulse.sh:1-40`) answers Cursor's protocol first, then
  hands off to the shared `.claude/hooks/hook-pulse.sh` with agent kind
  `cursor-cli` (`.claude/hooks/hook-pulse.sh:84-87`, allowed kinds
  `claude-code|codex-cli|cursor-cli`). `sessionStart` is deliberately left
  unmapped (`.cursor/hooks/hook-pulse.sh:11-15`). `.cursor/cli.json` denies
  `Shell(git|sudo|pkexec)`.
- PII: `user_email` and `CURSOR_USER_EMAIL` arrive on every hook. Any OTel bridge must
  drop them or hash them, the same way hook-pulse already pseudonymizes session, cwd, and
  transcript.

**`--output-format stream-json` (print mode only).**
- NDJSON events: `system/init` (`apiKeySource`, `cwd`, `session_id`, `model`,
  `permissionMode`), `user`, `assistant`, `tool_call` (`started` and `completed`, with
  per-tool payloads such as `readToolCall`), and a terminal `result` (`duration_ms`,
  `duration_api_ms`, `session_id`, `request_id`, `is_error`). **No token usage
  fields are documented on the CLI result.** Thinking is suppressed in print mode. The Cursor
  SDK, not the CLI, emits `usage` messages —
  `explorations/cursor-agent-pool/research/2026-09-16-L1b-cli-surface.md:44-64,515`.
- Wrapper-span value: one span per lane run covering init to result, with
  `duration_ms` and `duration_api_ms`, plus one child span per `tool_call`
  start/completed pair. Tokens and cost: NOT AVAILABLE from the CLI. The account-level quota
  comes from `beep accounts status` / Cursor dashboard only.
- Local stores (presence only): `~/.cursor/chats`, `~/.cursor/projects`,
  `~/.cursor/ai-tracking/ai-code-tracking.db`. No transcript schema was verified.
  A transcript ingest is **UNVERIFIED**.

## 2. Grok Build CLI (`grok`) and the Grok bot box

**Native telemetry: vendor sinks only, no OTLP.**
- `[telemetry]` keys: `events_url`, `events_api_key`, `mixpanel_token`,
  `mixpanel_enabled`, `trace_upload`. Env: `GROK_TELEMETRY_EVENTS_URL`,
  `..._EVENTS_API_KEY`, `..._MIXPANEL_TOKEN`, `..._MIXPANEL_ENABLED`,
  `..._TRACE_UPLOAD`, and `[features] telemetry` / `GROK_TELEMETRY_ENABLED`. These are
  xAI/Mixpanel event sinks, **not OTLP** — `~/.grok/README.md:1382,1403-1416`.
  No `OTEL_*`, `OTLP`, or `TRACEPARENT` string appears in the README. `events_url` is a
  proprietary event POST. UNVERIFIED whether its body could be pointed at a beep
  receiver usefully.
- Logging: `GROK_LOG_FILE`, `GROK_DEBUG_LOG` / `--debug-file`
  (`~/.grok/README.md:2564-2565`).
- Local config `~/.grok/config.toml` key groups (names only): `[cli]`, `[ui]`,
  `[plugins]`, `[mcp_servers.*]`, `[skills]`, `[marketplace]`, `[models]`
  (`default`, `default_reasoning_effort`), `[compat.cursor]`. **No `[telemetry]`
  or `[[hooks.*]]` block is set.**

**Hooks: Claude-compatible, and they read *our* hook files.**
- Events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
  `PostToolUseFailure`, `PermissionDenied`, `Stop`, `StopFailure`,
  `StopCancelled`, `Notification`, `SubagentStart|Stop`, `PreCompact`,
  `PostCompact`, `SessionEnd`. The common stdin fields are camelCase (`hookEventName`,
  `sessionId`, `cwd`, `workspaceRoot`, `timestamp`, `permissionMode`,
  `promptId`) **with Claude snake_case aliases** —
  `~/.grok/docs/user-guide/10-hooks.md:89-109,395,667`.
- Discovery merges `~/.grok/hooks/*.json`, `~/.claude/settings.json`, `~/.cursor/hooks.json`, and,
  **once the folder is trusted**, `<project>/.claude/settings.json` and
  `<project>/.cursor/hooks.json` (`10-hooks.md:62-80`). Cursor's flat entries
  (our `.cursor/hooks.json` shape) don't run. Grok reports them as load errors
  (`10-hooks.md:120-131`).
- **Finding (risk):** in a trusted beep checkout, grok would run
  `.claude/settings.json`'s hook-pulse commands (`.claude/settings.json:109,125,135`).
  `BEEP_HOOK_PULSE_AGENT_KIND` is unset there, so those rows would be tagged
  `claude-code` (`.claude/hooks/hook-pulse.sh:84`). UNVERIFIED whether any beep
  checkout is grok-trusted. No trust record for this clone was found under `~/.grok`.
  Fix: add a `grok-build` agent kind and detect grok, for example from the
  camelCase `hookEventName` or a grok env var, or set `[compat.claude]` off and ship
  a `.grok/hooks/*.json` adapter.

**Headless output and usage.**
- `--output-format`: `plain | json | streaming-json | streaming-messages-json`.
  `streaming-json` is "one ACP session update per line" (`grok --help`). Documented
  events: `text`, `thought`, `tool_call` (`toolCallId`, `title`, `kind`,
  `status`, `toolName`, `rawInput`), `tool_call_update`, `usage` (per message:
  `input_tokens`, `output_tokens`, `cache_read_input_tokens`,
  `cache_creation_input_tokens`, `reasoning_tokens`), and `end` (`stopReason`,
  `sessionId`, `requestId`, `cwd`, `usage`, `num_turns`, `modelUsage`) —
  `~/.grok/docs/user-guide/14-headless-mode.md:266-276`. `streaming-messages-json`
  ends with a Claude-shaped `result` (`duration_ms`, `duration_api_ms`,
  `num_turns`, `stop_reason`, `total_cost_usd`, `usage`, `modelUsage`)
  (`14-headless-mode.md:303-343`). Note: `usage.input_tokens` and
  `modelUsage.*.inputTokens` are uncached only (`14-headless-mode.md:220`).
  The README example (`~/.grok/README.md:775-781`) shows an older, thinner shape.
  Prefer the user-guide doc.
- On-disk session store (keys observed on one local session):
  `~/.grok/sessions/<url-encoded-cwd>/<id>/` holds `usage.json`
  (`session.{inputTokens,outputTokens,reasoningTokens,cachedReadTokens,cacheCreationTokens,totalTokens,costUsdTicks,modelCalls,turnCount}`,
  `session.modelUsage.<model>.*`, and the same per `turns[]` with `endedAt`), and `signals.json`
  (`turnCount`, `errorCount`, `toolFailureCount`, `toolCallCount`, `toolsUsed`,
  `modelsUsed`, `primaryModelId`, `gitCommitCount`, `prCreatedCount`, compaction
  counters). It also holds `events.jsonl` with typed timing events: `turn_started`, `turn_ended{outcome}`,
  `first_token`, `tool_started`, `tool_completed{tool_name,tool_call_id,duration_ms,outcome}`,
  `permission_requested|resolved`, and `mcp_server_*`. Finally, `updates.jsonl` holds ACP `session/update`
  (`tool_call`, `tool_call_update`, `agent_message_chunk`) and
  `_x.ai/session/update` (`turn_completed{elapsed_ms,stop_reason,usage}`,
  `hook_execution`, `auto_compact_*`). **`events.jsonl` + `usage.json` are
  enough to rebuild a span tree (turn → tool) with tokens and cost after the
  fact.** The directory name encodes cwd, so the checkout is recoverable.
- The `modelUsage` key in our live sessions is `grok-4.7-build`, which matches the
  routing doctrine.

**Grok bot box (`grok-bot-box-1`).**
- Repo references: it's a tagged tailnet device in
  `explorations/observability-palantiri/CAPTURE.md:35,37` and
  `research/handoff/tailnet_fleet_telemetry.md:3,138`. **NOT FOUND:** no repo
  code or doc describes what runs on that box.
- `explorations/grok-bot-automation` (stage `align`) describes Grok Bot as a
  **Cursor product** with a hosted VM. Its desktop app can run "Execution on Local
  Computer" (`research/lanes/g1-grok-bot-facts.md:76,326`). Observability that
  Cursor offers there is Enterprise Audit Logs plus Action Recording with optional OTel
  export (`g1-grok-bot-facts.md:215`). The `cursor.grok_bot.*` log family in the
  Enterprise export above is that path.
- On dankstation, `~/.grokbot/` holds the desktop app's local-exec daemon state.
  Key names only: `local-exec-daemon.json` = `pid`, `generation`,
  `inflightCount`, `servingAt`, `startedAt`. There is also a `local-exec-daemon.log` and a
  `settings.json` (`localToolPermission`, `egressTunnelEnabled`, `mcpBoxServers`,
  …). INFERENCE: if `grok-bot-box-1` runs the same app, the achievable signals
  are host metrics (node_exporter) and a daemon liveness/in-flight gauge read from
  that JSON. Per-action content stays Enterprise-gated.

## 3. Muse (Meta Muse Code)

- What it is: Meta's terminal coding agent (`muse`, launcher script
  `~/.local/bin/muse` → binary `~/.local/bin/muse-bin-1.4.7-R6101.1`, data in
  `~/.local/share/muse/{sessions,local-tracing,session-index.db}`, config
  `~/.config/muse/settings.json` with keys `model`, `provider`,
  `reasoning_effort`, `schema_version`, `tui`). Subcommands include `exec`
  (headless, `--json` JSONL events), `export`, and `trace inspect` (`muse --help`).
- Fleet role: `bun run beep accounts status` lists a Muse section. The poller
  calls Meta's key endpoint with the proxy's stored Meta login
  (`packages/tooling/tool/cli/src/commands/Accounts/AccountsUsage.service.ts:120,450-466`).
  The schema maps `subs_usage.window|weekly.{used_percent,resets_at}` into session
  and weekly windows (`.../Accounts.wire.schemas.ts:377-408`). The provider literal is
  `muse` (`.../Accounts.schemas.ts:34`). CLIProxyAPI also exposes
  `muse-spark-1.3(medium)` to the `claudem` zsh route. Native `muse` keeps its
  own direct Meta login (`~/YeeBois/workstation-apps/CLIProxyAPI/DANKSTATION.md:38-46`).
- **Native OTLP: present.** UNVERIFIED (binary strings): settings keys
  `settings.telemetry.{enabled,endpoint,proxy,destination,auth,ca_bundle}`,
  env `OTEL_EXPORTER_OTLP_ENDPOINT`, `MUSE_CUSTOM_HEADERS`. There is a spec-referenced
  "OTLP byte-shape v2" contract, "one trace per turn" with an `invoke_agent` turn-root
  span (`gen_ai.agent.name`), child links for subagents, and GenAI semconv attributes
  (`gen_ai.operation.name`, `gen_ai.provider.name`, `gen_ai.request.model`,
  `gen_ai.response.finish_reasons`, `gen_ai.usage.input_tokens|output_tokens`,
  `gen_ai.tool.name`, `gen_ai.tool.call.id`, `gen_ai.conversation.id`), plus
  `workspace.repo`. Error strings say a custom destination "carries no bearer
  credential" and that internal destinations are unavailable on public builds.
  INFERENCE: pointing `OTEL_EXPORTER_OTLP_ENDPOINT` at a local collector should
  work unauthenticated. **Needs a live probe** against a loopback collector.
- `OTEL_RESOURCE_ATTRIBUTES` does **not** appear in the binary strings, so
  `beep.*` cannot be stamped natively. Options: a collector-side enrichment keyed on
  `workspace.repo` plus a session id, or a wrapper span around `muse exec --json`.
- Muse is the **only harness here that emits GenAI-semconv traces natively**.
  It is the reference shape for the collector transform that normalizes
  `claude_code.*` and `codex.*`.

## 4. CLIProxyAPI (local proxy, `127.0.0.1:8317`)

- Live config top-level keys (names only, `~/.cli-proxy-api/config.yaml`):
  `host`, `port`, `tls`, `remote-management`, `auth-dir`, `api-keys`, `debug`,
  `logging-to-file`, `usage-statistics-enabled`, `request-retry`,
  `transient-error-cooldown-seconds`, `max-retry-interval`, `routing`, `xai`,
  `claude-header-defaults`, `openai-compatibility`. `~/.cli-proxy-api/logs/`
  holds 10 `error-v1-chat-completions-*.log` files. These may contain request
  bodies, so treat them as content tier.
- v8 config moves these under `observability:` → `logs.{debug,logging-to-file,
  logs-max-total-size-mb,error-logs-max-files,request-log}`,
  `usage.{usage-statistics-enabled,redis-usage-queue-retention-seconds}`, `pprof`
  (`~/YeeBois/workstation-apps/CLIProxyAPI/config.example.yaml:1081-1111`). The
  live file still uses the flat v7 keys, so **check whether v8 still honours them**
  (`internal/config/config_v8.go`, `internal/config/parse.go`). UNVERIFIED.
- **No OTel SDK in the tree** (`go.mod` has no `go.opentelemetry.io`). No Prometheus
  `/metrics`. Only `/healthz` (`internal/api/server_routes.go:52-53`).
- Management API (auth'd): `GET /v8/management/observability/logs`,
  `.../logs/errors`, `.../logs/requests/:id`, `.../usage/api-keys`,
  `.../usage/queue` (`internal/api/server_management_v8.go:35-41`). `usage/queue`
  is a short-retention (default 60 s, max 3600 s) pull queue of usage records.
- **Usage record per proxied request** (`sdk/cliproxy/usage/manager.go:24-70`):
  `RequestID`, `TraceID` (8-hex inbound id, *not* W3C), `Provider`,
  `ExecutorType`, `Model`, `Alias`, `SessionID`, `ParentSessionID`, `AuthID`,
  `AuthIndex`, `AccessTokenSHA256`, `AuthType`, `Source`, `ReasoningEffort`,
  `ServiceTier`, `ResponseModel`, `Stream`, `RequestedAt`, `Latency`, `TTFT`,
  `Failed`/`Fail.StatusCode`, `Detail` (input/output/reasoning/cache tokens), and
  `ResponseHeaders`. It also has a field `APIKey`, which a sink must drop.
- **Plugin hook:** `usage.Plugin{ HandleUsage(ctx, Record) }`, registered via
  `RegisterPlugin`/`RegisterNamedPlugin` (`manager.go:291,354-370,467-470`).
  Records are queued with their request `ctx` (`manager.go:390,415`), and handlers put
  the gin context on ctx under key `"gin"` (`sdk/api/handlers/handlers.go:543`).
  INFERENCE: an in-tree sink in the vendored build can read inbound request
  headers. The external `pluginapi.UsageRecord` has no request headers
  (`sdk/pluginapi/types.go:1486-1540`), although intercept hooks do
  (`types.go:1211,1236`).
- Client identity the proxy already parses: `X-Claude-Code-Session-Id` /
  `X-Claude-Code-Agent-Id` (→ client type `claude`), Codex `Session_id`, and
  `X-Session-ID` (`sdk/cliproxy/session/info.go:174-180,287,476`).
- **Verdict: yes, the proxy can emit one span per proxied request and stamp
  `beep.*`.** The cheapest route is a vendored `usage.Plugin` that emits an OTLP
  span (or a log record) per `Record`, with `gen_ai.*` from the record and `beep.*` from
  `X-Beep-*` request headers. Clients can send those headers today:
  Claude Code `ANTHROPIC_CUSTOM_HEADERS` (present in the 2.1.299 binary), Codex
  provider `http_headers`/`env_http_headers` (present in the 0.162.1 binary),
  Muse `MUSE_CUSTOM_HEADERS` (binary strings). Grok direct and Cursor don't
  traverse the proxy. Span start = `RequestedAt`, duration = `Latency`, event =
  TTFT. `provider_account` = `AuthIndex` (salted hash), never `AuthID`.
  Upstream-merge cost: one new file plus a registration line on the vendored branch.

## 5. Codex CLI `[otel]`

- Official keys: `otel.environment` (default `dev`), `otel.exporter`
  (`none|otlp-http|otlp-grpc`, logs), `otel.trace_exporter` (same), and
  `otel.metrics_exporter` (`none|statsig|otlp-http|otlp-grpc`, **default
  `statsig`**, also disabled when `analytics.enabled=false`). Each exporter
  `<id>` takes `endpoint`, `headers`, `protocol` (`binary|json`, HTTP only), and
  `tls.{ca-certificate,client-certificate,client-private-key}`, plus
  `otel.log_user_prompt` —
  [Codex config reference](https://learn.chatgpt.com/docs/config-file/config-reference),
  [advanced config](https://learn.chatgpt.com/docs/config-file/config-advanced).
  The endpoint is used verbatim, so include `/v1/logs|traces|metrics`. `otel` in a
  project-local `.codex/config.toml` is ignored (user-level only).
- `otel.span_attributes` is **not in the official reference**, but the binary
  carries it (16 occurrences) and the live config uses it. It's a de facto key,
  documented by third parties —
  [OneUptime](https://oneuptime.com/docs/en/telemetry/openai-codex),
  [Last9](https://last9.io/docs/integrations/codex/).
- Live `~/.codex/config.toml` (keys only): `[otel] environment, log_user_prompt,
  exporter`, `[otel.metrics_exporter.otlp-http] endpoint, protocol`, and
  `[otel.span_attributes] "host.name", "beep.schema_version"`. **There's no
  `trace_exporter` block, so Codex traces are not exported today.**
- Default metric tags: `auth_mode`, `originator`, `session_source`, `model`,
  `app.version` (advanced config page).
- **Per-checkout attribution (v1 gap): probably closable via
  `OTEL_RESOURCE_ATTRIBUTES`.** AWS's Codex guide sets identity and org dimensions
  through `OTEL_RESOURCE_ATTRIBUTES` in the launching shell and groups metrics by
  `@resource.*` —
  [AWS: Codex bearer-token setup](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/coding-agents-codex-bearer-token.html).
  The 0.162.1 binary contains `OTEL_RESOURCE_ATTRIBUTES`, `OTEL_SERVICE_NAME`,
  and `OTEL_EXPORTER_OTLP_*` strings, which is consistent with the Rust SDK env resource
  detector. UNVERIFIED for metrics on our exporter. **Probe:** run `codex exec`
  with the `beep_otel_attrs` output exported and check `beep_repo` on
  `codex_*` series in Prometheus. If it works, the `codex()` zsh wrapper needs the same
  `OTEL_RESOURCE_ATTRIBUTES="$(beep_otel_attrs)"` prefix that `claude()` has. Today
  it only injects a GitHub token.
- Codex `TRACEPARENT` strings are present (3×) and `traceparent` appears 24×.
  UNVERIFIED whether Codex exports `TRACEPARENT` to exec'd shells as Claude does.

## 6. Claude Code OTel (2.1.299)

- Switches: `CLAUDE_CODE_ENABLE_TELEMETRY=1`, traces need
  `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` (alias `ENABLE_ENHANCED_TELEMETRY_BETA`),
  `OTEL_{METRICS,LOGS,TRACES}_EXPORTER`, `OTEL_EXPORTER_OTLP_{PROTOCOL,ENDPOINT,HEADERS}`
  plus per-signal variants, export intervals, and content gates
  `OTEL_LOG_{USER_PROMPTS,ASSISTANT_RESPONSES,TOOL_DETAILS,TOOL_CONTENT,RAW_API_BODIES}`
  (all off by default) —
  [Claude Code: Monitoring](https://code.claude.com/docs/en/monitoring-usage).
- `OTEL_RESOURCE_ATTRIBUTES`: comma `k=v`, no spaces. It lands on every metric
  datapoint and event and never overrides `user.id`/`session.id`, except `vcs.*`.
  `OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES=false` keeps it resource-only.
  Cardinality toggles: `OTEL_METRICS_INCLUDE_{SESSION_ID(true),VERSION(false),
  ACCOUNT_UUID(true),ENTRYPOINT(false),RESOURCE_ATTRIBUTES(true),REPOSITORY(false, ≥2.1.269)}`.
  New since v1: Claude Code can stamp `vcs.*` repository attributes itself.
- **TRACEPARENT into Bash:** "Bash and PowerShell subprocesses automatically
  inherit a `TRACEPARENT` environment variable containing the W3C trace context
  of the active tool execution span." Headless `-p` and Agent SDK sessions also
  *read* inbound `TRACEPARENT`/`TRACESTATE`, while interactive sessions ignore them.
- **Gotcha for proxy sessions:** the `traceparent` header, and "for consistency"
  the subprocess `TRACEPARENT`, are on only when `ANTHROPIC_BASE_URL` is unset or
  points at Anthropic. With a custom proxy you must set
  `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1` (present in the binary). **So `claudex`,
  `claudeg`, `claudep`, and `claudem` sessions currently get no Bash `TRACEPARENT`.**
  Add it to `_claude_proxy`. That also sends `traceparent` to CLIProxyAPI, which a
  proxy span (§4) could adopt as its parent.
- **Stripping confirmed:** "Claude Code doesn't pass `OTEL_*` environment
  variables to the subprocesses it spawns, including the Bash tool, hooks, MCP
  servers, and language servers." The docs don't say whether hooks or MCP servers get
  `TRACEPARENT`. OTEL exporter vars in repo `.claude/settings*.json` are
  ignored. They must come from managed settings, the shell, or `~/.claude/settings.json`.
- Live `~/.claude/settings.json` env (keys only): `CLAUDE_CODE_ENABLE_TELEMETRY`,
  `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA`, `OTEL_EXPORTER_OTLP_{ENDPOINT,PROTOCOL}`,
  `OTEL_{LOGS,METRICS,TRACES}_EXPORTER`, `OTEL_LOG_{RAW_API_BODIES,TOOL_CONTENT,TOOL_DETAILS,USER_PROMPTS}`,
  `OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES`, `BEEP_AI_METRICS_HASH_SALT`.
  The `claude()` zsh function prefixes `OTEL_RESOURCE_ATTRIBUTES="$(beep_otel_attrs)"`.
  It emits `beep.repo` as the **checkout** basename (for example `beep-effect5`),
  not the family, which conflicts with the v1 table's description.

## 7. `@vercel/otel` and Effect `OtelTracer.layerGlobal`

- `@vercel/otel` 1.14.2 reads env (`packages/otel/src/sdk.ts` via
  `gh api repos/vercel/otel/contents/...`): `OTEL_SDK_DISABLED`,
  `OTEL_SERVICE_NAME` (it beats `serviceName`), `OTEL_PROPAGATORS`,
  `OTEL_TRACES_SAMPLER[_ARG]`, `OTEL_EXPORTER_OTLP_[TRACES_]ENDPOINT`,
  `..._HEADERS`, `..._PROTOCOL`, and `OTEL_LOG_LEVEL`. **Yes, it honours standard
  `OTEL_EXPORTER_OTLP_*`.** When an endpoint env is set, it adds a
  `BatchSpanProcessor(parseTraceExporter(env))` alongside the Vercel collector.
  The protocol defaults to `http/protobuf` (`OTLPHttpProtoTraceExporter`).
  `http/json` → `OTLPHttpJsonTraceExporter`. **`grpc` is unsupported and falls back to
  a proto exporter with no url or headers.** That's a silent misroute, so never set
  `grpc`. `VERCEL_OTEL_ENDPOINTS[_PORT|_PROTOCOL]` selects Vercel's
  own collector.
- Resource: `envDetector` is the default detector, so `OTEL_RESOURCE_ATTRIBUTES` merges
  in. This gives `beep.*` a slot on Vercel too. Defaults include `deployment.environment.name`,
  `vcs.ref.head.name|revision`, `vcs.repository.name`, and `deployment.id`.
- `registerOTel` options: `serviceName`, `attributes`, `instrumentations`,
  `instrumentationConfig.fetch.{ignoreUrls,propagateContextUrls,
  dontPropagateContextUrls,resourceNameTemplate}`, `propagators`,
  `traceSampler`, `spanProcessors`, `traceExporter`, `attributesFromHeaders`,
  `resourceDetectors`, `autoDetectResources`, `logRecordProcessors`, and
  `contextManager`. Metrics: it sets a global `MeterProvider` (sdk.ts:186).
  The default propagators (`"auto"`) are `tracecontext`, `baggage`, and `vercel-runtime`.
  Fetch propagation is on only for deployment URLs unless widened. README:
  [vercel/otel README](https://github.com/vercel/otel/blob/main/packages/otel/README.md)
  (fetched via `gh api`, because the web fetch returned 503).
- Effect (`~/YeeBois/references/effect/effect/packages/opentelemetry/src/OtelTracer.ts`,
  package 4.0.4): `layerGlobal: Layer.Layer<OtelTracer>` installs the Effect
  `Tracer` from `Otel.trace.getTracerProvider()` (`:215`). Siblings:
  `layerGlobalProvider: Layer<OtelTracerProvider>` (`:176`),
  `layerGlobalTracer: Layer<OtelTracer>` (`:204`),
  `layer: Layer<OtelTracer, never, OtelTracerProvider>` (`:244`), and
  `layerWithoutOtelTracer` (`:225`). All are marked `@stability unstable` and
  `@since 4.0.0`. Import path: `@effect/opentelemetry/OtelTracer` (barrel
  `index.ts:30`). **Name and signature confirmed.** The handoff's topology stands:
  `@vercel/otel` owns the provider, and `layerGlobal` attaches Effect spans to it.

## 8. Turborepo `--summarize` and `experimentalObservability`

- Installed: `turbo` 2.11.7. Repo `turbo.json` `futureFlags` =
  `affectedUsingTaskInputs`, `filterUsingTasks`, `globalConfiguration`.
  `experimentalObservability` isn't set, and neither are `ui` and `envMode` at the top level.
- **Gotcha:** with `globalConfiguration: true`, the block must live at
  **`global.experimentalObservability`**. The top-level key is a hard error
  (`node_modules/turbo/docs/reference/configuration.mdx`, rename table). It
  also needs `futureFlags.experimentalObservability: true`.
- `otel` keys: `enabled`, `protocol` (`grpc` | `http/protobuf`), `endpoint`
  (**https only**; plain http is rejected), `headers` (dropped when a higher-priority
  source overrides `endpoint`), `timeoutMs` (10000), `intervalMs` (15000, with a final
  flush), `resource` (map), `metrics.runSummary` (true), `metrics.taskDetails`
  (false), `metrics.runAttributes.{id→turbo.run.id, scmRevision→turbo.scm.revision}`,
  `metrics.taskAttributes.{id→turbo.task.id, hashes→turbo.task.hash,
  turbo.task.external_inputs_hash}`, and `useRemoteCacheToken`. Env overrides:
  `TURBO_EXPERIMENTAL_OTEL_{ENABLED,PROTOCOL,ENDPOINT,HEADERS,TIMEOUT_MS,INTERVAL_MS,
  RESOURCE,METRICS_RUN_SUMMARY,METRICS_TASK_DETAILS,METRICS_TASK_ATTRIBUTES_ID,
  METRICS_TASK_ATTRIBUTES_HASHES,USE_REMOTE_CACHE_TOKEN}`. Merge order: env >
  … > `turbo.json`, per field. Metrics only.
  `TURBO_EXPERIMENTAL_OTEL_RESOURCE` is the per-run slot for `beep.*` and
  `cicd.pipeline.run.id`.
- `--summarize` (or `TURBO_RUN_SUMMARY`) writes `.turbo/runs/<run-id>.json`
  (`node_modules/turbo/docs/reference/run.mdx:692-701`,
  `standards/turbo-remote-cache.md:132-140`). Observed top-level keys on a
  2026 summary: `id`, `version`, `turboVersion`, `monorepo`,
  `globalCacheInputs`, `packages`, `envMode`, `frameworkInference`, `execution`
  (`command`, `repoPath`, `success`, `failed`, `cached`, `attempted`,
  `startTime`, `endTime`, `exitCode`), `tasks[]` (`taskId`, `task`, `package`,
  `hash`, `hashOfExternalDependencies`, `inputs`, `outputs`, `excludedOutputs`,
  `expandedOutputs`, `cache{local,remote,status,timeSaved}`, `command`,
  `cliArguments`, `directory`, `dependencies`, `dependents`,
  `resolvedTaskDefinition`, `framework`, `envMode`, `environmentVariables`,
  `execution{startTime,endTime,exitCode}`, `with`), `scm{type,sha,branch}`, and
  `user` (string, so **strip it**: it's an identity). The repo already decodes a subset
  (`packages/tooling/tool/cli/src/commands/Quality/internal/TurboLaneDigest.ts:38-101`)
  and `beep ci append-turbo-summary --all` reads them in hosted CI.
- **Recommendation:** the summary JSON is the better trace source. It has per-task
  start/end, cache source, `timeSaved`, and dependency edges, so it can build a
  run → task span tree with deterministic ids from `id`/`taskId`. The OTel exporter
  is metrics only and https-only. Emit spans from `beep ci append-turbo-summary`
  (or a sibling) via Effect `Otlp`. Use `experimentalObservability` only for cheap
  run counters if wanted.

## 9. `beep.*` contract v2 (proposal)

Design rules carried from v1: the `beep.` namespace survives semconv churn, and the
metric-label set stays closed and low-cardinality. New in v2: a **two-set split**.
`M` is safe on metrics and on resources, and `S` belongs on spans and logs only. Every emitter declares its
**emitter kind**, so the dual-ingestion precedence rule can dedupe.

| Attribute | Set | Values / derivation | Why |
|---|---|---|---|
| `beep.schema_version` | M | `2` | static |
| `beep.harness` | M | LiteralKit `claude-code \| codex-cli \| cursor-cli \| grok-build \| grok-bot \| muse-code \| ci \| webapp` | `service.name` differs per vendor (`codex_exec`, `codex_tui`, `cursor`, `tbh`); one join key |
| `beep.harness_version` | M | CLI version string | regression attribution (Grok is alpha, Muse ships weekly) |
| `beep.provider` | M | `anthropic \| openai \| xai \| cursor \| meta` | quota pool, the routing axis in the delegation doctrine |
| `beep.provider_account` | M | salted short hash of the account slot (`BEEP_AI_METRICS_HASH_SALT`), or the `beep accounts` ordinal; never an email | the D-level "quota and headroom" signal per account |
| `beep.route` | M | `direct \| proxy \| cursor-seat \| grok-build` | fallback-chain position, so chain hops can be counted |
| `beep.tier` | M | manifest role: `orchestrator \| child.heavy \| child.lightweight \| codex.heavy \| fallback.cursor \| fallback.grok \| research.web \| qa.judge …` | ties spend to the `beep models` manifest |
| `beep.model` | M | requested model id, effort-stripped | vendors disagree (`grok-4.7` vs `grok-4.7-build`) |
| `beep.effort` | M | `low…ultra \| none` | effort is a cost driver |
| `beep.repo` | M | clone **family** (`beep-effect`), fixing the v1 drift | family-level rollups |
| `beep.clone` | M | checkout basename (`beep-effect5`) | today's wrapper value, renamed |
| `beep.task_class` | M | unchanged | — |
| `beep.goal_slug` | M | unchanged (prefix-match) | — |
| `beep.privacy_tier` | M | `shape-only \| content` | D-level shape-only tier; collector drops content on `shape-only` |
| `beep.emitter` | M | `native \| wrapper \| proxy \| hook \| transcript` | dual-ingestion dedupe and coverage drift (P2) |
| `beep.lane` | S | worktree/lane name or ticket | too many values for metrics |
| `beep.branch` | S (moved from M) | git branch | cardinality grows with lanes |
| `beep.session` | S | salted hash of the native session id | joins proxy records to harness spans |
| `beep.parent_session` | S | salted hash | delegation trees (proxy `ParentSessionID`, Cursor `subagentStart`) |
| `beep.orchestrator_session` | S | salted hash of the orchestrating session | cross-provider fan-out joins (the originator owns fallback) |
| `host.name` | M | standard | — |
| `cicd.pipeline.run.id`, `vcs.ref.head.revision` | M/S | standard semconv for CI and webapp | don't invent `beep.ci_*` |

Carriage (one computed value, three transports): a shared
`beep otel attrs --format env|headers|json` replaces the zsh `beep_otel_attrs`.
It feeds `OTEL_RESOURCE_ATTRIBUTES` (Claude, Codex probe, Vercel, Turbo
`TURBO_EXPERIMENTAL_OTEL_RESOURCE`), `X-Beep-*` request headers (Claude
`ANTHROPIC_CUSTOM_HEADERS`, Codex `env_http_headers`, Muse `MUSE_CUSTOM_HEADERS`)
for proxy stamping, and the hook-session env (Cursor `sessionStart` → `env`).
Prefer the **collector** for adding `beep.privacy_tier` and stripping content, so no
harness is trusted to self-redact.

### Per-harness emission and achievable attribution

| Harness | Emission point | Signals | Attribution achievable | Gap |
|---|---|---|---|---|
| Claude Code (direct) | native exporter (metrics, logs, traces beta) + hook-pulse | tokens, cost, tool spans, `TRACEPARENT`→Bash | full M+S via `OTEL_RESOURCE_ATTRIBUTES`; `vcs.*` native | `OTEL_*` stripped from MCP and hooks, so the MCP server needs its own exporter config |
| Claude Code via proxy (`claudex/g/p/m`) | native + **proxy stamp** | same + per-request proxy span | full, once `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1` | today no Bash `TRACEPARENT` (custom base URL) |
| Codex CLI | native exporter (logs, metrics; traces unconfigured) + hook-pulse + transcript | `codex.*` events, `codex_*` metrics | static `span_attributes`; per-checkout **likely** via `OTEL_RESOURCE_ATTRIBUTES` (probe) | no `trace_exporter` block; `codex()` wrapper doesn't inject attrs |
| Cursor CLI | **hooks** (hook-pulse, `cursor-cli`) + **wrapper span** over `stream-json` | tool durations, session, model; no tokens | full M+S from the wrapper; hooks via the `sessionStart` env | native OTel is Enterprise-only and server-side; no tokens in CLI output |
| Grok Build CLI | **transcript ingest** (`events.jsonl`, `usage.json`, `signals.json`) + wrapper span over `streaming-json` + hooks | turn/tool timings, tokens, cost ticks, tool failures | full from the wrapper/ingest; cwd recoverable from the session dir | no OTLP; Claude-hook compat may mis-tag rows as `claude-code` |
| Grok Bot (box / hosted) | host metrics + daemon state file; Cursor Enterprise export (`cursor.grok_bot.*`) | liveness, in-flight count; actions only via Enterprise | `beep.harness=grok-bot`, host-level only | NOT FOUND: what runs on `grok-bot-box-1`; per-action data gated |
| Muse Code | **native OTLP** (`OTEL_EXPORTER_OTLP_ENDPOINT`, GenAI semconv) + proxy stamp when `claudem` | turn-root traces, tool spans, tokens | `workspace.repo` native; `beep.*` via collector enrichment or proxy headers | no `OTEL_RESOURCE_ATTRIBUTES`; native export UNVERIFIED (needs a probe) |
| CLIProxyAPI | **vendored `usage.Plugin`** → span/log per request | model, account index, latency, TTFT, tokens, failures | `beep.*` from `X-Beep-*`, `provider_account` from `AuthIndex`, session from parsed headers | no OTel in the tree; must not export `APIKey`; v7 flat keys vs v8 `observability:` |
| Webapp (Next on Vercel) | `@vercel/otel` + `OtelTracer.layerGlobal` | request/fetch/Effect spans | `OTEL_RESOURCE_ATTRIBUTES` via `envDetector`; `vcs.*` native | `grpc` protocol silently misroutes; needs public ingress (prior handoff) |
| CI (Turbo) | summary-JSON → spans (`beep ci`), optional Turbo OTel metrics | run/task duration, cache status, `timeSaved` | `TURBO_EXPERIMENTAL_OTEL_RESOURCE` + `cicd.*` | Turbo OTel is metrics only and https-only; key is `global.experimentalObservability` here; strip `user` |

### Probes to run before shaping (cheap, local, no paid endpoints)

1. Codex: `OTEL_RESOURCE_ATTRIBUTES` on `codex_*` metrics (closes the v1 gap or confirms it).
2. Muse: `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 muse exec …` against a loopback collector. Record the resource and span attributes.
3. Grok: whether a trusted beep checkout runs `.claude` hook-pulse (row `agentKind` check).
4. CLIProxyAPI: whether the live v7 flat keys still bind under v8, and whether `ctx.Value("gin")` survives into `HandleUsage`.
5. Claude via proxy: `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1` produces Bash `TRACEPARENT` and an upstream `traceparent` header at the proxy.
