/**
 * Tagged errors for the Laws command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Err } from "@beep/utils";
import * as Inspectable from "effect/Inspectable";
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
export class EffectImportRulesConfigurationError extends S.TaggedError<
  EffectImportRulesConfigurationError,
  { readonly brand: unique symbol }
>($I`EffectImportRulesConfigurationError`)(
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
export class EffectImportRulesPersistenceError extends S.TaggedError<
  EffectImportRulesPersistenceError,
  { readonly brand: unique symbol }
>($I`EffectImportRulesPersistenceError`)(
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
export class NoNativeRuntimeRulesExecutionError extends S.TaggedError<
  NoNativeRuntimeRulesExecutionError,
  { readonly brand: unique symbol }
>($I`NoNativeRuntimeRulesExecutionError`)(
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
export class TerseEffectRulesPersistenceError extends S.TaggedError<
  TerseEffectRulesPersistenceError,
  { readonly brand: unique symbol }
>($I`TerseEffectRulesPersistenceError`)(
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

/**
 * Failure raised when the retired Effect path law cannot list or read the tracked files.
 *
 * **Example** (Read a retired Effect paths execution error)
 *
 * ```ts
 * import { RetiredEffectPathsExecutionError } from "@beep/repo-cli/commands/Laws/Laws.errors"
 *
 * const error = RetiredEffectPathsExecutionError.new("Could not list tracked files.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RetiredEffectPathsExecutionError extends S.TaggedError<
  RetiredEffectPathsExecutionError,
  { readonly brand: unique symbol }
>($I`RetiredEffectPathsExecutionError`)(
  "RetiredEffectPathsExecutionError",
  {
    message: S.String,
  },
  $I.annoteError<RetiredEffectPathsExecutionError>("RetiredEffectPathsExecutionError", {
    description: "The retired Effect module path law could not list or read the git-tracked files.",
  })
) {
  static readonly new = (message: string): RetiredEffectPathsExecutionError =>
    RetiredEffectPathsExecutionError.make({ message });

  static readonly mapError = Err.mapCauseError<RetiredEffectPathsExecutionError, [message: string]>((cause, message) =>
    RetiredEffectPathsExecutionError.new(messageWithCause(message, cause))
  );
}

/**
 * Failure raised when the retired IRI authority law cannot list or read the tracked files.
 *
 * **Example** (Read a retired IRI authorities execution error)
 *
 * ```ts
 * import { RetiredIriAuthoritiesExecutionError } from "@beep/repo-cli/commands/Laws/Laws.errors"
 *
 * const error = RetiredIriAuthoritiesExecutionError.new("Could not list tracked files.")
 * console.log(error.message) // "Could not list tracked files."
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RetiredIriAuthoritiesExecutionError extends S.TaggedError<
  RetiredIriAuthoritiesExecutionError,
  { readonly brand: unique symbol }
>($I`RetiredIriAuthoritiesExecutionError`)(
  "RetiredIriAuthoritiesExecutionError",
  {
    message: S.String,
  },
  $I.annoteError<RetiredIriAuthoritiesExecutionError>("RetiredIriAuthoritiesExecutionError", {
    description: "The retired IRI authority law could not list or read the git-tracked files.",
  })
) {
  static readonly new = (message: string): RetiredIriAuthoritiesExecutionError =>
    RetiredIriAuthoritiesExecutionError.make({ message });

  static readonly mapError = Err.mapCauseError<RetiredIriAuthoritiesExecutionError, [message: string]>(
    (cause, message) => RetiredIriAuthoritiesExecutionError.new(messageWithCause(message, cause))
  );
}

/**
 * Failure raised when the schema tag idiom law cannot list or read the tracked files.
 *
 * **Example** (Read a schema tag idioms execution error)
 *
 * ```ts
 * import { SchemaTagIdiomsExecutionError } from "@beep/repo-cli/commands/Laws/Laws.errors"
 *
 * const error = SchemaTagIdiomsExecutionError.new("Could not list tracked files.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SchemaTagIdiomsExecutionError extends S.TaggedError<
  SchemaTagIdiomsExecutionError,
  { readonly brand: unique symbol }
>($I`SchemaTagIdiomsExecutionError`)(
  "SchemaTagIdiomsExecutionError",
  {
    message: S.String,
  },
  $I.annoteError<SchemaTagIdiomsExecutionError>("SchemaTagIdiomsExecutionError", {
    description: "The schema tag idiom law could not list or read the git-tracked files.",
  })
) {
  static readonly new = (message: string): SchemaTagIdiomsExecutionError =>
    SchemaTagIdiomsExecutionError.make({ message });

  static readonly mapError = Err.mapCauseError<SchemaTagIdiomsExecutionError, [message: string]>((cause, message) =>
    SchemaTagIdiomsExecutionError.new(messageWithCause(message, cause))
  );
}

/**
 * Failure raised when the Markdown fence typecheck law cannot list, read, stage or compile the fences.
 *
 * **Example** (Read a Markdown fences execution error)
 *
 * ```ts
 * import { MarkdownFencesExecutionError } from "@beep/repo-cli/commands/Laws/Laws.errors"
 *
 * const error = MarkdownFencesExecutionError.new("tsrs exited 1 without a fence diagnostic.")
 * console.log(error.message) // "tsrs exited 1 without a fence diagnostic."
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MarkdownFencesExecutionError extends S.TaggedError<
  MarkdownFencesExecutionError,
  { readonly brand: unique symbol }
>($I`MarkdownFencesExecutionError`)(
  "MarkdownFencesExecutionError",
  {
    message: S.String,
  },
  $I.annoteError<MarkdownFencesExecutionError>("MarkdownFencesExecutionError", {
    description: "The Markdown fence typecheck law could not list, read, stage, or compile the guidance fences.",
  })
) {
  static readonly new = (message: string): MarkdownFencesExecutionError =>
    MarkdownFencesExecutionError.make({ message });

  static readonly mapError = Err.mapCauseError<MarkdownFencesExecutionError, [message: string]>((cause, message) =>
    MarkdownFencesExecutionError.new(messageWithCause(message, cause))
  );
}

/**
 * Why the Markdown fence compiler run cannot be trusted as a verdict.
 *
 * **Details**
 *
 * `exit-without-diagnostics`: `tsrs` exited nonzero but printed no
 * diagnostic of a staged fence (a crash, a kill or a panic).
 * `unattributed-diagnostics`: the output holds an `error TS` line that maps to
 * no staged fence (a tsconfig or dependency error, or unparseable output).
 *
 * **Example** (Recognize a crash)
 *
 * ```ts
 * import { MarkdownFencesCompilerFailureReason } from "@beep/repo-cli/commands/Laws/Laws.errors"
 *
 * console.log(MarkdownFencesCompilerFailureReason.is["exit-without-diagnostics"]("exit-without-diagnostics")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const MarkdownFencesCompilerFailureReason = LiteralKit([
  "exit-without-diagnostics",
  "unattributed-diagnostics",
]).pipe(
  $I.annoteSchema("MarkdownFencesCompilerFailureReason", {
    description: "Why a Markdown fence compiler run cannot be read as a verdict.",
  })
);

/**
 * Type-level member of {@link MarkdownFencesCompilerFailureReason}.
 *
 * @category errors
 * @since 0.0.0
 */
export type MarkdownFencesCompilerFailureReason = typeof MarkdownFencesCompilerFailureReason.Type;

/**
 * Failure raised when the fence compiler run is not a verdict: it exited
 * nonzero without a fence diagnostic, or reported a diagnostic outside the
 * staged fences.
 *
 * **Details**
 *
 * The message names the compiler, its exit code and the last 20 lines of its
 * combined output, so a crash never reads as `failed=0`. Unattributed errors
 * also carry their first 20 diagnostic lines and the total count, separately
 * from the output tail. A crash without diagnostics carries an empty sample
 * and a zero count.
 *
 * **Example** (Read a compiler crash)
 *
 * ```ts
 * import { MarkdownFencesCompilerError } from "@beep/repo-cli/commands/Laws/Laws.errors"
 *
 * const error = MarkdownFencesCompilerError.make({
 *   reason: "exit-without-diagnostics",
 *   exitCode: 134,
 *   outputTail: "thread 'main' panicked",
 *   unattributedDiagnostics: [],
 *   unattributedDiagnosticCount: 0,
 *   message: "tsrs exited 134 without a fence diagnostic.",
 * })
 * console.log(error.reason) // "exit-without-diagnostics"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MarkdownFencesCompilerError extends S.TaggedError<
  MarkdownFencesCompilerError,
  { readonly brand: unique symbol }
>($I`MarkdownFencesCompilerError`)(
  "MarkdownFencesCompilerError",
  {
    reason: MarkdownFencesCompilerFailureReason,
    exitCode: S.Finite,
    outputTail: S.String,
    unattributedDiagnostics: S.Array(S.String).check(S.isMaxLength(20)),
    unattributedDiagnosticCount: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    message: S.String,
  },
  $I.annoteError<MarkdownFencesCompilerError>("MarkdownFencesCompilerError", {
    description: "The Markdown fence compiler run exited without a usable verdict.",
  })
) {}
