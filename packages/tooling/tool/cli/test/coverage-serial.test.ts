import {
  coverageFullStepsForTesting,
  coverageSelectedStepsForTesting,
  coverageShardConcurrencyForTesting,
} from "@beep/repo-cli/test/Quality";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Str from "effect/String";

// goals/compute-profile-gate-routing (2026-11-13 repeat run, PR #3277): a forced worker coverage
// run passes `--concurrency=1`, and the prebuild ran `turbo run build --concurrency=4` anyway. Every
// Turbo invocation the run spawns now follows a caller's `--concurrency=1`; other shapes keep theirs.

const concurrencyArgs = A.filter(Str.startsWith("--concurrency"));
const OWNERS = ["@beep/types", "@beep/utils"];

describe("serial coverage under --concurrency=1", () => {
  it("builds the full-run prebuild one task at a time and keeps each shard serial", () => {
    const [prebuild, ...shards] = coverageFullStepsForTesting("/repo", OWNERS, ["--concurrency=1"]);
    expect(prebuild.label).toBe("coverage:prebuild");
    expect(concurrencyArgs(prebuild.args)).toEqual(["--concurrency=1"]);
    expect(A.every(shards, (shard) => A.contains(shard.args, "--concurrency=1"))).toBe(true);
    expect(A.every(shards, (shard) => A.length(concurrencyArgs(shard.args)) === 1)).toBe(true);
  });

  it("builds a sharded selected prebuild one task at a time", () => {
    const steps = coverageSelectedStepsForTesting("/repo", OWNERS, ["--affected", "--concurrency=1"], {
      hosted: false,
      writeBaseline: true,
    });
    const [prebuild] = steps;
    expect(prebuild.label).toBe("coverage:prebuild");
    expect(concurrencyArgs(prebuild.args)).toEqual(["--concurrency=1"]);
  });

  it("keeps a narrow selected run a single serial Turbo invocation", () => {
    const steps = coverageSelectedStepsForTesting("/repo", ["@beep/types"], ["--concurrency=1"], {
      hosted: false,
      writeBaseline: false,
    });
    expect(A.map(steps, (step) => step.label)).toEqual(["coverage:ratchet"]);
    expect(concurrencyArgs(steps[0].args)).toEqual(["--concurrency=1"]);
  });

  it("runs the shard group one shard at a time", () => {
    const serial = coverageShardConcurrencyForTesting(["--affected", "--concurrency=1"]);
    expect(serial).toBe(1);
  });
});

describe("workstation and hosted coverage shapes", () => {
  it("keeps the prebuild at concurrency 4 and ten shards side by side without a caller pin", () => {
    const [prebuild] = coverageFullStepsForTesting("/repo", OWNERS, []);
    const hostedSelected = coverageSelectedStepsForTesting("/repo", OWNERS, [], { hosted: true, writeBaseline: true });
    expect(concurrencyArgs(prebuild.args)).toEqual(["--concurrency=4"]);
    expect(concurrencyArgs(hostedSelected[0].args)).toEqual(["--concurrency=4"]);
    expect(coverageShardConcurrencyForTesting([])).toBe(10);
  });

  it("keeps the prebuild at concurrency 4 for a caller concurrency other than 1", () => {
    const [prebuild] = coverageFullStepsForTesting("/repo", OWNERS, ["--concurrency=3"]);
    expect(concurrencyArgs(prebuild.args)).toEqual(["--concurrency=4"]);
    expect(coverageShardConcurrencyForTesting(["--concurrency=3"])).toBe(10);
  });
});
