import { DEFAULT_FC_NUM_RUNS, envFcNumRunsFloor, fcRuns } from "@beep/test-utils";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

const withEnvFloor = <A>(value: string | undefined, use: () => A): A => {
  const previous = process.env.BEEP_FC_NUM_RUNS;
  if (value === undefined) {
    delete process.env.BEEP_FC_NUM_RUNS;
  } else {
    process.env.BEEP_FC_NUM_RUNS = value;
  }

  try {
    return use();
  } finally {
    if (previous === undefined) {
      delete process.env.BEEP_FC_NUM_RUNS;
    } else {
      process.env.BEEP_FC_NUM_RUNS = previous;
    }
  }
};

describe("fcRuns (one-round-loop P1 env-max helper)", () => {
  it("has the vitest.setup.ts configureGlobal floor engaged", () => {
    const globalNumRuns = fc.readConfigureGlobal()?.numRuns ?? 0;
    expect(globalNumRuns).toBeGreaterThanOrEqual(DEFAULT_FC_NUM_RUNS);
  });

  it("keeps the inline value when no environment floor is set", () => {
    withEnvFloor(undefined, () => {
      expect(fcRuns(40)).toEqual({ numRuns: 40 });
    });
  });

  it("defaults to fast-check's own run count without an inline value", () => {
    withEnvFloor(undefined, () => {
      expect(fcRuns()).toEqual({ numRuns: DEFAULT_FC_NUM_RUNS });
    });
  });

  it("raises to the environment floor when it exceeds the inline value", () => {
    withEnvFloor("400", () => {
      expect(fcRuns(40)).toEqual({ numRuns: 400 });
      expect(fcRuns()).toEqual({ numRuns: 400 });
    });
  });

  it("never lowers an inline value below its declared floor (fence 3)", () => {
    withEnvFloor("10", () => {
      expect(fcRuns(40)).toEqual({ numRuns: 40 });
      expect(fcRuns()).toEqual({ numRuns: DEFAULT_FC_NUM_RUNS });
    });
  });

  it("ignores non-positive and non-integer environment values", () => {
    withEnvFloor("0", () => {
      expect(envFcNumRunsFloor()).toBe(0);
    });
    withEnvFloor("-5", () => {
      expect(envFcNumRunsFloor()).toBe(0);
    });
    withEnvFloor("2.5", () => {
      expect(envFcNumRunsFloor()).toBe(0);
    });
    withEnvFloor("plenty", () => {
      expect(envFcNumRunsFloor()).toBe(0);
    });
    withEnvFloor("1000", () => {
      expect(envFcNumRunsFloor()).toBe(1000);
    });
  });
});
