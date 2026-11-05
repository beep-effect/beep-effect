import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { runQaDoctor } from "@beep/repo-cli/commands/Qa/Doctor";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const unavailable = PlatformError.systemError({
  _tag: "NotFound",
  module: "ChildProcess",
  method: "spawn",
  pathOrDescriptor: "synthetic-missing-tool",
});
const Platform = Layer.mergeAll(
  MemoryFileSystem.layer,
  NodePath.layer,
  BunCrypto.layer,
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.fail(unavailable))
  )
);

it.layer(Platform, { timeout: "30 seconds" })("QA environment probes", (it) => {
  it.effect("reports an unavailable OBS socket as an optional warning without rejecting the doctor report", () =>
    Effect.gen(function* () {
      const connection = yield* Effect.acquireRelease(
        Effect.sync(() => {
          if (P.isFunction(Bun.connect)) {
            const connect = vi.spyOn(Bun, "connect").mockRejectedValueOnce(unavailable);
            return { connect, restore: () => connect.mockRestore() };
          }
          const connect = vi.fn().mockRejectedValueOnce(unavailable);
          vi.stubGlobal("Bun", { ...Bun, version: "synthetic-test-runtime", connect });
          return { connect, restore: () => vi.unstubAllGlobals() };
        }),
        (connection) => Effect.sync(connection.restore)
      );
      const probes = yield* runQaDoctor();
      expect(A.findFirst(probes, (probe) => probe.name === "obs-websocket")).toMatchObject({
        _tag: "Some",
        value: { status: "warn", required: false },
      });
      expect(probes).toHaveLength(6);
      expect(connection.connect).toHaveBeenCalledOnce();
    })
  );
});
