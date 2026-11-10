/**
 * Schemas for the Markdown node partition: the ordered nodes one memory file
 * is cut into, and the reparse check a projector runs before it replaces a
 * node's text.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import { MarkdownRange } from "@beep/markdown";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { NodeKind } from "./NodeIdentity.models.ts";

const $I = $AgentMemoryStoreId.create("MarkdownPartition.models");

/**
 * One node of a memory file partition: its kind, its exact text and its range
 * in the file.
 *
 * **Details**
 *
 * `range` counts UTF-16 code units from the start of the file, the unit
 * `@beep/markdown` `MarkdownRange` and `@beep/provenance` `TextAnchor` use, so
 * `text` is always `fileText.slice(range.offset, range.offset + range.length)`.
 * A partition never puts a boundary between the two halves of a surrogate
 * pair, so each node's text encodes to UTF-8 on its own and the concatenated
 * node bytes equal the file bytes.
 *
 * **Example** (Construct a heading node)
 *
 * ```ts
 * import { PartitionNode } from "@beep/agent-memory-store"
 * import { MarkdownRange } from "@beep/markdown/MarkdownEdit"
 *
 * const node = PartitionNode.make({
 *   kind: "heading",
 *   text: "# Notes",
 *   range: MarkdownRange.make({ offset: 0, length: 7 }),
 * })
 * console.log(node.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PartitionNode extends S.Opaque<PartitionNode, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: NodeKind.annotateKey({ description: "Markdown construct the node is cut from." }),
    text: S.String.annotateKey({ description: "Exact source text of the node, line terminators included." }),
    range: MarkdownRange.annotateKey({
      description: "Zero-based UTF-16 offset and length of the node in the file.",
    }),
  }).pipe(
    $I.annoteSchema("PartitionNode", {
      description: "One node of a memory file partition: kind, exact text and UTF-16 range in the file.",
    })
  )
) {}

/**
 * How much of a file the partition had to cut coarser than the node model.
 *
 * **Details**
 *
 * - `none`: every block was cut at row and list-item granularity.
 * - `block`: at least one top-level block reported positions the partition
 *   could not use for its children, so that block became one node.
 * - `file`: the top-level block positions overlapped, ran backwards or left
 *   the file, so the whole file became one node.
 * - `unparsed`: `@beep/markdown` rejected the file (a hardening guard such as
 *   the nesting-depth cap tripped), so the whole file became one node.
 *
 * **Example** (Check a fallback level)
 *
 * ```ts
 * import { PartitionFallback } from "@beep/agent-memory-store"
 *
 * console.log(PartitionFallback.is.none("none"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PartitionFallback = LiteralKit(["none", "block", "file", "unparsed"]).pipe(
  $I.annoteSchema("PartitionFallback", {
    description: "How much of a file the partition had to cut coarser than the node model.",
  })
);

/**
 * Runtime type for {@link PartitionFallback}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PartitionFallback = typeof PartitionFallback.Type;

/**
 * The ordered node partition of one memory file.
 *
 * **Details**
 *
 * Decision `file-is-an-ordered-node-partition`: every UTF-16 code unit of the
 * file belongs to exactly one node, the nodes are in document order, and the
 * concatenation of their texts equals the file. An empty file has no nodes.
 *
 * **Example** (Read a partition)
 *
 * ```ts
 * import { partition } from "@beep/agent-memory-store"
 *
 * const result = partition("# Notes\n\n- one\n- two\n")
 * console.log(result.nodes.map((node) => node.kind))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkdownPartition extends S.Opaque<MarkdownPartition, { readonly brand: unique symbol }>()(
  S.Struct({
    nodes: S.Array(PartitionNode).annotateKey({ description: "Nodes of the file in document order." }),
    fallback: PartitionFallback.annotateKey({
      description: "How much of the file was cut coarser than the node model.",
    }),
  }).pipe(
    $I.annoteSchema("MarkdownPartition", {
      description: "Ordered node partition of one memory file; the node texts concatenate to the file.",
    })
  )
) {}

/**
 * A proposed replacement of a run of partition nodes by new text.
 *
 * **Details**
 *
 * `start` and `end` are node indices into a {@link MarkdownPartition}, `end`
 * exclusive. Replacing one node is `end = start + 1`; inserting text between
 * two nodes is `end = start`; deleting a node is an empty `text`.
 *
 * **Example** (Propose a one-node replacement)
 *
 * ```ts
 * import { NodeReplacement } from "@beep/agent-memory-store"
 *
 * const replacement = NodeReplacement.make({ start: 2, end: 3, text: "- three" })
 * console.log(replacement.end - replacement.start)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NodeReplacement extends S.Opaque<NodeReplacement, { readonly brand: unique symbol }>()(
  S.Struct({
    start: S.Natural.annotateKey({ description: "Index of the first replaced node." }),
    end: S.Natural.annotateKey({ description: "Index one past the last replaced node." }),
    text: S.String.annotateKey({ description: "Text that takes the place of the replaced nodes." }),
  }).pipe(
    $I.annoteSchema("NodeReplacement", {
      description: "Proposed replacement of the partition nodes [start, end) by new text.",
    })
  )
) {}

/**
 * Result of re-partitioning a file after a proposed node replacement.
 *
 * **Details**
 *
 * The check compares each node outside the replaced run by kind and text with
 * the node at the same place in the re-partitioned file.
 *
 * - `stable` holds when every node outside the run kept its kind and text, so
 *   the replacement cannot change how any other byte of the file parses.
 * - `disturbed` lists the original node indices outside the run whose kind or
 *   text changed (empty when `stable`).
 * - `region` holds the re-partitioned nodes that cover the replacement text
 *   and every disturbed node; when `stable` its texts concatenate to the
 *   replacement text.
 * - `edited` is the full partition of the edited file.
 *
 * **Gotchas**
 *
 * The comparison is by kind and text, not by nesting. Deleting a list item's
 * first line can re-parent its indented continuation under the previous item
 * while every remaining node keeps its text and kind; that reports `stable`.
 *
 * **Example** (Read a reparse check)
 *
 * ```ts
 * import { NodeReplacement, checkReplacement, partition } from "@beep/agent-memory-store"
 * import * as Result from "effect/Result"
 *
 * const base = partition("- one\n- two\n")
 * const check = checkReplacement(base, NodeReplacement.make({ start: 0, end: 1, text: "- uno" }))
 * console.log(Result.map(check, (value) => value.stable))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReparseCheck extends S.Opaque<ReparseCheck, { readonly brand: unique symbol }>()(
  S.Struct({
    stable: S.Boolean.annotateKey({
      description: "Whether every node outside the replaced run kept its kind and text.",
    }),
    disturbed: S.Array(S.Natural).annotateKey({
      description: "Original indices of nodes outside the run whose kind or text changed.",
    }),
    region: S.Array(PartitionNode).annotateKey({
      description: "Re-partitioned nodes covering the replacement text and every disturbed node.",
    }),
    edited: MarkdownPartition.annotateKey({ description: "Partition of the edited file." }),
  }).pipe(
    $I.annoteSchema("ReparseCheck", {
      description: "Result of re-partitioning a file after a proposed node replacement.",
    })
  )
) {}
