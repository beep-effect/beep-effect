/**
 * Repo-wide root policy sweep: `beep lint policy`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { isCi } from "../../internal/cli/EnvConfig.ts";
import { runRootLintPolicyTask } from "../Quality/index.ts";
import { lintBaseFlag, lintFullFlag } from "./internal/LintPackage.ts";

/**
 * Lint command for repo-wide root policy checks.
 *
 * **Example** (Show the policy lint invocation)
 *
 * ```ts
 * console.log("bun run beep lint policy")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintPolicyCommand = Command.make(
  "policy",
  {
    full: lintFullFlag.pipe(Flag.withDescription("Run the full policy sweep locally")),
    base: lintBaseFlag,
  },
  Effect.fn("Lint.policy")(function* ({ full, base }) {
    return yield* runRootLintPolicyTask(full || (yield* isCi), base);
  })
).pipe(
  Command.withDescription(
    "Run repo-wide lint policy checks; laws use affected Turbo tasks locally and full scope with --full or CI"
  )
);
