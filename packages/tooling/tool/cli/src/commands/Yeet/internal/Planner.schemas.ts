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
 * How a publish opens the pull request it creates.
 *
 * **Details**
 *
 * `ready` is the default: the pull request opens ready for review, labelled
 * `ready-for-heavy`, and only when the head carries a passing final-check
 * receipt, so hosted CI never runs on unfinished work and the
 * review window starts at the open. `draft` is `--draft`: a draft with no
 * heavy-admission label, so only the cheap hosted tier runs until `yeet ready`
 * flips it and applies the label. `draft-heavy` is a draft admitted to the
 * heavy matrix at the open; no flag selects it. Yeet chooses it for a stack
 * layer, which has to exist before its parent merges, and on a worker compute
 * profile, whose final-check gates only hosted CI can prove. The mode applies
 * to a pull request the publish creates; an existing one keeps its state.
 *
 * **Example** (Recognize the opt-in draft)
 *
 * ```ts
 * import { YeetPullRequestOpenMode } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetPullRequestOpenMode.is.draft("draft")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetPullRequestOpenMode = LiteralKit(["ready", "draft", "draft-heavy"]).pipe(
  $I.annoteSchema("YeetPullRequestOpenMode", {
    description:
      "How a publish opens the pull request it creates: ready, a cheap-tier draft, or a heavy-admitted draft.",
  })
);

/**
 * How a publish opens the pull request it creates.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetPullRequestOpenMode = typeof YeetPullRequestOpenMode.Type;

/**
 * Resolve the open mode a publish plans with.
 *
 * **Details**
 *
 * A stack layer (`--stack-on`) never opens ready: it must exist before its
 * parent merges, so a requested `ready` becomes `draft-heavy` and keeps the
 * label the stack gate reads. An explicit `draft` and a `draft-heavy` chosen
 * for the compute profile are kept.
 *
 * **Example** (A stack layer stays a draft)
 *
 * ```ts
 * import { yeetPullRequestOpenModeFor } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetPullRequestOpenModeFor({ requested: "ready", stackLayer: true })) // "draft-heavy"
 * console.log(yeetPullRequestOpenModeFor({ requested: "ready", stackLayer: false })) // "ready"
 * ```
 *
 * @param input - The mode the command line asked for, and whether the publish names a stack parent.
 * @returns The mode the plan opens the pull request with.
 * @category utilities
 * @since 0.0.0
 */
export const yeetPullRequestOpenModeFor = (input: {
  readonly requested: YeetPullRequestOpenMode;
  readonly stackLayer: boolean;
}): YeetPullRequestOpenMode => (input.stackLayer && input.requested === "ready" ? "draft-heavy" : input.requested);

/**
 * Choose a ready open, a cheap-tier draft or a heavy-admitted draft from the `--draft` flag and the compute profile.
 *
 * **Details**
 *
 * `--draft` always wins. Otherwise a worker compute profile, whose final-check
 * gates are hosted-only, opens a heavy-admitted draft: no receipt can pass
 * there before hosted CI has run, so the hosted proof comes first and
 * `yeet ready` flips once it is green. Every other publish opens ready.
 *
 * **Example** (A worker host opens a heavy-admitted draft)
 *
 * ```ts
 * import { yeetRequestedOpenMode } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetRequestedOpenMode({ draft: false, hostedOnlyProof: true })) // "draft-heavy"
 * console.log(yeetRequestedOpenMode({ draft: true, hostedOnlyProof: true })) // "draft"
 * ```
 *
 * @param input - Whether `--draft` was passed, and whether this host defers its proof to hosted CI.
 * @returns `draft` when asked for, else `draft-heavy` on a hosted-only host, else `ready`.
 * @category utilities
 * @since 0.0.0
 */
export const yeetRequestedOpenMode = (input: {
  readonly draft: boolean;
  readonly hostedOnlyProof: boolean;
}): YeetPullRequestOpenMode => (input.draft ? "draft" : input.hostedOnlyProof ? "draft-heavy" : "ready");

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
