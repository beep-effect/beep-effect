import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

const packageRoot = new URL("..", import.meta.url).pathname;

describe("@beep/html browser import boundary", () => {
  it.effect("loads production conformance when SharedArrayBuffer is absent", () =>
    Effect.gen(function* () {
      const { child, stderr: readStderr } = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const child = Bun.spawn(
            [
              process.execPath,
              "-e",
              'delete globalThis.SharedArrayBuffer; await import("@beep/html/Html.conformance")',
            ],
            {
              cwd: packageRoot,
              stderr: "pipe",
              stdout: "ignore",
            }
          );
          return { child, stderr: new Response(child.stderr).text() };
        }).pipe(Effect.withSpan("Html.browserImport.spawn")),
        ({ child, stderr }) =>
          Effect.promise(() => {
            if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
            return Promise.allSettled([child.exited, stderr]);
          }).pipe(Effect.withSpan("Html.browserImport.cleanup"))
      );
      const [exitCode, stderr] = yield* Effect.all([
        Effect.promise(() => child.exited).pipe(Effect.withSpan("Html.browserImport.exit")),
        Effect.promise(() => readStderr).pipe(Effect.withSpan("Html.browserImport.drain")),
      ]).pipe(Effect.withSpan("Html.browserImport.import"));

      expect({ exitCode, stderr }).toStrictEqual({ exitCode: 0, stderr: "" });
    })
  );
});
