import {
  detectNoLocationTs2589Flake,
  FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH,
  FlakeQuarantineArtifact,
  FlakeQuarantineArtifactJson,
  FlakeQuarantineIncident,
  FlakeQuarantineTask,
  flakeQuarantineOutputBound,
  laneQuarantineRerunStep,
  MAX_QUARANTINED_TASKS_PER_LANE,
  QualityTaskStep,
  standaloneQuarantineRerunStep,
} from "@beep/repo-cli/test/Quality";
import { buildYeetVerdictForTesting } from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";

const boxTs2589Line = "@beep/box:build: error TS2589: Type instantiation is excessively deep and possibly infinite.";

const quarantinableBuildOutput = [
  "• turbo 2.10.7",
  "@beep/types:build: cache hit, replaying logs 0123456789abcdef",
  "@beep/box:build: cache bypass, force executing 64ee9ecf7492516e",
  "@beep/box:build: $ bun run beep:build",
  "@beep/box:build: $ tsc -b tsconfig.json && bun run babel",
  boxTs2589Line,
  "@beep/box:build: ERROR: command finished with error: command (/repo/packages/common/box) bun run beep:build exited (2)",
  "@beep/box#build: command (/repo/packages/common/box) bun run beep:build exited (2)",
  " Tasks:    128 successful, 129 total",
  "Cached:    120 cached, 129 total",
  "  Time:    26.12s ",
  "Failed:    @beep/box#build",
  "",
  " ERROR  run failed: command  exited (2)",
  'error: script "build" exited with code 2',
].join("\n");

const laneStep = QualityTaskStep.make({
  label: "quality:build",
  command: "bun",
  args: ["run", "build"],
  cwd: "/repo",
  flakeQuarantine: "ts2589-no-location",
});

describe("detectNoLocationTs2589Flake", () => {
  it("quarantines a single no-location TS2589 turbo task failure", () => {
    const detected = detectNoLocationTs2589Flake(quarantinableBuildOutput);
    expect(O.isSome(detected)).toBe(true);
    const tasks = O.getOrThrow(detected);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ taskId: "@beep/box#build", packageName: "@beep/box", task: "build" });
  });

  it("quarantines check-lane task ids", () => {
    const output = [
      "@beep/form:check: error TS2589: Type instantiation is excessively deep and possibly infinite.",
      "Failed:    @beep/form#check",
    ].join("\n");
    const tasks = O.getOrThrow(detectNoLocationTs2589Flake(output));
    expect(tasks[0]).toMatchObject({ taskId: "@beep/form#check", packageName: "@beep/form", task: "check" });
  });

  it("quarantines multiple attributed tasks up to the cap", () => {
    const output = [
      "@beep/box:build: error TS2589: Type instantiation is excessively deep and possibly infinite.",
      "@beep/ui:build: error TS2589: Type instantiation is excessively deep and possibly infinite.",
      "Failed:    @beep/box#build, @beep/ui#build",
    ].join("\n");
    const tasks = O.getOrThrow(detectNoLocationTs2589Flake(output));
    expect(A.map(tasks, (task) => task.taskId)).toEqual(["@beep/box#build", "@beep/ui#build"]);
  });

  it("detects through ANSI escapes", () => {
    const output = [`\u001B[31m${boxTs2589Line}\u001B[0m`, "\u001B[1mFailed:    @beep/box#build\u001B[0m"].join("\n");
    expect(O.isSome(detectNoLocationTs2589Flake(output))).toBe(true);
  });

  it("keeps a located TS2589 hard", () => {
    const output = [
      "@beep/box:build: src/internal/Foo.ts(12,5): error TS2589: Type instantiation is excessively deep and possibly infinite.",
      "Failed:    @beep/box#build",
    ].join("\n");
    expect(O.isNone(detectNoLocationTs2589Flake(output))).toBe(true);
  });

  it("keeps mixed diagnostics hard", () => {
    const output = [
      boxTs2589Line,
      "@beep/box:build: src/internal/Foo.ts(3,1): error TS2322: Type 'string' is not assignable to type 'number'.",
      "Failed:    @beep/box#build",
    ].join("\n");
    expect(O.isNone(detectNoLocationTs2589Flake(output))).toBe(true);
  });

  it("keeps an unattributed no-location TS2589 hard", () => {
    const output = [
      "error TS2589: Type instantiation is excessively deep and possibly infinite.",
      "Failed:    @beep/box#build",
    ].join("\n");
    expect(O.isNone(detectNoLocationTs2589Flake(output))).toBe(true);
  });

  it("keeps a failed task without TS2589 attribution hard", () => {
    const output = [boxTs2589Line, "Failed:    @beep/box#build, @beep/ui#build"].join("\n");
    expect(O.isNone(detectNoLocationTs2589Flake(output))).toBe(true);
  });

  it("keeps a failure without a turbo Failed footer hard", () => {
    expect(O.isNone(detectNoLocationTs2589Flake(boxTs2589Line))).toBe(true);
  });

  it("keeps failures beyond the per-lane task cap hard", () => {
    const packages = A.makeBy(MAX_QUARANTINED_TASKS_PER_LANE + 1, (index) => `@beep/pkg-${index}`);
    const output = [
      ...A.map(
        packages,
        (name) => `${name}:build: error TS2589: Type instantiation is excessively deep and possibly infinite.`
      ),
      `Failed:    ${A.join(
        A.map(packages, (name) => `${name}#build`),
        ", "
      )}`,
    ].join("\n");
    expect(O.isNone(detectNoLocationTs2589Flake(output))).toBe(true);
  });

  it("keeps a clean or unrelated failure hard", () => {
    expect(O.isNone(detectNoLocationTs2589Flake(""))).toBe(true);
    expect(O.isNone(detectNoLocationTs2589Flake("Failed:    @beep/box#build"))).toBe(true);
  });
});

describe("quarantine rerun steps", () => {
  const task = FlakeQuarantineTask.make({ taskId: "@beep/box#build", packageName: "@beep/box", task: "build" });

  it("builds the standalone package rerun with the lane environment preserved", () => {
    const rerun = standaloneQuarantineRerunStep(laneStep, task);
    expect(rerun.label).toBe("quality:build:flake-rerun:@beep/box");
    expect(rerun.args).toEqual(["run", "build", "--", "--filter=@beep/box"]);
    expect(rerun.cwd).toBe("/repo");
    expect(rerun.env).toBeUndefined();
    expect(rerun.flakeQuarantine).toBeUndefined();
  });

  it("keeps an inherited TURBO_FORCE on the standalone rerun so cache replay cannot green it", () => {
    const forcedLane = QualityTaskStep.make({ ...laneStep, env: { TURBO_FORCE: "true" } });
    const rerun = standaloneQuarantineRerunStep(forcedLane, task);
    expect(rerun.env).toEqual({ TURBO_FORCE: "true" });
  });

  it("builds the lane rerun with the policy stripped and TURBO_FORCE removed for cache resume", () => {
    const rerun = laneQuarantineRerunStep(laneStep);
    expect(rerun.label).toBe("quality:build:flake-lane-rerun");
    expect(rerun.args).toEqual(["run", "build"]);
    expect(rerun.env).toEqual({ TURBO_FORCE: undefined });
    expect(rerun.flakeQuarantine).toBeUndefined();
  });
});

describe("flake-quarantine artifact", () => {
  const incident = FlakeQuarantineIncident.make({
    policy: "ts2589-no-location",
    laneLabel: "quality:build",
    taskId: "@beep/box#build",
    packageName: "@beep/box",
    task: "build",
    standaloneCommand: "bun run build -- --filter=@beep/box",
    detectedAt: "2026-08-01T00:00:00.000Z",
    standaloneDurationMs: 42000,
    laneRerunDurationMs: 31000,
  });

  it("pins the artifact contract", () => {
    expect(FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH).toBe(".beep/yeet/flake-quarantine.json");
    expect(flakeQuarantineOutputBound.maxChars).toBeGreaterThan(1024 * 1024);
  });

  it.effect("round-trips through the JSON codec", () =>
    Effect.gen(function* () {
      const artifact = FlakeQuarantineArtifact.make({
        schemaVersion: "yeet-flake-quarantine/v1",
        incidents: [incident],
      });
      const text = yield* FlakeQuarantineArtifactJson.encode(artifact);
      const decoded = yield* FlakeQuarantineArtifactJson.decode(text);
      expect(decoded).toEqual(artifact);
    })
  );

  it("embeds incidents in the yeet verdict only when present", () => {
    const base = {
      base: "origin/main",
      branch: "feature",
      createdAt: "2026-08-01T00:00:00.000Z",
      executed: [],
      head: "HEAD",
      message: "yeet verification proof passed.",
      mode: "verify",
      outcome: "success",
      packetPaths: [],
      planned: [],
      runId: "feature",
    } as const;
    const withIncidents = buildYeetVerdictForTesting({ ...base, flakeQuarantine: [incident] });
    expect(withIncidents.flakeQuarantine).toHaveLength(1);
    const withoutIncidents = buildYeetVerdictForTesting({ ...base, flakeQuarantine: [] });
    expect(withoutIncidents.flakeQuarantine).toBeUndefined();
  });
});
