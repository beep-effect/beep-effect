import * as NodeURL from "node:url";
import { makeCitationHtmlWorker } from "@beep/law-practice-server/internal/Citation/HtmlWorker";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
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
import { ChildProcessSpawner, make as makeSpawner } from "effect/process/ChildProcessSpawner";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import type { CitationHtmlCompletionFailure } from "@beep/law-practice-server/internal/Citation/HtmlCompletion";
import type { CitationHtmlInputFailure } from "@beep/law-practice-server/internal/Citation/HtmlInput";
import type { CitationHtmlKernelFailure } from "@beep/law-practice-server/internal/Citation/HtmlKernel";
import type { CitationHtmlWorkerSnapshot } from "@beep/law-practice-server/internal/Citation/HtmlWorker";
import type { CitationHtmlWorkerFailure } from "@beep/law-practice-server/internal/Citation/HtmlWorkerProtocol";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

const ready = '{"_tag":"Ready","version":"citation-html-worker/v1"}\\n';
const started = '{"_tag":"Started","version":"citation-html-worker/v1"}\\n';
const success = '{"_tag":"Success","version":"citation-html-worker/v1","text":"released"}\\n';

import {
  makeCitationNativeWorkerFixture as fixture,
  makeCitationNativeSleepClock,
  makeCitationNativeManualClock as manualSleep,
  waitForCitationNativeTest as waitFor,
} from "./CitationNativeSpawner.fixtures.ts";

it.layer(BunServices.layer, { excludeTestServices: true })("owned HTML processes", (it) => {
  it.effect("rejects malformed policy, runtime and input before starting a child", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const invalidPolicy = yield* makeCitationHtmlWorker(null, null).pipe(Effect.flip);
      expect(invalidPolicy).toMatchObject({ reason: "invalid-runtime" });
      const invalidRuntime = yield* makeCitationHtmlWorker(limits, null).pipe(Effect.flip);
      expect(invalidRuntime).toMatchObject({ reason: "invalid-runtime" });
      const f = yield* fixture("released");
      let spawns = 0;
      const worker = yield* makeCitationHtmlWorker(limits, f).pipe(
        Effect.provideService(
          ChildProcessSpawner,
          makeSpawner(() =>
            Effect.sync(() => {
              spawns++;
              throw new Error("malformed input started a child");
            })
          )
        )
      );
      for (const clean of [worker.clean, worker.cleanBytes, worker.cleanUnicode]) {
        const failure = yield* clean(null).pipe(Effect.flip);
        expect(failure).toMatchObject({ reason: "invalid-input" });
        expect("cause" in failure).toBe(false);
      }
      expect(spawns).toBe(0);
    })
  );
  it.effect(
    "executes the real bundled kernel and acknowledges cleanup before returning",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-html-real-" });
        const real = yield* ChildProcessSpawner;
        let pids: ReadonlyArray<number> = [];
        const citationResult1 = yield* defaultCitationEnginePolicy;
        const worker = yield* makeCitationHtmlWorker(citationResult1.limits, {
          kind: "bun",
          executable: process.execPath,
          cwd,
          workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/HtmlWorker.entry.ts", import.meta.url)),
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
        const citationResult2 = yield* run;
        expect(citationResult2).toBe("CHILD");
        const citationResult3 = yield* worker.clean("<p>😀\ufeffAB</p>");
        expect(citationResult3).toBe("😀\ufeffAB");
        const failed = yield* Effect.flip(
          worker.clean(`${Str.repeat(256)("<div>")}VISIBLE${Str.repeat(256)("</div>")}`)
        );
        expect(failed._tag).toBe("CitationSafetyLimitExceeded");
        if (failed._tag === "CitationSafetyLimitExceeded") expect(failed.limit).toBe("nativeHtmlParserResource");
        expect(pids).toHaveLength(3);
        for (const pid of pids) expect(() => process.kill(pid, 0)).toThrow();
        const citationResult4 = yield* worker.snapshot;
        expect(citationResult4).toEqual({ active: 0, queued: 0, processes: 0, quarantined: 0, closed: false });
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
        const callerClock = yield* makeCitationNativeSleepClock(() => Effect.never);
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
        result.pipe(Exit.isFailure, assertTrue);
        const failed = yield* result.pipe(Effect.flip);
        expect(failed._tag).toBe("CitationSafetyLimitExceeded");
        if (failed._tag === "CitationSafetyLimitExceeded") expect(failed.limit).toBe("cleanDeadline");
        const citationResult5 = yield* worker.snapshot;
        expect(citationResult5.processes).toBe(0);
        yield* f.fs.remove(f.marker);
        const long = yield* makeCitationHtmlWorker({ ...limits, cleanDeadline: Duration.seconds(30) }, f);
        const interrupted = yield* Effect.forkChild(long.clean("private input"));
        yield* waitFor(f.fs.exists(f.marker));
        yield* Fiber.interrupt(interrupted);
        const citationResult6 = yield* Fiber.await(interrupted);
        expect(Exit.hasInterrupts(citationResult6)).toBe(true);
        const citationResult7 = yield* long.snapshot;
        expect(citationResult7.processes).toBe(0);
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
        const citationResult8 = yield* worker.snapshot;
        expect(citationResult8.processes).toBe(1);
        yield* f.fs.writeFileString(f.release, "yes");
        const citationResult9 = yield* Fiber.join(first);
        expect(citationResult9).toBe("released");
        const citationResult10 = yield* worker.snapshot;
        expect(citationResult10.processes).toBe(0);
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
        const citationResult11 = yield* worker.snapshot;
        expect(citationResult11.active).toBe(0);
      }),
    { timeout: 60_000 }
  );
  it.effect(
    "shares native quarantine across separate workers until exact retirement acknowledgement",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture("busy");
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const admission = yield* makeCitationNativeProcessAdmission(limits);
        const timer = yield* manualSleep(Duration.millis(800));
        const real = yield* ChildProcessSpawner;
        const acknowledgement = yield* Deferred.make<void>();
        let spawned = 0;
        const spawner = {
          ...real,
          spawn: (command: Parameters<typeof real.spawn>[0]) =>
            real.spawn(command).pipe(
              Effect.map((handle) => {
                spawned++;
                return {
                  ...handle,
                  kill: (options: Parameters<typeof handle.kill>[0]) =>
                    handle.kill(options).pipe(Effect.andThen(Deferred.await(acknowledgement))),
                };
              })
            ),
        };
        const first = yield* makeCitationHtmlWorker(
          {
            ...limits,
            cleanDeadline: Duration.millis(800),
            cleanupDeadline: Duration.millis(100),
          },
          f
        ).pipe(
          Effect.provideService(CitationNativeProcessAdmission, admission),
          Effect.provideService(ChildProcessSpawner, spawner),
          Effect.provideService(Clock.Clock, timer.clock)
        );
        const second = yield* makeCitationHtmlWorker(limits, f).pipe(
          Effect.provideService(CitationNativeProcessAdmission, admission),
          Effect.provideService(ChildProcessSpawner, spawner)
        );
        const firstCall = yield* first.clean("first").pipe(Effect.forkChild);
        yield* waitFor(f.fs.exists(f.marker));
        const secondCall = yield* second.clean("second").pipe(Effect.forkChild);
        yield* waitFor(admission.snapshot.pipe(Effect.map((state) => state.queued === 1)));
        yield* timer.trigger;
        const citationResult12 = yield* Fiber.join(firstCall).pipe(Effect.flip);
        expect(citationResult12).toMatchObject({ limit: "cleanupDeadline" });
        const citationResult13 = yield* Fiber.join(secondCall).pipe(Effect.flip);
        expect(citationResult13).toMatchObject({ reason: "quarantined" });
        const citationResult14 = yield* admission.snapshot;
        expect(citationResult14).toEqual({
          active: 1,
          regexActive: 0,
          queued: 0,
          quarantined: 1,
          closed: false,
        });
        const citationResult15 = yield* second.clean("replacement").pipe(Effect.flip);
        expect(citationResult15).toMatchObject({ reason: "quarantined" });
        expect(spawned).toBe(1);
        yield* Deferred.succeed(acknowledgement, undefined);
        yield* waitFor(admission.snapshot.pipe(Effect.map((state) => state.active === 0)));
        const recovered = yield* admission.acquire("clean");
        yield* recovered.release;
        const citationResult16 = yield* admission.snapshot;
        expect(citationResult16).toEqual({
          active: 0,
          regexActive: 0,
          queued: 0,
          quarantined: 0,
          closed: false,
        });
        const citationResult17 = yield* first.snapshot;
        expect(citationResult17.processes).toBe(0);
        const citationResult18 = yield* second.snapshot;
        expect(citationResult18.active).toBe(0);
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
        const citationResult19 = yield* worker.snapshot;
        expect(citationResult19.active).toBe(0);
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
        const citationResult20 = yield* worker.snapshot;
        expect(citationResult20.active).toBe(0);
        const citationResult21 = yield* worker.snapshot;
        expect(citationResult21.processes).toBe(0);
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
        const citationResult22 = yield* defaultCitationEnginePolicy;
        const worker = yield* makeCitationHtmlWorker(citationResult22.limits, f).pipe(
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
        const citationResult23 = yield* worker.clean("ignored");
        expect(citationResult23).toBe("absent");
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
          const citationResult24 = yield* Effect.flip(worker.clean("ignored"));
          expect(citationResult24._tag).toBe("CitationHtmlWorkerFailure");
          const citationResult25 = yield* worker.snapshot;
          expect(citationResult25.processes).toBe(0);
        }
        yield* f.fs.writeFileString(
          f.workerFile,
          "process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('x'.repeat(4096)));"
        );
        const failed = yield* Effect.flip(worker.clean("ignored"));
        expect(failed._tag).toBe("CitationSafetyLimitExceeded");
        if (failed._tag === "CitationSafetyLimitExceeded") expect(failed.limit).toBe("processMessageBytes");
        const citationResult26 = yield* worker.snapshot;
        expect(citationResult26.processes).toBe(0);
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
        const citationResult27 = yield* worker.snapshot;
        expect(citationResult27).toEqual({ active: 0, queued: 0, processes: 0, quarantined: 0, closed: true });
        const citationResult28 = yield* Fiber.await(running);
        citationResult28.pipe(Exit.isFailure, assertTrue);
        const closed = yield* Effect.flip(worker.clean("replacement"));
        expect(closed._tag).toBe("CitationHtmlWorkerFailure");
        if (closed._tag === "CitationHtmlWorkerFailure") expect(closed.reason).toBe("closed");
        const missing = yield* makeCitationHtmlWorker(limits, { ...f, executable: `${f.cwd}/missing-bun` });
        const failed = yield* Effect.flip(missing.clean("private input"));
        expect(failed._tag).toBe("CitationHtmlWorkerFailure");
        if (failed._tag === "CitationHtmlWorkerFailure") expect(failed.reason).toBe("spawn-failed");
        const citationResult29 = yield* missing.snapshot;
        expect(citationResult29).toEqual({ active: 0, queued: 0, processes: 0, quarantined: 0, closed: false });
      }),
    { timeout: 60_000 }
  );
});
