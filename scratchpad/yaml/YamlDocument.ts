// The parsed-document concept: YamlDocument (root AST node plus
// errors/warnings-as-data, directives and document framing) and
// YamlDirective.
//
// The recoverable-parse design lives here: non-fatal diagnostics surface as
// data on `errors`/`warnings` while fatal ones fail `parse`/`parseAll` with a
// typed `YamlParseError`.

import { Effect, Schema, SchemaIssue, SchemaTransformation } from "effect";
import { composeAllDocuments, composeFirstDocument } from "./internal/composer/document.ts";
import { isFatalCode } from "./internal/diagnostics.ts";
import type { RawYamlDocument } from "./internal/raw-document.ts";
import { StringifyDepthExceeded, StringifyFailure, stringifyDocument } from "./internal/stringifier.ts";
import type { YamlParseOptions, YamlStringifyOptions } from "./Yaml.ts";
import { YamlParseError, YamlStringifyError } from "./Yaml.ts";
import { YamlDiagnostic } from "./YamlDiagnostic.ts";
import type { YamlNode as YamlNodeType } from "./YamlNode.ts";
import { YamlNode } from "./YamlNode.ts";

/**
 * A YAML directive appearing before a document (e.g. `%YAML 1.2` or
 * `%TAG ! tag:example.com,2000:`). `"YAML"` and `"TAG"` are the YAML 1.2
 * spec-defined directives; any other name is a reserved directive preserved
 * for round-trip fidelity.
 *
 * @public
 */
export class YamlDirective extends Schema.Class<YamlDirective>("YamlDirective")({
	name: Schema.String,
	parameters: Schema.Array(Schema.String),
}) {}

/**
 * A parsed YAML document: the root {@link (YamlNode:type)} (or `null` when
 * empty), recovered `errors` and `warnings` as {@link YamlDiagnostic} data,
 * the {@link YamlDirective} list, the optional document-level comments and the
 * `---`/`...` framing flags (absent flags read as `false`).
 *
 * `commentBefore` is a header block sitting AHEAD of a `---` marker; `comment`
 * is the trailing block after the content or the `...` marker. A header with
 * no marker, or one after the marker, belongs to the content rather than the
 * document — it leads the root node, or the first entry when there is no
 * marker to separate it from the item stream.
 *
 * Construct via `YamlDocument.parse` / `parseAll`; `YamlDocument.make` is for
 * synthetic documents.
 *
 * @public
 */
export class YamlDocument extends Schema.Class<YamlDocument>("YamlDocument")({
	contents: Schema.NullOr(Schema.suspend((): Schema.Schema<YamlNodeType> => YamlNode)),
	errors: Schema.Array(YamlDiagnostic),
	warnings: Schema.Array(YamlDiagnostic),
	directives: Schema.Array(YamlDirective),
	commentBefore: Schema.optionalKey(Schema.String),
	comment: Schema.optionalKey(Schema.String),
	hasDocumentStart: Schema.optionalKey(Schema.Boolean),
	hasDocumentEnd: Schema.optionalKey(Schema.Boolean),
	hasDocumentStartTab: Schema.optionalKey(Schema.Boolean),
}) {
	/**
	 * Parse a single YAML document, keeping the full AST, directives and
	 * recovered diagnostics. Fails with the aggregate {@link YamlParseError}
	 * when any fatal-code diagnostic is present; non-fatal diagnostics are
	 * data on the returned document.
	 */
	static readonly parse = Effect.fn("YamlDocument.parse")(function* (text: string, options?: YamlParseOptions) {
		const raw = composeFirstDocument(text, toParseInput(options));
		const fatal = raw.errors.filter((e) => isFatalCode(e.code));
		if (fatal.length > 0) {
			return yield* new YamlParseError({
				diagnostics: fatal.map((e) => YamlDiagnostic.fromRaw(e, text)),
				input: text,
			});
		}
		return fromRawDocument(raw, text);
	});

	/**
	 * Parse a multi-document YAML stream into one {@link YamlDocument} per
	 * document. Any fatal diagnostic in any document — or a stream-level
	 * directive-placement error — fails the whole Effect.
	 */
	static readonly parseAll = Effect.fn("YamlDocument.parseAll")(function* (text: string, options?: YamlParseOptions) {
		const { documents, streamErrors } = composeAllDocuments(text, toParseInput(options));
		const fatal = [
			...streamErrors.filter((e) => e.code === "InvalidDirective"),
			...documents.flatMap((d) => d.errors.filter((e) => isFatalCode(e.code))),
		];
		if (fatal.length > 0) {
			return yield* new YamlParseError({
				diagnostics: fatal.map((e) => YamlDiagnostic.fromRaw(e, text)),
				input: text,
			});
		}
		return documents.map((raw) => fromRawDocument(raw, text)) as ReadonlyArray<YamlDocument>;
	});

	/**
	 * A `Schema<YamlDocument, string>` decoding YAML text into a full
	 * document (AST, directives, diagnostics) and encoding a document back to
	 * YAML text.
	 *
	 * Schema-producing: each call returns a fresh schema whose derivation
	 * caches are not shared across calls; bind the result to a `const` on hot
	 * paths.
	 */
	static schema(options?: YamlParseOptions): Schema.Codec<YamlDocument, string> {
		return Schema.String.pipe(
			Schema.decodeTo(
				Schema.instanceOf(YamlDocument),
				SchemaTransformation.transformOrFail({
					decode: (input: string) =>
						YamlDocument.parse(input, options).pipe(
							Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, input)),
						),
					encode: (doc: YamlDocument) =>
						doc
							.stringify()
							.pipe(Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }, doc))),
				}),
			),
		);
	}

	/**
	 * Stringify this document (contents, directives and framing) as YAML.
	 * Fails with {@link YamlStringifyError} on circular references introduced
	 * into a synthetic AST (`CircularReference`) or on a synthetic AST nested
	 * deeper than the stringifier's recursion budget (`NestingDepthExceeded`)
	 * — both surface through the typed error channel rather than as an
	 * unhandled stack-overflow defect.
	 *
	 * @remarks
	 * `YamlStringifyOptions.lineWidth` is not honored here: column-based
	 * scalar folding exists only on the value path, through the entry points
	 * that accept stringify options ({@link Yaml.stringify} and
	 * {@link Yaml.stringifyResult}). The
	 * document/node path threads `lineWidth` into its render context but
	 * never reads it, so long scalars are emitted unfolded regardless of the
	 * option. Callers that need folding should render the plain value
	 * instead — `Yaml.stringify(doc.toValue(), options)` — at the cost of
	 * the document-level framing and styles this path preserves.
	 */
	stringify(options?: YamlStringifyOptions): Effect.Effect<string, YamlStringifyError> {
		return Effect.try({
			try: () => stringifyDocument(toRawDocument(this), toStringifyInput(options)),
			catch: (defect) => {
				if (defect instanceof StringifyFailure) {
					return new YamlStringifyError({
						diagnostics: [
							YamlDiagnostic.make({
								code: "CircularReference",
								message: defect.reason,
								offset: 0,
								length: 0,
								line: 0,
								character: 0,
							}),
						],
						value: this,
					});
				}
				// A synthetic AST nested deeper than the stringifier's cap overflowed
				// the node-path recursion — surface it typed, not as a stack-overflow
				// defect.
				if (defect instanceof StringifyDepthExceeded) {
					return new YamlStringifyError({
						diagnostics: [
							YamlDiagnostic.make({
								code: "NestingDepthExceeded",
								message: defect.message,
								offset: 0,
								length: 0,
								line: 0,
								character: 0,
							}),
						],
						value: this,
					});
				}
				throw defect;
			},
		});
	}

	/**
	 * Reconstruct the plain JavaScript value of this document's contents,
	 * resolving anchors and aliases. `null` for an empty document. Pure and
	 * total.
	 */
	toValue(): unknown {
		if (this.contents === null) return null;
		const anchors = new Map<string, YamlNodeType>();
		return this.contents.toValue(anchors);
	}
}

// ── Raw-document bridging ───────────────────────────────────────────────────

const toParseInput = (options?: YamlParseOptions) =>
	options === undefined
		? {}
		: {
				strict: options.strict,
				maxAliasCount: options.maxAliasCount,
				uniqueKeys: options.uniqueKeys,
			};

const toStringifyInput = (options?: YamlStringifyOptions) =>
	options === undefined
		? {}
		: {
				indent: options.indent,
				lineWidth: options.lineWidth,
				defaultScalarStyle: options.defaultScalarStyle,
				defaultCollectionStyle: options.defaultCollectionStyle,
				sortKeys: options.sortKeys,
				indentSequences: options.indentSequences,
				quoteStyle: options.quoteStyle,
				quoteCompat: options.quoteCompat,
				finalNewline: options.finalNewline,
				forceDefaultStyles: options.forceDefaultStyles,
			};

/**
 * Materialize a raw engine document into the public class — including
 * documents whose diagnostics are fatal, which `YamlDocument.parse` refuses.
 * The lint layer builds its context through this so linting runs on
 * malformed input; it is NOT a second public parse entry point (not
 * re-exported from the package index).
 *
 * @internal
 */
export function documentFromRaw(raw: RawYamlDocument, text: string): YamlDocument {
	return fromRawDocument(raw, text);
}

/** Materialize a raw engine document into the public class. */
function fromRawDocument(raw: RawYamlDocument, text: string): YamlDocument {
	return new YamlDocument({
		contents: raw.contents,
		errors: raw.errors.map((e) => YamlDiagnostic.fromRaw(e, text)),
		warnings: raw.warnings.map((w) => YamlDiagnostic.fromRaw(w, text)),
		directives: raw.directives.map((d) => new YamlDirective({ name: d.name, parameters: d.parameters })),
		...(raw.commentBefore !== undefined ? { commentBefore: raw.commentBefore } : {}),
		...(raw.comment !== undefined ? { comment: raw.comment } : {}),
		hasDocumentStart: raw.hasDocumentStart,
		hasDocumentEnd: raw.hasDocumentEnd,
		hasDocumentStartTab: raw.hasDocumentStartTab,
	});
}

/** Project the public class back onto the raw shape the engine consumes. */
function toRawDocument(doc: YamlDocument): RawYamlDocument {
	return {
		contents: doc.contents,
		errors: [],
		warnings: [],
		directives: doc.directives,
		...(doc.commentBefore !== undefined ? { commentBefore: doc.commentBefore } : {}),
		...(doc.comment !== undefined ? { comment: doc.comment } : {}),
		hasDocumentStart: doc.hasDocumentStart ?? false,
		hasDocumentEnd: doc.hasDocumentEnd ?? false,
		hasDocumentStartTab: doc.hasDocumentStartTab ?? false,
	};
}
