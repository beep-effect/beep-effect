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
 *   (`applyIfUnchanged`); any drift stops it before a write. With
 *   `--expect-digest <sha256>` it also refuses unless the plan-rows digest
 *   both steps print equals the one a plan-only run printed.
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
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import {
  applyIfUnchanged,
  CheckedPlanJson,
  checkEnginePlan,
  newSecretSalt,
  PlanExpectation,
  planRowLine,
  planRowsDigest,
  readEnginePlan,
  readSourceTree,
  requirePlanDigest,
} from "./src/CheckedDeploy.ts";
import { placeholderCredentials, requireSigningAppKey, stageCredentials } from "./src/Credentials.ts";
import { checkPlan, mustEscalate, PlanViolation, readPlanLog } from "./src/PlanCheck.ts";
import type { CheckedPlan, CheckedResource, PlanDigestMismatch, PlanDrift } from "./src/CheckedDeploy.ts";
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

const listChecked = (resource: CheckedResource) => Console.log(planRowLine(resource));

const explain = PlanViolation.match({
  DestructiveAction: (v) => `${v.fqn}: ${v.action} is never deployed by this job`,
  DestructiveBinding: (v) => `${v.binding}: a binding replace, unbind or delete is never deployed by this job`,
  ForeignResource: (v) => `${v.fqn}: not a CiRunners resource (${v.action})`,
  UnreadableLine: (v) => `unreadable plan line: ${v.line}`,
  MissingPlan: (v) => `expected one "Plan:" header, found ${v.headers}`,
  ActionTask: (v) => `${v.fqn}: planned action task (${v.verb})`,
  PendingReplacement: (v) => `${v.fqn}: an update that would also finish a pending replacement`,
  IncompletePlan: (v) => `the summary reports ${v.summary} ${v.change}, the log lists ${v.read}`,
  UnexpectedChange: (v) => `${v.fqn}: ${v.change} is not allowed by the ${v.expectation} expectation`,
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
      ...A.map(
        drift.changed,
        (fqn) => `${fqn}: action, bindings, declared properties, starting state or source tree differ`
      ),
    ],
    (line) => Console.error(`DRIFT ${line}`),
    { concurrency: 1, discard: true }
  );
  yield* Console.error("plan-check: the deploy's plan is not the checked plan; nothing was applied");
  yield* escalate;
  return yield* drift;
});

const refuseDigest = Effect.fn("CiRunners.planDigestRefuse")(function* (mismatch: PlanDigestMismatch) {
  yield* Console.error(
    `DIGEST the plan rows digest is sha256:${mismatch.actual}, the dispatch expected sha256:${mismatch.expected}; nothing was applied`
  );
  yield* escalate;
  return yield* mismatch;
});

const stage = Flag.String("stage").pipe(Flag.withDescription("The stage to plan"));

// The bootstrap deploy excludes DefaultSecurityGroup until the deploy role is scoped to the new VPC (cutover step 1a).
const exclude = Flag.String("exclude").pipe(
  Flag.withDescription(
    "Leave this FQN or logical id out of the plan (repeatable); plan and deploy must pass the same set"
  ),
  Flag.atLeast(0)
);

// The cutover expectation (cutover decision, step 1): routine pushes, step 1a bootstrap, step 1b default group.
const expect = Flag.Literals("expect", PlanExpectation.literals).pipe(
  Flag.withDescription("The change set this deploy may apply; plan and deploy must pass the same one"),
  Flag.withDefault(PlanExpectation.Enum.routine)
);

const planStage = Effect.fn("CiRunners.planStage")(function* (input: {
  readonly stage: string;
  readonly excluded: ReadonlyArray<string>;
  readonly salt: string;
  readonly expectation: PlanExpectation;
}) {
  const { stage: stageName, excluded, salt, expectation } = input;
  // A key that passes the loader's format checks but cannot sign would deploy a fleet that never launches.
  const credentials = yield* stageCredentials(stageName);
  if (credentials !== placeholderCredentials) yield* requireSigningAppKey(credentials);
  const stack = yield* Alchemist.importStack("alchemy.run.ts");
  const snapshot = yield* Alchemist.plan({
    stack,
    stage: stageName,
    operation: "deploy",
    envFile: "/dev/null",
    ...(A.isReadonlyArrayNonEmpty(excluded) ? { exclude: excluded } : {}),
  });
  // The clean tree the bundles are built from: Alchemy keeps the bundle hash out of the plan.
  const sourceTree = yield* readSourceTree.pipe(
    Effect.tapError((unbound) => Console.error(`REFUSED ${unbound.reason}`))
  );
  const checked = yield* readEnginePlan({ stage: stageName, plan: snapshot.native, salt, expectation, sourceTree });
  yield* Effect.forEach(checked.resources, listChecked, { concurrency: 1, discard: true });
  // Rows only (FQN, action, binding actions, changed property names): no property value, secret or salt, so it is
  // stable across runs.
  // Printed before the check, so a refused plan is still read whole with its digest.
  const rowsDigest = yield* planRowsDigest(checked);
  yield* Console.log(`plan-check: plan-rows digest sha256:${rowsDigest}`);
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
  { stage, exclude, expect, out: Flag.String("out").pipe(Flag.withDescription("Where to save the checked plan")) },
  Effect.fn("CiRunners.planCheckPlan")(function* ({ stage: stageName, exclude: excluded, expect: expectation, out }) {
    const salt = yield* newSecretSalt;
    const { checked } = yield* planStage({ stage: stageName, excluded, salt, expectation });
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
  {
    stage,
    exclude,
    expect,
    checked: Flag.String("checked").pipe(Flag.withDescription("The plan the plan step saved")),
    expectDigest: Flag.String("expect-digest").pipe(
      Flag.withDescription("Apply only when the plan-rows digest equals this one (from a plan-only run)"),
      Flag.optional
    ),
  },
  Effect.fn("CiRunners.planCheckDeploy")(function* ({
    stage: stageName,
    exclude: excluded,
    expect: expectation,
    checked: checkedPath,
    expectDigest,
  }) {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* fs.readFileString(checkedPath);
    const checked: CheckedPlan = yield* S.decodeEffect(CheckedPlanJson)(text);
    // The saved salt keys the secrets fingerprint, so an unchanged secret reads the same and a changed one does not.
    const { snapshot, checked: current } = yield* planStage({
      stage: stageName,
      excluded,
      salt: checked.secretSalt,
      expectation,
    });
    yield* requirePlanDigest(current, expectDigest).pipe(Effect.catchTag("PlanDigestMismatch", refuseDigest));
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
  Effect.provide([BunServices.layer, Alchemist.layer(), Digest.layerWebCrypto, SecureRandom.layerWebCrypto]),
  BunRuntime.runMain
);
