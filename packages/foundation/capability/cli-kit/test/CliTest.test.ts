import { CliTest } from "@beep/cli-kit/testing";
import { MemoryFileSystem } from "@beep/memfs";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert, it } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";

const HOST_PATH = Config.String("PATH").pipe(Config.withDefault(""));
const HOST_HOME = Config.option(Config.String("HOME"));

const FIXTURES = `${import.meta.dirname}/fixtures`;
const BIN = `${FIXTURES}/exit3.mjs`;

// The sandbox is laid out on memfs: the child reads its directories from the env and never visits them. The child runs
// in the fixtures directory, so the real spawner, which touches its file system only to check an explicit cwd, gets a
// noop one that grants that check.
const Spawner = NodeChildProcessSpawner.layer.pipe(
  Layer.provide(Layer.mergeAll(FileSystem.layerNoop({ access: () => Effect.void }), NodePath.layer))
);
const Platform = Layer.mergeAll(Spawner, MemoryFileSystem.layer, NodePath.layer);

it.layer(Platform, { timeout: "30 seconds" })("CliTest", (it) => {
  it.effect("a non-zero exit is data, and both streams are captured", () =>
    Effect.gen(function* () {
      const sandbox = yield* CliTest.sandbox({ path: yield* HOST_PATH });
      const result = yield* CliTest.run(BIN, [], { sandbox, cwd: FIXTURES, execPath: process.execPath, stdin: "" });
      assert.strictEqual(result.exitCode, 3);
      assert.strictEqual(result.stdout, `home=${sandbox.home}\n`);
      assert.strictEqual(result.stderr, "error: something failed\n");
    })
  );

  it.effect("the sandbox never inherits the host HOME", () =>
    Effect.gen(function* () {
      const sandbox = yield* CliTest.sandbox({ path: yield* HOST_PATH });
      const HOST_HOME1 = yield* HOST_HOME;
      assert.notStrictEqual(sandbox.env.HOME, O.getOrUndefined(HOST_HOME1));
      assert.strictEqual(sandbox.env.NO_COLOR, "1");
      assert.isTrue(O.exists(O.fromUndefinedOr(sandbox.env.XDG_CONFIG_HOME), Str.startsWith(sandbox.home)));
    })
  );

  it.effect("stdin is delivered to the child", () =>
    Effect.gen(function* () {
      const sandbox = yield* CliTest.sandbox({ path: yield* HOST_PATH });
      const result = yield* CliTest.run(BIN, [], {
        sandbox,
        cwd: FIXTURES,
        execPath: process.execPath,
        stdin: "hello",
      });
      assert.isTrue(Str.includes("stdin=hello")(result.stdout));
    })
  );

  it.effect("without a cwd the child runs in the sandbox root", () =>
    Effect.gen(function* () {
      const made = yield* CliTest.sandbox({ path: yield* HOST_PATH });
      // A sandbox whose root is a real directory: the fixtures, which the child can run in.
      const sandbox = { ...made, root: FIXTURES };
      const result = yield* CliTest.run(BIN, [], { sandbox, execPath: process.execPath, stdin: "" });
      assert.strictEqual(result.exitCode, 3);
    })
  );

  it.effect(
    "omitted stdin completes rather than hanging on an open pipe",
    () =>
      Effect.gen(function* () {
        const sandbox = yield* CliTest.sandbox({ path: yield* HOST_PATH });
        const result = yield* CliTest.run(BIN, [], { sandbox, cwd: FIXTURES, execPath: process.execPath });
        assert.strictEqual(result.exitCode, 3);
        assert.isFalse(Str.includes("stdin=")(result.stdout));
      }),
    { timeout: 5000 }
  );
});
