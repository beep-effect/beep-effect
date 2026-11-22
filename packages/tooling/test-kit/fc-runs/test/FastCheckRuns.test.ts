import {
  DEFAULT_FC_NUM_RUNS,
  envFcNumRunsFloor,
  envFcSeed,
  fcRuns,
  fcRunsCapped,
  parseFcNumRunsFloor,
} from "@beep/fc-runs";
import { describe, expect, it, vi } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";

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
    const probe = A.join(
      [
        'const { fcRuns } = await import("@beep/fc-runs");',
        "const raised = fcRuns(40).runs;",
        "const floored = fcRuns(9000).runs;",
        "process.stdout.write(`${raised}/${floored}`);",
      ],
      "\n"
    );
    const result = Bun.spawnSync({
      cmd: ["bun", "-e", probe],
      cwd: import.meta.dir,
      env: { ...Bun.env, BEEP_FC_NUM_RUNS: "400" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const diagnostic = `fcRuns boot probe: exit=${result.exitCode}, signal=${result.signalCode}, stderr=${Str.slice(0, 2000)(result.stderr.toString())}`;
    assertTrue(result.success, diagnostic);
    expect(result.stdout.toString(), diagnostic).toBe("400/9000");
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

describe("fcRunsCapped (fixed runs for I/O-heavy properties)", () => {
  const withEnv = (env: Record<string, string>, body: () => void) => {
    const provider = Context.get(Context.empty(), ConfigProvider.ConfigProvider);
    const configured = ConfigProvider.fromEnv({ env });
    const load = vi.spyOn(provider, "load").mockImplementation(configured.load);
    try {
      body();
    } finally {
      load.mockRestore();
    }
  };

  it("uses the inline count when the environment is empty", () => {
    withEnv({}, () => {
      expect(fcRunsCapped(10)).toEqual({ runs: 10 });
    });
  });

  it("ignores the BEEP_FC_NUM_RUNS floor that raises fcRuns", () => {
    withEnv({ BEEP_FC_NUM_RUNS: "1000" }, () => {
      expect(fcRuns(10).runs).toBe(1000);
      expect(fcRunsCapped(10).runs).toBe(10);
    });
  });

  it("keeps the BEEP_FC_SEED pin so seeded reruns stay reproducible", () => {
    withEnv({ BEEP_FC_NUM_RUNS: "1000", BEEP_FC_SEED: "521938102" }, () => {
      expect(fcRunsCapped(10)).toEqual({ runs: 10, seed: 521938102 });
    });
  });

  it("ignores the floor in a fresh process (boot snapshot)", () => {
    const probe = A.join(
      [
        'const { fcRunsCapped } = await import("@beep/fc-runs");',
        "const options = fcRunsCapped(10);",
        "process.stdout.write(`${options.runs}/${options.seed}`);",
      ],
      "\n"
    );
    const result = Bun.spawnSync({
      cmd: ["bun", "-e", probe],
      cwd: import.meta.dir,
      env: { ...Bun.env, BEEP_FC_NUM_RUNS: "1000", BEEP_FC_SEED: "42" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const diagnostic = `fcRunsCapped boot probe: exit=${result.exitCode}, signal=${result.signalCode}, stderr=${Str.slice(0, 2000)(result.stderr.toString())}`;
    assertTrue(result.success, diagnostic);
    expect(result.stdout.toString(), diagnostic).toBe("10/42");
  });
});

// The deep sweep's log carries the seed and the run count a property built with fcRuns drew.
const drawn = Ref.makeUnsafe(0);
describe("a property built with fcRuns", { concurrent: false }, () => {
  it.effect.prop("draws", [S.Int], () => Ref.update(drawn, (count) => count + 1), { arbitrary: fcRuns(5) });

  it.effect("draws at least the floor", () =>
    Effect.gen(function* () {
      const runs = yield* Ref.get(drawn);
      const pinned = O.match(envFcSeed(), { onNone: () => "random", onSome: (seed) => `${seed}` });
      yield* Effect.provideService(
        Console.log(`[property-seed] worker seed ${pinned}, ${runs} runs with fcRuns`),
        Console.Console,
        globalThis.console
      );
      expect(runs).toBe(Math.max(5, envFcNumRunsFloor()));
    })
  );
});

describe("the deep sweep's reporters", () => {
  // Each process reads the shared configuration under its own environment.
  const reportersUnder = (env: Record<string, string>) => {
    const { BEEP_FC_NUM_RUNS: _floor, ...inherited } = Bun.env;
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "-e",
        'const { default: config } = await import("./vitest.shared.ts"); process.stdout.write(JSON.stringify(config.test.reporters));',
      ],
      cwd: `${import.meta.dirname}/../../../../..`,
      env: { ...inherited, ...env },
      stdout: "pipe",
      stderr: "pipe",
    });
    assertTrue(result.success, Str.slice(0, 2000)(result.stderr.toString()));
    return result.stdout.toString();
  };

  it("leave no test gate record, so a narrowed run never reads as the package's test pass", () => {
    const swept = reportersUnder({ BEEP_FC_NUM_RUNS: "5" });
    expect(swept).not.toContain("repo-gate-vitest");
    expect(swept).toContain("vitest.property-reporter.ts");
    const ordinary = reportersUnder({});
    expect(ordinary).toContain("repo-gate-vitest");
    expect(ordinary).not.toContain("vitest.property-reporter.ts");
  });
});
