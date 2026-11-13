/**
 * The pure apply helper of op capture: replays a batch of node operations on
 * the node lists of an exported base.
 *
 * **Details**
 *
 * It is the reference semantics capture is tested against, not admission: a
 * `replace` swaps a node's text, an `insert` places its node right after its
 * predecessor (or at the top of its file), and a `delete` removes the node.
 * Placing right after the predecessor matches the log's ordering rule, where
 * nodes naming one predecessor order newest first (decision
 * `file-is-an-ordered-node-partition`). Revisions are compared, never
 * computed: a node the batch already replaced has no revision left to match.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { baseText } from "./internal/OperationCapture.align.ts";
import { NodeOperation } from "./Operation.models.ts";
import { OperationApplyError } from "./OperationCapture.errors.ts";
import { AppliedFile, AppliedNode } from "./OperationCapture.models.ts";
import type { MemoryFilePath, NodeId, RevisionId } from "./NodeIdentity.models.ts";
import type { BaseExport } from "./Operation.models.ts";
import type { ApplyRefusal } from "./OperationCapture.models.ts";

// A live node of the working state; `revision` is none once the batch
// replaced the node or when the batch inserted it.
interface WorkNode {
  readonly nodeId: NodeId;
  revision: O.Option<RevisionId>;
  text: string;
}

// Where a live node sits: its node and the node list of its file.
interface Placed {
  readonly list: Array<WorkNode>;
  readonly node: WorkNode;
  readonly path: MemoryFilePath;
}

interface Working {
  readonly files: MutableHashMap.MutableHashMap<MemoryFilePath, Array<WorkNode>>;
  readonly live: MutableHashMap.MutableHashMap<NodeId, Placed>;
  readonly order: Array<readonly [MemoryFilePath, Array<WorkNode>]>;
  readonly seen: MutableHashSet.MutableHashSet<NodeId>;
}

const refuse = (nodeId: NodeId, reason: ApplyRefusal): O.Option<OperationApplyError> =>
  O.some(OperationApplyError.make({ nodeId, reason }));

const ok: O.Option<OperationApplyError> = O.none();

const workingOf = (base: BaseExport): Working => {
  const working: Working = {
    files: MutableHashMap.empty(),
    live: MutableHashMap.empty(),
    order: [],
    seen: MutableHashSet.empty(),
  };
  for (const file of base.files) {
    const list: Array<WorkNode> = A.map(file.nodes, (node) => ({
      nodeId: node.nodeId,
      revision: O.some(node.revisionId),
      text: baseText(node),
    }));
    MutableHashMap.set(working.files, file.path, list);
    working.order.push([file.path, list]);
    for (const node of list) {
      MutableHashMap.set(working.live, node.nodeId, { list, node, path: file.path });
      MutableHashSet.add(working.seen, node.nodeId);
    }
  }
  return working;
};

// Runs `change` on the live node `nodeId` when it still has `expected`.
const withLive = (
  working: Working,
  nodeId: NodeId,
  expected: RevisionId,
  change: (placed: Placed) => void
): O.Option<OperationApplyError> =>
  O.match(MutableHashMap.get(working.live, nodeId), {
    onNone: () => refuse(nodeId, "unknownNode"),
    onSome: (placed) => {
      if (!O.contains(placed.node.revision, expected)) {
        return refuse(nodeId, "staleRevision");
      }
      change(placed);
      return ok;
    },
  });

const fileList = (working: Working, path: MemoryFilePath): Array<WorkNode> =>
  O.getOrElse(MutableHashMap.get(working.files, path), () => {
    const list: Array<WorkNode> = [];
    MutableHashMap.set(working.files, path, list);
    working.order.push([path, list]);
    return list;
  });

const place = (working: Working, path: MemoryFilePath, list: Array<WorkNode>, index: number, node: WorkNode) => {
  list.splice(index, 0, node);
  MutableHashMap.set(working.live, node.nodeId, { list, node, path });
  MutableHashSet.add(working.seen, node.nodeId);
  return ok;
};

// Places `node` right after the live node `predecessor` of the same file.
const placeAfter = (
  working: Working,
  path: MemoryFilePath,
  predecessor: NodeId,
  node: WorkNode
): O.Option<OperationApplyError> =>
  O.match(MutableHashMap.get(working.live, predecessor), {
    onNone: () => refuse(node.nodeId, "predecessorMissing"),
    onSome: (placed) =>
      placed.path === path
        ? place(working, path, placed.list, placed.list.indexOf(placed.node) + 1, node)
        : refuse(node.nodeId, "predecessorInOtherFile"),
  });

const applyOne = (working: Working): ((operation: NodeOperation) => O.Option<OperationApplyError>) =>
  NodeOperation.match({
    replace: ({ nodeId, expectedRevision, text }) =>
      withLive(working, nodeId, expectedRevision, ({ node }) => {
        node.text = text;
        node.revision = O.none();
      }),
    delete: ({ nodeId, expectedRevision }) =>
      withLive(working, nodeId, expectedRevision, ({ list, node }) => {
        list.splice(list.indexOf(node), 1);
        MutableHashMap.remove(working.live, nodeId);
      }),
    insert: ({ nodeId, afterNodeId, filePath, text }) => {
      if (MutableHashSet.has(working.seen, nodeId)) {
        return refuse(nodeId, "nodeIdAlreadyExists");
      }
      const node: WorkNode = { nodeId, revision: O.none(), text };
      return O.match(afterNodeId, {
        onNone: () => place(working, filePath, fileList(working, filePath), 0, node),
        onSome: (predecessor) => placeAfter(working, filePath, predecessor, node),
      });
    },
    setStatus: ({ nodeId }) => refuse(nodeId, "unsupportedOperation"),
  });

/**
 * Applies node operations, in order, to the node lists of an exported base.
 *
 * **Details**
 *
 * Returns every file of the base in base order, then every file the batch
 * opened in the order it opened them, each with its live nodes and their
 * concatenated text. A file whose nodes were all deleted stays, empty. The
 * first operation that does not fit the working state fails the whole apply
 * with an `OperationApplyError`.
 *
 * **Example** (Replay a captured batch)
 *
 * ```ts
 * import { applyOperations, captureBatch, FileEdit, LineageId, seededNodeIdMinter } from "@beep/agent-memory-store"
 * import type { BaseExport } from "@beep/agent-memory-store"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 *
 * const replay = (base: BaseExport) =>
 *   Result.flatMap(
 *     captureBatch(
 *       base,
 *       [FileEdit.cases.edited.make({ path: "notes/a.md", text: "- one\n" })],
 *       LineageId.make("session-42"),
 *       seededNodeIdMinter(1)
 *     ),
 *     (captured) => applyOperations(base, O.match(captured, { onNone: () => [], onSome: (value) => value.operations }))
 *   )
 * console.log(replay)
 * ```
 *
 * @param base - The exported base the operations were written against.
 * @param operations - The operations in submission order.
 * @returns The files after the operations, or the first refusal.
 * @category utilities
 * @since 0.0.0
 */
export const applyOperations: {
  (
    operations: ReadonlyArray<NodeOperation>
  ): (base: BaseExport) => Result.Result<ReadonlyArray<AppliedFile>, OperationApplyError>;
  (
    base: BaseExport,
    operations: ReadonlyArray<NodeOperation>
  ): Result.Result<ReadonlyArray<AppliedFile>, OperationApplyError>;
} = dual(
  2,
  (
    base: BaseExport,
    operations: ReadonlyArray<NodeOperation>
  ): Result.Result<ReadonlyArray<AppliedFile>, OperationApplyError> => {
    const working = workingOf(base);
    const apply = applyOne(working);
    for (const operation of operations) {
      const refusal = apply(operation);
      if (O.isSome(refusal)) {
        return Result.fail(refusal.value);
      }
    }
    return Result.succeed(
      A.map(working.order, ([path, list]) =>
        AppliedFile.make({
          path,
          nodes: A.map(list, (node) => AppliedNode.make({ nodeId: node.nodeId, text: node.text })),
          text: A.join(
            A.map(list, (node) => node.text),
            ""
          ),
        })
      )
    );
  }
);
