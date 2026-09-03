import * as O from "@beep/utils/Option";
import { assert, describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { pickVaultDirectoryOnHost } from "../src/intake/VaultDirectoryPickerOrchestrator";

const encoder = new TextEncoder();

const mockHandle = (result: { stdout?: string; code?: number }) =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(result.code ?? 0)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    unref: Effect.succeed(Effect.void),
    stdin: Sink.drain,
    stdout: Stream.make(encoder.encode(result.stdout ?? "")),
    stderr: Stream.empty,
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  });

const spawnNotFound = PlatformError.systemError({
  _tag: "NotFound",
  module: "ChildProcess",
  method: "spawn",
  cause: new Error("executable not found"),
});

const mockSpawnerLayer = (
  handler: (command: ChildProcess.StandardCommand) => { stdout?: string; code?: number } | "missing"
): Layer.Layer<ChildProcessSpawner.ChildProcessSpawner> =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) return Effect.die("Expected a standard picker command");
      const result = handler(command);
      return result === "missing" ? Effect.fail(spawnNotFound) : Effect.succeed(mockHandle(result));
    })
  );

describe("pickVaultDirectoryOnHost", () => {
  layer(
    mockSpawnerLayer((command) => {
      assert.strictEqual(command.command, "kdialog");
      assert.deepStrictEqual(command.args, [
        "--title",
        "Select workspace vault",
        "--getexistingdirectory",
        "/home/user",
      ]);
      assert.strictEqual(command.options.stdin, "ignore");
      assert.strictEqual(command.options.stdout, "pipe");
      assert.strictEqual(command.options.stderr, "ignore");
      return { stdout: "/home/user/vault1\n" };
    })
  )("with a kdialog selection", (it) => {
    it.effect(
      "returns the picked path from kdialog stdout",
      Effect.fnUntraced(function* () {
        const selected = yield* pickVaultDirectoryOnHost("/home/user");
        assert.deepStrictEqual(selected, O.some("/home/user/vault1"));
      })
    );
  });

  layer(mockSpawnerLayer(() => ({ code: 1 })))("with a cancelled dialog", (it) => {
    it.effect(
      "returns None",
      Effect.fnUntraced(function* () {
        const selected = yield* pickVaultDirectoryOnHost("/home/user");
        assert.isTrue(O.isNone(selected));
      })
    );
  });

  layer(mockSpawnerLayer(() => ({ stdout: "  \n" })))("with a clean exit but no selection", (it) => {
    it.effect(
      "returns None",
      Effect.fnUntraced(function* () {
        const selected = yield* pickVaultDirectoryOnHost("/home/user");
        assert.isTrue(O.isNone(selected));
      })
    );
  });

  layer(mockSpawnerLayer((command) => (command.command === "kdialog" ? "missing" : { stdout: "/home/user/vault2\n" })))(
    "with kdialog missing and zenity available",
    (it) => {
      it.effect(
        "falls back to zenity",
        Effect.fnUntraced(function* () {
          const selected = yield* pickVaultDirectoryOnHost("/home/user");
          assert.deepStrictEqual(selected, O.some("/home/user/vault2"));
        })
      );
    }
  );

  layer(mockSpawnerLayer(() => "missing"))("with no picker command available", (it) => {
    it.effect(
      "fails with a client-safe error",
      Effect.fnUntraced(function* () {
        const error = yield* pickVaultDirectoryOnHost("/home/user").pipe(Effect.flip);
        assert.strictEqual(error._tag, "VaultDirectoryPickError");
        assert.strictEqual(error.message, "Native folder dialog unavailable on this host.");
      })
    );
  });
});
