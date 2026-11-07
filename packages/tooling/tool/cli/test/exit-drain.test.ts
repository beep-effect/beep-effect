import { drainThenExit } from "@beep/repo-cli/test/Runtime";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { vi } from "vitest";

// The drain is scripted so a dropped-line report can be forced without breaking a real stream;
// the report itself is captured instead of written.
const stdout = vi.hoisted(() => ({ drainProcessStreams: vi.fn(), writeBestEffortLine: vi.fn() }));
vi.mock("@beep/repo-cli-kit/cli/Stdout", (original) =>
  original<typeof import("@beep/repo-cli-kit/cli/Stdout")>().then((module) => ({
    ...module,
    drainProcessStreams: stdout.drainProcessStreams,
    writeBestEffortLine: stdout.writeBestEffortLine,
  }))
);

const drained = (failure: O.Option<unknown>) =>
  Effect.sync(() => {
    stdout.writeBestEffortLine.mockReset();
    stdout.drainProcessStreams
      .mockReset()
      .mockImplementation((done: (failure: O.Option<unknown>) => void) => done(failure));
    const onDrained = vi.fn();
    return onDrained;
  });

it.effect("exits without a report when both streams drained", () =>
  Effect.gen(function* () {
    const onDrained = yield* drained(O.none());
    drainThenExit({ label: "beep-ci", code: 0, onDrained });
    expect(onDrained).toHaveBeenCalledOnce();
    expect(stdout.writeBestEffortLine).not.toHaveBeenCalled();
  })
);

it.effect("reports dropped stdout lines on stderr, then exits", () =>
  Effect.gen(function* () {
    const onDrained = yield* drained(O.some({ stream: "stdout", message: "EPIPE", droppedLines: 2 }));
    drainThenExit({ label: "beep-ci", code: 3, onDrained });
    expect(stdout.writeBestEffortLine).toHaveBeenCalledWith(
      process.stderr,
      process.stdout,
      "[beep-ci] exiting with code 3; stdout write failed: EPIPE; 2 line(s) dropped\n"
    );
    expect(onDrained).toHaveBeenCalledOnce();
  })
);

it.effect("reports dropped stderr lines on stdout, then exits", () =>
  Effect.gen(function* () {
    const onDrained = yield* drained(O.some({ stream: "stderr", message: "EBADF", droppedLines: 1 }));
    drainThenExit({ label: "beep", code: 1, onDrained });
    expect(stdout.writeBestEffortLine).toHaveBeenCalledWith(
      process.stdout,
      process.stderr,
      "[beep] exiting with code 1; stderr write failed: EBADF; 1 line(s) dropped\n"
    );
    expect(onDrained).toHaveBeenCalledOnce();
  })
);
