/**
 * Shared JSONC editing helpers for the repo CLI.
 *
 * Config-sync command groups (TsconfigSync, CreatePackage, VersionSync) each
 * carried a verbatim modify-and-apply helper and the same 2-space
 * {@link JSONC_FORMATTING_OPTIONS}. This module owns that formatting policy and
 * the comment-preserving modification once, as a synchronous facade over
 * `@beep/jsonc` (`JsoncModifier.modifyWithFormattingResult`, the byte-compatible
 * port of `jsonc-parser`'s `modify`). Parsing is not here: callers decode JSONC
 * through `@beep/jsonc` (`Jsonc.bind(schema).decode`).
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { JsoncEdit } from "@beep/jsonc/JsoncEdit";
import { JsoncModifier } from "@beep/jsonc/JsoncModifier";
import { JsoncPath } from "@beep/jsonc/JsoncNode";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { JsoncFormattingOptionsLike } from "@beep/jsonc/JsoncEdit";

const $I = $RepoCliId.create("internal/cli/Jsonc");

/**
 * The repo's canonical 2-space JSONC formatting options.
 *
 * **Example** (Access tabSize option)
 *
 * ```ts
 * import { JSONC_FORMATTING_OPTIONS } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(JSONC_FORMATTING_OPTIONS.tabSize)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const JSONC_FORMATTING_OPTIONS: JsoncFormattingOptionsLike = {
  tabSize: 2,
  insertSpaces: true,
};

/**
 * A comment-preserving JSONC modification request.
 *
 * **Details**
 *
 * `path` is a `@beep/jsonc` path (string keys and natural-number indices);
 * `value` is the arbitrary JSON value to write, `undefined` deleting it;
 * `isArrayInsertion` inserts at an array index rather than replacing (the only
 * option any call site sets: `formattingOptions` is always the module default
 * and no caller positions a new property).
 *
 * **Example** (Create modification request)
 *
 * ```ts
 * import { JsoncModification } from "@beep/repo-cli/test/SharedInternals"
 *
 * const request = JsoncModification.make({ content: '{ "a": 1 }', path: ["a"], value: 2 })
 * console.log(request.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JsoncModification extends S.Opaque<JsoncModification, { readonly brand: unique symbol }>()(
  S.Struct({
    content: S.String,
    path: JsoncPath,
    value: S.Unknown,
    isArrayInsertion: S.optionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("JsoncModification", {
      description: "A comment-preserving JSONC modification request (content, JSON path, value, array-insertion flag).",
    })
  )
) {}

/**
 * Apply a comment-preserving modification at a JSON path, formatted with
 * {@link JSONC_FORMATTING_OPTIONS}.
 *
 * **Example** (Update value at path)
 *
 * ```ts
 * import { applyJsoncModification } from "@beep/repo-cli/test/SharedInternals"
 *
 * const next = applyJsoncModification({ content: '{\n  "a": 1\n}', path: ["a"], value: 2 })
 * console.log(next.includes('"a": 2'))
 * ```
 *
 * @param request - The content, JSON path, value, and optional array-insertion flag.
 * @returns The edited JSONC text with comments and unrelated formatting preserved.
 * @throws The kit's `JsoncModificationError`, `JsoncPlacementError` or
 *   `JsoncStringifyError` when the path cannot be edited or the value encoded.
 * @category editing
 * @since 0.0.0
 */
export const applyJsoncModification = (request: JsoncModification): string =>
  JsoncModifier.modifyWithFormattingResult(request.content, request.path, request.value, {
    formattingOptions: JSONC_FORMATTING_OPTIONS,
    ...(request.isArrayInsertion === true ? { isArrayInsertion: true } : {}),
  }).pipe(
    Result.map((edits) => JsoncEdit.applyAll(request.content, edits)),
    Result.getOrThrow
  );
