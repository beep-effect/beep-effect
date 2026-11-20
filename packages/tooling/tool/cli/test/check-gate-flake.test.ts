// The no-location TS2589 flake detector after the check gate: a failed
// `check` task's compiler lines live in the package's raw log, so the lane
// output the detector scans is joined with those logs, prefixed as Turbo
// prefixes task output, and the detector sees the diagnostics it saw before.

import { Git } from "@beep/git/Git";
import { CapturedRun } from "@beep/repo-cli/commands/Gate";
import {
  QualityTaskStep,
  settleQuarantineForTesting,
  withCheckGateLogsForTesting,
} from "@beep/repo-cli/commands/Quality/Tasks";
import {
  detectNoLocationTs2589Flake,
  FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH,
  failedTurboTasks,
} from "@beep/repo-cli/test/Quality";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";

// The quarantine runs only outside CI; a hosted runner sets these.
const withoutCi = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const saved = { CI: Bun.env.CI, GITHUB_ACTIONS: Bun.env.GITHUB_ACTIONS };
      delete Bun.env.CI;
      delete Bun.env.GITHUB_ACTIONS;
      return saved;
    }),
    () => use,
    (saved) =>
      Effect.sync(() => {
        if (saved.CI !== undefined) Bun.env.CI = saved.CI;
        if (saved.GITHUB_ACTIONS !== undefined) Bun.env.GITHUB_ACTIONS = saved.GITHUB_ACTIONS;
      })
  );

const TS2589 = "error TS2589: Type instantiation is excessively deep and possibly infinite.";
const FOOTER = " ERROR  run failed: command  exited (2)\nFailed:    @beep/demo#check";

const workspace = Effect.fn("CheckGateFlakeTest.workspace")(function* (log: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "check-gate-flake-" });
  const packageRoot = path.join(root, "packages/demo");
  yield* fs.makeDirectory(path.join(packageRoot, ".beep/gates/check"), { recursive: true });
  yield* fs.writeFileString(path.join(root, "package.json"), '{"name":"root","workspaces":["packages/*"]}');
  yield* fs.writeFileString(path.join(packageRoot, "package.json"), '{"name":"@beep/demo"}');
  yield* fs.writeFileString(path.join(packageRoot, ".beep/gates/check/report.log"), log);
  return root;
});

describe("failedTurboTasks", () => {
  it("reads the tasks Turbo's failure footer names, once each", () => {
    assert.deepStrictEqual(
      A.map(failedTurboTasks(`${FOOTER}, @beep/demo#check, @beep/other#test`), (task) => task.taskId),
      ["@beep/demo#check", "@beep/other#test"]
    );
  });
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("check gate logs", (it) => {
  it.effect("joins a failed check task's raw log so the flake signature is still detected", () =>
    Effect.gen(function* () {
      const root = yield* workspace(`$ tsrs -p tsconfig.json --emitDeclarationOnly\n${TS2589}\n`);
      const gateConsole = "@beep/demo:check: check @beep/demo tsconfig.json: FAILED, 1 error, 0 warnings";
      assertNone(detectNoLocationTs2589Flake(`${gateConsole}\n${FOOTER}`));
      const scanned = yield* withCheckGateLogsForTesting(root, `${gateConsole}\n${FOOTER}`);
      assert.isTrue(Str.includes(`@beep/demo:check: ${TS2589}`)(scanned));
      assert.deepStrictEqual(
        O.map(
          detectNoLocationTs2589Flake(scanned),
          A.map((task) => task.taskId)
        ),
        O.some(["@beep/demo#check"])
      );
    })
  );

  it.effect("keeps a located diagnostic in the log disqualifying, as before the gate", () =>
    Effect.gen(function* () {
      const root = yield* workspace(`src/a.ts(1,7): error TS2322: nope\n${TS2589}\n`);
      const scanned = yield* withCheckGateLogsForTesting(root, FOOTER);
      assertNone(detectNoLocationTs2589Flake(scanned));
    })
  );

  it.effect("leaves the output alone when no check task failed or no workspace is readable", () =>
    Effect.gen(function* () {
      const root = yield* workspace(TS2589);
      const green = yield* withCheckGateLogsForTesting(root, "Tasks: 3 successful");
      assert.strictEqual(green, "Tasks: 3 successful");
      const fs = yield* FileSystem.FileSystem;
      const bare = yield* fs.makeTempDirectoryScoped({ prefix: "check-gate-flake-bare-" });
      const unread = yield* withCheckGateLogsForTesting(bare, FOOTER);
      assert.strictEqual(unread, FOOTER);
    })
  );

  it.effect("reads a missing log as empty", () =>
    Effect.gen(function* () {
      const root = yield* workspace("");
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.remove(path.join(root, "packages/demo/.beep/gates/check/report.log"));
      const scanned = yield* withCheckGateLogsForTesting(root, FOOTER);
      assertNone(detectNoLocationTs2589Flake(scanned));
    })
  );
});

// The root check gate captures its Turbo step and settles the quarantine on
// that output: a quarantined lane counts as green and the artifact is written,
// and anything else keeps the step's own exit code.
const flakyLane = A.join(
  [
    'const statePath = "settle-state.txt";',
    "const stateFile = Bun.file(statePath);",
    "const invocation = (await stateFile.exists()) ? Number(await stateFile.text()) : 0;",
    "await Bun.write(statePath, String(invocation + 1));",
    'const filter = process.argv.find((arg) => arg.startsWith("--filter="));',
    'if (invocation === 0 && filter === "--filter=@beep/demo") process.exit(0);',
    "if (invocation === 1 && filter === undefined) process.exit(0);",
    "process.exit(9);",
  ],
  "\n"
);

// Settling reruns steps through the task path, which also reads git and digests.
it.layer(Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)), {
  timeout: "30 seconds",
})("settling a captured gate step", (it) => {
  const captured = (exitCode: number, text: string) =>
    CapturedRun.make({ exitCode, output: new TextEncoder().encode(text) });

  it.effect("quarantines a matching flake: green, with the artifact written", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* workspace("");
      const step = QualityTaskStep.make({
        label: "check",
        command: "bun",
        args: ["-e", flakyLane],
        cwd: root,
        flakeQuarantine: "ts2589-no-location",
      });
      const exitCode = yield* withoutCi(
        settleQuarantineForTesting(step, captured(2, `@beep/demo:check: ${TS2589}\n${FOOTER}`))
      );
      assert.strictEqual(exitCode, 0);
      const artifact = yield* fs.readFileString(path.join(root, FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH));
      assert.isTrue(Str.includes("@beep/demo#check")(artifact));
    })
  );

  it.effect("keeps a failure without the signature hard, and passes a green step", () =>
    Effect.gen(function* () {
      const root = yield* workspace("src/a.ts(1,7): error TS2322: nope\n");
      const step = QualityTaskStep.make({
        label: "check",
        command: "true",
        args: [],
        cwd: root,
        flakeQuarantine: "ts2589-no-location",
      });
      const hard = yield* withoutCi(settleQuarantineForTesting(step, captured(2, FOOTER)));
      assert.strictEqual(hard, 2);
      const green = yield* withoutCi(settleQuarantineForTesting(step, captured(0, "")));
      assert.strictEqual(green, 0);
      const unguarded = yield* settleQuarantineForTesting(
        QualityTaskStep.make({ label: "check", command: "true", args: [], cwd: root }),
        captured(3, FOOTER)
      );
      assert.strictEqual(unguarded, 3);
    })
  );
});
