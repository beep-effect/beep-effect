/**
 * Yeet run vocabulary shared by the planner and the proof records: run modes,
 * the artifact directory and the push step id.
 *
 * **Details**
 *
 * Split from `Planner.ts` so proof jobs, verdicts and issue schemas read the
 * vocabulary without importing the planner (beep-cli-composition W1b).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $RepoCliId.create("commands/Yeet/internal/Planner.schemas");

/**
 * Default ignored directory for yeet run artifacts.
 *
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_YEET_PACKET_DIR = ".beep/yeet" as const;

/**
 * Yeet execution modes.
 *
 * **Example** (Plan a Yeet run)
 *
 * ```ts
 * import { YeetRunMode } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetRunMode.is.verify("verify"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetRunMode = LiteralKit(["repair", "verify", "publish", "monitor", "closeout", "status"]).pipe(
  $I.annoteSchema("YeetRunMode", {
    description: "Execution mode selected for a yeet repository run.",
  })
);

/**
 * Yeet execution modes.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetRunMode = typeof YeetRunMode.Type;

/**
 * Stable plan-step identifier for the branch push, shared by every publish path.
 *
 * **Details**
 *
 * The publish phase also carries the preflight and pull-request steps, so this
 * id — not the phase — is what proves the branch actually reached the remote.
 *
 * **Example** (Recognize the push step)
 *
 * ```ts
 * import { GIT_PUSH_STEP_ID } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(GIT_PUSH_STEP_ID) // "publish:01-git-push"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const GIT_PUSH_STEP_ID = "publish:01-git-push" as const;
