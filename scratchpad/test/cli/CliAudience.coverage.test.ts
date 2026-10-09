import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CliAudience } from "../../effected/cli/CliAudience.ts";

it.effect("CliAudience retains its runtime class identity", () => Effect.sync(() => {
  assert.isTrue(Reflect.construct(CliAudience, []) instanceof CliAudience);
}));

import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Stdio from "effect/Stdio";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { Command } from "effect/cli";
import { Audience } from "../../effected/env/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { TestTerminal } from "../../effected/cli/testing.ts";

it.layer(Layer.mergeAll(MemoryFileSystem.layer, Path.layer, Layer.mock(ChildProcessSpawner.ChildProcessSpawner, {}), Stdio.layerTest({ args: Effect.succeed(["--ci"]) }), Layer.unwrap(Effect.map(TestTerminal.make(), (terminal) => terminal.layer)), Audience.layerTest("human")), { timeout: "30 seconds" })((it) => {
  it.effect("run reads Stdio arguments and provides the selected audience to the handler", () => Effect.gen(function* () {
    const observed: Array<string> = [];
    const root = Command.make("tool", {}, () => Effect.gen(function* () {
      const audience = yield* Audience;
      observed.push(`${audience.kind}/${audience.source}`);
    })).pipe(Command.withSharedFlags(CliAudience.flags()));
    yield* CliAudience.run(root, { version: "1.0.0" });
    assert.deepStrictEqual(observed, ["ci/flag"]);
  }));
});
