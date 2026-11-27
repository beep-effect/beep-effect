import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Str from "effect/String";

const PROBE = 'import("@beep/repo-gate-record").then((m) => console.log(Object.keys(m).includes("GateRecordStore")))';

it.layer(NodeServices.layer, { timeout: "60 seconds" })("runtime boundary", (it) => {
  it.effect("Node loads the package entry with every module it reaches", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const output = yield* spawner.string(
        ChildProcess.make("node", ["--input-type=module", "-e", PROBE], {
          cwd: path.resolve(import.meta.dirname, ".."),
        })
      );
      assert.strictEqual(
        Str.trim(output),
        "true",
        "a Vitest reporter loads this library in Node as well as Bun, which fails when any bun: module is reachable"
      );
    })
  );
});
