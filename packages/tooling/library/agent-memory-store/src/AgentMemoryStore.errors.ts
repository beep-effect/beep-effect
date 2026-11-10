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
import { HoldId } from "./Admission.models.ts";
import { MemoryFilePath, NodeId, RevisionId } from "./NodeIdentity.models.ts";
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
 * Refusal to append a node event whose parents are not the node's heads.
 *
 * **Details**
 *
 * This is the per-node compare-and-set of the memory log, not an I/O failure.
 * A revision-producing event appended on this replica lands only when its
 * `parents` are exactly the node's current head revisions, and a
 * `NodeCreated` lands only when the node has none. The check runs inside the
 * journal's writer transaction, so two local writers cannot both pass it; a
 * failed check appends nothing. `parents` is what the refused event named
 * (empty for a `NodeCreated`) and `heads` is what the log held.
 *
 * **Example** (Refuse a stale revision)
 *
 * ```ts
 * import { NodeId, RevisionId, StaleParentsError } from "@beep/agent-memory-store"
 *
 * const error = StaleParentsError.make({
 *   nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
 *   parents: [RevisionId.make("1111111111111111111111111111111111111111111111111111111111111111")],
 *   heads: [RevisionId.make("2222222222222222222222222222222222222222222222222222222222222222")],
 * })
 * console.log(error.heads.length)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class StaleParentsError extends S.TaggedError<StaleParentsError, { readonly brand: unique symbol }>(
  $I`StaleParentsError`
)(
  "StaleParentsError",
  {
    nodeId: NodeId.annotateKey({ description: "Node the refused event was written for." }),
    parents: S.Array(RevisionId).annotateKey({ description: "Parent revisions the refused event named." }),
    heads: S.Array(RevisionId).annotateKey({ description: "Head revisions the log held for the node." }),
  },
  $I.annoteError<StaleParentsError>("StaleParentsError", {
    description: "Refusal to append a node event whose parents are not the node's current heads.",
  })
) {}

/**
 * Refusal to resolve a hold the log does not hold open.
 *
 * **Details**
 *
 * A `HoldResolved` event lands only while the log holds an unresolved
 * `WriteHeld` for its `holdId`. The check runs inside the journal's writer
 * transaction like the per-node compare-and-set, so two resolvers cannot both
 * settle one hold. `holdId` is the id the refused resolution named; the hold
 * is either unknown or already resolved.
 *
 * **Example** (Refuse a second resolution)
 *
 * ```ts
 * import { HoldId, HoldNotOpenError } from "@beep/agent-memory-store"
 *
 * const error = HoldNotOpenError.make({ holdId: HoldId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e90") })
 * console.log(error.holdId)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HoldNotOpenError extends S.TaggedError<HoldNotOpenError, { readonly brand: unique symbol }>(
  $I`HoldNotOpenError`
)(
  "HoldNotOpenError",
  {
    holdId: HoldId.annotateKey({ description: "Hold the refused resolution named." }),
  },
  $I.annoteError<HoldNotOpenError>("HoldNotOpenError", {
    description: "Refusal to resolve a hold the log does not hold open.",
  })
) {}

/**
 * Refusal to append a `NodeCreated` whose predecessor is not a node of the
 * same file.
 *
 * **Details**
 *
 * Like the per-node compare-and-set, this is checked inside the journal's
 * writer transaction, so a refused batch appends nothing. A file is the
 * concatenation of its nodes placed by their predecessors (decision
 * `file-is-an-ordered-node-partition`), so a node whose `after` names an
 * unknown node, or a node of another file, would be held by the log but shown
 * by no projection. `afterFilePath` is the file the named predecessor belongs
 * to, or none when the log holds no such node.
 *
 * **Example** (Refuse an insert after a node of another file)
 *
 * ```ts
 * import { MemoryFilePath, NodeId, UnplacedNodeError } from "@beep/agent-memory-store"
 * import * as O from "effect/Option"
 *
 * const error = UnplacedNodeError.make({
 *   nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
 *   filePath: MemoryFilePath.make("notes.md"),
 *   after: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e80"),
 *   afterFilePath: O.some(MemoryFilePath.make("MEMORY.md")),
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnplacedNodeError extends S.TaggedError<UnplacedNodeError, { readonly brand: unique symbol }>(
  $I`UnplacedNodeError`
)(
  "UnplacedNodeError",
  {
    nodeId: NodeId.annotateKey({ description: "Node the refused NodeCreated would have created." }),
    filePath: MemoryFilePath.annotateKey({ description: "File the refused node names." }),
    after: NodeId.annotateKey({ description: "Predecessor the refused node names." }),
    afterFilePath: S.OptionFromOptionalKey(MemoryFilePath).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "File the predecessor belongs to; none when the log holds no such node." })
    ),
  },
  $I.annoteError<UnplacedNodeError>("UnplacedNodeError", {
    description: "Refusal to append a NodeCreated whose predecessor is not a node of the same file.",
  })
) {}

/**
 * Refusal to project over a memory folder the log has not imported (AC-8).
 *
 * **Details**
 *
 * This is a typed refusal, not an I/O failure. `exportFolder` raises it when
 * the log holds no `FolderImported`, or when a memory file in `root` holds
 * bytes the store never imported from or wrote to that folder; it wrote
 * nothing and no existing file was replaced or emptied. `projectNode` raises
 * it when the log holds no `FolderImported` at all; it names no folder, so
 * `root` and `folderDigest` are none.
 *
 * **Example** (Refuse an unimported folder)
 *
 * ```ts
 * import { UnimportedFolderError } from "@beep/agent-memory-store"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as O from "effect/Option"
 *
 * const error = UnimportedFolderError.make({
 *   root: O.some(PosixPath.make("memory")),
 *   folderDigest: O.some(Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")),
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
    root: S.OptionFromOptionalKey(PosixPath).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Memory folder the projector refused; none when the operation names no folder." })
    ),
    folderDigest: S.OptionFromOptionalKey(Sha256Hex).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({ description: "Digest of the refused folder's memory files; none when no folder was named." })
    ),
  },
  $I.annoteError<UnimportedFolderError>("UnimportedFolderError", {
    description: "Refusal to project over a memory folder the log has not imported.",
  })
) {}

/**
 * Refusal to import a folder into a log that already holds a different one.
 *
 * **Details**
 *
 * One log holds one memory folder (decision
 * `second-import-is-idempotent-on-a-projected-folder`). A second
 * `importFolder` of the folder the store imported or projected returns the
 * current base; any other folder, or the same folder holding bytes the store
 * never saw there, is refused with this error and nothing is appended.
 *
 * **Example** (Refuse a foreign folder)
 *
 * ```ts
 * import { ForeignFolderError } from "@beep/agent-memory-store"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const error = ForeignFolderError.make({
 *   root: PosixPath.make("other-memory"),
 *   folderDigest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ForeignFolderError extends S.TaggedError<ForeignFolderError, { readonly brand: unique symbol }>(
  $I`ForeignFolderError`
)(
  "ForeignFolderError",
  {
    root: PosixPath.annotateKey({ description: "Memory folder the import refused." }),
    folderDigest: Sha256Hex.annotateKey({ description: "Digest of the refused folder's memory files." }),
  },
  $I.annoteError<ForeignFolderError>("ForeignFolderError", {
    description: "Refusal to import a folder into a log that already holds a different one.",
  })
) {}

/**
 * Refusal to return a node edit that changes how other nodes of its file parse.
 *
 * **Details**
 *
 * `projectNode` runs the reparse check on every edit (decision
 * `projectnode-refuses-a-disturbing-edit-in-p1`). When nodes outside the run
 * the edit touches would change kind or text, it refuses with this error;
 * `disturbed` lists those nodes' indices in the file before the edit. The log
 * stays exact, so `exportFolder` still writes the file's bytes.
 *
 * **Example** (Refuse a disturbing edit)
 *
 * ```ts
 * import { MemoryFilePath, NodeId, ReparseRefusedError } from "@beep/agent-memory-store"
 *
 * const error = ReparseRefusedError.make({
 *   nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
 *   path: MemoryFilePath.make("notes.md"),
 *   disturbed: [2],
 * })
 * console.log(error.disturbed)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReparseRefusedError extends S.TaggedError<ReparseRefusedError, { readonly brand: unique symbol }>(
  $I`ReparseRefusedError`
)(
  "ReparseRefusedError",
  {
    nodeId: NodeId.annotateKey({ description: "Node whose edit was refused." }),
    path: MemoryFilePath.annotateKey({ description: "File the node belongs to." }),
    disturbed: S.Array(S.Natural).annotateKey({
      description: "Indices, in the file before the edit, of the nodes whose parse the edit would change.",
    }),
  },
  $I.annoteError<ReparseRefusedError>("ReparseRefusedError", {
    description: "Refusal to return a node edit that changes how other nodes of its file parse.",
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
