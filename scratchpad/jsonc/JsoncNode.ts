/**
 * The recursive JSONC AST node and the path vocabulary used to navigate it.
 *
 * `JsoncNode` is a `Schema.Class` with a `Schema.suspend` self-reference for
 * `children`; it deliberately carries no parent pointers (circular references
 * would break structural equality, serialization and Schema encode/decode).
 * Navigation methods (`find`, `findAtOffset`, `pathAt`) walk `children`
 * locally and return `Option`, never a `NotFound` error. Value extraction
 * (`toValue`) is a pure total function per the package Effect-wrapping
 * policy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Match, Option, Schema } from "effect";
import * as P from "effect/Predicate";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";

const $I = $ScratchpadId.create("jsonc/JsoncNode");

/**
 * A single path segment: a `string` for object property keys or a `number`
 * for array indices.
 *
 * **Example** (Guard an array-index segment)
 *
 * ```ts
 * import { JsoncSegment } from "@beep/scratchpad/jsonc"
 * import { Schema } from "effect"
 *
 * console.log(Schema.is(JsoncSegment)(0)) // true
 * ```
 *
 * @see {@link JsoncPath} for the ordered sequence of these segments.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const JsoncSegment = Schema.Union([Schema.String, Schema.Finite]).pipe(
  $I.annoteSchema("JsoncSegment", {
    description: "One object-key or array-index segment in a JSONC path.",
  })
);

/**
 * Decoded JSONC path segment.
 *
 * @see {@link JsoncSegment} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type JsoncSegment = typeof JsoncSegment.Type;

/**
 * An ordered sequence of {@link JsoncSegment} values describing a location
 * within a JSONC document tree.
 *
 * **Example** (Construct a JSONC path)
 *
 * ```ts
 * import { JsoncPath } from "@beep/scratchpad/jsonc"
 *
 * const path = JsoncPath.make(["servers", 0, "port"])
 * console.log(path.length) // 3
 * ```
 *
 * @see {@link JsoncNode.find} for resolving a path against a tree.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const JsoncPath = Schema.Array(JsoncSegment).pipe(
  $I.annoteSchema("JsoncPath", {
    description: "An ordered sequence of object-key and array-index segments locating a JSONC value.",
  })
);

/**
 * Decoded JSONC path.
 *
 * @see {@link JsoncPath} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type JsoncPath = typeof JsoncPath.Type;

/**
 * Discriminator values for JSONC AST node types: the JSON value types
 * (`string`/`number`/`boolean`/`null`), the structural types
 * (`object`/`array`) and the `property` key-value pair type.
 *
 * **Example** (Narrow a node type literal)
 *
 * ```ts
 * import { JsoncNodeType } from "@beep/scratchpad/jsonc";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(JsoncNodeType)("object")); // true
 * console.log(S.is(JsoncNodeType)("property")); // true
 * console.log(S.is(JsoncNodeType)("comment")); // false
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const JsoncNodeType = Schema.Literals([
  "object",
  "array",
  "property",
  "string",
  "number",
  "boolean",
  "null",
]).pipe(
  $I.annoteSchema("JsoncNodeType", {
    description: "Discriminator literals for JSONC AST nodes: JSON values, object/array, and property.",
  })
);

/**
 * The union of all JSONC AST node type string literals.
 *
 * @see {@link JsoncNodeType} for the runtime literals schema.
 * @public
 * @category type-level
 * @since 0.0.0
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
 * **Gotchas**
 *
 * Parser-built trees cannot exceed {@link MAX_NESTING_DEPTH}. A tree assembled
 * via `JsoncNode.make` may nest past that cap; walkers then return a bounded
 * placeholder instead of overflowing — {@link JsoncNode.toValue} yields `{}` /
 * `[]` / `null`, and {@link JsoncNode.findAtOffset} / {@link JsoncNode.pathAt}
 * stop descending. That truncation is silent: there is no typed error.
 *
 * **Example** (Parse a tree, find a key, extract a value)
 *
 * ```ts
 * import { Jsonc } from "@beep/scratchpad/jsonc";
 * import { Result } from "effect";
 * import * as O from "effect/Option";
 *
 * const root = Result.getOrThrow(Jsonc.parseTreeResult('{ "port": 3000 // dev\n }'));
 * if (O.isSome(root)) {
 *   const port = root.value.find(["port"]);
 *   console.log(O.isSome(port) ? port.value.toValue() : undefined); // 3000
 *   console.log(root.value.toValue());
 * }
 * ```
 *
 * @see {@link MAX_NESTING_DEPTH} for the walker depth cap that hand-built trees can exceed.
 * @public
 * @category models
 * @since 0.0.0
 */
export class JsoncNode extends Schema.Class<JsoncNode>($I`JsoncNode`)(
  {
    type: JsoncNodeType,
    offset: Schema.Finite,
    length: Schema.Finite,
    value: Schema.optionalKey(Schema.Unknown),
    colonOffset: Schema.optionalKey(Schema.Finite),
    children: Schema.optionalKey(Schema.Array(Schema.suspend((): Schema.Schema<JsoncNode> => JsoncNode))),
  },
  $I.annote("JsoncNode", {
    description: "An immutable JSONC AST node with source spans and no parent pointers.",
  })
) {
  /**
   * Find a descendant node by path. String segments navigate object
   * properties; number segments navigate array indices. Returns
   * `Option.none()` when any segment cannot be resolved. Pure.
   *
   * **Example** (Resolve a property path)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   * import { Result } from "effect";
   * import * as O from "effect/Option";
   *
   * const root = Result.getOrThrow(Jsonc.parseTreeResult('{ "port": 3000 }'));
   * if (O.isSome(root)) {
   *   const port = root.value.find(["port"]);
   *   console.log(O.isSome(port) ? port.value.toValue() : undefined); // 3000
   *   console.log(O.isNone(root.value.find(["missing"]))); // true
   * }
   * ```
   *
   * @param path - The path to resolve, relative to this node.
   * @returns The descendant node, or `Option.none()` when `path` cannot be
   *   resolved.
   * @since 0.0.0
   */
  find(path: JsoncPath): Option.Option<JsoncNode> {
    let current: JsoncNode | undefined = this;

    for (const segment of path) {
      if (current?.children === undefined) {
        return Option.none();
      }
      if (P.isString(segment)) {
        if (current.type !== "object") return Option.none();
        const property: JsoncNode | undefined = current.children.find(
          (child) => child.type === "property" && child.children !== undefined && child.children[0]?.value === segment
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
   * **Gotchas**
   *
   * A hand-built tree nested past {@link MAX_NESTING_DEPTH} stops descending
   * and returns the node at the cap rather than overflowing; parser-built
   * trees cannot exceed the cap. That truncation is silent: there is no typed
   * error.
   *
   * **Example** (Locate the node covering a value)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   * import { Result } from "effect";
   * import * as O from "effect/Option";
   *
   * const text = '{ "port": 3000 }';
   * const root = Result.getOrThrow(Jsonc.parseTreeResult(text));
   * if (O.isSome(root)) {
   *   const node = root.value.findAtOffset(text.indexOf("3000"));
   *   console.log(O.isSome(node) ? node.value.toValue() : undefined); // 3000
   * }
   * ```
   *
   * @param offset - The zero-based character offset to locate.
   * @returns The innermost covering node, or `Option.none()` when `offset`
   *   falls outside this subtree.
   * @see {@link MAX_NESTING_DEPTH} for the walker depth cap that hand-built trees can exceed.
   * @since 0.0.0
   */
  findAtOffset(offset: number): Option.Option<JsoncNode> {
    return findAtOffsetImpl(this, offset, 0);
  }

  /**
   * Return the JSON path to the innermost node covering `offset`, or
   * `Option.none()` if the offset is outside this subtree. The inverse of
   * {@link JsoncNode.find}. Pure.
   *
   * **Gotchas**
   *
   * A hand-built tree nested past {@link MAX_NESTING_DEPTH} stops descending
   * and returns the path accumulated at the cap rather than overflowing;
   * parser-built trees cannot exceed the cap. That truncation is silent: there
   * is no typed error.
   *
   * **Example** (Recover the path at a value offset)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   * import { Result } from "effect";
   * import * as O from "effect/Option";
   *
   * const text = '{ "port": 3000 }';
   * const root = Result.getOrThrow(Jsonc.parseTreeResult(text));
   * if (O.isSome(root)) {
   *   const path = root.value.pathAt(text.indexOf("3000"));
   *   console.log(O.isSome(path) ? path.value : undefined); // ["port"]
   * }
   * ```
   *
   * @param offset - The zero-based character offset to locate.
   * @returns The path to the innermost covering node, or `Option.none()`
   *   when `offset` falls outside this subtree.
   * @see {@link MAX_NESTING_DEPTH} for the walker depth cap that hand-built trees can exceed.
   * @since 0.0.0
   */
  pathAt(offset: number): Option.Option<JsoncPath> {
    return buildPath(this, offset, []);
  }

  /**
   * Reconstruct the plain JavaScript value represented by this subtree. Pure
   * and total — never fails, so no `Effect` wrapper.
   *
   * **Gotchas**
   *
   * A `"__proto__"` property is defined as an own data property
   * (`Object.defineProperty`), matching `JSON.parse` — it never mutates
   * `Object.prototype`. A hand-built tree nested past
   * {@link MAX_NESTING_DEPTH} yields `{}` / `[]` / `null` instead of
   * overflowing; parser-built trees cannot exceed the cap. That truncation is
   * silent: there is no typed error.
   *
   * **Example** (Extract an object value)
   *
   * ```ts
   * import { Jsonc } from "@beep/scratchpad/jsonc";
   * import { Result } from "effect";
   * import * as O from "effect/Option";
   *
   * const root = Result.getOrThrow(Jsonc.parseTreeResult('{ "port": 3000 }'));
   * if (O.isSome(root)) {
   *   console.log(root.value.toValue()); // { port: 3000 }
   * }
   * ```
   *
   * @returns The plain JavaScript value (object, array, string, number,
   *   boolean or `null`) this subtree represents.
   * @see {@link MAX_NESTING_DEPTH} for the walker depth cap that hand-built trees can exceed.
   * @since 0.0.0
   */
  toValue(): unknown {
    return evaluateNode(this, 0);
  }
}

/**
 * Validation-free constructor used by the trusted tree builder in
 * `internal/parser.ts`. Not re-exported from the package barrel; external
 * callers construct via the validating {@link JsoncNode.make}.
 *
 * Assigns props onto `JsoncNode.prototype` so methods, branding and
 * structural equality match a `make`-built instance without re-parsing the
 * recursive `children` field.
 *
 * **Gotchas**
 *
 * Omit missing optional fields; never pass explicit `undefined` (that would
 * create an own property `make` would have rejected). Only the parser should
 * call this.
 *
 * **Example** (Build a trusted string leaf)
 *
 * ```ts
 * import { makeNodeUnsafe } from "../../jsonc/JsoncNode.ts";
 *
 * const leaf = makeNodeUnsafe({ type: "string", offset: 0, length: 5, value: "hello" });
 *
 * console.log(leaf.toValue()); // hello
 * ```
 *
 * @see {@link JsoncNode} for the validating constructor.
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeNodeUnsafe = (props: {
  readonly type: JsoncNodeType;
  readonly offset: number;
  readonly length: number;
  readonly value?: unknown;
  readonly colonOffset?: number;
  readonly children?: ReadonlyArray<JsoncNode>;
}): JsoncNode => JsoncNode.make(props);

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
  depth = 0
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
  return Match.value(node.type).pipe(
    Match.when("object", () => {
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
    }),
    Match.when("array", () => (node.children ?? []).map((child) => evaluateNode(child, depth + 1))),
    Match.when("property", () =>
      node.children?.[1] !== undefined ? evaluateNode(node.children[1], depth + 1) : undefined
    ),
    Match.orElse(() => node.value)
  );
}
