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

/**
 * Failure raised when Effect import rule options violate a runner invariant.
 *
 * **Example** (Read an Effect import rules configuration error)
 *
 * ```ts
 * import { EffectImportRulesConfigurationError } from "@beep/repo-cli/commands/Laws/Laws.errors"
 *
 * const error = EffectImportRulesConfigurationError.new("Candidate scans are dry-run only.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EffectImportRulesConfigurationError extends S.TaggedError<EffectImportRulesConfigurationError>(
  $I`EffectImportRulesConfigurationError`
)(
  "EffectImportRulesConfigurationError",
  {
    message: S.String,
  },
  $I.annoteError<EffectImportRulesConfigurationError>("EffectImportRulesConfigurationError", {
    description: "Effect import rule options violate a runner invariant.",
  })
) {
  static readonly new = (message: string): EffectImportRulesConfigurationError =>
    EffectImportRulesConfigurationError.make({ message });
}

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
  {
    message: S.String,
  },
  $I.annoteError<EffectImportRulesPersistenceError>("EffectImportRulesPersistenceError", {
    description: "Effect import rules could not be persisted to disk.",
  })
) {
  static readonly new = (message: string): EffectImportRulesPersistenceError =>
    EffectImportRulesPersistenceError.make({ message });

  static readonly mapError = Err.mapCauseError<EffectImportRulesPersistenceError, [message: string]>((cause, message) =>
    EffectImportRulesPersistenceError.new(messageWithCause(message, cause))
  );
}

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
  {
    message: S.String,
  },
  $I.annoteError<NoNativeRuntimeRulesExecutionError>("NoNativeRuntimeRulesExecutionError", {
    description: "Repo-local native runtime checks failed unexpectedly.",
  })
) {
  static readonly new = (message: string): NoNativeRuntimeRulesExecutionError =>
    NoNativeRuntimeRulesExecutionError.make({ message });

  static readonly mapError = Err.mapCauseError<NoNativeRuntimeRulesExecutionError, [message: string]>(
    (cause, message) => NoNativeRuntimeRulesExecutionError.new(messageWithCause(message, cause))
  );
}

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
  {
    message: S.String,
  },
  $I.annoteError<TerseEffectRulesPersistenceError>("TerseEffectRulesPersistenceError", {
    description: "Terse Effect rule updates could not be persisted to disk.",
  })
) {
  static readonly new = (message: string): TerseEffectRulesPersistenceError =>
    TerseEffectRulesPersistenceError.make({ message });

  static readonly mapError = Err.mapCauseError<TerseEffectRulesPersistenceError, [message: string]>((cause, message) =>
    TerseEffectRulesPersistenceError.new(messageWithCause(message, cause))
  );
}
