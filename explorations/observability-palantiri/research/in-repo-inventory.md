# In-repo inventory: observability-palantiri

Date: 2026-10-14. Checkout: branch `explore/observability-palantiri` (main @ `9b433fe738`).
Lane: read-only research. It checks the handoff claims in
`research/handoff/effect_v4_observability_surface.md` and `research/handoff/landscape-report.md`
against the live checkout. Citations are `path:line`, repo-relative unless prefixed `REF/`.
`REF` = the Effect reference checkout at `~/YeeBois/references/effect/effect` (`packages/effect`
version 4.0.4). Installed `effect` = 4.0.2.

Verdict key: **CONFIRMED** (live evidence or source read), **REFUTED**, **PARTLY** (true in part,
overstated in part), **UNCERTAIN** (needs a live test or more evidence).

Live proofs were throwaway Bun scripts in the session scratchpad, outside the repo. Each imported the
repo's real `src/` modules and the installed `node_modules/effect/dist`. A local `Bun.serve` stood in
for the OTLP collector, and a Bun WebSocket stood in for the DevTools server.

---

## 1. Three probable defects in `@beep/observability`

### (a) `layerLocalLgtmServer`: the DevTools tracer overrides the OTLP tracer. **CONFIRMED (live)**

- Composition: `Layer.mergeAll(enableRuntimeMetricsLayer, layerMinimumLogLevel, Otlp.layerProtobuf(...), layerFilteredDevTools(...))`
  puts the OTLP layer and the DevTools layer side by side as siblings
  (`packages/foundation/capability/observability/src/server/Layer.ts:63-84`).
- Both provide `Tracer.Tracer`: upstream `OtlpTracer.layer` is `Layer.effect(Tracer.Tracer)`
  (`REF/packages/effect/src/observability/OtlpTracer.ts:135-138`), and beep's DevTools layer is
  `Layer.effect(Tracer.Tracer, ...)` (`src/server/DevTools.ts:170`).
- The DevTools layer reads `Effect.tracer` when the layer is built (`src/server/DevTools.ts:174`). A sibling
  layer never sees the other sibling's output, so the tracer it wraps is the native no-op tracer, not OTLP.
- Live matrix. The probe ran `Effect.withSpan(Effect.currentSpan)` and recorded the span class and the
  OTLP paths the collector received:

  | otlpEnabled | devtoolsEnabled | span class | OTLP paths received | DevTools span msgs |
  |---|---|---|---|---|
  | false | false | `NativeSpan` | — | — |
  | true | false | `SpanImpl` (OTLP) | `/v1/traces`, `/v1/metrics` | — |
  | false | true | `NativeSpan` | — | `proof.span:Started` |
  | **true** | **true** | **`NativeSpan`** | **`/v1/metrics` only** | `proof.span:Started` |

  With both enabled, **no traces reach OTLP**. Metrics still flow.
- Fix, proven live: `layerFilteredDevTools(...).pipe(Layer.provideMerge(Otlp.layerProtobuf(...)))`.
  The span becomes `SpanImpl`, `/v1/traces` is exported, and DevTools still gets the span.
- Blast radius: the only production mount is the professional-desktop sidecar. It enables OTLP when
  `OTEL_EXPORTER_OTLP_ENDPOINT` is set and DevTools when `DEVTOOLS=true` and the URL is local
  (`apps/professional-desktop/src/runtime/Observability.ts:56-91`). A QA session that sets both loses
  all sidecar traces with no error.

### (b) The filtered DevTools tracer sends only the span-start snapshot. **CONFIRMED (live)**

- beep calls `client.sendUnsafe(toDevToolsSpan(span))` once, when the span opens, and returns the
  span unpatched (`src/server/DevTools.ts:176-188`).
- Upstream `makeTracerEffect` sends the start snapshot, patches `span.event` to send `SpanEvent`, and
  patches `span.end` to send a final snapshot (`REF/packages/effect/src/devtools/DevToolsClient.ts:195-226`).
- Live: in both DevTools-enabled rows above, DevTools received exactly one message for the span, with status
  `Started`. It never received `Ended`.
- Secondary difference: upstream copies the attributes (`new Map(span.attributes)`, `DevToolsClient.ts:190`).
  beep passes the live Map reference (`DevTools.ts:141`), which is harmless today because send is
  synchronous NDJSON encoding, but it diverges from upstream.
- Fix: port upstream's `event`/`end` patches behind the `shouldPublish` filter, or call upstream
  `DevToolsClient.makeTracer` and filter at the client.

### (c) `Logger.layer` without `mergeWithExisting: true` drops `tracerLogger`. **CONFIRMED (semantics). The impact differs per site.**

- v4 semantics: `CurrentLoggers` defaults to `new Set([defaultLogger, tracerLogger])`
  (`REF/packages/effect/src/internal/effect.ts:6532-6535`). `Logger.layer` builds
  `new Set(options?.mergeWithExisting === true ? fiber.getRef(CurrentLoggers) : [])`
  (`REF/packages/effect/src/Logger.ts:1056-1072`). The installed 4.0.2 dist is identical
  (`node_modules/effect/dist/Logger.js:861`, `node_modules/effect/dist/internal/effect.js:3038`).
  Omitting the flag therefore replaces both the default logger and the log-to-span-event bridge.
- Note: `Otlp.layer`'s logger defaults to `mergeWithExisting ?? true`
  (`REF/packages/effect/src/observability/OtlpLogger.ts:128`), so the OTLP logger itself is additive.

Every `Logger.layer(` call site in tracked TS (`git grep`), production code first:

| Site | Flag | Effect | Note |
|---|---|---|---|
| `packages/foundation/capability/observability/src/Logging.ts:467` (`layerConsoleLogger`) | omitted | drops `tracerLogger` | Library helper. Zero consumers outside the package. |
| `apps/professional-desktop/server/main.ts:132` (IPC sidecar) | `false` (explicit) | drops `tracerLogger` | Deliberate stdout hygiene for NDJSON frames. Should add `Logger.tracerLogger` back explicitly. |
| `apps/labs/semantica/src/runtime/Layer.ts:28` | `false` (explicit) | drops `tracerLogger` | Lab app. No tracer installed, so the impact today is nil. |
| `packages/foundation/ui-system/dock/src/Dock.atoms.ts:53` | omitted | drops `tracerLogger` | Browser atom runtime, `consolePretty` only. |
| `packages/foundation/modeling/html/scripts/generate.ts:4195` | omitted | drops `tracerLogger` | Codegen script. Irrelevant. |
| `packages/tooling/test-kit/test-runner/src/internal/VitestInstrumentation.ts:166-167` | `true` | OK | — |
| Tests: `apps/professional-desktop/test/*.ts(x)` (2), `packages/documents/server/test/SecretScrubGate.test.ts:103`, `packages/tooling/test-kit/test-runner/test/Vitest.test.ts:218,397`, `packages/foundation/capability/observability/test/{CauseRedaction,PhaseProfiler,Logging}.test.ts` | omitted | intended capture loggers | Not defects. |
| `scratchpad/**` (~40 sites, effected kit ports) | mostly omitted | n/a | Scratchpad lane, not product. |

### (d) Bonus defect: `layerConsoleLogger(config)` returns a function, not a Layer. **CONFIRMED (live)**

- `layerConsoleLogger` is `dual(2, (config, pretty = default) => ...)` (`src/Logging.ts:461-467`). Because
  `pretty` is optional, the one-argument call that its own JSDoc example uses (`Logging.ts:449-450`)
  takes the data-last branch.
- Live: `Layer.isLayer(layerConsoleLogger(cfg))` → `false` (typeof `function`), while
  `layerConsoleLogger(cfg, undefined)` → `true`. No test covers it, and nothing outside the package calls it.
  Fix: use an `isDataFirst` predicate, e.g. `(args) => LoggingConfig.is(args[0])`, the same way `layerLocalLgtmServer`
  does (`server/Layer.ts:56`).

### (e) Handoff "fourth defect": 4.0.4 #9066. **PARTLY**. See §8.

---

## 2. `@beep/observability` consumers and public surface

Public surface (`packages/foundation/capability/observability/package.json` exports):
`.`, `./CauseDiagnostics`, `./CauseRedaction`, `./CoreConfig`, `./HttpError`, `./Logging`,
`./Metric`, `./Observed`, `./PhaseProfiler`, `./Version`, `./server`, `./web`,
`./experimental/server`, `./internal/*: null`. The root barrel re-exports every top-level module except
`server`/`web`/`experimental` (`src/index.ts:35-91`). `server/index.ts` re-exports Config, DevTools,
ErrorReporting, HttpApiTelemetry, Layer, NodeSdk, Prometheus, TraceContext. `web/index.ts`
re-exports Config and Layer. `experimental/server/index.ts` re-exports DevToolsRelay and OtlpPacketLab.
The source is about 6.6k LOC.

Declared dependents (package.json): professional-desktop, agents-client, agents-server, wink,
epistemic-server, nlp-processing, ontology-client, repo-cli. That is 8, and **not** `@beep/repo-ai-metrics`.

Imports outside the package (35 import lines in total, `git grep`):

| Subpath | Symbols | Consumers |
|---|---|---|
| `@beep/observability/CauseRedaction` | `logRedactedCause`, `LogRedactedCauseOptions`, `redactCauseForClient`, `tapRedactedCause` | professional-desktop (20 files) |
| `@beep/observability` (root) | `logRedactedCause`/`LogRedactedCauseOptions` | agents-client `Chat.atoms.ts:19`, epistemic-server `ContradictionTriage.layer.ts:37`, ontology-client `Session.atoms.ts:12` (+`redactCauseForClient`) |
| root | `redactString` | agents-server `AssistantTurn/BlockRepair.ts:13` |
| root | `observeWorkflow`, `summarizeCause`, `redactCauseSummary`, `trackDuration` | wink `WinkObservability.ts:10`, nlp-processing `internal/observability.ts:8` |
| root | `profilePhase` / `sanitizeSensitiveText` | repo-cli `Files.service.ts:15`, `Knowledge.service.ts:9` |
| `/Metric` | `observeWorkflow` | professional-desktop (3 orchestrators) |
| `/PhaseProfiler` | `profilePhase` | professional-desktop `Migrations.ts:16`, `Pglite.ts:33` |
| `/server` | `layerLocalLgtmServer`, `ServerObservabilityConfig` | professional-desktop `src/runtime/Observability.ts:22` |
| `/server` | `layerNodeSdkServerTraces`, `ServerObservabilityConfig` | repo-cli `Docgen/internal/QualityWorkerRunpodEval.ts:13,876` |

Server layers in use:
- `layerLocalLgtmServer`: **one** mount, the professional-desktop sidecar
  (`apps/professional-desktop/src/runtime/Observability.ts:90-93`). It is provided at
  `src/runtime/Layer.ts:361` (`Layer.provideMerge(ObservabilityLive)`). This is the mount with defect (a).
- `layerNodeSdkServerTraces`: one mount, built per run inside the RunPod docgen eval
  (`QualityWorkerRunpodEval.ts:876`), trace-only, with `service.name=beep.docgen.quality-worker-eval-runpod`.
- The beep CLI root installs **no** tracer, metric, or OTLP layer. The only direct `effect/observability`
  users outside the package are the professional-desktop sidecar and agents-client.

Exports with no consumer. The census matched every exported name against tracked TS outside the package
by whole word, then dropped word collisions such as `LoggingConfig` in repo-configs, `HttpStatusCode` in
scratchpad, and `VERSION`. About **14 of 124** exported symbols have a real consumer. Whole modules with
**zero** consumers:
`Observed`, `HttpError`, `Logging` (incl. `layerConsoleLogger`), `CoreConfig`,
`server/DevTools` (reached only through `layerLocalLgtmServer`), `server/ErrorReporting`,
`server/HttpApiTelemetry`, `server/Prometheus`, `server/TraceContext`, `server/NodeSdk`
(except `layerNodeSdkServerTraces`), all of `web/*`, and all of `experimental/server/*`.
**CONFIRMED** handoff claim "server surface built but not wired".

Duplication: agents-client builds its own browser OTLP layer with `Otlp.layer` +
`OtlpSerialization.layerJson` (`packages/agents/client/src/ClientObservability.ts:95-113`)
instead of `@beep/observability/web` (`web/Layer.ts`, 0 consumers).

README drift: "Current Consumers" lists `@beep/repo-cli` and `@beep/repo-ai-metrics`
(`packages/foundation/capability/observability/README.md:26-29`). repo-ai-metrics does not depend on
it, and the list leaves out 7 real dependents. 07-non-slice-families requires the README to name every
importer (`standards/architecture/07-non-slice-families.md:55-60`).

---

## 3. `apps/practice-kg-mcp`

- Shape: about 2.1k LOC in 16 `src` files. Bins (`apps/practice-kg-mcp/package.json`): `practice-kg-mcp` → `src/bin.ts`,
  `practice-kg-build` → `src/build.ts`, `practice-kg-claims` → `src/claims.ts`,
  `practice-kg-verify` → `src/verify.ts`. Dependencies: anthropic, duckdb, identity, law-practice-server,
  pglite, schema, utils, platform-bun. **No `@beep/observability`.**
- Entrypoint: `src/bin.ts:81-90`, an `effect/cli` `Command` with `--bundle-dir`, `--corpus-root`, and
  `--self-check`. `runEntrypoint` wraps it as `Layer.effectDiscard` + `BunServices.layer` +
  `BunRuntime.runMain` (`src/entrypoint.ts:26-33`).
- Serve path: `resolveBundle` → `runPracticeKgSelfCheck` → `loadPracticeKgBundleContext` →
  `Layer.launch(makePracticeKgHostLayer(ctx))` (`src/bin.ts:58-69`). The host layer is
  `makePracticeKgServerLayer` from `@beep/law-practice-server` (`src/runtime/Host.ts:157-163`). That is
  `McpServer.layerStdio` around `PracticeKgToolkitLayer` (`packages/law-practice/server/src/Tools.ts:190-202`).
  The toolkit is already registered through mcp-kit's `sanitizedToolkit`
  (`packages/law-practice/server/src/Tools.ts:109-112`), so the raw tool `parameters` span attribute is
  suppressed if a tracer is ever installed.
- Build: `src/package.ts` writes an MCPB `manifest_version: "0.3"` with `server.type: "binary"` and
  env `BUNDLE_DIR`, `NODE_PATH`, `PRACTICE_KG_CORPUS_ROOT` (`src/package.ts:195-239`). It then runs
  `bun build --compile --target=<bunTarget> apps/practice-kg-mcp/src/bin.ts` and zips the result to
  `practice-kg-mcp-<target>.mcpb` (`src/package.ts:302-329`). Targets are linux-x64 and windows-x64
  (`package:mcpb*` scripts).
- stderr and stdout today:
  - Startup refusal: `Console.error(error.message)` (`src/bin.ts:65-67`).
  - `--self-check` prints one JSON line to stdout with `Console.log` (`src/runtime/SelfCheck.ts:156,361`).
  - `smoke.ts`/`package.ts` children use `stderr: "inherit"` (`src/smoke.ts:269,378,428`, `src/package.ts:96`).
  - **Not set:** `Logger.LogToStderr`. Sibling stdio hosts set it, e.g. `packages/drivers/gov-legal-mcp/src/bin.ts:50`
    and `apps/practice-mail-tagging/src/entrypoint.ts:55`. With the v4 default, the default logger writes
    with `console.log` (`node_modules/effect/dist/Logger.d.ts:150-165`). `McpServer.layerStdio` does not set it
    (`node_modules/effect/dist/ai/McpServer.js:1027`). Any `Effect.log*` reached while serving
    would hit stdout and could corrupt MCP framing. law-practice-server has `Effect.log` calls in
    `PracticeKg.claims.ts`, `.correspondents.ts`, and `.projections.ts`. Whether tool handlers reach them is
    **UNCERTAIN** and needs a check.
- The claim "zero Tracer, Metric, or Logger usage" is **PARTLY** true. No tracer, metric, or logger layer is
  installed, there is no observability dependency, and no `Metric` appears. But `Effect.fn("PracticeKgHost.loadBundle")`
  (`src/runtime/Host.ts:59`), `PracticeKgSelfCheck.*` (`SelfCheck.ts:202-309`), and `withSpan("PracticeKgSelfCheck.print")`
  (`SelfCheck.ts:362`) already open named spans. They go to the native no-op tracer, so installing a tracer
  makes them visible with no further edits.
- Config and tier: `Config.String("PRACTICE_KG_BUNDLE_DIR" | "BUNDLE_DIR" | "PRACTICE_KG_CORPUS_ROOT")`
  (`src/bin.ts:43-45`), plus MCPB `user_config` (`package.ts:221-235`). The app has **no tier notion**.
  Tier machinery exists in `@beep/mcp-kit` (`FieldTier` minimal/balanced/complete
  `packages/foundation/capability/mcp-kit/src/FieldTier.ts:50`, `TierGate` service `TierGate.ts:376`).
  Practice-KG does not use either.

---

## 4. `beep accounts` / `AccountsUsage`

- Location: `packages/tooling/tool/cli/src/commands/Accounts/` (3.5k LOC). The service tag is
  `AccountsUsage` (`AccountsUsage.service.ts:116`), the live layer is `layerAccountsUsageLive` (`:609`), and the
  shape is `accounts`, `poll(account)`, `signedIn`, `snapshots` (`:95-98`).
- Sources: Claude OAuth usage, Codex `wham/usage`, Muse key, Grok billing
  (`AccountsUsage.service.ts:118-121`). Per-request timeout is 20 s (`:124`) and `POLL_CONCURRENCY = 4` (`:125`).
  It reads proxy auth files without writing or refreshing them (`:7-9`). Snapshot JSON files come from a workstation state dir
  (override `BEEP_ACCOUNTS_SNAPSHOT_DIR`, `:525`).
- Schema (`Accounts.schemas.ts`): `AccountProvider` LiteralKit claude/codex/muse/grok (`:34`),
  `AccountRef` (`:131`), `UsageWindow {kind, scope, usedPercent: Finite, resetsAt}` (`:187-194`),
  `UsageWindowKind` session/weekly/weekly-scoped/cycle/cycle-scoped (`:150`), `CreditBalance` (`:240`),
  `AccountUsageOutcome` TaggedUnion (`:276`), `AccountUsage` (`:315`), `AccountAvailability`
  ready/session-capped/weekly-exhausted/unavailable (`:416`), `AccountsStatusReport` + `...Json`
  codec (`:558-584`).
- Cadence: on demand. `beep accounts status [--json]` polls once (`Accounts.command.ts:29,37-81`).
  The live screen `beep accounts --every N` defaults to 60 s with a 15 s floor
  (`Accounts.command.ts:31-34,113-115`; `Accounts.tui.ts:38,112`). There is **no daemon or timer**.
  `pollAccounts` is spanned `AccountsUsage.pollAll` (`AccountsUsage.service.ts:626-630`).
- Emitting a gauge would take three things:
  1. A `Metric.gauge("beep.accounts.window.used_ratio")` keyed by low-cardinality attributes
     `provider`, `window.kind`, and `account.label_hash`. Hash the account label: it is a login identity.
  2. One `Metric.update` per `UsageWindow` in `pollAccounts`, or better, in `loadAccountsReport` (`:726`).
  3. A long-lived host that polls on a schedule and exports. Today the CLI has no exporter, so a
     one-shot `status` would need an OTLP layer with a flush on exit, or a systemd timer that runs
     `beep accounts status --json` and lets a collector or textfile exporter read the result. The schema is
     already complete, so this is a NET-NEW emitter on top of a reused model.

---

## 5. Lineage packets: what they own

| Packet | Status | Owns, so Palantiri must reconcile rather than duplicate |
|---|---|---|
| `goals/harness-otel-adoption` | `completed-retained` (closed 2026-07-25, `README.md`) | Claude Code and Codex **native OTel** pointed at the dankserver `monitoring_otel_collector` (traces → Phoenix, metrics → Prometheus/Grafana). It also owns the beep attribute contract v1 and the dual-ingestion precedence rule. Target surfaces: user-level harness config (operator-owned), the dankserver collector (Ansible, dankserver repo), and the attribute schema homed in `packages/tooling/library/ai-metrics` (`SPEC.md:42-53`). |
| `goals/ai-metrics-stack` | `completed-retained` | `@beep/repo-ai-metrics` owns the developer-AI analytics language: transcript ingest, redaction, raw/derived archives, config snapshots, scorecards, and export adapters. **`@beep/observability` owns general runtime observability, and AI semantics must not move into it** (`SPEC.md:52-62`). It also owns OTLP-first export with Phoenix as the default UI, the dankserver tailnet deploy, and an XDG data root at `~/.local/state/beep/ai-metrics` (`SPEC.md:28-103`). Customer AI analytics and replacing `@beep/observability` are out of scope (`:41-49`). |
| `goals/ai-metrics-raw-retention` | `active`, all phases pending | Derive-from-raw proof plus age-based compaction of the encrypted raw archive, run by an ops-seat timer. Depends on `goals/ops-seat-timers` (`SPEC.md:3-33`). |
| `goals/turborepo-cache-trust-observability` | `active`, phase 1 in progress | Cache-specific typed outcomes and bounded receipts, with low-cardinality metric labels. OTEL is allowed only with separate creds, an allowlist, sampling/queue/retention bounds, and a disable switch (`SPEC.md:79-94`). A non-goal is a "generic telemetry platform" (`SPEC.md:12-14`), so Palantiri must not absorb cache policy. |
| `goals/ci-step-watchdog` | `paused` (authored, not started) | Per-step watchdog, forensic dump, and one retry in the repo-cli `StepExec`/`Quality/Tasks`/`CiLane` paths. Its non-goals include **no hosted observability, OTel, LGTM export, or dashboards** (`SPEC.md:18-31`). |
| `explorations/ci-hang-observability` | `graduated` → ci-step-watchdog | The only re-entry point is hosted observability (CW agent / OTel), gated on in-job forensics proving insufficient after a captured recurrence (`README.md:18-23`). |
| `explorations/context-rent-telemetry` | `parked` at capture | Measures which always-loaded guidance lines change agent behavior. It resumes when `goals/harness-evidence-ledger` ships `prune-proposals` (`README.md:18-22`). |

Beep attribute contract v1 (`goals/harness-otel-adoption/research/p0-attribute-contract.md:9-26`):
`beep.repo`, `beep.branch`, `beep.task_class` (`feat|fix|goals|chore|explore|other`),
`beep.goal_slug`, and `beep.schema_version = 1`. Harness identity uses `service.name`. Claude Code gets
these as resource attributes, injected by a launcher wrapper through `OTEL_RESOURCE_ATTRIBUTES` (`:42-47`).
**These keys exist in no tracked TS file** (`git grep` finds no `"beep.task_class"` etc. outside the packet).
The contract lives only in the operator-owned launcher.

Recorded Codex gap (`p0-attribute-contract.md:49-62`): Codex `span_attributes` covers traces only, and its
metrics carry no custom attribution. The setting is also static user TOML, so nothing is per-session. The v1
acceptance is that Codex metrics carry `service.name` + `environment` only, Codex traces carry static machine
attributes, and repo attribution comes from the transcript pipeline (`session_meta.cwd`). The follow-up is an
upstream passthrough request or collector-side enrichment.

Dual-ingestion precedence (`:64-79`): live dashboards use **native OTel only**, while scorecards, DuckDB, and
archives use the **transcript pipeline only**. Palantiri's live views should follow the same split.

Adjacent reusable vocabulary in ai-metrics:
- `AiMetricsOtlpAttributeKey` allowlist of `ai_metrics.*`, `session.id`, `tool.name`,
  `openinference.span.kind` (`packages/tooling/library/ai-metrics/src/otlp.ts:56-108`).
- telemetry-v2 `EvidenceTier` observed/derived/reconstructed/heuristic/unknown (`telemetry-v2.ts:214`).
- `OipTaint` clear/tainted/unknown (`telemetry-v2.ts:343`).
- Lifecycle/phase/wait vocabularies (`telemetry-v2.ts:30-191`).

---

## 6. Architecture placement inputs

Rules that bear on placement:
- Routing order: product semantics → slice/shared; external SDK/service wrappers → `drivers`;
  repo ops/automation → `tooling`; UI → `foundation/ui-system`; only the remainder → `foundation/capability`
  (`standards/architecture/07-non-slice-families.md:32-53`). `capability` needs a negative gate and **≥2 named
  consumers listed in its README** (`:47-60`).
- Paths are `packages/foundation/<kind>/<name>`, `packages/drivers/<name>` (flat),
  `packages/tooling/<kind>/<name>` with kinds library/tool/policy-pack/test-kit, and
  `packages/ecosystem/<name>` (`07:91-117,238-257`). Tooling may compose a driver directly when it acts as an
  operational adapter, but this is "not permission to route reusable runtime substrate through `tooling`"
  (`07:251-257`).
- Repo CLI commands go in `packages/tooling/tool/cli/src/commands/<Group>/` with
  `<Group>.command|schemas|errors|service.ts` + `index.ts`, plus earned roles such as `.render.ts`
  (`07:331-362`).
- Layers: concept/package/slice/app scopes. App composition goes in `apps/<app>/src/runtime/Layer.ts`
  and may import only canonical subpaths (`/public`, `/server`, `/secrets`, `/layer`, `/test`)
  (`standards/architecture/05-layer-composition.md:154-195`).
- Labs: `apps/labs/*` follow full code law minus package ceremony. A lab must never publish a
  reusable `@beep/*` API or be imported by packages (`standards/architecture/15-lab-apps.md:12-33,129-148`).
  Promotion is a reviewed runbook (`:87-107`).
- Observability doctrine: slice boundary = span boundary. Span names are `<slice>.<concept>.<action>` with a
  snake_case action. Protocol spans are `http.POST /...`. Adapter spans are `db.query`/`http.request`. Domain
  attributes are `<slice>.<concept>.<field>` and technical attributes follow OTel semconv
  (`standards/architecture/12-observability.md:15-56`). Tracing, logging, and console stay separate (`:58-66`).

What this implies for Palantiri:
- **Schema and SDK kernel** (signal schemas, tier/allowlist, span/metric name catalog, a fixed
  exporter/tracer composition): this is domain-agnostic runtime substrate, so it extends
  `packages/foundation/capability/observability`. It already passes the ≥2-consumer gate.
  Developer-AI semantics stay in `@beep/repo-ai-metrics`, per the ai-metrics-stack boundary.
- **Server wiring** (collector, backend clients such as Prometheus/Loki/Tempo/Phoenix query adapters): the
  external engines go in `packages/drivers/<name>`. Repo-operational query and aggregation
  logic goes in `packages/tooling/library/<name>`.
- **MCP server**: follow the `packages/drivers/*-mcp` precedent (thin stdio host over `@beep/mcp-kit`,
  `bin.ts` + `Server.ts` + Tools/Handlers). If it is repo-operational rather than a wrapper
  around an external engine, use a `packages/tooling/tool/<name>` package. An `apps/labs/*` lab is an option
  only while it publishes no reusable API.
- **CLI**: `beep <group>` in `packages/tooling/tool/cli/src/commands/<Group>/`.

Doctrine vs code drift. The census covered 3,997 `Effect.fn`/`withSpan` string names in `packages/**/src` +
`apps/**/src`: 3,838 are PascalCase `Concept.action`, and only 59 match lowercase `<a>.<b>.<c>`
(for example `lejeune.projection.verify_durable`). Concrete examples:
1. `Effect.fn("PracticeKgHost.loadBundle")`: `apps/practice-kg-mcp/src/runtime/Host.ts:59`.
   Doctrine would be `law_practice.practice_kg.load_bundle` or similar.
2. `Effect.withSpan("AccountsUsage.pollAll")`: `packages/tooling/tool/cli/src/commands/Accounts/AccountsUsage.service.ts:630`,
   with a camelCase action.
3. `Effect.fn("dispatchWithTierGate")`: `packages/foundation/capability/mcp-kit/src/TierGate.ts:602`. There is
   no namespace, and it names the implementation function, which `12:200` calls an anti-pattern.
4. `Effect.withSpan("observability.phase", { attributes: { phase } })`:
   `packages/foundation/capability/observability/src/PhaseProfiler.ts:319,325`. The attribute key `phase` is
   unnamespaced, against `12:49`.
5. Package README consumer list stale (§2), which violates `07:55-60`.
**CONFIRMED**: span naming doctrine is effectively unadopted. A Palantiri name catalog either ratifies
`Concept.action` or schedules a codemod. Do not leave it implicit.

---

## 7. Reusable MCP and CLI patterns

- `@beep/mcp-kit` (`packages/foundation/capability/mcp-kit/src/`) is a "reusable MCP host-construction kit".
  It provides credential-keyed `ToolkitComposition`, an `ApiKeyRequired` envelope, `TierGate` dispatch and audit
  records (`TierGate.ts:160,376,602`), `FieldTier` progressive projection, `SanitizedSpan`, and the
  2026-07-28 stateless client (`client.ts`, `client.node.ts`, `McpCaller.ts`). This is the
  "mcp-stateless kit" lineage.
  - `SanitizedSpan.ts:1-20,188,604`: wraps the ambient tracer so upstream `Toolkit` cannot attach raw
    `parameters` to spans. It is used by gov-legal, m365, m365-outbox, nlp, and practice-kg. This is the existing
    privacy primitive for telemetry, and a privileged tier should build on it.
- MCP hosts: `packages/drivers/{gov-legal-mcp,m365-mcp,nlp-mcp,uspto-mcp}` and the practice-kg toolkit in
  `packages/law-practice/server/src/Tools.ts`. Canonical bin: `Layer.launch(makeServerLayer(cfg).pipe(Layer.provide(NodeStdio.layer)))`
  + `Effect.provideService(Logger.LogToStderr, true)` (`packages/drivers/gov-legal-mcp/src/bin.ts:47-52`).
- Packaging: the practice-kg MCPB pipeline (`apps/practice-kg-mcp/src/package.ts`) and the compiled smoke
  and handshake harness (`src/smoke.ts:225-457`) can be reused for any Windows-delivered binary.
- CLI: root registration in `packages/tooling/tool/cli/src/commands/Root.ts`. Groups such as `Session`
  (`SessionLedger.service.ts`) and `Models` (manifest, check, and render roles) are good shapes to copy.
  There are 34 `Flag.Boolean("json")` sites in `packages/tooling/tool/cli/src`. Typed JSON IO goes through
  `JsonStringCodec(schema)` (`packages/tooling/tool/cli/src/internal/schema/JsonCodec.ts:75`), used e.g. by
  `AccountsStatusReportJson` (`Accounts.schemas.ts:584`). "One document on the console" for `--json`
  (`Accounts.command.ts:68`). Workstation state comes from `resolveWorkstationStateDir`
  (`internal/state/WorkstationState.ts`), with an env override per store.

---

## 8. Docker LGTM stack, effect version, update policy

- `docker-compose.yml:33-45` runs `grafana/otel-lgtm:0.35.0` with 127.0.0.1-bound ports 4000 (Grafana), 4318
  (OTLP HTTP), and 13133 (health). It mounts `docker/grafana/otelcol-config.yaml` (OTLP 4317/4318 receivers →
  Prometheus OTLP / Tempo / Loki / Pyroscope exporters), `datasources.yaml` (Prometheus default with
  exemplar → Tempo, Loki derived `trace_id` → Tempo), and one provisioned dashboard
  `chat-dashboard.json` ("Professional Desktop QA": lifecycle logs, trace search, turn metrics).
  Redis and pgvector share the file. The stack is local and single-tenant for professional-desktop QA.
  Nothing else in tracked TS references it.
- Installed `effect` is **4.0.2** (`node_modules/effect/package.json`; root catalog `package.json:166`;
  `config.effectSource` 4.0.2 @ `269a7c8643`, `package.json:313-316`), carrying a local patch to
  `dist/internal/equal.js` (`package.json:366`, `patches/effect@4.0.2.patch`). REF is 4.0.4.
- #9066 (4.0.4): "Complete HTTP server spans synchronously before the request fiber exits"
  (`REF/packages/effect/CHANGELOG.md:55`). **PARTLY** matters. It affects HTTP **server** spans at
  immediate shutdown, which today means only the professional-desktop sidecar (`HttpRouter.serve`, long-lived).
  The handoff says it "matters for CLIs and eval runners". That is overstated: one-shot CLIs and the RunPod
  eval do not serve HTTP. Their risk is exporter flush on exit, which depends on `shutdownTimeout`, and #9066
  does not change that. More relevant metric fixes are in **4.0.3**: histogram boundary and overflow retention
  in OTLP/Prometheus (#8986, `CHANGELOG.md:99`) and delta-histogram min/max (#8987, `:125`).
- Update policy: auto-memory records "effect updates = pkg.pr.new snapshot, never the rc". The
  2026-07 precedent is in `explorations/effect-mcp-2026-07-28/DECISIONS.md:17-19`. The current pin is a
  **stable npm release plus a patch**, not a snapshot. Whether moving 4.0.2 → 4.0.4 must go through a
  snapshot when a stable release exists is **UNCERTAIN**. Ask the operator or the Effect-bump owner, and
  carry the `equal.js` patch forward or drop it.

---

## Capability map

| Component | Existing brick | Disposition |
|---|---|---|
| OTLP traces/logs/metrics export | `effect/observability/Otlp*` (core) via `@beep/observability/server` `layerLocalLgtmServer` (`server/Layer.ts`) | **extend**: fix (a) ordering; fix (d) dual |
| DevTools mirroring | `server/DevTools.ts` `layerFilteredDevTools` | **extend**: port upstream end/event patches (b) |
| Log → span-event bridge | `Logger.tracerLogger` (core) | **extend**: re-add on purpose at `server/main.ts:132`, `Logging.ts:467` |
| Node SDK / Phoenix trace export | `server/NodeSdk.ts` `layerNodeSdkServerTraces` | reuse |
| Prometheus text, HttpApi telemetry, error reporting, trace context | `server/{Prometheus,HttpApiTelemetry,ErrorReporting,TraceContext}.ts` (0 consumers) | reuse (wire) or prune |
| Browser OTLP | `@beep/observability/web` (0 consumers) vs `agents-client/ClientObservability.ts` | **extend**: consolidate onto one |
| Workflow metrics / phase profiling | `Metric.ts` `observeWorkflow`/`trackDuration`, `PhaseProfiler.ts` | reuse (consider thinning onto v4 `Effect.track*`) |
| Cause redaction for logs/clients | `CauseRedaction.ts`, `CauseDiagnostics.ts` | reuse |
| Span-attribute sanitizing (privacy) | `@beep/mcp-kit` `SanitizedSpan.ts` / `sanitizedToolkit` | reuse; **extend** into a general tier filter |
| Tier vocab | mcp-kit `FieldTier`/`TierGate`; ai-metrics `EvidenceTier`, `OipTaint` | reuse / **extend** (TelemetryTier is NET-NEW but should compose these) |
| Attribute allowlist | ai-metrics `AiMetricsOtlpAttributeKey` (`otlp.ts:56`) | reuse pattern |
| `beep.*` attribute contract v1 | prose only (`goals/harness-otel-adoption/research/p0-attribute-contract.md`) | **NET-NEW** schema (LiteralKit/S.Class) in code |
| Span/metric name catalog | none; doctrine `12-observability.md` unadopted | **NET-NEW** (ratify or codemod) |
| practice-kg-mcp telemetry | named `Effect.fn` spans already present; no layer, no `LogToStderr` | **extend**: add stderr pinning + tiered exporter |
| MCP host scaffolding | `@beep/mcp-kit`, `packages/drivers/*-mcp` | reuse |
| Palantiri MCP server | none | **NET-NEW** (drivers/*-mcp or tooling/tool shape) |
| Palantiri CLI | `beep` command-group topology, `JsonStringCodec`, `--json` convention | reuse pattern; group **NET-NEW** |
| Account quota gauge | `AccountsUsage` service + `UsageWindow` schema | reuse model; emitter + scheduler **NET-NEW** |
| Developer-AI analytics, transcripts, scorecards | `@beep/repo-ai-metrics` (ai-metrics-stack) | reuse; do not absorb |
| Cache outcome telemetry | turborepo-cache-trust-observability | reuse; do not absorb |
| CI hang forensics | ci-step-watchdog (paused) | do not absorb (non-goal: OTel) |
| Local backend | `docker-compose.yml` `grafana/otel-lgtm:0.35.0` + `docker/grafana/*` | reuse for local; fleet hub NET-NEW |
| Fleet backend | dankserver collector + Phoenix + Prometheus/Grafana (Ansible, dankserver repo) | reuse (operator-owned) |
| Effect runtime | `effect` 4.0.2 + equal.js patch | **extend**: bump to ≥4.0.3/4.0.4 per policy |
