import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

const fixture = new URL("./fixtures/doctest-lane/package/", import.meta.url).pathname;
const vitestBin = new URL("../../../../../node_modules/vitest/vitest.mjs", import.meta.url).pathname;
const resultPath = `/tmp/beep-doctest-lane-${process.pid}.json`;

describe("doctest lane fixture", () => {
  it.effect("keeps ordinary mode and makes doctest mode strict even during coverage", () =>
    Effect.gen(function* () {
      const shared = new URL("../../../../../vitest.shared.ts", import.meta.url).href;
      for (const active of [false, true]) {
        const child = Bun.spawn(
          [
            "bun",
            "--eval",
            `
          import config, { vitestDoctestActive } from "${shared}";
          import { strictEqual, deepStrictEqual } from "node:assert";
          strictEqual(vitestDoctestActive, ${active});
          deepStrictEqual(config.test.include, ${active} ? [] : ["test/**/*.test.{ts,tsx}"]);
          deepStrictEqual(config.test.includeSource, ${active} ? ["src/**/*.{ts,tsx}"] : []);
          strictEqual(config.test.passWithNoTests, ${!active});
          strictEqual(config.test.sequence.concurrent, ${!active});
          strictEqual(config.test.exclude.includes("**/test/fixtures/**"), ${active});
          strictEqual(config.plugins.length, ${active ? 2 : 1});
        `,
          ],
          {
            cwd: fixture,
            env: { ...Bun.env, BEEP_VITEST_DOCTEST: active ? "1" : "0", VITEST_COVERAGE_REPORT_ONLY: "1" },
            stdout: "ignore",
            stderr: "pipe",
            stdin: "ignore",
          }
        );
        const [exitCode, stderr] = yield* Effect.promise(() =>
          Promise.all([child.exited, new Response(child.stderr).text()])
        );
        expect(exitCode, stderr).toBe(0);
      }
    })
  );
  it.effect("runs the package script through the shared doctest mode", () =>
    Effect.gen(function* () {
      const output = `/tmp/beep-doctest-package-${process.pid}.json`;
      const child = Bun.spawn(
        ["bun", "run", "doctest", "--pool=threads", "--maxWorkers=1", "--reporter=json", `--outputFile=${output}`],
        {
          cwd: fixture,
          env: {
            ...Bun.env,
            BEEP_VITEST_DOCTEST: "1",
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
      const result = yield* Effect.promise(() => Bun.file(output).text());
      expect(result).toContain('"numPassedTestSuites":2');
      expect(result).toContain('"numPassedTests":2');
    })
  );
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
      expect(result).toContain('"numPassedTestSuites":2');
      expect(result).toContain('"numPassedTests":2');
    })
  );
});
