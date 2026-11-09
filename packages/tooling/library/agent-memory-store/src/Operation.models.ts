/**
 * Agent write capture: the exported base an agent edited against and the
 * per-node operations it submits for store-side admission.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { MemoryFilePath, NodeId, NodeKind, RevisionId } from "./NodeIdentity.models.ts";
import { OccurrenceAnchor } from "./SpanAnchor.models.ts";
import { StatusTransition } from "./StatusLifecycle.models.ts";

const $I = $AgentMemoryStoreId.create("Operation.models");

/**
 * One node as it appeared in an exported memory file.
 *
 * **Example** (Read the fields of an exported node)
 *
 * ```ts
 * import { BaseNode } from "@beep/agent-memory-store"
 *
 * console.log(BaseNode.fields.revisionId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BaseNode extends S.Opaque<BaseNode, { readonly brand: unique symbol }>()(
  S.Struct({
    nodeId: NodeId.annotateKey({ description: "Node identity at export time." }),
    revisionId: RevisionId.annotateKey({ description: "Node revision the export showed." }),
    anchor: OccurrenceAnchor.annotateKey({ description: "Exact span of the node in the exported file." }),
  }).pipe(
    $I.annoteSchema("BaseNode", {
      description: "One node as it appeared in an exported memory file.",
    })
  )
) {}

/**
 * One exported memory file with its digest and nodes.
 *
 * **Example** (Construct an empty exported file)
 *
 * ```ts
 * import { BaseFile, MemoryFilePath } from "@beep/agent-memory-store"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const file = BaseFile.make({
 *   path: MemoryFilePath.make("notes/empty.md"),
 *   fileDigest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   nodes: [],
 * })
 * console.log(file.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BaseFile extends S.Opaque<BaseFile, { readonly brand: unique symbol }>()(
  S.Struct({
    path: MemoryFilePath.annotateKey({ description: "File path relative to the memory folder." }),
    fileDigest: Sha256Hex.annotateKey({ description: "SHA-256 of the exported file bytes." }),
    nodes: S.Array(BaseNode).annotateKey({ description: "Nodes of the file in document order." }),
  }).pipe(
    $I.annoteSchema("BaseFile", {
      description: "One exported memory file with its digest and nodes.",
    })
  )
) {}

/**
 * The exported base an agent edited against.
 *
 * **Details**
 *
 * Admission compares each operation's expected revision with the log, so the
 * base records the folder digest, every file's nodes and the log frontier at
 * export time.
 *
 * **Example** (Construct an empty base export)
 *
 * ```ts
 * import { BaseExport } from "@beep/agent-memory-store"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const base = BaseExport.make({
 *   folderDigest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   files: [],
 *   frontier: [],
 * })
 * console.log(base.files.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BaseExport extends S.Opaque<BaseExport, { readonly brand: unique symbol }>()(
  S.Struct({
    folderDigest: Sha256Hex.annotateKey({ description: "SHA-256 over the exported folder." }),
    files: S.Array(BaseFile).annotateKey({ description: "Exported files with their nodes." }),
    frontier: S.Array(RevisionId).annotateKey({ description: "Log frontier revisions at export time." }),
  }).pipe(
    $I.annoteSchema("BaseExport", {
      description: "The exported base an agent edited against.",
    })
  )
) {}

const NodeOperationKind = LiteralKit(["replace", "insert", "delete", "setStatus"]).pipe(
  $I.annoteSchema("NodeOperationKind", {
    description: "Internal literal vocabulary used to build NodeOperation.",
  })
);

/**
 * One per-node write submitted by an agent, discriminated on `op`.
 *
 * **Details**
 *
 * `replace`, `delete` and `setStatus` carry the revision the agent saw; the
 * store admits them only when it still matches (per-node compare-and-set).
 * `insert` places a new node after `afterNodeId`, or at the top of the file
 * when it is absent.
 *
 * **Example** (Decode a replace operation)
 *
 * ```ts
 * import { NodeOperation } from "@beep/agent-memory-store"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(NodeOperation)({
 *   op: "replace",
 *   nodeId: "018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f",
 *   expectedRevision: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
 *   text: "Updated paragraph.",
 * }).pipe(Effect.map((operation) => operation.op))
 * console.log(program)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NodeOperation = NodeOperationKind.toTaggedUnion("op")({
  replace: {
    nodeId: NodeId.annotateKey({ description: "Node to replace." }),
    expectedRevision: RevisionId.annotateKey({ description: "Revision the agent edited against." }),
    text: S.NonEmptyString.annotateKey({ description: "Replacement node text." }),
  },
  insert: {
    afterNodeId: S.OptionFromOptionalKey(NodeId).annotateKey({
      description: "Node the new node follows; absent inserts at the top of the file.",
    }),
    filePath: MemoryFilePath.annotateKey({ description: "File the new node belongs to." }),
    kind: NodeKind.annotateKey({ description: "Markdown construct of the new node." }),
    text: S.NonEmptyString.annotateKey({ description: "Text of the new node." }),
  },
  delete: {
    nodeId: NodeId.annotateKey({ description: "Node to retire." }),
    expectedRevision: RevisionId.annotateKey({ description: "Revision the agent edited against." }),
  },
  setStatus: {
    nodeId: NodeId.annotateKey({ description: "Node holding the status field." }),
    expectedRevision: RevisionId.annotateKey({ description: "Revision the agent edited against." }),
    transition: StatusTransition.annotateKey({ description: "Requested status change." }),
  },
}).pipe(
  $I.annoteSchema("NodeOperation", {
    description: "One per-node write submitted by an agent, discriminated on op.",
  })
);

/**
 * Runtime type for {@link NodeOperation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NodeOperation = typeof NodeOperation.Type;

/**
 * A batch of node operations written against one exported base.
 *
 * **Example** (Read the fields of an operation batch)
 *
 * ```ts
 * import { OperationBatch } from "@beep/agent-memory-store"
 *
 * console.log(OperationBatch.fields.author)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OperationBatch extends S.Opaque<OperationBatch, { readonly brand: unique symbol }>()(
  S.Struct({
    base: BaseExport.annotateKey({ description: "Exported base the operations were written against." }),
    operations: S.NonEmptyArray(NodeOperation).annotateKey({ description: "Node operations in submission order." }),
    author: S.NonEmptyString.annotateKey({ description: "Agent or session that wrote the batch." }),
  }).pipe(
    $I.annoteSchema("OperationBatch", {
      description: "A batch of node operations written against one exported base.",
    })
  )
) {}
