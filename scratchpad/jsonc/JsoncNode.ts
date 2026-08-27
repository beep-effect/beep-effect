// The recursive JSONC AST node and the path vocabulary used to navigate it.
//
// `JsoncNode` is a `Schema.Class` with a `Schema.suspend` self-reference for
// `children`; it deliberately carries no parent pointers (circular references
// would break structural equality, serialization and Schema encode/decode).
// Navigation methods (`find`, `findAtOffset`, `pathAt`) walk `children`
// locally and return `Option`, never a `NotFound` error. Value extraction
// (`toValue`) is a pure total function per the package Effect-wrapping
// policy.

import { Option, Schema } from "effect";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";

/**
 * A single path segment: a `string` for object property keys or a `number`
 * for array indices.
 *
 * @public
 */
export type JsoncSegment = string | number;

/**
 * An ordered sequence of {@link JsoncSegment} values describing a location
 * within a JSONC document tree.
 *
 * @public
 */
export type JsoncPath = ReadonlyArray<JsoncSegment>;

/**
 * Discriminator values for JSONC AST node types: the JSON value types
 * (`string`/`number`/`boolean`/`null`), the structural types
 * (`object`/`array`) and the `property` key-value pair type.
 *
 * @public
 */
export const JsoncNodeType = Schema.Literals(["object", "array", "property", "string", "number", "boolean", "null"]);

/**
 * The union of all JSONC AST node type string literals.
 *
 * @public
 */
export type JsoncNodeType = typeof JsoncNodeType.Type;

/**
 * An immutable JSONC AST node produced by `Jsonc.parseTree`.
 *
 * The `parent` field present in Microsoft's `jsonc-parser` is intentionally
 * omitted: circular references would break structural equality, serialization
 * and Schema encode/decode. Child relationships are expressed via `children`,
 * and the recursive type is handled with `Schema.suspend`.
 *
 * - `type` — the `JsoncNodeType` discriminator.
 * - `offset` / `length` — the node's span in the source (tight token-end
 *   discipline: spans never swallow trailing whitespace or comments).
 * - `value` — the decoded JS value for leaf nodes; omitted for structural nodes.
 * - `colonOffset` — for `property` nodes, the offset of the `:` separator.
 * - `children` — child nodes for `object`, `array` and `property` nodes.
 *
 * Construct via `JsoncNode.make(...)`, never `new JsoncNode(...)`.
 *
 * @public
 */
export class JsoncNode extends Schema.Class<JsoncNode>("JsoncNode")({
	type: JsoncNodeType,
	offset: Schema.Number,
	length: Schema.Number,
	value: Schema.optionalKey(Schema.Unknown),
	colonOffset: Schema.optionalKey(Schema.Number),
	children: Schema.optionalKey(Schema.Array(Schema.suspend((): Schema.Schema<JsoncNode> => JsoncNode))),
}) {
	/**
	 * Find a descendant node by path. String segments navigate object
	 * properties; number segments navigate array indices. Returns
	 * `Option.none()` when any segment cannot be resolved. Pure.
	 *
	 * @param path - The path to resolve, relative to this node.
	 * @returns The descendant node, or `Option.none()` when `path` cannot be
	 *   resolved.
	 */
	find(path: JsoncPath): Option.Option<JsoncNode> {
		let current: JsoncNode | undefined = this;

		for (const segment of path) {
			if (current?.children === undefined) {
				return Option.none();
			}
			if (typeof segment === "string") {
				if (current.type !== "object") return Option.none();
				const property: JsoncNode | undefined = current.children.find(
					(child) => child.type === "property" && child.children !== undefined && child.children[0]?.value === segment,
				);
				current = property?.children?.[1];
			} else {
				if (current.type !== "array") return Option.none();
				current = current.children[segment];
			}
		}

		return current !== undefined ? Option.some(current) : Option.none();
	}

	/**
	 * Find the innermost node whose span covers `offset`, or `Option.none()`
	 * if the offset is outside this subtree. Pure.
	 *
	 * @param offset - The zero-based character offset to locate.
	 * @returns The innermost covering node, or `Option.none()` when `offset`
	 *   falls outside this subtree.
	 */
	findAtOffset(offset: number): Option.Option<JsoncNode> {
		return findAtOffsetImpl(this, offset, 0);
	}

	/**
	 * Return the JSON path to the innermost node covering `offset`, or
	 * `Option.none()` if the offset is outside this subtree. The inverse of
	 * {@link JsoncNode.find}. Pure.
	 *
	 * @param offset - The zero-based character offset to locate.
	 * @returns The path to the innermost covering node, or `Option.none()`
	 *   when `offset` falls outside this subtree.
	 */
	pathAt(offset: number): Option.Option<JsoncPath> {
		return buildPath(this, offset, []);
	}

	/**
	 * Reconstruct the plain JavaScript value represented by this subtree. Pure
	 * and total — never fails, so no `Effect` wrapper.
	 *
	 * @returns The plain JavaScript value (object, array, string, number,
	 *   boolean or `null`) this subtree represents.
	 */
	toValue(): unknown {
		return evaluateNode(this, 0);
	}
}

/**
 * Validation-free construction path for the trusted tree builder in
 * `internal/parser.ts` — NOT part of the public surface (not re-exported from
 * `index.ts`); external callers construct via the fully validating
 * `JsoncNode.make`.
 *
 * Constructing a `JsoncNode` through `make`/`new` re-parses the recursive
 * `children` field, and each element parse re-runs the class transformation,
 * which re-parses ITS children — construction cost doubles per nesting level
 * (issue #13; measured ~4s at depth 20, effectively hanging past 25). The
 * parser guarantees validity by construction — every field comes straight off
 * a scanner token — so it skips schema construction entirely.
 *
 * A `Schema.Class` instance is its props assigned onto the class prototype:
 * the base `Data.Class` constructor is exactly `Object.assign(this, props)`,
 * and the prototype chain carries the methods, the class brand getter and
 * structural equality (verified against effect@4.0.0-beta.97). Mirroring that
 * with `Object.create` + `Object.assign` yields an instance identical to a
 * `make`-built one, minus the validating parse.
 *
 * Contract: absent optional fields must be OMITTED, never passed as an
 * explicit `undefined` (a present `undefined` would create an own property
 * that `make` would have rejected).
 */
export const makeNodeUnsafe = (props: {
	readonly type: JsoncNodeType;
	readonly offset: number;
	readonly length: number;
	readonly value?: unknown;
	readonly colonOffset?: number;
	readonly children?: ReadonlyArray<JsoncNode>;
}): JsoncNode => Object.assign(Object.create(JsoncNode.prototype) as JsoncNode, props);

// Recursive walkers below cap their descent at MAX_NESTING_DEPTH. A tree built
// by the parser is already bounded (the parser caps at the same depth), but a
// tree assembled by hand via `JsoncNode.make` can nest arbitrarily deep, so each
// walker guards independently — returning a bounded placeholder (Option.none()
// or null) rather than overflowing the stack as a defect.

function findAtOffsetImpl(node: JsoncNode, offset: number, depth: number): Option.Option<JsoncNode> {
	if (offset < node.offset || offset >= node.offset + node.length) {
		return Option.none();
	}
	if (node.children === undefined || depth >= MAX_NESTING_DEPTH) {
		return Option.some(node);
	}
	for (const child of node.children) {
		if (offset >= child.offset && offset < child.offset + child.length) {
			return findAtOffsetImpl(child, offset, depth + 1);
		}
	}
	return Option.some(node);
}

function buildPath(
	node: JsoncNode,
	targetOffset: number,
	currentPath: Array<JsoncSegment>,
	depth = 0,
): Option.Option<JsoncPath> {
	if (targetOffset < node.offset || targetOffset >= node.offset + node.length) {
		return Option.none();
	}
	if (node.children === undefined || depth >= MAX_NESTING_DEPTH) {
		return Option.some(currentPath);
	}
	if (node.type === "object") {
		for (const prop of node.children) {
			if (
				prop.type === "property" &&
				prop.children !== undefined &&
				targetOffset >= prop.offset &&
				targetOffset < prop.offset + prop.length
			) {
				const key = prop.children[0]?.value as string;
				const valuePath = [...currentPath, key];
				const valueChild = prop.children[1];
				if (
					valueChild !== undefined &&
					targetOffset >= valueChild.offset &&
					targetOffset < valueChild.offset + valueChild.length
				) {
					return buildPath(valueChild, targetOffset, valuePath, depth + 1);
				}
				return Option.some(valuePath);
			}
		}
	} else if (node.type === "array") {
		for (let i = 0; i < node.children.length; i++) {
			const child = node.children[i];
			if (targetOffset >= child.offset && targetOffset < child.offset + child.length) {
				return buildPath(child, targetOffset, [...currentPath, i], depth + 1);
			}
		}
	}
	return Option.some(currentPath);
}

function evaluateNode(node: JsoncNode, depth: number): unknown {
	// Over-deep subtree (only reachable on a hand-built tree): stop descending
	// and yield a bounded `null` placeholder rather than overflowing the stack.
	if (depth >= MAX_NESTING_DEPTH) {
		return node.type === "object" ? {} : node.type === "array" ? [] : null;
	}
	switch (node.type) {
		case "object": {
			const obj: Record<string, unknown> = {};
			if (node.children !== undefined) {
				for (const prop of node.children) {
					if (prop.type === "property" && prop.children !== undefined && prop.children.length === 2) {
						const key = prop.children[0].value as string;
						const value = evaluateNode(prop.children[1], depth + 1);
						if (key === "__proto__") {
							// Own data property, not a prototype mutation — matches the value
							// parser and JSON.parse semantics.
							Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
						} else {
							obj[key] = value;
						}
					}
				}
			}
			return obj;
		}
		case "array":
			return (node.children ?? []).map((child) => evaluateNode(child, depth + 1));
		case "property":
			return node.children?.[1] !== undefined ? evaluateNode(node.children[1], depth + 1) : undefined;
		default:
			return node.value;
	}
}
