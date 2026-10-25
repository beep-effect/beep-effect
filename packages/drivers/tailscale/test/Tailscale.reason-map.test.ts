/**
 * Reason map for the Tailscale process boundary: every failure the driver
 * could report before it moved onto `@beep/commands` `Run.collect` still maps
 * to the same tagged error, command context and cause.
 */
import { CommandOutputError, DEFAULT_MAX_OUTPUT_BYTES } from "@beep/commands/Run";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import {
  ensureTailscaleServe,
  readTailscaleStatus,
  TailscaleCommandOutputError,
  TailscaleCommandSpawnError,
} from "@beep/tailscale";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";

const readFailure = PlatformError.systemError({
  _tag: "Unknown",
  module: "ChildProcess",
  method: "fromReadable(stdout)",
  description: "stdout pipe broke",
});

const exitFailure = PlatformError.systemError({
  _tag: "Unknown",
  module: "ChildProcess",
  method: "exitCode",
  description: "exit status unavailable",
});

// The Node spawner checks a working directory with `fs.access` before it
// spawns; that failure happens before the handle exists, so it is a spawn
// error even though its method is not "spawn".
const accessFailure = PlatformError.systemError({
  _tag: "NotFound",
  module: "FileSystem",
  method: "access",
  description: "working directory missing",
});

const handleWith = (options: {
  readonly stdout?: Stream.Stream<Uint8Array, PlatformError.PlatformError>;
  readonly stderr?: Stream.Stream<Uint8Array, PlatformError.PlatformError>;
  readonly exitCode?: Effect.Effect<ChildProcessSpawner.ExitCode, PlatformError.PlatformError>;
}) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    exitCode: options.exitCode ?? Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: options.stderr ?? Stream.empty,
    stdin: Sink.drain,
    stdout: options.stdout ?? Stream.empty,
    unref: Effect.succeed(Effect.void),
  });

const spawnerOf = (handle: ChildProcessSpawner.ChildProcessHandle) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.succeed(handle))
  );

const oversized = Stream.succeed(new Uint8Array(DEFAULT_MAX_OUTPUT_BYTES + 1).fill(0x61));

describe("@beep/tailscale process reason map", () => {
  const spawnFailure = ScriptedSpawner.notFound("tailscale");
  it.layer(
    Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make(() => Effect.fail(spawnFailure))
    ),
    { timeout: "30 seconds" }
  )("when the executable cannot start", (it) => {
    it.effect(
      "maps serve to a spawn error carrying the platform failure",
      Effect.fnUntraced(function* () {
        const error = yield* Effect.flip(ensureTailscaleServe({ localPort: 3000 }));
        assertInstanceOf(error, TailscaleCommandSpawnError);
        expect(error.subcommand).toBe("serve");
        expect(error.argumentCount).toBe(4);
        expect(error.cause).toBe(spawnFailure);
      })
    );
  });

  it.layer(
    Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make(() => Effect.fail(accessFailure))
    ),
    { timeout: "30 seconds" }
  )("when a pre-spawn check fails", (it) => {
    it.effect(
      "maps status to a spawn error carrying the access failure",
      Effect.fnUntraced(function* () {
        const error = yield* Effect.flip(readTailscaleStatus);
        assertInstanceOf(error, TailscaleCommandSpawnError);
        expect(error.subcommand).toBe("status");
        expect(error.cause).toBe(accessFailure);
      })
    );
  });

  it.layer(spawnerOf(handleWith({ stdout: Stream.fail(readFailure) })), { timeout: "30 seconds" })(
    "when reading stdout fails",
    (it) => {
      it.effect(
        "maps status to an output error carrying the read failure",
        Effect.fnUntraced(function* () {
          const error = yield* Effect.flip(readTailscaleStatus);
          assertInstanceOf(error, TailscaleCommandOutputError);
          expect(error.subcommand).toBe("status");
          expect(error.argumentCount).toBe(2);
          expect(error.cause).toBe(readFailure);
          expect(error.message).toBe("Failed to read output from tailscale status.");
        })
      );
    }
  );

  it.layer(spawnerOf(handleWith({ stderr: Stream.fail(readFailure) })), { timeout: "30 seconds" })(
    "when reading stderr fails",
    (it) => {
      it.effect(
        "maps serve to an output error carrying the read failure",
        Effect.fnUntraced(function* () {
          const error = yield* Effect.flip(ensureTailscaleServe({ localPort: 3000 }));
          assertInstanceOf(error, TailscaleCommandOutputError);
          expect(error.subcommand).toBe("serve");
          expect(error.cause).toBe(readFailure);
        })
      );
    }
  );

  it.layer(spawnerOf(handleWith({ exitCode: Effect.fail(exitFailure) })), { timeout: "30 seconds" })(
    "when awaiting the exit fails",
    (it) => {
      it.effect(
        "maps status to an output error carrying the exit failure",
        Effect.fnUntraced(function* () {
          const error = yield* Effect.flip(readTailscaleStatus);
          assertInstanceOf(error, TailscaleCommandOutputError);
          expect(error.cause).toBe(exitFailure);
        })
      );
    }
  );

  // New with the kit: captured output is bounded. The hand-rolled fold had no
  // ceiling, so this row has no predecessor; it reports as an output error.
  it.layer(spawnerOf(handleWith({ stdout: oversized })), { timeout: "30 seconds" })(
    "when stdout exceeds the capture bound",
    (it) => {
      it.effect(
        "maps status to an output error carrying the kit's tooLarge error",
        Effect.fnUntraced(function* () {
          const error = yield* Effect.flip(readTailscaleStatus);
          assertInstanceOf(error, TailscaleCommandOutputError);
          assertInstanceOf(error.cause, CommandOutputError);
          expect(error.cause.kind).toBe("tooLarge");
        })
      );
    }
  );
});
