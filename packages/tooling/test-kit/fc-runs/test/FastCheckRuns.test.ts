import { DEFAULT_FC_NUM_RUNS, envFcSeed, fcRuns, parseFcNumRunsFloor } from "@beep/fc-runs";
import { describe, expect, it, vi } from "@effect/vitest";
import { ConfigProvider, Context } from "effect";
import * as O from "effect/Option";

describe("fcRuns (one-round-loop P1 env-max helper)", () => {
  it("keeps the inline value as a floor and defaults to the helper's run count", () => {
    // Effect's default ConfigProvider snapshots the environment at boot, so
    // in this test process the inline value and the default rule the
    // outcome; the raised-floor path is proven end to end by the fresh
    // subprocess probe below.
    expect(fcRuns(40).runs).toBeGreaterThanOrEqual(40);
    expect(fcRuns().runs).toBeGreaterThanOrEqual(DEFAULT_FC_NUM_RUNS);
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
      'const { fcRuns } = await import("@beep/fc-runs");',
      "const raised = fcRuns(40).runs;",
      "const floored = fcRuns(9000).runs;",
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

describe("environment seed parsing", () => {
  it.each(["42", "-7", "0", "2.5", "invalid"])("reads the configured seed %s without pinning property tests", (raw) => {
    const provider = Context.get(Context.empty(), ConfigProvider.ConfigProvider);
    const configured = ConfigProvider.fromEnv({ env: { BEEP_FC_SEED: raw } });
    const load = vi.spyOn(provider, "load").mockImplementation(configured.load);
    try {
      const parsed = Number(raw);
      const expected = Number.isInteger(parsed) ? O.some(parsed) : O.none();
      expect(envFcSeed()).toEqual(expected);
      const options = fcRuns(100);
      expect(options.runs).toBe(100);
      if (O.isSome(expected)) expect(options.seed).toBe(expected.value);
      else expect(options).not.toHaveProperty("seed");
    } finally {
      load.mockRestore();
    }
  });
});
