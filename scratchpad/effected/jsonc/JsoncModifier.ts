import * as Match from "effect/Match";
// Structural JSONC modification: compute the edits needed to set, replace or
// delete a value at a path, without mutating the source.
//
// Navigation goes through the scanner-based `internal/navigate.ts`; this
// module owns only edit synthesis and the `JsoncModificationError` it raises on a navigation miss.

import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as O from "effect/Option";
import { navigate } from "./internal/navigate.ts";
import { Jsonc, JsoncStringifyOptions } from "./Jsonc.ts";
import { JsoncFormattingOptionsLike } from "./JsoncEdit.ts";
import { JsoncEdit } from "./JsoncEdit.ts";
import type { JsoncPath } from "./JsoncNode.ts";

/**
 * Raised when `JsoncModifier.modify` cannot navigate the requested path: the
 * value at `depth` is not the container kind (`expected`) the next path segment
 * requires.
 *
 * - `path` — the full path that was passed to `JsoncModifier.modify`.
 * - `expected` — the container kind (`"object"` or `"array"`) the segment at
 *   `depth` required.
 * - `depth` — the 1-based index into `path` where navigation failed.
 * - `offset` — reserved for a source-position annotation; currently always
 *   omitted (navigation reports the mismatch structurally, without a text
 *   offset).
 *
 * @remarks
 * Follows the structure-preserving-errors house rule — the mismatch's
 * discriminating data is carried as typed fields (`path`, `expected`, `depth`,
 * optional `offset`), not collapsed into a `reason: string`. This mirrors
 * `YamlModificationError`'s posture (its fields differ because the underlying
 * failures differ; the cross-package parity convention binds
 * `Edit`/`Range`/`Path`, not this error).
 *
 * @public
 */
export class JsoncModificationError extends S.TaggedError<JsoncModificationError>()("JsoncModificationError", {
	path: S.Array(S.Union([S.String, S.Finite])),
	expected: S.Literals(["object", "array"]),
	depth: S.Finite,
	offset: S.optionalKey(S.Finite),
}) {
	override get message(): string {
		const at = this.offset !== undefined ? ` (offset ${this.offset})` : "";
		return `Modification failed at path [${this.path.join(", ")}]${at}: expected ${this.expected} at depth ${this.depth}`;
	}
}

/**
 * Options for `JsoncModifier.modify`: formatting controls for generated text.
 *
 * @public
 */
export const JsoncModifyOptions = S.Struct({
  formattingOptions: S.optionalKey(JsoncFormattingOptionsLike),
});
export type JsoncModifyOptions = typeof JsoncModifyOptions.Type;

/**
 * Sets, replaces or deletes a value at a path in JSONC text, as byte-minimal
 * edits that leave comments and formatting elsewhere untouched. Not
 * instantiable.
 *
 * @example
 * ```ts
 * import { JsoncEdit, JsoncModifier } from "@effected/jsonc";
 * import { Effect } from "effect";
 *
 * const text = '{\n  // dev port\n  "port": 3000\n}';
 *
 * const program = Effect.gen(function* (result) {
 *   const edits = yield* JsoncModifier.modify(text, ["port"], 8080);
 *   return JsoncEdit.applyAll(text, edits);
 *   // => '{\n  // dev port\n  "port": 8080\n}'
 * });
 * ```
 *
 * @public
 */
export abstract class JsoncModifier {

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
	 * @returns An `Effect` that succeeds with the edits to apply (via
	 *   `JsoncEdit.applyAll`), fails with {@link JsoncModificationError} when
	 *   `path` cannot be navigated, or carries `Jsonc.stringify`'s typed error
	 *   when the value cannot be serialized.
	 */
	static readonly modify = Effect.fn("JsoncModifier.modify")(function* (
		text: string,
		path: JsoncPath,
		value: unknown,
		options?: JsoncModifyOptions,
	) {
		const fmt = options?.formattingOptions;
		const tabSize = fmt?.tabSize ?? 2;
		const insertSpaces = fmt?.insertSpaces ?? true;
		const eol = fmt?.eol ?? "\n";
		const indentUnit = insertSpaces ? " ".repeat(tabSize) : "\t";
		const stringifyOptions = JsoncStringifyOptions.make({ tabSize, insertSpaces });

		if (path.length === 0) {
			const content = value === undefined ? "" : yield* Jsonc.stringify(value, stringifyOptions);
			return [JsoncEdit.make({ offset: 0, length: text.length, content })] as ReadonlyArray<JsoncEdit>;
		}

		const result = navigate(text, path);

		return yield* Match.value(result).pipe(
Match.tag("Mismatch", function* (result) {
				return yield* JsoncModificationError.make({
					path,
					expected: result.expected,
					depth: result.depth,
				});
}),
Match.tag("NoOp", function* (result) {
				return [] as ReadonlyArray<JsoncEdit>;
}),
Match.tag("Located", function* (result) { {
				if (value === undefined) {
					// Comma positions come from navigate()'s scanner tokens, never from
					// searching the raw text — commas inside comments are invisible here.
					let removeStart = result.keyStart;
					let removeEnd = result.valueEnd;
					if (O.isSome(result.commaBefore)) {
						removeStart = result.commaBefore.value;
					} else if (O.isSome(result.commaAfter)) {
						removeEnd = result.commaAfter.value + 1;
					}
					return [
						JsoncEdit.make({ offset: removeStart, length: removeEnd - removeStart, content: "" }),
					] as ReadonlyArray<JsoncEdit>;
				}
				const serialized = yield* Jsonc.stringify(value, stringifyOptions);
				return [
					JsoncEdit.make({
						offset: result.valueStart,
						length: result.valueEnd - result.valueStart,
						content: serialized,
					}),
				] as ReadonlyArray<JsoncEdit>;
			}
}),
Match.tag("Insert", function* (result) { {
				if (value === undefined) {
					return [] as ReadonlyArray<JsoncEdit>;
				}
				const serialized = yield* Jsonc.stringify(value, stringifyOptions);
				const indent = indentUnit.repeat(result.depth);
				const outdent = indentUnit.repeat(result.depth - 1);
				if (result.container === "object") {
					const key = yield* Jsonc.stringify(String(path[path.length - 1]));
					const insertText = result.isFirst
						? `${eol}${indent}${key}: ${serialized}${eol}${outdent}`
						: `,${eol}${indent}${key}: ${serialized}`;
					return [JsoncEdit.make({ offset: result.at, length: 0, content: insertText })] as ReadonlyArray<JsoncEdit>;
				}
				const insertText = result.isFirst
					? `${eol}${indent}${serialized}${eol}${outdent}`
					: `,${eol}${indent}${serialized}`;
				return [JsoncEdit.make({ offset: result.at, length: 0, content: insertText })] as ReadonlyArray<JsoncEdit>;
			}
}),
Match.exhaustive
);
	});
}
