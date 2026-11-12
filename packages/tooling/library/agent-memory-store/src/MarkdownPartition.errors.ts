/**
 * Typed errors of the Markdown node partition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $AgentMemoryStoreId.create("MarkdownPartition.errors");

/**
 * A node replacement names a run outside the partition it is checked against.
 *
 * **Details**
 *
 * Raised by `checkReplacement` when `start > end` or `end` is past the last
 * node. The partition itself is total and never fails.
 *
 * **Example** (Describe an out-of-range replacement)
 *
 * ```ts
 * import { NodeReplacementOutOfRangeError } from "@beep/agent-memory-store"
 *
 * const error = NodeReplacementOutOfRangeError.make({ start: 4, end: 5, nodeCount: 3 })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class NodeReplacementOutOfRangeError extends S.TaggedError<
  NodeReplacementOutOfRangeError,
  { readonly brand: unique symbol }
>($I`NodeReplacementOutOfRangeError`)(
  "NodeReplacementOutOfRangeError",
  {
    start: S.Natural.annotateKey({ description: "Index of the first node the replacement named." }),
    end: S.Natural.annotateKey({ description: "Exclusive end index the replacement named." }),
    nodeCount: S.Natural.annotateKey({ description: "Number of nodes in the checked partition." }),
  },
  $I.annoteError<NodeReplacementOutOfRangeError>("NodeReplacementOutOfRangeError", {
    description: "A node replacement names a run outside the partition it is checked against.",
  })
) {
  /**
   * Describes the rejected run and the partition size.
   *
   * **Example** (Read the failure message)
   *
   * ```ts
   * import { NodeReplacementOutOfRangeError } from "@beep/agent-memory-store"
   *
   * console.log(NodeReplacementOutOfRangeError.make({ start: 2, end: 1, nodeCount: 3 }).message)
   * ```
   *
   * @returns The human-readable failure message.
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `Node replacement [${this.start}, ${this.end}) is outside a partition of ${this.nodeCount} nodes`;
  }
}
