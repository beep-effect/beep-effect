import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $PracticeKgMcpId } from "@beep/identity/packages";
import {
  PracticeKgBundle,
  PracticeKgBundleManifest,
  PracticeKgCounts,
  PracticeKgFailureReasonKey,
  PracticeKgSchemaVersions,
  PracticeKgSourceRuns,
  PracticeKgToolFailureReason,
  PracticeKgToolkit,
} from "@beep/law-practice-server";
import {
  loadPracticeKgBundleContext,
  PracticeKgHostError,
  PracticeKgSelfCheckRefusal,
  PracticeKgSelfCheckReport,
} from "@beep/law-practice-server/PracticeKgHost";
import { connectStdio, withStdioServer } from "@beep/mcp-kit/test/Conformance";
import {
  GateRule,
  layerDevMemoryStrictSpoolKey,
  layerInMemoryEgressSink,
  layerStrictSpool,
  layerStrictSpoolSink,
  StrictEgressSink,
  StrictGateConfig,
  StrictGateRulesOn,
  StrictSpool,
  StrictSpoolOptions,
} from "@beep/observability/strict";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import * as Tracer from "effect/Tracer";
import * as TestConsole from "effect/testing/TestConsole";
import { SelfCheckFailure } from "../src/PracticeKgMcp.errors.ts";
import { makePracticeKgHostServerLayer } from "../src/runtime/Host.ts";
import { processCpuGauge, processRssGauge } from "../src/runtime/ProcessMetrics.ts";
import { printPracticeKgSelfCheck, runPracticeKgMcpSelfCheck } from "../src/runtime/SelfCheck.ts";
import {
  layerInMemoryStrictSalt,
  layerPracticeKgTelemetryFor,
  PracticeKgStrictGateConfig,
  shapeOnlyLogLine,
} from "../src/runtime/Telemetry.ts";
import { makePracticeKgSmokeBundle } from "../src/smoke.ts";
import {
  PracticeKgProcessRss,
  PracticeKgToolId,
  PracticeKgToolKey,
} from "../src/telemetry/PracticeKgTelemetry.instruments.ts";
import { PRACTICE_KG_EXTENSION_VERSION } from "../src/Version.ts";
import type { GateRules } from "@beep/observability/strict";

const TestServices = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);
const textDecoder = new TextDecoder();

// Tests run concurrently, so a per-test smoke build (PGlite plus DuckDB, the
// file's dominant CPU cost) multiplies across every test and each one's time
// limit measures the others' builds. One template is built per file, on first
// use, and every test copies it into its own directory; it is removed after
// the file, and never built when no test asks for it.
const makeSmokeTemplate = Effect.gen(function* () {
  const scope = yield* Effect.scope;
  return yield* Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-template-" });
    const bundle = yield* makePracticeKgSmokeBundle(root);
    return { root, bundle };
  }).pipe(Effect.provideService(Scope.Scope, scope), Effect.cached);
});
const $I = $PracticeKgMcpId.create("test/Host");
class SmokeTemplate extends Context.Service<SmokeTemplate, Effect.Success<typeof makeSmokeTemplate>>()(
  $I`SmokeTemplate`
) {}
const smokeTemplateLayer = Layer.effect(SmokeTemplate, makeSmokeTemplate);

// A private copy of the smoke bundle (and its corpus) under `root`; returns
// the bundle directory, as `makePracticeKgSmokeBundle(root)` would.
const copySmokeBundle = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const template = yield* yield* SmokeTemplate;
  yield* fs.copy(template.root, root, { overwrite: true });
  return path.join(root, path.relative(template.root, template.bundle));
});
const encodeManifest = S.encodeUnknownEffect(S.fromJsonString(PracticeKgBundleManifest));
const decodeReportLine = S.decodeUnknownEffect(S.fromJsonString(PracticeKgSelfCheckReport));
const decodeFailureLine = S.decodeUnknownEffect(S.fromJsonString(PracticeKgSelfCheckRefusal));
const isString = S.is(S.String);
// Tests in one `it.layer` block share a console and may overlap, so each
// printing effect runs against a console of its own.
const printed = <A, E, R>(self: Effect.Effect<A, E, R>) =>
  Effect.all({
    value: self,
    lines: TestConsole.logLines.pipe(Effect.map(A.filter(isString))),
  }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));

// Runs a failing self-check and returns the one refusal line it printed.
const refusalLine = Effect.fnUntraced(function* (bundleDir: string) {
  const { lines, value: error } = yield* runPracticeKgMcpSelfCheck(bundleDir).pipe(
    printPracticeKgSelfCheck,
    Effect.flip,
    printed
  );
  expect(error).toBeInstanceOf(SelfCheckFailure);
  expect(lines).toHaveLength(1);
  return yield* decodeFailureLine(lines[0] ?? "");
});

const expectUnopenable = (refusal: PracticeKgSelfCheckRefusal, store: string, bundleDir: string) => {
  expect(refusal.message).toContain(`${store} at "${bundleDir}" could not be opened`);
  expect(refusal.message).toContain("close Claude Desktop");
  expect(refusal.message).not.toContain("install");
  expect(refusal.cause ?? "").not.toBe("");
  expect(refusal.cause ?? "").not.toContain("\n");
  expect(refusal.cause ?? "").not.toMatch(/\bat .+:\d+:\d+/);
};

const runsAsRoot = process.getuid?.() === 0;

const manifest = PracticeKgBundleManifest.make({
  builtAt: "2026-08-13T00:00:00.000Z",
  bundleVersion: "2026.08.1",
  corpusRootExpected: true,
  corpusSnapshotAt: "2026-08-12T00:00:00.000Z",
  counts: PracticeKgCounts.make({
    documents: S.Natural.make(2),
    edges: S.Natural.make(3),
    emails: S.Natural.make(1),
    nodes: S.Natural.make(4),
  }),
  schemaVersion: PracticeKgSchemaVersions.make({ duckdb: "4", pglite: "4" }),
  sourceRuns: PracticeKgSourceRuns.make({
    base: "included",
    includedRuns: ["2026-10-working-files"],
    refresh202607: "excluded",
  }),
});

const encodeReportLine = S.encodeUnknownEffect(S.fromJsonString(PracticeKgSelfCheckReport));
const encodeRefusalLine = S.encodeUnknownEffect(S.fromJsonString(PracticeKgSelfCheckRefusal));
const encodeUnknownJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

it.layer(smokeTemplateLayer)("shared smoke bundle", (it) => {
  describe("@beep/practice-kg-mcp self-check", () => {
    it.layer(Layer.fresh(TestServices), { timeout: "2 minutes" })((it) => {
      it.effect(
        "prints one line naming the versions, both store counts and the toolkit size",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-self-check-" });
          const bundleDir = yield* copySmokeBundle(root);
          const context = yield* loadPracticeKgBundleContext(bundleDir);

          const { lines } = yield* runPracticeKgMcpSelfCheck(bundleDir).pipe(printPracticeKgSelfCheck, printed);

          expect(lines).toHaveLength(1);
          const line = lines[0] ?? "";
          expect(line).toMatch(
            /^\{"ok":true,"extensionVersion":"[^"]+","bundleVersion":"[^"]+","schemaVersion":\{"duckdb":"4","pglite":"4"\},"nodes":\d+,"matters":\d+,"tools":\d+\}$/
          );
          const report = yield* decodeReportLine(line);
          expect(report.extensionVersion).toBe(PRACTICE_KG_EXTENSION_VERSION);
          expect(report.bundleVersion).toBe(context.manifest.bundleVersion);
          expect(report.nodes).toBe(context.manifest.counts.nodes);
          expect(report.nodes).toBeGreaterThan(0);
          expect(report.matters).toBe(1);
          expect(report.tools).toBe(R.keys(PracticeKgToolkit.tools).length);
        })
      );

      it.effect(
        "refuses an old store format with one ok:false line and the typed host error",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-self-check-" });
          yield* fs.writeFileString(
            path.join(bundleDir, "bundle.manifest.json"),
            '{"builtAt":"2026-10-06T00:00:00.000Z","bundleVersion":"2026-10-06-01","corpusRootExpected":true,"corpusSnapshotAt":"2026-10-05T00:00:00.000Z","counts":{"documents":1,"edges":1,"emails":1,"nodes":1},"schemaVersion":{"duckdb":"2","pglite":"2"},"sourceRuns":{"base":"included","refresh202607":"excluded"}}'
          );

          const { lines, value: error } = yield* runPracticeKgMcpSelfCheck(bundleDir).pipe(
            printPracticeKgSelfCheck,
            Effect.flip,
            printed
          );

          expect(lines).toHaveLength(1);
          const failure = yield* decodeFailureLine(lines[0] ?? "");
          expect(error).toBeInstanceOf(SelfCheckFailure);
          expect(error[Runtime.errorReported]).toBe(false);
          expect(error.cause).toBeInstanceOf(PracticeKgHostError);
          expect(failure.ok).toBe(false);
          expect(failure.message).toBe(error.message);
          expect(failure.message).toContain("store format pglite 2 / duckdb 2");
          expect(yield* fs.exists(path.join(bundleDir, "kg.pglite"))).toBe(false);
        })
      );

      it.effect(
        "reports a bundle folder that lost a store instead of creating an empty one",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-self-check-" });
          yield* fs.writeFileString(path.join(bundleDir, "bundle.manifest.json"), yield* encodeManifest(manifest));

          const missing = yield* Effect.flip(runPracticeKgMcpSelfCheck(bundleDir));
          expect(missing.message).toBe(
            `Practice KG graph store (kg.pglite) at "${bundleDir}" is missing or not an initialised store; install the bundle that matches this server.`
          );
        })
      );

      it.effect(
        "reports a matter store that will not open as unopenable, never as a bundle to replace",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-self-check-" });
          const bundleDir = yield* copySmokeBundle(root);
          yield* fs.writeFileString(path.join(bundleDir, "practice.duckdb"), "not a database");

          const refusal = yield* refusalLine(bundleDir);

          expectUnopenable(refusal, "matter store (practice.duckdb)", bundleDir);
        })
      );

      it.effect(
        "names the graph store and carries the driver's words when kg.pglite is corrupt",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-self-check-" });
          const bundleDir = yield* copySmokeBundle(root);
          yield* fs.writeFile(
            path.join(bundleDir, "kg.pglite", "global", "pg_control"),
            new Uint8Array(8192).fill(0x5a)
          );

          const refusal = yield* refusalLine(bundleDir);

          expectUnopenable(refusal, "graph store (kg.pglite)", bundleDir);
          expect(refusal.cause).toContain("PgliteClient");
        })
      );

      it.effect.skipIf(runsAsRoot)(
        "reports an unreadable kg.pglite folder as a graph store that will not open (skipped as root: root reads it)",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-self-check-" });
          const bundleDir = yield* copySmokeBundle(root);
          const store = path.join(bundleDir, "kg.pglite");
          yield* Effect.acquireRelease(fs.chmod(store, 0o000), () => fs.chmod(store, 0o755).pipe(Effect.orDie));

          const refusal = yield* refusalLine(bundleDir);

          expectUnopenable(refusal, "graph store (kg.pglite)", bundleDir);
          expect(refusal.cause).toContain("PermissionDenied");
        })
      );

      it.effect(
        "refuses an empty kg.pglite folder and a zero-byte practice.duckdb before opening either",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-self-check-" });
          const bundleDir = yield* copySmokeBundle(root);
          const graphStore = path.join(bundleDir, "kg.pglite");
          const matterStore = path.join(bundleDir, "practice.duckdb");
          yield* fs.remove(graphStore, { recursive: true });
          yield* fs.makeDirectory(graphStore);

          const emptyGraph = yield* refusalLine(bundleDir);
          const graphEntries = yield* fs.readDirectory(graphStore);
          yield* fs.remove(graphStore, { recursive: true });
          yield* fs.writeFileString(graphStore, "not a store folder");
          const fileGraph = yield* refusalLine(bundleDir);
          yield* fs.remove(graphStore);
          yield* fs.makeDirectory(graphStore);
          yield* fs.writeFileString(path.join(graphStore, "PG_VERSION"), "17\n");
          yield* fs.writeFileString(matterStore, "");
          const zeroMatter = yield* refusalLine(bundleDir);
          const matterInfo = yield* fs.stat(matterStore);

          expect(emptyGraph.message).toBe(
            `Practice KG graph store (kg.pglite) at "${bundleDir}" is missing or not an initialised store; install the bundle that matches this server.`
          );
          expect(graphEntries).toEqual([]);
          expect(fileGraph.message).toBe(emptyGraph.message);
          expect(zeroMatter.message).toBe(
            `Practice KG matter store (practice.duckdb) at "${bundleDir}" is missing or not an initialised store; install the bundle that matches this server.`
          );
          expect(Number(matterInfo.size)).toBe(0);
        })
      );

      it.effect(
        "refuses a current-format manifest over matter tables built for the previous format",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-self-check-" });
          const bundleDir = yield* copySmokeBundle(root);
          // Store format 2 had no `matters.client_name`; the manifest still says format 3.
          const dropClientName = Effect.gen(function* () {
            const db = yield* DuckDb;
            yield* db.run("ALTER TABLE matters DROP COLUMN client_name");
          });
          yield* dropClientName.pipe(
            provideScopedLayer(
              DuckDb.makeNodeLayer(
                DuckDbConnectionOptions.make({ databasePath: path.join(bundleDir, "practice.duckdb") })
              )
            )
          );

          const { lines, value: error } = yield* runPracticeKgMcpSelfCheck(bundleDir).pipe(
            printPracticeKgSelfCheck,
            Effect.flip,
            printed
          );

          expect(lines).toHaveLength(1);
          const refusal = yield* decodeFailureLine(lines[0] ?? "");
          expect(error).toBeInstanceOf(SelfCheckFailure);
          expect(refusal.ok).toBe(false);
          expect(refusal.message).toBe(
            `Practice KG matter store (practice.duckdb) at "${bundleDir}" does not answer the queries this server's tools run; install the bundle that matches this server.`
          );
          expect(refusal.cause ?? "").toContain("client_name");
        })
      );
    });
  });

  for (const [kind, table] of [
    ["TABLE", "document_text"],
    ["VIEW", "fts_bm25"],
  ]) {
    describe(`practice KG startup without ${table}`, () => {
      const fixtureLayer = Layer.effect(
        PracticeKgBundle,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-startup-" });
          const bundleDir = yield* copySmokeBundle(root);
          yield* DuckDb.use((db) => db.run(`DROP ${kind} ${table}`)).pipe(
            provideScopedLayer(
              DuckDb.makeNodeLayer(
                DuckDbConnectionOptions.make({ databasePath: path.join(bundleDir, "practice.duckdb") })
              )
            )
          );
          return PracticeKgBundle.of(yield* loadPracticeKgBundleContext(bundleDir));
        })
      ).pipe(Layer.provide(TestServices));
      it.layer(Layer.mergeAll(TestServices, fixtureLayer), { timeout: "2 minutes" })((it) => {
        it.effect(
          "refuses self-check and startup with one message before speaking MCP",
          Effect.fnUntraced(function* () {
            const { bundleDir } = yield* PracticeKgBundle;
            const refusal = yield* refusalLine(bundleDir);
            expect(refusal.message).toContain("does not answer the queries this server's tools run");
            expect(refusal.cause).toContain(table);
            const child = Bun.spawn(["bun", "run", "src/bin.ts", "--bundle-dir", bundleDir], {
              stdin: "ignore",
              stdout: "pipe",
              stderr: "pipe",
            });
            const startup = yield* Effect.all({
              exitCode: Effect.promise(() => child.exited),
              stdout: Effect.promise(() => new Response(child.stdout).text()),
              stderr: Effect.promise(() => new Response(child.stderr).text()),
            });
            expect(startup.exitCode).not.toBe(0);
            expect(startup.stdout).toBe("");
            // Claude Desktop keeps stderr: the startup refusal is one shape-only
            // line, with no message, path or cause.
            expect(startup.stderr).toBe(`${shapeOnlyLogLine("Error", O.none())}\n`);
            expect(startup.stderr).not.toContain(bundleDir);
          })
        );
      });
    });
  }

  describe("practice KG self-check lines", () => {
    it.effect.prop(
      "round-trips every generated report through its one-line JSON form",
      [Arbitrary.schema(PracticeKgSelfCheckReport)],
      ([report]) =>
        Effect.gen(function* () {
          const line = yield* encodeReportLine(report);
          expect(line).not.toContain("\n");
          expect(yield* decodeReportLine(line)).toStrictEqual(PracticeKgSelfCheckReport.make(report));
        })
    );

    it.effect.prop(
      "round-trips every generated refusal, with or without a cause, through its one-line JSON form",
      [Arbitrary.schema(PracticeKgSelfCheckRefusal)],
      ([refusal]) =>
        Effect.gen(function* () {
          const line = yield* encodeRefusalLine(refusal);
          expect(line).not.toContain("\n");
          expect(yield* decodeFailureLine(line)).toStrictEqual(PracticeKgSelfCheckRefusal.make(refusal));
        })
    );
  });

  // Acceptance #1 of the strict tier: canary tokens that reach every practice
  // KG tool, through its successful and failing paths, never appear in any byte
  // the strict tier exports or writes to stderr, in any common encoding. The
  // host runs as `bin.ts` runs it (the production server layer over a stdio
  // transport, under the strict telemetry layer), with a test-visible egress
  // sink in place of the in-memory one. A match is only ever counted.

  // Assembled at runtime so no literal canary sits in source; each starts with
  // a different label, so the 8-character prefixes differ too.
  const canary = (label: string): string => A.join([label, "Qz", "Canary", "8301"], "");
  const canaries = {
    root: canary("Root"),
    query: canary("Query"),
    family: canary("Family"),
    docket: canary("Docket"),
    sender: canary("Sender"),
    reference: canary("Reference"),
    address: canary("Address"),
    digest: canary("Digest"),
    key: canary("Natural"),
    path: canary("Organized"),
    leak: canary("Leak"),
  };

  const sha256Hex = (value: string): string => new Bun.CryptoHasher("sha256").update(value).digest("hex");

  // Raw, lowercased, URL-encoded, base64, JSON-escaped, 8-character prefix and
  // unsalted SHA-256 forms of every canary.
  const canaryForms = Effect.forEach(R.values(canaries), (token) =>
    Effect.map(encodeUnknownJson(token), (json) => [
      token,
      Str.toLowerCase(token),
      encodeURIComponent(token),
      Base64.encode(token),
      Str.slice(1, -1)(json),
      Str.slice(0, 8)(token),
      sha256Hex(token),
    ])
  ).pipe(Effect.map(A.flatten));

  const countCanaries = (text: string, forms: ReadonlyArray<string>): number =>
    A.reduce(forms, 0, (count, form) => count + A.length(Str.split(text, form)) - 1);

  type ToolCall = readonly [string, Record<string, unknown>];

  const healthyCalls: ReadonlyArray<ToolCall> = [
    ["kg_clients", {}],
    ["kg_docket_family", { family: canaries.family }],
    ["kg_application_lookup", { docket: canaries.docket }],
    ["kg_find", { query: canaries.query }],
    ["kg_find", { query: "" }],
    ["corpus_search_text", { query: "smoke" }],
    ["corpus_search_text", { query: canaries.query, family: canaries.family, limit: -5 }],
    ["corpus_get_document", { organized_path: "dockets/20001/20001US01/fixture.txt" }],
    ["corpus_get_document", { digest: canaries.digest }],
    ["email_search", { query: canaries.query, sender: canaries.sender, family: canaries.family }],
    ["kg_candidate_claims", { docket: canaries.docket }],
    ["kg_matter_lookup", { reference: canaries.reference }],
    ["kg_correspondent_lookup", { address: canaries.address }],
    ["kg_correspondent_lookup", { address: `${canaries.address}@example.invalid` }],
    ["kg_provenance", {}],
    ["kg_provenance", { natural_key: canaries.key }],
    ["kg_provenance", { digest: canaries.digest }],
  ];

  // Run against a matter store that has none of the tables the tools read.
  const brokenStoreCalls: ReadonlyArray<ToolCall> = [
    ["corpus_search_text", { query: canaries.query }],
    ["corpus_get_document", { organized_path: canaries.path }],
    ["kg_provenance", { digest: canaries.digest }],
  ];

  const ExportedSpans = S.fromJsonString(
    S.Struct({
      resourceSpans: S.Array(
        S.Struct({
          scopeSpans: S.Array(
            S.Struct({
              spans: S.Array(
                S.Struct({
                  name: S.String,
                  attributes: S.Array(S.Struct({ key: S.String, value: S.Struct({ stringValue: S.String }) })),
                })
              ),
            })
          ),
        })
      ),
    })
  );
  const decodeExportedSpans = S.decodeUnknownEffect(ExportedSpans);

  // Test-only pre-gate leak path. Nothing in the production host puts a canary
  // into telemetry before the gate (handler errors use canned messages, SQL
  // spans carry no parameters, mcp-kit strips arguments), so with a content rule
  // off the canary test would still pass. This probe runs beside the server,
  // under the same telemetry layer, and writes the leak canary, or a linkage
  // needle, into every channel a gate rule guards: a span name, span
  // attributes, an event, a link, a status message, a log body, the resource
  // (through `OTEL_RESOURCE_ATTRIBUTES`, which the OTLP exporters read), a
  // metric name, a metric label and a raw metric value, under an external
  // parent with a known trace id and a clock with an unaligned start time.
  const leakTraceId = "6c65616b6c65616b6c65616b6c65616b";
  const leakParentSpanId = "6c65616b6c65616b";
  const leakLinkTraceId = "0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f";
  const leakLinkSpanId = "0f0f0f0f0f0f0f0f";
  const leakStartNanos = BigInt("1700000123456789000");
  const leakMetricValue = 73_519_024;

  class LeakProbeFailure extends S.TaggedError<LeakProbeFailure, { readonly brand: unique symbol }>()(
    "LeakProbeFailure",
    { message: S.String }
  ) {}

  const leakClock: Clock.Clock = {
    currentTimeMillisUnsafe: () => Number(leakStartNanos / BigInt(1_000_000)),
    currentTimeMillis: Effect.sync(() => Number(leakStartNanos / BigInt(1_000_000))),
    currentTimeNanosUnsafe: () => leakStartNanos,
    currentTimeNanos: Effect.succeed(leakStartNanos),
    monotonicTimeNanosUnsafe: () => leakStartNanos,
    monotonicTimeNanos: Effect.succeed(leakStartNanos),
    sleep: () => Effect.void,
  };

  const leakProbe = Effect.gen(function* () {
    const leak = canaries.leak;
    yield* Effect.void.pipe(Effect.withSpan(`leak.${leak}`));
    yield* Effect.gen(function* () {
      const span = yield* Effect.currentSpan;
      span.event(leak, leakStartNanos, { "leak.event": leak });
      yield* Effect.logError(leak);
      return yield* LeakProbeFailure.make({ message: leak });
    }).pipe(
      Effect.withSpan("PracticeKgTools.kg_find", {
        parent: Tracer.externalSpan({ traceId: leakTraceId, spanId: leakParentSpanId }),
        attributes: { [PracticeKgToolKey]: leak },
        links: [
          {
            span: Tracer.externalSpan({ traceId: leakLinkTraceId, spanId: leakLinkSpanId }),
            attributes: { "leak.link": leak },
          },
        ],
      }),
      Effect.provideService(Clock.Clock, leakClock),
      Effect.ignore
    );
    yield* Metric.update(Metric.counter(`leak.${leak}`), 1);
    yield* Metric.update(Metric.withAttributes(processCpuGauge, { "leak.label": leak }), 5);
    yield* Metric.update(processRssGauge, leakMetricValue);
  });

  const leakResource = ConfigProvider.layer(
    ConfigProvider.fromEnv({ env: { OTEL_RESOURCE_ATTRIBUTES: `host.name=${canaries.leak}` } })
  );

  // Acceptance #3 at the host: one needle per gate rule. With every rule on no
  // needle reaches an exported byte; with exactly one rule off, its needle does.
  // The mapped type makes a new rule without a needle a type error.
  const hostNeedles: { readonly [Rule in GateRule]: string } = {
    "span-name": canaries.leak,
    "span-attributes": canaries.leak,
    "span-events": canaries.leak,
    "span-links": canaries.leak,
    "span-status-message": canaries.leak,
    "span-ids": leakTraceId,
    "span-timestamps": `${leakStartNanos}`,
    resource: canaries.leak,
    logs: canaries.leak,
    "metric-names": canaries.leak,
    "metric-attributes": canaries.leak,
    "metric-values": `${leakMetricValue}`,
  };

  // Runs the production server over one bundle under the strict telemetry with
  // the given gate rules (production: all on) and the leak probe beside it,
  // sends every call, and returns the encoded results. The server's scope closes
  // before this returns, which runs the final export into the sink.
  const runStrictHost = Effect.fnUntraced(function* (
    bundleDir: string,
    calls: ReadonlyArray<ToolCall>,
    rules: GateRules = StrictGateRulesOn
  ) {
    const sink = yield* StrictEgressSink;
    const path = yield* Path.Path;
    const context = yield* loadPracticeKgBundleContext(bundleDir, path.join(path.dirname(bundleDir), "corpus"));
    const telemetry = layerPracticeKgTelemetryFor(StrictGateConfig.make({ ...PracticeKgStrictGateConfig, rules })).pipe(
      Layer.provide(Layer.mergeAll(layerInMemoryStrictSalt, leakResource))
    );
    const host = Layer.mergeAll(makePracticeKgHostServerLayer(context), Layer.effectDiscard(leakProbe)).pipe(
      Layer.provide(telemetry),
      Layer.provide(Layer.mergeAll(TestServices, Layer.succeed(StrictEgressSink, sink)))
    );
    return yield* withStdioServer(host)((io) =>
      Effect.gen(function* () {
        const { rpc } = yield* connectStdio(io);
        return yield* Effect.forEach(calls, ([name, args]) =>
          rpc["tools/call"]({ name, arguments: args }).pipe(
            Effect.result,
            Effect.flatMap(Result.match({ onFailure: encodeUnknownJson, onSuccess: encodeUnknownJson }))
          )
        );
      })
    );
  });

  // The encrypted spool both hosts export into, under a dev root key held in memory.
  const layerCanarySpool = (directory: string) =>
    layerStrictSpoolSink.pipe(
      Layer.provideMerge(
        layerStrictSpool(StrictSpoolOptions.make({ directory, tier: "shape-only", maxBytes: 64 * 1024 * 1024 }))
      ),
      Layer.provide(layerDevMemoryStrictSpoolKey)
    );

  // Runs `effect` with the canary spool in `directory` as its egress sink.
  const withCanarySpool =
    (directory: string) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      effect.pipe(provideScopedLayer(layerCanarySpool(directory)));

  describe("practice KG strict tier canary", () => {
    it.layer(Layer.fresh(TestServices), { timeout: "3 minutes" })((it) => {
      it.effect(
        "exports and prints no canary from any tool, in any encoding, on success or failure",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = yield* fs.makeTempDirectoryScoped({ prefix: `beep-strict-${canaries.root}-` });
          const healthyRoot = path.join(root, "healthy");
          const brokenRoot = path.join(root, "broken");
          yield* fs.makeDirectory(healthyRoot);
          yield* fs.makeDirectory(brokenRoot);
          const healthyBundle = yield* copySmokeBundle(healthyRoot);
          const brokenBundle = yield* copySmokeBundle(brokenRoot);
          // The corpus catalog is a valid DuckDB file without the bundle's tables.
          yield* fs.remove(path.join(brokenBundle, "practice.duckdb"));
          yield* fs.copyFile(
            path.join(brokenRoot, "corpus", "catalog", "corpus.duckdb"),
            path.join(brokenBundle, "practice.duckdb")
          );

          const spoolDir = path.join(root, "spool");

          const { results, stderr, replay } = yield* Effect.all({
            results: Effect.all([
              runStrictHost(healthyBundle, healthyCalls),
              runStrictHost(brokenBundle, brokenStoreCalls),
            ]),
            stderr: TestConsole.errorLines,
            replay: Effect.gen(function* () {
              return yield* (yield* StrictSpool).replay;
            }),
          }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), withCanarySpool(spoolDir));
          const records = replay.records;

          const forms = yield* canaryForms;
          // Every body is held back into the spool, and every sealed segment replays.
          expect(HashMap.size(replay.refused)).toBe(0);
          const segments = yield* fs.readDirectory(spoolDir);
          expect(A.length(segments)).toBeGreaterThan(0);
          const atRest = yield* Effect.forEach(segments, (segment) =>
            fs.readFile(path.join(spoolDir, segment)).pipe(Effect.map((bytes) => textDecoder.decode(bytes)))
          );
          expect(countCanaries(A.join(atRest, "\n"), forms)).toBe(0);
          const exported = A.join(
            A.map(records, (record) => record.body),
            "\n"
          );
          const printed = A.join(A.filter(stderr, P.isString), "\n");

          // Not vacuous: canaries reached the tools, which echo some of them back
          // to the client, and every tool exported spans.
          expect(countCanaries(A.join(A.flatten(results), "\n"), forms)).toBeGreaterThan(0);
          const spans = yield* Effect.forEach(
            A.filter(records, (record) => record.signal === "traces"),
            (record) => decodeExportedSpans(record.body)
          ).pipe(
            Effect.map(
              A.flatMap((body) =>
                A.flatMap(body.resourceSpans, (resource) => A.flatMap(resource.scopeSpans, (scope) => scope.spans))
              )
            )
          );
          expect(A.sort(A.dedupe(A.map(spans, (span) => span.name)), Order.String)).toEqual(
            A.sort(PracticeKgToolId.literals, Order.String)
          );
          // Failed calls are visible only through the literal reason on the handler span.
          const reasons = A.dedupe(
            A.flatMap(spans, (span) =>
              A.flatMap(span.attributes, (attribute) =>
                attribute.key === PracticeKgFailureReasonKey ? [attribute.value.stringValue] : []
              )
            )
          );
          assertTrue(A.every(reasons, S.is(PracticeKgToolFailureReason)));
          expect(reasons).toEqual(expect.arrayContaining(["invalid-input", "store-query-failed"]));

          expect(countCanaries(exported, forms)).toBe(0);
          expect(countCanaries(printed, forms)).toBe(0);
          // The leak probe ran, and with every rule on none of its needles got out.
          expect(Str.includes(`"${PracticeKgProcessRss.name}"`)(exported)).toBe(true);
          expect(A.filter(A.dedupe(R.values(hostNeedles)), (needle) => Str.includes(needle)(exported))).toEqual([]);
        })
      );
    });
  });

  describe("practice KG strict tier mutation table", () => {
    it.effect("has a host needle for every gate rule", () =>
      Effect.sync(() => {
        expect(A.sort(R.keys(hostNeedles), Order.String)).toEqual(A.sort(GateRule.literals, Order.String));
      })
    );

    // Each rule gets a fresh egress sink of its own, so no needle carries over.
    for (const rule of GateRule.literals) {
      it.layer(Layer.mergeAll(TestServices, layerInMemoryEgressSink(4096)), { timeout: "3 minutes" })((it) => {
        it.effect(
          `exports the ${rule} needle when only the ${rule} rule is off`,
          Effect.fnUntraced(function* () {
            const fs = yield* FileSystem.FileSystem;
            const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-strict-mutant-" });
            const bundle = yield* copySmokeBundle(root);
            yield* runStrictHost(bundle, [["kg_find", { query: canaries.query }]], {
              ...StrictGateRulesOn,
              [rule]: false,
            }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));
            const records = yield* (yield* StrictEgressSink).records;
            const exported = A.join(
              A.map(records, (record) => record.body),
              "\n"
            );
            expect(Str.includes(hostNeedles[rule])(exported)).toBe(true);
          })
        );
      });
    }
  });
});
