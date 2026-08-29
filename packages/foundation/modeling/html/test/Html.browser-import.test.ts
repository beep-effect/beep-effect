import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

const packageRoot = new URL("..", import.meta.url).pathname;

describe("@beep/html browser import boundary", () => {
  it.effect("loads production conformance when SharedArrayBuffer is absent", () =>
    Effect.gen(function* () {
      const child = Bun.spawn(
        [process.execPath, "-e", 'delete globalThis.SharedArrayBuffer; await import("@beep/html/Html.conformance")'],
        {
          cwd: packageRoot,
          stderr: "pipe",
          stdout: "ignore",
        }
      );
      const [exitCode, stderr] = yield* Effect.all([
        Effect.promise(() => child.exited),
        Effect.promise(() => new Response(child.stderr).text()),
      ]);

      expect({ exitCode, stderr }).toStrictEqual({ exitCode: 0, stderr: "" });
    })
  );
});
