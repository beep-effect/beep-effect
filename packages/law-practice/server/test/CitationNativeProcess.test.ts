import { makeCitationNativeProcessAdmission } from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { makeCitationNativeProcessOwner } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { CitationRegexWorkerFailure } from "@beep/law-practice-server/internal/Citation/RegexWorkerProtocol";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Scope from "effect/Scope";
import { makeCitationObservedSpawner } from "./CitationNativeSpawner.fixtures.ts";

const command = () =>
  ChildProcess.make(process.execPath, ["--no-env-file", "--no-install", "-e", "process.stdin.resume()"], {
    env: {},
    extendEnv: false,
    shell: false,
    detached: false,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "ignore",
    killSignal: "SIGKILL",
    forceKillAfter: Duration.zero,
  });
const failure = (reason: CitationRegexWorkerFailure["reason"]) => CitationRegexWorkerFailure.make({ reason });

it.layer(BunServices.layer, { excludeTestServices: true })("shared native process ownership", (it) => {
  it.effect("quarantines uncertain liveness and recovers without releasing the permit early", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const malformed = yield* makeCitationNativeProcessOwner(null, "extract", failure).pipe(Effect.flip);
      expect(malformed).toMatchObject({ reason: "invalid-runtime" });
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      let uncertain = true;
      const spawner = ChildProcessSpawner.of({
        ...observed.spawner,
        spawn: Effect.fn("NativeProcessTest.uncertainSpawn")((command) =>
          observed.spawner.spawn(command).pipe(
            Effect.map((handle) => ({
              ...handle,
              isRunning: Effect.suspend(() =>
                uncertain
                  ? Effect.fail(
                      PlatformError.systemError({ module: "ChildProcess", method: "isRunning", _tag: "Unknown" })
                    )
                  : handle.isRunning
              ),
            }))
          )
        ),
      });
      const scope = yield* Scope.make();
      const owner = yield* makeCitationNativeProcessOwner(limits, "extract", failure).pipe(
        Effect.provideService(ChildProcessSpawner, spawner),
        Effect.provideService(Scope.Scope, scope)
      );
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          uncertain = false;
        }).pipe(Effect.andThen(Scope.close(scope, Exit.void)), Effect.andThen(owner.reap()), Effect.orDie)
      );
      const permit = yield* admission.acquireRegex("extract");
      const started = yield* owner.start(command(), permit);
      yield* started.child;
      const refused = yield* started.process.retire(false).pipe(Effect.flip);
      expect(refused).toMatchObject({ reason: "cleanup-unconfirmed" });
      const held = yield* admission.snapshot;
      expect(held).toMatchObject({ active: 1, quarantined: 1 });
      yield* Scope.close(scope, Exit.void);
      const closed = yield* owner.snapshot;
      expect(closed).toEqual({ processes: 1, quarantined: 1, closed: true });
      uncertain = false;
      yield* owner.reap();
      const released = yield* admission.snapshot;
      expect(released).toMatchObject({ active: 0, quarantined: 0 });
      const final = yield* owner.snapshot;
      expect(final).toEqual({ processes: 0, quarantined: 0, closed: true });
      const physical = yield* observed.snapshot;
      expect(physical).toEqual({ spawned: 1, confirmed: 1 });
    })
  );
  it.effect("retires a regex reservation exactly once across concurrent observers and reaping", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      const owner = yield* makeCitationNativeProcessOwner(limits, "extract", failure).pipe(
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const permit = yield* admission.acquireRegex("extract");
      let releases = 0;
      const started = yield* owner.start(command(), {
        quarantine: permit.quarantine,
        release: Effect.sync(() => {
          releases++;
        }).pipe(Effect.andThen(permit.release)),
      });
      yield* started.child;
      const citationResult1 = yield* admission.snapshot;
      expect(citationResult1).toMatchObject({ active: 1, regexActive: 1 });
      yield* Effect.all([started.process.retire(false), started.process.retire(true), owner.reap()], {
        concurrency: 3,
      });
      expect(releases).toBe(1);
      const citationResult2 = yield* observed.snapshot;
      expect(citationResult2).toEqual({ spawned: 1, confirmed: 1 });
      const citationResult3 = yield* owner.snapshot;
      expect(citationResult3).toEqual({ processes: 0, quarantined: 0, closed: false });
      const citationResult4 = yield* admission.snapshot;
      expect(citationResult4).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
    })
  );

  it.effect("retains the failed-spawn resource until its registered scope is retired", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const owner = yield* makeCitationNativeProcessOwner(limits, "extract", failure);
      const permit = yield* admission.acquireRegex("extract");
      const started = yield* owner.start(ChildProcess.make("/citation-nonexistent-executable"), permit);
      const citationResult5 = yield* started.child.pipe(Effect.flip);
      expect(citationResult5).toMatchObject({
        _tag: "CitationRegexWorkerFailure",
        reason: "spawn-failed",
      });
      const citationResult6 = yield* owner.snapshot;
      expect(citationResult6).toMatchObject({ processes: 1 });
      const citationResult7 = yield* admission.snapshot;
      expect(citationResult7).toMatchObject({ active: 1, regexActive: 1 });
      yield* started.process.retire(false);
      const citationResult8 = yield* owner.snapshot;
      expect(citationResult8).toMatchObject({ processes: 0 });
      const citationResult9 = yield* admission.snapshot;
      expect(citationResult9).toMatchObject({ active: 0, regexActive: 0 });
    })
  );

  it.effect("closes regex ownership before releasing its shared native permit", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const observed = yield* makeCitationObservedSpawner();
      const scope = yield* Scope.make();
      const owner = yield* makeCitationNativeProcessOwner(limits, "extract", failure).pipe(
        Effect.provideService(ChildProcessSpawner, observed.spawner),
        Effect.provideService(Scope.Scope, scope)
      );
      const citationResult10 = yield* admission.acquireRegex("extract");
      const started = yield* owner.start(command(), citationResult10);
      yield* started.child;
      yield* Scope.close(scope, Exit.void);
      const citationResult11 = yield* observed.snapshot;
      expect(citationResult11).toEqual({ spawned: 1, confirmed: 1 });
      const citationResult12 = yield* owner.snapshot;
      expect(citationResult12).toEqual({ processes: 0, quarantined: 0, closed: true });
      const citationResult13 = yield* admission.snapshot;
      expect(citationResult13).toMatchObject({ active: 0, regexActive: 0 });
      const citationResult14 = yield* owner.ensureOpen.pipe(Effect.flip);
      expect(citationResult14).toMatchObject({
        _tag: "CitationRegexWorkerFailure",
        reason: "closed",
      });
    })
  );
});
