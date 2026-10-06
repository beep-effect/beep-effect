import {
  byRepoPlanStepAscending,
  commandTextForStep,
  enforceConservativeResume,
  RepoPlanStep,
  RepoRunContext,
  turboTaskForStep,
} from "@beep/repo-cli/test/RepoRun";
import { describe, expect, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";

const step = RepoPlanStep.make({
  id: "pkg#check",
  label: "check",
  phase: "feedback",
  command: "bun",
  args: [],
  cwd: "/repo",
  scope: "package",
  mutability: "readonly",
  resume: "fingerprint-match",
});
const context = RepoRunContext.make({
  repoRoot: "/repo",
  cwd: "/repo",
  base: "origin/main",
  head: "HEAD",
  branch: "feat/quality",
  packetDir: ".beep/yeet",
  originalArgv: [],
  turbo: {
    graphHealthStatus: "ok",
    graphHealthWarnings: [],
    tasks: [
      { taskId: "pkg#check", task: "check" },
      { taskId: "pkg#lint", task: "lint" },
    ],
  },
});
describe("repository plan model behavior", () => {
  it("orders early publication between commit and full proof", () => {
    const steps = A.map(["full", "publish", "early-publish", "commit"] as const, (phase) =>
      RepoPlanStep.make({ ...step, phase })
    );
    expect(A.map(A.sort(steps, byRepoPlanStepAscending), (item) => item.phase)).toEqual([
      "commit",
      "early-publish",
      "full",
      "publish",
    ]);
  });
  it("quotes empty and shell-sensitive arguments", () => {
    expect(commandTextForStep(RepoPlanStep.make({ ...step, args: ["", "don't", "safe"] }))).toBe(
      "bun '' 'don'\\''t' safe"
    );
  });
  it("retains safe resumable steps and downgrades write and repository steps", () => {
    expect(enforceConservativeResume(step)).toBe(step);
    for (const unsafe of [
      RepoPlanStep.make({ ...step, scope: "repo" }),
      RepoPlanStep.make({ ...step, mutability: "write" }),
      RepoPlanStep.make({ ...step, phase: "publish" }),
    ]) {
      expect(enforceConservativeResume(unsafe).resume).toBe("never");
    }
  });
  it("finds Turbo tasks by task name, qualified id, or step id, with a None fallback", () => {
    const lint = RepoPlanStep.make({ ...step, task: "lint" });
    expect(turboTaskForStep(context, lint)).toMatchObject({ _tag: "Some", value: { taskId: "pkg#lint" } });
    expect(turboTaskForStep(RepoPlanStep.make({ ...step, task: "pkg#lint" }))(context)).toEqual(
      turboTaskForStep(context, lint)
    );
    expect(turboTaskForStep(context, RepoPlanStep.make({ ...step, task: "missing" }))).toMatchObject({
      _tag: "Some",
      value: { taskId: "pkg#check" },
    });
    assertNone(turboTaskForStep(context, RepoPlanStep.make({ ...step, id: "missing" })));
  });
});
