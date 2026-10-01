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
import { EffectSchemaInventoryDrift } from "./EffectSchemaInventory.schemas.ts";

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

/**
 * Reports an effect-schema-inventory failure that is not one of its fail-loud input errors.
 *
 * **Details**
 *
 * Covers fixture IO, row decoding, TypeScript extraction, and prompt resolution. Missing
 * reference, absent pin, catalog, and drift failures have their own tags.
 *
 * **Example** (Describe an unreadable fixture)
 *
 * ```ts
 * import { EffectSchemaInventoryError } from "@beep/repo-cli/commands/Lint"
 *
 * const error = EffectSchemaInventoryError.new("Unable to read INDEX.md.")
 * console.log(error._tag) // "EffectSchemaInventoryError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EffectSchemaInventoryError extends S.TaggedError<EffectSchemaInventoryError>(
  $I`EffectSchemaInventoryError`
)(
  "EffectSchemaInventoryError",
  { message: S.String },
  $I.annoteError<EffectSchemaInventoryError>("EffectSchemaInventoryError", {
    description: "Raised when schema inventory IO, decoding, extraction, rendering, or prompt resolution fails.",
  })
) {
  static readonly new = (message: string): EffectSchemaInventoryError => EffectSchemaInventoryError.make({ message });

  static readonly mapError = Err.mapCauseError<EffectSchemaInventoryError, [message: string]>((cause, message) =>
    EffectSchemaInventoryError.new(messageWithCause(message, cause))
  );
}

/**
 * Reports a root `package.json` whose `effect` catalog entry is not a snapshot URL ending in a full sha.
 *
 * **Example** (Describe a semver catalog entry)
 *
 * ```ts
 * import { EffectSchemaInventoryCatalogPinError } from "@beep/repo-cli/commands/Lint"
 *
 * const error = EffectSchemaInventoryCatalogPinError.new("4.0.0-rc.118", "Not a snapshot URL.")
 * console.log(error.specifier) // "4.0.0-rc.118"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EffectSchemaInventoryCatalogPinError extends S.TaggedError<EffectSchemaInventoryCatalogPinError>(
  $I`EffectSchemaInventoryCatalogPinError`
)(
  "EffectSchemaInventoryCatalogPinError",
  { message: S.String, specifier: S.String },
  $I.annoteError<EffectSchemaInventoryCatalogPinError>("EffectSchemaInventoryCatalogPinError", {
    description: "Raised when the root package.json catalog effect entry does not end in effect@<40-character sha>.",
  })
) {
  /**
   * Construct the error from the offending specifier and a message.
   *
   * @param specifier - Catalog value read from package.json, or a placeholder when absent.
   * @param message - Human-readable failure.
   * @returns The tagged catalog pin error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (specifier: string, message: string): EffectSchemaInventoryCatalogPinError =>
    EffectSchemaInventoryCatalogPinError.make({ message: `${message} Found: ${specifier}`, specifier });
}

/**
 * Reports a missing Effect reference clone, so inventory regeneration can never pass empty.
 *
 * **Example** (Describe a missing reference)
 *
 * ```ts
 * import { EffectSchemaInventoryReferenceMissingError } from "@beep/repo-cli/commands/Lint"
 *
 * const error = EffectSchemaInventoryReferenceMissingError.new("/repo/.repos/effect", "Run scripts/setup-effect-ref.sh.")
 * console.log(error.reference) // "/repo/.repos/effect"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EffectSchemaInventoryReferenceMissingError extends S.TaggedError<EffectSchemaInventoryReferenceMissingError>(
  $I`EffectSchemaInventoryReferenceMissingError`
)(
  "EffectSchemaInventoryReferenceMissingError",
  { message: S.String, reference: S.String },
  $I.annoteError<EffectSchemaInventoryReferenceMissingError>("EffectSchemaInventoryReferenceMissingError", {
    description: "Raised when .repos/effect is absent or is not a git checkout.",
  })
) {
  /**
   * Construct the error for a reference path.
   *
   * @param reference - Absolute path of the expected reference clone.
   * @param message - Human-readable failure and remedy.
   * @returns The tagged missing-reference error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (reference: string, message: string): EffectSchemaInventoryReferenceMissingError =>
    EffectSchemaInventoryReferenceMissingError.make({ message, reference });
}

/**
 * Reports an `inventoryPin` commit the reference clone does not contain yet.
 *
 * **Example** (Describe an absent pin)
 *
 * ```ts
 * import { EffectSchemaInventoryPinAbsentError } from "@beep/repo-cli/commands/Lint"
 *
 * const error = EffectSchemaInventoryPinAbsentError.new("0".repeat(40), "/repo/.repos/effect", "Fetch the reference.")
 * console.log(error._tag) // "EffectSchemaInventoryPinAbsentError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EffectSchemaInventoryPinAbsentError extends S.TaggedError<EffectSchemaInventoryPinAbsentError>(
  $I`EffectSchemaInventoryPinAbsentError`
)(
  "EffectSchemaInventoryPinAbsentError",
  { message: S.String, pin: S.String, reference: S.String },
  $I.annoteError<EffectSchemaInventoryPinAbsentError>("EffectSchemaInventoryPinAbsentError", {
    description: "Raised when git cannot find the pinned Effect commit in .repos/effect.",
  })
) {
  /**
   * Construct the error for a pin and reference path.
   *
   * @param pin - Catalog sha that git could not resolve.
   * @param reference - Absolute path of the reference clone.
   * @param message - Human-readable failure and remedy.
   * @returns The tagged absent-pin error.
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (pin: string, reference: string, message: string): EffectSchemaInventoryPinAbsentError =>
    EffectSchemaInventoryPinAbsentError.make({ message, pin, reference });
}

/**
 * Reports that local graft context for a lane prompt could not be read.
 *
 * **Details**
 *
 * Graft is a local refresh input: `--prompt` fails loud when it is absent, times out, or reports
 * something that does not decode, rather than writing a prompt without it.
 *
 * **Example** (Describe a missing graft binary)
 *
 * ```ts
 * import { EffectSchemaInventoryGraftUnavailableError } from "@beep/repo-cli/commands/Lint"
 *
 * const error = EffectSchemaInventoryGraftUnavailableError.new("graft could not run: ENOENT")
 * console.log(error._tag) // "EffectSchemaInventoryGraftUnavailableError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EffectSchemaInventoryGraftUnavailableError extends S.TaggedError<EffectSchemaInventoryGraftUnavailableError>(
  $I`EffectSchemaInventoryGraftUnavailableError`
)(
  "EffectSchemaInventoryGraftUnavailableError",
  { message: S.String },
  $I.annoteError<EffectSchemaInventoryGraftUnavailableError>("EffectSchemaInventoryGraftUnavailableError", {
    description:
      "Raised when graft context for a schema inventory lane prompt cannot be read from the reference clone.",
  })
) {
  static readonly new = (message: string): EffectSchemaInventoryGraftUnavailableError =>
    EffectSchemaInventoryGraftUnavailableError.make({ message });
}

/**
 * Reports a committed inventory fixture that no longer matches the pinned sources.
 *
 * **Example** (Describe a missing index)
 *
 * ```ts
 * import { EffectSchemaInventoryDrift } from "@beep/repo-cli/commands/Lint"
 * import { EffectSchemaInventoryDriftError } from "@beep/repo-cli/commands/Lint"
 *
 * const error = EffectSchemaInventoryDriftError.make({
 *   message: "1 fixture file drifted.",
 *   drift: [EffectSchemaInventoryDrift.cases.missing.make({ file: "INDEX.md" })]
 * })
 * console.log(error.drift.length) // 1
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EffectSchemaInventoryDriftError extends S.TaggedError<EffectSchemaInventoryDriftError>(
  $I`EffectSchemaInventoryDriftError`
)(
  "EffectSchemaInventoryDriftError",
  { message: S.String, drift: S.Array(EffectSchemaInventoryDrift) },
  $I.annoteError<EffectSchemaInventoryDriftError>("EffectSchemaInventoryDriftError", {
    description: "Raised when effect-schema-inventory --check finds missing, stale, or unexpected fixture files.",
  })
) {}

/**
 * Reports a schema-parity codemod run that cannot discover, read, write or
 * format its files, or whose biome pass fails.
 *
 * **Example** (Describe a failed format pass)
 *
 * ```ts
 * import { SchemaParityCodemodError } from "@beep/repo-cli/commands/Lint"
 *
 * const error = SchemaParityCodemodError.new("biome check exited 1.")
 * console.log(error._tag) // "SchemaParityCodemodError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SchemaParityCodemodError extends S.TaggedError<SchemaParityCodemodError>($I`SchemaParityCodemodError`)(
  "SchemaParityCodemodError",
  { message: S.NonEmptyString },
  $I.annoteError<SchemaParityCodemodError>("SchemaParityCodemodError", {
    description: "Raised when a schema-parity codemod run cannot discover, read, write or format its files.",
  })
) {
  static readonly new = (message: string): SchemaParityCodemodError => SchemaParityCodemodError.make({ message });

  static readonly mapError = Err.mapCauseError<SchemaParityCodemodError, [message: string]>((cause, message) =>
    SchemaParityCodemodError.new(messageWithCause(message, cause))
  );
}
