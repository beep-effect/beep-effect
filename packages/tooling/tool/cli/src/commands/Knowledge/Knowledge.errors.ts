/**
 * Typed failures for knowledge semantic-delta operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Knowledge/Knowledge.errors");

/**
 * The exact remediation appended to every failure caused by shallow or incomplete Git history.
 *
 * **When to use**
 *
 * Use when reporting a failure to resolve `HEAD`, the base ref, or the merge-base, so the operator
 * reads one canonical fix instead of a bare Git error.
 *
 * **Example** (Attach the remediation to a history failure)
 *
 * ```ts
 * import {
 *   KNOWLEDGE_HISTORY_REMEDIATION,
 *   KnowledgeOperationalError,
 * } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 *
 * const error = KnowledgeOperationalError.make({
 *   message: `Cannot resolve the merge-base. ${KNOWLEDGE_HISTORY_REMEDIATION}`,
 * })
 *
 * console.log(error.message.includes("fetch-depth: 0")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_HISTORY_REMEDIATION =
  "Ensure CI checks out full history with `fetch-depth: 0`; for an existing shallow clone run `git fetch --unshallow`.";

/**
 * An operational scanner failure that must fail the run closed.
 *
 * **Details**
 *
 * Git, archive extraction, UTF-8 decoding, probe-spawn, and probe-output failures all raise this
 * error rather than becoming synthetic findings. Emitting them as findings would let a broken
 * scanner look like a clean comparison, so they stay strictly in the error channel. The one probe
 * failure that is not automatically operational is {@link KnowledgeProbeBootError}, which the
 * merge-base side degrades instead of raising. The reference census reuses the same error for
 * tree resolution and for an undecodable goal manifest: one operational error per family beats a
 * parallel hierarchy, and a census that cannot read the tree it was asked about must never report
 * an empty one.
 *
 * **Example** (Fail a scan closed)
 *
 * ```ts
 * import { KnowledgeOperationalError } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 * import { Effect, Result } from "effect"
 *
 * const scan = Effect.fail(KnowledgeOperationalError.make({ message: "git archive failed." }))
 * const outcome = Effect.runSync(Effect.result(scan))
 *
 * console.log(Result.isFailure(outcome)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KnowledgeOperationalError extends S.TaggedError<KnowledgeOperationalError>($I`KnowledgeOperationalError`)(
  "KnowledgeOperationalError",
  {
    message: S.String,
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("KnowledgeOperationalError", {
    description:
      "A Git, tree-resolution, archive, UTF-8, manifest-decode, command-probe, or index-probe failure that must fail closed.",
  })
) {
  /**
   * Constructs an operational error that retains the original failure as its cause.
   *
   * **Details**
   *
   * The dual call forms carry the same meaning: pass the cause and message together, or supply the
   * message first to obtain a function awaiting the cause.
   *
   * **Example** (Wrap a spawn failure)
   *
   * ```ts
   * import { KnowledgeOperationalError } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
   *
   * const error = KnowledgeOperationalError.new(new Error("spawn git ENOENT"), "Failed to spawn git.")
   *
   * console.log(error.message) // "Failed to spawn git."
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly new: {
    (cause: unknown, message: string): KnowledgeOperationalError;
    (message: string): (cause: unknown) => KnowledgeOperationalError;
  } = dual(
    2,
    (cause: unknown, message: string): KnowledgeOperationalError => KnowledgeOperationalError.make({ message, cause })
  );

  /**
   * Replaces any failure in an effect's error channel with an operational error carrying that cause.
   *
   * **Example** (Normalize a Git failure)
   *
   * ```ts
   * import { KnowledgeOperationalError } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
   * import { Effect, pipe } from "effect"
   *
   * const failure = pipe(
   *   Effect.fail(new Error("spawn git ENOENT")),
   *   KnowledgeOperationalError.mapError("Failed to spawn git."),
   *   Effect.flip
   * )
   *
   * console.log(Effect.runSync(failure).message) // "Failed to spawn git."
   * ```
   *
   * @category error-handling
   * @since 0.0.0
   */
  static readonly mapError = Err.mapToError(this.new);
}

/**
 * An archive-local probe process that exited non-zero without emitting its structured output.
 *
 * **Details**
 *
 * The probes import the scanned revision's own CLI modules, so a revision whose workspace imports no
 * longer resolve — a deleted barrel export, an unparsable module — dies before it can report
 * anything. This class is separate from {@link KnowledgeOperationalError} because the two sides of a
 * comparison own the failure differently: on HEAD it is the branch author's own tree and is re-raised
 * as operational, while on the merge-base it degrades the comparison's probe coverage and is recorded
 * in the report instead of failing the run.
 *
 * **Gotchas**
 *
 * Only a non-zero exit is a boot failure. A probe that exits zero and prints output the scanner
 * cannot parse is a scanner defect, and stays a {@link KnowledgeOperationalError} on both sides.
 *
 * **Example** (Report an unbootable probe)
 *
 * ```ts
 * import { KnowledgeProbeBootError } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 *
 * const error = KnowledgeProbeBootError.make({
 *   message: 'Archive-local probe "command-probe.ts" failed with exit 1.',
 * })
 *
 * console.log(error._tag) // "KnowledgeProbeBootError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KnowledgeProbeBootError extends S.TaggedError<KnowledgeProbeBootError>($I`KnowledgeProbeBootError`)(
  "KnowledgeProbeBootError",
  {
    message: S.String,
  },
  $I.annote("KnowledgeProbeBootError", {
    description: "An archive-local probe that exited non-zero before emitting structured output.",
  })
) {}

/**
 * The gate failure raised once a rendered report contains introduced blocking findings.
 *
 * **Details**
 *
 * The report is printed before this error is raised, so the operator always sees the offending
 * findings alongside the non-zero exit. `introducedCount` mirrors the length of the report's
 * `introduced` bucket.
 *
 * **Example** (Signal a failing semantic delta)
 *
 * ```ts
 * import { KnowledgeIntroducedFindingsError } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const error = KnowledgeIntroducedFindingsError.make({
 *   message: "knowledge semantic-delta: 2 introduced blocking finding(s).",
 *   introducedCount: NonNegativeInt.make(2),
 * })
 *
 * console.log(error.introducedCount) // 2
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KnowledgeIntroducedFindingsError extends S.TaggedError<KnowledgeIntroducedFindingsError>(
  $I`KnowledgeIntroducedFindingsError`
)(
  "KnowledgeIntroducedFindingsError",
  {
    message: S.String,
    introducedCount: NonNegativeInt,
  },
  $I.annote("KnowledgeIntroducedFindingsError", {
    description: "The report contains one or more introduced blocking Stage-1 findings.",
  })
) {}
