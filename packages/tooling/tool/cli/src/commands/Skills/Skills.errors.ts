/**
 * Tagged errors for the skills command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { messageWithCause } from "../../internal/cli/CommandErrorFields.ts";
import { OpaqueDefect } from "../../internal/schema/OpaqueDefect.ts";

const $I = $RepoCliId.create("commands/Skills/Skills.errors");

const makeSkillsCommandError = (cause: unknown, message: string, file?: string, skill?: string): SkillsCommandError => {
  const fields: {
    cause: unknown;
    file?: string;
    message: string;
    skill?: string;
  } = {
    cause,
    message,
  };
  if (file !== undefined) {
    fields.file = file;
  }
  if (skill !== undefined) {
    fields.skill = skill;
  }
  return SkillsCommandError.make(fields);
};

/**
 * Operational error while reading, fetching, hashing, or writing repo-local skills.
 *
 * **Example** (Make skills command error)
 *
 * ```ts
 * import { SkillsCommandError } from "@beep/repo-cli/commands/Skills"
 *
 * const error = SkillsCommandError.make({ message: "Repository quality check failed" })
 * console.log(error.message.includes("failed")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class SkillsCommandError extends S.TaggedError<SkillsCommandError>($I`SkillsCommandError`)(
  "SkillsCommandError",
  {
    message: S.String,
    file: S.optionalKey(S.String),
    skill: S.optionalKey(S.String),
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<SkillsCommandError>("SkillsCommandError", {
    title: "Skills Command Error",
    description: "Failed to read, fetch, hash, or write repo-local skill configuration.",
  })
) {
  /**
   * Construct a skills command error from an underlying cause.
   *
   * @category constructors
   */
  static readonly new: {
    (cause: unknown, message: string, file?: string, skill?: string): SkillsCommandError;
    (message: string, file?: string, skill?: string): (cause: unknown) => SkillsCommandError;
  } = dual(
    4,
    (cause: unknown, message: string, file?: string, skill?: string): SkillsCommandError =>
      makeSkillsCommandError(cause, message, file, skill)
  );

  static readonly mapError = Err.mapCauseError<SkillsCommandError, [message: string, file?: string, skill?: string]>(
    (cause, message, file, skill) => makeSkillsCommandError(cause, messageWithCause(message, cause), file, skill)
  );
}

/**
 * Drift detected while running skills update in check mode.
 *
 * **Example** (Make skills drift error)
 *
 * ```ts
 * import { SkillsDriftError } from "@beep/repo-cli/commands/Skills"
 *
 * const error = SkillsDriftError.make({ driftCount: 2, message: "Repository quality check failed" })
 * console.log(error.message.includes("failed")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export class SkillsDriftError extends S.TaggedError<SkillsDriftError>($I`SkillsDriftError`)(
  "SkillsDriftError",
  {
    message: S.String,
    driftCount: S.Finite,
  },
  $I.annoteError<SkillsDriftError>("SkillsDriftError", {
    title: "Skills Drift Error",
    description: "Repo-local skill drift was detected while running in check mode.",
  })
) {
  /**
   * Construct a skills drift error from a drift count and message.
   *
   * @category constructors
   */
  static readonly new: {
    (driftCount: number, message: string): SkillsDriftError;
    (message: string): (driftCount: number) => SkillsDriftError;
  } = dual(
    2,
    (driftCount: number, message: string): SkillsDriftError =>
      SkillsDriftError.make({
        driftCount,
        message,
      })
  );

  static readonly mapError = Err.mapToError<SkillsDriftError, [driftCount: number, message: string]>(
    (driftCount, message) => SkillsDriftError.new(driftCount, message)
  );
}

/**
 * Why an installed skill's targets cannot be hashed.
 *
 * **Example** (Check a reason)
 *
 * ```ts
 * import { SkillInstallStateReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * console.log(SkillInstallStateReason.is["missing-target"]("missing-target")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SkillInstallStateReason = LiteralKit(["missing-target", "divergent-targets"]).pipe(
  $I.annoteSchema("SkillInstallStateReason", {
    description: "A skill install-state problem: a missing target directory or targets whose trees disagree.",
  })
);

/**
 * Why a skill's installed targets cannot back a lock entry.
 *
 * **Example** (Annotate an install-state reason)
 *
 * ```ts
 * import type { SkillInstallStateReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const reason: SkillInstallStateReason = "divergent-targets"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillInstallStateReason = typeof SkillInstallStateReason.Type;

/**
 * A skill's installed targets are missing or disagree with each other.
 *
 * **Details**
 *
 * Kept apart from {@link SkillsCommandError} so the lock-migration plan can
 * report one partially installed skill as `unresolved` instead of aborting
 * the whole plan; every other filesystem failure stays fatal.
 *
 * **Example** (Create an install-state error)
 *
 * ```ts
 * import { SkillInstallStateError } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const error = SkillInstallStateError.make({ skill: "adhd", reason: "missing-target", message: "missing" })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SkillInstallStateError extends S.TaggedError<SkillInstallStateError>($I`SkillInstallStateError`)(
  "SkillInstallStateError",
  {
    skill: S.String,
    reason: SkillInstallStateReason,
    message: S.String,
  },
  $I.annoteError<SkillInstallStateError>("SkillInstallStateError", {
    title: "Skill Install State Error",
    description: "An installed skill's targets are missing or have diverged.",
  })
) {}

/**
 * Why an upstream skill read failed.
 *
 * **Details**
 *
 * `path-absent`: the request succeeded, but the revision has no file under the
 * skill's tree path, or the tracking ref has no commit touching it. A path
 * history walk reads this as "the skill did not exist at that revision".
 * `unavailable`: every other failure (fetch, non-2xx status, decode, truncated
 * tree), which says nothing about the content.
 *
 * **Example** (Check a reason)
 *
 * ```ts
 * import { SkillUpstreamContentErrorReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * console.log(SkillUpstreamContentErrorReason.is["path-absent"]("path-absent")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SkillUpstreamContentErrorReason = LiteralKit(["unavailable", "path-absent"]).pipe(
  $I.annoteSchema("SkillUpstreamContentErrorReason", {
    description: "Whether an upstream skill read failed outright or proved the skill path absent at that revision.",
  })
);

/**
 * Why an upstream skill read failed.
 *
 * **Example** (Annotate a reason)
 *
 * ```ts
 * import type { SkillUpstreamContentErrorReason } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const reason: SkillUpstreamContentErrorReason = "unavailable"
 * console.log(reason)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SkillUpstreamContentErrorReason = typeof SkillUpstreamContentErrorReason.Type;

/**
 * The pinned, historical, or path-history upstream content of a skill cannot be read.
 *
 * **Details**
 *
 * Raised by the upstream content source for any fetch, response, tree-decode,
 * missing-tree-path, empty-history, or truncated-tree failure; `reason` tells a
 * proven-absent path apart from an unreadable upstream. The lock-migration
 * plan turns it into a per-skill `unresolved` row, so one moved or unreachable
 * upstream never aborts the plan for every other skill.
 *
 * **Example** (Create an upstream-content error)
 *
 * ```ts
 * import { SkillUpstreamContentError } from "@beep/repo-cli/commands/Skills/Skills.errors"
 *
 * const error = SkillUpstreamContentError.make({ skill: "oracle", reason: "path-absent", message: "No files found" })
 * console.log(error.reason) // "path-absent"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SkillUpstreamContentError extends S.TaggedError<SkillUpstreamContentError>($I`SkillUpstreamContentError`)(
  "SkillUpstreamContentError",
  {
    skill: S.String,
    reason: SkillUpstreamContentErrorReason,
    message: S.String,
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<SkillUpstreamContentError>("SkillUpstreamContentError", {
    title: "Skill Upstream Content Error",
    description: "A skill's pinned, historical, or path-history upstream content could not be fetched or decoded.",
  })
) {}
