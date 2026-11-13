/**
 * Schemas for op capture: the file edits an agent hands in against an
 * exported base, the refusal vocabularies of capture and of the apply helper,
 * and the node lists the apply helper returns.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { isWellFormedText, MemoryFilePath, NodeId } from "./NodeIdentity.models.ts";

const $I = $AgentMemoryStoreId.create("OperationCapture.models");

const FileEditKind = LiteralKit(["edited", "created", "removed"]).pipe(
  $I.annoteSchema("FileEditKind", {
    description: "Internal literal vocabulary used to build FileEdit.",
  })
);

/**
 * One memory file as the agent left it, discriminated on `edit`.
 *
 * **Details**
 *
 * - `edited`: a file of the base, with its whole new text. An empty text
 *   retires every node of the file.
 * - `created`: a file the base does not have, with its whole nonempty text.
 *   An empty created file has no node to record, so capture refuses it with
 *   `emptyCreatedFile` rather than dropping it.
 * - `removed`: a file of the base the agent deleted; capture retires every
 *   node of it, the same batch an empty `edited` text produces. The log keeps
 *   no file-level removal in P2, so the file survives as an empty file: the
 *   next export writes it with no bytes and lists it in the next base, where
 *   it is written again with `edited`, never `created` (decision
 *   `op-capture-refuses-an-empty-created-file-and-a-removed-file-stays-empty`).
 *
 * `path` is a plain string so capture can refuse a path outside the memory
 * file rule with a typed error instead of a decode failure.
 *
 * **Example** (Describe an edited file)
 *
 * ```ts
 * import { FileEdit } from "@beep/agent-memory-store"
 *
 * const edit = FileEdit.cases.edited.make({ path: "notes/decisions.md", text: "# Decisions\n" })
 * console.log(edit.edit)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileEdit = FileEditKind.toTaggedUnion("edit")({
  edited: {
    path: S.String.annotateKey({ description: "Path of a base file, relative to the memory folder." }),
    text: S.String.check(isWellFormedText).annotateKey({ description: "The whole edited text of the file." }),
  },
  created: {
    path: S.String.annotateKey({ description: "Path of a file the base does not have." }),
    text: S.String.check(isWellFormedText).annotateKey({ description: "The whole text of the new file." }),
  },
  removed: {
    path: S.String.annotateKey({ description: "Path of a base file the agent deleted." }),
  },
}).pipe(
  $I.annoteSchema("FileEdit", {
    description: "One memory file as the agent left it, discriminated on edit.",
  })
);

/**
 * Runtime type for {@link FileEdit}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FileEdit = typeof FileEdit.Type;

/**
 * Why capture refused a file edit.
 *
 * **Details**
 *
 * - `pathOutsideMemoryFiles`: the path breaks the memory file rule
 *   (`MemoryFilePath`).
 * - `unknownBaseFile`: an `edited` or `removed` file the base does not have;
 *   a new file must be declared `created`.
 * - `baseFileExists`: a `created` file the base already has, including one
 *   a `removed` edit emptied.
 * - `emptyCreatedFile`: a `created` file with an empty text, which holds no
 *   node to record.
 * - `duplicateEdit`: two edits name the same path.
 *
 * **Example** (Check an edit refusal)
 *
 * ```ts
 * import { CaptureEditRefusal } from "@beep/agent-memory-store"
 *
 * console.log(CaptureEditRefusal.is.unknownBaseFile("unknownBaseFile"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CaptureEditRefusal = LiteralKit([
  "pathOutsideMemoryFiles",
  "unknownBaseFile",
  "baseFileExists",
  "emptyCreatedFile",
  "duplicateEdit",
]).pipe(
  $I.annoteSchema("CaptureEditRefusal", {
    description: "Why op capture refused a file edit.",
  })
);

/**
 * Runtime type for {@link CaptureEditRefusal}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CaptureEditRefusal = typeof CaptureEditRefusal.Type;

/**
 * Why capture refused the exported base.
 *
 * **Details**
 *
 * - `duplicateFile`: the base lists one path twice.
 * - `duplicateNodeId`: the base lists one node id twice.
 * - `anchorOutOfSequence`: a node's anchor does not start where the previous
 *   node ended, or its width is not its quote's length, so the node texts do
 *   not tile the file.
 * - `digestMismatch`: the node texts of a file do not hash to its recorded
 *   `fileDigest` (checked by the verified capture only).
 *
 * **Example** (Check a base refusal)
 *
 * ```ts
 * import { CaptureBaseRefusal } from "@beep/agent-memory-store"
 *
 * console.log(CaptureBaseRefusal.is.digestMismatch("digestMismatch"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CaptureBaseRefusal = LiteralKit([
  "duplicateFile",
  "duplicateNodeId",
  "anchorOutOfSequence",
  "digestMismatch",
]).pipe(
  $I.annoteSchema("CaptureBaseRefusal", {
    description: "Why op capture refused the exported base.",
  })
);

/**
 * Runtime type for {@link CaptureBaseRefusal}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CaptureBaseRefusal = typeof CaptureBaseRefusal.Type;

/**
 * Why the apply helper refused an operation.
 *
 * **Details**
 *
 * - `unknownNode`: a replace or delete names a node that is not live.
 * - `staleRevision`: a replace or delete names a revision other than the
 *   node's base revision (a node already replaced in the batch has none).
 * - `nodeIdAlreadyExists`: an insert reuses an id of the base or of the batch.
 * - `predecessorMissing`: an insert follows a node that is not live.
 * - `predecessorInOtherFile`: an insert follows a node of another file.
 * - `unsupportedOperation`: a `setStatus`, which capture never emits.
 *
 * **Example** (Check an apply refusal)
 *
 * ```ts
 * import { ApplyRefusal } from "@beep/agent-memory-store"
 *
 * console.log(ApplyRefusal.is.staleRevision("staleRevision"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ApplyRefusal = LiteralKit([
  "unknownNode",
  "staleRevision",
  "nodeIdAlreadyExists",
  "predecessorMissing",
  "predecessorInOtherFile",
  "unsupportedOperation",
]).pipe(
  $I.annoteSchema("ApplyRefusal", {
    description: "Why the op capture apply helper refused an operation.",
  })
);

/**
 * Runtime type for {@link ApplyRefusal}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ApplyRefusal = typeof ApplyRefusal.Type;

/**
 * One node of a file after a batch is applied to its base.
 *
 * **Example** (Construct an applied node)
 *
 * ```ts
 * import { AppliedNode, NodeId } from "@beep/agent-memory-store"
 *
 * const node = AppliedNode.make({ nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"), text: "- one" })
 * console.log(node.text)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppliedNode extends S.Opaque<AppliedNode, { readonly brand: unique symbol }>()(
  S.Struct({
    nodeId: NodeId.annotateKey({ description: "The node, from the base or minted by capture." }),
    text: S.String.annotateKey({ description: "The node's text after the batch." }),
  }).pipe(
    $I.annoteSchema("AppliedNode", {
      description: "One node of a file after a batch is applied to its base.",
    })
  )
) {}

/**
 * One file after a batch is applied to its base: its live nodes in document
 * order and their concatenated text.
 *
 * **Example** (Construct an applied file)
 *
 * ```ts
 * import { AppliedFile, MemoryFilePath } from "@beep/agent-memory-store"
 *
 * const file = AppliedFile.make({ path: MemoryFilePath.make("notes/empty.md"), nodes: [], text: "" })
 * console.log(file.text.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppliedFile extends S.Opaque<AppliedFile, { readonly brand: unique symbol }>()(
  S.Struct({
    path: MemoryFilePath.annotateKey({ description: "File path relative to the memory folder." }),
    nodes: S.Array(AppliedNode).annotateKey({ description: "Live nodes of the file in document order." }),
    text: S.String.annotateKey({ description: "Concatenation of the live node texts." }),
  }).pipe(
    $I.annoteSchema("AppliedFile", {
      description: "One file after a batch is applied to its base.",
    })
  )
) {}
