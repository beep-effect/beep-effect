// The structured diagnostic concept: MarkdownDiagnostic and the
// error-code literal union.
//
// Cycle firewall: the internal engine emits raw `{ code, message, offset,
// length }` records (src/internal/carriers.ts); this module materializes
// them into MarkdownDiagnostic, deriving `line`/`character` from `offset`
// against the source text. The dependency edge runs public modules ->
// engine only (toml src/TomlDiagnostic.ts precedent).

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { MARKDOWN_PARSE_ERROR_CODES } from "./internal/carriers.ts";

const $I = $ScratchpadId.create("effected/markdown/MarkdownDiagnostic");

/**
 * Error codes `Markdown.parse`/`MarkdownDocument.parse` can fail with.
 * Currently exactly one, `"NestingDepthExceeded"`, the hardening-guard trip;
 * the union may widen as new fatal conditions are identified.
 *
 * @public
 */
export const MarkdownParseErrorCode = S.Literals(MARKDOWN_PARSE_ERROR_CODES).pipe($I.annoteSchema("MarkdownParseErrorCode", { description: "Error codes `Markdown.parse`/`MarkdownDocument.parse` can fail with. Currently exactly one, `\"NestingDepthExceeded\"`, the hardening-guard trip; the union may widen as new fatal conditions are identified." }));

/**
 * The union of all markdown parse-error code string literals.
 *
 * @public
 */
export type MarkdownParseErrorCode = typeof MarkdownParseErrorCode.Type;

/**
 * One structured diagnostic: its {@link (MarkdownParseErrorCode:type)}, a
 * human-readable `message`, and its exact position (`offset`/`length`, plus
 * zero-based `line`/`character`).
 *
 * @remarks
 * The five-field positional core (`code`/`offset`/`length`/`line`/`character`)
 * is structurally identical to `@effected/toml`'s `TomlDiagnostic` (and, by
 * the same cross-package contract, `@effected/jsonc`'s parse-error detail
 * shape and `@effected/yaml`'s `YamlDiagnostic`); `message` is this
 * package's additive extra. `line`/`character` here are zero-based to match
 * that contract — a different numbering from the one-based `line`/`column`
 * unist `Point`s carried on `MarkdownNode` positions, which is a deliberate,
 * unrelated convention for the AST rather than a mismatch to reconcile.
 *
 * @public
 */
export class MarkdownDiagnostic extends S.Class<MarkdownDiagnostic>($I`MarkdownDiagnostic`)({
	code: MarkdownParseErrorCode.annotateKey({ description: "Fatal condition identifier, currently `NestingDepthExceeded` for a nesting guard violation" }),
	message: S.String.annotateKey({ description: "Human-readable explanation of the reported condition" }),
	offset: S.Finite.annotateKey({ description: "Zero-based UTF-16 source offset of the reported condition" }),
	length: S.Finite.annotateKey({ description: "Extent of the reported source span in UTF-16 code units; nesting guard violations use zero" }),
	line: S.Finite.annotateKey({ description: "Zero-based source line containing the reported offset, counting CRLF as one line break" }),
	character: S.Finite.annotateKey({ description: "Zero-based UTF-16 position within the source line at the reported offset" }),
}, $I.annote("MarkdownDiagnostic", { description: "One structured diagnostic: its (MarkdownParseErrorCode:type), a human-readable `message`, and its exact position (`offset`/`length`, plus zero-based `line`/`character`)." })) {
	/**
	 * Materialize an engine record, deriving zero-based `line`/`character`
	 * from `offset` against the source text. Advanced — the parse entry
	 * points call this for you.
	 *
	 * @param source - The source text the record's `offset` indexes into.
	 * @param raw - The engine record: `code`, `message`, `offset` and `length`.
	 * @returns The diagnostic with `line` and `character` filled in.
	 */
	static fromRaw(
		source: string,
		raw: {
			readonly code: MarkdownParseErrorCode;
			readonly message: string;
			readonly offset: number;
			readonly length: number;
		},
	): MarkdownDiagnostic {
		const { line, character } = lineChar(source, raw.offset);
		return MarkdownDiagnostic.make({
			code: raw.code,
			message: raw.message,
			offset: raw.offset,
			length: raw.length,
			line,
			character,
		});
	}
}

/**
 * Compute the zero-based line/character position of `offset` within `text`.
 * Recognizes `\n`, `\r` and `\r\n` as line breaks; a CRLF pair counts as a
 * single newline (toml `TomlDiagnostic` precedent — kept independent of
 * `internal/lineIndex.ts`, which answers a different, one-based question
 * for AST positions).
 */
function lineChar(text: string, offset: number): { line: number; character: number } {
	let line = 0;
	let lineStart = 0;
	const limit = Math.min(offset, text.length);
	for (let i = 0; i < limit; i++) {
		const ch = text.charCodeAt(i);
		if (ch === 0x0a) {
			line++;
			lineStart = i + 1;
		} else if (ch === 0x0d) {
			if (i + 1 < text.length && text.charCodeAt(i + 1) === 0x0a) {
				i++;
			}
			line++;
			lineStart = i + 1;
		}
	}
	return { line, character: offset - lineStart };
}
