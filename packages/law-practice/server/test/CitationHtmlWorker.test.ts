import { fileURLToPath } from "node:url";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import { makeCitationHtmlWorker } from "../src/internal/Citation/HtmlWorker.ts";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import type * as PlatformError from "effect/PlatformError";
import type { CitationHtmlCompletionFailure } from "../src/internal/Citation/HtmlCompletion.ts";
import type { CitationHtmlInputFailure } from "../src/internal/Citation/HtmlInput.ts";
import type { CitationHtmlKernelFailure } from "../src/internal/Citation/HtmlKernel.ts";
import type { CitationHtmlWorkerSnapshot } from "../src/internal/Citation/HtmlWorker.ts";
import type { CitationHtmlWorkerFailure } from "../src/internal/Citation/HtmlWorkerProtocol.ts";

const StringJson = S.fromJsonString(S.String);

const ready = '{"_tag":"Ready","version":"citation-html-worker/v1"}\\n';
const started = '{"_tag":"Started","version":"citation-html-worker/v1"}\\n';
const success = '{"_tag":"Success","version":"citation-html-worker/v1","text":"released"}\\n';
const quoted = Effect.fn("WorkerTest.quote")((value: string) => S.encodeEffect(StringJson)(value));
const waitFor = Effect.fn("WorkerTest.waitFor")(function* (
  predicate: Effect.Effect<boolean, PlatformError.PlatformError>
) {
  for (let attempt = 0; attempt < 3000; attempt++) {
    if (yield* predicate) return;
    yield* Effect.sleep(Duration.millis(10));
  }
  return yield* Effect.die("worker observation did not arrive");
});
const manualSleep = Effect.fn("WorkerTest.manualSleep")(function* (duration: Duration.Duration) {
  const clock = yield* Clock.Clock;
  const requested = yield* Deferred.make<void>();
  const wake = yield* Deferred.make<void>();
  const controlled: Clock.Clock = {
    currentTimeMillisUnsafe: () => clock.currentTimeMillisUnsafe(),
    currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
    currentTimeMillis: clock.currentTimeMillis,
    currentTimeNanos: clock.currentTimeNanos,
    monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
    monotonicTimeNanos: clock.monotonicTimeNanos,
    sleep: (input) =>
      Duration.equals(input, duration)
        ? Deferred.succeed(requested, undefined).pipe(Effect.andThen(Deferred.await(wake)))
        : clock.sleep(input),
  };
  return {
    clock: controlled,
    trigger: Deferred.await(requested).pipe(Effect.andThen(Deferred.succeed(wake, undefined))),
  };
});
const fixture = Effect.fn("WorkerTest.fixture")(function* (kind: "busy" | "released") {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-html-worker-" });
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
  return { fs, cwd, workerFile, marker, release, executable: process.execPath };
});
it.layer(BunServices.layer, { excludeTestServices: true })("owned HTML processes", (it) => {
  it.effect(
    "executes the real bundled kernel and acknowledges cleanup before returning",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-html-real-" });
        const real = yield* ChildProcessSpawner;
        let pids: ReadonlyArray<number> = [];
        const worker = yield* makeCitationHtmlWorker((yield* defaultCitationEnginePolicy).limits, {
          executable: process.execPath,
          cwd,
          workerFile: fileURLToPath(new URL("../src/internal/Citation/HtmlWorker.entry.ts", import.meta.url)),
        }).pipe(
          Effect.provideService(ChildProcessSpawner, {
            ...real,
            spawn: (command) =>
              real.spawn(command).pipe(
                Effect.tap((handle) =>
                  Effect.sync(() => {
                    pids = A.append(pids, handle.pid);
                  })
                )
              ),
          })
        );
        const run = worker.clean('<div class="star-pagination">HIDDEN<b>CHILD</b>TAIL</div>') satisfies Effect.Effect<
          string,
          | CitationSafetyLimitExceeded
          | CitationHtmlWorkerFailure
          | CitationHtmlInputFailure
          | CitationHtmlKernelFailure
          | CitationHtmlCompletionFailure
        >;
        expect(yield* run).toBe("CHILD");
        expect(yield* worker.clean("<p>😀\ufeffAB</p>")).toBe("😀\ufeffAB");
        const failed = yield* Effect.flip(
          worker.clean(`${Str.repeat(256)("<div>")}VISIBLE${Str.repeat(256)("</div>")}`)
        );
        expect(failed._tag).toBe("CitationSafetyLimitExceeded");
        if (failed._tag === "CitationSafetyLimitExceeded") expect(failed.limit).toBe("nativeHtmlParserResource");
        expect(pids).toHaveLength(3);
        for (const pid of pids) expect(() => process.kill(pid, 0)).toThrow();
        expect(yield* worker.snapshot).toEqual({ active: 0, queued: 0, processes: 0, quarantined: 0, closed: false });
      }),
    { timeout: 30_000 }
  );
  it.effect(
    "keeps the captured clock responsive and stops native WASM work on expiry and cancellation",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture("busy");
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const timer = yield* manualSleep(Duration.millis(800));
        const worker = yield* makeCitationHtmlWorker({ ...limits, cleanDeadline: Duration.millis(800) }, f).pipe(
          Effect.provideService(Clock.Clock, timer.clock)
        );
        const clock = yield* Clock.Clock;
        const callerClock: Clock.Clock = {
          currentTimeMillisUnsafe: () => clock.currentTimeMillisUnsafe(),
          currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
          currentTimeMillis: clock.currentTimeMillis,
          currentTimeNanos: clock.currentTimeNanos,
          monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
          monotonicTimeNanos: clock.monotonicTimeNanos,
          sleep: () => Effect.never,
        };
        const fiber = yield* worker
          .clean("private input")
          .pipe(Effect.provideService(Clock.Clock, callerClock), Effect.forkChild);
        yield* waitFor(f.fs.exists(f.marker)).pipe(
          Effect.catchCause((cause) =>
            Effect.gen(function* () {
              const state = yield* Effect.sync(() => O.fromUndefinedOr(fiber.pollUnsafe()));
              if (O.isSome(state) && Exit.isFailure(state.value)) return yield* Effect.failCause(state.value.cause);
              return yield* Effect.failCause(cause);
            })
          )
        );
        let ticks = 0;
        const heartbeat = yield* Effect.sleep(Duration.millis(5)).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              ticks++;
            })
          ),
          Effect.forever,
          Effect.forkChild
        );
        yield* waitFor(Effect.sync(() => ticks > 0));
        yield* timer.trigger;
        const result = yield* Fiber.await(fiber);
        yield* Fiber.interrupt(heartbeat);
        expect(ticks).toBeGreaterThan(0);
        expect(Exit.isFailure(result)).toBe(true);
        const failed = yield* result.pipe(Effect.flip);
        expect(failed._tag).toBe("CitationSafetyLimitExceeded");
        if (failed._tag === "CitationSafetyLimitExceeded") expect(failed.limit).toBe("cleanDeadline");
        expect((yield* worker.snapshot).processes).toBe(0);
        yield* f.fs.remove(f.marker);
        const long = yield* makeCitationHtmlWorker({ ...limits, cleanDeadline: Duration.seconds(30) }, f);
        const interrupted = yield* Effect.forkChild(long.clean("private input"));
        yield* waitFor(f.fs.exists(f.marker));
        yield* Fiber.interrupt(interrupted);
        expect(Exit.hasInterrupts(yield* Fiber.await(interrupted))).toBe(true);
        expect((yield* long.snapshot).processes).toBe(0);
      }),
    { timeout: 60_000 }
  );
  it.effect(
    "bounds waiting work and does not reuse a slot before child retirement",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture("released");
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const timer = yield* manualSleep(Duration.millis(100));
        const worker = yield* makeCitationHtmlWorker(
          { ...limits, queuedOperations: 1, queueDeadline: Duration.millis(100), cleanDeadline: Duration.seconds(30) },
          f
        ).pipe(Effect.provideService(Clock.Clock, timer.clock));
        const first = yield* Effect.forkChild(worker.clean("first"));
        yield* waitFor(f.fs.exists(f.marker));
        const second = yield* Effect.forkChild(worker.clean("second"));
        yield* waitFor(worker.snapshot.pipe(Effect.map((s) => s.queued === 1)));
        const rejected = yield* Effect.flip(worker.clean("third"));
        expect(rejected._tag).toBe("CitationSafetyLimitExceeded");
        if (rejected._tag === "CitationSafetyLimitExceeded") expect(rejected.limit).toBe("queuedOperations");
        yield* timer.trigger;
        const waiting = yield* Fiber.join(second).pipe(Effect.flip);
        expect(waiting._tag).toBe("CitationSafetyLimitExceeded");
        if (waiting._tag === "CitationSafetyLimitExceeded") expect(waiting.limit).toBe("queueDeadline");
        expect((yield* worker.snapshot).processes).toBe(1);
        yield* f.fs.writeFileString(f.release, "yes");
        expect(yield* Fiber.join(first)).toBe("released");
        expect((yield* worker.snapshot).processes).toBe(0);
      }),
    { timeout: 60_000 }
  );
  it.effect(
    "quarantines an unconfirmed cleanup and admits no replacement until late acknowledgement",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture("busy");
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const real = yield* ChildProcessSpawner;
        const acknowledgement = yield* Deferred.make<void>();
        let spawned = 0;
        const worker = yield* makeCitationHtmlWorker(
          { ...limits, cleanDeadline: Duration.millis(500), cleanupDeadline: Duration.millis(25) },
          f
        ).pipe(
          Effect.provideService(ChildProcessSpawner, {
            ...real,
            spawn: (command) =>
              real.spawn(command).pipe(
                Effect.map((handle) => {
                  spawned++;
                  return {
                    ...handle,
                    kill: (options) => handle.kill(options).pipe(Effect.andThen(Deferred.await(acknowledgement))),
                  };
                })
              ),
          })
        );
        const failed = yield* Effect.flip(worker.clean("private input"));
        expect(failed._tag).toBe("CitationSafetyLimitExceeded");
        if (failed._tag === "CitationSafetyLimitExceeded") expect(failed.limit).toBe("cleanupDeadline");
        const state: CitationHtmlWorkerSnapshot = yield* worker.snapshot;
        expect(state.quarantined).toBe(1);
        expect(state.active).toBe(1);
        const next = yield* Effect.flip(worker.clean("replacement"));
        expect(next._tag).toBe("CitationHtmlWorkerFailure");
        if (next._tag === "CitationHtmlWorkerFailure") expect(next.reason).toBe("quarantined");
        expect(spawned).toBe(1);
        yield* Deferred.succeed(acknowledgement, undefined);
        yield* waitFor(worker.snapshot.pipe(Effect.map((s) => s.processes === 0)));
        expect((yield* worker.snapshot).active).toBe(0);
      }),
    { timeout: 60_000 }
  );
  it.effect(
    "preserves quarantine when the total deadline expires during retirement",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture("busy");
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const real = yield* ChildProcessSpawner;
        const acknowledgement = yield* Deferred.make<void>();
        let spawned = 0;
        const worker = yield* makeCitationHtmlWorker(
          {
            ...limits,
            cleanDeadline: Duration.millis(500),
            operationDeadline: Duration.millis(550),
            cleanupDeadline: Duration.millis(150),
          },
          f
        ).pipe(
          Effect.provideService(ChildProcessSpawner, {
            ...real,
            spawn: (command) =>
              real.spawn(command).pipe(
                Effect.map((handle) => {
                  spawned++;
                  return {
                    ...handle,
                    kill: (options) => handle.kill(options).pipe(Effect.andThen(Deferred.await(acknowledgement))),
                  };
                })
              ),
          })
        );
        const failed = yield* Effect.flip(worker.clean("private input"));
        expect(failed._tag).toBe("CitationSafetyLimitExceeded");
        if (failed._tag === "CitationSafetyLimitExceeded") expect(failed.limit).toBe("operationDeadline");
        const state: CitationHtmlWorkerSnapshot = yield* worker.snapshot;
        expect(state.quarantined).toBe(1);
        expect(state.active).toBe(1);
        const next = yield* Effect.flip(worker.clean("replacement"));
        expect(next._tag).toBe("CitationHtmlWorkerFailure");
        if (next._tag === "CitationHtmlWorkerFailure") expect(next.reason).toBe("quarantined");
        expect(spawned).toBe(1);
        yield* Deferred.succeed(acknowledgement, undefined);
        yield* waitFor(worker.snapshot.pipe(Effect.map((s) => s.processes === 0)));
        expect((yield* worker.snapshot).active).toBe(0);
      }),
    { timeout: 60_000 }
  );
  it.effect(
    "keeps the total deadline across queueing and gives it precedence over longer stage timers",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture("busy");
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const timer = yield* manualSleep(Duration.seconds(3));
        const worker = yield* makeCitationHtmlWorker(
          {
            ...limits,
            cleanDeadline: Duration.seconds(30),
            operationDeadline: Duration.seconds(3),
            queueDeadline: Duration.seconds(5),
          },
          f
        ).pipe(Effect.provideService(Clock.Clock, timer.clock));
        const first = yield* Effect.forkChild(worker.clean("first"));
        yield* waitFor(f.fs.exists(f.marker));
        const second = yield* Effect.forkChild(worker.clean("second"));
        yield* waitFor(worker.snapshot.pipe(Effect.map((state) => state.queued === 1)));
        yield* timer.trigger;
        for (const task of [first, second]) {
          const failed = yield* Fiber.join(task).pipe(Effect.flip);
          expect(failed._tag).toBe("CitationSafetyLimitExceeded");
          if (failed._tag === "CitationSafetyLimitExceeded") expect(failed.limit).toBe("operationDeadline");
        }
        expect((yield* worker.snapshot).active).toBe(0);
        expect((yield* worker.snapshot).processes).toBe(0);
      }),
    { timeout: 60_000 }
  );
  it.effect(
    "does not inherit environment or load the working directory dotenv file",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture("released");
        const path = yield* Path.Path;
        yield* f.fs.writeFileString(path.join(f.cwd, ".env"), "CITATION_HTML_ENV_PROBE=unexpected\n");
        const absent = '{"_tag":"Success","version":"citation-html-worker/v1","text":"absent"}\\n';
        const leaked = '{"_tag":"Success","version":"citation-html-worker/v1","text":"loaded"}\\n';
        yield* f.fs.writeFileString(
          f.workerFile,
          `process.stdout.write('${ready}');process.stdin.resume();process.stdin.on('end',()=>{process.stdout.write('${started}');process.stdout.write(process.env.CITATION_HTML_ENV_PROBE?'${leaked}':'${absent}');});`
        );
        const real = yield* ChildProcessSpawner;
        const worker = yield* makeCitationHtmlWorker((yield* defaultCitationEnginePolicy).limits, f).pipe(
          Effect.provideService(ChildProcessSpawner, {
            ...real,
            spawn: (command) => {
              expect(command._tag).toBe("StandardCommand");
              if (command._tag === "StandardCommand") {
                expect(command.options.env).toEqual({});
                expect(command.options.extendEnv).toBe(false);
                expect(command.options.shell).toBe(false);
                expect(command.args).toContain("--no-env-file");
                expect(command.args).toContain("--no-install");
              }
              return real.spawn(command);
            },
          })
        );
        expect(yield* worker.clean("ignored")).toBe("absent");
      }),
    { timeout: 60_000 }
  );
  it.effect(
    "rejects malformed, partial, trailing and oversize output before publishing any result",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture("released");
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const worker = yield* makeCitationHtmlWorker({ ...limits, processMessageBytes: 256 }, f);
        const scripts = [
          `process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('not-json\\n'));`,
          `process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('${ready}${started}{"_tag":"Success"}'));`,
          `process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('${ready}${started}${success}x'));`,
        ];
        for (const script of scripts) {
          yield* f.fs.writeFileString(f.workerFile, script);
          expect((yield* Effect.flip(worker.clean("ignored")))._tag).toBe("CitationHtmlWorkerFailure");
          expect((yield* worker.snapshot).processes).toBe(0);
        }
        yield* f.fs.writeFileString(
          f.workerFile,
          "process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('x'.repeat(4096)));"
        );
        const failed = yield* Effect.flip(worker.clean("ignored"));
        expect(failed._tag).toBe("CitationSafetyLimitExceeded");
        if (failed._tag === "CitationSafetyLimitExceeded") expect(failed.limit).toBe("processMessageBytes");
        expect((yield* worker.snapshot).processes).toBe(0);
      }),
    { timeout: 60_000 }
  );
  it.effect(
    "closes active native work with the owner scope and releases failed spawns",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture("busy");
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const owner = yield* Scope.make();
        const worker = yield* makeCitationHtmlWorker({ ...limits, cleanDeadline: Duration.seconds(5) }, f).pipe(
          Effect.provideService(Scope.Scope, owner)
        );
        const running = yield* Effect.forkChild(worker.clean("private input"));
        yield* waitFor(f.fs.exists(f.marker));
        yield* Scope.close(owner, Exit.void);
        expect(yield* worker.snapshot).toEqual({ active: 0, queued: 0, processes: 0, quarantined: 0, closed: true });
        expect(Exit.isFailure(yield* Fiber.await(running))).toBe(true);
        const closed = yield* Effect.flip(worker.clean("replacement"));
        expect(closed._tag).toBe("CitationHtmlWorkerFailure");
        if (closed._tag === "CitationHtmlWorkerFailure") expect(closed.reason).toBe("closed");
        const missing = yield* makeCitationHtmlWorker(limits, { ...f, executable: `${f.cwd}/missing-bun` });
        const failed = yield* Effect.flip(missing.clean("private input"));
        expect(failed._tag).toBe("CitationHtmlWorkerFailure");
        if (failed._tag === "CitationHtmlWorkerFailure") expect(failed.reason).toBe("spawn-failed");
        expect(yield* missing.snapshot).toEqual({ active: 0, queued: 0, processes: 0, quarantined: 0, closed: false });
      }),
    { timeout: 60_000 }
  );
});
