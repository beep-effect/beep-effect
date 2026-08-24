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

const KnowledgeOperationalErrorFields = {
  message: S.String,
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameKnowledgeOperationalErrorFields = S.toEquivalence(
  S.TaggedStruct("KnowledgeOperationalError", {
    message: KnowledgeOperationalErrorFields.message,
  })
);
const sameKnowledgeOperationalError = (self: KnowledgeOperationalError, that: KnowledgeOperationalError): boolean =>
  sameKnowledgeOperationalErrorFields(self, that);

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
  KnowledgeOperationalErrorFields,
  $I.annoteClass<
    S.declare<KnowledgeOperationalError>,
    readonly [S.TaggedStruct<"KnowledgeOperationalError", typeof KnowledgeOperationalErrorFields>]
  >("KnowledgeOperationalError", {
    description:
      "A Git, tree-resolution, archive, UTF-8, manifest-decode, command-probe, or index-probe failure that must fail closed.",
    toEquivalence: () => sameKnowledgeOperationalError,
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

const KnowledgeProbeBootErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameKnowledgeProbeBootErrorFields = S.toEquivalence(
  S.TaggedStruct("KnowledgeProbeBootError", KnowledgeProbeBootErrorFields)
);
const sameKnowledgeProbeBootError = (self: KnowledgeProbeBootError, that: KnowledgeProbeBootError): boolean =>
  sameKnowledgeProbeBootErrorFields(self, that);

/**
 * A current-checkout probe over archive data that exited non-zero without structured output.
 *
 * **Details**
 *
 * The probes import current-checkout CLI modules and use the selected revision only as filesystem
 * data. A module boot failure or a projection that rejects that data can still exit before reporting
 * anything. This class is separate from {@link KnowledgeOperationalError} because the two data sides
 * of a comparison own the failure differently: on HEAD it is the branch author's own tree and is
 * re-raised as operational, while on the merge-base it degrades the comparison's probe coverage and
 * is recorded in the report instead of failing the run.
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
 *   message: "Current-checkout command probe against archive data failed with exit 1.",
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
  KnowledgeProbeBootErrorFields,
  $I.annoteClass<
    S.declare<KnowledgeProbeBootError>,
    readonly [S.TaggedStruct<"KnowledgeProbeBootError", typeof KnowledgeProbeBootErrorFields>]
  >("KnowledgeProbeBootError", {
    description: "A current-checkout probe over archive data that exited before emitting structured output.",
    toEquivalence: () => sameKnowledgeProbeBootError,
  })
) {}

const KnowledgeIntroducedFindingsErrorFields = {
  message: S.String,
  introducedCount: NonNegativeInt,
} satisfies S.Struct.Fields;
const sameKnowledgeIntroducedFindingsErrorFields = S.toEquivalence(
  S.TaggedStruct("KnowledgeIntroducedFindingsError", KnowledgeIntroducedFindingsErrorFields)
);
const sameKnowledgeIntroducedFindingsError = (
  self: KnowledgeIntroducedFindingsError,
  that: KnowledgeIntroducedFindingsError
): boolean => sameKnowledgeIntroducedFindingsErrorFields(self, that);

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
  KnowledgeIntroducedFindingsErrorFields,
  $I.annoteClass<
    S.declare<KnowledgeIntroducedFindingsError>,
    readonly [S.TaggedStruct<"KnowledgeIntroducedFindingsError", typeof KnowledgeIntroducedFindingsErrorFields>]
  >("KnowledgeIntroducedFindingsError", {
    description: "The report contains one or more introduced blocking Stage-1 findings.",
    toEquivalence: () => sameKnowledgeIntroducedFindingsError,
  })
) {}

const KnowledgeHostPathDebtErrorFields = {
  message: S.String,
  liveDebtCount: NonNegativeInt,
} satisfies S.Struct.Fields;
const sameKnowledgeHostPathDebtErrorFields = S.toEquivalence(
  S.TaggedStruct("KnowledgeHostPathDebtError", KnowledgeHostPathDebtErrorFields)
);
const sameKnowledgeHostPathDebtError = (self: KnowledgeHostPathDebtError, that: KnowledgeHostPathDebtError): boolean =>
  sameKnowledgeHostPathDebtErrorFields(self, that);

/**
 * The gate failure raised when a checked census still carries live host-path debt.
 *
 * **Details**
 *
 * `beep knowledge refs --check` prints the whole census before raising this error, so the operator
 * always sees the offending observations alongside the non-zero exit. `liveDebtCount` mirrors the
 * number of live observations in the gated classification set (`actionable-host-path` and
 * `external-mirror-reference`) — the observation classes that map to the reserved
 * `host-path-in-live-guidance` finding kind.
 *
 * **Example** (Signal standing host-path debt)
 *
 * ```ts
 * import { KnowledgeHostPathDebtError } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const error = KnowledgeHostPathDebtError.make({
 *   message: "knowledge refs --check: 3 live host-path observation(s).",
 *   liveDebtCount: NonNegativeInt.make(3),
 * })
 *
 * console.log(error.liveDebtCount) // 3
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KnowledgeHostPathDebtError extends S.TaggedError<KnowledgeHostPathDebtError>(
  $I`KnowledgeHostPathDebtError`
)(
  "KnowledgeHostPathDebtError",
  KnowledgeHostPathDebtErrorFields,
  $I.annoteClass<
    S.declare<KnowledgeHostPathDebtError>,
    readonly [S.TaggedStruct<"KnowledgeHostPathDebtError", typeof KnowledgeHostPathDebtErrorFields>]
  >("KnowledgeHostPathDebtError", {
    description: "The checked census carries live host-path observations in the gated classes.",
    toEquivalence: () => sameKnowledgeHostPathDebtError,
  })
) {}

const KnowledgeCloneAttributesErrorFields = {
  message: S.String,
  attributesPath: S.String,
} satisfies S.Struct.Fields;
const sameKnowledgeCloneAttributesErrorFields = S.toEquivalence(
  S.TaggedStruct("KnowledgeCloneAttributesError", KnowledgeCloneAttributesErrorFields)
);
const sameKnowledgeCloneAttributesError = (
  self: KnowledgeCloneAttributesError,
  that: KnowledgeCloneAttributesError
): boolean => sameKnowledgeCloneAttributesErrorFields(self, that);

/**
 * The guard failure raised when a non-empty clone-local git attributes file is present.
 *
 * **Details**
 *
 * The clone-local attributes file (`git rev-parse --git-path info/attributes`) outranks every
 * attribute layer the canonical archive contract pins, and no git invocation can disable it
 * (measured against git 2.55.0 — `goals/knowledge-surface-automation/research/p3-hermetic-lane-decisions.md`).
 * A non-empty file would silently rewrite the hermetic archive bytes both knowledge commands
 * compare, so tree materialization refuses to archive while one is present. The file is absent
 * from fresh clones and CI, where this guard is vacuously green; an empty file also passes.
 *
 * **Example** (Fail closed on a non-empty clone-local attributes file)
 *
 * ```ts
 * import { KnowledgeCloneAttributesError } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 *
 * const error = KnowledgeCloneAttributesError.at("/repo/.git/info/attributes")
 *
 * console.log(error.attributesPath) // "/repo/.git/info/attributes"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KnowledgeCloneAttributesError extends S.TaggedError<KnowledgeCloneAttributesError>(
  $I`KnowledgeCloneAttributesError`
)(
  "KnowledgeCloneAttributesError",
  KnowledgeCloneAttributesErrorFields,
  $I.annoteClass<
    S.declare<KnowledgeCloneAttributesError>,
    readonly [S.TaggedStruct<"KnowledgeCloneAttributesError", typeof KnowledgeCloneAttributesErrorFields>]
  >("KnowledgeCloneAttributesError", {
    description: "A non-empty clone-local git attributes file would silently rewrite hermetic archive bytes.",
    toEquivalence: () => sameKnowledgeCloneAttributesError,
  })
) {
  /**
   * Constructs the guard failure for one resolved clone-local attributes path.
   *
   * **Details**
   *
   * The message carries the remediation inline: the file must be moved or deleted, because no git
   * invocation can suppress it and any attribute rules it holds belong in the repository's tracked
   * `.gitattributes` instead.
   *
   * **Example** (Name the offending file)
   *
   * ```ts
   * import { KnowledgeCloneAttributesError } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
   *
   * const error = KnowledgeCloneAttributesError.at("/repo/.git/info/attributes")
   *
   * console.log(error.message.includes("/repo/.git/info/attributes")) // true
   * ```
   *
   * @param attributesPath - Resolved path of the offending clone-local attributes file.
   * @returns The typed guard failure carrying the path and the inline remediation.
   * @category constructors
   * @since 0.0.0
   */
  static readonly at = (attributesPath: string): KnowledgeCloneAttributesError =>
    KnowledgeCloneAttributesError.make({
      attributesPath,
      message:
        `Clone-local git attributes file "${attributesPath}" is non-empty. ` +
        "It silently rewrites `git archive` bytes and no git invocation can disable it. " +
        "Move or delete the file; attribute rules belong in the repository's tracked .gitattributes.",
    });
}
