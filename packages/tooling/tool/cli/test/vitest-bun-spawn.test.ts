import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";

it.effect(
  "captures both Bun.spawn output streams and its failing exit under the test runtime",
  Effect.fnUntraced(function* () {
    const child = Bun.spawn(
      ["bun", "--eval", 'console.log("stdout witness"); console.error("stderr witness"); process.exitCode = 7;'],
      { stdin: "ignore", stdout: "pipe", stderr: "pipe" }
    );
    const result = yield* Effect.all({
      exitCode: Effect.promise(() => child.exited),
      stdout: Effect.promise(() => new Response(child.stdout).text()),
      stderr: Effect.promise(() => new Response(child.stderr).text()),
    });
    expect(result).toEqual({ exitCode: 7, stdout: "stdout witness\n", stderr: "stderr witness\n" });
  })
);
