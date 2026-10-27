/**
 * Reason map for the detached OBS spawn: every failure the driver could
 * report before it moved onto `@beep/commands` `Run.detach` still maps to the
 * same operation, message and cause.
 */
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Obs, ObsError } from "@beep/obs";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Socket from "effect/socket/Socket";

const SPAWN_FAILURE_MESSAGE = 'Failed to spawn "obs" — install OBS Studio or configure obsBinaryPath.';

// A socket that is already closed: the probe fails with a "connect" error, so
// the driver goes on to spawn OBS.
const closedSocket: Socket.WebSocketLike = {
  readyState: 3,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  close: () => undefined,
  send: () => undefined,
};
const UnreachableObs = Layer.succeed(Socket.WebSocketConstructor, () => closedSocket);

const unrefFailure = PlatformError.systemError({
  _tag: "Unknown",
  module: "ChildProcess",
  method: "unref",
  description: "unref refused",
});

const unrefFailingHandle = ChildProcessSpawner.makeHandle({
  all: Stream.empty,
  exitCode: Effect.never,
  getInputFd: () => Sink.drain,
  getOutputFd: () => Stream.empty,
  isRunning: Effect.succeed(true),
  kill: () => Effect.void,
  pid: ChildProcessSpawner.ProcessId(1),
  stderr: Stream.empty,
  stdin: Sink.drain,
  stdout: Stream.empty,
  unref: Effect.fail(unrefFailure),
});

const spawnerOf = (spawn: () => Effect.Effect<ChildProcessSpawner.ChildProcessHandle, PlatformError.PlatformError>) =>
  Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, ChildProcessSpawner.make(spawn));

// The layer under test is the one that fails, so each case builds it in its
// own test scope instead of through `it.layer`.
const ObsOver = (spawner: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>) =>
  Obs.makeLayer().pipe(Layer.provide(Layer.merge(UnreachableObs, spawner)));

describe("@beep/obs detached spawn reason map", () => {
  it.effect(
    "reports a spawn failure as ensureRunning with the platform failure as its cause",
    Effect.fnUntraced(function* () {
      const spawnFailure = ScriptedSpawner.notFound("obs");
      const spawner = spawnerOf(() => Effect.fail(spawnFailure));
      const error = yield* spawner.pipe(ObsOver, Layer.build, Effect.flip);
      assertInstanceOf(error, ObsError);
      expect(error.operation).toBe("ensureRunning");
      expect(error.message).toBe(SPAWN_FAILURE_MESSAGE);
      assertSome(error.cause, spawnFailure);
    })
  );

  it.effect(
    "reports an unref failure the same way, with the unref failure as its cause",
    Effect.fnUntraced(function* () {
      const spawner = spawnerOf(() => Effect.succeed(unrefFailingHandle));
      const error = yield* spawner.pipe(ObsOver, Layer.build, Effect.flip);
      assertInstanceOf(error, ObsError);
      expect(error.operation).toBe("ensureRunning");
      expect(error.message).toBe(SPAWN_FAILURE_MESSAGE);
      assertSome(error.cause, unrefFailure);
    })
  );
});
