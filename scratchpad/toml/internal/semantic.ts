// The provenance state machine (G8): every defined name records HOW it came
// to exist (value, inline, static-array, table-explicit, table-implicit,
// table-dotted, array-tables) and — for dotted-created tables — WHICH
// document section created it. Each expression either legally extends the
// tree or throws RawTomlError at the offending key, first violation wins.
//
// One corpus-driven deviation from the G8 matrix as originally written:
// header navigation PASSES THROUGH `table-dotted` intermediates (the spec's
// "[table] form can be used to define sub-tables within tables defined via
// dotted keys" — valid/spec-1.1.0/common-46.toml, valid/table/
// array-within-dotted.toml); only landing the FINAL header segment on an
// existing `table-dotted` is an error (invalid/table/redefine-02, -03).
//
// Header and dotted-key navigation is ITERATIVE — path depth is data, never
// recursion. Only value materialization recurses, and inline values are
// already depth-capped by the parser.

import type { TomlExpression, TomlKey, TomlKeyValue, TomlValueNode } from "../TomlNode.ts";
import { TomlArray, TomlArrayTableHeader, TomlInlineTable, TomlTableHeader, TomlTrivia } from "../TomlNode.ts";
import type { TomlSemanticErrorCodeRaw } from "./diagnostics.ts";
import { RawTomlError } from "./diagnostics.ts";

/** Semantic-pass callbacks, fired in document order after each expression validates. */
export interface SemanticVisitor {
	/** A table becomes current: the root (header `undefined`, once, first) or a `[t]` header. */
	readonly onTableStart?: (path: ReadonlyArray<string>, header: TomlTableHeader | undefined) => void;
	/** A `[[t]]` header appends element `index` (0-based) and makes it current. */
	readonly onArrayTableStart?: (path: ReadonlyArray<string>, index: number, header: TomlArrayTableHeader) => void;
	/** A key-value assigns; `path` is the full path from the root, final key included. */
	readonly onKeyValue?: (path: ReadonlyArray<string>, expr: TomlKeyValue) => void;
}

/** How a defined name came to exist. */
type Provenance =
	| "value"
	| "inline"
	| "static-array"
	| "table-explicit"
	| "table-implicit"
	| "table-dotted"
	| "array-tables";

/** One name in the provenance tree. `elements` is used by `array-tables` only; `sectionId` by `table-dotted` only. */
interface SemNode {
	kind: Provenance;
	readonly table: Map<string, SemNode>;
	readonly elements: Array<SemNode>;
	readonly sectionId: number;
}

const makeNode = (kind: Provenance, sectionId = 0): SemNode => ({
	kind,
	table: new Map(),
	elements: [],
	sectionId,
});

const raise = (code: TomlSemanticErrorCodeRaw, message: string, key: TomlKey): never => {
	throw new RawTomlError({ code, message, offset: key.offset, length: key.length });
};

/** Per-analysis counter: document sections and inline-table scopes draw distinct ids from the same sequence. */
interface Context {
	nextId: number;
}

/**
 * Header navigation (G8 rules 1 and 2, shared prefix): walk every segment but
 * the last, creating `table-implicit` for absent names, passing through
 * tables (dotted included — the corpus deviation) and descending into the
 * last element of an array of tables.
 */
const navigateHeaderPrefix = (root: SemNode, keyPath: ReadonlyArray<TomlKey>): SemNode => {
	let current = root;
	for (let i = 0; i < keyPath.length - 1; i++) {
		const key = keyPath[i];
		const existing = current.table.get(key.value);
		if (existing === undefined) {
			const child = makeNode("table-implicit");
			current.table.set(key.value, child);
			current = child;
			continue;
		}
		switch (existing.kind) {
			case "table-explicit":
			case "table-implicit":
			case "table-dotted":
				current = existing;
				break;
			case "array-tables":
				current = existing.elements[existing.elements.length - 1];
				break;
			case "inline":
				return raise("InlineTableExtended", `inline table "${key.value}" cannot be extended`, key);
			case "static-array":
				return raise("ArrayOfTablesConflict", `"${key.value}" is a static array, not an array of tables`, key);
			case "value":
				return raise("TableRedefined", `"${key.value}" is already defined as a value`, key);
		}
	}
	return current;
};

/** G8 rule 1, final segment: create `table-explicit`, promote `table-implicit`, or error. */
const openTable = (root: SemNode, keyPath: ReadonlyArray<TomlKey>): SemNode => {
	const parent = navigateHeaderPrefix(root, keyPath);
	const key = keyPath[keyPath.length - 1];
	const existing = parent.table.get(key.value);
	if (existing === undefined) {
		const node = makeNode("table-explicit");
		parent.table.set(key.value, node);
		return node;
	}
	if (existing.kind === "table-implicit") {
		existing.kind = "table-explicit";
		return existing;
	}
	return raise("TableRedefined", `table "${key.value}" is already defined`, key);
};

/** G8 rule 2, final segment: create the array and its first element, append to an existing one, or error. */
const openArrayTable = (
	root: SemNode,
	keyPath: ReadonlyArray<TomlKey>,
): { readonly element: SemNode; readonly index: number } => {
	const parent = navigateHeaderPrefix(root, keyPath);
	const key = keyPath[keyPath.length - 1];
	const existing = parent.table.get(key.value);
	if (existing === undefined) {
		const array = makeNode("array-tables");
		const element = makeNode("table-explicit");
		array.elements.push(element);
		parent.table.set(key.value, array);
		return { element, index: 0 };
	}
	if (existing.kind === "array-tables") {
		const element = makeNode("table-explicit");
		existing.elements.push(element);
		return { element, index: existing.elements.length - 1 };
	}
	return raise("ArrayOfTablesConflict", `"${key.value}" cannot be redefined as an array of tables`, key);
};

/**
 * G8 rule 3: a (possibly dotted) key assignment scoped to `table` under
 * `sectionId`. Intermediates must be absent (create `table-dotted`) or
 * `table-dotted` from the same section; the final key must be absent.
 */
const assignEntry = (
	table: SemNode,
	sectionId: number,
	keyPath: ReadonlyArray<TomlKey>,
	value: TomlValueNode,
	context: Context,
): void => {
	let current = table;
	for (let i = 0; i < keyPath.length - 1; i++) {
		const key = keyPath[i];
		const existing = current.table.get(key.value);
		if (existing === undefined) {
			const child = makeNode("table-dotted", sectionId);
			current.table.set(key.value, child);
			current = child;
			continue;
		}
		if (existing.kind === "table-dotted" && existing.sectionId === sectionId) {
			current = existing;
			continue;
		}
		if (existing.kind === "inline") {
			raise("InlineTableExtended", `inline table "${key.value}" cannot be extended`, key);
		}
		raise("DottedKeyConflict", `dotted key cannot extend "${key.value}"`, key);
	}
	const key = keyPath[keyPath.length - 1];
	if (current.table.has(key.value)) {
		raise("DuplicateKey", `duplicate key "${key.value}"`, key);
	}
	current.table.set(key.value, nodeForValue(value, context));
};

/** The provenance node for an assigned value; validates inline tables (arrays included) on the way. */
const nodeForValue = (value: TomlValueNode, context: Context): SemNode => {
	if (value instanceof TomlInlineTable) {
		return inlineNode(value, context);
	}
	if (value instanceof TomlArray) {
		for (const item of value.items) {
			checkArrayItem(item, context);
		}
		return makeNode("static-array");
	}
	return makeNode("value");
};

/** Inline tables hide anywhere inside a static array; validate them all. Depth is parser-capped. */
const checkArrayItem = (item: TomlValueNode, context: Context): void => {
	if (item instanceof TomlInlineTable) {
		inlineNode(item, context);
		return;
	}
	if (item instanceof TomlArray) {
		for (const inner of item.items) {
			checkArrayItem(inner, context);
		}
	}
};

/**
 * G8 rule 4: build an inline table's own scope (dotted keys follow rule 3
 * inside it), then freeze it — the returned node's `inline` kind makes every
 * later navigation through it an `InlineTableExtended` error.
 */
const inlineNode = (node: TomlInlineTable, context: Context): SemNode => {
	const scopeId = context.nextId++;
	const sem = makeNode("table-dotted", scopeId);
	for (const entry of node.entries) {
		assignEntry(sem, scopeId, entry.keyPath, entry.value, context);
	}
	sem.kind = "inline";
	return sem;
};

/**
 * Walk the expressions through the G8 state machine, firing the visitor after
 * each expression validates; throws `RawTomlError` at the first violation.
 */
export const analyze = (expressions: ReadonlyArray<TomlExpression>, visitor?: SemanticVisitor): void => {
	const root = makeNode("table-explicit");
	const context: Context = { nextId: 1 };
	let currentTable = root;
	let currentSectionId = 0;
	let currentPrefix: ReadonlyArray<string> = [];
	visitor?.onTableStart?.([], undefined);
	for (const expression of expressions) {
		if (expression instanceof TomlTrivia) {
			continue;
		}
		if (expression instanceof TomlTableHeader) {
			currentTable = openTable(root, expression.keyPath);
			currentSectionId = context.nextId++;
			currentPrefix = expression.keyPath.map((key) => key.value);
			visitor?.onTableStart?.(currentPrefix, expression);
			continue;
		}
		if (expression instanceof TomlArrayTableHeader) {
			const { element, index } = openArrayTable(root, expression.keyPath);
			currentTable = element;
			currentSectionId = context.nextId++;
			currentPrefix = expression.keyPath.map((key) => key.value);
			visitor?.onArrayTableStart?.(currentPrefix, index, expression);
			continue;
		}
		assignEntry(currentTable, currentSectionId, expression.keyPath, expression.value, context);
		visitor?.onKeyValue?.([...currentPrefix, ...expression.keyPath.map((key) => key.value)], expression);
	}
};

/** Set a key as an own data property — `__proto__` included (yaml/jsonc precedent). */
const setOwnProperty = (target: Record<string, unknown>, key: string, value: unknown): void => {
	if (key === "__proto__") {
		// Own data property, not a prototype mutation — matches JSON.parse
		// semantics and the packages/yaml/src/YamlNode.ts precedent.
		Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
	} else {
		target[key] = value;
	}
};

/** Own-property read that never leaks through the prototype chain (`__proto__` included). */
const getOwnProperty = (target: Record<string, unknown>, key: string): unknown =>
	Object.hasOwn(target, key) ? target[key] : undefined;

/**
 * Navigate `path` in the output tree, creating plain objects for absent names
 * and descending into the LAST element of arrays (mirrors the array-of-tables
 * rule — `analyze` has already proven every step legal). Iterative.
 */
const navigateOutput = (target: Record<string, unknown>, path: ReadonlyArray<string>): Record<string, unknown> => {
	let current = target;
	for (const segment of path) {
		let child = getOwnProperty(current, segment);
		if (child === undefined) {
			child = {};
			setOwnProperty(current, segment, child);
		}
		if (Array.isArray(child)) {
			child = child[child.length - 1];
		}
		current = child as Record<string, unknown>;
	}
	return current;
};

/** Materialize a CST value node into a plain value. Recursion is parser-depth-capped. */
const materialize = (value: TomlValueNode): unknown => {
	if (value instanceof TomlArray) {
		return value.items.map(materialize);
	}
	if (value instanceof TomlInlineTable) {
		const output: Record<string, unknown> = {};
		for (const entry of value.entries) {
			const parent = navigateOutput(
				output,
				entry.keyPath.slice(0, -1).map((key) => key.value),
			);
			setOwnProperty(parent, entry.keyPath[entry.keyPath.length - 1].value, materialize(entry.value));
		}
		return output;
	}
	return value.value;
};

/**
 * `analyze` + plain-value construction in a single pass: the value builder is
 * the default visitor riding the same walk. Scalars materialize to their
 * decoded values (`TomlInteger` → number | bigint, `TomlDateTimeLiteral` →
 * its date-time class instance), arrays to plain arrays, tables and inline
 * tables to plain objects with `__proto__` as an own data property.
 */
export const buildValue = (expressions: ReadonlyArray<TomlExpression>): unknown => {
	const result: Record<string, unknown> = {};
	analyze(expressions, {
		onTableStart: (path, _header) => {
			navigateOutput(result, path);
		},
		onArrayTableStart: (path, _index, _header) => {
			const parent = navigateOutput(result, path.slice(0, -1));
			const key = path[path.length - 1];
			const existing = getOwnProperty(parent, key);
			if (Array.isArray(existing)) {
				existing.push({});
			} else {
				setOwnProperty(parent, key, [{}]);
			}
		},
		onKeyValue: (path, expr) => {
			const parent = navigateOutput(result, path.slice(0, -1));
			setOwnProperty(parent, path[path.length - 1], materialize(expr.value));
		},
	});
	return result;
};
