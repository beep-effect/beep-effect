import {
  checkPlan,
  isStackResource,
  mustEscalate,
  planViolations,
  readPlanLog,
} from "@beep/infra-ci-runners/PlanCheck";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { personalPlanLog } from "./support/PersonalPlan.ts";

const personalPlan = Str.trimEnd(personalPlanLog);

const header = "[00:00:00.000] INFO: Plan ready (1.0s)";
const planOf = (...lines: ReadonlyArray<string>) => A.join([header, ...lines], "\n");
const reasons = (log: string) => A.map(planViolations(readPlanLog(log)), (violation) => violation._tag);

describe("CiRunners plan check", () => {
  it.effect("passes the recorded personal-stage plan: 66 creates, bindings attached", () =>
    Effect.gen(function* () {
      const resources = yield* checkPlan(readPlanLog(personalPlan));
      expect(resources).toHaveLength(66);
      expect(A.every(resources, (resource) => resource.action === "create")).toBe(true);
      const reaper = A.findFirst(resources, (resource) => resource.fqn === "Reaper");
      expect(reaper._tag).toBe("Some");
      expect(A.flatMap(resources, (resource) => resource.bindings)).toHaveLength(9);
    })
  );

  it.effect("refuses a replace, a delete and an orphan, wherever they are", () =>
    Effect.gen(function* () {
      const log = planOf(
        "Plan: 1 to replace, 1 to delete, 1 to orphaned",
        "[Vpc] replace",
        "[Runners/Poolheavy/BuildQueue] delete",
        "[Reaper] orphaned"
      );
      expect(reasons(log)).toEqual(["DestructiveAction", "DestructiveAction", "DestructiveAction"]);
      const refusal = yield* checkPlan(readPlanLog(log)).pipe(Effect.flip);
      assertTrue(mustEscalate(refusal.violations));
    })
  );

  it.effect("accepts updates, adoptions and no-ops with their property names", () =>
    Effect.gen(function* () {
      const log = planOf(
        "Plan: 1 to update",
        "",
        "[Runners/Poolheavy/LaunchTemplate] update",
        "  ~ imageId: ami-1 -> ami-2",
        "  + tags:",
        "      Name: beep-fleet-prod-runner",
        "[Vpc] noop",
        "  no declared property changes",
        "[Runners/Webhook] adopted (local)",
        "[Runners/Webhook/Webhook] update"
      );
      const resources = yield* checkPlan(readPlanLog(log));
      expect(A.map(resources, (resource) => resource.action)).toEqual(["update", "noop", "adopted"]);
      expect(resources[0]?.changedProperties).toEqual(["imageId", "tags"]);
      expect(resources[2]?.bindings).toEqual(["Runners/Webhook/Webhook update"]);
    })
  );

  it.effect("refuses a binding replace, unbind or delete under a no-op resource, and accepts binding creates", () =>
    Effect.gen(function* () {
      expect(reasons(planOf("Plan: 1 binding changes", "[Reaper] noop", "[Reaper/Reaper] replace"))).toEqual([
        "DestructiveBinding",
      ]);
      expect(
        reasons(planOf("Plan: 2 binding changes", "[Reaper] noop", "[Reaper/Reaper] unbind", "[Reaper/Invoke] delete"))
      ).toEqual(["DestructiveBinding", "DestructiveBinding"]);
      const refusal = yield* checkPlan(
        readPlanLog(planOf("Plan: 1 binding changes", "[Reaper] noop", "[Reaper/Reaper] unbind"))
      ).pipe(Effect.flip);
      assertTrue(mustEscalate(refusal.violations));
      const accepted = yield* checkPlan(
        readPlanLog(planOf("Plan: 1 to create", "[Reaper] create", "[Reaper/Reaper] create", "[Reaper/Invoke] update"))
      );
      expect(A.flatMap(accepted, (resource) => resource.bindings)).toEqual([
        "Reaper/Reaper create",
        "Reaper/Invoke update",
      ]);
    })
  );

  it.effect("fails closed on a line it cannot read", () =>
    Effect.sync(() => {
      expect(reasons(planOf("Plan: 1 to create", "[Vpc] create", "something unexpected"))).toEqual(["UnreadableLine"]);
      expect(
        reasons(planOf("Plan: 1 to create", "[Vpc] recreate")),
        "the unreadable row also leaves the summary's create unaccounted for"
      ).toEqual(["UnreadableLine", "IncompletePlan"]);
    })
  );

  it.effect("refuses a log whose rows do not account for the summary counts", () =>
    Effect.sync(() => {
      expect(reasons(planOf("Plan: 1 to delete"))).toEqual(["IncompletePlan"]);
      expect(reasons(planOf("Plan: 1 tasks")), "a log that ends after the summary is refused").toEqual([
        "IncompletePlan",
      ]);
      expect(reasons(planOf("Plan: 66 to")), "a log that ends mid-header is refused").toEqual(["UnreadableLine"]);
      expect(reasons(planOf("Plan: 2 to create, 1 to"))).toEqual(["UnreadableLine"]);
      expect(reasons(planOf("Plan: no resources")), "Alchemy's empty summaries pass").toEqual([]);
      expect(reasons(planOf("Plan: no changes"))).toEqual([]);
      expect(reasons(planOf("Plan: 2 to create, 1 binding changes", "[Vpc] create", "[Reaper] create"))).toEqual([
        "IncompletePlan",
      ]);
      expect(
        reasons(planOf("Plan: 1 to create, 1 binding changes", "[Reaper] create", "[Reaper/Reaper] create"))
      ).toEqual([]);
      expect(reasons(planOf("Plan: no changes", "[Vpc] noop"))).toEqual([]);
    })
  );

  it.effect("reads an indented line only as a property or a continuation inside a property block", () =>
    Effect.sync(() => {
      expect(reasons(planOf("Plan: 1 to update", "[Vpc] update", "  + tags:", "      Name: beep-fleet-prod"))).toEqual(
        []
      );
      expect(reasons(planOf("Plan: no changes", "[Vpc] noop", "  no declared property changes"))).toEqual([]);
      expect(reasons(planOf("Plan: no changes", "[Vpc] noop", "      stray continuation"))).toEqual(["UnreadableLine"]);
      expect(reasons(planOf("Plan: no changes", "[Vpc] noop", "  !! not a property"))).toEqual(["UnreadableLine"]);
    })
  );

  it.effect("fails closed without exactly one plan header", () =>
    Effect.sync(() => {
      expect(reasons("[Vpc] create")).toEqual(["MissingPlan"]);
      expect(reasons(A.join(["Plan: 1 to create", "Plan: 1 to create"], "\n"))).toEqual(["MissingPlan"]);
    })
  );

  it.effect("refuses a resource outside the stack and an action task", () =>
    Effect.gen(function* () {
      expect(reasons(planOf("Plan: 1 to create", "[MonthlyBudget] create"))).toEqual(["ForeignResource"]);
      const failure = yield* checkPlan(readPlanLog(planOf("Plan: 1 tasks", "[Migrate] run [action]"))).pipe(
        Effect.flip
      );
      expect(A.map(failure.violations, (violation) => violation._tag)).toEqual(["ActionTask"]);
      assertFalse(mustEscalate(failure.violations));
    })
  );

  it.effect("knows the stack's roots, subnets included", () =>
    Effect.sync(() => {
      assertTrue(isStackResource("PublicSubnet-us-east-1cRoute"));
      assertFalse(isStackResource("PublicSubnet3Route"));
      assertTrue(isStackResource("Runners/Pooloverflow/ScaleUp"));
      assertFalse(isStackResource("PublicSubnetX"));
    })
  );
});
