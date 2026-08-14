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
  $I.annote("LintCircularAnalysisError", {
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
  $I.annote("LintFileDiscoveryError", {
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
  $I.annote("TestTypecheckBaselineError", {
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
  $I.annote("SchemaFirstInventoryReadError", {
    description: "Raised when the committed schema-first inventory cannot be parsed or decoded.",
  })
) {
  static readonly new = (message: string): SchemaFirstInventoryReadError =>
    SchemaFirstInventoryReadError.make({ message });

  static readonly mapError = Err.mapCauseError<SchemaFirstInventoryReadError, [message: string]>((cause, message) =>
    SchemaFirstInventoryReadError.new(messageWithCause(message, cause))
  );
}
