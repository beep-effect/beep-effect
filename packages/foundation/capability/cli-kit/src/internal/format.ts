import { $CliKitId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";

const $I = $CliKitId.create("internal/format");

/**
 * Core's structured formatter, with one phrasing override.
 *
 * **Details**
 *
 * Built once: it is a pure function of the issue tree and carries no state.
 *
 * Core renders an excess property as `"Expected no excess property"`, which
 * describes the **schema's rule** rather than the **user's mistake**. The path
 * already names the key, so `unknown key at groups.g.cleanup.rulesetz` says the
 * same thing in the words someone editing a config file would use. Every other
 * leaf keeps core's phrasing, which is why this goes through `defaultLeafHook`
 * rather than a table of our own.
 *
 * @internal
 */
const formatter = SchemaIssue.makeFormatterStandardSchemaV1({
  leafHook: (issue) => (issue._tag === "UnexpectedKey" ? "unknown key" : SchemaIssue.defaultLeafHook(issue)),
});

/**
 * Flatten an issue tree to one line per rejected value.
 *
 * **Details**
 *
 * Shared by `SchemaIssueRenderer` and `ConfigIssueRenderer` and imported by
 * nothing else. It lives here rather than in either module so that
 * `ConfigIssueRenderer` — the only export that references the optional
 * `@effected/config-file` peer — can stay a module no other module imports.
 *
 * **No walker of our own.** `makeFormatterStandardSchemaV1` already flattens the
 * tree to `{ message, path }` entries, and `defaultLeafHook` covers every leaf
 * variant, so a wrong *type* renders as sensibly as an unknown key and a
 * variant added upstream is covered without a change here.
 *
 * Nodes are never stringified: each carries the entire AST inline, annotations
 * included, so `String(node)` would dump the schema rather than describe the
 * failure. Only `message` and `path` are read.
 *
 * **Example** (Ignore a value that is not a schema issue)
 *
 * ```ts
 * import { formatIssue } from "@beep/cli-kit/internal/format"
 *
 * console.log(JSON.stringify(formatIssue("unstructured failure"))) // []
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const formatIssue = (issue: unknown): ReadonlyArray<string> =>
  A.map(issueEntries(issue), (entry) =>
    entry.path.length === 0 ? entry.message : `${entry.message} at ${A.join(entry.path, ".")}`
  );

/**
 * One rejected value: what is wrong and where.
 *
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { IssueEntry } from "@beep/cli-kit/internal/format"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(IssueEntry)({ message: "Expected string", path: ["name"] })) // true
 * ```
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export class IssueEntry extends S.Opaque<IssueEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The message field. */
    message: S.String.pipe($I.annoteKey("IssueEntry.message", { description: "The message field of IssueEntry." })),
    /** The path field. */
    path: S.Array(S.String).pipe($I.annoteKey("IssueEntry.path", { description: "The path field of IssueEntry." })),
  }).pipe($I.annoteSchema("IssueEntry", { description: "Plain IssueEntry data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { IssueEntry } from "@beep/cli-kit/internal/format"
 * import * as S from "effect/Schema"
 *
 * const plain: IssueEntry.Encoded = { message: "Expected string", path: ["name"] }
 * console.log(S.is(IssueEntry)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace IssueEntry {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof IssueEntry.Encoded;
}

/**
 * The rejected values of an issue tree, once each: what both the lines and the tree are built from.
 *
 * **Details**
 *
 * Anything that is not an issue tree yields none rather than throwing. A rendering helper on an error path must never
 * become the reason a program dies: it is called when something has already gone wrong. A union reports every branch
 * it tried, so one wrong key in a three-member union is the same entry three times; the per-branch "Missing key"
 * entries differ and are kept, since they say which shapes were allowed, but the repeat is pure noise in front of them.
 *
 * **Example** (Ignore a missing issue tree)
 *
 * ```ts
 * import { issueEntries } from "@beep/cli-kit/internal/format"
 *
 * console.log(JSON.stringify(issueEntries(undefined))) // []
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const issueEntries = (issue: unknown): ReadonlyArray<IssueEntry.Encoded> => {
  if (!SchemaIssue.isIssue(issue)) return [];
  const seen = MutableHashSet.empty<IssueEntry>();
  const entries: Array<IssueEntry.Encoded> = [];
  for (const entry of formatter(issue).issues) {
    // The core formatter always emits a path, including [] for a root issue.
    const path = O.fromUndefinedOr(entry.path).pipe(O.getOrThrow, A.map(String));
    const key: IssueEntry.Encoded = { message: entry.message, path };
    if (MutableHashSet.has(seen, key)) continue;
    MutableHashSet.add(seen, key);
    entries.push(key);
  }
  return entries;
};

/** A node of the path trie an issue tree is drawn from. */
interface PathNode {
  readonly children: MutableHashMap.MutableHashMap<string, PathNode>;
  readonly messages: Array<string>;
}

const emptyNode = (): PathNode => ({ messages: [], children: MutableHashMap.empty<string, PathNode>() });

/**
 * The entries as the input of a `Doc.tree`: one node per path segment, so `groups.g.extra` is three nested nodes, and
 * the message at the end of a path is the node's label (`extra: unknown key`) or, when the node has more to say, its
 * leaves.
 *
 * **Example** (Group a rejected key under its path)
 *
 * ```ts
 * import { issueTreeChildren } from "@beep/cli-kit/internal/format"
 *
 * const children = issueTreeChildren([{ message: "unknown key", path: ["config", "extra"] }])
 * console.log(JSON.stringify(children)) // [{"label":"config","children":[{"label":"extra: unknown key"}]}]
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const issueTreeChildren = (entries: ReadonlyArray<IssueEntry.Encoded>): ReadonlyArray<IssueTreeNode.Encoded> => {
  const root = emptyNode();
  for (const entry of entries) {
    let node = root;
    for (const segment of entry.path) {
      let next = O.getOrUndefined(MutableHashMap.get(node.children, segment));
      if (next === undefined) {
        next = emptyNode();
        MutableHashMap.set(node.children, segment, next);
      }
      node = next;
    }
    node.messages.push(entry.message);
  }
  const leaves = (node: PathNode): ReadonlyArray<IssueTreeNode.Encoded> =>
    A.map(node.messages, (message) => ({ label: message }));
  const named: {
    (segment: string, node: PathNode): IssueTreeNode.Encoded;
    (node: PathNode): (segment: string) => IssueTreeNode.Encoded;
  } = dual(2, (segment: string, node: PathNode): IssueTreeNode.Encoded => {
    if (MutableHashMap.size(node.children) === 0 && node.messages.length === 1)
      return { label: `${segment}: ${node.messages[0]}` };
    return {
      label: segment,
      children: [...leaves(node), ...A.map([...node.children], ([name, child]) => named(name, child))],
    };
  });
  return [...leaves(root), ...A.map([...root.children], ([name, child]) => named(name, child))];
};

/**
 * The shape `issueTreeChildren` returns: a `TreeInput` without the dependency on `Doc`, which this module must not
 * import at runtime.
 *
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { IssueTreeNode } from "@beep/cli-kit/internal/format"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(IssueTreeNode)({ label: "name" })) // true
 * ```
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export class IssueTreeNode extends S.Opaque<IssueTreeNode, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The children field. */
    children: S.optionalKey(
      S.suspend((): S.Codec<IssueTreeNode.Encoded> => S.toEncoded(IssueTreeNode)).pipe(S.Array)
    ).pipe($I.annoteKey("IssueTreeNode.children", { description: "The children field of IssueTreeNode." })),
    /** The label field. */
    label: S.String.pipe($I.annoteKey("IssueTreeNode.label", { description: "The label field of IssueTreeNode." })),
  }).pipe($I.annoteSchema("IssueTreeNode", { description: "Plain IssueTreeNode data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { IssueTreeNode } from "@beep/cli-kit/internal/format"
 * import * as S from "effect/Schema"
 *
 * const plain: IssueTreeNode.Encoded = { label: "name" }
 * console.log(S.is(IssueTreeNode)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace IssueTreeNode {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly children?: ReadonlyArray<Encoded>;
    readonly label: string;
  }
}
