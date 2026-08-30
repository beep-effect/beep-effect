/**
 * Structural JSONC modification: compute the edits needed to set, replace or
 * delete a value at a path, without mutating the source.
 *
 * **Details**
 *
 * Navigation goes through the scanner-based `internal/navigate.ts` (a
 * correctness fix over v3's fragile string search); this module owns only edit
 * synthesis and the `JsoncModificationError` it raises on a navigation miss.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Effect, Match, Schema } from "effect";
import type { Insert, Located } from "./internal/navigate.ts";
import { navigate } from "./internal/navigate.ts";
import { Jsonc, JsoncStringifyOptions } from "./Jsonc.ts";
import { JsoncEdit, JsoncFormattingOptionsLike } from "./JsoncEdit.ts";
import type { JsoncPath } from "./JsoncNode.ts";

const $I = $ScratchpadId.create("jsonc/JsoncModifier");

/**
 * Raised when `JsoncModifier.modify` cannot navigate the requested path: the
 * value at `depth` is not the container kind (`expected`) the next path segment
 * requires.
 *
 * **Details**
 *
 * - `path` — the full path that was passed to `JsoncModifier.modify`.
 * - `expected` — the container kind (`"object"` or `"array"`) the segment at
 *   `depth` required.
 * - `depth` — the 1-based index into `path` where navigation failed.
 * - `offset` — reserved for a future source-position annotation; currently
 *   always omitted (navigation reports the mismatch structurally, without a
 *   text offset).
 *
 * Follows the structure-preserving-errors house rule — the mismatch's
 * discriminating data is carried as typed fields (`path`, `expected`, `depth`,
 * optional `offset`), not collapsed into a `reason: string`. This mirrors
 * `YamlModificationError`'s posture (its fields differ because the underlying
 * failures differ; the jsonc/yaml parity convention binds `Edit`/`Range`/`Path`,
 * not this error).
 *
 * **Gotchas**
 *
 * `offset` is reserved and currently omitted — navigation is structural, so
 * callers must not expect a source span on this error.
 *
 * **Example** (Catch a path mismatch)
 *
 * ```ts
 * import { JsoncModificationError, JsoncModifier } from "@beep/scratchpad/jsonc";
 * import { Effect, Result } from "effect";
 *
 * const failed = Effect.runSync(Effect.result(JsoncModifier.modify("[1, 2]", ["name"], "x")));
 * if (Result.isFailure(failed) && failed.failure instanceof JsoncModificationError) {
 *   console.log(failed.failure.expected); // "object"
 *   console.log(failed.failure.depth); // 1
 * }
 * ```
 *
 * @see {@link JsoncModifier.modify} for the only producer of this error.
 * @public
 * @category errors
 * @since 0.0.0
 */
export class JsoncModificationError extends Schema.TaggedError<JsoncModificationError>($I`JsoncModificationError`)(
  "JsoncModificationError",
  {
    path: Schema.Array(Schema.Union([Schema.String, Schema.Finite])),
    expected: Schema.Literals(["object", "array"]),
    depth: Schema.Finite,
    offset: Schema.optionalKey(Schema.Finite),
  },
  $I.annote("JsoncModificationError", {
    description: "Path-navigation miss from JsoncModifier.modify: expected container kind at depth.",
  })
) {
  /**
   * One-line summary of the failed path, expected container kind, and depth.
   *
   * **Example** (Read a path-mismatch message)
   *
   * ```ts
   * import { JsoncModificationError, JsoncModifier } from "@beep/scratchpad/jsonc";
   * import { Effect, Result } from "effect";
   *
   * const failed = Effect.runSync(Effect.result(JsoncModifier.modify("[1, 2]", ["name"], "x")));
   * if (Result.isFailure(failed) && failed.failure instanceof JsoncModificationError) {
   *   console.log(failed.failure.message.includes("expected object")); // true
   *   console.log(failed.failure.message.includes("depth 1")); // true
   * }
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    const at = this.offset !== undefined ? ` (offset ${this.offset})` : "";
    return `Modification failed at path [${this.path.join(", ")}]${at}: expected ${this.expected} at depth ${this.depth}`;
  }
}

/**
 * Options for `JsoncModifier.modify`: formatting controls for generated text.
 *
 * **Example** (Construct modification options)
 *
 * ```ts
 * import { JsoncModifyOptions } from "@beep/scratchpad/jsonc"
 *
 * const options = JsoncModifyOptions.make({ formattingOptions: { insertSpaces: false } })
 * console.log(options.formattingOptions?.insertSpaces) // false
 * ```
 *
 * @see {@link JsoncFormattingOptionsLike} for the accepted formatting shape.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export const JsoncModifyOptions = Schema.Struct({
  /**
   * Formatting applied to inserted/replaced content (indentation, EOL,
   * spacing). Accepts a `JsoncFormattingOptions` instance or a plain literal
   * (e.g. `{ insertSpaces: false, tabSize: 2 }`) — see
   * {@link JsoncFormattingOptionsLike}.
   */
  formattingOptions: Schema.optionalKey(JsoncFormattingOptionsLike),
}).pipe(
  $I.annoteSchema("JsoncModifyOptions", {
    description: "Formatting configuration for structural JSONC modifications.",
  })
);

/**
 * Decoded structural JSONC modification options.
 *
 * @see {@link JsoncModifyOptions} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type JsoncModifyOptions = typeof JsoncModifyOptions.Type;

/**
 * Structural JSONC modification statics. Not instantiable. Path modify/delete
 * is the comment-preserving alternative to a parse/stringify round-trip:
 * apply the returned edits with {@link JsoncEdit.applyAll}.
 *
 * **Example** (Set a key, then delete it)
 *
 * ```ts
 * import { JsoncEdit, JsoncModifier } from "@beep/scratchpad/jsonc";
 * import { Effect } from "effect";
 *
 * const source = '{ "port": 3000 // keep\n }';
 * const setEdits = Effect.runSync(JsoncModifier.modify(source, ["port"], 8080));
 * const updated = JsoncEdit.applyAll(source, setEdits);
 * console.log(updated.includes("8080")); // true
 * console.log(updated.includes("// keep")); // true
 *
 * const deleteEdits = Effect.runSync(JsoncModifier.modify(updated, ["port"], undefined));
 * const removed = JsoncEdit.applyAll(updated, deleteEdits);
 * console.log(removed.includes("port")); // false
 * ```
 *
 * @see {@link JsoncEdit.applyAll} for applying the computed edits.
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class JsoncModifier {
  private constructor() {}

  /**
   * Compute the edits that set, replace or delete `value` at `path` in `text`.
   *
   * Passing `value === undefined` deletes the target property or element
   * (including its surrounding comma). A missing insertion target appends after
   * the last property/element. Fails with {@link JsoncModificationError} on a
   * structural mismatch.
   *
   * @param text - The JSONC source to modify.
   * @param path - The location to set, replace or delete; `[]` replaces the
   *   whole document.
   * @param value - The plain JavaScript value to write, serialized with
   *   `JSON.stringify`; `undefined` deletes the target instead.
   * @param options - Optional {@link JsoncModifyOptions} controlling
   *   formatting of generated content.
   * @see {@link JsoncEdit.applyAll} for applying the successful edit list.
   */
  static readonly modify = Effect.fn("JsoncModifier.modify")(function* (
    text: string,
    path: JsoncPath,
    value: unknown,
    options?: JsoncModifyOptions
  ) {
    const fmt = options?.formattingOptions;
    const tabSize = fmt?.tabSize ?? 2;
    const insertSpaces = fmt?.insertSpaces ?? true;
    const eol = fmt?.eol ?? "\n";
    const indentUnit = insertSpaces ? " ".repeat(tabSize) : "\t";
    const stringifyOptions = JsoncStringifyOptions.make({ tabSize, insertSpaces });
    const stringify = (input: unknown) => Jsonc.stringify(input, stringifyOptions);

    if (path.length === 0) {
      const content = value === undefined ? "" : yield* stringify(value);
      return [JsoncEdit.make({ offset: 0, length: text.length, content })] as ReadonlyArray<JsoncEdit>;
    }

    const result = navigate(text, path);
    const modifyLocated = Effect.fnUntraced(function* (result: Located) {
      if (value === undefined) {
        // Comma positions come from navigate()'s scanner tokens, never from
        // searching the raw text — commas inside comments are invisible here.
        let removeStart = result.keyStart;
        let removeEnd = result.valueEnd;
        if (result.commaBefore !== undefined) {
          removeStart = result.commaBefore;
        } else if (result.commaAfter !== undefined) {
          removeEnd = result.commaAfter + 1;
        }
        return [
          JsoncEdit.make({ offset: removeStart, length: removeEnd - removeStart, content: "" }),
        ] as ReadonlyArray<JsoncEdit>;
      }
      const serialized = yield* stringify(value);
      return [
        JsoncEdit.make({
          offset: result.valueStart,
          length: result.valueEnd - result.valueStart,
          content: serialized,
        }),
      ] as ReadonlyArray<JsoncEdit>;
    });
    const modifyInsert = Effect.fnUntraced(function* (result: Insert) {
      if (value === undefined) {
        return [] as ReadonlyArray<JsoncEdit>;
      }
      const serialized = yield* stringify(value);
      const indent = indentUnit.repeat(result.depth);
      const outdent = indentUnit.repeat(result.depth - 1);
      if (result.container === "object") {
        const key = yield* stringify(String(path[path.length - 1]));
        const insertText = result.isFirst
          ? `${eol}${indent}${key}: ${serialized}${eol}${outdent}`
          : `,${eol}${indent}${key}: ${serialized}`;
        return [JsoncEdit.make({ offset: result.at, length: 0, content: insertText })] as ReadonlyArray<JsoncEdit>;
      }
      const insertText = result.isFirst
        ? `${eol}${indent}${serialized}${eol}${outdent}`
        : `,${eol}${indent}${serialized}`;
      return [JsoncEdit.make({ offset: result.at, length: 0, content: insertText })] as ReadonlyArray<JsoncEdit>;
    });

    return yield* Match.value(result).pipe(
      Match.tagsExhaustive({
        Mismatch: (result) =>
          Effect.fail(
            JsoncModificationError.make({
              path,
              expected: result.expected,
              depth: result.depth,
            })
          ),
        NoOp: () => Effect.succeed([] as ReadonlyArray<JsoncEdit>),
        Located: modifyLocated,
        Insert: modifyInsert,
      })
    );
  });
}
