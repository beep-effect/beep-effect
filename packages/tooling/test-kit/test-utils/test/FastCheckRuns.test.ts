import { DEFAULT_FC_NUM_RUNS, fcRuns, parseFcNumRunsFloor } from "@beep/test-utils";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

describe("fcRuns (one-round-loop P1 env-max helper)", () => {
  it("has the vitest.setup.ts configureGlobal floor engaged", () => {
    const globalNumRuns = fc.readConfigureGlobal()?.numRuns ?? 0;
    expect(globalNumRuns).toBeGreaterThanOrEqual(DEFAULT_FC_NUM_RUNS);
  });

  it("keeps the inline value as a floor and defaults to fast-check's run count", () => {
    // Effect's default ConfigProvider snapshots the environment at boot, so
    // in this test process the inline value and the default rule the
    // outcome; the raised-floor path is proven end to end by the fresh
    // subprocess probe below.
    expect(fcRuns(40).numRuns).toBeGreaterThanOrEqual(40);
    expect(fcRuns().numRuns).toBeGreaterThanOrEqual(DEFAULT_FC_NUM_RUNS);
  });

  it("parses only positive-integer environment floors (fence 3 input guard)", () => {
    expect(parseFcNumRunsFloor("400")).toBe(400);
    expect(parseFcNumRunsFloor("1000")).toBe(1000);
    expect(parseFcNumRunsFloor("0")).toBe(0);
    expect(parseFcNumRunsFloor("-5")).toBe(0);
    expect(parseFcNumRunsFloor("2.5")).toBe(0);
    expect(parseFcNumRunsFloor("plenty")).toBe(0);
    expect(parseFcNumRunsFloor(undefined)).toBe(0);
  });

  it("raises to the environment floor in a fresh process (boot snapshot)", () => {
    // The floor is read once at process boot (CI exports it before vitest
    // starts), so the end-to-end raise/never-lower semantics need a fresh
    // subprocess with the variable present at spawn.
    const probe = [
      'const { fcRuns } = await import("@beep/test-utils");',
      "const raised = fcRuns(40).numRuns;",
      "const floored = fcRuns(9000).numRuns;",
      "process.stdout.write(`${raised}/${floored}`);",
    ].join("\n");
    const result = Bun.spawnSync({
      cmd: ["bun", "-e", probe],
      cwd: import.meta.dir,
      env: { ...Bun.env, BEEP_FC_NUM_RUNS: "400" },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(result.success).toBe(true);
    expect(result.stdout.toString()).toBe("400/9000");
  });
});
