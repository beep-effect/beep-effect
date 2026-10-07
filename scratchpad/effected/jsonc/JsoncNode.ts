import * as Match from "effect/Match";
// The recursive JSONC AST node and the path vocabulary used to navigate it.
//
// `JsoncNode` is a `S.Class` with a `S.suspend` self-reference for
// `children`; it deliberately carries no parent pointers (circular references
// would break structural equality, serialization and Schema encode/decode).
// Navigation methods (`find`, `findAtOffset`, `pathAt`) walk `children`
// locally and return `Option`, never a `NotFound` error. Value extraction
// (`toValue`) is a pure total function per the package Effect-wrapping
// policy.

import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";

/**
 * A single path segment: a `string` for object property keys or a `number`
 * for array indices.
 *
 * @public
 */
export const JsoncSegment = S.Union([S.String, S.Int]);
export type JsoncSegment = typeof JsoncSegment.Type;

/**
 * An ordered sequence of {@link JsoncSegment} values describing a location
 * within a JSONC document tree.
 *
 * @public
 */
export const JsoncPath = S.Array(JsoncSegment);
export type JsoncPath = typeof JsoncPath.Type;

/**
 * Discriminator values for JSONC AST node types: the JSON value types
 * (`string`/`number`/`boolean`/`null`), the structural types
 * (`object`/`array`) and the `property` key-value pair type.
 *
 * @public
 */
export const JsoncNodeType = LiteralKit(["object", "array", "property", "string", "number", "boolean", "null"]);

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
 * and the recursive type is handled with `S.suspend`.
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
export class JsoncNode extends S.Class<JsoncNode>("JsoncNode")({
	type: JsoncNodeType,
	offset: S.Finite,
	length: S.Finite,
	value: S.optionalKey(S.Unknown),
	colonOffset: S.optionalKey(S.Finite),
	children: S.suspend((): S.Schema<JsoncNode> => JsoncNode).pipe(S.Array, S.optionalKey),
}) {
	/**
	 * Find a descendant node by path. String segments navigate object
	 * properties; number segments navigate array indices. Returns
	 * `O.none()` when any segment cannot be resolved. Pure.
	 *
	 * @param path - The path to resolve, relative to this node.
	 * @returns The descendant node, or `O.none()` when `path` cannot be
	 *   resolved.
	 */
	find(path: JsoncPath): O.Option<JsoncNode> {
		let current: JsoncNode | undefined = this;

		for (const segment of path) {
			if (current?.children === undefined) {
				return O.none();
			}
			if (P.isString(segment)) {
				if (current.type !== "object") return O.none();
				const property: JsoncNode | undefined = current.children.find(
					(child) => child.type === "property" && child.children !== undefined && child.children[0]?.value === segment,
				);
				current = property?.children?.[1];
			} else {
				if (current.type !== "array") return O.none();
				current = current.children[segment];
			}
		}

		return current !== undefined ? O.some(current) : O.none();
	}

	/**
	 * Find the innermost node whose span covers `offset`, or `O.none()`
	 * if the offset is outside this subtree. Pure.
	 *
	 * @param offset - The zero-based character offset to locate.
	 * @returns The innermost covering node, or `O.none()` when `offset`
	 *   falls outside this subtree.
	 */
	findAtOffset(offset: number): O.Option<JsoncNode> {
		return findAtOffsetImpl(this, offset, 0);
	}

	/**
	 * Return the JSON path to the innermost node covering `offset`, or
	 * `O.none()` if the offset is outside this subtree. The inverse of
	 * {@link JsoncNode.find}. Pure.
	 *
	 * @param offset - The zero-based character offset to locate.
	 * @returns The path to the innermost covering node, or `O.none()`
	 *   when `offset` falls outside this subtree.
	 */
	pathAt(offset: number): O.Option<JsoncPath> {
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
 * Constructs a trusted parser node without revalidating its recursive children.
 * The parser guarantees field validity and omits absent optional keys. Public
 * callers should use `JsoncNode.make` with its normal validation.
 */
export const makeNodeUnsafe = (props: typeof JsoncNode.Encoded): JsoncNode =>
  JsoncNode.make(props, { disableChecks: true });

// Recursive walkers below cap their descent at MAX_NESTING_DEPTH. A tree built
// by the parser is already bounded (the parser caps at the same depth), but a
// tree assembled by hand via `JsoncNode.make` can nest arbitrarily deep, so each
// walker guards independently — returning a bounded placeholder (O.none()
// or null) rather than overflowing the stack as a defect.

function findAtOffsetImpl(node: JsoncNode, offset: number, depth: number): O.Option<JsoncNode> {
	if (offset < node.offset || offset >= node.offset + node.length) {
		return O.none();
	}
	if (node.children === undefined || depth >= MAX_NESTING_DEPTH) {
		return O.some(node);
	}
	for (const child of node.children) {
		if (offset >= child.offset && offset < child.offset + child.length) {
			return findAtOffsetImpl(child, offset, depth + 1);
		}
	}
	return O.some(node);
}

function buildPath(
	node: JsoncNode,
	targetOffset: number,
	currentPath: Array<JsoncSegment>,
	depth = 0,
): O.Option<JsoncPath> {
	if (targetOffset < node.offset || targetOffset >= node.offset + node.length) {
		return O.none();
	}
	if (node.children === undefined || depth >= MAX_NESTING_DEPTH) {
		return O.some(currentPath);
	}
	if (node.type === "object") {
		for (const prop of node.children) {
			if (
				prop.type === "property" &&
				prop.children !== undefined &&
				targetOffset >= prop.offset &&
				targetOffset < prop.offset + prop.length
			) {
				const key = prop.children[0]?.value;
				if (!P.isString(key)) continue;
				const valuePath = [...currentPath, key];
				const valueChild = prop.children[1];
				if (
					valueChild !== undefined &&
					targetOffset >= valueChild.offset &&
					targetOffset < valueChild.offset + valueChild.length
				) {
					return buildPath(valueChild, targetOffset, valuePath, depth + 1);
				}
				return O.some(valuePath);
			}
		}
	} else if (node.type === "array") {
		let i = 0;
		for (const child of node.children) {
			if (targetOffset >= child.offset && targetOffset < child.offset + child.length) {
				return buildPath(child, targetOffset, [...currentPath, i], depth + 1);
			}
			i++;
		}
	}
	return O.some(currentPath);
}

function evaluateNode(node: JsoncNode, depth: number): unknown {
	// Over-deep subtree (only reachable on a hand-built tree): stop descending
	// and yield a bounded `null` placeholder rather than overflowing the stack.
	if (depth >= MAX_NESTING_DEPTH) {
		return node.type === "object" ? {} : node.type === "array" ? [] : null;
	}
	return Match.value(node.type).pipe(
Match.when("object", (): unknown => { {
			const obj: Record<string, unknown> = {};
			if (node.children !== undefined) {
				for (const prop of node.children) {
					if (prop.type === "property" && prop.children !== undefined && prop.children.length === 2) {
						const [keyNode, valueNode] = prop.children;
						if (keyNode === undefined || valueNode === undefined || !P.isString(keyNode.value)) continue;
						const key = keyNode.value;
						const value = evaluateNode(valueNode, depth + 1);
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
}),
Match.when("array", (): unknown => {
			return (node.children ?? []).map((child) => evaluateNode(child, depth + 1));
}),
Match.when("property", (): unknown => {
			return node.children?.[1] !== undefined ? evaluateNode(node.children[1], depth + 1) : undefined;
}),
Match.orElse((): unknown => {
			return node.value;
})
);
}
