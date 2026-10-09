// The frontmatter composition seam: the codec contract the free-standing
// codec modules (`YamlFrontmatter`, `TomlFrontmatter`, `JsonFrontmatter`)
// implement, and the typed errors they fail with. The schema composition
// helper (`MarkdownFrontmatter.schema`, typed gray-matter parity) and its
// write mirror (`MarkdownFrontmatter.set`/`setToString`, schema-encode →
// codec-encode → one offset-splice edit) live here too, keeping this module
// the one lean seam between the raw capture node and a consumer's typed data.
//
// The codecs themselves are deliberately NOT defined or re-exported here —
// one module each, never a namespace object. Collecting them would make this
// module a dispatch table: referencing it would reach every codec, every
// codec reaches its format engine, and a JSON-only consumer would drag the
// yaml and toml engines into their bundle (the config-file tree-shaking
// rule, applied verbatim).

import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { MarkdownDocument } from "./MarkdownDocument.ts";
import { MarkdownEdit } from "./MarkdownEdit.ts";
import type { Frontmatter as FrontmatterNode } from "./MarkdownNode.ts";
import { FrontmatterFormat } from "./MarkdownNode.ts";

/**
 * Indicates that a frontmatter codec was handed a capture of a different
 * format — a yaml codec applied to a `+++` toml capture, for example.
 *
 * @remarks
 * The mismatch is detected before any parsing happens, so `cause`-free: the
 * node's `format` marker and the codec's declared `format` simply disagree.
 * Route on the `"FrontmatterFormatMismatchError"` tag with `Effect.catchTag`.
 *
 * @public
 */
export class FrontmatterFormatMismatchError extends S.TaggedError<FrontmatterFormatMismatchError>()(
	"FrontmatterFormatMismatchError",
	{
		/** The format the codec decodes. */
		expected: FrontmatterFormat,
		/** The format the capture node actually carries. */
		actual: FrontmatterFormat,
	},
) {
	override get message(): string {
		return `frontmatter format mismatch: the ${this.expected} codec cannot decode a ${this.actual} capture`;
	}
}

/**
 * Indicates that a frontmatter capture's content failed to parse in its
 * declared format.
 *
 * @remarks
 * The underlying format package's failure is preserved structurally in
 * `cause` — never stringified — so a consumer can reach the positioned
 * diagnostics the format engines carry. Route on the
 * `"FrontmatterDecodeError"` tag with `Effect.catchTag`.
 *
 * @public
 */
export class FrontmatterDecodeError extends S.TaggedError<FrontmatterDecodeError>()("FrontmatterDecodeError", {
	/** The format that failed to parse. */
	format: FrontmatterFormat,
	/** The underlying format-package failure, preserved structurally. */
	cause: S.Defect(),
}) {
	override get message(): string {
		return `frontmatter ${this.format} content failed to parse`;
	}
}

/**
 * Indicates that frontmatter data failed to serialize in a codec's format.
 *
 * @remarks
 * The exact mirror of {@link FrontmatterDecodeError} on the write side: the
 * underlying format package's failure is preserved structurally in `cause` —
 * never stringified — so a consumer can reach the typed stringify error the
 * format engines carry (a `JsoncStringifyError`'s `code`, for example). Route
 * on the `"FrontmatterEncodeError"` tag with `Effect.catchTag`.
 *
 * @public
 */
export class FrontmatterEncodeError extends S.TaggedError<FrontmatterEncodeError>()("FrontmatterEncodeError", {
	/** The format that failed to serialize. */
	format: FrontmatterFormat,
	/** The underlying format-package failure, preserved structurally. */
	cause: S.Defect(),
}) {
	override get message(): string {
		return `frontmatter ${this.format} content failed to serialize`;
	}
}

/**
 * A frontmatter codec: how to turn a raw `Frontmatter` capture into decoded
 * data, and data back into a serialized frontmatter body.
 *
 * @remarks
 * The three built-in codecs — `YamlFrontmatter`, `TomlFrontmatter` and
 * `JsonFrontmatter` — are free-standing named exports, one per module, each
 * peering on its format package (`@effected/yaml`, `@effected/toml`,
 * `@effected/jsonc`). They are deliberately never collected into a namespace
 * object: name the one codec you use and a bundler drops the rest, engines
 * included.
 *
 * A codec checks the capture's `format` marker before parsing and fails with
 * {@link FrontmatterFormatMismatchError} when handed the wrong format;
 * unparseable content fails with {@link FrontmatterDecodeError} carrying the
 * format package's failure structurally.
 *
 * `encode` is the mirror: it serializes data to the body text that belongs
 * between the fences — never the fences themselves, which are
 * format-determined and rendered by the write seam
 * ({@link MarkdownFrontmatter.set}). The engine's native output is returned
 * as-is; the seam normalizes the final line terminator when fencing.
 * Serialization failures — a circular reference, a value the format cannot
 * represent — fail with {@link FrontmatterEncodeError} carrying the format
 * package's failure structurally.
 *
 * @public
 */
export interface FrontmatterCodec {
	/** The format this codec decodes and encodes. */
	readonly format: FrontmatterFormat;
	/** Decode a capture node's raw value into data. */
	readonly decode: (
		node: FrontmatterNode,
	) => Effect.Effect<unknown, FrontmatterDecodeError | FrontmatterFormatMismatchError>;
	/** Serialize data into a frontmatter body, without fences. */
	readonly encode: (data: unknown) => Effect.Effect<string, FrontmatterEncodeError>;
}

/**
 * Why a frontmatter decoder found no capture on a document.
 *
 * @remarks
 * `"absent"` — the source genuinely has no frontmatter block.
 * `"captureDisabled"` — the source opens with a well-formed frontmatter
 * block, but the document carries no capture node: it was parsed without
 * `frontmatter: true` (the toggle defaults off), so spec-correct CommonMark
 * read the fences as ordinary content.
 *
 * @public
 */
export const FrontmatterMissingReason = S.Literals(["absent", "captureDisabled"]);

/**
 * Why a frontmatter decoder found no capture on a document.
 *
 * @public
 */
export type FrontmatterMissingReason = typeof FrontmatterMissingReason.Type;

/**
 * Indicates that a document handed to a frontmatter decoder carries no
 * frontmatter capture.
 *
 * @remarks
 * `reason` distinguishes the two ways this happens: `"absent"` when the
 * source genuinely has no frontmatter block, `"captureDisabled"` when the
 * source opens with one but the document was parsed with the capture toggle
 * off (`MarkdownParseOptions.frontmatter` defaults to `false`) — the fix
 * there is parsing with `frontmatter: true`, not editing the document. The
 * discriminant is computed from the same structural signal
 * `MarkdownDocument.hasFrontmatterBlock` exposes, so the error and the
 * accessor can never disagree.
 *
 * Cause-free: there is nothing to diagnose beyond the absence itself.
 * Consumers wanting optional semantics can
 * `Effect.catchTag("FrontmatterMissingError", ...)` to a default.
 *
 * @public
 */
export class FrontmatterMissingError extends S.TaggedError<FrontmatterMissingError>()("FrontmatterMissingError", {
	/** Why there is no capture: no block at all, or capture left off. */
	reason: FrontmatterMissingReason,
}) {
	override get message(): string {
		return this.reason === "captureDisabled"
			? "the source opens with a frontmatter block, but it was not captured; parse with `frontmatter: true`"
			: "the document has no frontmatter block";
	}
}

/**
 * Indicates that decoded frontmatter data did not satisfy the consumer's
 * schema.
 *
 * @remarks
 * `issue` carries the **structured** schema failure — at runtime a
 * `SchemaIssue.Issue` tree, reachable through `_tag` and nested `issues` —
 * never a stringified rendering. It is typed `unknown` because core exposes
 * no `Schema` for `Issue`; narrow it with the `SchemaIssue` module.
 *
 * @public
 */
export class FrontmatterValidationError extends S.TaggedError<FrontmatterValidationError>()(
	"FrontmatterValidationError",
	{
		/** The structured schema issue. Never a string. */
		issue: S.Defect(),
	},
) {
	override get message(): string {
		return "frontmatter data failed schema validation";
	}
}

/**
 * The union of everything a composed frontmatter decoder can fail with.
 *
 * @public
 */
export type FrontmatterSchemaError =
	| FrontmatterMissingError
	| FrontmatterFormatMismatchError
	| FrontmatterDecodeError
	| FrontmatterValidationError;

/**
 * The union of everything the frontmatter write seam can fail with.
 *
 * @remarks
 * Deliberately without `FrontmatterMissingError`: a document with no
 * frontmatter capture is the **insert** path of {@link MarkdownFrontmatter.set},
 * not an error.
 *
 * @public
 */
export type FrontmatterWriteError =
	| FrontmatterFormatMismatchError
	| FrontmatterEncodeError
	| FrontmatterValidationError;

/**
 * The opening and closing fence lines for a frontmatter format — the closed
 * grammar the capture scanner recognizes: `---`…`---` yaml, `+++`…`+++` toml,
 * `---json`…`---` json.
 */
const FENCES: Record<FrontmatterFormat, { readonly open: string; readonly close: string }> = {
	yaml: { open: "---", close: "---" },
	toml: { open: "+++", close: "+++" },
	json: { open: "---json", close: "---" },
};

/**
 * Render a full frontmatter block — fences included, no trailing terminator
 * after the closing fence. The body's final line terminator is normalized:
 * the engines disagree (yaml and toml stringify emit a trailing newline,
 * jsonc does not), and an empty body (toml's encoding of `{}`) collapses to
 * adjacent fence lines.
 */
const renderBlock = (format: FrontmatterFormat, body: string): string => {
	const { open, close } = FENCES[format];
	const normalized = body === "" || body.endsWith("\n") ? body : `${body}\n`;
	return `${open}\n${normalized}${close}`;
};

/**
 * The frontmatter schema composition facade: decodes a parsed document's frontmatter into typed data, and writes typed data back as a frontmatter block.
 *
 * @remarks
 * Named `MarkdownFrontmatter` rather than `Frontmatter` because `Frontmatter`
 * names the capture node class (the node classes are named after their mdast
 * types).
 *
 * @example
 * ```ts
 * import { MarkdownDocument, MarkdownFrontmatter, MarkdownParseOptions, YamlFrontmatter } from "./index.ts";
 * import { Effect, Schema } from "effect";
 *
 * const Meta = Schema.Struct({ title: Schema.String });
 *
 * const program = Effect.gen(function* () {
 *   // Frontmatter capture is opt-in at parse time.
 *   const source = "---\ntitle: Hello\n---\n\n# Body\n";
 *   const doc = yield* MarkdownDocument.parse(source, MarkdownParseOptions.make({ frontmatter: true }));
 *   return yield* MarkdownFrontmatter.schema(Meta, YamlFrontmatter)(doc); // { title: "Hello" }
 * });
 * ```
 *
 * @public
 */
export class MarkdownFrontmatter {
	/**
	 * Compose a consumer schema with a {@link FrontmatterCodec} into a typed
	 * decoder over a parsed `MarkdownDocument`.
	 *
	 * @remarks
	 * The decoder reads the document's frontmatter capture (parse with
	 * `frontmatter: true` — the toggle defaults off), decodes its raw value
	 * through the codec, then validates the data against `schema`. Each stage
	 * fails typed: no capture is {@link FrontmatterMissingError} (its `reason`
	 * says whether the block is genuinely absent or capture was left off), a
	 * wrong-format codec is {@link FrontmatterFormatMismatchError}, unparseable
	 * content is {@link FrontmatterDecodeError}, and schema-invalid data is
	 * {@link FrontmatterValidationError} carrying the structured issue.
	 *
	 * The seam takes the parsed document, not raw source: parse options
	 * (dialect, the frontmatter toggle) stay at the consumer's parse call and
	 * are never guessed here. Node-level composition remains available through
	 * `MarkdownDocument.frontmatter` plus the codec's own `decode`.
	 *
	 * Schema-producing in spirit: bind the returned decoder to a `const` when
	 * decoding many documents.
	 *
	 * @param schema - The schema the decoded frontmatter data must satisfy.
	 * @param codec - The format codec to decode the raw capture with.
	 * @returns A function from a parsed document to an `Effect` of the typed
	 *   frontmatter data.
	 */
	static schema<T, E, RD = never, RE = never>(
		schema: S.Codec<T, E, RD, RE>,
		codec: FrontmatterCodec,
	): (document: MarkdownDocument) => Effect.Effect<T, FrontmatterSchemaError, RD> {
		return (document) => {
			const node = document.frontmatter;
			return node === undefined
				? // The discriminant is the document's own structural signal: a source
					// that opens with a capturable block but carries no capture node was
					// parsed with the toggle off — the accessor and this error agree by
					// construction.
					Effect.fail(
						FrontmatterMissingError.make({ reason: document.hasFrontmatterBlock ? "captureDisabled" : "absent" }),
					)
				: codec.decode(node).pipe(
						Effect.flatMap((data) =>
							S.decodeUnknownEffect(schema)(data).pipe(
								// Normalize the schema failure at the boundary. Never leak
								// SchemaError deeper, never stringify it — carry its
								// structured issue tree instead.
								Effect.catchTag("SchemaError", (error) =>
									Effect.fail(FrontmatterValidationError.make({ issue: error.issue })),
								),
							),
						),
					);
		};
	}

	/**
	 * Compose a consumer schema with a {@link FrontmatterCodec} into a typed
	 * frontmatter **writer** over a parsed `MarkdownDocument` — the write
	 * mirror of {@link MarkdownFrontmatter.schema}.
	 *
	 * @remarks
	 * The writer schema-**encodes** the typed data, serializes it through the
	 * codec and returns the offset-splice edits that put the block in place —
	 * always exactly one:
	 *
	 * - A document **with** a frontmatter capture of the codec's format gets a
	 *   replacement of the entire block, both fence lines included; everything
	 *   outside the block survives byte-identical. A capture of a *different*
	 *   format fails with {@link FrontmatterFormatMismatchError} — the fences
	 *   are never switched.
	 * - A document with **no** capture gets one insert at offset 0: the fenced
	 *   block plus a blank line separating it from the existing content. Parse
	 *   with `frontmatter: true` (the toggle defaults off) — the same
	 *   precondition `schema` has — so absence means genuinely-no-frontmatter
	 *   and the insert cannot double a block the parse ignored.
	 *
	 * Each stage fails typed: schema-invalid data is
	 * {@link FrontmatterValidationError} carrying the structured issue, and a
	 * value the format cannot serialize is {@link FrontmatterEncodeError}
	 * carrying the format package's failure structurally.
	 *
	 * The block is re-serialized **whole** from the encoded data — gray-matter
	 * parity, not surgical editing — so anything the format's data model does
	 * not carry is not preserved: comments inside a yaml frontmatter block do
	 * **not** survive `set`. A per-key surgical mode over the format packages'
	 * edit layers is not offered.
	 *
	 * Schema-producing in spirit: bind the returned writer to a `const` when
	 * writing many documents.
	 *
	 * @param schema - The schema the frontmatter data is encoded through.
	 * @param codec - The format codec to serialize the encoded data with.
	 * @returns A function from a parsed document and the typed data to an
	 *   `Effect` of the edits that install the block.
	 */
	static set<T, E, RD = never, RE = never>(
		schema: S.Codec<T, E, RD, RE>,
		codec: FrontmatterCodec,
	): (document: MarkdownDocument, data: T) => Effect.Effect<ReadonlyArray<MarkdownEdit>, FrontmatterWriteError, RE> {
		return (document, data) => {
			const node = document.frontmatter;
			if (node !== undefined && node.format !== codec.format) {
				return Effect.fail(FrontmatterFormatMismatchError.make({ expected: codec.format, actual: node.format }));
			}
			return S.encodeUnknownEffect(schema)(data).pipe(
				// Normalize the schema failure at the boundary, exactly as the
				// decode side does: carry the structured issue tree, never a string.
				Effect.catchTag("SchemaError", (error) => Effect.fail(FrontmatterValidationError.make({ issue: error.issue }))),
				Effect.flatMap((encoded) => codec.encode(encoded)),
				Effect.map((body) => {
					const block = renderBlock(codec.format, body);
					if (node === undefined) {
						// Insert at the head: the block, its line terminator, and a
						// blank line before the existing content (nothing to separate
						// from in an empty document).
						const content = document.source.length === 0 ? `${block}\n` : `${block}\n\n`;
						return [MarkdownEdit.make({ offset: 0, length: 0, content })];
					}
					// Replace the whole node span — both fences included, and the
					// capture's position excludes the terminator after the closing
					// fence, so everything outside the block is untouched.
					const offset = node.position.start.offset;
					return [MarkdownEdit.make({ offset, length: node.position.end.offset - offset, content: block })];
				}),
			);
		};
	}

	/**
	 * Like {@link MarkdownFrontmatter.set}, but applies the edits to the
	 * document's source and returns the updated markdown text — the
	 * `modifyToString` parallel.
	 *
	 * @remarks
	 * Everything `set` documents holds verbatim: the whole-block
	 * re-serialization, the format-mismatch posture, the `frontmatter: true`
	 * precondition and the typed failures.
	 *
	 * @param schema - The schema the frontmatter data is encoded through.
	 * @param codec - The format codec to serialize the encoded data with.
	 * @returns A function from a parsed document and the typed data to an
	 *   `Effect` of the updated source text.
	 */
	static setToString<T, E, RD = never, RE = never>(
		schema: S.Codec<T, E, RD, RE>,
		codec: FrontmatterCodec,
	): (document: MarkdownDocument, data: T) => Effect.Effect<string, FrontmatterWriteError, RE> {
		const write = MarkdownFrontmatter.set(schema, codec);
		return (document, data) =>
			write(document, data).pipe(Effect.map((edits) => MarkdownEdit.applyAll(document.source, edits)));
	}
}
