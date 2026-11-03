import { available, Collected, runCollected } from "@beep/git/internal/run";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import { scripted } from "../fixtures.ts";

const command = ChildProcess.make("git", ["--version"]);
const failure = PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" });

describe("git command collection coverage", () => {
  it.layer(
    scripted(() => ({ stdout: "out\nλ\n", stderr: "err\r\n", exit: 17 })),
    { timeout: "30 seconds" }
  )("completed process", (it) => {
    it.effect("keeps the streams and nonzero exit code separate and untrimmed", () =>
      Effect.gen(function* () {
        const resultCollected = yield* runCollected(command);
        assert.deepStrictEqual(
          resultCollected,
          Collected.make({ stdout: "out\nλ\n", stderr: "err\r\n", exitCode: 17 })
        );
        const available1 = yield* available(command);
        assertTrue(available1);
      })
    );
  });

  it.layer(
    scripted(() => failure),
    { timeout: "30 seconds" }
  )("missing executable", (it) => {
    it.effect("preserves the exact spawn failure while availability maps it to false", () =>
      Effect.gen(function* () {
        const pipe2 = yield* runCollected(command).pipe(Effect.exit);
        assertExitFailure(pipe2, Cause.fail(failure));
        const available3 = yield* available(command);
        assertFalse(available3);
      })
    );
  });
});
