/** Independent exit observations for hosted native citation qualification.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationNativeProcessRuntime } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { expect } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type * as PlatformError from "effect/PlatformError";

/** The actual owned HTML entrypoint, resolved from the test fixture location.
 * @internal @category testing @since 0.0.0
 */
export const citationHtmlWorkerTestRuntime = () =>
  CitationNativeProcessRuntime.make({
    kind: "bun",
    executable: process.execPath,
    cwd: process.cwd(),
    workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/HtmlWorker.entry.ts", import.meta.url)),
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

/** Bundle a trusted test subject for the installed Node executable. The caller
 * owns the scoped output directory; actual worker launches receive empty env.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationNodeTestRuntime = Effect.fn("NativeSourceTest.nodeRuntime")(function* (
  entrypoint: string,
  cwd: string
) {
  const path = yield* Path.Path;
  const executable = yield* citationNodeTestExecutable;
  const bundle = yield* Effect.promise(() =>
    Bun.build({
      entrypoints: [entrypoint],
      target: "node",
      format: "esm",
      packages: "bundle",
      outdir: cwd,
      naming: "worker.mjs",
    })
  );
  expect(bundle.success).toBe(true);
  return CitationNativeProcessRuntime.make({ kind: "node", executable, cwd, workerFile: path.join(cwd, "worker.mjs") });
});

/** Share actual regex runtime selection across worker and tokenizer controls.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationRegexTestRuntime = Effect.fn("NativeSourceTest.regexRuntime")(function* (
  kind: CitationNativeRuntimeKind,
  cwd: string
) {
  if (kind === "node")
    return yield* makeCitationNodeTestRuntime(
      NodeURL.fileURLToPath(new URL("../src/internal/Citation/RegexWorker.node.entry.ts", import.meta.url)),
      cwd
    );
  return CitationNativeProcessRuntime.make({
    kind: "bun",
    executable: process.execPath,
    cwd,
    workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/RegexWorker.entry.ts", import.meta.url)),
  });
});

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
  const executable = runtimeKind === "node" ? yield* citationNodeTestExecutable : process.execPath;
  return { fs, cwd, workerFile, marker, release, kind: runtimeKind, executable };
});
