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
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { runRootLintPolicyTask } from "../Quality/index.ts";
import { lintBaseFlag, lintFullFlag } from "./internal/LintPackage.ts";

/**
 * Lint command for repo-wide root policy checks.
 *
 * **Details**
 *
 * The changed scope is the local default and the pull-request shape; `--full`
 * or ambient `CI` without `--affected` runs the full sweep. A changed-scope run
 * still widens to the full sweep when the change set deletes a path, carries
 * `@deprecated`, or touches a tsconfig, dependency manifest, Turbo config, lint
 * config or policy implementation.
 *
 * **Example** (Show the policy lint invocation)
 *
 * ```ts
 * console.log("bun run beep lint policy --affected --base origin/main")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintPolicyCommand = Command.make(
  "policy",
  {
    full: lintFullFlag.pipe(Flag.withDescription("Run the full policy sweep locally")),
    affected: Flag.Boolean("affected").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Run the changed scope against --base even under CI (the pull-request shape)")
    ),
    base: lintBaseFlag,
  },
  Effect.fn("Lint.policy")(function* ({ full, affected, base }) {
    if (full && affected) {
      return yield* failWithReportedExit("lint policy: choose at most one of --full and --affected.");
    }
    return yield* runRootLintPolicyTask(full || (!affected && (yield* isCi)), base);
  })
).pipe(
  Command.withDescription(
    "Run repo-wide lint policy checks; changed scope locally and with --affected, full scope with --full or CI"
  )
);
