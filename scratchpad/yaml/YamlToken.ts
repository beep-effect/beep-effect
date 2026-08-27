/**
 * Positioned YAML token stream for lint and LSP consumers.
 *
 * **Details**
 *
 * Promotes the internal lexer token to the public surface. The internal token
 * spells two fields differently (`value`, `column`); promotion reconciles them
 * to the positioned-diagnostic vocabulary already used by {@link YamlDiagnostic}
 * (`text`, `character`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Result, Schema, Stream } from "effect";
import { lexAll } from "./internal/lexer.ts";
import type { YamlToken as InternalToken } from "./internal/token.ts";
import type { YamlParseError } from "./Yaml.ts";

const $I = $ScratchpadId.create("yaml/YamlToken");

/**
 * The 22 lexical token kinds produced by the YAML tokenizer.
 *
 * **Example** (Match a token kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { YamlTokenKind } from "@beep/scratchpad/yaml"
 *
 * console.log(S.is(YamlTokenKind)("scalar")) // true
 * console.log(S.is(YamlTokenKind)("error")) // true
 * console.log(S.is(YamlTokenKind)("not-a-kind")) // false
 * ```
 *
 * @see {@link YamlToken} for the positioned token that carries one of these kinds.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlTokenKind = Schema.Literals([
	"document-start",
	"document-end",
	"directive",
	"tag",
	"anchor",
	"alias",
	"scalar",
	"block-map-start",
	"block-map-key",
	"block-map-value",
	"block-seq-start",
	"block-seq-entry",
	"flow-map-start",
	"flow-map-end",
	"flow-seq-start",
	"flow-seq-end",
	"flow-separator",
	"newline",
	"whitespace",
	"comment",
	"byte-order-mark",
	"error",
]).pipe(
	$I.annoteSchema("YamlTokenKind", {
		description: "Lexical token kinds produced by the YAML tokenizer.",
	}),
);

/**
 * Decoded literal union produced by {@link YamlTokenKind}.
 *
 * @see {@link YamlTokenKind} for the runtime schema and decoding behavior.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlTokenKind = typeof YamlTokenKind.Type;

/**
 * A single positioned YAML lexical token.
 *
 * **Details**
 *
 * - `kind` — the {@link (YamlTokenKind:type)}.
 * - `text` — the raw source slice the token covers; the position-fidelity
 *   invariant is `source.slice(offset, offset + length) === text`.
 * - `offset` / `length` — the token's span in UTF-16 code units.
 * - `line` / `character` — the zero-based position of the token's start,
 *   matching the `YamlDiagnostic` position vocabulary.
 *
 * **Gotchas**
 *
 * Public `text` is the raw source slice. The internal lexer `value` is
 * processed (quotes stripped) and is not this field. `line`/`character` are
 * derived from offset; the internal `column` is indent on synthetic
 * block-start tokens and must not be copied onto public tokens. Hot-path
 * construction uses `new YamlToken`, not `make`.
 *
 * **Example** (Make a scalar token)
 *
 * ```ts
 * import { YamlToken } from "@beep/scratchpad/yaml"
 *
 * const token = YamlToken.make({
 *   kind: "scalar",
 *   text: "a",
 *   offset: 0,
 *   length: 1,
 *   line: 0,
 *   character: 0,
 * })
 *
 * console.log(token.kind) // "scalar"
 * console.log(token.text) // "a"
 * ```
 *
 * @see {@link YamlTokens.tokenize} for the tokenizer that produces these tokens from source.
 * @public
 * @category models
 * @since 0.0.0
 */
export class YamlToken extends Schema.Class<YamlToken>("YamlToken")(
	{
		kind: YamlTokenKind,
		text: Schema.String,
		offset: Schema.Finite,
		length: Schema.Finite,
		line: Schema.Finite,
		character: Schema.Finite,
	},
	$I.annote("YamlToken", {
		description: "A positioned YAML lexical token whose text is the raw source slice.",
	}),
) {}

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
		if (text[i] === "\n") lineStarts.push(i + 1);
	}
	// Tokens arrive in offset order, so a monotone cursor resolves positions
	// in one pass.
	let line = 0;
	return tokens.map((token) => {
		// Defensive: a non-monotone offset would otherwise yield a negative
		// `character`. Restart the scan instead.
		if (token.offset < (lineStarts[line] as number)) line = 0;
		while (line + 1 < lineStarts.length && (lineStarts[line + 1] as number) <= token.offset) line++;
		// Hot path: tokenizing a large document materializes thousands of
		// instances, so construction uses `new` (the engine's recorded
		// hot-path exception) rather than the validating `make`.
		return YamlToken.make({
			kind: token.kind,
			text: text.slice(token.offset, token.offset + token.length),
			offset: token.offset,
			length: token.length,
			line,
			character: token.offset - (lineStarts[line] as number),
		});
	});
};

/**
 * Tokenize YAML into a positioned stream for lint and LSP consumers.
 *
 * **Gotchas**
 *
 * {@link YamlTokens.tokenize}'s failure channel is reserved and never fires
 * today: the lexer is total, and lexical errors surface as `"error"`-kind
 * tokens **in the success array** so `parse-validity` can lint malformed
 * input. Do not "fix" tokenize to fail on those tokens. {@link YamlTokens.stream}
 * derives from tokenize; the reserved failure would `Stream.die` and does not
 * fire. Public `text` is the raw source slice
 * (`source.slice(offset, offset + length) === text`). Positions are derived
 * from offset — internal `column` is indent on synthetic block-start tokens.
 *
 * **Example** (Tokenize well-formed and malformed input)
 *
 * ```ts
 * import { Result } from "effect"
 * import { YamlTokens } from "@beep/scratchpad/yaml"
 *
 * const ok = YamlTokens.tokenize("a: 1\n")
 * console.log(Result.isSuccess(ok)) // true
 * if (Result.isSuccess(ok)) {
 *   console.log(ok.success.some((token) => token.kind === "scalar")) // true
 * }
 *
 * const malformed = YamlTokens.tokenize("\ta: 1\n")
 * if (Result.isSuccess(malformed)) {
 *   console.log(malformed.success.some((token) => token.kind === "error")) // true
 * }
 * ```
 *
 * @see {@link YamlVisitor.visit} for AST events rather than lexical tokens.
 * @see {@link YamlLint} for the lint facade that consumes this token stream.
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class YamlTokens {
	private constructor() {}

	/**
	 * Tokenize YAML text into the full positioned token array — the sync
	 * `Result` primitive (tokenizing is a pure batch transform; the
	 * {@link YamlTokens.stream} form is derived from this one, per the kit's
	 * sync-primitive policy).
	 *
	 * **Gotchas**
	 *
	 * The failure channel is **reserved** (for future input-hardening guards)
	 * and never fires today: the lexer is total, and lexical errors surface as
	 * `"error"`-kind tokens **in the success array** so that linting can run
	 * on malformed input — the `parse-validity` lint rule exists precisely for
	 * documents that do not parse. Do not "fix" this method to fail on
	 * `"error"` tokens; that would make malformed documents unlintable.
	 *
	 * **Example** (Inspect token kinds)
	 *
	 * ```ts
	 * import { Result } from "effect"
	 * import { YamlTokens } from "@beep/scratchpad/yaml"
	 *
	 * const result = YamlTokens.tokenize("a: 1\n")
	 * console.log(Result.isSuccess(result)) // true
	 * if (Result.isSuccess(result)) {
	 *   console.log(result.success.map((token) => token.kind).includes("scalar")) // true
	 * }
	 * ```
	 */
	static tokenize(text: string): Result.Result<ReadonlyArray<YamlToken>, YamlParseError> {
		return Result.succeed(promoteAll(text, lexAll(text)));
	}

	/**
	 * Tokenize YAML text as a lazy `Stream` of tokens — the derived form of
	 * {@link YamlTokens.tokenize} for genuinely incremental (SAX-style)
	 * consumers, parallel to `YamlVisitor.visit`.
	 *
	 * **Gotchas**
	 *
	 * Derived from the sync primitive, so it shares its contract: lexical
	 * errors arrive as `"error"`-kind tokens in the stream, never as a stream
	 * failure. The primitive's reserved failure channel would surface as a
	 * defect here; it never fires today.
	 *
	 * **Example** (Collect scalar tokens from the stream)
	 *
	 * ```ts
	 * import { Effect, Stream } from "effect"
	 * import { YamlTokens } from "@beep/scratchpad/yaml"
	 *
	 * const tokens = Effect.runSync(Stream.runCollect(YamlTokens.stream("a: 1\n")))
	 * console.log(tokens.some((token) => token.kind === "scalar")) // true
	 * ```
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
