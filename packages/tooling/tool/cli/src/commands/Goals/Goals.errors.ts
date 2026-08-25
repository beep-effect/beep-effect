/**
 * Tagged errors for the Goals command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Defect } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Goals/Goals.errors");

/**
 * Failure raised when a goal packet directory or manifest cannot be found.
 *
 * **Example** (Create not-found error)
 *
 * ```ts
 * import { GoalPacketNotFoundError } from "@beep/repo-cli/commands/Goals/Goals.errors"
 *
 * const error = GoalPacketNotFoundError.new("nope", 'No packet directory "goals/nope".')
 * console.log(error.slug)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GoalPacketNotFoundError extends S.TaggedError<GoalPacketNotFoundError>($I`GoalPacketNotFoundError`)(
  "GoalPacketNotFoundError",
  {
    slug: S.String,
    message: S.String,
  },
  $I.annoteError<GoalPacketNotFoundError>("GoalPacketNotFoundError", {
    description: "A goal packet directory or its manifest could not be found.",
  })
) {
  /**
   * Construct a missing-packet error.
   *
   * @param slug - Goal packet slug that could not be found.
   * @param message - Diagnostic message describing the missing packet.
   * @returns A typed missing-packet error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (slug: string, message: string): GoalPacketNotFoundError =>
    GoalPacketNotFoundError.make({ slug, message });
}

/**
 * Failure raised when a goal manifest cannot be parsed or does not decode as
 * `GoalManifest`.
 *
 * **Example** (Create invalid-manifest error)
 *
 * ```ts
 * import { GoalManifestInvalidError } from "@beep/repo-cli/commands/Goals/Goals.errors"
 *
 * const error = GoalManifestInvalidError.new("canvas", "manifest does not decode as GoalManifest")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GoalManifestInvalidError extends S.TaggedError<GoalManifestInvalidError>($I`GoalManifestInvalidError`)(
  "GoalManifestInvalidError",
  {
    slug: S.String,
    message: S.String,
  },
  $I.annoteError<GoalManifestInvalidError>("GoalManifestInvalidError", {
    description: "A goal manifest failed JSON parsing or GoalManifest decoding.",
  })
) {
  /**
   * Construct an invalid-manifest error.
   *
   * @param slug - Goal packet slug whose manifest is invalid.
   * @param message - Diagnostic message describing the invalid manifest.
   * @returns A typed invalid-manifest error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (slug: string, message: string): GoalManifestInvalidError =>
    GoalManifestInvalidError.make({ slug, message });
}

/**
 * Failure raised when a packet README has no recognizable `Lifecycle:` status
 * line, so `beep goals set-status` refuses to guess an edit site.
 *
 * **Example** (Create status-line error)
 *
 * ```ts
 * import { GoalReadmeStatusLineError } from "@beep/repo-cli/commands/Goals/Goals.errors"
 *
 * const error = GoalReadmeStatusLineError.new("canvas", "README has no Lifecycle: line.")
 * console.log(error.slug)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GoalReadmeStatusLineError extends S.TaggedError<GoalReadmeStatusLineError>($I`GoalReadmeStatusLineError`)(
  "GoalReadmeStatusLineError",
  {
    slug: S.String,
    message: S.String,
  },
  $I.annoteError<GoalReadmeStatusLineError>("GoalReadmeStatusLineError", {
    description: "A packet README lacks a recognizable Lifecycle: status line to rewrite.",
  })
) {
  /**
   * Construct a missing-README-status-line error.
   *
   * @param slug - Goal packet slug whose README cannot be updated.
   * @param message - Diagnostic message describing the missing status line.
   * @returns A typed missing-README-status-line error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (slug: string, message: string): GoalReadmeStatusLineError =>
    GoalReadmeStatusLineError.make({ slug, message });
}

/**
 * Failure raised when a git command backing a goals-doctor advisory fails.
 *
 * **Details**
 *
 * Always recovered into a skipped-with-note advisory; never blocks the doctor.
 *
 * **Example** (Create git failure error)
 *
 * ```ts
 * import { GoalsGitError } from "@beep/repo-cli/commands/Goals/Goals.errors"
 *
 * const error = GoalsGitError.new("git log exited with 128")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GoalsGitError extends S.TaggedError<GoalsGitError>($I`GoalsGitError`)(
  "GoalsGitError",
  {
    message: S.String,
  },
  $I.annoteError<GoalsGitError>("GoalsGitError", {
    description: "A git command backing a goals-doctor advisory failed (recovered, never blocking).",
  })
) {
  static readonly new = (message: string): GoalsGitError => GoalsGitError.make({ message });
}

/**
 * Failure raised when a `beep goals` writer command receives unusable
 * arguments — a slug/status outside the canonical domain for `set-status`,
 * or an unknown tier / missing reason for `set-risk-tier`.
 *
 * **Example** (Create status-input error)
 *
 * ```ts
 * import { GoalStatusInputError } from "@beep/repo-cli/commands/Goals/Goals.errors"
 *
 * const error = GoalStatusInputError.new('Unknown status "DONE".')
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GoalStatusInputError extends S.TaggedError<GoalStatusInputError>($I`GoalStatusInputError`)(
  "GoalStatusInputError",
  {
    message: S.String,
  },
  $I.annoteError<GoalStatusInputError>("GoalStatusInputError", {
    description: "Invalid argument input for a beep goals writer command (set-status, set-risk-tier).",
  })
) {
  static readonly new = (message: string): GoalStatusInputError => GoalStatusInputError.make({ message });
}

/**
 * Failure raised when `beep goals bootstrap` or `beep goals adopt` receives
 * input outside the plan-input domain.
 *
 * **Details**
 *
 * Covers a missing `--plan` flag (phase 0 ships plan-only commands), a slug
 * outside the `GoalSlug` grammar, a malformed `--today` date, and a capability
 * list entry outside the capability-slug grammar. Environment facts about the packet tree (an existing slug, a
 * missing packet) are `PlanConflict` rows inside the compiled plan, never this
 * error.
 *
 * **Example** (Create plan-input error)
 *
 * ```ts
 * import { GoalPlanInputError } from "@beep/repo-cli/commands/Goals/Goals.errors"
 *
 * const error = GoalPlanInputError.new('Unknown archetype "waterfall".')
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GoalPlanInputError extends S.TaggedError<GoalPlanInputError>($I`GoalPlanInputError`)(
  "GoalPlanInputError",
  {
    message: S.String,
  },
  $I.annoteError<GoalPlanInputError>("GoalPlanInputError", {
    description: "Invalid input for beep goals bootstrap/adopt plan compilation.",
  })
) {
  static readonly new = (message: string): GoalPlanInputError => GoalPlanInputError.make({ message });
}

/**
 * Failure raised when a packet snapshot read cannot be completed.
 *
 * **Details**
 *
 * `readPacketSnapshot` only ever reads, but a directory entry that vanishes or
 * a file that cannot be read leaves the snapshot unverifiable; adoption plans
 * over unverifiable state could misclassify authored files as absent, so the
 * read fails closed with this error instead of degrading.
 *
 * **Example** (Create plan-operational error)
 *
 * ```ts
 * import { GoalPlanOperationalError } from "@beep/repo-cli/commands/Goals/Goals.errors"
 *
 * const error = GoalPlanOperationalError.new('Failed to read "goals/x/SPEC.md".')(new Error("EACCES"))
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GoalPlanOperationalError extends S.TaggedError<GoalPlanOperationalError>($I`GoalPlanOperationalError`)(
  "GoalPlanOperationalError",
  {
    message: S.String,
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<GoalPlanOperationalError>("GoalPlanOperationalError", {
    description: "A packet-snapshot read failure that must fail plan compilation closed.",
  })
) {
  static readonly new =
    (message: string): ((cause: unknown) => GoalPlanOperationalError) =>
    (cause: unknown) =>
      GoalPlanOperationalError.make({ message, cause });
}
