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

const LintCircularAnalysisErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameLintCircularAnalysisErrorFields = S.toEquivalence(
  S.TaggedStruct("LintCircularAnalysisError", LintCircularAnalysisErrorFields)
);
const sameLintCircularAnalysisError = (self: LintCircularAnalysisError, that: LintCircularAnalysisError): boolean =>
  sameLintCircularAnalysisErrorFields(self, that);

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
  LintCircularAnalysisErrorFields,
  $I.annoteClass<
    S.declare<LintCircularAnalysisError>,
    readonly [S.TaggedStruct<"LintCircularAnalysisError", typeof LintCircularAnalysisErrorFields>]
  >("LintCircularAnalysisError", {
    description: "Circular dependency analysis failed for a target directory.",
    toEquivalence: () => sameLintCircularAnalysisError,
  })
) {
  static readonly new = (message: string): LintCircularAnalysisError => LintCircularAnalysisError.make({ message });

  static readonly mapError = Err.mapCauseError<LintCircularAnalysisError, [message: string]>((cause, message) =>
    LintCircularAnalysisError.new(messageWithCause(message, cause))
  );
}

const LintFileDiscoveryErrorFields = {
  message: S.String,
  root: S.String,
  path: S.String,
} satisfies S.Struct.Fields;
const sameLintFileDiscoveryErrorFields = S.toEquivalence(
  S.TaggedStruct("LintFileDiscoveryError", LintFileDiscoveryErrorFields)
);
const sameLintFileDiscoveryError = (self: LintFileDiscoveryError, that: LintFileDiscoveryError): boolean =>
  sameLintFileDiscoveryErrorFields(self, that);

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
  LintFileDiscoveryErrorFields,
  $I.annoteClass<
    S.declare<LintFileDiscoveryError>,
    readonly [S.TaggedStruct<"LintFileDiscoveryError", typeof LintFileDiscoveryErrorFields>]
  >("LintFileDiscoveryError", {
    description: "TypeScript file discovery failed for a lint root.",
    toEquivalence: () => sameLintFileDiscoveryError,
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

const TestTypecheckBaselineErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameTestTypecheckBaselineErrorFields = S.toEquivalence(
  S.TaggedStruct("TestTypecheckBaselineError", TestTypecheckBaselineErrorFields)
);
const sameTestTypecheckBaselineError = (self: TestTypecheckBaselineError, that: TestTypecheckBaselineError): boolean =>
  sameTestTypecheckBaselineErrorFields(self, that);

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
  TestTypecheckBaselineErrorFields,
  $I.annoteClass<
    S.declare<TestTypecheckBaselineError>,
    readonly [S.TaggedStruct<"TestTypecheckBaselineError", typeof TestTypecheckBaselineErrorFields>]
  >("TestTypecheckBaselineError", {
    description: "Raised when the committed test-typecheck blind-spot baseline cannot be read, decoded, or written.",
    toEquivalence: () => sameTestTypecheckBaselineError,
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

const SchemaFirstInventoryReadErrorFields = {
  message: S.String,
} satisfies S.Struct.Fields;
const sameSchemaFirstInventoryReadErrorFields = S.toEquivalence(
  S.TaggedStruct("SchemaFirstInventoryReadError", SchemaFirstInventoryReadErrorFields)
);
const sameSchemaFirstInventoryReadError = (
  self: SchemaFirstInventoryReadError,
  that: SchemaFirstInventoryReadError
): boolean => sameSchemaFirstInventoryReadErrorFields(self, that);

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
  SchemaFirstInventoryReadErrorFields,
  $I.annoteClass<
    S.declare<SchemaFirstInventoryReadError>,
    readonly [S.TaggedStruct<"SchemaFirstInventoryReadError", typeof SchemaFirstInventoryReadErrorFields>]
  >("SchemaFirstInventoryReadError", {
    description: "Raised when the committed schema-first inventory cannot be parsed or decoded.",
    toEquivalence: () => sameSchemaFirstInventoryReadError,
  })
) {
  static readonly new = (message: string): SchemaFirstInventoryReadError =>
    SchemaFirstInventoryReadError.make({ message });

  static readonly mapError = Err.mapCauseError<SchemaFirstInventoryReadError, [message: string]>((cause, message) =>
    SchemaFirstInventoryReadError.new(messageWithCause(message, cause))
  );
}
