/**
 * Structural JSONC modification: compute the edits needed to set, replace or
 * delete a value at a path, without mutating the source.
 *
 * **Details**
 *
 * Navigation goes through the scanner-based `internal/navigate.ts`; this
 * module owns only edit synthesis and the `JsoncModificationError` it raises
 * on a navigation miss.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $JsoncId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { lineSpan } from "./internal/lines.ts";
import { NavigateContainer, NavigateResult, navigate } from "./internal/navigate.ts";
import { ParseFlags, parseTree } from "./internal/parser.ts";
import { Jsonc, JsoncStringifyOptions } from "./Jsonc.ts";
import { JsoncEdit, JsoncFormattingOptions, JsoncFormattingOptionsLike, JsoncRange } from "./JsoncEdit.ts";
import { JsoncFormatter } from "./JsoncFormatter.ts";
import { JsoncNodeType } from "./JsoncNode.ts";
import type { JsoncStringifyError } from "./Jsonc.ts";
import type { JsoncNode, JsoncPath, JsoncSegment } from "./JsoncNode.ts";

const $I = $JsoncId.create("JsoncModifier");

/**
 * Raised when `JsoncModifier.modify` cannot navigate the requested path: the
 * value at `depth` is not the container kind the next segment requires.
 *
 * **Details**
 *
 * - `path`: the full path passed to `JsoncModifier.modify`.
 * - `expected`: the container kind the segment at `depth` required.
 * - `depth`: the 1-based index into `path` where navigation failed.
 * - `offset`: reserved for a source-position annotation. `modify` reports the
 *   mismatch structurally and never sets it; when present, the message names it.
 *
 * The mismatch is carried as typed fields rather than a prose reason.
 *
 * **Example** (Inspect a structural mismatch)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { JsoncModifier } from "@beep/jsonc/JsoncModifier"
 *
 * const error = Effect.runSync(Effect.flip(JsoncModifier.modify('{ "a": 1 }', ["a", "b"], 2)))
 *
 * console.log(error._tag) // "JsoncModificationError"
 * console.log(error.message) // "Modification failed at path [a, b]: expected object at depth 2"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JsoncModificationError extends S.TaggedError<JsoncModificationError, { readonly brand: unique symbol }>(
  $I.make("JsoncModificationError")
)(
  "JsoncModificationError",
  {
    path: S.Array(S.Union([S.String, S.Finite])),
    expected: NavigateContainer,
    depth: S.Finite,
    offset: S.optionalKey(S.Finite),
  },
  $I.annoteError<JsoncModificationError>("JsoncModificationError", {
    description: "A path could not be navigated because a value was not the required container kind.",
  })
) {
  /**
   * Render the path, the optional source offset, the expected container kind
   * and the failing depth.
   *
   * **Example** (Read the rendered message)
   *
   * ```ts
   * import { JsoncModificationError } from "@beep/jsonc/JsoncModifier"
   *
   * const error = JsoncModificationError.make({ path: ["a", 0], expected: "array", depth: 2 })
   * const located = JsoncModificationError.make({ path: ["a", 0], expected: "array", depth: 2, offset: 7 })
   *
   * console.log(error.message) // "Modification failed at path [a, 0]: expected array at depth 2"
   * console.log(located.message) // "Modification failed at path [a, 0] (offset 7): expected array at depth 2"
   * ```
   */
  override get message(): string {
    const at = O.match(O.fromUndefinedOr(this.offset), {
      onNone: () => Str.empty,
      onSome: (offset) => ` (offset ${offset})`,
    });
    return `Modification failed at path [${A.join(A.map(this.path, String), ", ")}]${at}: expected ${this.expected} at depth ${this.depth}`;
  }
}

/**
 * Options for `JsoncModifier.modify`: formatting controls for generated text.
 *
 * **Details**
 *
 * `formattingOptions` accepts a {@link JsoncFormattingOptions} instance or a
 * plain literal; only `tabSize`, `insertSpaces` and `eol` affect generated
 * content. Modelled as a struct so callers pass a literal at the boundary.
 *
 * **Example** (Insert with tabs)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { JsoncEdit } from "@beep/jsonc/JsoncEdit"
 * import { JsoncModifier } from "@beep/jsonc/JsoncModifier"
 *
 * const edits = Effect.runSync(JsoncModifier.modify("{}", ["a"], { b: 1 }, { formattingOptions: { insertSpaces: false } }))
 *
 * console.log(JsoncEdit.applyAll("{}", edits)) // '{\n\t"a": {\n\t\t"b": 1\n\t}\n}'
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class JsoncModifyOptions extends S.Opaque<JsoncModifyOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    formattingOptions: S.optionalKey(JsoncFormattingOptionsLike),
  }).pipe(
    $I.annoteSchema("JsoncModifyOptions", {
      description: "Formatting controls for content generated by JsoncModifier.modify.",
    })
  )
) {}

/**
 * Companion types for {@link JsoncModifyOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JsoncModifyOptions {
  /**
   * The literal options bag accepted by {@link JsoncModifier.modify}: the
   * encoded side of {@link JsoncModifyOptions}, so a plain literal such as
   * `{ formattingOptions: { insertSpaces: false } }` is accepted.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof JsoncModifyOptions.Encoded;
}

/**
 * Why `JsoncModifier.modifyWithFormatting` could not place an edit although
 * every container on the path had the right kind.
 *
 * **Details**
 *
 * - `DeleteInEmptyDocument`: a delete whose parent path does not exist.
 * - `IndexOutOfRange`: an array index or `insertionIndex` past the end of
 *   its container.
 *
 * **Example** (Guard a placement failure)
 *
 * ```ts
 * import { JsoncPlacementFailure } from "@beep/jsonc/JsoncModifier"
 *
 * console.log(JsoncPlacementFailure.is.IndexOutOfRange("IndexOutOfRange")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsoncPlacementFailure = LiteralKit(["DeleteInEmptyDocument", "IndexOutOfRange"]).pipe(
  $I.annoteSchema("JsoncPlacementFailure", {
    description: "Why a formatted modification could not be placed in the document.",
  })
);

/**
 * Decoded value produced by {@link JsoncPlacementFailure}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JsoncPlacementFailure = typeof JsoncPlacementFailure.Type;

/**
 * Raised when `JsoncModifier.modifyWithFormatting` cannot place its edit: a
 * delete under a missing parent, or an index past the end of its container.
 *
 * **Example** (Read the rendered message)
 *
 * ```ts
 * import { JsoncPlacementError } from "@beep/jsonc/JsoncModifier"
 *
 * const error = JsoncPlacementError.make({ path: ["a", 3], reason: "IndexOutOfRange" })
 *
 * console.log(error.message) // "Modification failed at path [a, 3]: IndexOutOfRange"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class JsoncPlacementError extends S.TaggedError<JsoncPlacementError, { readonly brand: unique symbol }>(
  $I.make("JsoncPlacementError")
)(
  "JsoncPlacementError",
  {
    path: S.Array(S.Union([S.String, S.Finite])),
    reason: JsoncPlacementFailure,
  },
  $I.annoteError<JsoncPlacementError>("JsoncPlacementError", {
    description:
      "A formatted modification could not be placed: a delete under a missing parent or an index past the end.",
  })
) {
  /**
   * Render the path and the reason.
   *
   * **Example** (Read the rendered message)
   *
   * ```ts
   * import { JsoncPlacementError } from "@beep/jsonc/JsoncModifier"
   *
   * console.log(JsoncPlacementError.make({ path: [], reason: "DeleteInEmptyDocument" }).message)
   * // "Modification failed at path []: DeleteInEmptyDocument"
   * ```
   */
  override get message(): string {
    return `Modification failed at path [${A.join(A.map(this.path, String), ", ")}]: ${this.reason}`;
  }
}

/**
 * Options for `JsoncModifier.modifyWithFormatting`.
 *
 * **Details**
 *
 * - `formattingOptions`: when present, the edit is followed by a format pass
 *   over the lines it touches and the two are merged into one edit; when
 *   absent, the raw edit with compact JSON content is returned.
 * - `isArrayInsertion`: a numeric last segment inserts before that index
 *   instead of replacing the element there.
 * - `insertionIndex`: where a new object property goes among its siblings
 *   (default: after the last one).
 *
 * **Example** (Insert a property first)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import { JsoncEdit } from "@beep/jsonc/JsoncEdit"
 * import { JsoncModifier } from "@beep/jsonc/JsoncModifier"
 *
 * const text = '{\n  "b": 1\n}'
 * const edits = Result.getOrThrow(
 *   JsoncModifier.modifyWithFormattingResult(text, ["a"], 0, { formattingOptions: {}, insertionIndex: 0 })
 * )
 *
 * console.log(JsoncEdit.applyAll(text, edits)) // '{\n  "a": 0,\n  "b": 1\n}'
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class JsoncFormattedModifyOptions extends S.Opaque<
  JsoncFormattedModifyOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    formattingOptions: S.optionalKey(JsoncFormattingOptionsLike),
    isArrayInsertion: S.optionalKey(S.Boolean),
    insertionIndex: S.optionalKey(S.Natural),
  }).pipe(
    $I.annoteSchema("JsoncFormattedModifyOptions", {
      description: "Formatting, array-insertion and property-position controls for a formatted modification.",
    })
  )
) {}

/**
 * Encoded companion types for {@link JsoncFormattedModifyOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JsoncFormattedModifyOptions {
  /**
   * The plain options literal `JsoncModifier.modifyWithFormatting` accepts.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof JsoncFormattedModifyOptions.Encoded;
}

const edits = (...items: ReadonlyArray<JsoncEdit>): ReadonlyArray<JsoncEdit> => items;

type Modify = Effect.Effect<ReadonlyArray<JsoncEdit>, JsoncStringifyError | JsoncModificationError>;

type FormattedModify = Result.Result<
  ReadonlyArray<JsoncEdit>,
  JsoncStringifyError | JsoncModificationError | JsoncPlacementError
>;

// The formatted modification is a port of `modify` (`setProperty` and
// `withFormatting`) of Microsoft's `jsonc-parser` 3.3.1 (MIT): a raw edit
// with compact JSON content, then a format pass over the lines it touches.

const compactJson = JsoncStringifyOptions.make({ tabSize: 0 });
const serializeCompact = (value: unknown): Result.Result<string, JsoncStringifyError> =>
  Jsonc.stringifyResult(value, compactJson);
// Upstream parses with its default flags and ignores every error.
const treeFlags = ParseFlags.make({ allowTrailingComma: false });

const valueOfProperty = (property: JsoncNode): O.Option<JsoncNode> =>
  property.children !== undefined && property.children.length === 2 ? A.get(property.children, 1) : O.none();
const keyOfProperty = (property: JsoncNode): unknown => property.children?.[0]?.value;

// The first property named `key` that carries a value, as upstream's
// `findNodeAtLocation` reads an object.
const propertyIndexOf = (children: ReadonlyArray<JsoncNode>, key: string): O.Option<number> =>
  A.findFirstIndex(children, (property) => O.isSome(valueOfProperty(property)) && keyOfProperty(property) === key);

const childOf = (node: JsoncNode, segment: JsoncSegment): O.Option<JsoncNode> => {
  const children = node.children ?? A.empty<JsoncNode>();
  if (P.isString(segment)) {
    return JsoncNodeType.is.object(node.type)
      ? O.flatMap(propertyIndexOf(children, segment), (index) => O.flatMap(A.get(children, index), valueOfProperty))
      : O.none();
  }
  return JsoncNodeType.is.array(node.type) ? A.get(children, segment) : O.none();
};

const locate = (root: O.Option<JsoncNode>, path: ReadonlyArray<JsoncSegment>): O.Option<JsoncNode> =>
  A.reduce(path, root, (current, segment) => O.flatMap(current, (node) => childOf(node, segment)));

const rawEdit = (offset: number, length: number, content: string): JsoncEdit =>
  JsoncEdit.make({ offset, length, content });
const end = (node: JsoncNode): number => node.offset + node.length;

const placementError = (path: JsoncPath, reason: JsoncPlacementFailure) =>
  Result.fail(JsoncPlacementError.make({ path, reason }));

type PlacedEdit = Result.Result<O.Option<JsoncEdit>, JsoncStringifyError | JsoncPlacementError>;

// Remove a property with the comma of the previous property, or of the next one.
const deleteProperty = (parent: JsoncNode, children: ReadonlyArray<JsoncNode>, index: number): JsoncEdit => {
  const property = children[index] as JsoncNode;
  const removeBegin = index > 0 ? end(children[index - 1] as JsoncNode) : parent.offset + 1;
  const removeEnd = index === 0 && children.length > 1 ? (children[1] as JsoncNode).offset : end(property);
  return rawEdit(removeBegin, removeEnd - removeBegin, "");
};

const insertProperty = (
  parent: JsoncNode,
  children: ReadonlyArray<JsoncNode>,
  property: string,
  index: number
): JsoncEdit => {
  if (index > 0) {
    return rawEdit(end(children[index - 1] as JsoncNode), 0, `,${property}`);
  }
  return rawEdit(parent.offset + 1, 0, children.length === 0 ? property : `${property},`);
};

const newProperty = (key: string, value: unknown): Result.Result<string, JsoncStringifyError> =>
  Result.flatMap(serializeCompact(key), (name) =>
    Result.map(serializeCompact(value), (content) => `${name}: ${content}`)
  );

// Delete, replace or insert a property of `parent`.
const objectEdit = (
  parent: JsoncNode,
  children: ReadonlyArray<JsoncNode>,
  path: JsoncPath,
  key: string,
  value: unknown,
  insertionIndex: O.Option<number>
): PlacedEdit => {
  const existing = propertyIndexOf(children, key);
  if (O.isSome(existing)) {
    if (P.isUndefined(value)) {
      return Result.succeed(O.some(deleteProperty(parent, children, existing.value)));
    }
    const valueNode = O.getOrThrow(valueOfProperty(children[existing.value] as JsoncNode));
    return Result.map(serializeCompact(value), (content) =>
      O.some(rawEdit(valueNode.offset, valueNode.length, content))
    );
  }
  if (P.isUndefined(value)) {
    return Result.succeed(O.none());
  }
  const index = O.getOrElse(insertionIndex, () => children.length);
  return index > children.length
    ? placementError(path, "IndexOutOfRange")
    : Result.map(newProperty(key, value), (property) => O.some(insertProperty(parent, children, property, index)));
};

// Remove an element: the only one, the last one with the comma before it, or
// any other with the gap up to the next one. The last one's removal ends at the
// element itself: jsonc-parser ends it two characters before the parent's end,
// which joins `[1,2]` into `[12]` and cuts a trailing comment.
const deleteElement = (
  parent: JsoncNode,
  children: ReadonlyArray<JsoncNode>,
  path: JsoncPath,
  index: number
): PlacedEdit => {
  if (children.length === 1) {
    return Result.succeed(O.some(rawEdit(parent.offset + 1, parent.length - 2, "")));
  }
  if (index >= children.length || children.length === 0) {
    return placementError(path, "IndexOutOfRange");
  }
  if (index === children.length - 1) {
    const offset = end(children[index - 1] as JsoncNode);
    return Result.succeed(O.some(rawEdit(offset, end(children[index] as JsoncNode) - offset, "")));
  }
  const removed = children[index] as JsoncNode;
  return Result.succeed(
    O.some(rawEdit(removed.offset, (children[index + 1] as JsoncNode).offset - removed.offset, ""))
  );
};

// Replace an element, or insert one before `index` (appending past the end).
const setElement = (
  parent: JsoncNode,
  children: ReadonlyArray<JsoncNode>,
  index: number,
  content: string,
  isArrayInsertion: boolean
): JsoncEdit => {
  if (!isArrayInsertion && children.length > index) {
    const replaced = children[index] as JsoncNode;
    return rawEdit(replaced.offset, replaced.length, content);
  }
  if (children.length === 0 || index === 0) {
    return rawEdit(parent.offset + 1, 0, children.length === 0 ? content : `${content},`);
  }
  const previous = children[Math.min(index, children.length) - 1] as JsoncNode;
  return rawEdit(end(previous), 0, `,${content}`);
};

const arrayEdit = (
  parent: JsoncNode,
  children: ReadonlyArray<JsoncNode>,
  path: JsoncPath,
  index: number,
  value: unknown,
  isArrayInsertion: boolean
): PlacedEdit =>
  P.isUndefined(value)
    ? deleteElement(parent, children, path, index)
    : Result.map(serializeCompact(value), (content) =>
        O.some(setElement(parent, children, index, content, isArrayInsertion))
      );

// Walk up to the deepest existing parent, wrapping the value in the
// containers the missing segments name.
const deepestParent = (root: O.Option<JsoncNode>, path: JsoncPath, value: unknown) => {
  let depth = path.length;
  let wrapped = value;
  let parent = O.none<JsoncNode>();
  while (depth > 0) {
    const segment = path[depth - 1] as JsoncSegment;
    parent = locate(root, A.take(path, depth - 1));
    if (O.isSome(parent) || P.isUndefined(wrapped)) {
      break;
    }
    wrapped = P.isString(segment) ? R.singleton(segment, wrapped) : A.of(wrapped);
    depth--;
  }
  return { depth, wrapped, parent };
};

// With no parent left, the whole document (or the empty text) is replaced.
const documentEdit = (root: O.Option<JsoncNode>, path: JsoncPath, wrapped: unknown): PlacedEdit =>
  P.isUndefined(wrapped)
    ? placementError(path, "DeleteInEmptyDocument")
    : Result.map(serializeCompact(wrapped), (content) =>
        O.some(
          O.match(root, {
            onNone: () => rawEdit(0, 0, content),
            onSome: (node) => rawEdit(node.offset, node.length, content),
          })
        )
      );

const containerEdit = (
  node: JsoncNode,
  path: JsoncPath,
  depth: number,
  wrapped: unknown,
  options: JsoncFormattedModifyOptions.Encoded
): Result.Result<O.Option<JsoncEdit>, JsoncStringifyError | JsoncModificationError | JsoncPlacementError> => {
  const segment = path[depth - 1] as JsoncSegment;
  // A scalar parent has no children; it fails below.
  const children = node.children ?? A.empty<JsoncNode>();
  if (JsoncNodeType.is.object(node.type) && P.isString(segment)) {
    return objectEdit(node, children, path, segment, wrapped, O.fromUndefinedOr(options.insertionIndex));
  }
  if (JsoncNodeType.is.array(node.type) && P.isNumber(segment)) {
    return arrayEdit(node, children, path, segment, wrapped, options.isArrayInsertion === true);
  }
  return Result.fail(JsoncModificationError.make({ path, expected: P.isString(segment) ? "object" : "array", depth }));
};

const placeEdit = (
  text: string,
  path: JsoncPath,
  value: unknown,
  options: JsoncFormattedModifyOptions.Encoded
): Result.Result<O.Option<JsoncEdit>, JsoncStringifyError | JsoncModificationError | JsoncPlacementError> => {
  const root = parseTree(text, treeFlags).root;
  const { depth, wrapped, parent } = deepestParent(root, path, value);
  return O.match(parent, {
    onNone: () => documentEdit(root, path, wrapped),
    onSome: (node) => containerEdit(node, path, depth, wrapped, options),
  });
};

const spliceEdit = (text: string, edit: JsoncEdit): string =>
  Str.substring(0, edit.offset)(text) + edit.content + Str.substring(edit.offset + edit.length)(text);

// Apply `edit`, format the lines it touches, and merge both into one edit.
const withFormatting = (text: string, edit: JsoncEdit, formatting: JsoncFormattingOptionsLike): JsoncEdit => {
  let next = spliceEdit(text, edit);
  const touched = edit.offset + edit.content.length;
  // An insertion or a removal formats the whole lines around it.
  let [begin, finish] =
    edit.length === 0 || edit.content.length === 0 ? lineSpan(next, edit.offset, touched) : [edit.offset, touched];
  const formats = JsoncFormatter.format(next, JsoncRange.make({ offset: begin, length: finish - begin }), {
    ...formatting,
    keepLines: false,
  });
  for (const format of A.reverse(formats)) {
    next = spliceEdit(next, format);
    begin = Math.min(begin, format.offset);
    finish = Math.max(finish, format.offset + format.length) + format.content.length - format.length;
  }
  return rawEdit(begin, text.length - (next.length - finish) - begin, Str.substring(begin, finish)(next));
};

const modifyWithFormattingImpl = (
  text: string,
  path: JsoncPath,
  value: unknown,
  options: JsoncFormattedModifyOptions.Encoded
): FormattedModify =>
  Result.map(placeEdit(text, path, value, options), (placed) =>
    O.match(placed, {
      onNone: () => edits(),
      onSome: (edit) =>
        P.isUndefined(options.formattingOptions)
          ? edits(edit)
          : edits(withFormatting(text, edit, options.formattingOptions)),
    })
  );

/**
 * Sets, replaces or deletes a value at a path in JSONC text, as byte-minimal
 * edits that leave comments and formatting elsewhere untouched. Not
 * instantiable.
 *
 * **Example** (Change one value and keep the comment)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { JsoncEdit } from "@beep/jsonc/JsoncEdit"
 * import { JsoncModifier } from "@beep/jsonc/JsoncModifier"
 *
 * const text = '{\n  // dev port\n  "port": 3000\n}'
 * const edits = Effect.runSync(JsoncModifier.modify(text, ["port"], 8080))
 *
 * console.log(JsoncEdit.applyAll(text, edits)) // '{\n  // dev port\n  "port": 8080\n}'
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export abstract class JsoncModifier {
  /**
   * Compute the edits that set, replace or delete `value` at `path` in `text`.
   *
   * **Details**
   *
   * Passing `value === undefined` deletes the target property or element,
   * including its surrounding comma. A missing insertion target appends after
   * the last property or element, with multi-line values re-indented to the
   * insertion depth. Line breaks inside a generated value stay `\n`, as
   * `JSON.stringify` writes them; the configured `eol` applies only to the
   * line breaks around an inserted entry. The empty path replaces the whole
   * document.
   * Fails with {@link JsoncModificationError} on a structural mismatch and
   * with `JsoncStringifyError` when `value` cannot be serialized.
   *
   * **Example** (Insert one member and delete another)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import { JsoncEdit } from "@beep/jsonc/JsoncEdit"
   * import { JsoncModifier } from "@beep/jsonc/JsoncModifier"
   *
   * const text = '{ "port": 3000, "debug": true }'
   * const inserted = JsoncEdit.applyAll(text, Effect.runSync(JsoncModifier.modify(text, ["host"], "localhost")))
   *
   * console.log(inserted) // '{ "port": 3000, "debug": true,\n  "host": "localhost" }'
   * console.log(JsoncEdit.applyAll(text, Effect.runSync(JsoncModifier.modify(text, ["debug"], undefined)))) // '{ "port": 3000 }'
   * ```
   *
   * @param text - The JSONC source to modify.
   * @param path - The location to set, replace or delete.
   * @param value - The plain JavaScript value to write; `undefined` deletes.
   * @param options - Formatting controls for generated content.
   * @returns The edits to apply with `JsoncEdit.applyAll`.
   */
  static readonly modify: {
    (text: string, path: JsoncPath, value: unknown, options?: JsoncModifyOptions.Encoded): Modify;
    (path: JsoncPath, value: unknown, options?: JsoncModifyOptions.Encoded): (text: string) => Modify;
  } = dual(
    (args) => P.isString(args[0]),
    Effect.fn("JsoncModifier.modify")(function* (
      text: string,
      path: JsoncPath,
      value: unknown,
      options?: JsoncModifyOptions.Encoded
    ) {
      const fmt = JsoncFormattingOptions.make(options?.formattingOptions ?? R.empty());
      const indentUnit = fmt.insertSpaces ? Str.repeat(fmt.tabSize)(" ") : "\t";
      const stringifyOptions = JsoncStringifyOptions.make({
        tabSize: fmt.tabSize,
        insertSpaces: fmt.insertSpaces,
      });
      const serialize = (): Effect.Effect<string, JsoncStringifyError> => Jsonc.stringify(value, stringifyOptions);
      const deleting = P.isUndefined(value);

      if (!A.isReadonlyArrayNonEmpty(path)) {
        const content = deleting ? Str.empty : yield* serialize();
        return edits(JsoncEdit.make({ offset: 0, length: text.length, content }));
      }

      return yield* NavigateResult.match(navigate(text, path), {
        Mismatch: ({ depth, expected }): Modify =>
          Effect.fail(
            JsoncModificationError.make({
              path,
              expected,
              depth,
            })
          ),
        NoOp: (): Modify => Effect.succeed(edits()),
        Located: (located): Modify => {
          if (!deleting) {
            return Effect.map(serialize(), (content) =>
              edits(
                JsoncEdit.make({
                  offset: located.valueStart,
                  length: located.valueEnd - located.valueStart,
                  content,
                })
              )
            );
          }
          // Comma positions come from scanner tokens, never from searching the
          // raw text, so commas inside comments are invisible here. The entry
          // takes its preceding comma with it, or its following comma when it
          // is the first entry.
          const removeStart = O.getOrElse(located.commaBefore, () => located.keyStart);
          const removeEnd =
            O.isNone(located.commaBefore) && O.isSome(located.commaAfter)
              ? located.commaAfter.value + 1
              : located.valueEnd;
          return Effect.succeed(
            edits(
              JsoncEdit.make({
                offset: removeStart,
                length: removeEnd - removeStart,
                content: "",
              })
            )
          );
        },
        Insert: (insert): Modify =>
          deleting
            ? Effect.succeed(edits())
            : Effect.gen(function* () {
                const indent = Str.repeat(insert.depth)(indentUnit);
                const outdent = Str.repeat(insert.depth - 1)(indentUnit);
                // Generated multi-line values are re-indented to the insertion
                // depth so a nested object lands at the same column as its siblings.
                // The value keeps JSON.stringify's own "\n" line breaks (upstream);
                // `eol` belongs to the wrapper around the entry only.
                const serialized = Str.replaceAll("\n", `\n${indent}`)(yield* serialize());
                const entry = NavigateContainer.is.object(insert.container)
                  ? `${yield* Jsonc.stringify(String(A.lastNonEmpty(path)))}: ${serialized}`
                  : serialized;
                const content = insert.isFirst
                  ? `${fmt.eol}${indent}${entry}${fmt.eol}${outdent}`
                  : `,${fmt.eol}${indent}${entry}`;
                return edits(
                  JsoncEdit.make({
                    offset: insert.at,
                    length: 0,
                    content,
                  })
                );
              }),
      });
    })
  );

  /**
   * Compute the edit that sets, replaces or deletes the value at `path`, then
   * formats the lines it touches, as one edit.
   *
   * **Details**
   *
   * A port of `modify` from Microsoft's `jsonc-parser` 3.3.1, byte for byte:
   * the value is written as compact JSON and, when `formattingOptions` is
   * given, the touched lines are formatted with them. Missing parents are
   * created by wrapping the value; deleting a missing property is a no-op.
   * Use {@link JsoncModifier.modify} for byte-minimal edits instead.
   *
   * **Gotchas**
   *
   * One deliberate divergence: deleting the last element of an array ends at
   * the element. jsonc-parser ends that removal two characters before the
   * closing bracket, so `[1,2]` becomes `[12]` and a trailing comment is cut.
   *
   * **Example** (Replace a nested value)
   *
   * ```ts
   * import * as Result from "effect/Result"
   * import { JsoncEdit } from "@beep/jsonc/JsoncEdit"
   * import { JsoncModifier } from "@beep/jsonc/JsoncModifier"
   *
   * const text = '{\n  "a": 1 // keep\n}'
   * const edits = Result.getOrThrow(
   *   JsoncModifier.modifyWithFormattingResult(text, ["a"], { b: [] }, { formattingOptions: {} })
   * )
   *
   * console.log(JsoncEdit.applyAll(text, edits)) // '{\n  "a": {\n    "b": []\n  } // keep\n}'
   * ```
   *
   * @param text - The JSONC source.
   * @param path - Path to the value; `[]` addresses the whole document.
   * @param value - The value to write, or `undefined` to delete.
   * @param options - Formatting, array-insertion and property-position controls.
   * @returns Zero or one edit, or a typed failure.
   */
  static readonly modifyWithFormattingResult: {
    (text: string, path: JsoncPath, value: unknown, options?: JsoncFormattedModifyOptions.Encoded): FormattedModify;
    (path: JsoncPath, value: unknown, options?: JsoncFormattedModifyOptions.Encoded): (text: string) => FormattedModify;
  } = dual(
    (args) => P.isString(args[0]),
    (text: string, path: JsoncPath, value: unknown, options?: JsoncFormattedModifyOptions.Encoded): FormattedModify =>
      modifyWithFormattingImpl(text, path, value, options ?? R.empty())
  );

  /**
   * Effect twin of {@link JsoncModifier.modifyWithFormattingResult}.
   *
   * **Example** (Delete a property)
   *
   * ```ts
   * import * as Effect from "effect/Effect"
   * import { JsoncEdit } from "@beep/jsonc/JsoncEdit"
   * import { JsoncModifier } from "@beep/jsonc/JsoncModifier"
   *
   * const text = '{\n  "a": 1,\n  "b": 2\n}'
   * const edits = Effect.runSync(JsoncModifier.modifyWithFormatting(text, ["b"], undefined, { formattingOptions: {} }))
   *
   * console.log(JsoncEdit.applyAll(text, edits)) // '{\n  "a": 1\n}'
   * ```
   *
   * @param text - The JSONC source.
   * @param path - Path to the value; `[]` addresses the whole document.
   * @param value - The value to write, or `undefined` to delete.
   * @param options - Formatting, array-insertion and property-position controls.
   * @returns Zero or one edit, or a typed failure.
   */
  static readonly modifyWithFormatting: {
    (
      text: string,
      path: JsoncPath,
      value: unknown,
      options?: JsoncFormattedModifyOptions.Encoded
    ): Effect.Effect<ReadonlyArray<JsoncEdit>, JsoncStringifyError | JsoncModificationError | JsoncPlacementError>;
    (
      path: JsoncPath,
      value: unknown,
      options?: JsoncFormattedModifyOptions.Encoded
    ): (
      text: string
    ) => Effect.Effect<ReadonlyArray<JsoncEdit>, JsoncStringifyError | JsoncModificationError | JsoncPlacementError>;
  } = dual(
    (args) => P.isString(args[0]),
    Effect.fn("JsoncModifier.modifyWithFormatting")(
      (text: string, path: JsoncPath, value: unknown, options?: JsoncFormattedModifyOptions.Encoded) =>
        Effect.fromResult(modifyWithFormattingImpl(text, path, value, options ?? R.empty()))
    )
  );
}
