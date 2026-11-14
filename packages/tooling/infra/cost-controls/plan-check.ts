#!/usr/bin/env bun
/**
 * The pre-deploy gate the `Deploy cost controls` workflow runs between plan
 * and deploy: `bun plan-check.ts <plan.log> <live.json>`. It prints each
 * planned resource with its action and the names (never the values) of the
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
import * as S from "effect/Schema";
import { checkPlan, LiveSettings, parsePlanLog } from "./src/PlanCheck.ts";
import type { PlanCheckFailed } from "./src/PlanCheck.ts";

const decodeLive = S.decodeUnknownEffect(S.fromJsonString(LiveSettings));

const report = Effect.fn("CostControls.planCheckReport")(function* (failure: PlanCheckFailed) {
  for (const violation of failure.violations) {
    yield* Console.error(`REFUSED ${violation.subject}: ${violation.reason} (${violation.detail})`);
  }
  if (failure.escalate) {
    yield* Console.error(
      "STOP: the plan names a resource outside the cost-controls stack. Do not deploy; ask the CI goals driver " +
        "through the orchestrator (docs/runbooks/alchemy-infra.md, section Cost controls)."
    );
  }
  return yield* failure;
});

const planCheck = Command.make(
  "plan-check",
  {
    plan: Argument.String("plan").pipe(Argument.withDescription("Path of the detailed alchemy plan log")),
    live: Argument.String("live").pipe(Argument.withDescription("Path of the live-settings JSON document")),
  },
  Effect.fn("CostControls.planCheckCli")(function* ({ plan, live }) {
    const fs = yield* FileSystem.FileSystem;
    const planLog = yield* fs.readFileString(plan);
    const liveJson = yield* fs.readFileString(live);
    const entries = parsePlanLog(planLog);
    const settings = yield* decodeLive(liveJson);
    for (const entry of entries) {
      const changed = A.isReadonlyArrayNonEmpty(entry.changedProperties)
        ? ` changes: ${A.join(entry.changedProperties, ", ")}`
        : "";
      yield* Console.log(`[${entry.fqn}] ${entry.action}${changed}`);
    }
    yield* checkPlan(entries, settings).pipe(Effect.catchTag("PlanCheckFailed", report));
    yield* Console.log(
      "plan-check: every adopted singleton is an adopt or no-op with no property change; deploy may run"
    );
  })
).pipe(Command.withDescription("Refuse a cost-controls deploy whose plan changes an adopted account setting."));

Command.run(planCheck, { version: "0.0.0" }).pipe(Effect.provide(BunServices.layer), BunRuntime.runMain);
