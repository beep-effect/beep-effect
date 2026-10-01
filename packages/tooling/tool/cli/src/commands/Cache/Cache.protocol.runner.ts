/**
 * Owned native signed-cache runner with private loopback and nested readers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CacheClientPin } from "@beep/repo-configs/cache";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import { Crypto, Duration, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { writeContainedFileString } from "../../internal/cli/FsGuards.ts";
import { OutputBound, runCapturedStreams } from "../../internal/process/index.ts";
import { AdmissionRequest } from "../../internal/repo-run/QualityScheduler.schemas.ts";
import { noAdmissionOriginGate, withQualityAdmission } from "../../internal/repo-run/QualityScheduler.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import {
  decodeCacheExperimentText,
  hashCacheExperimentExecutable,
  readCacheExperimentBytes,
} from "./Cache.evidence.ts";
import { CacheFixtureCredentials, CacheFixtureScenario } from "./Cache.protocol.fixture.schemas.ts";
import { makeCacheProtocolFixture } from "./Cache.protocol.fixture.ts";
import {
  CacheProtocolExecution,
  CacheProtocolReadFailure,
  CacheProtocolRequest,
} from "./Cache.protocol.runner.schemas.ts";
import { CacheProtocolObservation } from "./Cache.protocol.schemas.ts";
import { validateCacheProtocolExecution } from "./Cache.protocol.ts";
import { CacheCommandError } from "./Cache.schemas.ts";

const cases = LiteralKit([
  "producer",
  "replay",
  "missing-tag",
  "invalid-tag",
  "corrupt-body",
  "wrong-key",
  "truncated-body",
  "unavailable",
  "throttled",
]);
const extraCase = S.is(CacheProtocolReadFailure.fields.case);
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const bound = OutputBound.make({ maxChars: 64 * 1024, truncatedNotice: "capture exceeded bound" });
const systemMounts = [
  "--die-with-parent",
  "--new-session",
  "--ro-bind",
  "/usr",
  "/usr",
  "--symlink",
  "usr/lib",
  "/lib",
  "--symlink",
  "usr/lib",
  "/lib64",
  "--symlink",
  "usr/bin",
  "/bin",
  "--proc",
  "/proc",
  "--dev",
  "/dev",
  "--tmpfs",
  "/tmp",
];
// External Turbo summary boundary: select evidence, never trust an asserted hit.
const NativeSummary = S.Struct({
  turboVersion: S.NonEmptyString,
  tasks: S.Array(
    S.Struct({
      taskId: S.NonEmptyString,
      hash: S.NonEmptyString,
      cache: S.Struct({ status: S.Literals(["HIT", "MISS"]), source: S.OptionFromOptionalKey(S.String) }),
      execution: S.Struct({ exitCode: S.Int }),
    })
  ),
});

const verifyPrivateNetwork = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const interfaces = A.filter(
    A.drop(Str.split(yield* fs.readFileString("/proc/net/dev"), "\n"), 2),
    (line) => Str.trim(line) !== ""
  );
  if (
    interfaces.length !== 1 ||
    !A.every(interfaces, (line) => Str.trim(O.getOrElse(A.head(Str.split(line, ":")), () => "")) === "lo")
  )
    return yield* CacheCommandError.new("Protocol worker requires a private loopback-only network namespace.");
});

const scanCaptures = Effect.fn("CacheProtocol.scanCaptures")(function* (
  directory: string,
  secrets: ReadonlyArray<string>,
  streams: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const safe = (text: string) => !A.some(secrets, (secret) => Str.includes(secret)(text));
  if (!A.every(streams, safe))
    return yield* CacheCommandError.new("Protocol capture contains synthetic credential material.");
  let pending = [""];
  let count = 0;
  let bytes = 0;
  while (pending.length > 0) {
    const directoryName = O.getOrThrow(A.head(pending));
    pending = A.drop(pending, 1);
    for (const name of yield* fs.readDirectory(path.join(directory, directoryName))) {
      count += 1;
      if (count > 64) return yield* CacheCommandError.new("Protocol fixture file count exceeded its bound.");
      const relative = path.join(directoryName, name);
      const info = yield* fs.stat(path.join(directory, relative));
      if (info.type === "Directory") pending.push(relative);
      else {
        const content = yield* readCacheExperimentBytes(directory, relative, 1024 * 1024);
        bytes += content.byteLength;
        if (bytes > 4 * 1024 * 1024)
          return yield* CacheCommandError.new("Protocol fixture bytes exceeded their bound.");
        if (!safe(new TextDecoder().decode(content)))
          return yield* CacheCommandError.new("Protocol artifact contains synthetic credential material.");
      }
    }
  }
});

/**
 * Execute the worker inside the supervisor's isolated network and scoped directory.
 *
 * **Details**
 * This internal boundary generates secrets in memory and returns observations
 * only. It refuses a network with interfaces other than loopback. Callers must
 * use the admitted supervisor to establish the mount and process boundaries.
 *
 * **Example** (Reference the isolated worker)
 * ```ts
 * import { runCacheProtocolWorker } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof runCacheProtocolWorker === "function")
 * ```
 *
 * @internal
 * @category fixtures
 * @since 0.0.0
 */
export const runCacheProtocolWorker = Effect.fn("CacheProtocol.worker")(
  function* (directory: string, request: CacheProtocolRequest) {
    if ((request.channel === "canary") !== Str.includes("-canary.")(request.client.version))
      return yield* CacheCommandError.new("Protocol version does not match its selected client channel.");
    yield* verifyPrivateNetwork;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const crypto = yield* Crypto.Crypto;
    const executable = yield* fs.realPath(request.executable);
    if ((yield* hashCacheExperimentExecutable(executable)) !== request.client.sha256)
      return yield* CacheCommandError.new("Protocol native binary differs from the requested pin.");
    const bun = yield* fs.realPath(process.execPath);
    const bunSha256 = yield* hashCacheExperimentExecutable(bun);
    const writer = Hex.encode(yield* crypto.randomBytes(32));
    const reader = Hex.encode(yield* crypto.randomBytes(32));
    const signing = Hex.encode(yield* crypto.randomBytes(32));
    const wrongSigning = Hex.encode(yield* crypto.randomBytes(32));
    const secrets = [writer, reader, signing, wrongSigning];
    const fixture = yield* makeCacheProtocolFixture(
      CacheFixtureCredentials.make({
        namespace: request.client.namespace,
        writer: Redacted.make(writer),
        reader: Redacted.make(reader),
      })
    );
    const runs: Array<CacheProtocolObservation["runs"][number]> = [];
    const failures: Array<CacheProtocolReadFailure> = [];
    for (const name of cases.literals) {
      const fault = name === "producer" || name === "replay" || name === "wrong-key" ? "none" : name;
      yield* fixture.setScenario(CacheFixtureScenario.make({ id: name, fault }));
      const work = path.join(directory, name);
      yield* fs.makeDirectory(path.join(work, ".turbo"), { recursive: true });
      yield* writeContainedFileString(
        work,
        ".turbo/config.json",
        yield* S.encodeEffect(S.fromJsonString(S.Json))({ teamId: request.client.namespace })
      );
      yield* writeContainedFileString(
        work,
        "package.json",
        '{"name":"qualification-owned-signed-fixture","private":true,"packageManager":"bun@1.4.2","scripts":{"build":"bun build.ts"}}'
      );
      yield* writeContainedFileString(
        work,
        "turbo.json",
        '{"remoteCache":{"signature":true},"tasks":{"build":{"outputs":["dist/**"],"passThroughEnv":["PROBE_DENY_EXECUTION"]}}}'
      );
      yield* writeContainedFileString(
        work,
        "build.ts",
        'if (Bun.env.PROBE_DENY_EXECUTION === "1") process.exit(42);\nawait Bun.write("dist/result.txt", "owned-signed-fixture-output\\n");\n'
      );
      const captured = yield* runCapturedStreams({
        command: "/usr/bin/bwrap",
        args: [
          "--unshare-user",
          "--unshare-pid",
          "--unshare-ipc",
          "--unshare-uts",
          ...systemMounts,
          "--dir",
          "/tools",
          "--ro-bind",
          executable,
          "/tools/turbo",
          "--ro-bind",
          bun,
          "/tools/bun",
          "--bind",
          work,
          "/work",
          "--chdir",
          "/work",
          "/tools/turbo",
          "run",
          "build",
          "--cache=remote:rw",
          "--env-mode=strict",
          "--no-daemon",
          "--summarize",
        ],
        cwd: directory,
        extendEnv: false,
        env: {
          PATH: "/tools:/usr/bin:/bin",
          HOME: "/tmp",
          CI: "1",
          TURBO_TELEMETRY_DISABLED: "1",
          TURBO_API: fixture.url,
          TURBO_TOKEN: name === "producer" ? writer : reader,
          TURBO_REMOTE_CACHE_SIGNATURE_KEY: name === "wrong-key" ? wrongSigning : signing,
          PROBE_DENY_EXECUTION: name === "producer" ? "0" : "1",
        },
        bound,
      }).pipe(Effect.timeout(Duration.seconds(120)));
      if (captured.truncated) return yield* CacheCommandError.new("Protocol native capture exceeded its bound.");
      yield* scanCaptures(work, secrets, [captured.stdout, captured.stderr]);
      const names = yield* fs.readDirectory(path.join(work, ".turbo/runs"));
      if (names.length !== 1) return yield* CacheCommandError.new("Protocol run requires exactly one native summary.");
      const bytes = yield* readCacheExperimentBytes(work, path.join(".turbo/runs", O.getOrThrow(A.head(names))));
      const summary = yield* decodeCacheExperimentText(bytes).pipe(
        Effect.flatMap(JsonStringCodec(NativeSummary).decode)
      );
      const task = yield* A.head(summary.tasks).pipe(
        Effect.fromOption(() => CacheCommandError.new("Protocol task did not execute."))
      );
      if (
        summary.tasks.length !== 1 ||
        task.taskId !== "build" ||
        summary.turboVersion !== request.client.version ||
        task.execution.exitCode !== captured.exitCode
      )
        return yield* CacheCommandError.new("Protocol native summary disagrees with its process or client pin.");
      const outputExists = yield* fs.exists(path.join(work, "dist/result.txt"));
      const outputRootExists = yield* fs.exists(path.join(work, "dist"));
      const positive = name === "producer" || name === "replay";
      if (
        (positive && (captured.exitCode !== 0 || !outputExists)) ||
        (!positive && (captured.exitCode !== 42 || outputRootExists))
      )
        return yield* CacheCommandError.new("Protocol outcome omitted output or allowed rejected fallback execution.");
      if (
        task.cache.status !== (name === "replay" ? "HIT" : "MISS") ||
        (name === "replay" && !O.contains("REMOTE")(task.cache.source))
      )
        return yield* CacheCommandError.new(
          "Protocol replay requires an actual remote hit; other cases require misses."
        );
      if (
        positive &&
        !S.toEquivalence(S.Array(S.String))(yield* fs.readDirectory(path.join(work, "dist")), ["result.txt"])
      )
        return yield* CacheCommandError.new("Protocol fixture produced an undeclared output.");
      const summaryDigest = yield* hashBytes(bytes);
      if (extraCase(name))
        failures.push(
          CacheProtocolReadFailure.make({
            case: name,
            taskHash: task.hash,
            summary: summaryDigest,
            exitCode: 42,
            restoredOutputs: 0,
          })
        );
      else {
        const output = positive ? yield* readCacheExperimentBytes(work, "dist/result.txt", 4096) : new Uint8Array();
        runs.push({
          case: name,
          taskHash: task.hash,
          client: request.client,
          summary: summaryDigest,
          outcome: positive
            ? {
                _tag: name === "producer" ? "Produced" : "Replayed",
                output: { sha256: yield* hashBytes(output), bytes: S.Natural.make(output.byteLength) },
              }
            : { _tag: "Rejected", exitCode: captured.exitCode, restoredOutputs: S.Natural.make(0) },
        });
      }
    }
    const events = yield* fixture.events;
    const exchanges = A.filter(
      events,
      (event) =>
        !extraCase(event.scenario.id) &&
        event.status === 200 &&
        O.isSome(event.artifact) &&
        (event.operation === "put" || event.operation === "get")
    );
    const observation = yield* S.decodeUnknownEffect(CacheProtocolObservation)({
      schemaVersion: "cache-protocol-observation/v1",
      authority: "synthetic-native-observation-only",
      channel: request.channel,
      client: request.client,
      runs,
      exchanges: A.map(exchanges, (event) => ({
        case: event.scenario.id,
        requestId: `wire-${event.sequence}`,
        taskHash: O.getOrThrow(event.artifact),
        method: event.operation === "put" ? "PUT" : "GET",
        role: event.role,
        status: event.status,
        tag: event.tagPresent ? "present" : "absent",
        artifact: { sha256: O.getOrThrow(event.digest), bytes: event.bytes },
      })),
    });
    if (
      (yield* hashCacheExperimentExecutable(executable)) !== request.client.sha256 ||
      (yield* hashCacheExperimentExecutable(bun)) !== bunSha256
    )
      return yield* CacheCommandError.new("Protocol producer or executable identity changed during the run.");
    return yield* validateCacheProtocolExecution(
      CacheProtocolExecution.make({ observation, failures, events, bunSha256 })
    );
  },
  Effect.scoped,
  CacheCommandError.mapError("Isolated native protocol execution failed.")
);

/**
 * Admit and supervise a complete signed synthetic run in a private network.
 *
 * **Details**
 * Temporary client roots are scope-owned and removed after the bounded report
 * is decoded. No operator credentials or external network are inherited. The
 * six integrity observations and three transport failures cannot qualify a task.
 *
 * **Example** (Reference the admitted runner)
 * ```ts
 * import { runCacheProtocolExperiment } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof runCacheProtocolExperiment === "function")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const runCacheProtocolExperiment = Effect.fn("CacheProtocol.experiment")(function* (
  root: string,
  request: CacheProtocolRequest
) {
  return yield* withQualityAdmission(
    AdmissionRequest.make({
      kind: "review-fix",
      weightTokens: 1,
      priority: "verify",
      originKey: "",
      checkoutRoot: root,
      branch: "",
      command: "bun run beep cache protocol-run",
    }),
    noAdmissionOriginGate,
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        if (process.platform !== "linux" || process.arch !== "x64")
          return yield* CacheCommandError.new("Protocol sandbox requires Linux x64.");
        const parent = path.join(root, ".beep/cache-protocol");
        yield* fs.makeDirectory(parent, { recursive: true });
        const directory = yield* fs.makeTempDirectoryScoped({ directory: parent, prefix: "run-" });
        const executable = yield* fs.realPath(request.executable);
        const bun = yield* fs.realPath(process.execPath);
        const resolved = CacheProtocolRequest.make({ ...request, executable });
        const encoded = yield* JsonStringCodec(CacheProtocolRequest).encode(resolved);
        yield* writeContainedFileString(directory, "request.json", encoded);
        const module = yield* S.encodeEffect(S.fromJsonString(S.Json))(
          path.join(root, "packages/tooling/tool/cli/src/commands/Cache/Cache.protocol.runner.ts")
        );
        const worker = `import { NodeCrypto, NodeServices } from "@effect/platform-node";\nimport { BunRuntime } from "@effect/platform-bun";\nimport { Effect, FileSystem, Layer } from "effect";\nimport * as S from "effect/Schema";\nimport { runCacheProtocolWorker } from ${module};\nimport { CacheProtocolRequest, CacheProtocolExecution } from ${yield* S.encodeEffect(S.fromJsonString(S.Json))(path.join(root, "packages/tooling/tool/cli/src/commands/Cache/Cache.protocol.runner.schemas.ts"))};\nBunRuntime.runMain(Effect.gen(function*(){ const fs=yield*FileSystem.FileSystem; const request=yield*S.decodeUnknownEffect(S.fromJsonString(CacheProtocolRequest))(yield*fs.readFileString("request.json")); const report=yield*runCacheProtocolWorker(process.cwd(),request); yield*fs.writeFileString("report.json",yield*S.encodeEffect(S.fromJsonString(CacheProtocolExecution))(report)); }).pipe(Effect.provide(Layer.mergeAll(NodeServices.layer,NodeCrypto.layer))));\n`;
        yield* writeContainedFileString(directory, "worker.ts", worker);
        const captured = yield* runCapturedStreams({
          command: "/usr/bin/bwrap",
          args: [
            "--unshare-all",
            ...systemMounts,
            "--ro-bind",
            root,
            root,
            "--ro-bind",
            bun,
            bun,
            "--ro-bind",
            executable,
            executable,
            "--bind",
            directory,
            directory,
            "--chdir",
            directory,
            bun,
            "worker.ts",
          ],
          cwd: root,
          extendEnv: false,
          env: { PATH: "/usr/bin", HOME: "/tmp", CI: "1", NO_COLOR: "1" },
          bound,
        }).pipe(Effect.timeout(Duration.minutes(15)));
        if (captured.exitCode !== 0 || captured.truncated)
          return yield* CacheCommandError.new("Protocol supervisor failed or exceeded its capture bound.");
        const report = yield* readCacheExperimentBytes(directory, "report.json", 256 * 1024).pipe(
          Effect.flatMap(decodeCacheExperimentText),
          Effect.flatMap(JsonStringCodec(CacheProtocolExecution).decode)
        );
        if (
          !S.toEquivalence(CacheClientPin)(report.observation.client, request.client) ||
          report.observation.channel !== request.channel ||
          report.bunSha256 !== (yield* hashCacheExperimentExecutable(bun))
        )
          return yield* CacheCommandError.new("Protocol worker report differs from the supervised identities.");
        return yield* validateCacheProtocolExecution(report);
      })
    )
  );
}, CacheCommandError.mapError("Protocol experiment admission or supervision failed."));

/**
 * Refuse network interfaces other than the private fixture loopback.
 *
 * **Example** (Reference the namespace guard)
 * ```ts
 * import { assertCachePrivateNetwork } from "@beep/repo-cli/commands/Cache"
 * import { Effect } from "effect"
 * console.assert(Effect.isEffect(assertCachePrivateNetwork))
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const assertCachePrivateNetwork = verifyPrivateNetwork;
