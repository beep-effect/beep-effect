import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Str from "effect/String";

const PROBE = A.join(
  [
    'const reporter = await import("./src/Vitest.reporter.ts");',
    'const run = await import("./src/internal/GateVitestRun.ts");',
    "console.log(typeof reporter.default, typeof run.makeGateVitestRun, typeof run.writeRunRecord);",
  ],
  "\n"
);

it.layer(NodeServices.layer, { timeout: "60 seconds" })(
  "runtime boundary: Vitest's main process is Bun under bunx --bun vitest and Node under plain bunx vitest",
  (it) => {
    it.effect(
      "Node loads the reporter and its implementation with every module they reach, so no bun: module is reachable",
      () =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
          const output = yield* spawner.string(
            ChildProcess.make("node", ["--input-type=module", "-e", PROBE], {
              cwd: path.resolve(import.meta.dirname, ".."),
            })
          );
          assert.strictEqual(Str.trim(output), "function function function");
        })
    );
  }
);
