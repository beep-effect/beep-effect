/**
 * The node alignment behind op capture: lines the base nodes of one file up
 * with the partition of its edited text and says, node by node, what changed.
 *
 * **Details**
 *
 * The alignment is `effect/TextDiff`'s minimal edit script (Myers, prefix and
 * suffix trimmed) over the node sequences, two nodes being equal when their
 * texts are equal and their kinds agree. Each changed region between two kept
 * nodes is a run of `k` base nodes replaced by `j` edited nodes:
 *
 * - `k = j`: the nodes pair by position. A pair whose kinds agree is a
 *   revision; a pair whose kinds differ (or whose base kind is unknown) is a
 *   retirement and an insert, because a revision keeps the node's kind.
 * - `k != j`: nothing pairs; every base node of the run is retired and every
 *   edited node is inserted. Position cannot say which base node an edited
 *   node continues, and similarity matching is P3's identity tier.
 *
 * A base node's kind is known when the partition of the base file text cuts
 * exactly the base nodes; otherwise the file's base kinds are unknown and
 * kept nodes are matched by text alone.
 *
 * @internal
 */

import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as TextDiff from "effect/TextDiff";
import { partition } from "../MarkdownPartition.parser.ts";
import type { PartitionNode } from "../MarkdownPartition.models.ts";
import type { NodeKind } from "../NodeIdentity.models.ts";
import type { BaseNode } from "../Operation.models.ts";

/** One step of an alignment, in edited document order. */
export type AlignStep =
  | { readonly _tag: "Keep"; readonly base: BaseNode }
  | { readonly _tag: "Revise"; readonly base: BaseNode; readonly edited: PartitionNode }
  | { readonly _tag: "Retire"; readonly base: BaseNode }
  | { readonly _tag: "Insert"; readonly edited: PartitionNode };

// What the diff compares: a node's kind (unknown for a base node of a file
// whose partition does not cut the base nodes) and its exact text.
interface Item {
  readonly kind: O.Option<NodeKind>;
  readonly text: string;
}

interface BaseItem extends Item {
  readonly node: BaseNode;
}

/** The exact text a base node showed at export. */
export const baseText = (node: BaseNode): string => node.anchor.anchor.quote;

/** The concatenated text of a base file's nodes. */
export const joinBaseTexts = (nodes: ReadonlyArray<BaseNode>): string => A.join(A.map(nodes, baseText), "");

// A base kind that is unknown agrees with any edited kind when matching kept
// nodes by text.
const kindsAgree = (base: O.Option<NodeKind>, edited: O.Option<NodeKind>): boolean =>
  O.match(base, { onNone: () => true, onSome: (kind) => O.contains(edited, kind) });

const diffNodes = TextDiff.diffWith<Item>(
  (base, edited) => base.text === edited.text && kindsAgree(base.kind, edited.kind)
);

/** The kind of each base node: known when the base text partitions into exactly these nodes. */
export const baseKinds = (nodes: ReadonlyArray<BaseNode>): ReadonlyArray<O.Option<NodeKind>> => {
  const parts = partition(joinBaseTexts(nodes)).nodes;
  const cutsBase =
    parts.length === nodes.length && A.every(A.zip(parts, nodes), ([part, node]) => part.text === baseText(node));
  return cutsBase ? A.map(parts, (part) => O.some(part.kind)) : A.map(nodes, () => O.none());
};

const retire = (item: BaseItem): AlignStep => ({ _tag: "Retire", base: item.node });

const insert = (edited: PartitionNode): AlignStep => ({ _tag: "Insert", edited });

const pair = ([item, edited]: readonly [BaseItem, PartitionNode]): ReadonlyArray<AlignStep> =>
  O.contains(item.kind, edited.kind) ? [{ _tag: "Revise", base: item.node, edited }] : [retire(item), insert(edited)];

// One changed region: base run replaced by edited run.
const changeSteps = (
  baseRun: ReadonlyArray<BaseItem>,
  editedRun: ReadonlyArray<PartitionNode>
): ReadonlyArray<AlignStep> =>
  baseRun.length === editedRun.length
    ? A.flatMap(A.zip(baseRun, editedRun), pair)
    : [...A.map(baseRun, retire), ...A.map(editedRun, insert)];

/**
 * Aligns a file's base nodes with the partition of its edited text.
 *
 * Kept, revised and inserted steps follow the edited document order, so the
 * texts of the steps other than retirements concatenate to `editedText`.
 */
export const alignFile: {
  (editedText: string): (nodes: ReadonlyArray<BaseNode>) => ReadonlyArray<AlignStep>;
  (nodes: ReadonlyArray<BaseNode>, editedText: string): ReadonlyArray<AlignStep>;
} = dual(2, (nodes: ReadonlyArray<BaseNode>, editedText: string): ReadonlyArray<AlignStep> => {
  const before: ReadonlyArray<BaseItem> = A.zipWith(nodes, baseKinds(nodes), (node, kind) => ({
    node,
    text: baseText(node),
    kind,
  }));
  const edited = partition(editedText).nodes;
  const after: ReadonlyArray<Item> = A.map(edited, (node) => ({ kind: O.some(node.kind), text: node.text }));
  const steps: Array<AlignStep> = [];
  let baseIndex = 0;
  let editedIndex = 0;
  let pending: ReadonlyArray<BaseItem> = [];
  const flush = (editedRun: ReadonlyArray<PartitionNode>): void => {
    steps.push(...changeSteps(pending, editedRun));
    pending = [];
  };
  for (const edit of diffNodes(before, after)) {
    const count = edit.items.length;
    Match.valueTags(edit, {
      Equal: () => {
        flush([]);
        for (const item of before.slice(baseIndex, baseIndex + count)) {
          steps.push({ _tag: "Keep", base: item.node });
        }
        baseIndex += count;
        editedIndex += count;
      },
      Delete: () => {
        pending = before.slice(baseIndex, baseIndex + count);
        baseIndex += count;
      },
      Insert: () => {
        flush(edited.slice(editedIndex, editedIndex + count));
        editedIndex += count;
      },
    });
  }
  flush([]);
  return steps;
});
