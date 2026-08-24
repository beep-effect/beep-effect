/**
 * Tagged errors for the Laws command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import { Inspectable } from "effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Laws/Laws.errors");

const messageWithCause = (message: string, cause: unknown): string =>
  `${message}: ${Inspectable.toStringUnknown(cause, 0)}`;

const EffectImportRulesPersistenceErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameEffectImportRulesPersistenceErrorFields = S.toEquivalence(
  S.TaggedStruct("EffectImportRulesPersistenceError", EffectImportRulesPersistenceErrorFields)
);
const sameEffectImportRulesPersistenceError = (
  self: EffectImportRulesPersistenceError,
  that: EffectImportRulesPersistenceError
): boolean => sameEffectImportRulesPersistenceErrorFields(self, that);

/**
 * Failure raised when Effect import rule updates cannot be written.
 *
 * **Example** (Read an effect import rules persistence error entry)
 *
 * ```ts
 * import { EffectImportRulesPersistenceError } from "@beep/repo-cli/commands/Laws/Laws.errors"
 *
 * const error = EffectImportRulesPersistenceError.new("Could not write Effect import updates.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EffectImportRulesPersistenceError extends S.TaggedError<EffectImportRulesPersistenceError>(
  $I`EffectImportRulesPersistenceError`
)(
  "EffectImportRulesPersistenceError",
  EffectImportRulesPersistenceErrorFields,
  $I.annoteClass<
    S.declare<EffectImportRulesPersistenceError>,
    readonly [S.TaggedStruct<"EffectImportRulesPersistenceError", typeof EffectImportRulesPersistenceErrorFields>]
  >("EffectImportRulesPersistenceError", {
    description: "Effect import rules could not be persisted to disk.",
    toEquivalence: () => sameEffectImportRulesPersistenceError,
  })
) {
  static readonly new = (message: string): EffectImportRulesPersistenceError =>
    EffectImportRulesPersistenceError.make({ message });

  static readonly mapError = Err.mapCauseError<EffectImportRulesPersistenceError, [message: string]>((cause, message) =>
    EffectImportRulesPersistenceError.new(messageWithCause(message, cause))
  );
}

const NoNativeRuntimeRulesExecutionErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameNoNativeRuntimeRulesExecutionErrorFields = S.toEquivalence(
  S.TaggedStruct("NoNativeRuntimeRulesExecutionError", NoNativeRuntimeRulesExecutionErrorFields)
);
const sameNoNativeRuntimeRulesExecutionError = (
  self: NoNativeRuntimeRulesExecutionError,
  that: NoNativeRuntimeRulesExecutionError
): boolean => sameNoNativeRuntimeRulesExecutionErrorFields(self, that);

/**
 * Failure raised when native runtime enforcement cannot complete.
 *
 * **Example** (Read a no native runtime rules execution error entry)
 *
 * ```ts
 * import { NoNativeRuntimeRulesExecutionError } from "@beep/repo-cli/commands/Laws/Laws.errors"
 *
 * const error = NoNativeRuntimeRulesExecutionError.new("Could not scan runtime usage.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class NoNativeRuntimeRulesExecutionError extends S.TaggedError<NoNativeRuntimeRulesExecutionError>(
  $I`NoNativeRuntimeRulesExecutionError`
)(
  "NoNativeRuntimeRulesExecutionError",
  NoNativeRuntimeRulesExecutionErrorFields,
  $I.annoteClass<
    S.declare<NoNativeRuntimeRulesExecutionError>,
    readonly [S.TaggedStruct<"NoNativeRuntimeRulesExecutionError", typeof NoNativeRuntimeRulesExecutionErrorFields>]
  >("NoNativeRuntimeRulesExecutionError", {
    description: "Repo-local native runtime checks failed unexpectedly.",
    toEquivalence: () => sameNoNativeRuntimeRulesExecutionError,
  })
) {
  static readonly new = (message: string): NoNativeRuntimeRulesExecutionError =>
    NoNativeRuntimeRulesExecutionError.make({ message });

  static readonly mapError = Err.mapCauseError<NoNativeRuntimeRulesExecutionError, [message: string]>(
    (cause, message) => NoNativeRuntimeRulesExecutionError.new(messageWithCause(message, cause))
  );
}

const TerseEffectRulesPersistenceErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameTerseEffectRulesPersistenceErrorFields = S.toEquivalence(
  S.TaggedStruct("TerseEffectRulesPersistenceError", TerseEffectRulesPersistenceErrorFields)
);
const sameTerseEffectRulesPersistenceError = (
  self: TerseEffectRulesPersistenceError,
  that: TerseEffectRulesPersistenceError
): boolean => sameTerseEffectRulesPersistenceErrorFields(self, that);

/**
 * Failure raised when terse Effect rule updates cannot be written.
 *
 * **Example** (Read a terse effect rules persistence error entry)
 *
 * ```ts
 * import { TerseEffectRulesPersistenceError } from "@beep/repo-cli/commands/Laws/Laws.errors"
 *
 * const error = TerseEffectRulesPersistenceError.new("Could not write terse Effect updates.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TerseEffectRulesPersistenceError extends S.TaggedError<TerseEffectRulesPersistenceError>(
  $I`TerseEffectRulesPersistenceError`
)(
  "TerseEffectRulesPersistenceError",
  TerseEffectRulesPersistenceErrorFields,
  $I.annoteClass<
    S.declare<TerseEffectRulesPersistenceError>,
    readonly [S.TaggedStruct<"TerseEffectRulesPersistenceError", typeof TerseEffectRulesPersistenceErrorFields>]
  >("TerseEffectRulesPersistenceError", {
    description: "Terse Effect rule updates could not be persisted to disk.",
    toEquivalence: () => sameTerseEffectRulesPersistenceError,
  })
) {
  static readonly new = (message: string): TerseEffectRulesPersistenceError =>
    TerseEffectRulesPersistenceError.make({ message });

  static readonly mapError = Err.mapCauseError<TerseEffectRulesPersistenceError, [message: string]>((cause, message) =>
    TerseEffectRulesPersistenceError.new(messageWithCause(message, cause))
  );
}
