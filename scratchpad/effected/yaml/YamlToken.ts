// The public positioned token stream: promotes the internal lexer
// token to public surface for lint- and LSP-class consumers. The internal
// token spells two fields differently (`value`, `column`); promotion
// reconciles them to the positioned-diagnostic vocabulary the public surface
// already uses in `YamlDiagnostic` (`text`, `character`).
//
// Cycle firewall: this module imports the internal lexer and the `Yaml`
// facade's error type; nothing imports `YamlToken.ts` back except the lint
// layer above it.

import { $ScratchpadId } from "@beep/identity/packages";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { lexAll } from "./internal/lexer.ts";
import { YamlTokenKind as InternalTokenKind, type YamlToken as InternalToken } from "./internal/token.ts";
import type { YamlParseError } from "./Yaml.ts";

const $I = $ScratchpadId.create("effected/yaml/YamlToken");

/**
 * The 22 lexical token kinds produced by the YAML tokenizer.
 *
 * @public
 */
export const YamlTokenKind = InternalTokenKind;

/**
 * The union of all lexical token kind string literals.
 *
 * @public
 */
export type YamlTokenKind = typeof YamlTokenKind.Type;

/**
 * A single positioned YAML lexical token.
 *
 * - `kind` — the {@link (YamlTokenKind:type)}.
 * - `text` — the raw source slice the token covers; the position-fidelity
 *   invariant is `source.slice(offset, offset + length) === text`.
 * - `offset` / `length` — the token's span in UTF-16 code units.
 * - `line` / `character` — the zero-based position of the token's start,
 *   matching the `YamlDiagnostic` position vocabulary.
 *
 * @public
 */
export class YamlToken extends S.Class<YamlToken>($I`YamlToken`)({
	kind: YamlTokenKind.annotateKey({ description: "Lexical category assigned by the YAML tokenizer" }),
	text: S.String.annotateKey({ description: "Raw source slice covered by the token, preserving quotes and whitespace" }),
	offset: S.Finite.annotateKey({ description: "Zero-based start position in the YAML source, measured in UTF-16 code units" }),
	length: S.Finite.annotateKey({ description: "Source span covered by the token, measured in UTF-16 code units" }),
	line: S.Finite.annotateKey({ description: "Zero-based source line where the token starts" }),
	character: S.Finite.annotateKey({ description: "Zero-based position within the source line where the token starts, measured in UTF-16 code units" }),
}, $I.annote("YamlToken", { description: "A single positioned YAML lexical token." })) {}

/**
 * Promote the internal lexer tokens to the public shape.
 *
 * `line`/`character` are DERIVED from each token's offset against a
 * line-start index rather than copied from the internal token: the internal
 * `column` is a CST-parser vocabulary that carries the construct's INDENT on
 * the synthetic `block-map-start`/`block-seq-start` markers, not the token's
 * own position — the public surface promises the position. `text` is the RAW
 * source slice for the same reason: the internal `value` is the PROCESSED
 * form on quoted scalars (content without the quotes), while the public
 * contract is byte fidelity — the corpus conformance suite pins the tokens
 * tiling the source exactly.
 */
const promoteAll = (text: string, tokens: ReadonlyArray<InternalToken>): ReadonlyArray<YamlToken> => {
	const lineStarts = [0];
	for (let i = 0; i < text.length; i++) {
		if (text[i] === "\r") {
			if (text[i + 1] === "\n") i++;
			lineStarts.push(i + 1);
		} else if (text[i] === "\n") lineStarts.push(i + 1);
	}
	// Tokens arrive in offset order, so a monotone cursor resolves positions
	// in one pass.
	let line = 0;
	return tokens.map((token) => {
		// Defensive: a non-monotone offset would otherwise yield a negative
		// `character`. Restart the scan instead.
		if (token.offset < (lineStarts[line] ?? 0)) line = 0;
		let nextStart = lineStarts[line + 1];
		while (nextStart !== undefined && nextStart <= token.offset) {
			line++;
			nextStart = lineStarts[line + 1];
		}
		// Hot path: tokenizing a large document materializes thousands of
		// instances, so construction uses `new` (the engine's recorded
		// hot-path exception) rather than the validating `make`.
		return YamlToken.make({
			kind: token.kind,
			text: text.slice(token.offset, token.offset + token.length),
			offset: token.offset,
			length: token.length,
			line,
			character: token.offset - (lineStarts[line] ?? 0),
		});
	});
};

/**
 * Tokenizes YAML text into positioned tokens, as a complete array or a lazy
 * `Stream`, for lint- and editor-class consumers. Never fails on malformed
 * input: lexical errors arrive as `"error"`-kind tokens. Not instantiable.
 *
 * @public
 */
export class YamlTokens {
	private constructor() {}

	/**
	 * Tokenize YAML text into the full positioned token array — the sync
	 * `Result` primitive (tokenizing is a pure batch transform; the
	 * {@link YamlTokens.stream} form is derived from this one).
	 *
	 * @remarks
	 * The failure channel is **reserved** for input-hardening guards and never
	 * fires today: the lexer is total, and lexical errors surface as
	 * `"error"`-kind tokens **in the success array** so that linting can run
	 * on malformed input — the `parse-validity` lint rule exists precisely for
	 * documents that do not parse. Do not "fix" this method to fail on
	 * `"error"` tokens; that would make malformed documents unlintable.
	 *
	 * @example
	 * ```ts
	 * import { YamlTokens } from "./index.ts";
	 * import * as Result from "effect/Result";
	 *
	 * const result = YamlTokens.tokenize("a: 1\n");
	 * if (Result.isSuccess(result)) {
	 *   result.success.map((t) => t.kind); // ["scalar", "block-map-start", ...]
	 * }
	 * ```
	 *
	 * @param text - The YAML source to tokenize.
	 * @returns A `Result` succeeding with every token in source order.
	 */
	static tokenize(text: string): Result.Result<ReadonlyArray<YamlToken>, YamlParseError> {
		return Result.succeed(promoteAll(text, lexAll(text)));
	}

	/**
	 * Tokenize YAML text as a lazy `Stream` of tokens — the derived form of
	 * {@link YamlTokens.tokenize} for genuinely incremental (SAX-style)
	 * consumers, parallel to `YamlVisitor.visit`.
	 *
	 * @remarks
	 * Derived from the sync primitive, so it shares its contract: lexical
	 * errors arrive as `"error"`-kind tokens in the stream, never as a stream
	 * failure. (The primitive's reserved failure channel would surface as a
	 * defect here; it never fires today.)
	 */
	static stream(text: string): Stream.Stream<YamlToken> {
		return Stream.suspend(() =>
			Result.match(YamlTokens.tokenize(text), {
				onSuccess: (tokens) => Stream.fromIterable(tokens),
				onFailure: (error) => Stream.die(error),
			}),
		);
	}
}
