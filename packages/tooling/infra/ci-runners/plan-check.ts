#!/usr/bin/env bun
/**
 * The pre-deploy gate and checked deploy the `Deploy CI runners` workflow
 * runs.
 *
 * - `log <file>` reads an `alchemy plan` log (personal-stage rehearsals) and
 *   exits non-zero unless `checkPlan` passes.
 * - `plan --stage <s> --out <file>` plans the stage, lists each resource with
 *   its action and bindings (never a value), runs the plan check and saves the
 *   checked plan.
 * - `deploy --stage <s> --checked <file>` plans the stage again, checks it,
 *   and applies that same plan only when it equals the saved one
 *   (`applyIfUnchanged`); any drift stops it before a write.
 *
 * @internal
 * @since 0.0.0
 */
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Alchemist from "alchemy/Alchemist";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { applyIfUnchanged, CheckedPlanJson, checkEnginePlan, readEnginePlan } from "./src/CheckedDeploy.ts";
import { checkPlan, mustEscalate, PlanViolation, readPlanLog } from "./src/PlanCheck.ts";
import type { CheckedPlan, CheckedResource, PlanDrift } from "./src/CheckedDeploy.ts";
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

const listChecked = (resource: CheckedResource) =>
  Console.log(
    A.join(
      [`[${resource.fqn}] ${resource.action}`, ...A.map(resource.bindings, (binding) => `binding ${binding}`)],
      " | "
    )
  );

const explain = PlanViolation.match({
  DestructiveAction: (v) => `${v.fqn}: ${v.action} is never deployed by this job`,
  DestructiveBinding: (v) => `${v.binding}: a binding replace, unbind or delete is never deployed by this job`,
  ForeignResource: (v) => `${v.fqn}: not a CiRunners resource (${v.action})`,
  UnreadableLine: (v) => `unreadable plan line: ${v.line}`,
  MissingPlan: (v) => `expected one "Plan:" header, found ${v.headers}`,
  ActionTask: (v) => `${v.fqn}: planned action task (${v.verb})`,
});

const escalate = Console.error(
  "STOP: no deploy and no re-run. Ask the CI goals driver through the orchestrator " +
    "(docs/runbooks/alchemy-infra.md, section CI runners)."
);

const refuse = Effect.fn("CiRunners.planCheckRefuse")(function* (refusal: PlanRefused) {
  yield* Effect.forEach(refusal.violations, (violation) => Console.error(`REFUSED ${explain(violation)}`), {
    concurrency: 1,
    discard: true,
  });
  if (mustEscalate(refusal.violations)) yield* escalate;
  return yield* refusal;
});

const refuseDrift = Effect.fn("CiRunners.planDriftRefuse")(function* (drift: PlanDrift) {
  yield* Effect.forEach(
    [
      ...A.map(drift.added, (fqn) => `${fqn}: planned now, absent from the checked plan`),
      ...A.map(drift.removed, (fqn) => `${fqn}: in the checked plan, absent now`),
      ...A.map(drift.changed, (fqn) => `${fqn}: action, bindings or declared properties differ`),
    ],
    (line) => Console.error(`DRIFT ${line}`),
    { concurrency: 1, discard: true }
  );
  yield* Console.error("plan-check: the deploy's plan is not the checked plan; nothing was applied");
  yield* escalate;
  return yield* drift;
});

const stage = Flag.String("stage").pipe(Flag.withDescription("The stage to plan"));

const planStage = Effect.fn("CiRunners.planStage")(function* (stageName: string) {
  const stack = yield* Alchemist.importStack("alchemy.run.ts");
  const snapshot = yield* Alchemist.plan({ stack, stage: stageName, operation: "deploy", envFile: "/dev/null" });
  const checked = yield* readEnginePlan(stageName, snapshot.native);
  yield* Effect.forEach(checked.resources, listChecked, { concurrency: 1, discard: true });
  yield* checkEnginePlan(checked).pipe(Effect.catchTag("PlanRefused", refuse));
  return { snapshot, checked };
});

const log = Command.make(
  "log",
  { plan: Argument.String("plan").pipe(Argument.withDescription("Path of the alchemy plan log")) },
  Effect.fn("CiRunners.planCheckLog")(function* ({ plan }) {
    const fs = yield* FileSystem.FileSystem;
    const log = yield* fs.readFileString(plan);
    const reading = readPlanLog(log);
    yield* Effect.forEach(reading.resources, listResource, { concurrency: 1, discard: true });
    yield* checkPlan(reading).pipe(Effect.catchTag("PlanRefused", refuse));
    yield* Console.log("plan-check: no replace, delete or orphan, and every line read");
  })
).pipe(Command.withDescription("Check an alchemy plan log."));

const plan = Command.make(
  "plan",
  { stage, out: Flag.String("out").pipe(Flag.withDescription("Where to save the checked plan")) },
  Effect.fn("CiRunners.planCheckPlan")(function* ({ stage: stageName, out }) {
    const { checked } = yield* planStage(stageName);
    const fs = yield* FileSystem.FileSystem;
    const text = yield* S.encodeEffect(CheckedPlanJson)(checked);
    yield* fs.writeFileString(out, text);
    yield* Console.log(`plan-check: ${checked.resources.length} resources checked and saved`);
  }, Effect.scoped)
).pipe(Command.withDescription("Plan a stage, check it and save the checked plan."));

const webhookUrl = (output: unknown) =>
  P.hasProperty(output, "webhookUrl") && P.isString(output.webhookUrl) ? [output.webhookUrl] : [];

const deploy = Command.make(
  "deploy",
  { stage, checked: Flag.String("checked").pipe(Flag.withDescription("The plan the plan step saved")) },
  Effect.fn("CiRunners.planCheckDeploy")(function* ({ stage: stageName, checked: checkedPath }) {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* fs.readFileString(checkedPath);
    const checked: CheckedPlan = yield* S.decodeEffect(CheckedPlanJson)(text);
    const { snapshot, checked: current } = yield* planStage(stageName);
    const output = yield* applyIfUnchanged(checked, current, Alchemist.apply(snapshot)).pipe(
      Effect.catchTag("PlanDrift", refuseDrift)
    );
    yield* Effect.forEach(webhookUrl(output), (url) => Console.log(`webhookUrl=${url}`), {
      concurrency: 1,
      discard: true,
    });
    yield* Console.log("plan-check: applied the checked plan");
  }, Effect.scoped)
).pipe(Command.withDescription("Plan a stage again and apply it only when it is the checked plan."));

const planCheck = Command.make("plan-check").pipe(
  Command.withDescription("The CiRunners pre-deploy gate."),
  Command.withSubcommands([log, plan, deploy])
);

Command.run(planCheck, { version: "0.0.0" }).pipe(
  Effect.provide([BunServices.layer, Alchemist.layer(), Digest.layerWebCrypto]),
  BunRuntime.runMain
);
