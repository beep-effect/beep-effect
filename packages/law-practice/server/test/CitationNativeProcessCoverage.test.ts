import { makeCitationNativeProcessAdmission } from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import {
  CitationNativeProcessOwnerSnapshot,
  makeCitationNativeProcessOwner,
  withCitationNativeProcess,
} from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { CitationRegexWorkerFailure } from "@beep/law-practice-server/internal/Citation/RegexWorkerProtocol";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import type { CitationNativeProcessStarter } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const failure = (reason: CitationRegexWorkerFailure["reason"]) => CitationRegexWorkerFailure.make({ reason });
const invalid = () => failure("invalid-frame");
const command = ChildProcess.make("citation-coverage-worker");
const exitedHandle = ChildProcessSpawner.makeHandle({
  pid: ChildProcessSpawner.ProcessId(1),
  exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
  isRunning: Effect.succeed(false),
  kill: () => Effect.void,
  unref: Effect.succeed(Effect.void),
  stdin: Sink.drain,
  stdout: Stream.empty,
  stderr: Stream.empty,
  all: Stream.empty,
  getInputFd: () => Sink.drain,
  getOutputFd: () => Stream.empty,
});
const recordingOwner = (events: Array<string>): CitationNativeProcessStarter<CitationRegexWorkerFailure> => ({
  ensureOpen: Effect.sync(() => events.push("open")),
  start: (_command, lease) =>
    Effect.sync(() => {
      events.push("start");
      return {
        process: {
          retire: () => Effect.sync(() => events.push("retire")).pipe(Effect.andThen(lease.release)),
        },
        child: Exit.succeed(exitedHandle),
      };
    }),
});
const recordingLease = (events: Array<string>) =>
  Effect.sync(() => {
    events.push("acquire");
    return { quarantine: Effect.void, release: Effect.sync(() => events.push("release")) };
  });

it.effect("refuses a second claim and releases the single unstarted permit", () =>
  Effect.gen(function* () {
    const events: Array<string> = [];
    const refused = yield* withCitationNativeProcess(
      recordingOwner(events),
      recordingLease(events),
      invalid,
      ({ acquire }) => acquire.pipe(Effect.andThen(acquire))
    ).pipe(Effect.flip);
    expect(refused).toMatchObject({ reason: "invalid-frame" });
    deepStrictEqual(events, ["open", "acquire", "release"]);
  })
);

it.effect("refuses a second start and retires the single transferred process", () =>
  Effect.gen(function* () {
    const events: Array<string> = [];
    const refused = yield* withCitationNativeProcess(
      recordingOwner(events),
      recordingLease(events),
      invalid,
      ({ acquire, start }) =>
        acquire.pipe(
          Effect.andThen(start(command)),
          Effect.tap((handle) => Effect.sync(() => events.push(`pid:${handle.pid}`))),
          Effect.andThen(start(command))
        )
    ).pipe(Effect.flip);
    expect(refused).toMatchObject({ reason: "invalid-frame" });
    deepStrictEqual(events, ["open", "acquire", "start", "pid:1", "retire", "release"]);
  })
);

it.effect("quarantines an exited child whose scope finalizer fails, then recovers on retry", () =>
  Effect.gen(function* () {
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const admission = yield* makeCitationNativeProcessAdmission(limits);
    let finalizerFails = true;
    const spawner = ChildProcessSpawner.make(() =>
      Effect.addFinalizer(() => (finalizerFails ? Effect.die("finalizer failed") : Effect.void)).pipe(
        Effect.as(exitedHandle)
      )
    );
    const owner = yield* makeCitationNativeProcessOwner(limits, "extract", failure).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
    );
    const permit = yield* admission.acquireRegex("extract");
    const started = yield* owner.start(command, permit);
    const child = yield* started.child;
    expect(child.pid).toBe(1);
    const refused = yield* started.process.retire(false).pipe(Effect.flip);
    expect(refused).toMatchObject({ reason: "cleanup-unconfirmed" });
    const quarantinedOwner = yield* owner.snapshot;
    deepStrictEqual(
      quarantinedOwner,
      CitationNativeProcessOwnerSnapshot.make({ processes: 1, quarantined: 1, closed: false })
    );
    const held = yield* admission.snapshot;
    expect(held).toMatchObject({ active: 1, regexActive: 1, quarantined: 1 });
    // The failed scope is already closed; the retry acknowledges exit and releases.
    finalizerFails = false;
    yield* started.process.retire(true);
    const releasedOwner = yield* owner.snapshot;
    deepStrictEqual(
      releasedOwner,
      CitationNativeProcessOwnerSnapshot.make({ processes: 0, quarantined: 0, closed: false })
    );
    const released = yield* admission.snapshot;
    expect(released).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
  })
);
