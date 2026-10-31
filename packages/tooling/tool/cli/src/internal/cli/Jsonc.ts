/**
 * Shared JSONC editing helpers for the repo CLI.
 *
 * Config-sync command groups (TsconfigSync, CreatePackage, VersionSync) each
 * carried a verbatim `jsonc.modify` + `jsonc.applyEdits` helper and the same
 * 2-space {@link JSONC_FORMATTING_OPTIONS}. This module owns that formatting
 * policy and the comment-preserving modification once. Parsing is not here:
 * callers decode JSONC through `@beep/jsonc` (`Jsonc.bind(schema).decode`).
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as jsonc from "jsonc-parser";

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
export const JSONC_FORMATTING_OPTIONS: jsonc.FormattingOptions = {
  tabSize: 2,
  insertSpaces: true,
};

/**
 * A comment-preserving JSONC modification request.
 *
 * **Details**
 *
 * `path` is a `jsonc-parser` JSON path (string/number segments); `value` is the
 * arbitrary JSON value to write; `isArrayInsertion` inserts at an array index
 * rather than replacing (the only `jsonc.ModificationOptions` flag any call site
 * uses — `formattingOptions` is always the module default and `getInsertionIndex`
 * is unused).
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
    path: S.Array(S.Union([S.String, S.Finite])),
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
 * @category editing
 * @since 0.0.0
 */
export const applyJsoncModification = (request: JsoncModification): string => {
  const edits = jsonc.modify(request.content, [...request.path], request.value, {
    formattingOptions: JSONC_FORMATTING_OPTIONS,
    ...(request.isArrayInsertion === true ? { isArrayInsertion: true } : {}),
  });
  return jsonc.applyEdits(request.content, edits);
};

/**
 * Re-format JSON/JSONC text with {@link JSONC_FORMATTING_OPTIONS}.
 *
 * **Details**
 *
 * Returns the formatted text without a trailing newline; callers that need one
 * (for example writing a file) append it themselves.
 *
 * **Example** (Format minified JSON)
 *
 * ```ts
 * import { jsonText } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(jsonText('{"a":1}').includes('"a": 1'))
 * ```
 *
 * @param content - JSON/JSONC source text to format.
 * @returns The re-formatted text.
 * @category editing
 * @since 0.0.0
 */
export const jsonText = (content: string): string => {
  const edits = jsonc.format(content, undefined, JSONC_FORMATTING_OPTIONS);
  return jsonc.applyEdits(content, edits);
};
