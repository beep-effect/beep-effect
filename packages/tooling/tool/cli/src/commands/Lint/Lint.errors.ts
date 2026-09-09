/**
 * Tagged errors for the Lint command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Err } from "@beep/utils";
import { Inspectable } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Lint/Lint.errors");

const messageWithCause = (message: string, cause: unknown): string =>
  `${message}: ${Inspectable.toStringUnknown(cause, 0)}`;

/**
 * Failure raised when circular dependency analysis cannot complete.
 *
 * **Example** (Create circular analysis error)
 *
 * ```ts
 * import { LintCircularAnalysisError } from "@beep/repo-cli/commands/Lint/Lint.errors"
 *
 * const error = LintCircularAnalysisError.new("Circular dependency analysis failed.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LintCircularAnalysisError extends S.TaggedError<LintCircularAnalysisError>($I`LintCircularAnalysisError`)(
  "LintCircularAnalysisError",
  {
    message: S.String,
  },
  $I.annoteError<LintCircularAnalysisError>("LintCircularAnalysisError", {
    description: "Circular dependency analysis failed for a target directory.",
  })
) {
  static readonly new = (message: string): LintCircularAnalysisError => LintCircularAnalysisError.make({ message });

  static readonly mapError = Err.mapCauseError<LintCircularAnalysisError, [message: string]>((cause, message) =>
    LintCircularAnalysisError.new(messageWithCause(message, cause))
  );
}

/**
 * Failure raised when lint file discovery cannot read a source root.
 *
 * **Example** (Create file discovery error)
 *
 * ```ts
 * import { LintFileDiscoveryError } from "@beep/repo-cli/commands/Lint/Lint.errors"
 *
 * const error = LintFileDiscoveryError.new("src/index.ts", ".", "Could not discover TypeScript files.")
 * console.log(error.path)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LintFileDiscoveryError extends S.TaggedError<LintFileDiscoveryError>($I`LintFileDiscoveryError`)(
  "LintFileDiscoveryError",
  {
    message: S.String,
    root: S.String,
    path: S.String,
  },
  $I.annoteError<LintFileDiscoveryError>("LintFileDiscoveryError", {
    description: "TypeScript file discovery failed for a lint root.",
  })
) {
  /**
   * Construct a lint file discovery error for a root and path.
   *
   * @category constructors
   */
  static readonly new: {
    (path: string, root: string, message: string): LintFileDiscoveryError;
    (root: string, message: string): (path: string) => LintFileDiscoveryError;
  } = dual(
    3,
    (path: string, root: string, message: string): LintFileDiscoveryError =>
      LintFileDiscoveryError.make({ message, root, path })
  );

  static readonly mapError = Err.mapCauseError<LintFileDiscoveryError, [root: string, path: string, action: string]>(
    (cause, root, path, action) =>
      LintFileDiscoveryError.new(
        path,
        root,
        `${action} "${path}" while collecting TypeScript files under "${root}": ${Inspectable.toStringUnknown(cause, 0)}`
      )
  );
}

/**
 * Failure raised when the test-typecheck blind-spot baseline cannot be read,
 * decoded, or rewritten.
 *
 * **Example** (Create baseline error from cause)
 *
 * ```ts
 * import { TestTypecheckBaselineError } from "@beep/repo-cli/commands/Lint/Lint.errors"
 *
 * const error = TestTypecheckBaselineError.new(
 *   new Error("ENOENT"),
 *   "Failed to read standards/test-typecheck.blindspot-baseline.jsonc."
 * )
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TestTypecheckBaselineError extends S.TaggedError<TestTypecheckBaselineError>(
  $I`TestTypecheckBaselineError`
)(
  "TestTypecheckBaselineError",
  {
    message: S.String,
  },
  $I.annoteError<TestTypecheckBaselineError>("TestTypecheckBaselineError", {
    description: "Raised when the committed test-typecheck blind-spot baseline cannot be read, decoded, or written.",
  })
) {
  /**
   * Construct a baseline error from an underlying cause and an action message.
   *
   * @param cause - Underlying filesystem, JSONC, or schema failure to render into the message.
   * @param message - Action that failed, such as `Failed to read <baseline path>.`.
   * @returns The tagged error carrying the action message with the rendered cause appended.
   * @category constructors
   */
  static readonly new = (cause: unknown, message: string): TestTypecheckBaselineError =>
    TestTypecheckBaselineError.make({ message: messageWithCause(message, cause) });

  static readonly mapError = Err.mapCauseError<TestTypecheckBaselineError, [message: string]>((cause, message) =>
    TestTypecheckBaselineError.new(cause, message)
  );
}

/**
 * Failure raised when the schema-first inventory cannot be read or decoded.
 *
 * **Example** (Create inventory read error)
 *
 * ```ts
 * import { SchemaFirstInventoryReadError } from "@beep/repo-cli/commands/Lint/Lint.errors"
 *
 * const error = SchemaFirstInventoryReadError.new("Could not read standards/schema-first.inventory.jsonc.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SchemaFirstInventoryReadError extends S.TaggedError<SchemaFirstInventoryReadError>(
  $I`SchemaFirstInventoryReadError`
)(
  "SchemaFirstInventoryReadError",
  {
    message: S.String,
  },
  $I.annoteError<SchemaFirstInventoryReadError>("SchemaFirstInventoryReadError", {
    description: "Raised when the committed schema-first inventory cannot be parsed or decoded.",
  })
) {
  static readonly new = (message: string): SchemaFirstInventoryReadError =>
    SchemaFirstInventoryReadError.make({ message });

  static readonly mapError = Err.mapCauseError<SchemaFirstInventoryReadError, [message: string]>((cause, message) =>
    SchemaFirstInventoryReadError.new(messageWithCause(message, cause))
  );
}

/**
 * Failure raised when a `tsconfig.check.json` overlay cannot be read or parsed
 * as a JSONC object.
 *
 * **Example** (Create overlay read error from cause)
 *
 * ```ts
 * import { TsconfigOverlayReadError } from "@beep/repo-cli/commands/Lint/Lint.errors"
 *
 * const error = TsconfigOverlayReadError.new(
 *   new Error("ENOENT"),
 *   "Failed to read packages/drivers/example/tsconfig.check.json."
 * )
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TsconfigOverlayReadError extends S.TaggedError<TsconfigOverlayReadError>($I`TsconfigOverlayReadError`)(
  "TsconfigOverlayReadError",
  {
    message: S.String,
  },
  $I.annoteError<TsconfigOverlayReadError>("TsconfigOverlayReadError", {
    description: "Raised when a tsconfig.check.json overlay cannot be read or parsed as a JSONC object.",
  })
) {
  /**
   * Construct an overlay read error from an underlying cause and an action message.
   *
   * @param cause - Underlying filesystem, JSONC, or schema failure to render into the message.
   * @param message - Action that failed, such as `Failed to read <overlay path>.`.
   * @returns The tagged error carrying the action message with the rendered cause appended.
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (cause: unknown, message: string): TsconfigOverlayReadError =>
    TsconfigOverlayReadError.make({ message: messageWithCause(message, cause) });

  /**
   * Wrap a raw failure in a {@link TsconfigOverlayReadError} carrying the given message.
   *
   * **Example** (Attribute a read failure to its overlay)
   *
   * ```ts
   * import { TsconfigOverlayReadError } from "@beep/repo-cli/commands/Lint/Lint.errors"
   * import * as Effect from "effect/Effect"
   *
   * const wrapped = Effect.fail("ENOENT").pipe(
   *   TsconfigOverlayReadError.mapError("Failed to read packages/example/tsconfig.check.json.")
   * )
   * console.log(Effect.isEffect(wrapped)) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly mapError = Err.mapCauseError<TsconfigOverlayReadError, [message: string]>((cause, message) =>
    TsconfigOverlayReadError.new(cause, message)
  );
}

/**
 * Reports a failed Effect Vitest scan boundary without leaking an untyped error.
 *
 * **Example** (Describe a pin mismatch)
 *
 * ```ts
 * import { EffectVitestLintError } from "@beep/repo-cli/commands/Lint"
 *
 * const error = EffectVitestLintError.new("Installed @effect/vitest does not match rc.112.")
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EffectVitestLintError extends S.TaggedError<EffectVitestLintError>($I`EffectVitestLintError`)(
  "EffectVitestLintError",
  { message: S.String },
  $I.annoteError<EffectVitestLintError>("EffectVitestLintError", {
    description: "Raised when Effect Vitest scope discovery, decoding, validation, or persistence fails.",
  })
) {
  static readonly new = (message: string): EffectVitestLintError => EffectVitestLintError.make({ message });

  static readonly mapError = Err.mapCauseError<EffectVitestLintError, [message: string]>((cause, message) =>
    EffectVitestLintError.new(messageWithCause(message, cause))
  );
}

/**
 * Reports a missing, malformed, or internally inconsistent pinned primitive graph.
 *
 * **Example** (Describe a dangling policy edge)
 *
 * ```ts
 * import { EffectVitestPrimitiveGraphError } from "@beep/repo-cli/commands/Lint"
 *
 * const error = EffectVitestPrimitiveGraphError.new("EV001 has no graph-backed replacement.")
 * console.log(error._tag) // "EffectVitestPrimitiveGraphError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EffectVitestPrimitiveGraphError extends S.TaggedError<EffectVitestPrimitiveGraphError>(
  $I`EffectVitestPrimitiveGraphError`
)(
  "EffectVitestPrimitiveGraphError",
  { message: S.NonEmptyString },
  $I.annoteError<EffectVitestPrimitiveGraphError>("EffectVitestPrimitiveGraphError", {
    description: "Raised when the authoritative Effect Vitest primitive graph cannot be loaded or applied.",
  })
) {
  static readonly new = (message: string): EffectVitestPrimitiveGraphError =>
    EffectVitestPrimitiveGraphError.make({ message });

  static readonly mapError = Err.mapCauseError<EffectVitestPrimitiveGraphError, [message: string]>((cause, message) =>
    EffectVitestPrimitiveGraphError.new(messageWithCause(message, cause))
  );
}
