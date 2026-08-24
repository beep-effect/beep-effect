/**
 * Tagged errors for the skills command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { messageWithCause } from "../../internal/cli/CommandErrorFields.ts";

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

const SkillsCommandErrorFields = {
  message: S.String,
  file: S.optionalKey(S.String),
  skill: S.optionalKey(S.String),
  cause: S.optionalKey(S.Defect({ includeStack: true })),
} satisfies S.Struct.Fields;
// cause is an opaque defect: equivalence is declared diagnostic identity, cause stays payload.
const sameSkillsCommandErrorFields = S.toEquivalence(
  S.TaggedStruct("SkillsCommandError", {
    message: SkillsCommandErrorFields.message,
    file: SkillsCommandErrorFields.file,
    skill: SkillsCommandErrorFields.skill,
  })
);
const sameSkillsCommandError = (self: SkillsCommandError, that: SkillsCommandError): boolean =>
  sameSkillsCommandErrorFields(self, that);

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
  SkillsCommandErrorFields,
  $I.annoteClass<
    S.declare<SkillsCommandError>,
    readonly [S.TaggedStruct<"SkillsCommandError", typeof SkillsCommandErrorFields>]
  >("SkillsCommandError", {
    title: "Skills Command Error",
    description: "Failed to read, fetch, hash, or write repo-local skill configuration.",
    toEquivalence: () => sameSkillsCommandError,
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

const SkillsDriftErrorFields = {
  message: S.String,
  driftCount: S.Finite,
} satisfies S.Struct.Fields;
const sameSkillsDriftErrorFields = S.toEquivalence(S.TaggedStruct("SkillsDriftError", SkillsDriftErrorFields));
const sameSkillsDriftError = (self: SkillsDriftError, that: SkillsDriftError): boolean =>
  sameSkillsDriftErrorFields(self, that);

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
  SkillsDriftErrorFields,
  $I.annoteClass<
    S.declare<SkillsDriftError>,
    readonly [S.TaggedStruct<"SkillsDriftError", typeof SkillsDriftErrorFields>]
  >("SkillsDriftError", {
    title: "Skills Drift Error",
    description: "Repo-local skill drift was detected while running in check mode.",
    toEquivalence: () => sameSkillsDriftError,
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
