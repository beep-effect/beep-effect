import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

const fixture = new URL("./fixtures/doctest-lane/package/", import.meta.url).pathname;
const vitestBin = new URL("../../../../../node_modules/vitest/vitest.mjs", import.meta.url).pathname;
const resultPath = `/tmp/beep-doctest-lane-${process.pid}.json`;

describe("doctest lane fixture", () => {
  it.effect("loads the plugin and executes one marked assertion", () =>
    Effect.gen(function* () {
      const child = Bun.spawn(
        [
          "bun",
          vitestBin,
          "run",
          "--config",
          "vitest.docs.ts",
          "--pool=threads",
          "--maxWorkers=1",
          "--reporter=json",
          `--outputFile=${resultPath}`,
        ],
        {
          cwd: fixture,
          env: {
            ...Bun.env,
            VITEST: undefined,
            VITEST_MODE: undefined,
            VITEST_POOL_ID: undefined,
            VITEST_WORKER_ID: undefined,
          },
          stdout: "ignore",
          stderr: "pipe",
          stdin: "ignore",
        }
      );
      const [exitCode, stderr] = yield* Effect.promise(() =>
        Promise.all([child.exited, new Response(child.stderr).text()])
      );
      expect(exitCode, stderr).toBe(0);
      const result = yield* Effect.promise(() => Bun.file(resultPath).text());
      expect(result).toContain('"numPassedTestSuites":1');
      expect(result).toContain('"numPassedTests":1');
    })
  );
});
