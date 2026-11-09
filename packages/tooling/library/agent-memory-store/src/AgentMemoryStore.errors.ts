/**
 * Typed errors raised by the agent memory store service contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import { PosixPath, Sha256Hex } from "@beep/schema";
import { defectDiagnostics, optionalDefectMessage } from "@beep/schema/SchemaUtils/defectDiagnostics";
import { optionalDefect } from "@beep/schema/SchemaUtils/optionalDefect";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { MemoryFilePath, NodeId } from "./NodeIdentity.models.ts";
import { ScipSymbol } from "./Scip.models.ts";

const $I = $AgentMemoryStoreId.create("AgentMemoryStore.errors");

const failureFields = {
  operation: S.NonEmptyString.annotateKey({ description: "Store operation that failed." }),
  cause: optionalDefect("Original defect when one was available."),
  message: optionalDefectMessage("Non-empty message extracted from the originating failure."),
};

const optionalNodeId = S.OptionFromOptionalKey(NodeId).pipe(
  S.withConstructorDefault(Effect.succeedNone),
  S.annotateKey({ description: "Node the operation was working on, when known." })
);

/**
 * Failure reading or appending the memory log.
 *
 * **Example** (Wrap a journal failure)
 *
 * ```ts
 * import { MemoryLogError } from "@beep/agent-memory-store"
 *
 * const error = MemoryLogError.fromUnknown("append", new Error("journal closed"))
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MemoryLogError extends S.TaggedError<MemoryLogError, { readonly brand: unique symbol }>(
  $I`MemoryLogError`
)(
  "MemoryLogError",
  failureFields,
  $I.annoteError<MemoryLogError>("MemoryLogError", {
    description: "Failure reading or appending the memory log.",
  })
) {
  /**
   * Normalizes an unknown failure into a {@link MemoryLogError}.
   *
   * **Example** (Normalize an unknown failure)
   *
   * ```ts
   * import { MemoryLogError } from "@beep/agent-memory-store"
   *
   * console.log(MemoryLogError.fromUnknown("entries"))
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (operation: string, cause?: unknown): MemoryLogError =>
    MemoryLogError.make({ operation, ...defectDiagnostics(cause) });
}

/**
 * Failure inside store-side admission, distinct from a held or rejected outcome.
 *
 * **Example** (Wrap an admission failure)
 *
 * ```ts
 * import { AdmissionError } from "@beep/agent-memory-store"
 *
 * const error = AdmissionError.fromUnknown("admit", new Error("log unavailable"))
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AdmissionError extends S.TaggedError<AdmissionError, { readonly brand: unique symbol }>(
  $I`AdmissionError`
)(
  "AdmissionError",
  { ...failureFields, nodeId: optionalNodeId },
  $I.annoteError<AdmissionError>("AdmissionError", {
    description: "Failure inside store-side admission.",
  })
) {
  /**
   * Normalizes an unknown failure into an {@link AdmissionError}.
   *
   * **Example** (Normalize an unknown failure)
   *
   * ```ts
   * import { AdmissionError } from "@beep/agent-memory-store"
   *
   * console.log(AdmissionError.fromUnknown("resolve"))
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (operation: string, cause?: unknown): AdmissionError =>
    AdmissionError.make({ operation, ...defectDiagnostics(cause) });
}

/**
 * Failure importing, exporting or projecting Markdown memory files.
 *
 * **Example** (Wrap a projection failure)
 *
 * ```ts
 * import { ProjectionError } from "@beep/agent-memory-store"
 *
 * const error = ProjectionError.fromUnknown("exportFolder", new Error("disk full"))
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProjectionError extends S.TaggedError<ProjectionError, { readonly brand: unique symbol }>(
  $I`ProjectionError`
)(
  "ProjectionError",
  {
    ...failureFields,
    path: S.OptionFromOptionalKey(MemoryFilePath).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Memory file the operation was working on, when known." })
    ),
  },
  $I.annoteError<ProjectionError>("ProjectionError", {
    description: "Failure importing, exporting or projecting Markdown memory files.",
  })
) {
  /**
   * Normalizes an unknown failure into a {@link ProjectionError}.
   *
   * **Example** (Normalize an unknown failure)
   *
   * ```ts
   * import { ProjectionError } from "@beep/agent-memory-store"
   *
   * console.log(ProjectionError.fromUnknown("importFolder"))
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (operation: string, cause?: unknown): ProjectionError =>
    ProjectionError.make({ operation, ...defectDiagnostics(cause) });
}

/**
 * Failure running a recall or one of its stages.
 *
 * **Example** (Wrap a recall failure)
 *
 * ```ts
 * import { RecallError } from "@beep/agent-memory-store"
 *
 * const error = RecallError.fromUnknown("rerank", new Error("model missing"))
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RecallError extends S.TaggedError<RecallError, { readonly brand: unique symbol }>($I`RecallError`)(
  "RecallError",
  failureFields,
  $I.annoteError<RecallError>("RecallError", {
    description: "Failure running a recall or one of its stages.",
  })
) {
  /**
   * Normalizes an unknown failure into a {@link RecallError}.
   *
   * **Example** (Normalize an unknown failure)
   *
   * ```ts
   * import { RecallError } from "@beep/agent-memory-store"
   *
   * console.log(RecallError.fromUnknown("recall"))
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (operation: string, cause?: unknown): RecallError =>
    RecallError.make({ operation, ...defectDiagnostics(cause) });
}

/**
 * Failure rebuilding or querying a Layer 2 index projection.
 *
 * **Details**
 *
 * Raised by every `MemoryIndexes` method. A rebuild failure is a projection
 * failure, not a recall failure: recall maps it into {@link RecallError} at
 * its own boundary.
 *
 * **Example** (Wrap an index rebuild failure)
 *
 * ```ts
 * import { MemoryIndexError } from "@beep/agent-memory-store"
 *
 * const error = MemoryIndexError.fromUnknown("rebuild", new Error("fts5 unavailable"))
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MemoryIndexError extends S.TaggedError<MemoryIndexError, { readonly brand: unique symbol }>(
  $I`MemoryIndexError`
)(
  "MemoryIndexError",
  failureFields,
  $I.annoteError<MemoryIndexError>("MemoryIndexError", {
    description: "Failure rebuilding or querying a Layer 2 index projection.",
  })
) {
  /**
   * Normalizes an unknown failure into a {@link MemoryIndexError}.
   *
   * **Example** (Normalize an unknown failure)
   *
   * ```ts
   * import { MemoryIndexError } from "@beep/agent-memory-store"
   *
   * console.log(MemoryIndexError.fromUnknown("searchText"))
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (operation: string, cause?: unknown): MemoryIndexError =>
    MemoryIndexError.make({ operation, ...defectDiagnostics(cause) });
}

/**
 * Refusal to project over a memory folder the log has not imported (AC-8).
 *
 * **Details**
 *
 * This is a typed refusal, not an I/O failure: the projector checked the log
 * for a `FolderImported` record of `folderDigest` and found none, so it wrote
 * nothing and no existing file was replaced or emptied.
 *
 * **Example** (Refuse an unimported folder)
 *
 * ```ts
 * import { UnimportedFolderError } from "@beep/agent-memory-store"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const error = UnimportedFolderError.make({
 *   root: PosixPath.make("memory"),
 *   folderDigest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 * })
 * console.log(error.root)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnimportedFolderError extends S.TaggedError<UnimportedFolderError, { readonly brand: unique symbol }>(
  $I`UnimportedFolderError`
)(
  "UnimportedFolderError",
  {
    root: PosixPath.annotateKey({ description: "Memory folder the projector refused." }),
    folderDigest: Sha256Hex.annotateKey({ description: "Digest of the folder that has no import record." }),
  },
  $I.annoteError<UnimportedFolderError>("UnimportedFolderError", {
    description: "Refusal to project over a memory folder the log has not imported.",
  })
) {}

/**
 * Failure recording or counting observations.
 *
 * **Example** (Wrap an observation failure)
 *
 * ```ts
 * import { ObservationError } from "@beep/agent-memory-store"
 *
 * const error = ObservationError.fromUnknown("observe", new Error("journal closed"))
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ObservationError extends S.TaggedError<ObservationError, { readonly brand: unique symbol }>(
  $I`ObservationError`
)(
  "ObservationError",
  failureFields,
  $I.annoteError<ObservationError>("ObservationError", {
    description: "Failure recording or counting observations.",
  })
) {
  /**
   * Normalizes an unknown failure into an {@link ObservationError}.
   *
   * **Example** (Normalize an unknown failure)
   *
   * ```ts
   * import { ObservationError } from "@beep/agent-memory-store"
   *
   * console.log(ObservationError.fromUnknown("distinctLineageCount"))
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (operation: string, cause?: unknown): ObservationError =>
    ObservationError.make({ operation, ...defectDiagnostics(cause) });
}

/**
 * Failure resolving a code symbol against a SCIP index.
 *
 * **Example** (Wrap a resolution failure)
 *
 * ```ts
 * import { SymbolResolutionError } from "@beep/agent-memory-store"
 *
 * const error = SymbolResolutionError.fromUnknown("resolve", new Error("index unreadable"))
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SymbolResolutionError extends S.TaggedError<SymbolResolutionError, { readonly brand: unique symbol }>(
  $I`SymbolResolutionError`
)(
  "SymbolResolutionError",
  {
    ...failureFields,
    symbol: S.OptionFromOptionalKey(ScipSymbol).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Symbol being resolved, when known." })
    ),
  },
  $I.annoteError<SymbolResolutionError>("SymbolResolutionError", {
    description: "Failure resolving a code symbol against a SCIP index.",
  })
) {
  /**
   * Normalizes an unknown failure into a {@link SymbolResolutionError}.
   *
   * **Example** (Normalize an unknown failure)
   *
   * ```ts
   * import { SymbolResolutionError } from "@beep/agent-memory-store"
   *
   * console.log(SymbolResolutionError.fromUnknown("resolve"))
   * ```
   *
   * @category errors
   * @since 0.0.0
   */
  static readonly fromUnknown = (operation: string, cause?: unknown): SymbolResolutionError =>
    SymbolResolutionError.make({ operation, ...defectDiagnostics(cause) });
}
