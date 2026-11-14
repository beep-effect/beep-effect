#!/usr/bin/env bun
/**
 * Entry point of the `OipWeb` pre-deploy check:
 * `bun apps/oip-web/stack/plan-guard.ts <plan-log>` exits non-zero when the
 * plan replaces or deletes a guarded resource or cannot be read.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import { checkPlan } from "./PlanGuard.ts";

/**
 * The `plan-guard` command: reads the plan log and prints the verdict.
 *
 * **Example** (Inspect the command)
 *
 * ```ts
 * import { planGuardCommand } from "./plan-guard.ts"
 *
 * console.log(planGuardCommand.name) // "plan-guard"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const planGuardCommand = Command.make(
  "plan-guard",
  { log: Argument.FileText("plan-log") },
  Effect.fn("OipWeb.planGuard")(function* ({ log }) {
    const entries = yield* checkPlan(log).pipe(
      Effect.tapError((error) =>
        Console.error(
          error._tag === "PlanRefused"
            ? `plan-guard: refused, the plan removes ${A.join(
                A.map(error.refused, (entry) => `${entry.fqn} (${entry.action})`),
                ", "
              )}`
            : `plan-guard: refused, ${error.reason}`
        )
      )
    );
    yield* Console.log(`plan-guard: ${A.length(entries)} resource line(s); no guarded replace or delete`);
  })
);

if (import.meta.main) {
  Command.run(planGuardCommand, { version: "0.0.0" }).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
}
