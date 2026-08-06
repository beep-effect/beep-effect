import {
  SweepPlan,
  SweepPlanJson,
  SweepPlanStep,
  SweepPrecondition,
  SweepReport,
  SweepReportJson,
  SweepReportStep,
  SweepStepExecuted,
  SweepStepId,
  SweepStepNeedsOperator,
  SweepStepSkipped,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as O from "effect/Option";

const plan = SweepPlan.make({
  schemaVersion: "yeet-sweep-plan/v1",
  createdAt: "2026-08-04T00:00:00.000Z",
  branch: "feat/merge-loop",
  steps: [
    SweepPlanStep.make({
      id: "fetch-prune",
      action: "git fetch --prune origin",
      preconditions: [],
      requiresOperator: false,
    }),
    SweepPlanStep.make({
      id: "ff-main",
      action: "git fetch origin main:main",
      preconditions: [
        SweepPrecondition.make({ description: "main is not checked out in any worktree", satisfied: true }),
        SweepPrecondition.make({ description: "worktree is clean", satisfied: true }),
      ],
      requiresOperator: false,
    }),
    SweepPlanStep.make({
      id: "delete-local-branch",
      action: "git branch -d feat/merge-loop",
      preconditions: [SweepPrecondition.make({ description: "no worktree holds feat/merge-loop", satisfied: false })],
      requiresOperator: true,
    }),
  ],
});

const report = SweepReport.make({
  schemaVersion: "yeet-sweep-report/v1",
  plan,
  steps: [
    SweepReportStep.make({
      id: "fetch-prune",
      outcome: SweepStepExecuted.make({ detail: O.some("pruned 3 remote refs") }),
      durationMs: O.some(412),
    }),
    SweepReportStep.make({
      id: "ff-main",
      outcome: SweepStepExecuted.make({}),
    }),
    SweepReportStep.make({
      id: "delete-local-branch",
      outcome: SweepStepNeedsOperator.make({
        reason: "feat/merge-loop is checked out in worktree /home/dev/beep-effect3-pra",
        operatorCommand: "git worktree remove /home/dev/beep-effect3-pra && git branch -d feat/merge-loop",
      }),
    }),
    SweepReportStep.make({
      id: "lockfile-install",
      outcome: SweepStepSkipped.make({ reason: "bun.lock did not move across the main update" }),
    }),
  ],
  startedAt: "2026-08-04T00:00:00.000Z",
  endedAt: "2026-08-04T00:00:05.000Z",
});

describe("sweep step ids", () => {
  it("pins the sweep step domain in execution order", () => {
    expect(SweepStepId.Options).toEqual([
      "fetch-prune",
      "ff-main",
      "delete-local-branch",
      "delete-remote-branch",
      "lockfile-install",
      "end-state",
    ]);
  });
});

describe("SweepPlan", () => {
  it.effect("round-trips through its JSON codec", () =>
    Effect.gen(function* () {
      const text = yield* SweepPlanJson.encode(plan);
      const decoded = yield* SweepPlanJson.decode(text);
      expect(decoded).toEqual(plan);
    })
  );

  it.effect("encodes observed preconditions as data, not prose", () =>
    Effect.gen(function* () {
      const text = yield* SweepPlanJson.encode(plan);
      expect(text).toContain('{"description":"no worktree holds feat/merge-loop","satisfied":false}');
    })
  );

  it.effect("rejects a step id outside the sweep domain", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        SweepPlanJson.decode(
          '{"schemaVersion":"yeet-sweep-plan/v1","createdAt":"2026-08-04T00:00:00.000Z","branch":"feat/merge-loop","steps":[{"id":"rm-rf-node-modules","action":"nope","preconditions":[],"requiresOperator":false}]}'
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});

describe("SweepReport", () => {
  it.effect("round-trips every step outcome variant through its JSON codec", () =>
    Effect.gen(function* () {
      const text = yield* SweepReportJson.encode(report);
      const decoded = yield* SweepReportJson.decode(text);
      expect(decoded).toEqual(report);
    })
  );

  it.effect("keeps the echoed plan byte-identical to the plan artifact", () =>
    Effect.gen(function* () {
      const reportText = yield* SweepReportJson.encode(report);
      const planText = yield* SweepPlanJson.encode(plan);
      expect(reportText).toContain(planText);
    })
  );

  it.effect("omits absent optional keys instead of writing Option runtime objects", () =>
    Effect.gen(function* () {
      const text = yield* SweepReportJson.encode(report);
      expect(text).not.toContain('"_id":"Option"');
      expect(text).toContain('{"status":"executed"}');
    })
  );

  it.effect("preserves the operator handoff command across the round trip", () =>
    Effect.gen(function* () {
      const text = yield* SweepReportJson.encode(report);
      const decoded = yield* SweepReportJson.decode(text);
      const handoff = decoded.steps[2];
      expect(handoff?.outcome.status).toBe("needs-operator");
      expect(handoff?.outcome.status === "needs-operator" ? handoff.outcome.operatorCommand : undefined).toContain(
        "git worktree remove"
      );
    })
  );
});
