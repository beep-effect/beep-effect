/**
 * Tagged errors for the `beep models` command group.
 *
 * **Details**
 *
 * Four internal errors name *which truth failed to load* — the catalog, the
 * manifest, a locator read, or the home ledger — and one boundary error,
 * {@link ModelsCommandError}, is what the command adapter renders and exits
 * on. Keeping the internal four distinct is what lets the check orchestrator
 * degrade an absent availability overlay without conflating it with a manifest
 * typo.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Defect } from "@beep/schema";
import { Err } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import { messageWithCause } from "../../internal/cli/CommandErrorFields.ts";

const $I = $RepoCliId.create("commands/Models/Models.errors");

/**
 * The layered catalog could not be assembled.
 *
 * **Details**
 *
 * Raised when the upstream manifest cannot be fetched or decoded. An
 * availability overlay that is merely *absent* — no Codex cache on this box,
 * no `cursor-agent` binary, a proxy that is not running — is not an error: the
 * source returns `None` and the snapshot records which layers answered.
 *
 * **Example** (Make a catalog error)
 *
 * ```ts
 * import { ModelsCatalogError } from "@beep/repo-cli/commands/Models"
 *
 * const error = ModelsCatalogError.make({ message: "Failed to fetch the upstream model manifest." })
 * console.log(error._tag) // "ModelsCatalogError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ModelsCatalogError extends S.TaggedError<ModelsCatalogError>($I`ModelsCatalogError`)(
  "ModelsCatalogError",
  {
    message: S.String,
    source: S.optionalKey(S.String),
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<ModelsCatalogError>("ModelsCatalogError", {
    title: "Models Catalog Error",
    description: "Failed to fetch, read, or decode a layer of the model catalog.",
  })
) {
  /**
   * Map an arbitrary cause into a catalog error carrying the failing layer.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly mapError = Err.mapCauseError<ModelsCatalogError, [message: string, source?: string]>(
    (cause, message, source) =>
      ModelsCatalogError.make({
        message: messageWithCause(message, cause),
        cause,
        ...O.getSomesStruct({ source: O.fromUndefinedOr(source) }),
      })
  );
}

/**
 * The operator manifest could not be read, decoded, or created.
 *
 * **Example** (Make a manifest error)
 *
 * ```ts
 * import { ModelsManifestError } from "@beep/repo-cli/commands/Models"
 *
 * const error = ModelsManifestError.make({ message: "Manifest already exists." })
 * console.log(error._tag) // "ModelsManifestError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ModelsManifestError extends S.TaggedError<ModelsManifestError>($I`ModelsManifestError`)(
  "ModelsManifestError",
  {
    message: S.String,
    path: S.optionalKey(S.String),
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<ModelsManifestError>("ModelsManifestError", {
    title: "Models Manifest Error",
    description: "Failed to read, decode, or create the operator routing manifest.",
  })
) {
  /**
   * Map an arbitrary cause into a manifest error carrying the manifest path.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly mapError = Err.mapCauseError<ModelsManifestError, [message: string, path?: string]>(
    (cause, message, path) =>
      ModelsManifestError.make({
        message: messageWithCause(message, cause),
        cause,
        ...O.getSomesStruct({ path: O.fromUndefinedOr(path) }),
      })
  );
}

/**
 * A locator could not be read out of its target file.
 *
 * **Details**
 *
 * A locator that simply *matches nothing* is not an error — the reader returns
 * `None` and the run records a `missing-locator` finding. This error is for a
 * file whose grammar the reader could not parse at all.
 *
 * **Example** (Make a locator error)
 *
 * ```ts
 * import { ModelsLocatorError } from "@beep/repo-cli/commands/Models"
 *
 * const error = ModelsLocatorError.make({ message: "Failed to parse XML." })
 * console.log(error._tag) // "ModelsLocatorError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ModelsLocatorError extends S.TaggedError<ModelsLocatorError>($I`ModelsLocatorError`)(
  "ModelsLocatorError",
  {
    message: S.String,
    path: S.optionalKey(S.String),
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<ModelsLocatorError>("ModelsLocatorError", {
    title: "Models Locator Error",
    description: "Failed to parse a projection target well enough to read a locator out of it.",
  })
) {
  /**
   * Map an arbitrary cause into a locator error carrying the target path.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly mapError = Err.mapCauseError<ModelsLocatorError, [message: string, path?: string]>(
    (cause, message, path) =>
      ModelsLocatorError.make({
        message: messageWithCause(message, cause),
        cause,
        ...O.getSomesStruct({ path: O.fromUndefinedOr(path) }),
      })
  );
}

/**
 * The home catalog ledger could not be read or written.
 *
 * **Example** (Make a ledger error)
 *
 * ```ts
 * import { ModelsLedgerError } from "@beep/repo-cli/commands/Models"
 *
 * const error = ModelsLedgerError.make({ message: "Failed to write a snapshot." })
 * console.log(error._tag) // "ModelsLedgerError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ModelsLedgerError extends S.TaggedError<ModelsLedgerError>($I`ModelsLedgerError`)(
  "ModelsLedgerError",
  {
    message: S.String,
    path: S.optionalKey(S.String),
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<ModelsLedgerError>("ModelsLedgerError", {
    title: "Models Ledger Error",
    description: "Failed to read or write a dated catalog snapshot in the home ledger.",
  })
) {
  /**
   * Map an arbitrary cause into a ledger error carrying the snapshot path.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly mapError = Err.mapCauseError<ModelsLedgerError, [message: string, path?: string]>(
    (cause, message, path) =>
      ModelsLedgerError.make({
        message: messageWithCause(message, cause),
        cause,
        ...O.getSomesStruct({ path: O.fromUndefinedOr(path) }),
      })
  );
}

/**
 * The one error the `beep models` command boundary renders and exits on.
 *
 * **Details**
 *
 * Every internal error folds into this one before it reaches the adapter, so
 * the command's catch surface stays a single tag no matter how many truths the
 * orchestrator consults.
 *
 * **Example** (Fold an internal error into the boundary error)
 *
 * ```ts
 * import { ModelsCatalogError, ModelsCommandError } from "@beep/repo-cli/commands/Models"
 *
 * const internal = ModelsCatalogError.make({ message: "upstream unreachable" })
 * const boundary = ModelsCommandError.fromInternal(internal)
 * console.log(boundary.message) // "upstream unreachable"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ModelsCommandError extends S.TaggedError<ModelsCommandError>($I`ModelsCommandError`)(
  "ModelsCommandError",
  {
    message: S.String,
    detail: S.optionalKey(S.String),
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<ModelsCommandError>("ModelsCommandError", {
    title: "Models Command Error",
    description: "A `beep models` run failed at the command boundary.",
  })
) {
  /**
   * Fold any internal models error into the command-boundary error.
   *
   * @param error - The internal catalog, manifest, locator, or ledger error.
   * @returns The boundary error carrying the internal message and tag.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromInternal = (
    error: ModelsCatalogError | ModelsManifestError | ModelsLocatorError | ModelsLedgerError
  ): ModelsCommandError =>
    ModelsCommandError.make({
      message: error.message,
      detail: error._tag,
      cause: error,
    });

  /**
   * Map an arbitrary cause into the command-boundary error.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly mapError = Err.mapCauseError<ModelsCommandError, [message: string]>((cause, message) =>
    ModelsCommandError.make({
      message: messageWithCause(message, cause),
      cause,
    })
  );
}
