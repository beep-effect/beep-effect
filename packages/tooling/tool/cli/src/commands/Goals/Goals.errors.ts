/**
 * Tagged errors for the Goals command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Goals/Goals.errors");

const GoalPacketNotFoundErrorFields = {
  slug: S.String,
  message: S.String,
} satisfies S.Struct.Fields;
const sameGoalPacketNotFoundErrorFields = S.toEquivalence(
  S.TaggedStruct("GoalPacketNotFoundError", GoalPacketNotFoundErrorFields)
);
const sameGoalPacketNotFoundError = (self: GoalPacketNotFoundError, that: GoalPacketNotFoundError): boolean =>
  sameGoalPacketNotFoundErrorFields(self, that);

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
  GoalPacketNotFoundErrorFields,
  $I.annoteClass<
    S.declare<GoalPacketNotFoundError>,
    readonly [S.TaggedStruct<"GoalPacketNotFoundError", typeof GoalPacketNotFoundErrorFields>]
  >("GoalPacketNotFoundError", {
    description: "A goal packet directory or its manifest could not be found.",
    toEquivalence: () => sameGoalPacketNotFoundError,
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

const GoalManifestInvalidErrorFields = {
  slug: S.String,
  message: S.String,
} satisfies S.Struct.Fields;
const sameGoalManifestInvalidErrorFields = S.toEquivalence(
  S.TaggedStruct("GoalManifestInvalidError", GoalManifestInvalidErrorFields)
);
const sameGoalManifestInvalidError = (self: GoalManifestInvalidError, that: GoalManifestInvalidError): boolean =>
  sameGoalManifestInvalidErrorFields(self, that);

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
  GoalManifestInvalidErrorFields,
  $I.annoteClass<
    S.declare<GoalManifestInvalidError>,
    readonly [S.TaggedStruct<"GoalManifestInvalidError", typeof GoalManifestInvalidErrorFields>]
  >("GoalManifestInvalidError", {
    description: "A goal manifest failed JSON parsing or GoalManifest decoding.",
    toEquivalence: () => sameGoalManifestInvalidError,
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

const GoalReadmeStatusLineErrorFields = {
  slug: S.String,
  message: S.String,
} satisfies S.Struct.Fields;
const sameGoalReadmeStatusLineErrorFields = S.toEquivalence(
  S.TaggedStruct("GoalReadmeStatusLineError", GoalReadmeStatusLineErrorFields)
);
const sameGoalReadmeStatusLineError = (self: GoalReadmeStatusLineError, that: GoalReadmeStatusLineError): boolean =>
  sameGoalReadmeStatusLineErrorFields(self, that);

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
  GoalReadmeStatusLineErrorFields,
  $I.annoteClass<
    S.declare<GoalReadmeStatusLineError>,
    readonly [S.TaggedStruct<"GoalReadmeStatusLineError", typeof GoalReadmeStatusLineErrorFields>]
  >("GoalReadmeStatusLineError", {
    description: "A packet README lacks a recognizable Lifecycle: status line to rewrite.",
    toEquivalence: () => sameGoalReadmeStatusLineError,
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

const GoalsGitErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameGoalsGitErrorFields = S.toEquivalence(S.TaggedStruct("GoalsGitError", GoalsGitErrorFields));
const sameGoalsGitError = (self: GoalsGitError, that: GoalsGitError): boolean => sameGoalsGitErrorFields(self, that);

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
  GoalsGitErrorFields,
  $I.annoteClass<S.declare<GoalsGitError>, readonly [S.TaggedStruct<"GoalsGitError", typeof GoalsGitErrorFields>]>(
    "GoalsGitError",
    {
      description: "A git command backing a goals-doctor advisory failed (recovered, never blocking).",
      toEquivalence: () => sameGoalsGitError,
    }
  )
) {
  static readonly new = (message: string): GoalsGitError => GoalsGitError.make({ message });
}

const GoalStatusInputErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameGoalStatusInputErrorFields = S.toEquivalence(
  S.TaggedStruct("GoalStatusInputError", GoalStatusInputErrorFields)
);
const sameGoalStatusInputError = (self: GoalStatusInputError, that: GoalStatusInputError): boolean =>
  sameGoalStatusInputErrorFields(self, that);

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
  GoalStatusInputErrorFields,
  $I.annoteClass<
    S.declare<GoalStatusInputError>,
    readonly [S.TaggedStruct<"GoalStatusInputError", typeof GoalStatusInputErrorFields>]
  >("GoalStatusInputError", {
    description: "Invalid argument input for a beep goals writer command (set-status, set-risk-tier).",
    toEquivalence: () => sameGoalStatusInputError,
  })
) {
  static readonly new = (message: string): GoalStatusInputError => GoalStatusInputError.make({ message });
}

const GoalPlanInputErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameGoalPlanInputErrorFields = S.toEquivalence(S.TaggedStruct("GoalPlanInputError", GoalPlanInputErrorFields));
const sameGoalPlanInputError = (self: GoalPlanInputError, that: GoalPlanInputError): boolean =>
  sameGoalPlanInputErrorFields(self, that);

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
  GoalPlanInputErrorFields,
  $I.annoteClass<
    S.declare<GoalPlanInputError>,
    readonly [S.TaggedStruct<"GoalPlanInputError", typeof GoalPlanInputErrorFields>]
  >("GoalPlanInputError", {
    description: "Invalid input for beep goals bootstrap/adopt plan compilation.",
    toEquivalence: () => sameGoalPlanInputError,
  })
) {
  static readonly new = (message: string): GoalPlanInputError => GoalPlanInputError.make({ message });
}

const GoalPlanOperationalErrorFields = {
  message: S.String,
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameGoalPlanOperationalErrorFields = S.toEquivalence(
  S.TaggedStruct("GoalPlanOperationalError", {
    message: GoalPlanOperationalErrorFields.message,
  })
);
const sameGoalPlanOperationalError = (self: GoalPlanOperationalError, that: GoalPlanOperationalError): boolean =>
  sameGoalPlanOperationalErrorFields(self, that);

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
  GoalPlanOperationalErrorFields,
  $I.annoteClass<
    S.declare<GoalPlanOperationalError>,
    readonly [S.TaggedStruct<"GoalPlanOperationalError", typeof GoalPlanOperationalErrorFields>]
  >("GoalPlanOperationalError", {
    description: "A packet-snapshot read failure that must fail plan compilation closed.",
    toEquivalence: () => sameGoalPlanOperationalError,
  })
) {
  static readonly new =
    (message: string): ((cause: unknown) => GoalPlanOperationalError) =>
    (cause: unknown) =>
      GoalPlanOperationalError.make({ message, cause });
}
