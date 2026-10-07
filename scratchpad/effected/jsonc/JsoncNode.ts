// The recursive JSONC AST node and the path vocabulary used to navigate it.
//
// `JsoncNode` is a `S.Class` with a `S.suspend` self-reference for `children`;
// it deliberately carries no parent pointers (circular references would break
// structural equality, serialization and Schema encode/decode). Navigation
// methods walk `children` locally and return `Option`, never a `NotFound`
// error. Value extraction (`toValue`) is a pure total function.
import * as R from "effect/Record";
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { thunkNull } from "@beep/utils";
import { dual } from "effect/Function";

const $I = $ScratchpadId.create("effected/jsonc/JsoncNode");

/**
 * A single path segment: a `string` for object property keys or a
 * non-negative integer for array indices.
 *
 * **Example** (Guard a segment kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsoncSegment } from "@beep/scratchpad/effected/jsonc/index"
 *
 * console.log(S.is(JsoncSegment)("port")) // true
 * console.log(S.is(JsoncSegment)(1.5)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsoncSegment = S.Union([S.String, S.Natural]).pipe(
  $I.annoteSchema("JsoncSegment", {
    description: "One step of a JSONC path: an object key or a non-negative array index.",
  }),
);

/**
 * The decoded shape of {@link JsoncSegment}.
 *
 * @see {@link JsoncSegment} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type JsoncSegment = typeof JsoncSegment.Type;

/**
 * An ordered sequence of {@link JsoncSegment} values describing a location
 * within a JSONC document tree. The empty path names the document root.
 *
 * **Example** (Validate a path)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { JsoncPath } from "@beep/scratchpad/effected/jsonc/index"
 *
 * console.log(S.is(JsoncPath)(["servers", 0, "port"])) // true
 * console.log(S.is(JsoncPath)([-1])) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsoncPath = S.Array(JsoncSegment).pipe(
  $I.annoteSchema("JsoncPath", {
    description: "An ordered list of segments locating a value inside a JSONC document.",
  }),
);

/**
 * The decoded shape of {@link JsoncPath}.
 *
 * @see {@link JsoncPath} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type JsoncPath = typeof JsoncPath.Type;

/**
 * Discriminator values for JSONC AST node types: the JSON value types, the
 * structural types `object` and `array`, and the `property` key-value pair.
 *
 * **Example** (Branch on a node type with the kit matcher)
 *
 * ```ts
 * import { JsoncNodeType } from "@beep/scratchpad/effected/jsonc/index"
 *
 * const describe = JsoncNodeType.$match({
 *   object: () => "container",
 *   array: () => "container",
 *   property: () => "pair",
 *   string: () => "leaf",
 *   number: () => "leaf",
 *   boolean: () => "leaf",
 *   null: () => "leaf",
 * })
 *
 * console.log(describe("array")) // "container"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsoncNodeType = LiteralKit(["object", "array", "property", "string", "number", "boolean", "null"]).annotate(
  $I.annote("JsoncNodeType", {
    description: "The kind of a JSONC AST node.",
  }),
);

/**
 * The union of all JSONC AST node type string literals.
 *
 * @see {@link JsoncNodeType} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type JsoncNodeType = typeof JsoncNodeType.Type;

/**
 * An immutable JSONC AST node produced by `Jsonc.parseTree`.
 *
 * **Details**
 *
 * The `parent` field present in Microsoft's `jsonc-parser` is intentionally
 * omitted: circular references would break structural equality, serialization
 * and Schema encode/decode. Child relationships are expressed through
 * `children`, and the recursive type is handled with `S.suspend`.
 *
 * - `type` is the {@link JsoncNodeType} discriminator.
 * - `offset` and `length` give the node's span in the source. Spans are tight:
 *   they never swallow trailing whitespace or comments.
 * - `value` holds the decoded value for leaf nodes and is omitted for
 *   structural nodes.
 * - `colonOffset` is the offset of the `:` separator on `property` nodes.
 * - `children` lists child nodes for `object`, `array` and `property` nodes.
 *
 * **Gotchas**
 *
 * Construct with `JsoncNode.make(...)`. Constructing a deep tree by hand
 * re-validates every subtree per level, so prefer `Jsonc.parseTree` for real
 * documents.
 *
 * **Example** (Navigate a parsed tree)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
 *
 * const root = O.getOrThrow(Result.getOrThrow(Jsonc.parseTreeResult('{ "a": [10, 20] }')))
 *
 * console.log(O.map(root.find(["a", 1]), (node) => node.value)) // Option.some(20)
 * console.log(root.pathAt(10)) // Option.some(["a", 0])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsoncNode extends S.Class<JsoncNode>($I`JsoncNode`)(
  {
    type: JsoncNodeType,
    offset: S.Natural,
    length: S.Natural,
    value: S.optionalKey(S.Unknown),
    colonOffset: S.optionalKey(S.Natural),
    children: S.suspend((): S.Codec<JsoncNode, JsoncNode.Encoded> => JsoncNode).pipe(S.Array, S.optionalKey),
  },
  $I.annote("JsoncNode", {
    description: "An immutable JSONC AST node with a tight source span and optional children.",
  }),
) {
  /**
   * Find a descendant node by path.
   *
   * **Details**
   *
   * String segments navigate object properties; number segments navigate
   * array indices. Returns `O.none()` when any segment cannot be resolved.
   *
   * **Example** (Resolve a nested array element)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as Result from "effect/Result"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const root = O.getOrThrow(Result.getOrThrow(Jsonc.parseTreeResult('{ "a": { "b": [10, 20] } }')))
   *
   * console.log(O.map(root.find(["a", "b", 1]), (node) => node.value)) // Option.some(20)
   * console.log(root.find(["missing"])) // Option.none()
   * ```
   *
   * @param path - The path to resolve, relative to this node.
   * @returns The descendant node, or `O.none()` when `path` cannot be resolved.
   */
  find(path: JsoncPath): O.Option<JsoncNode> {
    let current: O.Option<JsoncNode> = O.some(this);
    for (const segment of path) {
      current = O.flatMap(current, (node) => childAt(node, segment));
    }
    return current;
  }

  /**
   * Find the innermost node whose span covers `offset`.
   *
   * **Example** (Locate the node under a cursor)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as Result from "effect/Result"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const text = '{ "a": { "b": 42 } }'
   * const root = O.getOrThrow(Result.getOrThrow(Jsonc.parseTreeResult(text)))
   *
   * console.log(O.map(root.findAtOffset(text.indexOf("42")), (node) => node.type)) // Option.some("number")
   * ```
   *
   * @param offset - The zero-based character offset to locate.
   * @returns The innermost covering node, or `O.none()` when `offset` falls
   *   outside this subtree.
   */
  findAtOffset(offset: number): O.Option<JsoncNode> {
    return findAtOffsetImpl(this, offset, 0);
  }

  /**
   * Return the JSON path to the innermost node covering `offset`. The inverse
   * of {@link JsoncNode.find}.
   *
   * **Example** (Recover the path under a cursor)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as Result from "effect/Result"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const text = '{ "a": { "b": 42 } }'
   * const root = O.getOrThrow(Result.getOrThrow(Jsonc.parseTreeResult(text)))
   *
   * console.log(root.pathAt(text.indexOf("42"))) // Option.some(["a", "b"])
   * ```
   *
   * @param offset - The zero-based character offset to locate.
   * @returns The path to the innermost covering node, or `O.none()` when
   *   `offset` falls outside this subtree.
   */
  pathAt(offset: number): O.Option<JsoncPath> {
    return buildPath(this, offset, A.empty(), 0);
  }

  /**
   * Reconstruct the plain JavaScript value represented by this subtree. Pure
   * and total.
   *
   * **Example** (Evaluate a subtree)
   *
   * ```ts
   * import * as O from "effect/Option"
   * import * as Result from "effect/Result"
   * import { Jsonc } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const root = O.getOrThrow(Result.getOrThrow(Jsonc.parseTreeResult('{ "x": [1, { "y": true }] }')))
   *
   * console.log(root.toValue()) // { x: [1, { y: true }] }
   * ```
   *
   * @returns The plain JavaScript value (object, array, string, number,
   *   boolean or `null`) this subtree represents.
   */
  toValue(): unknown {
    return evaluateNode(this, 0);
  }
}

/**
 * The encoded companion of {@link JsoncNode}: the plain recursive record the
 * class decodes from and encodes to.
 *
 * @see {@link JsoncNode} for the runtime class and its navigation methods.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JsoncNode {
  /**
   * Plain-record form of a node, with `children` as plain records too.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = {
    readonly type: JsoncNodeType;
    readonly offset: number;
    readonly length: number;
    readonly value?: unknown;
    readonly colonOffset?: number;
    readonly children?: ReadonlyArray<JsoncNode.Encoded>;
  };
}

/**
 * Construct a trusted parser node without revalidating its recursive children.
 *
 * **Details**
 *
 * Constructing a `JsoncNode` through `make` re-parses the recursive `children`
 * field, and each element parse re-runs the class transformation, so
 * construction cost doubles per nesting level. The parser guarantees validity
 * by construction (every field comes straight off a scanner token), so it
 * skips the validating parse. Public callers construct through
 * `JsoncNode.make`.
 *
 * **Gotchas**
 *
 * Absent optional fields must be omitted, never passed as an explicit
 * `undefined`.
 *
 * **Example** (Build a leaf without validation)
 *
 * ```ts
 * import { makeNodeUnsafe } from "@beep/scratchpad/effected/jsonc/JsoncNode"
 *
 * const leaf = makeNodeUnsafe({ type: "number", offset: 0, length: 2, value: 42 })
 *
 * console.log(leaf.toValue()) // 42
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeNodeUnsafe = (props: JsoncNode.Encoded): JsoncNode =>
  JsoncNode.make(props, { disableChecks: true });

const propertyKey = (prop: JsoncNode): O.Option<string> =>
  prop.type === "property"
    ? O.fromUndefinedOr(prop.children).pipe(
      O.flatMap(A.head),
      O.map((keyNode) => keyNode.value),
      O.filter(P.isString),
    )
    : O.none();

const covers = (node: JsoncNode, offset: number): boolean =>
  offset >= node.offset && offset < node.offset + node.length;

const childAt = (node: JsoncNode, segment: JsoncSegment): O.Option<JsoncNode> => {
  const children = O.fromUndefinedOr(node.children);
  if (P.isString(segment)) {
    return node.type === "object"
      ? children.pipe(
        O.flatMap(A.findFirst((child) => O.contains(propertyKey(child), segment))),
        O.flatMap((prop) => O.flatMap(O.fromUndefinedOr(prop.children), A.get(1))),
      )
      : O.none();
  }
  return node.type === "array" ? O.flatMap(children, A.get(segment)) : O.none();
};

// Recursive walkers below cap their descent at MAX_NESTING_DEPTH. A tree built
// by the parser is already bounded (the parser caps at the same depth), but a
// tree assembled by hand via `JsoncNode.make` can nest arbitrarily deep, so
// each walker guards independently, returning a bounded placeholder rather
// than overflowing the stack as a defect.

const findAtOffsetImpl = (node: JsoncNode, offset: number, depth: number): O.Option<JsoncNode> => {
  if (!covers(node, offset)) {
    return O.none();
  }
  if (node.children === undefined || depth >= MAX_NESTING_DEPTH) {
    return O.some(node);
  }
  return A.findFirst(node.children, (child) => covers(child, offset)).pipe(
    O.flatMap((child) => findAtOffsetImpl(child, offset, depth + 1)),
    O.orElseSome(() => node),
  );
};

const buildPath = (
  node: JsoncNode,
  offset: number,
  currentPath: ReadonlyArray<JsoncSegment>,
  depth: number,
): O.Option<JsoncPath> => {
  if (!covers(node, offset)) {
    return O.none();
  }
  if (node.children === undefined || depth >= MAX_NESTING_DEPTH) {
    return O.some(currentPath);
  }
  if (node.type === "object") {
    for (const prop of node.children) {
      const key = propertyKey(prop);
      if (O.isSome(key) && covers(prop, offset)) {
        const valuePath = A.append(currentPath, key.value);
        return O.fromUndefinedOr(prop.children).pipe(
          O.flatMap(A.get(1)),
          O.filter((valueChild) => covers(valueChild, offset)),
          O.flatMap((valueChild) => buildPath(valueChild, offset, valuePath, depth + 1)),
          O.orElseSome(() => valuePath),
        );
      }
    }
    return O.some(currentPath);
  }
  if (node.type === "array") {
    let index = 0;
    for (const child of node.children) {
      if (covers(child, offset)) {
        return buildPath(child, offset, A.append(currentPath, index), depth + 1);
      }
      index++;
    }
  }
  return O.some(currentPath);
};

const evaluateNode: {
  (node: JsoncNode, depth: number): unknown,
  (depth: number): (node: JsoncNode) => unknown
} = dual(2, (node: JsoncNode, depth: number): unknown => {
  // Over-deep subtree (only reachable on a hand-built tree): stop descending
  // and yield a bounded placeholder rather than overflowing the stack.
  if (depth >= MAX_NESTING_DEPTH) {
    return JsoncNodeType.$match(node.type, {
      object: R.empty,
      array: A.empty<unknown>,
      property: thunkNull,
      string: thunkNull,
      number: thunkNull,
      boolean: thunkNull,
      null: thunkNull,
    });
  }
  const children = node.children ?? A.empty<JsoncNode>();
  const thunkNodeValue = () => node.value;
  return JsoncNodeType.$match(node.type, {
    object: () => {
      const obj = R.empty<string, unknown>();
      for (const prop of children) {
        const key = propertyKey(prop);
        const valueNode = O.flatMap(O.fromUndefinedOr(prop.children), A.get(1));
        if (O.isSome(key) && O.isSome(valueNode)) {
          // Own data property, not a prototype mutation: matches the value
          // parser and JSON.parse semantics for a `__proto__` key.
          Object.defineProperty(obj, key.value, {
            value: evaluateNode(valueNode.value, depth + 1),
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }
      }
      return obj;
    },
    array: () => A.map(children, evaluateNode(depth + 1)),
    property: () => O.getOrUndefined(O.map(A.get(children, 1), evaluateNode(depth + 1))),
    string: thunkNodeValue,
    number: thunkNodeValue,
    boolean: thunkNodeValue,
    null: thunkNodeValue,
  });
});
