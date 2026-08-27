/**
 * Pure JSONC formatting: compute the minimal set of whitespace edits that
 * bring a document to canonical shape, or apply them in one step.
 *
 * Kept as its own concept module (rather than folded into the `Jsonc` facade)
 * so the jsonc and yaml surfaces stay structurally symmetric — `YamlFormatter`
 * will want the identical shape. Both statics are pure and total: computing
 * edits never fails, so there is no `Effect` wrapper.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { SyntaxKind } from "./internal/scanner.ts";
import { createScanner } from "./internal/scanner.ts";
import type { JsoncFormattingOptions, JsoncRange } from "./JsoncEdit.ts";
import { JsoncEdit } from "./JsoncEdit.ts";

/**
 * Pure JSONC formatting statics. Not instantiable. `format` returns the
 * whitespace edits; apply them with {@link JsoncEdit.applyAll}. `formatToString`
 * is `applyAll ∘ format` in one step.
 *
 * **Example** (Pretty-print compact JSONC)
 *
 * ```ts
 * import { JsoncEdit, JsoncFormatter } from "@beep/scratchpad/jsonc";
 *
 * const text = '{"a":1,"b":2}';
 * const formatted = JsoncEdit.applyAll(text, JsoncFormatter.format(text));
 *
 * console.log(formatted); // '{\n  "a": 1,\n  "b": 2\n}'
 * ```
 *
 * @see {@link JsoncEdit.applyAll} for applying the computed edits.
 * @see {@link JsoncFormattingOptions} for indent, EOL and keep-lines controls.
 * @public
 * @category formatting
 * @since 0.0.0
 */
export class JsoncFormatter {
	private constructor() {}

	/**
	 * Compute formatting edits for a JSONC document. Non-mutating — apply the
	 * result with `JsoncEdit.applyAll`. Pure and total.
	 *
	 * @param text - The JSONC source to format.
	 * @param range - Optional sub-range; only edits within it are returned.
	 * @param options - Optional {@link JsoncFormattingOptions}; absent fields use
	 *   defaults (tabSize 2, spaces, `"\n"`, no final newline, reflow).
	 * @see {@link JsoncEdit.applyAll} for applying the returned edits.
	 */
	static format(text: string, range?: JsoncRange, options?: JsoncFormattingOptions): ReadonlyArray<JsoncEdit> {
		return formatImpl(text, range, options);
	}

	/**
	 * Format `text` and apply the resulting edits in one step
	 * (`applyAll ∘ format`). The sole surviving convenience from v3's
	 * `formatAndApply`. Pure and total.
	 *
	 * @param text - The JSONC source to format.
	 * @param range - Optional sub-range; only edits within it are applied.
	 * @param options - Optional {@link JsoncFormattingOptions}; see
	 *   {@link JsoncFormatter.format} for defaults.
	 */
	static formatToString(text: string, range?: JsoncRange, options?: JsoncFormattingOptions): string {
		return JsoncEdit.applyAll(text, formatImpl(text, range, options));
	}
}

function formatImpl(
	text: string,
	range: JsoncRange | undefined,
	options: JsoncFormattingOptions | undefined,
): ReadonlyArray<JsoncEdit> {
	const tabSize = options?.tabSize ?? 2;
	const insertSpaces = options?.insertSpaces ?? true;
	const eol = options?.eol ?? "\n";
	const insertFinalNewline = options?.insertFinalNewline ?? false;
	const keepLines = options?.keepLines ?? false;

	const indentUnit = insertSpaces ? " ".repeat(tabSize) : "\t";
	const edits: JsoncEdit[] = [];
	const scanner = createScanner(text, false);

	const rangeStart = range?.offset ?? 0;
	const rangeEnd = range !== undefined ? range.offset + range.length : text.length;

	let depth = 0;
	let prevTokenEnd = -1;
	let prevToken: SyntaxKind = "Unknown";
	let firstToken = true;

	const makeIndent = (d: number): string => indentUnit.repeat(d);

	const addEdit = (offset: number, length: number, content: string): void => {
		if (offset >= rangeStart && offset + length <= rangeEnd && text.substring(offset, offset + length) !== content) {
			edits.push(JsoncEdit.make({ offset, length, content }));
		}
	};

	let kind = scanner.scan();
	while (kind !== "EOF") {
		const tokenOffset = scanner.getTokenOffset();
		const tokenLength = scanner.getTokenLength();

		if (kind !== "Trivia" && kind !== "LineBreak") {
			if (!firstToken && prevTokenEnd >= 0) {
				const gap = text.substring(prevTokenEnd, tokenOffset);
				let expectedGap: string;

				if (kind === "CloseBrace" || kind === "CloseBracket") {
					depth--;
					expectedGap = eol + makeIndent(depth);
				} else if (prevToken === "OpenBrace" || prevToken === "OpenBracket") {
					expectedGap = eol + makeIndent(depth);
				} else if (prevToken === "Comma") {
					expectedGap = eol + makeIndent(depth);
				} else if (prevToken === "Colon") {
					expectedGap = " ";
				} else if (kind === "LineComment" || kind === "BlockComment") {
					expectedGap = gap.includes("\n") ? eol + makeIndent(depth) : " ";
				} else if (prevToken === "LineComment") {
					expectedGap = eol + makeIndent(depth);
				} else if (prevToken === "BlockComment") {
					expectedGap = gap.includes("\n") ? eol + makeIndent(depth) : " ";
				} else {
					expectedGap = gap;
				}

				if (keepLines && gap.includes("\n")) {
					expectedGap = gap;
				}

				addEdit(prevTokenEnd, tokenOffset - prevTokenEnd, expectedGap);
			}

			if (kind === "OpenBrace" || kind === "OpenBracket") {
				depth++;
			}

			prevToken = kind;
			prevTokenEnd = tokenOffset + tokenLength;
			firstToken = false;
		}

		kind = scanner.scan();
	}

	if (insertFinalNewline && prevTokenEnd >= 0) {
		const trailing = text.substring(prevTokenEnd);
		if (!trailing.endsWith(eol)) {
			// Routed through addEdit so the documented range restriction applies to
			// this edit like every other.
			addEdit(prevTokenEnd, trailing.length, eol);
		}
	}

	return edits;
}
