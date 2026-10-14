# Strict-tier (shape-only) exporter: seam, schema, leak paths, proof

Date: 2026-10-14. Design-grade research note for decisions D2 (shape-only tier, enforced by a
per-tier Effect Schema allowlist at the exporter boundary, decode-or-drop) and D3 (tier authority =
Tailscale node identity + ACL tag, fail closed). No repo code changes.

Conventions:
- `REF` = `~/YeeBois/references/effect/effect/packages/effect/src` (v4 reference, 4.0.4).
- `DIST` = `node_modules/effect/dist` (installed **4.0.2**). Every seam below was checked in both.
- `OBS` = `packages/foundation/capability/observability` (`@beep/observability`).
- Builds on `research/handoff/privacy_tiered_telemetry.md`, `effect_v4_observability_surface.md` and
  `phase2-deepened.md` (cluster 1 and cluster 3).

Tier vocabulary: `shape-only | standard | dev-verbose`. `shape-only` replaces the earlier
`privileged` label so that tier names describe the data, not the person. **Open: confirm the rename.**

## Q1. Interception seam per signal

### Takeaway
Use a custom **`OtlpSerialization` layer** as the primary gate. It is a public `Context.Service`
with one synchronous function per signal. It receives the complete in-memory OTLP payload (resource,
scope, every span with its events, links and status, every log record, every metric data point) just
before it becomes bytes. A second, thinner **egress `HttpClient`** provided only to the exporter
layers handles transport: it fails closed on any body it did not expect, spools, and runs the final
byte-level canary scan. Wrapping `Tracer`/`Logger`/metrics is rejected because it misses the ambient
channels that the exporter itself adds.

### Evidence: what the native exporter does
- `OtlpSerialization` is the service
  `{ traces: (TraceData) => HttpBody; metrics: (MetricsData) => HttpBody; logs: (LogsData) => HttpBody }`
  (REF `observability/OtlpSerialization.ts:27-31`; identical in DIST `OtlpSerialization.d.ts`).
  `layerJson` is `HttpBody.jsonUnsafe(data)` (`:40-44`) and `layerProtobuf` encodes protobuf (`:54-70`).
  The module is marked `@stability unstable` (`:8`), so the seam needs a golden test that pins it.
- All three signal exporters build the full envelope and then call the service:
  - Tracer: `resourceSpans[{ resource, scopeSpans[{ scope, spans }] }]` → `serialization.traces(data)`
    (REF `OtlpTracer.ts:81-92`; DIST `OtlpTracer.js:54-64`).
  - Logger: same shape → `serialization.logs(...)` (REF `OtlpLogger.ts:78-90`).
  - Metrics: `serialization.metrics(...)` (REF `OtlpMetrics.ts:364-372`).
- The generic exporter calls `options.body(items)` and posts the result through the `HttpClient`
  from context, with tracing disabled for that call (REF `OtlpExporter.ts:183-227`; DIST
  `OtlpExporter.js:151-152`). `body` is synchronous (`:176`), so the serialization gate must be
  synchronous too. That rules out Web Crypto there (see Q2 for HMAC).
- On any export failure the exporter clears the buffer, disables itself for 60 s, and
  `Effect.logDebug("Disabling exporter for 60 seconds", cause)` (`:229-234`). That debug log goes to
  every installed logger, so it is itself a record that must pass the gate.

### Candidate seams compared

| Seam | Catches | Misses / cost | Verdict |
|---|---|---|---|
| Wrap `Tracer.make` / `Logger.make` / `Metric` call sites | attributes we set | `exception.*` events built in `makeOtlpSpan` (REF `OtlpTracer.ts:296-335`), status message, resource, the `tracerLogger` event name, frequency `key` points | Reject |
| `@effect/opentelemetry` NodeSdk + custom `SpanProcessor` | spans in onEnd (read-only) | resource detectors, logs and metrics need separate processors; OTel JS has no shipped allowlist processor (Q7) | Reject for shape-only |
| **Custom `OtlpSerialization`** | everything in `TraceData`/`LogsData`/`MetricsData`: resource attrs, scope, span name, attrs, events, links, status, log body, metric points (and exemplars, if anything ever sets them) | sync only; typed input; also the place to rebuild the resource | **Primary** |
| Egress `HttpClient` (`HttpClient.mapRequestEffect` on a client provided only to the exporter) | the literal bytes | must re-parse JSON; protobuf is opaque | **Secondary**: content-type allowlist, spool, canary byte scan |

### Concrete wiring
Gotcha in our own wiring: `Otlp.layerJson`/`layerProtobuf` are
`flow(layer, Layer.provide(OtlpSerialization.layerJson|layerProtobuf))` (REF `Otlp.ts:133-177`), so
they **close over** the serializer and cannot be overridden from outside. `@beep/observability`
calls `Otlp.layerProtobuf` (OBS `src/server/Layer.ts:67`). The gated build must call **`Otlp.layer`**
(REF `Otlp.ts:37-94`), which leaves `OtlpSerialization | HttpClient` open, and provide both. The
NodeSdk path (OBS `src/server/NodeSdk.ts`) bypasses `OtlpSerialization` entirely, so it must be
unreachable in the shape-only build. Add a static check: no `@effect/opentelemetry` import in the
`.mcpb` bundle.

```ts
// sketch: @beep/observability/strict (current v4 module paths only)
import * as Layer from "effect/Layer"
import * as Otlp from "effect/observability/Otlp"
import { OtlpSerialization } from "effect/observability/OtlpSerialization"

export const layerTierGated = (opts: GatedOptions) =>
  Otlp.layer({ baseUrl: opts.baseUrl, metricsExportInterval: "5 minutes", tracerExportInterval: "5 minutes",
               loggerExportInterval: "5 minutes", loggerMergeWithExisting: false }).pipe(
    Layer.provide(Layer.effect(OtlpSerialization, TierGate.makeSerialization)), // sync decode-or-drop
    Layer.provide(EgressClient.layer)                                             // spool + byte scan + CT allowlist
  )
```

`TierGate.makeSerialization` resolves the tier, the HMAC key and the refusal ledger once at layer
build, then returns three pure functions `(data) => HttpBody.jsonUnsafe(project(tier, data))`. The
egress client rejects (does not send) any request whose body is not `application/json` produced by
the gate. A gate tag header that the egress strips before sending is enough to tell them apart.

### Pushback: shape-only should probably be metrics-only
Every field D2 allows (tool id, latency bucket, error `_tag`, version, counts, CPU/RSS) is
metric-shaped. Proposal: in `shape-only` the gate **derives** histograms from spans in-process (a
spanmetrics connector inside the gate: `mcp_tool_duration{tool_id,error_tag}` with fixed buckets)
and then **drops every span and log record**, counting them. Traces and logs return an empty body,
and the egress client never sends it. That removes span names, timestamps, ids, events and log
bodies from the attack surface. The span/log schemas below remain for `standard`.

## Q2. Schema shape

### Takeaway
Use one `TelemetryTier` LiteralKit, then per tier a closed projection schema over **OTLP JSON** (the
`TraceData`/`MetricsData`/`LogsData` interfaces, REF `OtlpTracer.ts:371-440`, `OtlpMetrics.ts:510-670`,
`OtlpLogger.ts:240-300`). Treat the gate as **construction, not filtering**: decode the allowed
fields, then build a fresh output record from the decoded values only, so nothing passes by default.

### Repo conventions to follow
- LiteralKit + `$I.annoteSchema`: OBS `src/CauseRedaction.ts:133-137` (`RedactionChannel`),
  OBS `src/server/NodeSdk.ts:71` (`NodeSdkMetricTemporality`).
- `S.Class<X>($I\`X\`)(fields, $I.annote(...))`: `packages/foundation/ui-system/dock/src/Dock.protocol.ts:38-45`.
- Identity: `$ObservabilityId.create("...")` from `@beep/identity/packages` (OBS `src/server/NodeSdk.ts:1,30`).

### Sketch
```ts
import { $ObservabilityId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema"
import * as S from "effect/Schema"
const $I = $ObservabilityId.create("strict/TierSchema")

export const TelemetryTier = LiteralKit(["shape-only", "standard", "dev-verbose"]).pipe(
  $I.annoteSchema("TelemetryTier", { description: "Capture-time telemetry tier; shape-only is the fail-closed default." }))

export const ToolId = LiteralKit(["kg.search", "kg.matter_lookup", /* …generated from the toolkit */])
export const ErrorTag = LiteralKit(["PracticeKgStoreMissing", "SchemaError", "Timeout", "Defect", "Other"])
export const LatencyBucketMs = LiteralKit(["le_10", "le_50", "le_250", "le_1000", "le_5000", "gt_5000"])
export const MetricName = LiteralKit(["mcp_tool_calls_total", "mcp_tool_duration", "process_cpu_pct",
                                      "process_rss_mib", "telemetry_refused_total"])

// OTLP KeyValue as a closed union keyed by the literal key: an unknown key fails decoding.
const Attr = <K extends string, V extends S.Top>(key: K, value: V) =>
  S.Struct({ key: S.Literal(key), value: S.Struct({ stringValue: value }) })
export const ShapeOnlyPointAttr = S.Union([
  Attr("tool_id", ToolId), Attr("error_tag", ErrorTag), Attr("latency_bucket", LatencyBucketMs),
])

// The resource is rebuilt by the gate from constants. The input resource is never decoded or forwarded.
export class ShapeOnlyResource extends S.Class<ShapeOnlyResource>($I`ShapeOnlyResource`)({
  serviceName: S.Literal("practice-kg-mcp"), serviceVersion: AppVersion, // build-stamped literal
  tier: S.Literal("shape-only"), hostKey: HmacId, keyEpoch: KeyEpoch,
}) {}
```
Notes:
- `onExcessProperty` defaults to `"ignore"`, which **strips** unknown object keys (REF
  `SchemaAST.ts:490,539`). That is safe for object fields but not for OTLP attributes, which are
  arrays of `{key, value}`. The key is a value there, hence the literal-keyed union above.
- Re-encode the output through the schema too (`S.encodeSync`, REF `Schema.ts:2306`) so the bytes on
  the wire are the schema's encoded form, not the input object.

### Drop + count
- Granularity: per data point, span or log record, never per batch. A shared part that fails (the
  scope) drops the batch.
- Decode with `S.decodeUnknownExit`/`decodeUnknownResult` (REF `Schema.ts:1592,1724`). Map the
  failing `SchemaIssue` to a **values-free** tag: `_tag ∈ {UnexpectedKey, MissingKey, InvalidType,
  InvalidValue, AnyOf, OneOf, Filter, Forbidden, Composite, Encoding, Pointer}` (REF
  `SchemaIssue.ts:258-1028`), combined with the signal and the OTLP path class (`resource`, `scope`,
  `span.attr`, `span.event`, `log.body`, `metric.point`). Never record the issue's message, which can
  quote the input.
- Counter storage: the gate is synchronous, so it cannot run `Metric.update`. Keep a
  `MutableHashMap<RefusalKey, number>` in the gate. On the next `metrics(...)` call the gate
  **appends** `telemetry_refused_total{signal,path_class,schema_failure_tag}` points it built itself
  from that constant-shape map. That point is the operator's page: a refusal means a bug on our side
  and carries no content.

### HMAC correlation ids
- Synchronous in the gate: `new Bun.CryptoHasher("sha256", key).update(id).digest("hex")` works on
  bun 1.4.2 (probed 2026-10-14; the second constructor argument is the HMAC key). `node:crypto.createHmac`
  also works. `crypto.subtle.sign("HMAC", …)` is async, so it fits only the egress client.
- Express it as a decode-only transform: `S.String.pipe(S.decodeTo(HmacId, { decode:
  SchemaGetter.transform(hmac(key)), encode: SchemaGetter.forbidden(() => "one-way") }))` (REF
  `Schema.ts:5659-5680`, `SchemaGetter.ts:437,722`). The key is closed over at layer build and never
  enters a schema annotation.
- Key: 32 random bytes generated on first run and stored DPAPI-protected (Q5). Store a `keyEpoch`
  (sequence number, not key material) beside it. Rotate monthly, so cross-month linkage on the hub is
  impossible by design. Keep the full 256-bit output. Shape-only needs at most `hostKey` and a
  session HMAC. jsonrpc ids are never kept (Q3).

### Coarsening transforms
- Time: points are emitted only at a 5-minute export interval (`metricsExportInterval`; the default
  is 10 s, REF `OtlpMetrics.ts:392`). The gate also floors `timeUnixNano`/`startTimeUnixNano` to the
  window start: `S.String.pipe(S.decodeTo(WindowStartNanos, transform(floorTo5m)))`.
- Latency: raw duration → `LatencyBucketMs` literal. Never export a raw duration.
- Counts: cap or round small counts (e.g. report `<5` as `5` per window) to blunt activity-pattern
  inference. This is a Rule 1.6 side-channel point **[lawyer to confirm]**.
- Size: shape-only has no size attributes at all. `standard` uses log2 byte buckets.

## Q3. Leak paths and how the seam closes each

| Leak path | Evidence | Closed by |
|---|---|---|
| `tracerLogger`: the log **message becomes the span event name**, and `effect.cause` = `causePretty(cause)` | REF `internal/effect.ts:6912-6930`; default loggers `{defaultLogger, tracerLogger}` (`:6535`) | shape-only drops all spans. `standard`: event names from a LiteralKit, `effect.cause` not in the allowlist |
| Span `exception` events: `exception.message`, `exception.stacktrace` (stack paths include the Windows user profile dir) and `status.message = errors[0].message` | REF `OtlpTracer.ts:305-335`; stack capture via `addSpanStackTrace` (`internal/tracer.ts:10-28`) | the error tag is derived inside the gate from `exception.type`, mapped through `ErrorTag` (unknown → `Other`). Message, stack and status message are never projected |
| Log records: `exception.*`, `effect.log_span.<label>` (keys built from labels), annotations, **body = message** | REF `OtlpLogger.ts:207-230` | shape-only: dropped. `standard`: body must decode as a LiteralKit event id; annotations keyed by literal |
| Frequency metrics: every observed string becomes a `key` attribute **value** | REF `OtlpMetrics.ts:296-311` | `MetricName` literal plus per-metric attr union. A frequency metric is not in the allowlist |
| Exemplars | type-only in Effect (`OtlpMetrics.ts:609-662`); the native exporter never sets them | the output is constructed and has no exemplars field |
| Resource: `OTEL_RESOURCE_ATTRIBUTES` / `OTEL_SERVICE_NAME` env merged into the resource | REF `OtlpResource.ts:86-120` | resource rebuilt from constants. Input resource ignored |
| `host.name`, `process.command_args`, `os.*` resource detectors | only the OTel JS NodeSdk path. The native resource is `telemetry.sdk.*` + `service.*` (REF `OtlpResource.ts:47-58`) | NodeSdk is banned from the bundle (static check) and the resource is rebuilt anyway |
| `mcp.resource.uri`, `jsonrpc.request.id`, tool arguments | Effect's MCP server names spans `McpServer.<method>` with `rpc.method` (REF `rpc/internal/tracing.ts:7-21`, `ai/McpServer.ts:1414`); our handlers may annotate more | no such key exists in any shape-only union. `tool_id` comes from the toolkit-generated LiteralKit, never from request text |
| Span names built from input (`Effect.fn(\`…${x}\`)`, `withSpan(name)`) | span name is a free string (REF `OtlpTracer.ts:356`) | shape-only: no spans. `standard`: `SpanName` LiteralKit generated from source (`graft grep 'Effect.fn("'`), and a lint bans template literals in span names |
| `_tag` error **messages** (TaggedError fields that hold paths or matter names) | `prettyErrors` uses `message` | only the class name is kept, through the `ErrorTag` literal |
| Exporter's own `logDebug(... cause)` with endpoint and HTTP error | REF `OtlpExporter.ts:233` | it is a log record, so the same gate drops it |
| **stderr**: Claude Desktop persists MCP server stderr to its local MCP log files (`%APPDATA%\Claude\logs\mcp*.log`, per Claude Desktop docs; verify on the attorney PC) and users attach those logs to bug reports | stdout is the protocol, so loggers write stderr (`Logger.LogToStderr`, REF `Logger.ts:191`) | out of exporter scope but the same doctrine: in shape-only, `Logger.layer([ShapeStderrLogger])` **replaces** the default set (replacement semantics, see surface note Q3). It prints `level · ErrorTag · tool_id · bucket` encoded through the same schema. OBS `CauseRedaction` stays for dev tiers |
| Third-party metrics in the global registry (`child_fibers_*`, deps) | REF `Metric.ts:3245-3250` | dropped unless the name is in `MetricName` (counted) |

Residual risk that the seam cannot close: meaning-level leaks via allowed fields (a tool id
distribution that fingerprints matter activity). This is mitigated only by coarsening and count
floors. **[lawyer to confirm]** that per-window tool counts are acceptable.

## Q4. Process CPU/RSS on bun/Windows

- APIs (probed on bun 1.4.2, Linux): `process.cpuUsage()` (µs user/system), `process.memoryUsage()`
  / `process.memoryUsage.rss()`, `process.resourceUsage()` (`userCPUTime`, `systemCPUTime`,
  `maxRSS`, page faults, fs counters), plus `require("bun:jsc").memoryUsage()` for heap detail. On
  Windows these go through libuv (`uv_getrusage`/`uv_resident_set_memory`). Expect user/system time,
  RSS and peak RSS; several POSIX fields read 0. **Verify on the attorney PC** with a one-shot
  `--self-check` print. Do **not** export `fsRead`/`fsWrite` or page-fault counts: IO volume aligned
  to tool calls hints at document sizes (prior note Q6).
- Design (a `ProcessShape` service, `Effect.fn`, `Schedule.spaced("10 seconds")`):
  1. Sample every 10 s: CPU% = Δ(user+system) / (Δwall × `os.availableParallelism()`), RSS MiB.
  2. Feed `Metric.summary("process_cpu_pct", { maxAge: "5 minutes", maxSize: 30, quantiles: [0.5, 0.95] })`
     (REF `Metric.ts:2441-2452`) and gauges for min/max that reset each window.
  3. The metric export interval is the same 5 minutes, so one point set per window leaves the PC.
  4. The gate coarsens values: CPU% to 5-point steps, RSS to 32 MiB steps (or log2 above 512 MiB).
     Quantile labels come from a literal union `{0.5, 0.95}`, never free.
  5. Sampling is never triggered by tool calls (no per-call alignment).

## Q5. Local spool and tier/endpoint authority

### Spool
- Placement: **after** the gate, in the egress client, so the spool only ever holds tier-compliant
  JSON (prior note Q5: apply the filter before any spool).
- Path: `%LOCALAPPDATA%\beep\practice-kg\telemetry\spool\` with segment files
  `<windowStart>-<seq>.otlp.enc` capped at 256 KiB each. Total cap 8 MiB or 7 days, drop oldest
  first, and count drops into `telemetry_refused_total{schema_failure_tag="spool-evicted"}`.
- Encryption: bun has **no native DPAPI**. Options, in order:
  1. AES-256-GCM via Web Crypto (`crypto.subtle`, async is fine in the egress client), with the data
     key wrapped by **DPAPI `CryptProtectData`** called through `bun:ffi` on `crypt32.dll` (user
     scope). The HMAC key gets the same wrap. bun:ffi works in `bun build --compile` binaries but is
     marked experimental. Needs a Windows smoke test in `apps/practice-kg-mcp/src/smoke.ts`.
  2. Fallback: shell out once at startup to PowerShell
     `[Security.Cryptography.ProtectedData]::Unprotect(...)` to unwrap the key. Slower, but has no
     FFI risk.
  3. Rejected: plain file ACLs only (no protection against backup copies).
  Given the spool is already shape-only, encryption is defence in depth (backups, roaming profiles),
  not the primary control.
- Replay: on startup and each window, send segments oldest-first. Delete a segment only after a 2xx.
  Each segment carries the tier it was captured under (resource `tier`). The egress client refuses
  to replay a segment whose capture tier is less strict than the current resolved tier (a tier
  downgrade never re-exposes data).

### Authority (D3)
- Client side (Windows): `tailscale status --json` → `Self.Tags`, or LocalAPI over the named pipe
  `\\.\pipe\ProtectedPrefix\Administrators\Tailscale\tailscaled`. Probed locally on tailscale 1.104.1:
  `Self.Tags` is **omitted when the node is untagged** (key absent, not `[]`).
- Fail-closed formulation: tag the **loosening** tiers, not the strict host. `shape-only` is the
  default whenever the tag list is absent, the CLI is missing, the backend is not `Running`, or
  parsing fails. Only a positive `tag:telemetry-standard` or `tag:telemetry-dev` loosens. An
  untagged or unresolvable node is therefore always shape-only.
- The client's tier is only a **ceiling the PC applies to itself**. The hub gateway re-derives the
  tier from `tailscale whois <peer-ip>` (or Tailscale app-capability grants in `CapMap`, an
  alternative worth testing) and refuses batches that do not decode under that tier's schema.
- Offline: no export. The gate still runs and the spool fills under shape-only. Tier is re-resolved
  each window. Endpoint authority: the egress client only posts to a `100.64.0.0/10` / `*.ts.net`
  URL from the signed bundle config. Any other host is refused and counted.

## Q6. Proof-of-absence harness

Repo test idioms: `it` from `@beep/test-runner`, `describe/expect` from `@effect/vitest`, `it.prop`
with `fcRuns` (OBS `test/HttpApiTelemetry.test.ts:10-13`, `test/CauseRedaction.test.ts:185`), and
`it.layer(Layer.fresh(services))` for host tests (`apps/practice-kg-mcp/test/Host.test.ts:99-101`).

1. **Capture harness.** A test `HttpClient` layer that records the request bodies the egress client
   would send (no network), plus `Flusher.flush` (REF `OtlpExporter.ts:79-107`) to force export at
   the end of each test.
2. **Canary run.** A smoke fixture bundle (`makePracticeKgSmokeBundle`, `src/smoke.ts:183`) seeded
   with `CanaryToken` values (high-entropy core, e.g. `cnry-7f3a…`) in matter names, file names,
   query text, and error messages via a forced-failure handler. Run **every** tool handler, including
   failing paths. Assert that no canary form appears in any captured byte: raw, lowercased,
   URL-encoded, base64, JSON-escaped, 8-char prefixes, unsalted SHA-256.
3. **Golden allowlist snapshot.** Assert that the set of `(signal, metricName, attrKey)` triples in
   captured payloads equals `test/golden/shape-only.keys.json`, and that the set of
   `schema_failure_tag`s equals its golden. Any over-collection or new refusal fails review.
4. **Mutation testing of the allowlist.** `it.prop`: generate OTLP payloads from the *standard* or
   *dev-verbose* schema arbitraries (`effect/Arbitrary`, already used in OBS tests), feed them to the
   shape-only gate, and assert the output decodes under `ShapeOnly*` and contains no field outside
   the golden. Then enumerate gate mutants (remove the resource rebuild, swap the `ErrorTag`
   mapping for a passthrough, re-enable spans). Each mutant must turn either the canary test or
   the golden test red. A mutant that stays green means the harness has a blind spot.
5. **Negative ledger.** The refusal map is exported as a values-free JSON
   (`{signal, path_class, schema_failure_tag, count}`). The test asserts the balance
   `records_in = projected + dropped`. The attorney-facing `practice-kg-mcp telemetry --show` prints
   the pending spool plus this ledger.
6. **Seam pin.** A test that imports `OtlpSerialization` and asserts that `Otlp.layer` requires it
   (type-level `Layer.Layer<never, never, HttpClient | OtlpSerialization>`). An Effect bump that
   moves the seam fails CI instead of silently bypassing the gate.

```ts
it.effect("shape-only exports no canary and only golden keys", () =>
  Effect.gen(function* () {
    yield* runAllToolHandlers(canaryBundle)           // includes forced-failure paths
    yield* (yield* Flusher).flush                     // Flusher service, REF OtlpExporter.ts:79-107
    const bodies = yield* CapturedEgress.bodies
    expect(CanaryForms.findIn(bodies)).toEqual([])
    expect(KeyTriples.of(bodies)).toEqual(goldenShapeOnly)
  }).pipe(Effect.provide(TestStrictStack)))
```

## Q7. Prior art

- **No JS/TS package ships schema-driven OTLP allowlisting.** The closest is `autotel`'s
  `FilteringSpanProcessor`, a per-span predicate that drops whole spans and does not rewrite
  attributes ([unpkg types](https://app.unpkg.com/autotel@3.6.0/files/dist/filtering-span-processor.d.ts)).
  OTel JS `onEnd` receives a read-only `ReadableSpan`, so attribute rewriting means wrapping the
  exporter ([OneUptime guide](https://oneuptime.com/blog/post/2026-01-30-opentelemetry-span-processors/markdown)),
  which is what our `OtlpSerialization` gate does natively.
- **OTel Metrics SDK Views** `attribute_keys` is a normative allowlist ("all other attributes MUST
  be ignored"). It covers metrics only (prior note Q1).
- **Weaver live-check** validates OTLP against a semconv registry plus custom Rego policies, per
  attribute and signal, and exits 1 on violations ([OTel blog](https://opentelemetry.io/blog/2025/otel-weaver/),
  [Dynatrace community](https://community.dynatrace.com/t5/OTel/OTel-Weaver-a-high-level-overview-of-OTel-s-schema-and-policy/td-p/303520)).
  Use: generate a Weaver registry from the tier schemas and run live-check in CI against the
  captured payloads, as an independent second opinion on Q6.3.
- **Collector `redaction` processor** (`allowed_keys`, `hmac-sha256`, `summary: info` emitting
  `redaction.*.count`; beta for traces, alpha for logs and metrics) is the hub-side second fence.
  Generate its `allowed_keys` from the same LiteralKits (a `beep` codegen command writes the YAML).
  CI diffs the YAML against the schema, so the fences cannot drift (prior note Q1:52).

## Decisions this note proposes (for DECISIONS.md)
1. Primary seam = custom `OtlpSerialization`. Use `Otlp.layer`, never `Otlp.layerJson/Protobuf` or
   NodeSdk, in the shape-only build.
2. Shape-only = metrics-only via in-gate span→histogram derivation. Spans and logs are dropped and
   counted.
3. The resource is rebuilt from constants. The gate constructs output records; it does not filter
   input ones.
4. Loosening tiers are tagged. Untagged or unresolvable → shape-only.
5. The spool sits after the gate: AES-GCM with the key wrapped by DPAPI via bun:ffi (PowerShell
   fallback).
6. Refusals are counted in the gate and injected as `telemetry_refused_total` into the next metrics
   payload.

Open: tier rename (`privileged` → `shape-only`); count floor value **[lawyer to confirm]**; bun:ffi
DPAPI smoke on the attorney PC; whether hub authority uses tags or app-capability grants.
