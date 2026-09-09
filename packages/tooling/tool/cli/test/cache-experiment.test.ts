import { CacheSyntheticRun } from "@beep/repo-cli/commands/Cache";
import { equivalentCacheFixtureRuns, inspectCacheFixtureCapture } from "@beep/repo-cli/test/Cache";
import { NonNegativeInt, Sha256Hex } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Str from "effect/String";

const digest = Sha256Hex.make(Str.repeat(64)("a"));
const different = Sha256Hex.make(Str.repeat(64)("b"));
const safe = CacheSyntheticRun.make({
  id: "fresh",
  root: "root-a",
  taskHash: "0123456789abcdef",
  origin: "fresh",
  exitCode: 0,
  outputSha256: digest,
  logSha256: digest,
  logBytes: NonNegativeInt.make(12),
  violations: [],
});

describe("local fixture comparisons", () => {
  it("compares semantic results across distinct roots and cache origins", () => {
    const replay = CacheSyntheticRun.make({ ...safe, id: "replay", root: "root-b", origin: "local-hit" });
    expect(equivalentCacheFixtureRuns(safe, replay)).toBe(true);
    expect(equivalentCacheFixtureRuns(replay)(safe)).toBe(true);
  });

  it("rejects matching failed or unsafe runs even when every digest agrees", () => {
    for (const bad of [
      CacheSyntheticRun.make({ ...safe, exitCode: 7 }),
      ...A.map(
        inspectCacheFixtureCapture("QUALIFICATION_SYNTHETIC_SECRET_629a94d2 /fixture/private", true),
        (violation) => CacheSyntheticRun.make({ ...safe, violations: [violation] })
      ),
    ]) {
      expect(equivalentCacheFixtureRuns(bad, bad)).toBe(false);
      expect(equivalentCacheFixtureRuns(safe, bad)).toBe(false);
      expect(equivalentCacheFixtureRuns(bad, safe)).toBe(false);
    }
  });

  it("independently detects hash, output, and task-log divergence", () => {
    for (const changed of [
      CacheSyntheticRun.make({ ...safe, taskHash: "fedcba9876543210" }),
      CacheSyntheticRun.make({ ...safe, outputSha256: different }),
      CacheSyntheticRun.make({ ...safe, logSha256: different }),
    ])
      expect(equivalentCacheFixtureRuns(safe, changed)).toBe(false);
  });
});

describe("local fixture capture rejection", () => {
  it("detects a synthetic credential and either supported absolute root", () => {
    expect(inspectCacheFixtureCapture("QUALIFICATION_SYNTHETIC_SECRET_629a94d2", false)).toEqual(["synthetic-secret"]);
    expect(inspectCacheFixtureCapture("/fixture/packages/private.ts", false)).toEqual(["absolute-path"]);
    expect(inspectCacheFixtureCapture(false)("/fixture-other/packages/private.ts")).toEqual(["absolute-path"]);
    expect(inspectCacheFixtureCapture("qualification fixture\n", false)).toEqual([]);
  });

  it("bounds encoded bytes rather than just JavaScript character count", () => {
    expect(inspectCacheFixtureCapture(Str.repeat(32768)("é"), false)).toEqual([]);
    expect(inspectCacheFixtureCapture(Str.repeat(32769)("é"), false)).toEqual(["overflow"]);
    expect(inspectCacheFixtureCapture("short prefix", true)).toEqual(["overflow"]);
  });
});
