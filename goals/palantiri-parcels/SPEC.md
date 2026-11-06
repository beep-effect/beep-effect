# Palantiri Parcels Spec

## Objective

Agent-facing Palantiri: schema-typed, freshness-checked parcels served through beep palantiri and palantiri-mcp, starting with account headroom.

## Non-Goals

- Any spend: SaaS backends, Vercel drains, Grafana Cloud above free, Tailscale paid tiers (exploration D9).
- Choosing the logs/traces store; that waits for the hub gate (D1).
- Mutating dankserver, the tailnet policy, `tom-pc-1` or any host directly; ship exact commands as proposals the operator applies.
- `tbk-ubuntu` and its security-sensitive VM (gated host; never instrumented).
- Developer-AI analytics (`@beep/repo-ai-metrics`), cache policy (`goals/turborepo-cache-trust-observability`) and CI step forensics (`goals/ci-step-watchdog`) — consume, never absorb.
- Dashboards hand-built in the Grafana UI or copied from the existing generated ones.

## Source Hierarchy

1. The graduating exploration: [`explorations/observability-palantiri`](../../explorations/observability-palantiri/) — `BRIEF.md`, `MAP.md`, `DECISIONS.md` (back-links, not copies).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/library/palantiri/**` (NET-NEW)
- `beep palantiri mcp` (stdio MCP host in `@beep/repo-cli`; replaces the planned `palantiri-mcp` package, Decision Log)
- `packages/tooling/tool/cli/src/commands/Palantiri/**` (NET-NEW group) and `Accounts/` (quota gauge)
- `SessionLedger` / `beep session open` push

## Constraints

- Every parcel is an `S.Class` from a ParcelSpec: typed key (session | lane | host | pr | app | account), freshness bound, sources, pure reducer; `Freshness = Fresh | Unknown{reason}` checked at read time.
- One HttpApi contract serves both the CLI and the MCP server; CLI-first, honouring `TRACEPARENT`.
- Responses are budget-capped with "N of M" receipts and summary-first shape (Axiom pattern, `explorations/observability-palantiri/research/handoff/agent_facing_tooling.md`).
- The MCP server and CLI carry their own exporter config (Claude Code strips `OTEL_*` from MCP children).
- Completeness check downgrades to `Unknown{attribution-incomplete}` when expected emitters are silent; vendor cloud VMs report `Unknown{unreachable}`.
- Account identity is an ordinal or salted hash, never an email.
- Schema → `Context.Service` contract → implementation; Effect v4 only, validated against `.repos/effect`; `effect/<Module>` imports; `HashMap`/`HashSet`; `Effect.fn`/`fnUntraced`.
- Names, metrics, events and attribute keys come from the instrumentation catalog (`goals/observability-kernel-catalog`); names are static literals, never interpolated.
- Public repo: no client data, tokens, `op://` resolutions, LAN IPs, tailnet suffixes or account identifiers in packet or code.
- Totals use `increase()` over the panel range; per-process identity never becomes a metric label; promoted labels come only from the registry's metric-safe set.

## Acceptance Criteria

- [x] First vertical slice (`explorations/observability-palantiri/MAP.md`): `beep palantiri parcel account-headroom --json` decodes to `Fresh`/`Unknown{stale}`, and the run exports a `beep.accounts.window_remaining` gauge and a `Parcels.read` span carrying `beep.*` v2 attributes, nested under the caller's trace.
- [x] Five parcels ship: account headroom, lane reds, host pressure, app error classes, since-last-check.
- [x] `beep palantiri mcp` exposes the same parcels with identical encoded JSON; stdio host pins `Logger.LogToStderr`.
- [x] `beep session open` prints the hot parcels.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/palantiri-parcels/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/palantiri-parcels/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/palantiri-parcels` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-11-02 | The P0 precedent host, `beep agent-message tools`, is `retired:agent-message-router` ([last tree](https://github.com/beep-effect/beep-effect/tree/6bb8584b6dbc9aee927a200901c9eebc0abd63b1/goals/agent-message-router)); `beep palantiri mcp` stands on its own `McpServer.layerStdio` composition. | The agent-message stack was deleted by `goals/t3-native-orchestration`. | Restore the packet from git at the permalink and revert the retirement PR. |
| 2026-10-14 | Inherit exploration decisions D1–D9 and the align/agent-decided entries in `explorations/observability-palantiri/DECISIONS.md`. | Graduated from `explorations/observability-palantiri`. | Reopen the exploration at `decompose`. |
| 2026-10-14 | P0: parcel schemas, reducers, source ports, the `Parcels` service, the HttpApi contract and the instruments live in `@beep/palantiri` (tooling library); `@beep/repo-cli` implements the ports and serves the contract. Design: `research/parcels-design.md`. | Every source lives in the CLI and nothing may depend on it (`research/source-survey.md`). | Extract the source readers into a shared library and move the port implementations there. |
| 2026-10-14 | P0: the MCP host is the `beep palantiri mcp` stdio subcommand instead of a `packages/tooling/tool/palantiri-mcp` package. It runs the same handlers as `beep palantiri parcel`, so the encoded JSON is identical. | Same dependency constraint; the CLI already hosted `McpServer.layerStdio` (the former `beep agent-message tools` server, deleted 2026-11-02; `beep palantiri mcp` is now the CLI's stdio MCP host); one boot per session, not per call. | Create the package and have it call the CLI. |
| 2026-10-14 | P0: `Freshness.Unknown` gains the reason `no-source` for a parcel whose source does not exist yet. App error classes answer it until the Grafana datasource query adapter lands in P2. | Honest output beats a fake parcel; the exploration's three reasons don't cover a missing source. | Drop the reason and hold the parcel back. |
| 2026-10-14 | P0: account headroom serves a CLI-written snapshot under `$HOME/.local/state/beep/palantiri/` while it is within 5 minutes, and polls live otherwise. | A live `AccountsUsage` poll takes up to 20 s per account. | Always poll live. |
| 2026-10-14 | P1: the quota gauge's window label is `beep.window`, not `window`. | Catalog attribute keys must be dotted (`AttributeKeyName` pattern); `beep.provider` stays the key `@beep/repo-ai-metrics` declares. | Relax the catalog key pattern and rename the label. |
| 2026-10-14 | P1: `beep.accounts.window_remaining` carries one series per provider, window and `beep.window_scope` (the model group of a scoped window, or `all`), valued at the most headroom any of that provider's accounts has within that group; `beep.provider` uses the `AgentProvider` spellings (claude → anthropic, codex → openai, grok and grok-bot → xai, muse → meta, junie → jetbrains, cursor → cursor). A snapshot provider outside that map emits no gauge. | Account ordinals must never be metric labels, so several accounts share a series; "best headroom" is the actionable value. | Add `beep.provider_account` as a label (bounded) and emit per account. |
| 2026-10-14 | P1: the `Parcels.read` span and the gauge are emitted inside the library's `Parcels.read`, owned by `@beep/palantiri`; hosts only add the `TRACEPARENT` parent (`withTraceParent`, also in the library so the MCP host reuses it). | The catalog owner of both instruments is the library; every host gets them for free. | Move emission into each host. |
| 2026-10-14 | P1: the in-process client is `HttpApiTest.groups` (`HttpRouter.toHttpEffect` + `HttpApiClient.makeWith`), not `HttpRouter.toWebHandler`. | `toWebHandler` builds its own runtime, so the handler would lose the caller's tracer, parent span and metric registry; `toHttpEffect` runs it in the caller's fiber through the same encode/route/decode pipeline. | Swap in `toWebHandler` with the telemetry layer inside its app layer. |
| 2026-10-14 | P1: `Parcels.read` fails only with `UnknownParcel`; `SourceFailed` from a port becomes `Unknown{unreachable}`. A live poller that cannot start becomes a source whose every read fails. Parcel items carry `state` (ok, needs-login, failed) and each window's `scope`; envelopes carry `schemaVersion` and `readAt`, and an optional `budget` query (default 20). | Honest unknowns over command failures; scoped windows are otherwise indistinguishable. | Drop the fields and widen the error channel. |
| 2026-10-14 | P1: freshness has two levels. Each item carries its own (`Fresh`, `Unknown{stale, asOf}` past the bound, `Unknown{unreachable}` for a failed poll or expired login); the envelope's describes the read: `Fresh` when the served poll or snapshot is within the bound, `Unknown{stale}` only when a stale snapshot was served because the live poll failed, `Unknown{attribution-incomplete}` when a configured provider produced no item. The summary leads with the split, and the gauge emits only fresh items. The source port now serves `AccountHeadroomInput` (report plus expected providers). | The P1 live run read `Unknown{stale}` because one collector snapshot was 14 hours old: a single stale reading made the whole parcel look stale, so it nearly always would. | Collapse back to one envelope freshness over every reading's `asOf`. |
| 2026-10-15 | P2: app error classes ships as `Unknown{no-source}` with no items and no source port; the Grafana datasource query adapter is deferred. | The local dev sink (`grafana/otel-lgtm`) publishes only Grafana and OTLP ingest, Tempo and Loki are not exposed, and Grafana's query API needs auth (`research/source-survey.md`, parcel 4), so there is nothing to query without new infrastructure. | Build a query adapter under `packages/drivers/*`, add an `AppErrorClassesSource` port, and reduce the parcel from it. |
| 2026-10-15 | P2: lane reds reads the current checkout plus every live checkout in the session ledger. A red is an unacknowledged, unsuperseded P0/P1 inbox row that asks for work, or the newest settled proof job on a branch when it failed; base drift and observation rows (`pr-merge-ready`, `proof-job-finished`) are not reds. | One parcel answers "what is red across my lanes"; a later passing job clears an earlier failure; news rows are not reds. | Read only the current checkout, or count every failed job. |
| 2026-10-15 | P2: host pressure parses PSI in the library and reads files in the CLI; no `/proc/pressure` is `Unknown{unreachable}`, a missing resource file or memory/admission reading is `attribution-incomplete`. New gauge `beep.host.pressure_stall` (`%`, label `beep.resource`: cpu, memory, io; static), recorded from fresh readings only. | Pure, testable parser; a host without PSI must not read as zero pressure. | Drop the gauge and the `beep.resource` key; read PSI in the CLI. |
| 2026-10-15 | P2: since-last-check keeps a per-session cursor at `cursors/<host>__<owner>__<name>/<session>.json` under the Palantiri state directory, written atomically (unique temporary file, then rename). Session: `--session`, else `CLAUDE_CODE_SESSION_ID`, else `CODEX_THREAD_ID` (the session ledger's own probe); none is `attribution-incomplete`. No cursor falls back to the session's newest own ledger note; its own notes are left out; the cursor moves to the read time taken before the sources are read. | Reuses the ledger's harness probe; a missed row reappears rather than vanishing; a session's own notes are not news. | Key the cursor by checkout, or advance to the newest change's time. |
| 2026-10-15 | P2: parcel free text (session notes, inbox summaries) is redacted: addresses become `[email]`, any other `@` is dropped, home-absolute paths start with `$HOME`. Inbox summaries are built from structured fields only. | Notes are written by people and agents; a parcel must never carry an address, so consumers can assert no `@`. | Serve structured fields only and drop note text. |
| 2026-10-15 | P2: `ParcelItem` is tagged by item kind (host pressure serves `PressureStall`, `HostMemory`, `AdmissionSlots`), and a summary names at most five labels per unknown reason, then `+N more`. | Flat, matchable items; the first live lane-reds run listed 19 stale lanes. | One item class per parcel with a nested union; uncapped label lists. |
| 2026-10-15 | #1817 review round 2: the account snapshot directory is created `0700` and the file written `0600` (it carries account labels), and a failed provider listing is `None` on `AccountHeadroomInput.expectedProviders`, which makes a fresh read `Unknown{attribution-incomplete}` ("provider listing unavailable") instead of treating it as "no providers expected". | Another local user must not read account labels; an unknown provider set must not look like complete attribution, while the stale-snapshot fallback still serves. | Revert the modes and return to an empty-list fallback. |
| 2026-10-15 | P3: stale gauge series are cleared by replacing each gauge's whole series set on every read. Effect 4.0.4 has no remove-series or reset API (`Metric.d.ts` exposes `snapshot`, `update`, `modify`, `withAttributes`), but `MetricRegistry` is typed as the public `Map<string, Metric.Metadata>` the OTLP exporter snapshots (`Metric.snapshotUnsafe`). `replaceGaugeSeries` (`@beep/palantiri` `GaugeSeries.ts`) sets one series per fresh reading, then deletes every other series of that gauge from the registry, matching series by the same attribute merge Effect keys them by (gauge attributes, then ambient `Metric.CurrentMetricAttributes`, then the reading's; #1836 review); a source failure clears the gauge. Applies to `beep.accounts.window_remaining` and `beep.host.pressure_stall`. | A long-lived `beep palantiri mcp` host must stop reporting a provider or resource once its reading is stale; a per-read registry would need a per-read exporter, since the exporter reads the registry captured when its layer was built. | Record into a fresh registry per read and export from a per-read exporter, or drop the deletion and accept stale series in the host. |
| 2026-10-15 | P3: `beep palantiri mcp` serves six tools over `McpServer.layerStdio` through `sanitizedToolkit`: `palantiri_parcels` (a `ParcelCatalog` listing) and one tool per parcel (`palantiri_<id in snake case>`, success schema `ParcelEnvelope`). Every tool reads through the same `readParcel` as `beep palantiri parcel`, so the text content is the same `JSON.stringify` of the encoded envelope that `--json` prints. `palantiri_since_last_check` is not read-only (it moves the cursor). `Logger.LogToStderr` is pinned around `Layer.launch`. Export comes from `--otlp-endpoint`, else `BEEP_PALANTIRI_OTLP_ENDPOINT`, else nothing (service name `beep-palantiri-mcp`). Client failures are defects (an internal tool error), since sources already degrade to `Unknown`. | Byte-identical JSON by construction; a single read path. | Give the tools their own handlers and failure schemas. |
| 2026-10-15 | P3: `beep session open` (text mode only; `--json` stays `session-open/v1`) prints the account headroom, lane reds and host pressure parcels after the ledger rows, one line each with its freshness, within 2 seconds counted from building the client runtime. A parcel that overruns is `Unknown (timed out after 2s)` and a failed one `Unknown (read failed)`; when the runtime cannot be built or the whole block overruns, one `[palantiri] hot parcels: Unknown (...)` line replaces the block. A finished block is staged as `hot.json` (`palantiri-hot/v1`) in the Palantiri state directory (directory `0700`, file `0600`, unique temporary file then rename, shared `writePrivateFile`); a parcel that timed out or failed carries its last read line as `carried`, worded `stale since <as-of>` (the reading's freshness `asOf`, so a stale snapshot keeps its own time; else the read time; #1836 round 2) and never `fresh`, for at most 3 reads in a row, then prints its `Unknown` line (#1836 review; the file moved to `palantiri-hot/v2`, which adds state, summary, as-of time and carry count, and a v1 file carries nothing). `session open` prints the block as staged. The SessionStart hook (`.claude/hooks/session-ledger.sh`) prints that file with `jq` on every exit path and never runs the CLI. The hot sources get their own `MemoryStatsLive` and `FetchHttpClient`, so `session open` requires nothing new from its caller. | The hook must stay fast; a live account poll takes far longer than 2 seconds, so an honest `Unknown` beats blocking session start, and a kept line beats overwriting the last good reading with a timeout. | Drop the block from `session open`, or let the hook call `beep palantiri parcel` under a timeout. |

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug palantiri-parcels`; add a `kind: decision` file there, never edit this block._

### Serve cached account headroom at session start, 2026-11-06

Session start reads the existing private account snapshot without starting usage polls. It preserves independent configured-provider inventory and original report and row timestamps: expired data stays Unknown stale, and missing attribution stays Unknown attribution-incomplete. Explicit Palantiri reads remain live. Completed accounts status, non-TTY board and TTY polls stage a retained-last-good copy atomically; raw command output is unchanged and NeedsLogin remains definitive. Synthetic delayed-source controls reproduce interruption before snapshot publication under the two-second hot limit.

Reverse: Restore live-refresh account source for session start and remove completed-report staging from accounts presentation.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
