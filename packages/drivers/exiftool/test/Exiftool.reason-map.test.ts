/**
 * Reason map for the exiftool process boundary: every failure the driver
 * could report before it moved onto `@beep/commands` `Run.collect` still
 * reports the same message, operation, captured context and cause.
 */
import { CommandOutputError, DEFAULT_MAX_OUTPUT_BYTES } from "@beep/commands/Run";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Exiftool } from "@beep/exiftool";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";

const RUN_FAILURE_MESSAGE = "Failed to run exiftool. Install exiftool or configure exiftoolPath.";

const readFailure = PlatformError.systemError({
  _tag: "Unknown",
  module: "ChildProcess",
  method: "fromReadable(stdout)",
  description: "stdout pipe broke",
});

const handleWith = (stdout: Stream.Stream<Uint8Array, PlatformError.PlatformError>) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout,
    unref: Effect.succeed(Effect.void),
  });

const readFailingHandle = readFailure.pipe(Stream.fail, handleWith);

// The driver raises the kit's per-stream capture budget; one byte past it.
// The buffer is left unfilled: the kit counts bytes before decoding, so the
// zeroed pages are never touched.
const EXIFTOOL_MAX_OUTPUT_BYTES = 128 * 1024 * 1024;
const oversizedStdout = Stream.succeed(new Uint8Array(EXIFTOOL_MAX_OUTPUT_BYTES + 1));
const oversizedHandle = handleWith(oversizedStdout);

const spawnerOf = (spawn: () => Effect.Effect<ChildProcessSpawner.ChildProcessHandle, PlatformError.PlatformError>) =>
  Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, ChildProcessSpawner.make(spawn));

const exiftoolOver = (spawner: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>) =>
  Exiftool.makeLayer().pipe(Layer.provide(spawner), Layer.provide(Layer.merge(MemoryFileSystem.layer, Path.layer)));

const versionFailure = Effect.gen(function* () {
  const exiftool = yield* Exiftool;
  return yield* Effect.flip(exiftool.version);
});

describe("@beep/exiftool process reason map", () => {
  const spawnFailure = ScriptedSpawner.notFound("exiftool");
  it.layer(exiftoolOver(spawnerOf(() => Effect.fail(spawnFailure))), { timeout: "30 seconds" })(
    "when the executable cannot start",
    (it) => {
      it.effect(
        "reports the run failure with the platform failure as its cause",
        Effect.fnUntraced(function* () {
          const error = yield* versionFailure;
          expect(error.operation).toBe("version");
          expect(error.message).toBe(RUN_FAILURE_MESSAGE);
          assertSome(error.cause, spawnFailure);
          assertNone(error.exitCode);
        })
      );
    }
  );

  it.layer(exiftoolOver(spawnerOf(() => Effect.succeed(readFailingHandle))), {
    timeout: "30 seconds",
  })("when reading the output fails", (it) => {
    it.effect(
      "reports the run failure with the read failure as its cause",
      Effect.fnUntraced(function* () {
        const error = yield* versionFailure;
        expect(error.operation).toBe("version");
        expect(error.message).toBe(RUN_FAILURE_MESSAGE);
        assertSome(error.cause, readFailure);
      })
    );
  });

  it.layer(
    exiftoolOver(ScriptedSpawner.make(() => ({ exit: 2, stdout: " partial \n", stderr: " bad flag \n" })).layer),
    { timeout: "30 seconds" }
  )("when the process exits non-zero", (it) => {
    it.effect(
      "reports the exit with trimmed captured streams",
      Effect.fnUntraced(function* () {
        const error = yield* versionFailure;
        expect(error.operation).toBe("version");
        expect(error.message).toBe("exiftool could not report its version.");
        assertSome(error.command, "exiftool");
        assertSome(error.exitCode, 2);
        assertSome(error.stderr, "bad flag");
        assertSome(error.stdout, "partial");
        assertNone(error.cause);
      })
    );
  });

  // New with the kit: captured output is bounded. The hand-rolled fold had no
  // ceiling, so this row has no predecessor; it reports as a run failure.
  it.layer(exiftoolOver(spawnerOf(() => Effect.succeed(oversizedHandle))), { timeout: "30 seconds" })(
    "when the output exceeds the capture bound",
    (it) => {
      it.effect(
        "reports the run failure with the kit's tooLarge error as its cause",
        Effect.fnUntraced(function* () {
          const error = yield* versionFailure;
          expect(error.message).toBe(RUN_FAILURE_MESSAGE);
          const cause = O.getOrUndefined(error.cause);
          assertInstanceOf(cause, CommandOutputError);
          expect(cause.kind).toBe("tooLarge");
          expect(cause.cause).toMatchObject({ limit: EXIFTOOL_MAX_OUTPUT_BYTES });
          expect(EXIFTOOL_MAX_OUTPUT_BYTES).toBeGreaterThan(DEFAULT_MAX_OUTPUT_BYTES);
        })
      );
    }
  );
});
