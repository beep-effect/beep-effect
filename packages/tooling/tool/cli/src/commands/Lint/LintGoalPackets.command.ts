/**
 * Goal packet lint: `beep lint goal-packets`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Command from "effect/cli/Command";
import { runGoalsDoctor } from "../Goals/Doctor.ts";

/**
 * Lint alias for the goals doctor (the CLI has no command-alias mechanism, so
 * this second registration delegates to the Goals runner).
 *
 * **Example** (Show the goal-packets lint invocation)
 *
 * ```ts
 * console.log("bun run beep lint goal-packets")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintGoalPacketsCommand = Command.make("goal-packets", {}, () =>
  runGoalsDoctor({ writeBaseline: false })
).pipe(Command.withDescription("Diff goal-packet manifests against reality (alias of beep goals doctor)"));
