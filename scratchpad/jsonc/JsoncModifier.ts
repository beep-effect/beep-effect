// Structural JSONC modification: compute the edits needed to set, replace or
// delete a value at a path, without mutating the source.
//
// Navigation goes through the scanner-based `internal/navigate.ts` (a
// correctness fix over v3's fragile string search); this module owns only edit
// synthesis and the `JsoncModificationError` it raises on a navigation miss.

import { Effect, Schema } from "effect";
import { navigate } from "./internal/navigate.ts";
import type { JsoncFormattingOptionsLike } from "./JsoncEdit.ts";
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
 * - `offset` — reserved for a future source-position annotation; currently
 *   always omitted (navigation reports the mismatch structurally, without a
 *   text offset).
 *
 * @remarks
 * Follows the structure-preserving-errors house rule — the mismatch's
 * discriminating data is carried as typed fields (`path`, `expected`, `depth`,
 * optional `offset`), not collapsed into a `reason: string`. This mirrors
 * `YamlModificationError`'s posture (its fields differ because the underlying
 * failures differ; the jsonc/yaml parity convention binds `Edit`/`Range`/`Path`,
 * not this error).
 *
 * @public
 */
export class JsoncModificationError extends Schema.TaggedError<JsoncModificationError>()("JsoncModificationError", {
	path: Schema.Array(Schema.Union([Schema.String, Schema.Number])),
	expected: Schema.Literals(["object", "array"]),
	depth: Schema.Number,
	offset: Schema.optionalKey(Schema.Number),
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
export interface JsoncModifyOptions {
	/**
	 * Formatting applied to inserted/replaced content (indentation, EOL,
	 * spacing). Accepts a `JsoncFormattingOptions` instance or a plain literal
	 * (e.g. `{ insertSpaces: false, tabSize: 2 }`) — see
	 * {@link JsoncFormattingOptionsLike}.
	 */
	readonly formattingOptions?: JsoncFormattingOptionsLike;
}

/**
 * Structural JSONC modification statics. Not instantiable.
 *
 * @public
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
	 * @returns An `Effect` that succeeds with the edits to apply (via
	 *   `JsoncEdit.applyAll`), or fails with {@link JsoncModificationError} when
	 *   `path` cannot be navigated.
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
		// JSON.stringify accepts a string indent — pass the tab unit through so
		// insertSpaces: false is honored in generated content, not just gaps.
		const jsonIndent: string | number = insertSpaces ? tabSize : "\t";

		if (path.length === 0) {
			const content = value === undefined ? "" : JSON.stringify(value, null, jsonIndent);
			return [JsoncEdit.make({ offset: 0, length: text.length, content })] as ReadonlyArray<JsoncEdit>;
		}

		const result = navigate(text, path);

		switch (result._tag) {
			case "Mismatch":
				return yield* new JsoncModificationError({
					path,
					expected: result.expected,
					depth: result.depth,
				});

			case "NoOp":
				return [] as ReadonlyArray<JsoncEdit>;

			case "Located": {
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
				const serialized = JSON.stringify(value, null, jsonIndent);
				return [
					JsoncEdit.make({
						offset: result.valueStart,
						length: result.valueEnd - result.valueStart,
						content: serialized,
					}),
				] as ReadonlyArray<JsoncEdit>;
			}

			case "Insert": {
				if (value === undefined) {
					return [] as ReadonlyArray<JsoncEdit>;
				}
				const serialized = JSON.stringify(value, null, jsonIndent);
				const indent = indentUnit.repeat(result.depth);
				const outdent = indentUnit.repeat(result.depth - 1);
				if (result.container === "object") {
					const key = JSON.stringify(String(path[path.length - 1]));
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
		}
	});
}
