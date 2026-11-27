import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const HOST_PATH_WITHOUT_BUN_NODE_SHIM = Config.String("PATH").pipe(
  Config.withDefault(""),
  Config.map((path) =>
    A.join(
      A.filter(Str.split(path, ":"), (dir) => !Str.includes("/bun-node-")(dir)),
      ":"
    )
  )
);

const FIXTURES = `${import.meta.dirname}/fixtures`;

const fileSystemUnusedWithoutCwd = FileSystem.layerNoop({});
const Platform = NodeChildProcessSpawner.layer.pipe(
  Layer.provide(Layer.mergeAll(fileSystemUnusedWithoutCwd, NodePath.layer)),
  Layer.merge(NodePath.layer)
);

const run = Effect.fn("run")(function* (args: ReadonlyArray<string>, stdin: string) {
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const command = ChildProcess.make(
    "node",
    ["--import", path.join(FIXTURES, "register-ts.mjs"), path.join(FIXTURES, "stdin-gate.mjs"), ...args],
    {
      env: { PATH: yield* HOST_PATH_WITHOUT_BUN_NODE_SHIM, NO_COLOR: "1" },
      stdin: Stream.make(new TextEncoder().encode(stdin)),
    }
  );
  const handle = yield* spawner.spawn(command);
  const text = <E>(stream: Stream.Stream<Uint8Array, E>) => stream.pipe(Stream.decodeText, Stream.mkString);
  const [stdout, stderr, exitCode] = yield* Effect.all([text(handle.stdout), text(handle.stderr), handle.exitCode], {
    concurrency: "unbounded",
  });
  return { stdout, stderr, exitCode: Number(exitCode) };
});

it.layer(Platform, { timeout: "30 seconds" })(
  "a non-interactive run never consumes piped stdin: a real Node child, a real pipe, NodeTerminal's readline",
  (it) => {
    it.effect(
      "a handler that waits before reading still gets every byte, through the fallback path",
      () =>
        Effect.gen(function* () {
          const { stdout, stderr, exitCode } = yield* run(["read"], "hello world");
          assert.strictEqual(
            exitCode,
            0,
            `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX means a reachable module is not type-strip-clean: ${stderr}`
          );
          assert.include(stdout, "bytes=11");
        }),
      { timeout: 30_000 }
    );

    it.effect(
      "control: with the flag given, the same handler also gets every byte",
      () =>
        Effect.gen(function* () {
          const { stdout, stderr, exitCode } = yield* run(["read", "--profile", "x"], "hello world");
          assert.strictEqual(exitCode, 0, stderr);
          assert.include(stdout, "bytes=11");
        }),
      { timeout: 30_000 }
    );
  }
);
