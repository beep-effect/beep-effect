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
import { messageWithCause } from "@beep/repo-cli-kit/cli/CommandErrorFields";
import { OpaqueDefect } from "@beep/repo-cli-kit/schema/OpaqueDefect";
import { LiteralKit } from "@beep/schema";
import { Err } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import { ModelsExchangeUnsupportedReason, ModelsRecoveryRefusal } from "./Models.exchange.schemas.ts";

const $I = $RepoCliId.create("commands/Models/Models.errors");

/**
 * Why a native write or restore refused, when the refusal has a typed cause.
 *
 * **Details**
 *
 * `ineligible` is a parsed eligibility refusal. `exchange-unsupported` means the
 * target filesystem cannot exchange pathnames atomically, and
 * `exchange-probe-failed` means its capability could not be established. Both
 * exchange refusals happen before any backup, journal or publication. The
 * {@link ModelsRecoveryRefusal} reasons come from restart recovery, which
 * refuses and keeps every artifact. `owner-alive` means the publication still
 * belongs to a running process, `lock-held` that another live process holds
 * its exclusive recovery lock, and `lock-unavailable` that the lock could not be
 * created for any reason other than an existing lock (permission, read-only or
 * full filesystem).
 *
 * **Example** (Guard a refusal reason)
 *
 * ```ts
 * import { ModelsLocatorRefusal } from "@beep/repo-cli/commands/Models"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ModelsLocatorRefusal)("exchange-unsupported")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ModelsLocatorRefusal = LiteralKit([
  "ineligible",
  "exchange-unsupported",
  "exchange-probe-failed",
  "owner-alive",
  "lock-held",
  "lock-unavailable",
  ...ModelsRecoveryRefusal.literals,
]).pipe(
  $I.annoteSchema("ModelsLocatorRefusal", {
    description: "Typed reason a native write, restore or recovery refused without overwriting the target.",
  })
);

/**
 * Runtime type of {@link ModelsLocatorRefusal}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ModelsLocatorRefusal = typeof ModelsLocatorRefusal.Type;

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
export class ModelsCatalogError extends S.TaggedError<ModelsCatalogError, { readonly brand: unique symbol }>(
  $I`ModelsCatalogError`
)(
  "ModelsCatalogError",
  {
    message: S.String,
    source: S.optionalKey(S.String),
    cause: S.optionalKey(OpaqueDefect),
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
export class ModelsManifestError extends S.TaggedError<ModelsManifestError, { readonly brand: unique symbol }>(
  $I`ModelsManifestError`
)(
  "ModelsManifestError",
  {
    message: S.String,
    path: S.optionalKey(S.String),
    cause: S.optionalKey(OpaqueDefect),
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
export class ModelsLocatorError extends S.TaggedError<ModelsLocatorError, { readonly brand: unique symbol }>(
  $I`ModelsLocatorError`
)(
  "ModelsLocatorError",
  {
    message: S.String,
    reason: S.optionalKey(ModelsLocatorRefusal),
    path: S.optionalKey(S.String),
    cause: S.optionalKey(OpaqueDefect),
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
 * The atomic-exchange capability of a target filesystem could not be established.
 *
 * **Details**
 *
 * Raised when the probe cannot identify the target's filesystem, create or
 * read its disposable files, or confirm that they live on the target's mount.
 * A filesystem that answers the probe with a refusal is not this error; it is
 * an `unsupported` capability.
 *
 * **Example** (Make a probe error)
 *
 * ```ts
 * import { ModelsExchangeProbeError } from "@beep/repo-cli/commands/Models"
 *
 * const error = ModelsExchangeProbeError.make({ message: "Cannot create probe files.", path: "/srv/config" })
 * console.log(error._tag) // "ModelsExchangeProbeError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ModelsExchangeProbeError extends S.TaggedError<
  ModelsExchangeProbeError,
  { readonly brand: unique symbol }
>($I`ModelsExchangeProbeError`)(
  "ModelsExchangeProbeError",
  {
    message: S.String,
    path: S.optionalKey(S.String),
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<ModelsExchangeProbeError>("ModelsExchangeProbeError", {
    title: "Models Exchange Probe Error",
    description: "Failed to establish the atomic-exchange capability of a native target filesystem.",
  })
) {
  /**
   * Map an arbitrary cause into a probe error carrying the probed directory.
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly mapError = Err.mapCauseError<ModelsExchangeProbeError, [message: string, path?: string]>(
    (cause, message, path) =>
      ModelsExchangeProbeError.make({
        message: messageWithCause(message, cause),
        cause,
        ...O.getSomesStruct({ path: O.fromUndefinedOr(path) }),
      })
  );
}

/**
 * One atomic pathname exchange was refused by the host.
 *
 * **Details**
 *
 * `reason` is the errno the exchange returned, mapped onto
 * {@link ModelsExchangeUnsupportedReason}. The probe turns this fault into an
 * `unsupported` capability; publication and recovery turn it into a
 * {@link ModelsLocatorError} that retains recovery artifacts.
 *
 * **Example** (Make an exchange fault)
 *
 * ```ts
 * import { ModelsExchangeFault } from "@beep/repo-cli/commands/Models"
 *
 * const fault = ModelsExchangeFault.make({ reason: "exdev", message: "Invalid cross-device link" })
 * console.log(fault.reason) // "exdev"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ModelsExchangeFault extends S.TaggedError<ModelsExchangeFault, { readonly brand: unique symbol }>(
  $I`ModelsExchangeFault`
)(
  "ModelsExchangeFault",
  {
    reason: ModelsExchangeUnsupportedReason,
    message: S.String,
  },
  $I.annoteError<ModelsExchangeFault>("ModelsExchangeFault", {
    title: "Models Exchange Fault",
    description: "The host refused one atomic pathname exchange with an errno-derived reason.",
  })
) {}

/**
 * The exchange primitive could not be run, so the host gave no verdict.
 *
 * **Details**
 *
 * Raised when `mv --exchange` cannot be spawned, its output cannot be
 * collected, or it ends without a host refusal (killed by a signal, or a
 * non-zero exit with no error text). This is never a capability verdict: the
 * probe reports it as {@link ModelsExchangeProbeError} and does not cache it,
 * so a later probe can still succeed. Contrast {@link ModelsExchangeFault},
 * which is the host refusing the exchange.
 *
 * **Example** (Make a launch error)
 *
 * ```ts
 * import { ModelsExchangeLaunchError } from "@beep/repo-cli/commands/Models"
 *
 * const error = ModelsExchangeLaunchError.make({ message: "Cannot run mv --exchange: spawn EAGAIN" })
 * console.log(error._tag) // "ModelsExchangeLaunchError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ModelsExchangeLaunchError extends S.TaggedError<
  ModelsExchangeLaunchError,
  { readonly brand: unique symbol }
>($I`ModelsExchangeLaunchError`)(
  "ModelsExchangeLaunchError",
  {
    message: S.String,
    cause: S.optionalKey(OpaqueDefect),
  },
  $I.annoteError<ModelsExchangeLaunchError>("ModelsExchangeLaunchError", {
    title: "Models Exchange Launch Error",
    description: "The atomic exchange primitive could not be run, so the host gave no exchange verdict.",
  })
) {}

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
export class ModelsLedgerError extends S.TaggedError<ModelsLedgerError, { readonly brand: unique symbol }>(
  $I`ModelsLedgerError`
)(
  "ModelsLedgerError",
  {
    message: S.String,
    path: S.optionalKey(S.String),
    cause: S.optionalKey(OpaqueDefect),
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
export class ModelsCommandError extends S.TaggedError<ModelsCommandError, { readonly brand: unique symbol }>(
  $I`ModelsCommandError`
)(
  "ModelsCommandError",
  {
    message: S.String,
    detail: S.optionalKey(S.String),
    cause: S.optionalKey(OpaqueDefect),
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
