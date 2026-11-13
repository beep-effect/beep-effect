/**
 * Typed status fields in op capture: a captured `replace` that only swaps a
 * node's status token becomes a `setStatus` operation.
 *
 * **Details**
 *
 * Text capture ({@link captureBatch}) sees a status cell edit as a `replace`
 * of the whole row, and admission judges a replace by the three-way text
 * merge, so two concurrent status moves on one row would be held. Typed
 * status fields leave the held path instead (S14b, decision
 * `typed-status-fields-are-whole-token-values`), so the capture step submits
 * the edit as a `setStatus` that admission judges against the log head with
 * the lifecycle guard (decision `op-capture-types-a-status-token-swap`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import { NodeOperation, OperationBatch } from "./Operation.models.ts";
import { statusMoveBetween } from "./StatusField.models.ts";
import type { NodeId } from "./NodeIdentity.models.ts";
import type { StatusFields } from "./StatusField.models.ts";

// The exported text of every node of the base, by node id.
const baseTexts = (batch: OperationBatch): MutableHashMap.MutableHashMap<NodeId, string> =>
  MutableHashMap.fromIterable(
    A.flatMap(batch.base.files, (file) => A.map(file.nodes, (node) => [node.nodeId, node.anchor.anchor.quote] as const))
  );

// The operation as submitted: a replace that is a move of exactly one status
// field becomes that move; every other operation is unchanged.
const typed =
  (statusFields: StatusFields, texts: MutableHashMap.MutableHashMap<NodeId, string>) =>
  (operation: NodeOperation): NodeOperation =>
    NodeOperation.match(operation, {
      replace: (replace) => {
        const moves = O.match(MutableHashMap.get(texts, replace.nodeId), {
          onNone: () => [],
          onSome: (before) =>
            A.getSomes(
              A.map(statusFields.lifecycles, (lifecycle) => statusMoveBetween(lifecycle, before, replace.text))
            ),
        });
        return O.match(moves.length === 1 ? A.head(moves) : O.none(), {
          onNone: () => replace,
          onSome: (transition) =>
            NodeOperation.cases.setStatus.make({
              nodeId: replace.nodeId,
              expectedRevision: replace.expectedRevision,
              transition,
            }),
        });
      },
      insert: (insert) => insert,
      delete: (remove) => remove,
      setStatus: (setStatus) => setStatus,
    });

/**
 * Rewrites each captured `replace` that only swaps a status token into the
 * `setStatus` operation it stands for.
 *
 * **Details**
 *
 * A replace becomes a status move when its base text (the text the batch's
 * base exported for the node) and its new text differ in exactly one whole
 * token, the base text holds that token as its one value of a lifecycle, and
 * exactly one of `statusFields` reads it so (`statusMoveBetween`). The move
 * names the replace's node and expected revision. The new token may lie
 * outside the lifecycle: admission then refuses it with
 * `statusOutsideLifecycle`. Every other operation, and every replace that
 * changes more than the token, is left as it is, so the batch still applies
 * to exactly the edited bytes when every status move lands.
 *
 * **Example** (Type a status cell edit)
 *
 * ```ts
 * import { StatusFields, typeStatusMoves } from "@beep/agent-memory-store"
 * import type { OperationBatch } from "@beep/agent-memory-store"
 *
 * const typedBatch = (batch: OperationBatch) => typeStatusMoves(batch, StatusFields.make({ lifecycles: [] }))
 * console.log(typedBatch)
 * ```
 *
 * @param batch - A captured operation batch.
 * @param statusFields - The status lifecycles admission applies.
 * @returns The batch with each status token swap submitted as a `setStatus`.
 * @category utilities
 * @since 0.0.0
 */
export const typeStatusMoves: {
  (statusFields: StatusFields): (batch: OperationBatch) => OperationBatch;
  (batch: OperationBatch, statusFields: StatusFields): OperationBatch;
} = dual(
  2,
  (batch: OperationBatch, statusFields: StatusFields): OperationBatch =>
    OperationBatch.make({
      base: batch.base,
      operations: A.map(batch.operations, typed(statusFields, baseTexts(batch))),
      author: batch.author,
    })
);
