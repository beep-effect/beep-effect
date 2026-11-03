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
      expect(yield* admission.snapshot).toMatchObject({ active: 1, regexActive: 1 });
      yield* Effect.all([started.process.retire(false), started.process.retire(true), owner.reap()], {
        concurrency: 3,
      });
      expect(releases).toBe(1);
      expect(yield* observed.snapshot).toEqual({ spawned: 1, confirmed: 1 });
      expect(yield* owner.snapshot).toEqual({ processes: 0, quarantined: 0, closed: false });
      expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
    })
  );

  it.effect("retains the failed-spawn resource until its registered scope is retired", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const owner = yield* makeCitationNativeProcessOwner(limits, "extract", failure);
      const permit = yield* admission.acquireRegex("extract");
      const started = yield* owner.start(ChildProcess.make("/citation-nonexistent-executable"), permit);
      expect(yield* started.child.pipe(Effect.flip)).toMatchObject({
        _tag: "CitationRegexWorkerFailure",
        reason: "spawn-failed",
      });
      expect(yield* owner.snapshot).toMatchObject({ processes: 1 });
      expect(yield* admission.snapshot).toMatchObject({ active: 1, regexActive: 1 });
      yield* started.process.retire(false);
      expect(yield* owner.snapshot).toMatchObject({ processes: 0 });
      expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0 });
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
      const started = yield* owner.start(command(), yield* admission.acquireRegex("extract"));
      yield* started.child;
      yield* Scope.close(scope, Exit.void);
      expect(yield* observed.snapshot).toEqual({ spawned: 1, confirmed: 1 });
      expect(yield* owner.snapshot).toEqual({ processes: 0, quarantined: 0, closed: true });
      expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0 });
      expect(yield* owner.ensureOpen.pipe(Effect.flip)).toMatchObject({
        _tag: "CitationRegexWorkerFailure",
        reason: "closed",
      });
    })
  );
});
