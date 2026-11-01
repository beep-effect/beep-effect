import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { goalsSetStatusCommand } from "@beep/repo-cli/test/Goals";
import { it } from "@beep/test-runner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Runtime from "effect/Runtime";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";
import * as TestConsole from "effect/testing/TestConsole";

// Input validation rejects before any packet bytes are read: an empty memory
// filesystem holds no goals/ directory, and the command must never prompt or spawn.
const testLayer = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  NodeCrypto.layer,
  Stdio.layerTest({}),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      size: Effect.die("set-status input validation must not prompt."),
      readInput: Effect.die("set-status input validation must not prompt."),
      readLine: Effect.die("set-status input validation must not prompt."),
      display: () => Effect.void,
    })
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("set-status input validation must not spawn subprocesses."))
  )
);

const runSetStatus = Command.runWith(goalsSetStatusCommand, { version: "0.0.0" });

const expectInputRejection = Effect.fnUntraced(function* (args: ReadonlyArray<string>, fragment: string) {
  const exit = yield* Effect.exit(runSetStatus(args));
  exit.pipe(Exit.isFailure, assertTrue);
  if (Exit.isFailure(exit)) {
    expect(exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode)).toBe(1);
  }
  const errors = A.map(yield* TestConsole.errorLines, String);
  assertTrue(A.some(errors, (line) => Str.startsWith("[goals:set-status]")(line) && Str.includes(fragment)(line)));
});

it.layer(testLayer, { concurrent: false, timeout: "20 seconds" })((it) => {
  describe("goals set-status input validation", () => {
    it.effect("rejects slug or status arguments in --migrate mode before touching packets", () =>
      expectInputRejection(["--migrate", "demo"], "--migrate takes no slug/status arguments")
    );

    it.effect("rejects --preview combined with --migrate", () =>
      expectInputRejection(["--migrate", "--preview"], "--migrate has its own dry-run default")
    );

    it.effect("rejects an unknown status with the closed status domain", () =>
      expectInputRejection(["demo", "bogus-status"], 'Unknown status "bogus-status"')
    );

    it.effect("prints usage when the status argument is missing", () =>
      expectInputRejection(["demo"], "Usage: beep goals set-status")
    );

    it.effect(
      "reports a slug with no goal packet directory",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        expect(yield* fs.exists("goals/zz-packet-core-coverage-missing")).toBe(false);
        yield* expectInputRejection(["zz-packet-core-coverage-missing", "active"], 'No goal packet directory "goals/');
      })
    );
  });
});
