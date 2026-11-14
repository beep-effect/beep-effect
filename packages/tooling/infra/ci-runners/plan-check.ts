#!/usr/bin/env bun
/**
 * The pre-deploy gate the future `Deploy CI runners` workflow runs between
 * plan and deploy. It takes the plan log's path, lists each planned resource
 * with its action, bindings and the names (never the values) of the
 * properties it changes, then exits non-zero unless `checkPlan` passes.
 *
 * @internal
 * @since 0.0.0
 */
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { checkPlan, mustEscalate, PlanViolation, readPlanLog } from "./src/PlanCheck.ts";
import type { PlannedResource, PlanRefused } from "./src/PlanCheck.ts";

const listResource = (resource: PlannedResource) =>
  Console.log(
    A.join(
      [
        `[${resource.fqn}] ${resource.action}`,
        ...A.map(resource.bindings, (binding) => `binding ${binding}`),
        ...A.map(resource.changedProperties, (name) => `changes ${name}`),
      ],
      " | "
    )
  );

const explain = PlanViolation.match({
  DestructiveAction: (v) => `${v.fqn}: ${v.action} is never deployed by this job`,
  ForeignResource: (v) => `${v.fqn}: not a CiRunners resource (${v.action})`,
  UnreadableLine: (v) => `unreadable plan line: ${v.line}`,
  MissingPlan: (v) => `expected one "Plan:" header, found ${v.headers}`,
  ActionTask: (v) => `${v.fqn}: planned action task (${v.verb})`,
});

const refuse = Effect.fn("CiRunners.planCheckRefuse")(function* (refusal: PlanRefused) {
  yield* Effect.forEach(refusal.violations, (violation) => Console.error(`REFUSED ${explain(violation)}`), {
    discard: true,
  });
  if (mustEscalate(refusal.violations)) {
    yield* Console.error(
      "STOP: no deploy and no re-run. Ask the CI goals driver through the orchestrator " +
        "(docs/runbooks/alchemy-infra.md, section CI runners)."
    );
  }
  return yield* refusal;
});

const planCheck = Command.make(
  "plan-check",
  { plan: Argument.String("plan").pipe(Argument.withDescription("Path of the alchemy plan log")) },
  Effect.fn("CiRunners.planCheckCli")(function* ({ plan }) {
    const fs = yield* FileSystem.FileSystem;
    const log = yield* fs.readFileString(plan);
    const reading = readPlanLog(log);
    yield* Effect.forEach(reading.resources, listResource, { discard: true });
    yield* checkPlan(reading).pipe(Effect.catchTag("PlanRefused", refuse));
    yield* Console.log("plan-check: no replace, delete or orphan, and every line read; deploy may run");
  })
).pipe(Command.withDescription("Refuse a CI runners deploy whose plan replaces, deletes or orphans anything."));

Command.run(planCheck, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer), BunRuntime.runMain);
