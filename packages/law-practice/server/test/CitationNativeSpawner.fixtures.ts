/** Independent exit observations for hosted native citation qualification.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationNativeProcessRuntime } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type * as PlatformError from "effect/PlatformError";

/** Bundle the actual owned HTML entrypoint once per scope, retaining its WASM asset lookup.
 * @internal @category testing @since 0.0.0
 */
export const citationHtmlWorkerTestRuntime = Effect.fn("NativeSourceTest.htmlRuntime")(function* () {
  const context = yield* Layer.build(NodeServices.layer);
  return yield* Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "citation-html-bundle-" });
    // Keep the unchanged worker's relative WASM asset lookup inside this scope.
    const cwd = path.join(root, "src", "internal", "Citation");
    const assets = path.join(root, "assets", "citation-html");
    yield* fs.makeDirectory(cwd, { recursive: true });
    yield* fs.makeDirectory(assets, { recursive: true });
    yield* fs.copyFile(
      NodeURL.fileURLToPath(new URL("../assets/citation-html/kernel.wasm", import.meta.url)),
      path.join(assets, "kernel.wasm")
    );
    return yield* makeCitationBundledTestRuntime(
      "bun",
      NodeURL.fileURLToPath(new URL("../src/internal/Citation/HtmlWorker.entry.ts", import.meta.url)),
      cwd
    );
  }).pipe(Effect.provideContext(context));
});

/** Resolve the Bun executable the "bun" runtime leg spawns. Under the Bun test
 * runner it is the process itself; under Node (every test runs on both runtimes)
 * it is the installed `bun` on `PATH`, resolved here because worker launches
 * receive an empty environment and cannot search `PATH` themselves.
 * @internal @category testing @since 0.0.0
 */
export const citationBunTestExecutable: Effect.Effect<string, PlatformError.PlatformError, ChildProcessSpawner> =
  process.versions.bun !== undefined
    ? Effect.succeed(process.execPath)
    : Effect.gen(function* () {
        const spawner = yield* ChildProcessSpawner;
        const candidates = yield* spawner.lines(ChildProcess.make("which", ["bun"]));
        const candidate = yield* O.match(A.head(A.map(candidates, Str.trim)), {
          onNone: () => Effect.die("Citation qualification requires an installed Bun executable"),
          onSome: Effect.succeed,
        });
        const resolved = yield* spawner.string(
          ChildProcess.make(candidate, ["-p", 'process.versions.bun ? process.execPath : ""'])
        );
        const executable = Str.trim(resolved);
        if (!S.is(S.NonEmptyString)(executable))
          return yield* Effect.die("Citation qualification requires an actual installed Bun executable");
        return executable;
      });

/** Reject Bun's test-runner node shim and resolve an actual installed Node
 * executable through fixed probes. Effect owns probe processes and timeouts.
 * @internal @category testing @since 0.0.0
 */
export const citationNodeTestExecutable = Effect.gen(function* () {
  const spawner = yield* ChildProcessSpawner;
  const candidates = yield* spawner.lines(ChildProcess.make("which", ["-a", "node"]));
  const executable = yield* Effect.findFirstFilter(candidates, (candidate) =>
    spawner
      .string(
        ChildProcess.make(candidate, ["-p", 'process.versions.bun ? "" : process.execPath'], {
          env: {},
          extendEnv: false,
          stderr: "ignore",
          killSignal: "SIGKILL",
          forceKillAfter: Duration.zero,
        })
      )
      .pipe(
        Effect.timeout(Duration.seconds(5)),
        Effect.map(Str.trim),
        Effect.result,
        Effect.map(Result.flatMap(S.decodeUnknownResult(S.NonEmptyString)))
      )
  );
  return yield* O.match(executable, {
    onNone: () => Effect.die("Citation qualification requires an actual installed Node executable"),
    onSome: Effect.succeed,
  });
});

/** Bundle one trusted entrypoint per scoped installation, retaining the actual runtime's platform layers. */
const makeCitationBundledTestRuntime = Effect.fn("NativeSourceTest.bundledRuntime")(function* (
  kind: CitationNativeRuntimeKind,
  entrypoint: string,
  cwd: string
) {
  const path = yield* Path.Path;
  const executable = yield* kind === "node" ? citationNodeTestExecutable : citationBunTestExecutable;
  const workerFile = path.join(cwd, "worker.mjs");
  if (process.versions.bun !== undefined) {
    const bundle = yield* Effect.promise(() =>
      Bun.build({
        entrypoints: [entrypoint],
        target: kind,
        format: "esm",
        packages: "bundle",
        outdir: cwd,
        naming: "worker.mjs",
      })
    );
    expect(bundle.success).toBe(true);
  } else {
    const spawner = yield* ChildProcessSpawner;
    const bundler = yield* citationBunTestExecutable;
    const exitCode = yield* spawner.exitCode(
      ChildProcess.make(
        bundler,
        [
          "build",
          entrypoint,
          `--target=${kind}`,
          "--format=esm",
          "--packages=bundle",
          `--outdir=${cwd}`,
          "--entry-naming=worker.mjs",
        ],
        { stdout: "ignore", stderr: "inherit" }
      )
    );
    expect(exitCode).toBe(0);
  }
  return CitationNativeProcessRuntime.make({ kind, executable, cwd, workerFile });
});

/** Bundle a trusted test subject for the installed Node executable. The caller
 * owns the scoped output directory; actual worker launches receive empty env.
 * Bun's in-process builder and CLI use identical target, ESM and package settings.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationNodeTestRuntime = Effect.fn("NativeSourceTest.nodeRuntime")(
  (entrypoint: string, cwd: string) => makeCitationBundledTestRuntime("node", entrypoint, cwd)
);

/** Share actual regex runtime selection and once-per-installation bundling.
 * Both legs launch the unchanged isolated worker program under the same limits.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationRegexTestRuntime = Effect.fn("NativeSourceTest.regexRuntime")(
  (kind: CitationNativeRuntimeKind, cwd: string) =>
    makeCitationBundledTestRuntime(
      kind,
      NodeURL.fileURLToPath(
        kind === "node"
          ? new URL("../src/internal/Citation/RegexWorker.node.entry.ts", import.meta.url)
          : new URL("../src/internal/Citation/RegexWorker.entry.ts", import.meta.url)
      ),
      cwd
    )
);

const $I = $LawPracticeServerId.create("test/CitationNativeSpawner");
const MissingProcess = S.Struct({ code: S.tag("ESRCH") }).pipe(
  $I.annoteSchema("MissingProcess", {
    description: "Only the operating system's no-such-process result confirms an absent child PID.",
  })
);
/** @internal @category models @since 0.0.0 */
export class CitationNativeExitCounts extends S.Opaque<CitationNativeExitCounts, { readonly brand: unique symbol }>()(
  S.Struct({ spawned: S.Natural, confirmed: S.Natural }).pipe(
    $I.annoteSchema("CitationNativeExitCounts", {
      description: "Actual child births and independently confirmed PID exits for one qualification lifetime.",
    })
  )
) {}
/** Wrap the real process capability; count each child once only after both the
 * supervisor's stopped observation and an independent operating-system probe.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationObservedSpawner = Effect.fn("NativeSourceTest.makeSpawner")(function* () {
  const real = yield* ChildProcessSpawner;
  let spawned = 0;
  let confirmed = 0;
  const spawner = ChildProcessSpawner.of({
    ...real,
    spawn: Effect.fn("NativeSourceTest.spawn")((command) =>
      real.spawn(command).pipe(
        Effect.map((handle) => {
          spawned++;
          let seen = false;
          return {
            ...handle,
            isRunning: handle.isRunning.pipe(
              Effect.tap((running) =>
                Effect.sync(() => {
                  if (!running && !seen) {
                    assertFailure(
                      Result.try({ try: () => process.kill(handle.pid, 0), catch: S.is(MissingProcess) }),
                      true
                    );
                    seen = true;
                    confirmed++;
                  }
                })
              )
            ),
          };
        })
      )
    ),
  });
  return { spawner, snapshot: Effect.sync(() => CitationNativeExitCounts.make({ spawned, confirmed })) };
});

const StringJson = S.fromJsonString(S.String);
const quoted = Effect.fn("WorkerTest.quote")((value: string) => S.encodeEffect(StringJson)(value));
/** @internal @category testing @since 0.0.0 */
export const waitForCitationNativeTest = Effect.fn("WorkerTest.waitFor")(function* (
  predicate: Effect.Effect<boolean, PlatformError.PlatformError>
) {
  for (let attempt = 0; attempt < 3000; attempt++) {
    if (yield* predicate) return;
    yield* Effect.sleep(Duration.millis(10));
  }
  return yield* Effect.die("worker observation did not arrive");
});
/** Preserve all native Clock methods while replacing only test sleep.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationNativeSleepClock = Effect.fn("WorkerTest.sleepClock")(function* (sleep: Clock.Clock["sleep"]) {
  const clock = yield* Clock.Clock;
  return {
    currentTimeMillisUnsafe: () => clock.currentTimeMillisUnsafe(),
    currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
    currentTimeMillis: clock.currentTimeMillis,
    currentTimeNanos: clock.currentTimeNanos,
    monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
    monotonicTimeNanos: clock.monotonicTimeNanos,
    sleep,
  } satisfies Clock.Clock;
});
/** @internal @category testing @since 0.0.0 */
export const makeCitationNativeManualClock = Effect.fn("WorkerTest.manualSleep")(function* (
  duration: Duration.Duration
) {
  const clock = yield* Clock.Clock;
  const requested = yield* Deferred.make<void>();
  const wake = yield* Deferred.make<void>();
  const controlled = yield* makeCitationNativeSleepClock((input) =>
    Duration.equals(input, duration)
      ? Deferred.succeed(requested, undefined).pipe(Effect.andThen(Deferred.await(wake)))
      : clock.sleep(input)
  );
  return {
    clock: controlled,
    trigger: Deferred.await(requested).pipe(Effect.andThen(Deferred.succeed(wake, undefined))),
  };
});
/** @internal @category testing @since 0.0.0 */
export const makeCitationNativeWorkerFixture = Effect.fn("WorkerTest.fixture")(function* (
  kind: "busy" | "released",
  family: "html" | "regex" = "html",
  runtimeKind: CitationNativeRuntimeKind = "bun"
) {
  const version = family === "regex" ? "v2" : "v1";
  const ready = `{"_tag":"Ready","version":"citation-${family}-worker/${version}"}\\n`;
  const started = `{"_tag":"Started","version":"citation-${family}-worker/${version}"}\\n`;
  const success = '{"_tag":"Success","version":"citation-html-worker/v1","text":"released"}\\n';
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-native-worker-" });
  const workerFile = path.join(cwd, "worker.mjs");
  const marker = path.join(cwd, "started");
  const release = path.join(cwd, "release");
  const markerLiteral = yield* quoted(marker);
  const releaseLiteral = yield* quoted(release);
  const action =
    kind === "busy"
      ? `const module = new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,7,7,1,3,114,117,110,0,0,10,9,1,7,0,3,64,12,0,11,11])); new WebAssembly.Instance(module).exports.run();`
      : `const timer=setInterval(()=>{if(existsSync(${releaseLiteral})){clearInterval(timer);process.stdout.write('${success}');}},10);`;
  yield* fs.writeFileString(
    workerFile,
    `import {writeFileSync,existsSync} from 'node:fs';process.stdout.write('${ready}');process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('${started}',()=>{writeFileSync(${markerLiteral},'entered');${action}}));`
  );
  const executable = yield* runtimeKind === "node" ? citationNodeTestExecutable : citationBunTestExecutable;
  return { fs, cwd, workerFile, marker, release, kind: runtimeKind, executable };
});

/** Freeze wall time while retaining the installed Clock's real sleep and monotonic methods.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationNativeWallClock = Effect.fn("WorkerTest.wallClock")(function* (epochMillis: number) {
  const clock = yield* Clock.Clock;
  const nanos = BigInt(epochMillis) * 1000000n;
  return {
    ...clock,
    currentTimeMillisUnsafe: () => epochMillis,
    currentTimeMillis: Effect.succeed(epochMillis),
    currentTimeNanosUnsafe: () => nanos,
    currentTimeNanos: Effect.succeed(nanos),
  } satisfies Clock.Clock;
});
