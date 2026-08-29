/**
 * Typed path-safety failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FileProcessingId } from "@beep/identity";
import { Defect, LiteralKit } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $FileProcessingId.create("PathSafety");

/**
 * Machine-readable reasons a path was rejected by the safety guard.
 *
 * **Details**
 *
 * Every reason is fail-closed: the guard refuses access rather than guessing.
 *
 * **Example** (Log violation reason options)
 *
 * ```ts
 * import { PathSafetyViolationReason } from "@beep/file-processing/PathSafety"
 *
 * console.log(PathSafetyViolationReason.Options)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const PathSafetyViolationReason = LiteralKit([
  "escapes-root",
  "canonical-root-not-absolute",
  "root-not-resolvable",
  "candidate-not-resolvable",
]).pipe(
  $I.annoteSchema("PathSafetyViolationReason", {
    description:
      "Fail-closed reasons a candidate path was rejected: it escapes the allowed root, the pinned canonical root is not absolute, or the root or candidate could not be canonicalized.",
  })
);

/**
 * Type for {@link PathSafetyViolationReason}.
 *
 * **Example** (Check escapes-root reason type)
 *
 * ```ts import.meta.vitest name="Check escapes-root reason type"
 * import { PathSafetyViolationReason } from "@beep/file-processing/PathSafety"
 *
 * const reason: PathSafetyViolationReason = "escapes-root"
 * PathSafetyViolationReason.is["escapes-root"](reason) // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type PathSafetyViolationReason = typeof PathSafetyViolationReason.Type;

/**
 * Typed, fail-closed path-safety violation.
 *
 * **Details**
 *
 * Carries the sanitized allowed root, the original candidate path, and (when
 * the candidate canonicalized) the resolved real path that escaped the root.
 *
 * **Example** (Create escapesRoot error)
 *
 * ```ts import.meta.vitest name="Create escapesRoot error"
 * import { PathSafetyError } from "@beep/file-processing/PathSafety"
 *
 * const error = PathSafetyError.escapesRoot({
 *   root: "/srv/data",
 *   candidate: "../etc/passwd",
 *   resolved: "/etc/passwd"
 * })
 * error.reason // => "escapes-root"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PathSafetyError extends S.TaggedError<PathSafetyError>($I`PathSafetyError`)(
  "PathSafetyError",
  {
    candidate: S.String,
    cause: S.OptionFromOptionalKey(Defect({ includeStack: true })),
    message: S.String,
    reason: PathSafetyViolationReason,
    resolved: S.OptionFromOptionalKey(S.String),
    root: S.String,
  },
  $I.annoteError<PathSafetyError>("PathSafetyError", {
    description:
      "Typed, fail-closed error raised when a candidate path escapes its allowed root or cannot be canonicalized.",
  })
) {
  /**
   * Construct an `escapes-root` violation.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly escapesRoot = (options: {
    readonly root: string;
    readonly candidate: string;
    readonly resolved: string;
  }): PathSafetyError =>
    PathSafetyError.make({
      candidate: options.candidate,
      cause: O.none(),
      message: `Path "${options.candidate}" resolves to "${options.resolved}" which escapes the allowed root "${options.root}".`,
      reason: "escapes-root",
      resolved: O.some(options.resolved),
      root: options.root,
    });

  /**
   * Construct a `root-not-resolvable` violation.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly rootNotResolvable = (options: {
    readonly root: string;
    readonly candidate: string;
    readonly cause: unknown;
  }): PathSafetyError =>
    PathSafetyError.make({
      candidate: options.candidate,
      cause: O.some(options.cause),
      message: `Allowed root "${options.root}" could not be canonicalized.`,
      reason: "root-not-resolvable",
      resolved: O.none(),
      root: options.root,
    });

  /**
   * Construct a `canonical-root-not-absolute` violation.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly canonicalRootNotAbsolute = (options: {
    readonly root: string;
    readonly candidate: string;
  }): PathSafetyError =>
    PathSafetyError.make({
      candidate: options.candidate,
      cause: O.none(),
      message: `Pinned canonical root "${options.root}" must be an absolute path.`,
      reason: "canonical-root-not-absolute",
      resolved: O.none(),
      root: options.root,
    });

  /**
   * Construct a `candidate-not-resolvable` violation.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly candidateNotResolvable = (options: {
    readonly root: string;
    readonly candidate: string;
    readonly cause: unknown;
  }): PathSafetyError =>
    PathSafetyError.make({
      candidate: options.candidate,
      cause: O.some(options.cause),
      message: `Candidate path "${options.candidate}" could not be canonicalized under root "${options.root}".`,
      reason: "candidate-not-resolvable",
      resolved: O.none(),
      root: options.root,
    });
}
