import {
  AiMetricsForwarderRunResult,
  AiMetricsInstallApplyDryRunResult,
  AiMetricsInstallDoctorResult,
  AiMetricsInstallPlan,
  AiMetricsLabelQueueResult,
  AiMetricsMirrorBundleResult,
  AiMetricsOtlpExportResult,
  AiMetricsSourceDiscoveryResult,
  AiMetricsWeeklyReportResult,
} from "@beep/repo-ai-metrics";
import { aiMetricsCommand } from "@beep/repo-cli/commands/AIMetrics";
import { fcRuns } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import {
  Cause,
  Config,
  ConfigProvider,
  Duration,
  Effect,
  Encoding,
  Exit,
  FileSystem,
  Layer,
  Path,
  pipe,
  Schedule,
} from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const runAiMetricsCommand = Command.runWith(aiMetricsCommand, { version: "0.0.0" });
const CommandTestLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);
const decodeForwarderResult = S.decodeUnknownEffect(S.fromJsonString(AiMetricsForwarderRunResult));
const decodeInstallApplyDryRun = S.decodeUnknownEffect(S.fromJsonString(AiMetricsInstallApplyDryRunResult));
const decodeInstallDoctor = S.decodeUnknownEffect(S.fromJsonString(AiMetricsInstallDoctorResult));
const decodeInstallPlan = S.decodeUnknownEffect(S.fromJsonString(AiMetricsInstallPlan));
const decodeLabelQueue = S.decodeUnknownEffect(S.fromJsonString(AiMetricsLabelQueueResult));
const decodeMirrorBundle = S.decodeUnknownEffect(S.fromJsonString(AiMetricsMirrorBundleResult));
const decodeOtlpExportResult = S.decodeUnknownEffect(S.fromJsonString(AiMetricsOtlpExportResult));
const decodeSourceDiscovery = S.decodeUnknownEffect(S.fromJsonString(AiMetricsSourceDiscoveryResult));
const decodeWeeklyReport = S.decodeUnknownEffect(S.fromJsonString(AiMetricsWeeklyReportResult));
const encodeForwarderResult = S.encodeUnknownEffect(S.fromJsonString(AiMetricsForwarderRunResult));
const encodeLabelQueue = S.encodeUnknownEffect(S.fromJsonString(AiMetricsLabelQueueResult));
const encodeMirrorBundle = S.encodeUnknownEffect(S.fromJsonString(AiMetricsMirrorBundleResult));
const encodeOtlpExportResult = S.encodeUnknownEffect(S.fromJsonString(AiMetricsOtlpExportResult));
const encodeWeeklyReport = S.encodeUnknownEffect(S.fromJsonString(AiMetricsWeeklyReportResult));
const ForwarderResultArbitrary = S.toArbitrary(AiMetricsForwarderRunResult);
const LabelQueueArbitrary = S.toArbitrary(AiMetricsLabelQueueResult);
const MirrorBundleArbitrary = S.toArbitrary(AiMetricsMirrorBundleResult);
const OtlpExportResultArbitrary = S.toArbitrary(AiMetricsOtlpExportResult);
const WeeklyReportArbitrary = S.toArbitrary(AiMetricsWeeklyReportResult);
const decodeUnknownJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const isString = (value: unknown): value is string => typeof value === "string";
const farFutureUntilEpochMs = 4_102_444_800_000;
const isCoverageRatchetRun = O.contains(Effect.runSync(Config.option(Config.string("VITEST_COVERAGE_RATCHET"))), "1");

const expectAiMetricsCommandFailure = Effect.fn("AIMetricsCommandTest.expectAiMetricsCommandFailure")(function* (
  args: ReadonlyArray<string>
) {
  const exit = yield* Effect.exit(runAiMetricsCommand(args));
  expect(Exit.isFailure(exit)).toBe(true);

  if (Exit.isFailure(exit)) {
    const error = Cause.squash(exit.cause);
    if (P.hasProperty(error, "message") && P.isString(error.message)) {
      return error.message;
    }

    return Cause.pretty(exit.cause);
  }

  return "";
});

type CapturedOtlpRequest = {
  readonly bodyByteLength: number;
  readonly bodyText: string;
  readonly contentType: string;
  readonly path: string;
};

const withTempDirectory = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, { recursive: true, force: true });
      })
  ).pipe(provideScopedLayer(CommandTestLayer));

const writeText = Effect.fn("AIMetricsCommandTest.writeText")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
  yield* fs.writeFileString(filePath, content);
});

// `runAiMetricsForwarder` upserts the identity registry, which derives clone,
// repository, and revision identity from the filesystem and refuses a root that
// is not a git root. Every fixture repository a forwarder run touches therefore
// needs a real `.git` layout.
const seedGitRoot = Effect.fn("AIMetricsCommandTest.seedGitRoot")(function* (repoRoot: string) {
  const path = yield* Path.Path;
  yield* writeText(path.join(repoRoot, ".git/HEAD"), "ref: refs/heads/main\n");
  yield* writeText(path.join(repoRoot, ".git/refs/heads/main"), `${pipe("a", Str.repeat(40))}\n`);
  yield* writeText(
    path.join(repoRoot, ".git/config"),
    '[remote "origin"]\n\turl = git@github.com:beep-effect/beep-effect.git\n'
  );
});

const loggedText = Effect.fn("AIMetricsCommandTest.loggedText")(function* () {
  return pipe(yield* TestConsole.logLines, A.filter(isString), A.join("\n"));
});

const lastLoggedLine = Effect.fn("AIMetricsCommandTest.lastLoggedLine")(function* () {
  const last = pipe(yield* TestConsole.logLines, A.last);
  if (O.isSome(last)) {
    return last.value;
  }

  return "";
});

const withRawArchiveKeyEnv = <A, E, R>(rawArchiveKey: string, use: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  provideScopedLayer(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({
        BEEP_AI_METRICS_RAW_ARCHIVE_KEY: rawArchiveKey,
      })
    )
  )(use);

// Replaces the ambient provider outright, so a variable omitted here reads as
// absent no matter what the developer's shell exports.
const withProcessEnv = <A, E, R>(
  env: { readonly [key: string]: string },
  use: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))(use);

const seedAiMetricsData = Effect.fn("AIMetricsCommandTest.seedAiMetricsData")(function* (tmpDir: string) {
  const path = yield* Path.Path;
  const dataRoot = path.join(tmpDir, "metrics");
  const homeDir = path.join(tmpDir, "home");
  const repoRoot = path.join(tmpDir, "repo");
  const codexRoot = path.join(homeDir, ".codex/sessions");

  yield* writeText(
    path.join(codexRoot, "codex.jsonl"),
    A.join(
      [
        '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z","payload":{"id":"s1"}}',
        '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z","payload":{"message":"SECRET_TOKEN=secret-value"}}',
      ],
      "\n"
    )
  );
  yield* writeText(path.join(repoRoot, "AGENTS.md"), "# Test agent guide\n");
  yield* seedGitRoot(repoRoot);
  yield* runAiMetricsCommand([
    "forwarder",
    "run",
    "--target",
    "local",
    "--data-root",
    dataRoot,
    "--home-dir",
    homeDir,
    "--repo-root",
    repoRoot,
    "--all",
    "--hash-salt",
    "test-salt",
    "--json",
  ]);
  const forwarderResult = yield* decodeForwarderResult(yield* lastLoggedLine());

  return { dataRoot, forwarderResult, homeDir, repoRoot };
});

const withPrependedPath = <A, E, R>(binDir: string, use: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previousPath = Bun.env.PATH;
      Bun.env.PATH = previousPath === undefined ? binDir : `${binDir}:${previousPath}`;
      return previousPath;
    }),
    () => use,
    (previousPath) =>
      Effect.sync(() => {
        if (previousPath === undefined) {
          delete Bun.env.PATH;
        } else {
          Bun.env.PATH = previousPath;
        }
      })
  );

const writeCommandShim = Effect.fn("AIMetricsCommandTest.writeCommandShim")(function* (
  commandName: string,
  binDir: string,
  logPath: string
) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const shimPath = path.join(binDir, commandName);
  yield* writeText(shimPath, `#!/usr/bin/env bash\nprintf '%s\\n' '${commandName} '"$*" >> '${logPath}'\nexit 0\n`);
  yield* fs.chmod(shimPath, 0o755);
});

const withOtlpSink = <A, E, R>(
  use: (baseUrl: string, requests: ReadonlyArray<CapturedOtlpRequest>) => Effect.Effect<A, E, R>,
  responseStatus = 200
) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const requests: Array<CapturedOtlpRequest> = [];
      const server = Bun.serve({
        fetch: (request) =>
          Effect.runPromise(
            Effect.gen(function* () {
              const body = yield* Effect.promise(() => Promise.resolve(request.arrayBuffer()));
              A.appendInPlace(requests, {
                bodyByteLength: body.byteLength,
                bodyText: new TextDecoder().decode(body),
                contentType: request.headers.get("content-type") ?? "",
                path: new URL(request.url).pathname,
              });
              return new Response(null, { status: responseStatus });
            })
          ),
        hostname: "127.0.0.1",
        port: 0,
      });
      return { requests, server };
    }),
    ({ requests, server }) => use(`http://127.0.0.1:${server.port}`, requests),
    ({ server }) => Effect.promise(() => server.stop(true))
  );

const findCapturedOtlpTraceRequest = Effect.fn("AIMetricsCommandTest.findCapturedOtlpTraceRequest")(function* (
  requests: ReadonlyArray<CapturedOtlpRequest>
) {
  const traceRequest = pipe(
    requests,
    A.findFirst((request) => request.path === "/v1/traces")
  );

  if (O.isSome(traceRequest)) {
    return traceRequest.value;
  }

  return yield* Effect.fail("OTLP trace request was not captured yet.");
});

const waitForCapturedOtlpTraceRequest = (
  requests: ReadonlyArray<CapturedOtlpRequest>
): Effect.Effect<CapturedOtlpRequest, string> =>
  findCapturedOtlpTraceRequest(requests).pipe(
    Effect.retry(Schedule.max([Schedule.spaced(Duration.millis(25)), Schedule.recurs(200)]))
  );

describe("ai-metrics command", () => {
  it("round-trips schema-derived report data through JSON command boundaries", () =>
    fc.assert(
      fc.property(
        ForwarderResultArbitrary,
        LabelQueueArbitrary,
        MirrorBundleArbitrary,
        OtlpExportResultArbitrary,
        WeeklyReportArbitrary,
        (forwarderResult, labelQueue, mirrorBundle, otlpExportResult, weeklyReport) => {
          const encodedForwarderResult = Effect.runSync(encodeForwarderResult(forwarderResult));
          const decodedForwarderResult = Effect.runSync(decodeForwarderResult(encodedForwarderResult));
          expect(Effect.runSync(encodeForwarderResult(decodedForwarderResult))).toBe(encodedForwarderResult);

          const encodedLabelQueue = Effect.runSync(encodeLabelQueue(labelQueue));
          const decodedLabelQueue = Effect.runSync(decodeLabelQueue(encodedLabelQueue));
          expect(Effect.runSync(encodeLabelQueue(decodedLabelQueue))).toBe(encodedLabelQueue);

          const encodedMirrorBundle = Effect.runSync(encodeMirrorBundle(mirrorBundle));
          const decodedMirrorBundle = Effect.runSync(decodeMirrorBundle(encodedMirrorBundle));
          expect(Effect.runSync(encodeMirrorBundle(decodedMirrorBundle))).toBe(encodedMirrorBundle);

          const encodedOtlpExportResult = Effect.runSync(encodeOtlpExportResult(otlpExportResult));
          const decodedOtlpExportResult = Effect.runSync(decodeOtlpExportResult(encodedOtlpExportResult));
          expect(Effect.runSync(encodeOtlpExportResult(decodedOtlpExportResult))).toBe(encodedOtlpExportResult);

          const encodedWeeklyReport = Effect.runSync(encodeWeeklyReport(weeklyReport));
          const decodedWeeklyReport = Effect.runSync(decodeWeeklyReport(encodedWeeklyReport));
          expect(Effect.runSync(encodeWeeklyReport(decodedWeeklyReport))).toBe(encodedWeeklyReport);
        }
      ),
      fcRuns(25)
    ));

  it("emits ingest JSON without raw local paths or Claude private identifiers", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const inputPath = path.join(tmpDir, "claude.jsonl");
          yield* writeText(
            inputPath,
            A.join(
              [
                '{"sessionId":"claude-private-session","cwd":"/private/repo/path","timestamp":"2026-05-05T11:00:00Z","message":{"role":"user"}}',
                '{"type":"sk-private-event-name","timestamp":"2026-05-05T11:01:00Z","message":{"role":"assistant"}}',
              ],
              "\n"
            )
          );

          yield* runAiMetricsCommand([
            "ingest",
            "--source",
            "claude",
            "--input",
            inputPath,
            "--hash-salt",
            "test-salt",
            "--json",
          ]);

          const output = yield* loggedText();
          expect(output).toContain("sourcePathHash");
          expect(output).toContain("message");
          expect(output).not.toContain(tmpDir);
          expect(output).not.toContain(inputPath);
          expect(output).not.toContain("claude-private-session");
          expect(output).not.toContain("sk-private-event-name");
          expect(output).not.toContain("/private/repo/path");
        })
      )
    ));

  it("does not expose input paths when ingest cannot read transcript input", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const inputPath = path.join(tmpDir, "private-missing-codex.jsonl");

          const output = yield* expectAiMetricsCommandFailure([
            "ingest",
            "--source",
            "codex",
            "--input",
            inputPath,
            "--hash-salt",
            "test-salt",
            "--json",
          ]);

          expect(output).toContain("Failed to read transcript input.");
          expect(output).not.toContain(inputPath);
          expect(output).not.toContain(tmpDir);
        })
      )
    ));

  it("requires a hash salt secret reference for non-local install previews", () =>
    Effect.runPromise(
      withTempDirectory(() =>
        Effect.gen(function* () {
          const output = yield* expectAiMetricsCommandFailure(["install", "preview", "--target", "dankserver"]);

          expect(output).toContain("hash-salt-secret-ref");
        })
      )
    ));

  it("emits dankserver install preview JSON with a hash salt secret reference", () =>
    Effect.runPromise(
      withTempDirectory(() =>
        Effect.gen(function* () {
          yield* runAiMetricsCommand([
            "install",
            "preview",
            "--target",
            "dankserver",
            "--hash-salt-secret-ref",
            "op://TBK/ai-metrics/hash-salt",
            "--raw-archive-key-secret-ref",
            "op://TBK/ai-metrics/raw-archive-key",
            "--json",
          ]);

          const output = yield* loggedText();
          expect(output).toContain("dankserver");
          expect(output).toContain("hashSaltSecretRef");
          expect(output).toContain("op://TBK/ai-metrics/hash-salt");
          expect(output).toContain("rawArchiveKeySecretRef");
          expect(output).toContain("op://TBK/ai-metrics/raw-archive-key");
        })
      )
    ));

  it("renders a bounded dankserver forwarder timer command", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          yield* runAiMetricsCommand([
            "forwarder",
            "timer",
            "--target",
            "dankserver",
            "--data-root",
            path.join(tmpDir, "metrics"),
            "--hash-salt-secret-ref",
            "op://TBK/ai-metrics/hash-salt",
            "--raw-archive-key-secret-ref",
            "op://TBK/ai-metrics/raw-archive-key",
            "--json",
          ]);

          const output = yield* loggedText();
          expect(output).toContain("--max-file-bytes");
          expect(output).toContain("8388608");
          expect(output).toContain("--max-files");
          expect(output).toContain("5");
          expect(output).toContain("--parquet-mode");
          expect(output).toContain("none");
          expect(output).toContain("OnUnitInactiveSec=30m");
          expect(output).toContain("pins the Bun executable path");
          expect(output).toContain(process.execPath);
          expect(output).toContain("packages/tooling/tool/cli/src/bin.ts");
          expect(output).toContain("ai-metrics");
          expect(output).toContain("forwarder");
          expect(output).toContain("--otlp");
          expect(output).toContain("--otlp-base-url");
          expect(output).toContain("beep-ai-metrics-forwarder.timer");
          expect(output).not.toContain("--max-files 200");
        })
      )
    ));

  // These five pin the data-root precedence introduced by the storage cutover:
  // `--data-root` -> `BEEP_AI_METRICS_DATA_ROOT` -> `${XDG_STATE_HOME:-$HOME/.local/state}/beep/ai-metrics`,
  // plus the absolute-path law on anything rendered into a systemd unit.
  it("resolves the data root from BEEP_AI_METRICS_DATA_ROOT when --data-root is absent", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const envDataRoot = path.join(tmpDir, "env-root");

          yield* withProcessEnv(
            { BEEP_AI_METRICS_DATA_ROOT: envDataRoot },
            runAiMetricsCommand(["install", "plan", "--target", "local", "--json"])
          );

          const plan = yield* decodeInstallPlan(yield* lastLoggedLine());
          expect(plan.storage.dataRoot).toBe(envDataRoot);
        })
      )
    ));

  it("prefers --data-root over BEEP_AI_METRICS_DATA_ROOT", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const flagDataRoot = path.join(tmpDir, "flag-root");

          yield* withProcessEnv(
            { BEEP_AI_METRICS_DATA_ROOT: path.join(tmpDir, "env-root") },
            runAiMetricsCommand(["install", "plan", "--target", "local", "--data-root", flagDataRoot, "--json"])
          );

          const plan = yield* decodeInstallPlan(yield* lastLoggedLine());
          expect(plan.storage.dataRoot).toBe(flagDataRoot);
        })
      )
    ));

  it("falls back to the XDG state store when neither the flag nor the environment supplies a data root", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          yield* withProcessEnv(
            { HOME: tmpDir },
            runAiMetricsCommand(["install", "plan", "--target", "local", "--json"])
          );

          const plan = yield* decodeInstallPlan(yield* lastLoggedLine());
          expect(plan.storage.dataRoot).toBe(`${tmpDir}/.local/state/beep/ai-metrics`);
          expect(plan.storage.dataRoot).not.toContain(".beep/ai-metrics");
        })
      )
    ));

  // `XDG_STATE_HOME` alone fully determines the root, so resolution must never reach for `HOME`.
  // Reading it eagerly would fail this shape — a container or a systemd unit with a state home but
  // no home directory — even though there is nothing left to resolve.
  it("resolves the XDG state store from XDG_STATE_HOME alone when HOME is absent", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const stateHome = path.join(tmpDir, "state");

          yield* withProcessEnv(
            { XDG_STATE_HOME: stateHome },
            runAiMetricsCommand(["install", "plan", "--target", "local", "--json"])
          );

          const plan = yield* decodeInstallPlan(yield* lastLoggedLine());
          expect(plan.storage.dataRoot).toBe(`${stateHome}/beep/ai-metrics`);
        })
      )
    ));

  it("refuses to render forwarder timer units for a relative data root", () =>
    Effect.runPromise(
      withTempDirectory(() =>
        Effect.gen(function* () {
          const message = yield* expectAiMetricsCommandFailure([
            "forwarder",
            "timer",
            "--target",
            "dankserver",
            "--data-root",
            ".beep/ai-metrics",
            "--hash-salt-secret-ref",
            "op://TBK/ai-metrics/hash-salt",
            "--raw-archive-key-secret-ref",
            "op://TBK/ai-metrics/raw-archive-key",
          ]);

          expect(message).toContain("absolute");
          expect(yield* loggedText()).toBe("");
        })
      )
    ));

  it("renders forwarder timer units with an absolute data root and status path", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const dataRoot = path.join(tmpDir, "metrics");

          yield* runAiMetricsCommand([
            "forwarder",
            "timer",
            "--target",
            "dankserver",
            "--data-root",
            dataRoot,
            "--hash-salt-secret-ref",
            "op://TBK/ai-metrics/hash-salt",
            "--raw-archive-key-secret-ref",
            "op://TBK/ai-metrics/raw-archive-key",
          ]);

          const output = yield* loggedText();
          expect(output).toContain("ExecStart=");
          expect(output).toContain("--data-root");
          expect(output).toContain(dataRoot);
          expect(output).toContain(`${dataRoot}/forwarder/status/latest.json`);
          expect(output).not.toContain(".beep/ai-metrics");
        })
      )
    ));

  it("renders a dedicated local Phoenix compose target", () =>
    Effect.runPromise(
      withTempDirectory(() =>
        Effect.gen(function* () {
          yield* runAiMetricsCommand(["install", "compose", "--target", "local", "--json"]);

          const output = yield* loggedText();
          expect(output).toContain("arizephoenix/phoenix:latest");
          expect(output).toContain("127.0.0.1:6006:6006");
          expect(output).toContain("beep-ai-metrics-phoenix");
        })
      )
    ));

  it("emits typed install plan JSON", () =>
    Effect.runPromise(
      withTempDirectory(() =>
        Effect.gen(function* () {
          yield* runAiMetricsCommand(["install", "plan", "--target", "local", "--json"]);

          const plan = yield* decodeInstallPlan(yield* lastLoggedLine());
          expect(plan.target).toBe("local");
          expect(plan.dryRunOnly).toBe(true);
          expect(plan.steps).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                stepId: "backend.phoenix.plan",
              }),
            ])
          );
        })
      )
    ));

  it("runs install doctor with one source and missing-source warnings", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          yield* writeText(
            path.join(homeDir, ".codex/sessions/2026/05/05/codex-session.jsonl"),
            '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z"}\n'
          );

          yield* runAiMetricsCommand([
            "install",
            "doctor",
            "--target",
            "local",
            "--repo-root",
            repoRoot,
            "--home-dir",
            homeDir,
            "--all",
            "--hash-salt",
            "test-salt",
            "--json",
          ]);

          const doctor = yield* decodeInstallDoctor(yield* lastLoggedLine());
          const output = yield* loggedText();
          expect(doctor.status).toBe("warning");
          expect(doctor.availableSourceCount).toBe(1);
          expect(output).not.toContain(tmpDir);
        })
      )
    ));

  it("fails install doctor when no local sources are available", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");

          const exit = yield* Effect.exit(
            runAiMetricsCommand([
              "install",
              "doctor",
              "--target",
              "local",
              "--repo-root",
              repoRoot,
              "--home-dir",
              homeDir,
              "--all",
              "--json",
            ])
          );

          const doctor = yield* decodeInstallDoctor(yield* lastLoggedLine());
          expect(Exit.isFailure(exit)).toBe(true);
          expect(doctor.status).toBe("failed");
          expect(doctor.availableSourceCount).toBe(0);
        })
      )
    ));

  it("dry-runs dankserver install apply without remote mutation", () =>
    Effect.runPromise(
      withTempDirectory(() =>
        Effect.gen(function* () {
          yield* runAiMetricsCommand([
            "install",
            "apply",
            "--target",
            "dankserver",
            "--hash-salt-secret-ref",
            "op://TBK/ai-metrics/hash-salt",
            "--raw-archive-key-secret-ref",
            "op://TBK/ai-metrics/raw-archive-key",
            "--dry-run",
            "--json",
          ]);

          const result = yield* decodeInstallApplyDryRun(yield* lastLoggedLine());
          expect(result.target).toBe("dankserver");
          expect(result.dryRun).toBe(true);
          expect(result.plan.steps).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                command: "cd infra && pulumi preview --stack beep-ai-metrics-dankserver",
                stepId: "backend.phoenix.plan",
              }),
            ])
          );
        })
      )
    ));

  it("refuses install apply without dry-run in P5a", () =>
    Effect.runPromise(
      withTempDirectory(() =>
        Effect.gen(function* () {
          const output = yield* expectAiMetricsCommandFailure(["install", "apply", "--target", "local"]);

          expect(output).toContain("dry-run-only");
        })
      )
    ));

  it("emits config snapshot JSON for repo-owned agent files", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          yield* writeText(path.join(tmpDir, "AGENTS.md"), "root guide\n");
          yield* writeText(path.join(tmpDir, ".codex/config.toml"), 'model = "gpt-5"\n');
          yield* writeText(path.join(tmpDir, ".repos/effect-v4/AGENTS.md"), "vendored guide\n");

          yield* runAiMetricsCommand(["config", "snapshot", "--repo-root", tmpDir, "--json"]);

          const output = yield* loggedText();
          expect(output).toContain("configHash");
          expect(output).toContain("AGENTS.md");
          expect(output).not.toContain(".repos/effect-v4/AGENTS.md");
        })
      )
    ));

  it("does not expose repo paths when config snapshot cannot read an agent file", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const agentPath = path.join(tmpDir, "AGENTS.md");
          yield* writeText(agentPath, "root guide\n");
          yield* fs.chmod(agentPath, 0o000);

          const output = yield* expectAiMetricsCommandFailure(["config", "snapshot", "--repo-root", tmpDir, "--json"]);

          expect(output).toContain("Failed to read config snapshot file.");
          expect(output).not.toContain(agentPath);
          expect(output).not.toContain(tmpDir);
        })
      )
    ));

  it("emits privacy check JSON without raw transcript text", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const inputPath = path.join(tmpDir, "codex.jsonl");
          yield* writeText(
            inputPath,
            A.join(
              [
                '{"type":"user_message","timestamp":"2026-05-05T12:00:00Z","message":"ship the private plan","OPENAI_API_KEY":"sk-privatefixture"}',
                '{"type":"assistant_message","timestamp":"2026-05-05T12:01:00Z","content":"private implementation details"}',
              ],
              "\n"
            )
          );

          yield* runAiMetricsCommand([
            "privacy",
            "check",
            "--source",
            "codex",
            "--input",
            inputPath,
            "--hash-salt",
            "test-salt",
            "--json",
          ]);

          const output = yield* loggedText();
          expect(output).toContain("hashSaltStatus");
          expect(output).toContain("provided");
          expect(output).not.toContain("ship the private plan");
          expect(output).not.toContain("private implementation details");
          expect(output).not.toContain("sk-privatefixture");
          expect(output).not.toContain(tmpDir);
        })
      )
    ));

  it("does not expose input paths when privacy check cannot inspect input", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const inputPath = path.join(tmpDir, "private-missing-codex.jsonl");

          const output = yield* expectAiMetricsCommandFailure([
            "privacy",
            "check",
            "--source",
            "codex",
            "--input",
            inputPath,
            "--hash-salt",
            "test-salt",
            "--json",
          ]);

          expect(output).toContain("Failed to inspect privacy input.");
          expect(output).not.toContain(inputPath);
          expect(output).not.toContain(tmpDir);
        })
      )
    ));

  it("discovers local sources without exposing private paths or OpenClaw secrets", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          const claudeProjectName = pipe(repoRoot, Str.replace(/[/\\]/gu, "-"));
          const openClawUnitPath = path.join(homeDir, ".config/systemd/user/openclaw-gateway.service");

          yield* writeText(
            path.join(homeDir, ".codex/sessions/2026/05/05/codex-session.jsonl"),
            '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z"}\n'
          );
          yield* writeText(
            path.join(homeDir, ".codex/sessions/2026/05/05/oversized-codex-session.jsonl"),
            `{"type":"session_meta","timestamp":"2026-05-05T10:01:00Z","payload":"${pipe("x", Str.repeat(256))}"}\n`
          );
          yield* writeText(
            path.join(homeDir, ".claude/projects", claudeProjectName, "claude-session.jsonl"),
            '{"sessionId":"claude-session","timestamp":"2026-05-05T11:00:00Z"}\n'
          );
          yield* writeText(openClawUnitPath, "[Service]\nEnvironment=OPENCLAW_GATEWAY_TOKEN=super-secret-token\n");

          yield* runAiMetricsCommand([
            "sources",
            "discover",
            "--repo-root",
            repoRoot,
            "--home-dir",
            homeDir,
            "--openclaw-unit",
            openClawUnitPath,
            "--all",
            "--hash-salt",
            "test-salt",
            "--max-file-bytes",
            "128",
            "--json",
          ]);

          const result = yield* decodeSourceDiscovery(yield* lastLoggedLine());
          const codex = pipe(
            result.sources,
            A.findFirst((source) => source.sourceKind === "codex")
          );
          const output = yield* loggedText();
          expect(result.maxFileBytes).toBe(128);
          expect(O.isSome(codex)).toBe(true);
          if (O.isSome(codex)) {
            expect(codex.value.fileCount).toBe(1);
            expect(codex.value.files[0]?.sizeBytes).toBeLessThanOrEqual(128);
            expect(codex.value.sizeExcludedFileCount).toBe(1);
          }
          expect(output).toContain("gateway_metadata");
          expect(output).toContain("provided");
          expect(output).not.toContain(tmpDir);
          expect(output).not.toContain("super-secret-token");
        })
      )
    ));

  it("runs durable local forwarder without exposing raw transcript text", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          const dataRoot = path.join(tmpDir, "metrics");
          const rawArchiveKey = Encoding.encodeBase64(new Uint8Array(32).fill(11));

          yield* writeText(
            path.join(homeDir, ".codex/sessions/codex-session.jsonl"),
            A.join(
              [
                '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z"}',
                '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z","payload":{"message":"private-forwarder-secret"}}',
              ],
              "\n"
            )
          );
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "root guide\n");
          yield* seedGitRoot(repoRoot);

          yield* withRawArchiveKeyEnv(
            rawArchiveKey,
            runAiMetricsCommand([
              "forwarder",
              "run",
              "--repo-root",
              repoRoot,
              "--home-dir",
              homeDir,
              "--data-root",
              dataRoot,
              "--all",
              "--hash-salt",
              "test-salt",
              "--json",
            ])
          );

          const output = yield* loggedText();
          expect(output).toContain("sourceFileCount");
          expect(output).toContain("archiveObjectCount");
          expect(output).toContain("turnCount");
          expect(output).not.toContain("private-forwarder-secret");
          expect(output).not.toContain(rawArchiveKey);
        })
      )
    ));

  it("emits retention enforcement summary for forwarder run JSON", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        withRawArchiveKeyEnv(
          Encoding.encodeBase64(new Uint8Array(32).fill(13)),
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const fs = yield* FileSystem.FileSystem;
            const homeDir = path.join(tmpDir, "home");
            const repoRoot = path.join(tmpDir, "repo");
            const dataRoot = path.join(tmpDir, "metrics");

            yield* writeText(
              path.join(homeDir, ".codex/sessions/codex-session.jsonl"),
              A.join(
                [
                  '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z"}',
                  '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z","payload":{"message":"private-forwarder-retention-secret"}}',
                ],
                "\n"
              )
            );
            yield* writeText(path.join(repoRoot, "AGENTS.md"), "root guide\n");
            yield* seedGitRoot(repoRoot);

            yield* runAiMetricsCommand([
              "forwarder",
              "run",
              "--repo-root",
              repoRoot,
              "--home-dir",
              homeDir,
              "--data-root",
              dataRoot,
              "--all",
              "--hash-salt",
              "test-salt",
              "--retention-enforce",
              "--max-snapshot-exports",
              "0",
              "--json",
            ]);

            const output = yield* lastLoggedLine();
            const json = yield* decodeUnknownJson(output);
            expect(json).toEqual(
              expect.objectContaining({
                retentionEnforcement: expect.objectContaining({
                  deletedDerivedExportCount: 1,
                  dryRun: false,
                  keptDerivedExportCount: 0,
                  maxSnapshotExports: 0,
                }),
              })
            );
            expect(output).not.toContain("private-forwarder-retention-secret");
            expect(
              (yield* fs.readDirectory(path.join(dataRoot, "derived/parquet"))).filter((entry) =>
                entry.startsWith("forwarder-")
              )
            ).toEqual([]);
          })
        )
      )
    ));

  it.skipIf(isCoverageRatchetRun)(
    "runs forwarder with derived OTLP export status without exposing raw transcript text",
    () =>
      Effect.runPromise(
        withOtlpSink((otlpBaseUrl, requests) =>
          withTempDirectory((tmpDir) =>
            Effect.gen(function* () {
              const path = yield* Path.Path;
              const homeDir = path.join(tmpDir, "home");
              const repoRoot = path.join(tmpDir, "repo");
              const dataRoot = path.join(tmpDir, "metrics");
              const rawArchiveKey = Encoding.encodeBase64(new Uint8Array(32).fill(23));

              yield* writeText(
                path.join(homeDir, ".codex/sessions/codex-session.jsonl"),
                A.join(
                  [
                    '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z"}',
                    '{"type":"tool_result","timestamp":"2026-05-05T10:01:00Z","message":"private-forwarder-otlp-secret"}',
                  ],
                  "\n"
                )
              );
              yield* writeText(path.join(repoRoot, "AGENTS.md"), "root guide\n");
              yield* seedGitRoot(repoRoot);

              yield* withRawArchiveKeyEnv(
                rawArchiveKey,
                runAiMetricsCommand([
                  "forwarder",
                  "run",
                  "--repo-root",
                  repoRoot,
                  "--home-dir",
                  homeDir,
                  "--data-root",
                  dataRoot,
                  "--all",
                  "--hash-salt",
                  "test-salt",
                  "--otlp",
                  "--otlp-base-url",
                  otlpBaseUrl,
                  "--json",
                ])
              );

              const resultJson = yield* lastLoggedLine();
              const result = yield* decodeForwarderResult(resultJson);
              const otlpExport = O.fromNullishOr(result.otlpExport);
              const traceRequest = yield* waitForCapturedOtlpTraceRequest(requests);

              expect(O.isSome(otlpExport)).toBe(true);
              if (O.isSome(otlpExport)) {
                expect(otlpExport.value.status).toBe("exported");
                if (otlpExport.value.status === "exported") {
                  expect(otlpExport.value.endpointTraceUrl).toBe(`${otlpBaseUrl}/v1/traces`);
                  expect(otlpExport.value.ingestRunId).toBe(result.ingestRunId);
                  expect(otlpExport.value.spanCount).toBeGreaterThan(0);
                  expect(otlpExport.value.sessionSpanCount).toBeGreaterThan(0);
                  expect(otlpExport.value.turnSpanCount).toBeGreaterThan(0);
                }
              }
              expect(traceRequest.contentType).toContain("application/x-protobuf");
              expect(traceRequest.bodyByteLength).toBeGreaterThan(0);
              expect(traceRequest.bodyText).not.toContain("private-forwarder-otlp-secret");
              expect(traceRequest.bodyText).not.toContain(tmpDir);
              expect(resultJson).not.toContain("private-forwarder-otlp-secret");
              expect(resultJson).not.toContain(rawArchiveKey);
            })
          )
        )
      )
  );

  it.skipIf(isCoverageRatchetRun)(
    "keeps forwarder successful when derived OTLP export reports a sanitized failure",
    () =>
      Effect.runPromise(
        withOtlpSink(
          (otlpBaseUrl) =>
            withTempDirectory((tmpDir) =>
              Effect.gen(function* () {
                const path = yield* Path.Path;
                const homeDir = path.join(tmpDir, "home");
                const repoRoot = path.join(tmpDir, "repo");
                const dataRoot = path.join(tmpDir, "metrics");
                const rawArchiveKey = Encoding.encodeBase64(new Uint8Array(32).fill(29));

                yield* writeText(
                  path.join(homeDir, ".codex/sessions/codex-session.jsonl"),
                  A.join(
                    [
                      '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z"}',
                      '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z","message":"private-forwarder-failed-otlp"}',
                    ],
                    "\n"
                  )
                );
                yield* writeText(path.join(repoRoot, "AGENTS.md"), "root guide\n");
                yield* seedGitRoot(repoRoot);

                yield* withRawArchiveKeyEnv(
                  rawArchiveKey,
                  runAiMetricsCommand([
                    "forwarder",
                    "run",
                    "--repo-root",
                    repoRoot,
                    "--home-dir",
                    homeDir,
                    "--data-root",
                    dataRoot,
                    "--all",
                    "--hash-salt",
                    "test-salt",
                    "--otlp",
                    "--otlp-base-url",
                    otlpBaseUrl,
                    "--json",
                  ])
                );

                const resultJson = yield* lastLoggedLine();
                const result = yield* decodeForwarderResult(resultJson);
                const otlpExport = O.fromNullishOr(result.otlpExport);
                const errorOutput = pipe(yield* TestConsole.errorLines, A.filter(isString), A.join("\n"));

                expect(result.sourceFileCount).toBe(1);
                expect(result.turnCount).toBeGreaterThan(0);
                expect(O.isSome(otlpExport)).toBe(true);
                if (O.isSome(otlpExport)) {
                  expect(otlpExport.value.status).toBe("failed");
                  if (otlpExport.value.status === "failed") {
                    expect(otlpExport.value.endpointTraceUrl).toBe(`${otlpBaseUrl}/v1/traces`);
                    expect(otlpExport.value.ingestRunId).toBe(result.ingestRunId);
                    expect(otlpExport.value.message).toBe("OTLP export did not complete after the forwarder run.");
                    expect(otlpExport.value.message).not.toContain("private-forwarder-failed-otlp");
                    expect(otlpExport.value.message).not.toContain(tmpDir);
                  }
                }
                expect(errorOutput).toContain("OTLP export failed after forwarder run");
                expect(errorOutput).toContain("OTLP export did not complete after the forwarder run.");
                expect(errorOutput).not.toContain("private-forwarder-failed-otlp");
                expect(errorOutput).not.toContain(tmpDir);
                expect(resultJson).not.toContain("private-forwarder-failed-otlp");
                expect(resultJson).not.toContain(rawArchiveKey);
              })
            ),
          500
        )
      )
  );

  it("does not expose raw source paths or archive keys on forwarder read failures", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const homeDir = path.join(tmpDir, "home");
          const repoRoot = path.join(tmpDir, "repo");
          const dataRoot = path.join(tmpDir, "metrics");
          const rawArchiveKey = Encoding.encodeBase64(new Uint8Array(32).fill(13));
          const sourcePath = path.join(homeDir, ".codex/sessions/private-source.jsonl");

          yield* writeText(sourcePath, '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z"}');
          yield* fs.chmod(sourcePath, 0o000);
          yield* writeText(path.join(repoRoot, "AGENTS.md"), "root guide\n");
          yield* seedGitRoot(repoRoot);

          const output = yield* withRawArchiveKeyEnv(
            rawArchiveKey,
            expectAiMetricsCommandFailure([
              "forwarder",
              "run",
              "--repo-root",
              repoRoot,
              "--home-dir",
              homeDir,
              "--data-root",
              dataRoot,
              "--all",
              "--hash-salt",
              "test-salt",
              "--json",
            ])
          );

          expect(output).toContain("Failed to read AI metrics codex source file");
          expect(output).not.toContain(sourcePath);
          expect(output).not.toContain(tmpDir);
          expect(output).not.toContain(rawArchiveKey);
        })
      )
    ));

  it(
    "runs the scriptable P4 label, benchmark, and weekly report workflow",
    () =>
      Effect.runPromise(
        withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const homeDir = path.join(tmpDir, "home");
            const repoRoot = path.join(tmpDir, "repo");
            const dataRoot = path.join(tmpDir, "metrics");
            const rawArchiveKey = Encoding.encodeBase64(new Uint8Array(32).fill(19));

            yield* writeText(
              path.join(homeDir, ".codex/sessions/codex-session.jsonl"),
              A.join(
                [
                  '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z"}',
                  '{"type":"event_msg","timestamp":"2026-05-05T10:01:00Z","message":"private-cli-report-text"}',
                ],
                "\n"
              )
            );
            yield* writeText(path.join(repoRoot, "AGENTS.md"), "root guide\n");
            yield* seedGitRoot(repoRoot);

            yield* withRawArchiveKeyEnv(
              rawArchiveKey,
              runAiMetricsCommand([
                "forwarder",
                "run",
                "--repo-root",
                repoRoot,
                "--home-dir",
                homeDir,
                "--data-root",
                dataRoot,
                "--all",
                "--hash-salt",
                "test-salt",
                "--json",
              ])
            );
            const forwarder = yield* decodeForwarderResult(yield* lastLoggedLine());

            yield* runAiMetricsCommand([
              "label",
              "queue",
              "--data-root",
              dataRoot,
              "--since",
              "0",
              "--until",
              String(farFutureUntilEpochMs),
              "--json",
            ]);
            const queue = yield* decodeLabelQueue(yield* lastLoggedLine());
            const firstTask = A.head(queue.items);
            expect(O.isSome(firstTask)).toBe(true);
            if (O.isNone(firstTask)) {
              return;
            }

            yield* runAiMetricsCommand([
              "label",
              "add",
              "--data-root",
              dataRoot,
              "--task",
              firstTask.value.agentTaskId,
              "--passed",
              "true",
              "--rating",
              "5",
              "--quality-gate",
              "passed",
              "--interventions",
              "1",
              "--follow-up-fix",
              "false",
              "--note",
              "OPENAI_API_KEY=secret-cli-report-fixture",
              "--json",
            ]);

            yield* runAiMetricsCommand([
              "benchmark",
              "case",
              "add",
              "--data-root",
              dataRoot,
              "--case",
              "case-cli",
              "--title",
              "CLI proof",
              "--prompt-hash",
              "prompt-hash-only",
              "--checks",
              "bun run check",
              "--json",
            ]);

            yield* runAiMetricsCommand([
              "benchmark",
              "run",
              "--data-root",
              dataRoot,
              "--case",
              "case-cli",
              "--config",
              forwarder.configSnapshotId,
              "--elapsed-ms",
              "1200",
              "--passed",
              "true",
              "--quality-gate",
              "passed",
              "--json",
            ]);

            yield* runAiMetricsCommand([
              "report",
              "weekly",
              "--data-root",
              dataRoot,
              "--since",
              "0",
              "--until",
              String(farFutureUntilEpochMs),
              "--json",
            ]);
            const report = yield* decodeWeeklyReport(yield* lastLoggedLine());
            const reportJson = yield* fs.readFileString(report.jsonPath);

            expect(report.document.scores).toHaveLength(1);
            expect(reportJson).toContain(forwarder.configSnapshotId);
            expect(reportJson).not.toContain("private-cli-report-text");
            expect(reportJson).not.toContain("secret-cli-report-fixture");
            expect(reportJson).not.toContain(tmpDir);
          })
        )
      ),
    90_000
  );

  it("reports sanitized OTLP export failures when no derived runs exist", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const dataRoot = path.join(tmpDir, "metrics");

          const output = yield* expectAiMetricsCommandFailure([
            "otlp",
            "export",
            "--target",
            "local",
            "--data-root",
            dataRoot,
            "--ingest-run",
            "latest",
            "--json",
          ]);

          // The export path now migrates the store before reading it, so a data root that
          // was never ingested fails at that step rather than at the ingest-run lookup.
          // Both are sanitized; this one is reached earlier and names the remedy.
          expect(output).toContain("Failed to prepare the AI metrics derived DuckDB store for OTLP export");
          expect(output).not.toContain(dataRoot);
          expect(output).not.toContain(tmpDir);
        })
      )
    ));

  it.skipIf(isCoverageRatchetRun)("exports local derived OTLP spans as protobuf without raw transcript leakage", () =>
    Effect.runPromise(
      withOtlpSink((otlpBaseUrl, requests) =>
        withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const homeDir = path.join(tmpDir, "home");
            const repoRoot = path.join(tmpDir, "repo");
            const dataRoot = path.join(tmpDir, "metrics");
            const rawArchiveKey = Encoding.encodeBase64(new Uint8Array(32).fill(17));

            yield* writeText(
              path.join(homeDir, ".codex/sessions/codex-session.jsonl"),
              A.join(
                [
                  '{"type":"session_meta","timestamp":"2026-05-05T10:00:00Z"}',
                  '{"type":"tool_result","timestamp":"2026-05-05T10:01:00Z","message":"private-otlp-fixture"}',
                ],
                "\n"
              )
            );
            yield* writeText(path.join(repoRoot, "AGENTS.md"), "root guide\n");
            yield* seedGitRoot(repoRoot);

            yield* withRawArchiveKeyEnv(
              rawArchiveKey,
              runAiMetricsCommand([
                "forwarder",
                "run",
                "--repo-root",
                repoRoot,
                "--home-dir",
                homeDir,
                "--data-root",
                dataRoot,
                "--all",
                "--hash-salt",
                "test-salt",
                "--json",
              ])
            );
            const forwarderResult = yield* decodeForwarderResult(yield* lastLoggedLine());

            yield* runAiMetricsCommand([
              "otlp",
              "export",
              "--target",
              "local",
              "--data-root",
              dataRoot,
              "--ingest-run",
              "latest",
              "--otlp-base-url",
              otlpBaseUrl,
              "--json",
            ]);

            const resultJson = yield* lastLoggedLine();
            const result = yield* decodeOtlpExportResult(resultJson);
            const traceRequest = yield* waitForCapturedOtlpTraceRequest(requests);

            expect(traceRequest.contentType).toContain("application/x-protobuf");
            expect(traceRequest.bodyByteLength).toBeGreaterThan(0);
            expect(traceRequest.bodyText).not.toContain("private-otlp-fixture");
            expect(traceRequest.bodyText).not.toContain(tmpDir);
            expect(result.endpointTraceUrl).toBe(`${otlpBaseUrl}/v1/traces`);
            expect(result.ingestRunId).toBe(forwarderResult.ingestRunId);
            expect(result.spanCount).toBeGreaterThan(0);
            expect(resultJson).not.toContain("private-otlp-fixture");
            expect(resultJson).not.toContain(rawArchiveKey);
            expect(resultJson).not.toContain(tmpDir);
          })
        )
      )
    )
  );

  it.skipIf(isCoverageRatchetRun)("exports an explicit derived OTLP ingest run without resolving latest", () =>
    Effect.runPromise(
      withOtlpSink((otlpBaseUrl, requests) =>
        withTempDirectory((tmpDir) =>
          Effect.gen(function* () {
            const rawArchiveKey = Encoding.encodeBase64(new Uint8Array(32).fill(31));
            const { dataRoot, forwarderResult } = yield* withRawArchiveKeyEnv(rawArchiveKey, seedAiMetricsData(tmpDir));

            yield* runAiMetricsCommand([
              "otlp",
              "export",
              "--target",
              "local",
              "--data-root",
              dataRoot,
              "--ingest-run",
              forwarderResult.ingestRunId,
              "--otlp-base-url",
              otlpBaseUrl,
              "--json",
            ]);

            const result = yield* decodeOtlpExportResult(yield* lastLoggedLine());
            const traceRequest = yield* waitForCapturedOtlpTraceRequest(requests);

            expect(traceRequest.contentType).toContain("application/x-protobuf");
            expect(result.ingestRunId).toBe(forwarderResult.ingestRunId);
            expect(result.spanCount).toBeGreaterThan(0);
          })
        )
      )
    )
  );

  it.skipIf(isCoverageRatchetRun)(
    "accepts non-local OTLP export install secret references before reading derived runs",
    () =>
      Effect.runPromise(
        withOtlpSink((otlpBaseUrl, requests) =>
          withTempDirectory((tmpDir) =>
            Effect.gen(function* () {
              const path = yield* Path.Path;
              const dataRoot = path.join(tmpDir, "metrics");

              const output = yield* expectAiMetricsCommandFailure([
                "otlp",
                "export",
                "--target",
                "dankserver",
                "--data-root",
                dataRoot,
                "--ingest-run",
                "latest",
                "--hash-salt-secret-ref",
                "op://TBK/ai-metrics/hash-salt",
                "--raw-archive-key-secret-ref",
                "op://TBK/ai-metrics/raw-archive-key",
                "--otlp-base-url",
                otlpBaseUrl,
                "--json",
              ]);

              // Fails while preparing the store, still before any derived read and still
              // before anything reaches the collector -- which is what this test guards.
              expect(output).toContain("Failed to prepare the AI metrics derived DuckDB store for OTLP export");
              expect(requests).toHaveLength(0);
              expect(output).not.toContain("hash-salt-secret-ref");
              expect(output).not.toContain("raw-archive-key-secret-ref");
              expect(output).not.toContain(dataRoot);
              expect(output).not.toContain(tmpDir);
            })
          )
        )
      )
  );

  it("builds a sanitized mirror bundle and plans rsync by default", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        withRawArchiveKeyEnv(
          Encoding.encodeBase64(new Uint8Array(32).fill(9)),
          Effect.gen(function* () {
            const { dataRoot } = yield* seedAiMetricsData(tmpDir);

            yield* runAiMetricsCommand([
              "mirror",
              "build",
              "--target",
              "dankserver",
              "--data-root",
              dataRoot,
              "--json",
            ]);

            const buildJson = yield* decodeMirrorBundle(yield* lastLoggedLine());
            expect(buildJson).toEqual(
              expect.objectContaining({
                bundleDir: expect.any(String),
                bundleId: expect.stringContaining("p7-mirror-"),
              })
            );

            yield* runAiMetricsCommand(["mirror", "sync", "--bundle", "latest", "--data-root", dataRoot, "--json"]);

            const syncJson = yield* decodeUnknownJson(yield* lastLoggedLine());
            expect(syncJson).toEqual(
              expect.objectContaining({
                confirmToken: "p7-derived-mirror",
                dryRun: true,
                remoteRoot: "/srv/data/ai-metrics/p7-derived-mirror",
                status: "planned",
              })
            );
          })
        )
      )
    ));

  it("rejects unsafe mirror bundles before confirmed sync", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        withRawArchiveKeyEnv(
          Encoding.encodeBase64(new Uint8Array(32).fill(12)),
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const { dataRoot } = yield* seedAiMetricsData(tmpDir);

            yield* runAiMetricsCommand([
              "mirror",
              "build",
              "--target",
              "dankserver",
              "--data-root",
              dataRoot,
              "--json",
            ]);
            const buildJson = yield* decodeMirrorBundle(yield* lastLoggedLine());
            yield* writeText(path.join(buildJson.bundleDir, "mirror.duckdb"), "unsafe payload");

            const output = yield* expectAiMetricsCommandFailure([
              "mirror",
              "sync",
              "--bundle",
              "latest",
              "--data-root",
              dataRoot,
              "--confirm",
              "p7-derived-mirror",
              "--json",
            ]);

            expect(output).toContain("AI metrics mirror bundle contains files outside the sanitized sync contract.");
          })
        )
      )
    ));

  it("rejects mirror bundles with undeclared parquet files before sync", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        withRawArchiveKeyEnv(
          Encoding.encodeBase64(new Uint8Array(32).fill(17)),
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const { dataRoot } = yield* seedAiMetricsData(tmpDir);

            yield* runAiMetricsCommand([
              "mirror",
              "build",
              "--target",
              "dankserver",
              "--data-root",
              dataRoot,
              "--json",
            ]);
            const buildJson = yield* decodeMirrorBundle(yield* lastLoggedLine());
            yield* writeText(path.join(buildJson.bundleDir, "parquet/undeclared.parquet"), "extra payload");

            const output = yield* expectAiMetricsCommandFailure([
              "mirror",
              "sync",
              "--bundle",
              "latest",
              "--data-root",
              dataRoot,
              "--confirm",
              "p7-derived-mirror",
              "--json",
            ]);

            expect(output).toContain("AI metrics mirror bundle contains Parquet files not declared in the manifest.");
          })
        )
      )
    ));

  it("runs confirmed mirror sync only after local manifest validation", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        withRawArchiveKeyEnv(
          Encoding.encodeBase64(new Uint8Array(32).fill(13)),
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const fs = yield* FileSystem.FileSystem;
            const { dataRoot } = yield* seedAiMetricsData(tmpDir);
            const binDir = path.join(tmpDir, "bin");
            const logPath = path.join(tmpDir, "commands.log");
            yield* fs.makeDirectory(binDir, { recursive: true });
            yield* writeCommandShim("ssh", binDir, logPath);
            yield* writeCommandShim("rsync", binDir, logPath);

            yield* runAiMetricsCommand([
              "mirror",
              "build",
              "--target",
              "dankserver",
              "--data-root",
              dataRoot,
              "--json",
            ]);

            yield* withPrependedPath(
              binDir,
              runAiMetricsCommand([
                "mirror",
                "sync",
                "--bundle",
                "latest",
                "--data-root",
                dataRoot,
                "--confirm",
                "p7-derived-mirror",
                "--json",
              ])
            );

            const syncJson = yield* decodeUnknownJson(yield* lastLoggedLine());
            expect(syncJson).toEqual(
              expect.objectContaining({
                dryRun: false,
                remoteRoot: "/srv/data/ai-metrics/p7-derived-mirror",
                status: "synced",
              })
            );
            const commandLog = yield* fs.readFileString(logPath);
            expect(commandLog).toContain("ssh dankserver-yubi mkdir -p");
            expect(commandLog).toContain("rsync -az --delete");
          })
        )
      )
    ));

  it("runs a retention restore drill without printing transcript text", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        withRawArchiveKeyEnv(
          Encoding.encodeBase64(new Uint8Array(32).fill(10)),
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const { dataRoot } = yield* seedAiMetricsData(tmpDir);
            const restoreRoot = path.join(tmpDir, "restore");

            yield* runAiMetricsCommand([
              "retention",
              "restore-drill",
              "--data-root",
              dataRoot,
              "--restore-root",
              restoreRoot,
              "--before",
              `${farFutureUntilEpochMs}`,
              "--hash-salt",
              "test-salt",
              "--json",
            ]);

            const resultJson = yield* decodeUnknownJson(yield* lastLoggedLine());
            expect(resultJson).toEqual(
              expect.objectContaining({
                hashMatches: true,
                replayedObjectCount: 1,
                transcriptTextPrinted: false,
              })
            );

            const output = yield* loggedText();
            expect(output).not.toContain("secret-value");
          })
        )
      )
    ));

  it("keeps retention delete in dry-run mode until confirmed", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        withRawArchiveKeyEnv(
          Encoding.encodeBase64(new Uint8Array(32).fill(11)),
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const { dataRoot } = yield* seedAiMetricsData(tmpDir);
            yield* writeText(path.join(dataRoot, "reports/weekly.md"), "# report\n");

            yield* runAiMetricsCommand([
              "retention",
              "delete",
              "--data-root",
              dataRoot,
              "--before",
              `${farFutureUntilEpochMs}`,
              "--json",
            ]);

            const resultJson = yield* decodeUnknownJson(yield* lastLoggedLine());
            expect(resultJson).toEqual(
              expect.objectContaining({
                dryRun: true,
                mode: "delete",
              })
            );
          })
        )
      )
    ));

  it("enforces preventive Parquet snapshot retention only after confirmation", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        withRawArchiveKeyEnv(
          Encoding.encodeBase64(new Uint8Array(32).fill(12)),
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const fs = yield* FileSystem.FileSystem;
            const { dataRoot } = yield* seedAiMetricsData(tmpDir);
            const parquetRoot = path.join(dataRoot, "derived/parquet");
            yield* writeText(path.join(parquetRoot, "latest/ai_metrics_turns.parquet"), "latest\n");

            yield* runAiMetricsCommand([
              "retention",
              "enforce",
              "--data-root",
              dataRoot,
              "--max-snapshot-exports",
              "0",
              "--json",
            ]);

            const dryRunJson = yield* decodeUnknownJson(yield* lastLoggedLine());
            expect(dryRunJson).toEqual(
              expect.objectContaining({
                deletedDerivedExportCount: 1,
                dryRun: true,
              })
            );
            expect(yield* fs.exists(path.join(parquetRoot, "latest"))).toBe(true);
            expect(
              (yield* fs.readDirectory(parquetRoot)).filter((entry) => entry.startsWith("forwarder-"))
            ).toHaveLength(1);

            yield* runAiMetricsCommand([
              "retention",
              "enforce",
              "--data-root",
              dataRoot,
              "--max-snapshot-exports",
              "0",
              "--confirm",
              "p7-retention-window",
              "--json",
            ]);

            const appliedJson = yield* decodeUnknownJson(yield* lastLoggedLine());
            expect(appliedJson).toEqual(
              expect.objectContaining({
                deletedDerivedExportCount: 1,
                dryRun: false,
              })
            );
            expect(yield* fs.exists(path.join(parquetRoot, "latest"))).toBe(true);
            expect((yield* fs.readDirectory(parquetRoot)).filter((entry) => entry.startsWith("forwarder-"))).toEqual(
              []
            );
          })
        )
      )
    ));

  it("rejects invalid retention confirmations and unbounded confirmed windows", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        withRawArchiveKeyEnv(
          Encoding.encodeBase64(new Uint8Array(32).fill(14)),
          Effect.gen(function* () {
            const { dataRoot } = yield* seedAiMetricsData(tmpDir);

            const deleteOutput = yield* expectAiMetricsCommandFailure([
              "retention",
              "delete",
              "--data-root",
              dataRoot,
              "--before",
              `${farFutureUntilEpochMs}`,
              "--confirm",
              "wrong-token",
              "--json",
            ]);
            expect(deleteOutput).toContain('AI metrics retention confirmation must be "p7-retention-window".');

            const compactOutput = yield* expectAiMetricsCommandFailure([
              "retention",
              "compact",
              "--data-root",
              dataRoot,
              "--since",
              "2026-05-01T00:00:00Z",
              "--confirm",
              "p7-retention-window",
              "--json",
            ]);
            expect(compactOutput).toContain(
              "AI metrics retention writes require --before or a bounded --since/--until window."
            );
          })
        )
      )
    ));

  it("runs confirmed retention compact and preserves raw archive objects", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        withRawArchiveKeyEnv(
          Encoding.encodeBase64(new Uint8Array(32).fill(15)),
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const fs = yield* FileSystem.FileSystem;
            const { dataRoot } = yield* seedAiMetricsData(tmpDir);
            yield* writeText(path.join(dataRoot, "reports/weekly.md"), "# report\n");

            yield* runAiMetricsCommand([
              "retention",
              "compact",
              "--data-root",
              dataRoot,
              "--before",
              `${farFutureUntilEpochMs}`,
              "--confirm",
              "p7-retention-window",
              "--json",
            ]);

            const resultJson = yield* decodeUnknownJson(yield* lastLoggedLine());
            expect(resultJson).toEqual(
              expect.objectContaining({
                dryRun: false,
                mode: "compact",
              })
            );
            expect(yield* fs.exists(path.join(dataRoot, "reports/weekly.md"))).toBe(false);
            expect(yield* fs.readDirectory(path.join(dataRoot, "raw/codex"))).toHaveLength(1);
          })
        )
      )
    ));

  it("runs confirmed retention delete with an explicit bounded window", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        withRawArchiveKeyEnv(
          Encoding.encodeBase64(new Uint8Array(32).fill(16)),
          Effect.gen(function* () {
            const path = yield* Path.Path;
            const fs = yield* FileSystem.FileSystem;
            const { dataRoot } = yield* seedAiMetricsData(tmpDir);
            yield* writeText(path.join(dataRoot, "reports/weekly.md"), "# report\n");

            yield* runAiMetricsCommand([
              "retention",
              "delete",
              "--data-root",
              dataRoot,
              "--since",
              "2026-05-01T00:00:00Z",
              "--until",
              `${farFutureUntilEpochMs}`,
              "--confirm",
              "p7-retention-window",
              "--json",
            ]);

            const resultJson = yield* decodeUnknownJson(yield* lastLoggedLine());
            expect(resultJson).toEqual(
              expect.objectContaining({
                dryRun: false,
                mode: "delete",
              })
            );
            expect(yield* fs.exists(path.join(dataRoot, "reports/weekly.md"))).toBe(false);
            expect(yield* fs.readDirectory(path.join(dataRoot, "raw/codex"))).toEqual([]);
          })
        )
      )
    ));
});
