// The `Markdown` facade: the pure `parseResult` primitive, the `Effect`
// `parse` defined in terms of it, the parse options and the
// `MarkdownFromString` schema codec.
//
// Cycle firewall: the internal engine throws raw carriers (`GuardExceeded`
// from a hardening cap, `RawMarkdownError` for a fatal engine condition);
// this module materializes `MarkdownDiagnostic` instances (deriving
// `line`/`character` from `offset`) and constructs the tagged
// `MarkdownParseError`. Anything else that escapes the engine is a
// programmer error and is rethrown untouched — a defect, never a typed
// failure. The dependency edge runs facade -> engine only, so
// `noImportCycles` stays satisfied.

import { dual } from "effect/Function";
import { isString } from "effect/Predicate";
import { Effect, Result, Schema, SchemaIssue, SchemaTransformation } from "effect";
import type { BlockPassResult } from "./internal/blockParser.ts";
import { parseBlocks } from "./internal/blockParser.ts";
import { isGuardExceeded, isRawMarkdownError } from "./internal/carriers.ts";
import { parsePhrasingText } from "./internal/phrasing.ts";
import { stringifyTree } from "./internal/stringify.ts";
import { MarkdownDiagnostic } from "./MarkdownDiagnostic.ts";
import type { PhrasingContent } from "./MarkdownNode.ts";
import { Root } from "./MarkdownNode.ts";

/**
 * The markdown dialects the parser can be pointed at. `"gfm"` — CommonMark
 * 0.31.2 plus the GitHub extensions (tables, strikethrough, autolink
 * literals, task-list items, footnotes, and the tagfilter's output contract)
 * — is the default; `"commonmark"` opts out of every extension. A dialect is
 * a registry composition in the engine, so widening this union is additive
 * and never changes an existing dialect's behavior.
 *
 * @public
 */
export const MarkdownDialect = Schema.Literals(["commonmark", "gfm"]);

/**
 * The union of all markdown dialect string literals.
 *
 * @public
 */
export type MarkdownDialect = typeof MarkdownDialect.Type;

/**
 * Options controlling parse behavior: `dialect` (omitted, `"gfm"`) and
 * `frontmatter` (omitted, `false` — capture is opt-in).
 *
 * @remarks
 * Frontmatter capture is OFF by default because it changes how a document
 * opening with `---` parses: CommonMark reads the fence document
 * `---\nfoo: bar\n---` as a thematic break and a setext heading, and that
 * spec-conformant reading must hold unless a consumer opts in. Enabled, the
 * engine captures `---`/`+++`/`---json` blocks at offset 0 into a raw
 * `Frontmatter` head node — decoding it is the frontmatter codec modules'
 * job. Parsed with the toggle off, such a document reports no frontmatter —
 * `MarkdownDocument.hasFrontmatterBlock` tells "no block in the source"
 * apart from "parsed with capture off".
 *
 * @public
 */
export class MarkdownParseOptions extends Schema.Class<MarkdownParseOptions>("MarkdownParseOptions")({
	dialect: Schema.optionalKey(MarkdownDialect),
	frontmatter: Schema.optionalKey(Schema.Boolean),
}) {}

/**
 * Parse failure: the {@link MarkdownDiagnostic} describing why the document
 * was rejected.
 *
 * @remarks
 * CommonMark has no syntax errors — every string is a valid document — so
 * this error carries only hardening-guard trips (`NestingDepthExceeded`).
 * Recoverable oddities are diagnostics on {@link MarkdownDocument}, not
 * failures. A malformed-looking document parses; a nesting bomb fails here
 * rather than crashing with a `RangeError`.
 *
 * The `message` renders the diagnostic's position 1-based
 * (`line + 1:character + 1`) for human readers — a CLI printing this string
 * shows the line/column a person counts in their editor. The structured
 * {@link MarkdownDiagnostic} `line`/`character` fields stay 0-based (LSP
 * convention); the offset applies to the rendered message only.
 *
 * @public
 */
export class MarkdownParseError extends Schema.TaggedError<MarkdownParseError>()("MarkdownParseError", {
	diagnostic: MarkdownDiagnostic,
}) {
	override get message(): string {
		const { code, line, character, message } = this.diagnostic;
		return `Markdown parse failed: ${code} at ${line + 1}:${character + 1} ${message}`;
	}
}

/**
 * Stringify failure: the {@link MarkdownDiagnostic} describing why the tree
 * was refused.
 *
 * @remarks
 * Serialization is total over parser-produced trees — the parser cannot
 * produce one that nests past the guard, because parsing it would have been
 * refused first. The only failures here are hardening-guard trips on
 * synthesized or decoded hostile trees, symmetric with
 * {@link MarkdownParseError}'s posture on parse. Stringify has no source
 * text to derive positions from, so the diagnostic's `line`/`character` are
 * `0` and `offset` carries whatever the offending node's position claimed.
 *
 * @public
 */
export class MarkdownStringifyError extends Schema.TaggedError<MarkdownStringifyError>()("MarkdownStringifyError", {
	diagnostic: MarkdownDiagnostic,
}) {
	override get message(): string {
		const { code, message } = this.diagnostic;
		return `Markdown stringify failed: ${code} ${message}`;
	}
}

/**
 * The dialect an options object resolves to. The PUBLIC default — `"gfm"`,
 * a product decision — is spelled exactly once, here. The engine's own
 * `parseBlocks` default is `"commonmark"` and means something different: the
 * base dialect the registries compose on top of. The facade always passes
 * this resolved value explicitly, so the two defaults never interact.
 */
const dialectOf = (options?: MarkdownParseOptions): MarkdownDialect => options?.dialect ?? "gfm";

/**
 * Whether an options object opts into frontmatter capture. The default —
 * `false` — is spelled exactly once, here: capture changes how
 * a `---` at offset 0 parses, so the spec-conformant reading is the default
 * and frontmatter is the consumer's explicit choice.
 */
const frontmatterOf = (options?: MarkdownParseOptions): boolean => options?.frontmatter ?? false;

/**
 * Run the block pass, converting the engine's raw carriers into a typed
 * {@link MarkdownParseError} and letting everything else through as a defect.
 *
 * Shared by {@link Markdown.parseResult} and `MarkdownDocument.parseResult`
 * so the two entry points can never disagree about what is typed and what is
 * a defect.
 *
 * @internal
 */
export const parsePassResult: {
	(text: string, options?: MarkdownParseOptions): Result.Result<BlockPassResult, MarkdownParseError>;
	(options?: MarkdownParseOptions): (text: string) => Result.Result<BlockPassResult, MarkdownParseError>;
} = dual((args) => isString(args[0]), (
	text: string,
	options?: MarkdownParseOptions,
): Result.Result<BlockPassResult, MarkdownParseError> => {
	try {
		return Result.succeed(parseBlocks(text, dialectOf(options), frontmatterOf(options)));
	} catch (caught) {
		if (isGuardExceeded(caught)) {
			return Result.fail(
				MarkdownParseError.make({
					diagnostic: MarkdownDiagnostic.fromRaw(text, {
						code: caught.reason,
						message: caught.message,
						offset: caught.offset,
						length: 0,
					}),
				}),
			);
		}
		if (isRawMarkdownError(caught)) {
			return Result.fail(MarkdownParseError.make({ diagnostic: MarkdownDiagnostic.fromRaw(text, caught.diagnostic) }));
		}
		throw caught;
	}
});

/**
 * The markdown facade: parse markdown source — GFM by default, CommonMark by
 * option — into an mdast-shaped {@link Root} tree, as a pure `Result` or as
 * an `Effect`.
 *
 * @public
 */
export class Markdown {
	/**
	 * Parse markdown into a {@link Root} tree, synchronously, as a `Result`.
	 * The pure primitive: a non-Effect caller (a build script, a Vite plugin,
	 * a language-server tick) can call this directly instead of wrapping
	 * `Effect.runSync(Effect.result(Markdown.parse(text)))`.
	 *
	 * @remarks
	 * {@link Markdown.parse} is defined in terms of this function; the two
	 * never diverge. Reach for the `Effect` variant inside Effect code — it
	 * carries the `Markdown.parse` tracing span — and for this one at
	 * synchronous boundaries. This function carries no span: it is not an
	 * `Effect`.
	 *
	 * Failure is rare by design: every string is a valid markdown document in
	 * both dialects, so the only failures are hardening-guard trips such as
	 * nesting past the 256-container cap. Programmer errors are not converted
	 * — they propagate as thrown defects.
	 *
	 * @example
	 * ```ts
	 * import { Markdown } from "./index.ts";
	 * import { Result } from "effect";
	 *
	 * const ok = Markdown.parseResult("# Title\n\nBody *text*.\n");
	 * if (Result.isSuccess(ok)) {
	 *   console.log(ok.success.children.length); // => 2
	 * }
	 * ```
	 *
	 * @param text - The markdown source to parse.
	 * @param options - Optional {@link MarkdownParseOptions}; the dialect
	 *   defaults to `"gfm"`.
	 * @returns A `Result` succeeding with the document {@link Root}, or
	 *   failing with {@link MarkdownParseError}.
	 */
	static parseResult(text: string, options?: MarkdownParseOptions): Result.Result<Root, MarkdownParseError> {
		return Result.map(parsePassResult(text, options), (pass) => pass.root);
	}

	/**
	 * Parse markdown into a {@link Root} tree. Defined in terms of
	 * {@link Markdown.parseResult} — synchronous callers can use that variant
	 * directly.
	 *
	 * @param text - The markdown source to parse.
	 * @param options - Optional {@link MarkdownParseOptions}; the dialect
	 *   defaults to `"gfm"`.
	 * @returns An `Effect` that succeeds with the document {@link Root}, or
	 *   fails with {@link MarkdownParseError}.
	 */
	static readonly parse = Effect.fn("Markdown.parse")((text: string, options?: MarkdownParseOptions) =>
		Effect.fromResult(Markdown.parseResult(text, options)),
	);

	/**
	 * Parse a text fragment as a single paragraph's inline content,
	 * synchronously, as a `Result` — the phrasing-level twin of
	 * {@link Markdown.parseResult}, for callers holding already-markdown
	 * prose (a link-carrying sentence, a backtick span) who want its
	 * phrasing nodes without a full document parse and a paragraph splice.
	 *
	 * @remarks
	 * The whole input is prepared exactly the way the block pass prepares one
	 * paragraph's content — leading and trailing whitespace trimmed, line
	 * terminators normalized to `\n` — and handed to the inline pass, so the
	 * result matches the `children` of the paragraph a full parse of the same
	 * fragment would produce. Node positions are correct relative to the
	 * input string.
	 *
	 * Two consequences of the single-paragraph contract:
	 *
	 * - **Blank lines do not break blocks.** A `\n\n` in the input stays
	 *   inline content (literal newlines in a text node); nothing at this
	 *   level opens a heading, list or code block — `# foo` is the text
	 *   `# foo`.
	 * - **No reference context exists.** The fragment carries no definitions,
	 *   so `[foo]`, `![foo]` and `[^foo]` remain literal text — the same
	 *   result a full parse of the isolated fragment produces.
	 *
	 * `options.dialect` selects the inline dialect (default `"gfm"`);
	 * `options.frontmatter` has no effect at phrasing level. Failure is rare
	 * by design, on {@link Markdown.parseResult}'s terms: only a
	 * hardening-guard trip (delimiter or bracket nesting past the cap) fails.
	 *
	 * @example
	 * ```ts
	 * import { Markdown } from "./index.ts";
	 * import { Result } from "effect";
	 *
	 * const ok = Markdown.parsePhrasingResult("see [the docs](./docs.md)");
	 * if (Result.isSuccess(ok)) {
	 *   console.log(ok.success.map((node) => node.type)); // => ["text", "link"]
	 * }
	 * ```
	 *
	 * @param text - The prose fragment to parse.
	 * @param options - Optional {@link MarkdownParseOptions}; the dialect
	 *   defaults to `"gfm"`.
	 * @returns A `Result` succeeding with the fragment's phrasing content, or
	 *   failing with {@link MarkdownParseError}.
	 */
	static parsePhrasingResult(
		text: string,
		options?: MarkdownParseOptions,
	): Result.Result<ReadonlyArray<PhrasingContent>, MarkdownParseError> {
		try {
			return Result.succeed(parsePhrasingText(text, dialectOf(options)));
		} catch (caught) {
			if (isGuardExceeded(caught)) {
				return Result.fail(
					MarkdownParseError.make({
						diagnostic: MarkdownDiagnostic.fromRaw(text, {
							code: caught.reason,
							message: caught.message,
							offset: caught.offset,
							length: 0,
						}),
					}),
				);
			}
			throw caught;
		}
	}

	/**
	 * Parse a text fragment as a single paragraph's inline content. Defined
	 * in terms of {@link Markdown.parsePhrasingResult} — synchronous callers
	 * can use that variant directly; the single-paragraph contract (blank
	 * lines stay inline, references never form) is documented there.
	 *
	 * @param text - The prose fragment to parse.
	 * @param options - Optional {@link MarkdownParseOptions}; the dialect
	 *   defaults to `"gfm"`.
	 * @returns An `Effect` that succeeds with the fragment's phrasing
	 *   content, or fails with {@link MarkdownParseError}.
	 */
	static readonly parsePhrasing = Effect.fn("Markdown.parsePhrasing")((text: string, options?: MarkdownParseOptions) =>
		Effect.fromResult(Markdown.parsePhrasingResult(text, options)),
	);

	/**
	 * Serialize a {@link Root} tree to canonical markdown, synchronously, as a
	 * `Result`. The pure primitive twin of {@link Markdown.stringify}, on the
	 * same terms as {@link Markdown.parseResult}.
	 *
	 * @remarks
	 * Canonical serialization: fidelity fields (marker characters, fence
	 * style, heading spelling) win when present; documented canonical
	 * defaults apply when absent. One default surprises: a language-less
	 * `Code` node with no explicit `fenceChar` serializes as an
	 * **indented** code block — set `fenceChar` (or a `lang`) on the node for
	 * a fence, or normalize afterward with
	 * `MarkdownFormattingOptions.codeBlockStyle: "fenced"`. The output
	 * re-parses to a render-equivalent document — the corpus-pinned
	 * contract — but is not a byte-level round-trip of any original source;
	 * surgical editing goes through the offset-splice edit layer instead.
	 *
	 * **The canonical form is a stability commitment, so a test may assert
	 * against these bytes.** There are no options to configure and therefore
	 * nothing to drift, the choices below are pinned by byte-level tests, and
	 * the engine is cross-checked against commonmark.js over the full
	 * CommonMark 0.31.2 corpus. Changing any of them is a **breaking** change
	 * to this package, never a patch. A consumer asserting on rendered
	 * markdown should serialize through here rather than through a third-party
	 * stringifier whose defaults are free to move.
	 *
	 * The canonical choices a byte-level assertion depends on, for a node
	 * carrying no fidelity field:
	 *
	 * | Construct | Canonical form |
	 * | --- | --- |
	 * | Heading | ATX (`## x`), at every depth |
	 * | Thematic break | `***` |
	 * | Bullet list marker | `-` |
	 * | Ordered list delimiter | `.`, flipping to `)` to separate an immediately adjacent sibling list |
	 * | Emphasis / strong | `*` / `**` |
	 * | Code block | fenced when the node carries a `lang` or a `fenceChar`, with the fence grown past any interior backtick run; otherwise indented — **except where indenting would not re-parse as a code block**, which forces a fence (see below) |
	 * | Block separation | exactly one blank line |
	 * | Document | a single trailing newline |
	 *
	 * A node carrying a fidelity field overrides the corresponding row —
	 * `headingStyle: "setext"`, `markerChar`, `fenceChar`, `delimiter` — which
	 * is how a parsed document re-serializes in its author's spelling. The
	 * rows describe a synthesized node, which is the case a test asserting on
	 * generated markdown actually has.
	 *
	 * **Text escaping is canonical unless a `Text` node opts out.** A `Text`
	 * carrying `escapeStyle: "literal"` is emitted verbatim apart from the
	 * escapes that protect block structure (a table cell's `|`, a newline in a
	 * single-line container, line-start block openers); its exact set is
	 * documented on {@link Text}. The opt-out is additive: a tree that never
	 * sets it serializes byte-identically to the canonical form.
	 *
	 * **Representability wins over the table.** The canonical form never emits
	 * text that would re-parse as something else, so a row yields where the two
	 * conflict. The case that reaches a consumer is the indented code block: an
	 * indented block directly after a list is absorbed as list content, so a
	 * `Code` node with neither `lang` nor `fenceChar` emits **fenced** in that
	 * position and indented everywhere else. A byte-level assertion over
	 * synthesized code blocks therefore depends on the preceding sibling.
	 *
	 * **The posture that makes this a non-issue**, and the one a consumer
	 * building trees for byte-level assertion should adopt: set `fenceChar` on
	 * every `Code` node that carries neither a `lang` nor one already, in a
	 * post-decode walk that reaches nested nodes. The choice then leaves the
	 * emitter entirely and no output depends on a node's neighbours.
	 *
	 * **MDX nodes (constructed trees only — the parser reads no MDX syntax)**
	 * serialize to valid MDX with the mdast-util-mdx defaults, and these
	 * choices are part of the same stability commitment: attribute values
	 * quote with `"` (the quote escaped as `&#x22;`), an empty element
	 * self-closes spaced (`<a />`), a fragment is `<></>`, flow children take
	 * block layout indented two spaces per JSX ancestor, attributes move onto
	 * their own lines only when one carries a line ending, expressions emit
	 * `{expr}` with two-space continuation indent, and ESM values emit
	 * verbatim. A tree containing any MDX node additionally escapes `{` in
	 * text — MDX makes it significant — while a tree with none serializes
	 * byte-identically to the table above.
	 *
	 * To *normalize* a document to different choices — a `-` list rewritten to
	 * `*`, setext headings rewritten to ATX — use `MarkdownFormat` with
	 * `MarkdownFormattingOptions`. That is the configurable surface; this one
	 * deliberately is not.
	 *
	 * Failure is rare by design, symmetric with parse: only a hardening-guard
	 * trip on a tree nesting past the depth cap fails, and only synthesized
	 * or decoded trees can nest that far.
	 *
	 * @param root - The document tree to serialize.
	 * @returns A `Result` succeeding with markdown source, or failing with
	 *   {@link MarkdownStringifyError}.
	 */
	static stringifyResult(root: Root): Result.Result<string, MarkdownStringifyError> {
		try {
			return Result.succeed(stringifyTree(root));
		} catch (caught) {
			if (isGuardExceeded(caught)) {
				return Result.fail(
					MarkdownStringifyError.make({
						diagnostic: MarkdownDiagnostic.make({
							code: caught.reason,
							message: caught.message,
							offset: caught.offset,
							length: 0,
							line: 0,
							character: 0,
						}),
					}),
				);
			}
			throw caught;
		}
	}

	/**
	 * Serialize a {@link Root} tree to canonical markdown. Defined in terms of
	 * {@link Markdown.stringifyResult} — synchronous callers can use that
	 * variant directly.
	 *
	 * @remarks
	 * The canonical form is a **stability commitment** and safe to assert
	 * against byte-for-byte; the choices it makes, and the reason changing one
	 * is a breaking change, are documented on
	 * {@link Markdown.stringifyResult}.
	 *
	 * **Fidelity fields must be set on the DECODED tree.** `Mdast.fromMdast`
	 * admits spec mdast and strips everything outside it, so a `fenceChar`,
	 * `headingStyle`, `markerChar` or `delimiter` placed on a plain mdast tree
	 * before admission is silently dropped and the canonical default applies.
	 * Set them on the nodes that come back. The exception is `Text`'s
	 * `escapeStyle`, an emitter instruction rather than a source spelling,
	 * which the boundary admits.
	 *
	 * @param root - The document tree to serialize.
	 * @returns An `Effect` that succeeds with markdown source, or fails with
	 *   {@link MarkdownStringifyError}.
	 */
	static readonly stringify = Effect.fn("Markdown.stringify")((root: Root) =>
		Effect.fromResult(Markdown.stringifyResult(root)),
	);

	/**
	 * A `Schema<Root, string>` decoding markdown source into a {@link Root}
	 * tree and encoding a tree back to canonical markdown via
	 * {@link Markdown.stringifyResult}.
	 *
	 * @remarks
	 * Schema-producing: each call returns a fresh schema whose derivation
	 * caches are not shared across calls. Bind the result to a `const` on hot
	 * paths; the pre-bound {@link Markdown.MarkdownFromString} covers the
	 * common case.
	 *
	 * @param options - Optional {@link MarkdownParseOptions} applied on
	 *   decode.
	 * @returns A `Schema.Codec<Root, string>`.
	 */
	static fromString(options?: MarkdownParseOptions): Schema.Codec<Root, string> {
		return Schema.String.pipe(
			Schema.decodeTo(
				Root,
				SchemaTransformation.transformEffect({
					decode: (input: string) =>
						Effect.mapError(
							Markdown.parse(input, options),
							(error) => new SchemaIssue.InvalidValue({ message: error.message }, input),
						),
					encode: (value: Root) =>
						Effect.mapError(
							Markdown.stringify(value),
							(error) => new SchemaIssue.InvalidValue({ message: error.message }, value),
						),
				}),
			),
		);
	}

	/**
	 * The zero-config `Schema<Root, string>` — `Markdown.fromString()`
	 * pre-bound so the common case needs no memoization discipline.
	 */
	static readonly MarkdownFromString: Schema.Codec<Root, string> = Markdown.fromString();
}
