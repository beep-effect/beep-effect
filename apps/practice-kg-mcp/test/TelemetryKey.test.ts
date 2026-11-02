import * as NodeURL from "node:url";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { makeStrictSpool, StrictSpoolKey, StrictSpoolOptions } from "@beep/observability/strict";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import { HostProcessPlatform } from "@beep/utils/HostProcess";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as OtlpExporter from "effect/observability/OtlpExporter";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { assertBundleGraph, forbiddenBundleInputs } from "../src/BundleGraph.ts";
import { PackageFailure, TelemetryKeyFailure } from "../src/PracticeKgMcp.errors.ts";
import { layerPracticeKgTelemetrySpooled } from "../src/runtime/Telemetry.ts";
import {
  PracticeKgTelemetrySelfCheckReport,
  printPracticeKgTelemetrySelfCheck,
  runPracticeKgTelemetrySelfCheck,
} from "../src/runtime/TelemetryCheck.ts";
import {
  DpapiPort,
  layerDpapiPowerShell,
  layerPracticeKgSpoolKey,
  PracticeKgTelemetryKeyFile,
  resolvePracticeKgTelemetryDir,
  roundTripDpapi,
} from "../src/runtime/TelemetryKey.ts";
import type { StrictKeyProtection } from "@beep/observability/strict";

const telemetryDir = "/home/attorney/AppData/Local/beep/practice-kg/telemetry";
const keyPath = `${telemetryDir}/key.1.dpapi`;
const canary = A.join(["canary", "Telemetry", "Key", "8812"], "");
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const decodeKeyFile = S.decodeUnknownEffect(S.fromJsonString(PracticeKgTelemetryKeyFile));
const decodeTelemetryReport = S.decodeUnknownEffect(S.fromJsonString(PracticeKgTelemetrySelfCheckReport));

const xor = (bytes: Uint8Array): Uint8Array => Uint8Array.from(bytes, (byte) => byte ^ 0x5a);

// A DPAPI stand-in: a reversible transform that is never the identity.
const fakeDpapi = (
  protection: StrictKeyProtection,
  options: { readonly failUnwrap?: boolean } = {}
): Layer.Layer<DpapiPort> =>
  Layer.succeed(
    DpapiPort,
    DpapiPort.of({
      protection,
      protect: Effect.fn("FakeDpapi.protect")((plaintext: Uint8Array) => Effect.succeed(xor(plaintext))),
      unprotect: Effect.fn("FakeDpapi.unprotect")(function* (wrapped: Uint8Array) {
        if (options.failUnwrap === true) {
          return yield* TelemetryKeyFailure.make({ message: "DPAPI could not unwrap the key." });
        }
        return xor(wrapped);
      }),
    })
  );

// A DPAPI stand-in whose first two wraps wait for each other, so two hosts
// both find no key and both race to publish epoch 1.
const barrierDpapi = Effect.gen(function* () {
  const arrived = yield* Ref.make(0);
  const both = yield* Deferred.make<void>();
  return Layer.succeed(
    DpapiPort,
    DpapiPort.of({
      protection: "dpapi-ffi",
      protect: Effect.fn("BarrierDpapi.protect")(function* (plaintext: Uint8Array) {
        if ((yield* Ref.updateAndGet(arrived, (count) => count + 1)) >= 2) {
          yield* Deferred.succeed(both, undefined);
        }
        yield* Deferred.await(both);
        return xor(plaintext);
      }),
      unprotect: Effect.fn("BarrierDpapi.unprotect")((wrapped: Uint8Array) => Effect.succeed(xor(wrapped))),
    })
  );
});

const volume = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

const loadKey = (port: Layer.Layer<DpapiPort>) =>
  Effect.service(StrictSpoolKey).pipe(
    provideScopedLayer(layerPracticeKgSpoolKey(telemetryDir).pipe(Layer.provide(port)))
  );

const materialOf = (key: StrictSpoolKey["Service"]): string => key.material.pipe(Redacted.value, Base64.encode);

describe("layerPracticeKgSpoolKey", () => {
  it.layer(volume, { timeout: "10 seconds" })((it) => {
    it.effect("creates a wrapped key owner-only on first use and unwraps the same key afterwards", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const first = yield* loadKey(fakeDpapi("dpapi-ffi"));
        const second = yield* loadKey(fakeDpapi("dpapi-ffi"));
        expect([first.epoch, first.protection]).toEqual(["1", "dpapi-ffi"]);
        expect(materialOf(second)).toBe(materialOf(first));
        expect(second.epoch).toBe("1");

        const file = yield* fs.readFileString(keyPath).pipe(Effect.flatMap(decodeKeyFile));
        expect(file.protection).toBe("dpapi-ffi");
        expect(file.wrappedBase64).not.toBe(materialOf(first));
        expect(Str.includes(materialOf(first))(yield* fs.readFileString(keyPath))).toBe(false);
        expect(((yield* fs.stat(keyPath)).mode & 0o777).toString(8)).toBe("600");
        expect(((yield* fs.stat(telemetryDir)).mode & 0o777).toString(8)).toBe("700");
        expect(yield* fs.readDirectory(telemetryDir)).toEqual(["key.1.dpapi"]);
      })
    );
  });

  it.layer(volume, { timeout: "10 seconds" })((it) => {
    it.effect("rotates to the next epoch when the stored key no longer unwraps", () =>
      Effect.gen(function* () {
        const first = yield* loadKey(fakeDpapi("dpapi-ffi"));
        const rotated = yield* loadKey(fakeDpapi("dpapi-powershell", { failUnwrap: true }));
        expect([rotated.epoch, rotated.protection]).toEqual(["2", "dpapi-powershell"]);
        expect(materialOf(rotated)).not.toBe(materialOf(first));
        expect(materialOf(yield* loadKey(fakeDpapi("dpapi-powershell")))).toBe(materialOf(rotated));
        // The old key file is never overwritten; the new epoch is a new file.
        const fs = yield* FileSystem.FileSystem;
        expect(A.sort(yield* fs.readDirectory(telemetryDir), Order.String)).toEqual(["key.1.dpapi", "key.2.dpapi"]);
      })
    );
  });

  it.layer(volume, { timeout: "10 seconds" })((it) => {
    it.effect("moves past a key file that does not decode without overwriting it", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(telemetryDir, { recursive: true });
        yield* fs.writeFileString(keyPath, "{broken");
        const key = yield* loadKey(fakeDpapi("dpapi-ffi"));
        expect(key.epoch).toBe("2");
        expect(yield* fs.readFileString(keyPath)).toBe("{broken");
        const next = yield* fs.readFileString(`${telemetryDir}/key.2.dpapi`).pipe(Effect.flatMap(decodeKeyFile));
        expect(next.epoch).toBe(2);
      })
    );
  });

  it.layer(volume, { timeout: "10 seconds" })((it) => {
    it.effect("gives two hosts that create the key at once the same key and epoch", () =>
      Effect.gen(function* () {
        const port = yield* barrierDpapi;
        const [left, right] = yield* Effect.all([loadKey(port), loadKey(port)], { concurrency: "unbounded" });
        expect([left.epoch, right.epoch]).toEqual(["1", "1"]);
        expect(materialOf(right)).toBe(materialOf(left));
        const fs = yield* FileSystem.FileSystem;
        expect(yield* fs.readDirectory(telemetryDir)).toEqual(["key.1.dpapi"]);
        expect(materialOf(yield* loadKey(fakeDpapi("dpapi-ffi")))).toBe(materialOf(left));
      })
    );
  });
});

const powerShellHandle = (stdout: string, code: number) =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(code)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    unref: Effect.succeed(Effect.void),
    stdin: Sink.drain,
    stdout: Stream.make(encoder.encode(stdout)),
    stderr: Stream.empty,
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  });

// Fake PowerShell: reads Base64 from stdin, applies the stand-in transform and
// writes Base64 back, recording every argv it was started with.
const fakePowerShell = (argvSeen: Array<ReadonlyArray<string>>, code = 0) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) =>
      Effect.gen(function* () {
        if (!ChildProcess.isStandardCommand(command)) {
          return yield* Effect.die("Expected a standard PowerShell command");
        }
        // A redacted word still reaches the real process command line, so record its value.
        argvSeen.push([
          command.command,
          ...A.map(command.args, (word) => (Redacted.isRedacted(word) ? Redacted.value(word) : word)),
        ]);
        const stdin = command.options.stdin;
        if (!P.isObject(stdin) || !P.hasProperty(stdin, "stream") || !Stream.isStream(stdin.stream)) {
          return yield* Effect.die("Expected the key on a stdin stream");
        }
        const input = yield* stdin.stream.pipe(Stream.orDie, Stream.decodeText(), Stream.mkString);
        const bytes = Result.getOrThrow(Base64.decode(Str.trim(input)));
        return powerShellHandle(Base64.encode(xor(bytes)), code);
      })
    )
  );

describe("layerDpapiPowerShell", () => {
  const argvSeen: Array<ReadonlyArray<string>> = [];

  it.layer(layerDpapiPowerShell.pipe(Layer.provide(fakePowerShell(argvSeen))), { timeout: "10 seconds" })((it) => {
    it.effect("passes the key over stdin and never in argv, and round-trips it", () =>
      Effect.gen(function* () {
        const port = yield* DpapiPort;
        const secret = encoder.encode(canary);
        const wrapped = yield* port.protect(secret);
        expect(decoder.decode(yield* port.unprotect(wrapped))).toBe(canary);
        expect(port.protection).toBe("dpapi-powershell");
        expect(yield* roundTripDpapi(port)).toBe("dpapi-powershell");
        expect(A.length(argvSeen)).toBe(4);
        for (const argv of argvSeen) {
          expect(argv[0]).toBe("powershell.exe");
          expect(Str.includes(canary)(A.join(argv, " "))).toBe(false);
          expect(Str.includes(Base64.encode(secret))(A.join(argv, " "))).toBe(false);
        }
      })
    );
  });

  it.layer(layerDpapiPowerShell.pipe(Layer.provide(fakePowerShell([], 1))), { timeout: "10 seconds" })((it) => {
    it.effect("fails with a typed error when PowerShell exits non-zero", () =>
      Effect.gen(function* () {
        const port = yield* DpapiPort;
        const error = yield* Effect.flip(port.protect(encoder.encode(canary)));
        expect(error).toBeInstanceOf(TelemetryKeyFailure);
      })
    );
  });
});

describe("roundTripDpapi", () => {
  it.effect("refuses a DPAPI path whose wrapped bytes equal the plaintext", () =>
    Effect.gen(function* () {
      const identity = DpapiPort.of({ protection: "dpapi-ffi", protect: Effect.succeed, unprotect: Effect.succeed });
      expect(yield* Effect.flip(roundTripDpapi(identity))).toBeInstanceOf(TelemetryKeyFailure);
      expect(yield* roundTripDpapi(DpapiPort.of({ ...identity, protection: "dev-file" }))).toBe("dev-file");
    })
  );
});

const withEnv = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

describe("resolvePracticeKgTelemetryDir", () => {
  it.layer(Path.layer, { timeout: "10 seconds" })((it) => {
    it.effect("resolves the documented directory per platform, with the override first", () =>
      Effect.gen(function* () {
        const resolve = (platform: string, env: Record<string, string>) =>
          resolvePracticeKgTelemetryDir(platform).pipe(withEnv(env), Effect.map(O.getOrUndefined));
        expect(yield* resolve("win32", { LOCALAPPDATA: "C:/Users/a/AppData/Local" })).toBe(
          "C:/Users/a/AppData/Local/beep/practice-kg/telemetry"
        );
        expect(yield* resolve("linux", { XDG_STATE_HOME: "/state", HOME: "/home/a" })).toBe(
          "/state/beep/practice-kg/telemetry"
        );
        expect(yield* resolve("linux", { HOME: "/home/a" })).toBe("/home/a/.local/state/beep/practice-kg/telemetry");
        expect(yield* resolve("win32", { HOME: "/home/a" })).toBeUndefined();
        expect(yield* resolve("win32", { PRACTICE_KG_TELEMETRY_DIR: "/override", LOCALAPPDATA: "C:/x" })).toBe(
          "/override"
        );
      })
    );
  });
});

describe("practice KG telemetry self-check", () => {
  it.layer(Layer.mergeAll(Path.layer, fakePowerShell([])), { timeout: "10 seconds" })((it) => {
    it.effect("prints ok, the key path and the directory, and never the secret", () =>
      Effect.gen(function* () {
        yield* printPracticeKgTelemetrySelfCheck(runPracticeKgTelemetrySelfCheck());
        const lines = yield* TestConsole.logLines;
        expect(A.length(lines)).toBe(1);
        const report = yield* decodeTelemetryReport(lines[0]);
        expect(report).toEqual(
          PracticeKgTelemetrySelfCheckReport.make({
            ok: true,
            keyPath: "dev-file",
            telemetryDir: "/home/a/.local/state/beep/practice-kg/telemetry",
          })
        );
      }).pipe(
        Effect.provideService(HostProcessPlatform, "linux"),
        withEnv({ HOME: "/home/a" }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );
  });
});

const spoolOptions = StrictSpoolOptions.make({ directory: `${telemetryDir}/spool`, tier: "shape-only" });

const spooledKey = layerPracticeKgSpoolKey(telemetryDir).pipe(Layer.provide(fakeDpapi("dpapi-ffi")));

// Logs the canary inside a tool span and names a span after it, under the
// spooled telemetry. The layer's scope closes before this returns, which runs
// the final export into the spool.
const exportCanaryThroughSpool = Effect.gen(function* () {
  yield* Effect.logError(canary).pipe(Effect.withSpan("PracticeKgTools.kg_find"));
  yield* Effect.void.pipe(Effect.withSpan(`PracticeKgTools.${canary}`));
  yield* (yield* OtlpExporter.Flusher).flush;
}).pipe(provideScopedLayer(layerPracticeKgTelemetrySpooled(spoolOptions).pipe(Layer.provide(spooledKey))));

// Reopens the spool with the stored key, as a later process would.
const replaySpool = Effect.flatMap(makeStrictSpool(spoolOptions), (spool) => spool.replay).pipe(
  provideScopedLayer(spooledKey)
);

describe("layerPracticeKgTelemetrySpooled", () => {
  it.layer(volume, { timeout: "10 seconds" })((it) => {
    it.effect("seals gated exports under the key epoch, with no canary at rest or on replay", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* exportCanaryThroughSpool;

        const segments = yield* fs.readDirectory(spoolOptions.directory);
        expect(A.length(segments)).toBeGreaterThanOrEqual(3);
        for (const segment of segments) {
          const atRest = yield* fs.readFileString(`${spoolOptions.directory}/${segment}`);
          expect(Str.includes(canary)(atRest)).toBe(false);
          expect(Str.includes('"keyEpoch":"1"')(atRest)).toBe(true);
        }
        const replay = yield* replaySpool;
        expect(HashMap.size(replay.refused)).toBe(0);
        expect(A.some(replay.records, (record) => Str.includes(canary)(record.body))).toBe(false);
        expect(A.some(replay.records, (record) => Str.includes('"name":"kg_find"')(record.body))).toBe(true);
        expect(A.some(replay.records, (record) => Str.includes('"stringValue":"1"')(record.body))).toBe(true);
      })
    );
  });
});

// The coverage lane runs Vitest under Node, where the root setup shims Bun's API surface but
// cannot provide the bundler, so the real-build proof runs only where Bun.build exists (`bun run test`).
const hasBunBuild = P.isFunction(Reflect.get(globalThis.Bun, "build"));

describe("bundle graph", () => {
  it("flags OpenTelemetry SDK and observability server inputs", () => {
    expect(
      forbiddenBundleInputs([
        "apps/practice-kg-mcp/src/bin.ts",
        "node_modules/@effect/opentelemetry/dist/NodeSdk.js",
        "packages/foundation/capability/observability/src/server/index.ts",
        "packages/foundation/capability/observability/src/experimental/server/OtlpPacketLab.ts",
        "node_modules/@beep/observability/experimental/server",
        "packages/foundation/capability/observability/src/strict/index.ts",
      ])
    ).toEqual([
      "node_modules/@beep/observability/experimental/server",
      "node_modules/@effect/opentelemetry/dist/NodeSdk.js",
      "packages/foundation/capability/observability/src/experimental/server/OtlpPacketLab.ts",
      "packages/foundation/capability/observability/src/server/index.ts",
    ]);
  });

  it.effect.runIf(hasBunBuild)(
    "proves the host entrypoint cannot reach the OpenTelemetry SDK or the observability server",
    () =>
      Effect.gen(function* () {
        const inputs = yield* assertBundleGraph(NodeURL.fileURLToPath(new URL("../src/bin.ts", import.meta.url)));
        expect(inputs).toBeGreaterThan(100);
        const refused = yield* Effect.flip(
          assertBundleGraph(NodeURL.fileURLToPath(new URL("./fixtures/experimental-server-entry.ts", import.meta.url)))
        );
        expect(refused).toBeInstanceOf(PackageFailure);
        expect(Str.includes("observability/src/experimental/server/")(refused.message)).toBe(true);
      }),
    { timeout: 120_000 }
  );
});
