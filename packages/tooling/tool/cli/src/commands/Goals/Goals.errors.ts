/**
 * Tagged errors for the Goals command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Goals/Goals.errors");

/**
 * Failure raised when a goal packet directory or manifest cannot be found.
 *
 * @example
 * ```ts
 * import { GoalPacketNotFoundError } from "@beep/repo-cli/commands/Goals/Goals.errors"
 *
 * const error = GoalPacketNotFoundError.new("nope", 'No packet directory "goals/nope".')
 * console.log(error.slug)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class GoalPacketNotFoundError extends TaggedErrorClass<GoalPacketNotFoundError>($I`GoalPacketNotFoundError`)(
  "GoalPacketNotFoundError",
  {
    slug: S.String,
    message: S.String,
  },
  $I.annote("GoalPacketNotFoundError", {
    description: "A goal packet directory or its manifest could not be found.",
  })
) {
  static readonly new = (slug: string, message: string): GoalPacketNotFoundError =>
    GoalPacketNotFoundError.make({ slug, message });
}

/**
 * Failure raised when a goal manifest cannot be parsed or does not decode as
 * `GoalManifest`.
 *
 * @example
 * ```ts
 * import { GoalManifestInvalidError } from "@beep/repo-cli/commands/Goals/Goals.errors"
 *
 * const error = GoalManifestInvalidError.new("canvas", "manifest does not decode as GoalManifest")
 * console.log(error.message)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class GoalManifestInvalidError extends TaggedErrorClass<GoalManifestInvalidError>($I`GoalManifestInvalidError`)(
  "GoalManifestInvalidError",
  {
    slug: S.String,
    message: S.String,
  },
  $I.annote("GoalManifestInvalidError", {
    description: "A goal manifest failed JSON parsing or GoalManifest decoding.",
  })
) {
  static readonly new = (slug: string, message: string): GoalManifestInvalidError =>
    GoalManifestInvalidError.make({ slug, message });
}

/**
 * Failure raised when a packet README has no recognizable `Lifecycle:` status
 * line, so `beep goals set-status` refuses to guess an edit site.
 *
 * @example
 * ```ts
 * import { GoalReadmeStatusLineError } from "@beep/repo-cli/commands/Goals/Goals.errors"
 *
 * const error = GoalReadmeStatusLineError.new("canvas", "README has no Lifecycle: line.")
 * console.log(error.slug)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class GoalReadmeStatusLineError extends TaggedErrorClass<GoalReadmeStatusLineError>(
  $I`GoalReadmeStatusLineError`
)(
  "GoalReadmeStatusLineError",
  {
    slug: S.String,
    message: S.String,
  },
  $I.annote("GoalReadmeStatusLineError", {
    description: "A packet README lacks a recognizable Lifecycle: status line to rewrite.",
  })
) {
  static readonly new = (slug: string, message: string): GoalReadmeStatusLineError =>
    GoalReadmeStatusLineError.make({ slug, message });
}

/**
 * Failure raised when a git command backing a goals-doctor advisory fails.
 *
 * Always recovered into a skipped-with-note advisory; never blocks the doctor.
 *
 * @example
 * ```ts
 * import { GoalsGitError } from "@beep/repo-cli/commands/Goals/Goals.errors"
 *
 * const error = GoalsGitError.new("git log exited with 128")
 * console.log(error.message)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class GoalsGitError extends TaggedErrorClass<GoalsGitError>($I`GoalsGitError`)(
  "GoalsGitError",
  {
    message: S.String,
  },
  $I.annote("GoalsGitError", {
    description: "A git command backing a goals-doctor advisory failed (recovered, never blocking).",
  })
) {
  static readonly new = (message: string): GoalsGitError => GoalsGitError.make({ message });
}

/**
 * Failure raised when `beep goals set-status` receives arguments outside the
 * canonical status domain or an unusable slug/status combination.
 *
 * @example
 * ```ts
 * import { GoalStatusInputError } from "@beep/repo-cli/commands/Goals/Goals.errors"
 *
 * const error = GoalStatusInputError.new('Unknown status "DONE".')
 * console.log(error.message)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class GoalStatusInputError extends TaggedErrorClass<GoalStatusInputError>($I`GoalStatusInputError`)(
  "GoalStatusInputError",
  {
    message: S.String,
  },
  $I.annote("GoalStatusInputError", {
    description: "Invalid slug/status input for beep goals set-status.",
  })
) {
  static readonly new = (message: string): GoalStatusInputError => GoalStatusInputError.make({ message });
}
