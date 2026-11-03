/**
 * Typed failures for knowledge semantic-delta operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { OpaqueDefect } from "@beep/repo-cli-kit/schema/OpaqueDefect";
import { LiteralKit } from "@beep/schema";
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
 * import * as Effect from "effect/Effect";
 * import * as Result from "effect/Result";
 * const scan = Effect.fail(KnowledgeOperationalError.make({ message: "git archive failed." }))
 * const outcome = Effect.runSync(Effect.result(scan))
 *
 * console.log(Result.isFailure(outcome)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KnowledgeOperationalError extends S.TaggedError<
  KnowledgeOperationalError,
  { readonly brand: unique symbol }
>($I`KnowledgeOperationalError`)(
  "KnowledgeOperationalError",
  {
    message: S.String,
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<KnowledgeOperationalError>("KnowledgeOperationalError", {
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
   * import * as Effect from "effect/Effect";
   * import { pipe } from "effect/Function";
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
export class KnowledgeProbeBootError extends S.TaggedError<KnowledgeProbeBootError, { readonly brand: unique symbol }>(
  $I`KnowledgeProbeBootError`
)(
  "KnowledgeProbeBootError",
  {
    message: S.String,
  },
  $I.annoteError<KnowledgeProbeBootError>("KnowledgeProbeBootError", {
    description: "A current-checkout probe over archive data that exited before emitting structured output.",
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
 * import * as S from "effect/Schema"
 * import { KnowledgeIntroducedFindingsError } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 *
 * const error = KnowledgeIntroducedFindingsError.make({
 *   message: "knowledge semantic-delta: 2 introduced blocking finding(s).",
 *   introducedCount: S.Natural.make(2),
 * })
 *
 * console.log(error.introducedCount) // 2
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KnowledgeIntroducedFindingsError extends S.TaggedError<
  KnowledgeIntroducedFindingsError,
  { readonly brand: unique symbol }
>($I`KnowledgeIntroducedFindingsError`)(
  "KnowledgeIntroducedFindingsError",
  {
    message: S.String,
    introducedCount: S.Natural,
  },
  $I.annoteError<KnowledgeIntroducedFindingsError>("KnowledgeIntroducedFindingsError", {
    description: "The report contains one or more introduced blocking Stage-1 findings.",
  })
) {}

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
 * import * as S from "effect/Schema"
 * import { KnowledgeHostPathDebtError } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 *
 * const error = KnowledgeHostPathDebtError.make({
 *   message: "knowledge refs --check: 3 live host-path observation(s).",
 *   liveDebtCount: S.Natural.make(3),
 * })
 *
 * console.log(error.liveDebtCount) // 3
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KnowledgeHostPathDebtError extends S.TaggedError<
  KnowledgeHostPathDebtError,
  { readonly brand: unique symbol }
>($I`KnowledgeHostPathDebtError`)(
  "KnowledgeHostPathDebtError",
  {
    message: S.String,
    liveDebtCount: S.Natural,
  },
  $I.annoteError<KnowledgeHostPathDebtError>("KnowledgeHostPathDebtError", {
    description: "The checked census carries live host-path observations in the gated classes.",
  })
) {}

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
export class KnowledgeCloneAttributesError extends S.TaggedError<
  KnowledgeCloneAttributesError,
  { readonly brand: unique symbol }
>($I`KnowledgeCloneAttributesError`)(
  "KnowledgeCloneAttributesError",
  {
    message: S.String,
    attributesPath: S.String,
  },
  $I.annoteError<KnowledgeCloneAttributesError>("KnowledgeCloneAttributesError", {
    description: "A non-empty clone-local git attributes file would silently rewrite hermetic archive bytes.",
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

/**
 * Why a knowledge-doctor gating input could not be read.
 *
 * **Details**
 *
 * Each reason names one degraded input of the gating form (contract 13): an absent base ref, shallow
 * history, a file that is not UTF-8, a baseline, promotions, lease, or identity file that does not
 * decode, a missing `.github/CODEOWNERS` while leases exist, and the absent sealed baseline, which
 * keeps the gate unavailable until the first CI mint.
 *
 * **Example** (Recognize the absent-baseline reason)
 *
 * ```ts
 * import { KnowledgeDoctorInputReason } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 *
 * console.log(KnowledgeDoctorInputReason.is["missing-baseline"]("missing-baseline")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeDoctorInputReason = LiteralKit([
  "absent-ref",
  "shallow-history",
  "malformed-utf8",
  "undecodable-baseline",
  "undecodable-promotions",
  "undecodable-leases",
  "undecodable-identity",
  "missing-codeowners",
  "missing-baseline",
]).pipe(
  $I.annoteSchema("KnowledgeDoctorInputReason", {
    description: "Which gating input of the knowledge doctor was absent, shallow, or undecodable.",
  })
);

/**
 * Why a knowledge-doctor gating input could not be read.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeDoctorInputReason = typeof KnowledgeDoctorInputReason.Type;

/**
 * The message the gating form prints while no sealed baseline exists.
 *
 * **Example** (Read the refusal)
 *
 * ```ts
 * import { KNOWLEDGE_DOCTOR_BASELINE_PENDING_MESSAGE } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 *
 * console.log(KNOWLEDGE_DOCTOR_BASELINE_PENDING_MESSAGE.endsWith("rerun with --report.")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_DOCTOR_BASELINE_PENDING_MESSAGE =
  "knowledge doctor: only the read-only report is available until the sealed baseline lands; rerun with --report.";

const INPUT_REMEDIATION: Readonly<Record<KnowledgeDoctorInputReason, string>> = {
  "absent-ref":
    "Fetch the base branch (`git fetch origin main`) or pass an existing local ref with --base; the doctor never fetches.",
  "shallow-history": KNOWLEDGE_HISTORY_REMEDIATION,
  "malformed-utf8": "Re-save the file as UTF-8.",
  "undecodable-baseline":
    "Restore the file from the default branch; only the CI mint writes the sealed baseline, and a branch may only delete entries.",
  "undecodable-promotions":
    "Restore the existing rows from the default branch and append one row matching knowledge-doctor-promotions/v1.",
  "undecodable-leases": "Fix the lease file so every row matches knowledge-doctor-leases/v1.",
  "undecodable-identity": "Fix the identity sidecar so every mapping matches knowledge-doctor-identity/v1.",
  "missing-codeowners": "Restore .github/CODEOWNERS on the base branch; lease owners resolve from it.",
  "missing-baseline": "Run `bun run beep knowledge doctor --report` until the CI mint opens the first sealed baseline.",
};

/**
 * A gating input of the knowledge doctor that is absent, shallow, or undecodable.
 *
 * **Details**
 *
 * The gate fails closed on these (contract 13 and C4): they are never findings and never skips.
 * `subject` is the ref or repository path at fault and `remediation` the one fix for its reason.
 *
 * **Example** (Refuse an undecodable lease file)
 *
 * ```ts
 * import { KnowledgeDoctorInputError } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 *
 * const error = KnowledgeDoctorInputError.of("undecodable-leases", "goals/knowledge-doctor.leases.jsonc", "Missing key.")
 *
 * console.log(error.reason) // "undecodable-leases"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KnowledgeDoctorInputError extends S.TaggedError<
  KnowledgeDoctorInputError,
  { readonly brand: unique symbol }
>($I`KnowledgeDoctorInputError`)(
  "KnowledgeDoctorInputError",
  {
    reason: KnowledgeDoctorInputReason,
    subject: S.String,
    message: S.String,
    remediation: S.String,
  },
  $I.annoteError<KnowledgeDoctorInputError>("KnowledgeDoctorInputError", {
    description: "A knowledge-doctor gating input that is absent, shallow, or undecodable, with its remediation.",
  })
) {
  /**
   * Builds the error for one reason, appending the reason's remediation to the message.
   *
   * **Example** (Report a shallow clone)
   *
   * ```ts
   * import { KnowledgeDoctorInputError } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
   *
   * const error = KnowledgeDoctorInputError.of("shallow-history", "origin/main", "The clone is shallow.")
   *
   * console.log(error.message.includes("fetch-depth: 0")) // true
   * ```
   *
   * @param reason - Which input degraded.
   * @param subject - The ref or repository path at fault.
   * @param detail - What was observed, without the remediation.
   * @returns The typed failure carrying the reason's remediation.
   * @category constructors
   * @since 0.0.0
   */
  static readonly of = (
    reason: KnowledgeDoctorInputReason,
    subject: string,
    detail: string
  ): KnowledgeDoctorInputError =>
    KnowledgeDoctorInputError.make({
      reason,
      subject,
      message: `${detail} ${INPUT_REMEDIATION[reason]}`,
      remediation: INPUT_REMEDIATION[reason],
    });
}

/**
 * The gate failure raised after a checked report carries blocking knowledge-doctor findings.
 *
 * **Details**
 *
 * `introducedCount` counts introduced findings of promoted kinds, which no baseline key or active
 * lease covers; `governanceCount` counts `baseline-tamper` and lease findings. The report prints first.
 *
 * **Example** (Signal one introduced finding)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { KnowledgeDoctorGateError } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 *
 * const error = KnowledgeDoctorGateError.make({
 *   message: "knowledge doctor: 1 introduced, 0 governance finding(s).",
 *   introducedCount: S.Natural.make(1),
 *   governanceCount: S.Natural.make(0),
 * })
 *
 * console.log(error.introducedCount) // 1
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KnowledgeDoctorGateError extends S.TaggedError<
  KnowledgeDoctorGateError,
  { readonly brand: unique symbol }
>($I`KnowledgeDoctorGateError`)(
  "KnowledgeDoctorGateError",
  {
    message: S.String,
    introducedCount: S.Natural,
    governanceCount: S.Natural,
  },
  $I.annoteError<KnowledgeDoctorGateError>("KnowledgeDoctorGateError", {
    description: "The checked knowledge-doctor report carries introduced or governance blocking findings.",
  })
) {}

/**
 * The mint refusing to seal because the minted tree carries blocking findings it may not absorb.
 *
 * **Details**
 *
 * The mint absorbs only previous keys, findings of kinds promoted since the previous mint, and, on the
 * first seal, everything (contract 9). Any other blocking finding is listed in `refused` by finding
 * id, so a main-red finding or an expired lease never launders into the sealed baseline.
 *
 * **Example** (Refuse one finding)
 *
 * ```ts
 * import { KnowledgeMintRefusal } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 *
 * const refusal = KnowledgeMintRefusal.make({
 *   message: "knowledge doctor mint: 1 blocking finding(s) cannot be sealed.",
 *   refused: ["knowledge-finding/v1:1111111111111111111111111111111111111111111111111111111111111111"],
 * })
 *
 * console.log(refusal.refused.length) // 1
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KnowledgeMintRefusal extends S.TaggedError<KnowledgeMintRefusal, { readonly brand: unique symbol }>(
  $I`KnowledgeMintRefusal`
)(
  "KnowledgeMintRefusal",
  {
    message: S.String,
    refused: S.Array(S.String),
  },
  $I.annoteError<KnowledgeMintRefusal>("KnowledgeMintRefusal", {
    description: "The mint refused to seal blocking findings it may not absorb.",
  })
) {}

/**
 * A committed baseline that a re-mint at its `mintedAt` does not reproduce byte for byte.
 *
 * **Example** (Report a broken seal)
 *
 * ```ts
 * import { KnowledgeSealBroken } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 *
 * const error = KnowledgeSealBroken.make({
 *   message: "The committed baseline differs from the re-mint.",
 *   mintedAt: "1111111111111111111111111111111111111111",
 * })
 *
 * console.log(error.mintedAt.length) // 40
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KnowledgeSealBroken extends S.TaggedError<KnowledgeSealBroken, { readonly brand: unique symbol }>(
  $I`KnowledgeSealBroken`
)(
  "KnowledgeSealBroken",
  {
    message: S.String,
    mintedAt: S.String,
  },
  $I.annoteError<KnowledgeSealBroken>("KnowledgeSealBroken", {
    description: "The committed knowledge-doctor baseline is not byte-reproducible from its mintedAt commit.",
  })
) {}

/**
 * The mint or `--accept-mint` refusing to run outside the context the seal requires.
 *
 * **Details**
 *
 * `knowledge doctor mint --write` runs only in CI, on a clean checkout of the minted commit, at a
 * commit the base ref contains. `--accept-mint` admits a baseline change only for a pull request
 * from `automation/knowledge-baseline-mint` that the mint App opened (C8 condition i). `reasons`
 * lists every unmet condition, so one run names them all.
 *
 * **Example** (Refuse a local write)
 *
 * ```ts
 * import { KnowledgeMintContextRefusal } from "@beep/repo-cli/commands/Knowledge/Knowledge.errors"
 *
 * const refusal = KnowledgeMintContextRefusal.make({
 *   message: "knowledge doctor mint --write: 1 condition(s) unmet.",
 *   reasons: ["CI is not true; only the mint workflow writes the sealed baseline."],
 * })
 *
 * console.log(refusal.reasons.length) // 1
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class KnowledgeMintContextRefusal extends S.TaggedError<
  KnowledgeMintContextRefusal,
  { readonly brand: unique symbol }
>($I`KnowledgeMintContextRefusal`)(
  "KnowledgeMintContextRefusal",
  {
    message: S.String,
    reasons: S.Array(S.String),
  },
  $I.annoteError<KnowledgeMintContextRefusal>("KnowledgeMintContextRefusal", {
    description: "The mint write or the CI mint acceptance ran outside the context the seal requires.",
  })
) {}
