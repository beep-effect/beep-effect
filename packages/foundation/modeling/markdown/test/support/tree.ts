import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import type { MdxjsEsm } from "@beep/markdown/MarkdownMdx";
import type { FlowContent, Frontmatter } from "@beep/markdown/MarkdownNode";

interface Typed {
  readonly type: string;
}

const hasType = <N extends Typed, T extends N["type"]>(node: N, type: T): node is Extract<N, { readonly type: T }> =>
  node.type === type;

/** The child at `index`, asserted to exist and to be a `type` node. */
export const childOfType: {
  <N extends Typed, T extends N["type"]>(
    children: ReadonlyArray<N>,
    index: number,
    type: T
  ): Extract<N, { readonly type: T }>;
  <N extends Typed, T extends N["type"]>(
    index: number,
    type: T
  ): (children: ReadonlyArray<N>) => Extract<N, { readonly type: T }>;
} = dual(
  3,
  <N extends Typed, T extends N["type"]>(
    children: ReadonlyArray<N>,
    index: number,
    type: T
  ): Extract<N, { readonly type: T }> => {
    const node = children[index];
    if (node === undefined) return assert.fail(`expected a ${type} at index ${index}, found nothing`);
    if (!hasType(node, type)) return assert.fail(`expected a ${type} at index ${index}, found a ${node.type}`);
    return node;
  }
);

/** A top-level child of a document: flow content, or a head node the parser or a builder put first. */
export type DocumentChild = Frontmatter | MdxjsEsm | FlowContent;

const nestedFlow = (node: FlowContent): ReadonlyArray<DocumentChild> => {
  if (node.type === "blockquote" || node.type === "footnoteDefinition") return node.children;
  return node.type === "list" ? A.flatMap(node.children, (item) => item.children) : [];
};

/**
 * Every flow node under `children`, in document order, however deeply nested
 * in block quotes, lists and footnote definitions. Frontmatter and MDX ESM
 * heads are metadata, not flow content, and are skipped.
 */
export const flowNodes = (children: ReadonlyArray<DocumentChild>): ReadonlyArray<FlowContent> =>
  A.flatMap(children, (node) =>
    node.type === "frontmatter" || node.type === "mdxjsEsm" ? [] : A.prepend(flowNodes(nestedFlow(node)), node)
  );
