import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as MutableHashSet from "effect/MutableHashSet";
import * as SchemaIssue from "effect/SchemaIssue";

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
 * import { formatIssue } from "@beep/scratchpad/effected/cli/internal/format"
 *
 * console.log(JSON.stringify(formatIssue("unstructured failure"))) // []
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const formatIssue = (issue: unknown): ReadonlyArray<string> =>
	issueEntries(issue).map((entry) =>
		entry.path.length === 0 ? entry.message : `${entry.message} at ${entry.path.join(".")}`,
	);

/**
 * One rejected value: what is wrong and where.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface IssueEntry {
	readonly message: string;
	readonly path: ReadonlyArray<string>;
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
 * import { issueEntries } from "@beep/scratchpad/effected/cli/internal/format"
 *
 * console.log(JSON.stringify(issueEntries(undefined))) // []
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const issueEntries = (issue: unknown): ReadonlyArray<IssueEntry> => {
	if (!SchemaIssue.isIssue(issue)) return [];
	const seen = MutableHashSet.empty<string>();
	const entries: Array<IssueEntry> = [];
	for (const entry of formatter(issue).issues) {
		const path = (entry.path ?? []).map(String);
		const key = path.length === 0 ? entry.message : `${entry.message} at ${path.join(".")}`;
		if (MutableHashSet.has(seen, key)) continue;
		MutableHashSet.add(seen, key);
		entries.push({ message: entry.message, path });
	}
	return entries;
};

/** A node of the path trie an issue tree is drawn from. */
interface PathNode {
	readonly messages: Array<string>;
	readonly children: MutableHashMap.MutableHashMap<string, PathNode>;
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
 * import { issueTreeChildren } from "@beep/scratchpad/effected/cli/internal/format"
 *
 * const children = issueTreeChildren([{ message: "unknown key", path: ["config", "extra"] }])
 * console.log(JSON.stringify(children)) // [{"label":"config","children":[{"label":"extra: unknown key"}]}]
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const issueTreeChildren = (entries: ReadonlyArray<IssueEntry>): ReadonlyArray<IssueTreeNode> => {
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
	const leaves = (node: PathNode): ReadonlyArray<IssueTreeNode> =>
		node.messages.map((message) => ({ label: message }));
	const named = (segment: string, node: PathNode): IssueTreeNode => {
		if (MutableHashMap.size(node.children) === 0 && node.messages.length === 1)
			return { label: `${segment}: ${node.messages[0]}` };
		return {
			label: segment,
			children: [...leaves(node), ...[...node.children].map(([name, child]) => named(name, child))],
		};
	};
	return [...leaves(root), ...[...root.children].map(([name, child]) => named(name, child))];
};

/**
 * The shape `issueTreeChildren` returns: a `TreeInput` without the dependency on `Doc`, which this module must not
 * import at runtime.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export interface IssueTreeNode {
	readonly label: string;
	readonly children?: ReadonlyArray<IssueTreeNode>;
}
