import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { dryRunFlag, forceFlag, outputFlag, packageFlag, verboseFlag } from "@beep/repo-cli/test/Cli";
import { expect, it } from "@effect/vitest";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";

const TestLayer = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  Stdio.layerTest({}),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      size: Effect.die("Flag parsing must not prompt."),
      readInput: Effect.die("Flag parsing must not prompt."),
      readLine: Effect.die("Flag parsing must not prompt."),
      display: () => Effect.void,
    })
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("Flag parsing must not spawn subprocesses."))
  )
);

const testCommand = Effect.gen(function* () {
  const parsed = yield* Ref.make({ package: "", output: "", verbose: false, dryRun: false, force: false });
  const command = Command.make(
    "shared-flags",
    {
      package: packageFlag(),
      output: outputFlag(),
      verbose: verboseFlag(),
      dryRun: dryRunFlag(),
      force: forceFlag(),
    },
    (value) => Ref.set(parsed, value)
  );
  return { run: Command.runWith(command, { version: "test", renderErrors: false }), parsed };
});

it.layer(TestLayer, { timeout: "30 seconds" })("shared flag factory defaults", (it) => {
  it.effect("parses required paths while omitted booleans retain their safe defaults", () =>
    Effect.gen(function* () {
      const { run, parsed } = yield* testCommand;
      yield* run(["--package", "@beep/schema", "--output", "report.json"]);
      expect(yield* Ref.get(parsed)).toEqual({
        package: "@beep/schema",
        output: "report.json",
        verbose: false,
        dryRun: false,
        force: false,
      });
    })
  );

  it.effect("preserves short aliases and independently enables all three boolean switches", () =>
    Effect.gen(function* () {
      const { run, parsed } = yield* testCommand;
      yield* run(["-p", "@beep/schema", "-o", "report.json", "--verbose", "--dry-run", "--force"]);
      expect(yield* Ref.get(parsed)).toEqual({
        package: "@beep/schema",
        output: "report.json",
        verbose: true,
        dryRun: true,
        force: true,
      });
    })
  );
});
