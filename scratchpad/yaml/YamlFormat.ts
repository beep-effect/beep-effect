// The formatting/modification concept: computing non-mutating edits that
// reformat a document or change a value at a path, via the library's
// parse → transform AST → stringify → diff pipeline.
//
// Cycle firewall: this module drives the internal engine directly
// (`composeFirstDocumentCounted`, `stringifyDocument`) exactly as `Yaml.ts`
// does; nothing imports `YamlFormat.ts` back.
//
// Neither `format` nor `modify` catch the internal stringifier's
// `StringifyFailure` (the circular-reference guard): both build their output
// AST from either already-parsed nodes or `jsValueToNode`'s scalar-only
// synthesis, so a cycle can never occur here — if `StringifyFailure` were
// ever thrown it would indicate an internal invariant violation, not a
// user-facing error, and is left to surface as an uncaught defect.

import { Effect, Schema } from "effect";
import { EMPTY_DOCUMENT, composeAllDocuments, composeFirstDocumentCounted } from "./internal/composer/document.ts";
import type { RawDiagnostic } from "./internal/diagnostics.ts";
import { isFatalCode } from "./internal/diagnostics.ts";
import { computeEdits } from "./internal/diff.ts";
import type { RawYamlDocument } from "./internal/raw-document.ts";
import { requoteScalarText } from "./internal/requote.ts";
import { stringifyDocument, stripNodeComments } from "./internal/stringifier.ts";
import { YamlStringifyOptions } from "./Yaml.ts";
import { YamlDiagnostic } from "./YamlDiagnostic.ts";
import type { YamlPath, YamlSegment } from "./YamlEdit.ts";
import { YamlEdit, YamlRange } from "./YamlEdit.ts";
import type { YamlNode } from "./YamlNode.ts";
import { YamlMap, YamlPair, YamlScalar, YamlSeq } from "./YamlNode.ts";

/**
 * A range accepted at the `format`/`formatToString`/etc. call sites: either a
 * {@link YamlRange} instance or a plain `{ offset, length }` literal (the two
 * are structurally interchangeable — only `offset`/`length` are read).
 *
 * @public
 */
export type YamlRangeLike = YamlRange | { readonly offset: number; readonly length: number };

/**
 * Options controlling formatting behavior: every {@link YamlStringifyOptions}
 * field (derived, not hand-duplicated — including `indentSequences`,
 * `quoteStyle` and `quoteCompat`) plus
 * `preserveComments` (default `true`), `range` (restrict edits to a
 * region; see the module-level remarks on the `range` parameter vs. this
 * field) and `requoteScalars` (default `false`).
 *
 * `requoteScalars` makes `quoteStyle` apply to scalars **already quoted in
 * the source** on the format path — by default formatting preserves an
 * existing scalar's own quote style, and `quoteStyle` governs only quotes the
 * stringifier introduces. When enabled, a re-quote happens only when it
 * provably preserves the parsed value: single→double applies proper
 * double-quote escaping, double→single is skipped whenever the value carries
 * characters single quotes cannot express (newlines, tabs, control and other
 * non-printable characters — single-quoted style can escape nothing but
 * `'`). Plain scalars stay plain, block scalars stay block, and scalars
 * carrying a tag or anchor — or spanning multiple source lines — are left
 * untouched. The option exists only where a source quote exists to re-quote:
 * it is read by {@link YamlFormat.format} / {@link YamlFormat.formatToString}
 * and is deliberately absent from `Yaml.stringify` (which serializes plain
 * values) and {@link YamlFormat.modify} (which takes a bare
 * {@link YamlStringifyOptions}).
 *
 * Construct with the validated `YamlFormattingOptions.make({ ... })` static —
 * the kit convention (never `new`). Call sites that take a
 * `YamlFormattingOptions` also accept a structurally-matching plain literal.
 *
 * @example
 * ```ts
 * import { YamlFormat, YamlFormattingOptions } from "@effected/yaml";
 *
 * const options = YamlFormattingOptions.make({ indentSequences: true });
 * const formatted = YamlFormat.formatToString("key:\n- a\n- b\n", undefined, options);
 * // key:
 * //   - a
 * //   - b
 * ```
 *
 * @public
 */
export class YamlFormattingOptions extends Schema.Class<YamlFormattingOptions>("YamlFormattingOptions")({
	...YamlStringifyOptions.fields,
	preserveComments: Schema.optionalKey(Schema.Boolean),
	range: Schema.optionalKey(YamlRange),
	requoteScalars: Schema.optionalKey(Schema.Boolean),
}) {}

/**
 * Raised when `YamlFormat.modify` cannot navigate the requested path against
 * the composed AST (a structural mismatch), the source fails to parse, the
 * source is a multi-document stream (`MultiDocumentStream` — a path names no
 * particular document of a stream, so modify refuses rather than guessing),
 * or the document carries `%YAML`/`%TAG` directives
 * (`DirectiveCarryingDocument` — modify does not re-emit directive lines, and
 * dropping a `%TAG` would orphan the shorthand tags that depend on it).
 * Carries structured {@link YamlDiagnostic} entries — never a collapsed
 * `reason` string (the structure-preserving-errors house rule). The error
 * itself has no `code` field: read the code from the diagnostics —
 * `error.diagnostics[0].code` is the primary failure.
 *
 * @public
 */
export class YamlModificationError extends Schema.TaggedError<YamlModificationError>()("YamlModificationError", {
	path: Schema.Array(Schema.Union([Schema.String, Schema.Number])),
	diagnostics: Schema.Array(YamlDiagnostic),
}) {
	override get message(): string {
		const summary = this.diagnostics.map((d) => d.message).join("; ");
		return `Modification failed at path [${this.path.join(", ")}]: ${summary}`;
	}
}

// ── Internal: navigation failure ────────────────────────────────────────────

/**
 * Thrown by the pure AST-navigation helpers on a structural mismatch.
 * `modify` catches this and materializes {@link YamlModificationError}.
 */
class ModifyFailure extends Error {
	readonly code: "EmptyDocument" | "PathNotFound" | "InvalidIndex" | "NotNavigable";
	readonly offset: number;
	readonly length: number;
	constructor(code: ModifyFailure["code"], message: string, offset: number, length: number) {
		super(message);
		this.name = "ModifyFailure";
		this.code = code;
		this.offset = offset;
		this.length = length;
	}
}

// ── Internal: options bridging ──────────────────────────────────────────────

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

/** Normalize a `format`-positional range and the options-bag fallback into one plain shape (or `undefined`). */
function resolveRange(
	positional: YamlRangeLike | undefined,
	fromOptions: YamlRange | undefined,
): { readonly offset: number; readonly length: number } | undefined {
	const range = positional ?? fromOptions;
	return range === undefined ? undefined : { offset: range.offset, length: range.length };
}

/** Copy only the defined entries of `fields` — never emits an explicit `undefined` into a v4 `optionalKey` field. */
function definedFields<T extends Record<string, unknown>>(fields: T): Partial<T> {
	const out: Partial<T> = {};
	for (const key of Object.keys(fields) as Array<keyof T>) {
		if (fields[key] !== undefined) out[key] = fields[key];
	}
	return out;
}

// ── format: opt-in re-quoting (#347) ────────────────────────────────────────

/**
 * Walk a composed AST and flip the `style` of every scalar the shared
 * escaping-mode helper deems re-quotable to the target quote's style. The
 * stringifier then emits those scalars through the very renderers the helper
 * used to prove the replacement value-preserving, so flip-and-stringify and
 * the helper's replacement text cannot disagree. Everything the helper skips
 * — plain scalars, block scalars, tagged/anchored nodes, multi-line source
 * spans, impossible double→single escapes — keeps its node untouched, and
 * the surrounding diff keeps the edit surgical per scalar span.
 */
function requoteNode(node: YamlNode, text: string, quote: '"' | "'"): YamlNode {
	if (node instanceof YamlScalar) {
		if (requoteScalarText(text, node, quote, "escaping") === undefined) return node;
		return YamlScalar.make({
			value: node.value,
			style: quote === '"' ? "double-quoted" : "single-quoted",
			...definedFields({
				commentBefore: node.commentBefore,
				comment: node.comment,
				spaceBefore: node.spaceBefore,
				raw: node.raw,
				sourceMultiline: node.sourceMultiline,
			}),
			offset: node.offset,
			length: node.length,
		});
	}
	if (node instanceof YamlMap) {
		return rebuildMap(
			node,
			node.items.map((pair) =>
				YamlPair.make({
					key: requoteNode(pair.key, text, quote),
					value: pair.value === null ? null : requoteNode(pair.value, text, quote),
				}),
			),
		);
	}
	if (node instanceof YamlSeq) {
		return rebuildSeq(
			node,
			node.items.map((item) => requoteNode(item, text, quote)),
		);
	}
	return node;
}

/** Apply the opt-in re-quoting pass to a composed document's contents. */
function requoteDocument(
	doc: RawYamlDocument,
	text: string,
	options: YamlFormattingOptions | undefined,
): RawYamlDocument {
	if (options?.requoteScalars !== true || doc.contents === null) return doc;
	const quote = (options.quoteStyle ?? "single") === "double" ? '"' : "'";
	return { ...doc, contents: requoteNode(doc.contents, text, quote) };
}

// ── format ───────────────────────────────────────────────────────────────────

/** Rebuild a composed document for re-emission, stripping comments when asked. */
function toOutputDocument(doc: RawYamlDocument, preserveComments: boolean): RawYamlDocument {
	const contents = !preserveComments && doc.contents !== null ? stripNodeComments(doc.contents) : doc.contents;
	return {
		contents,
		errors: doc.errors,
		warnings: doc.warnings,
		directives: doc.directives,
		...(preserveComments ? definedFields({ commentBefore: doc.commentBefore, comment: doc.comment }) : {}),
		hasDocumentStart: doc.hasDocumentStart,
		hasDocumentEnd: doc.hasDocumentEnd,
		hasDocumentStartTab: doc.hasDocumentStartTab,
	};
}

/**
 * Format a document via the parse → stringify round-trip and diff the
 * output against the source, returning `undefined` when the input has a
 * fatal parse error (never corrupt malformed input) or carries
 * `%YAML`/`%TAG` directives — `stringifyDocument` does not re-emit
 * directive lines, and dropping a `%TAG` while keeping the shorthand tags
 * that depend on it would turn a valid document into an unparseable one.
 * A multi-document stream routes to {@link formatStream}, which formats
 * every document and shares the same directive refusal.
 */
function formatDocument(text: string, options: YamlFormattingOptions | undefined): string | undefined {
	// ONE composition serves both paths: the stream path receives the same
	// documents and stream errors rather than composing the text a second
	// time (behavior-neutral — each document keeps its single-document
	// fields, `hasDocumentStart`/`hasDocumentEnd`/`hasDocumentStartTab`).
	const { documents, streamErrors } = composeAllDocuments(text, {});
	if (documents.length > 1) return formatStream(text, documents, streamErrors, options);
	if (streamErrors.some((e) => isFatalCode(e.code))) return undefined;
	const doc = documents[0] ?? EMPTY_DOCUMENT;
	if (doc.errors.some((e) => isFatalCode(e.code))) return undefined;
	if (doc.directives.length > 0) return undefined;

	return stringifyDocument(
		toOutputDocument(requoteDocument(doc, text, options), options?.preserveComments ?? true),
		toStringifyInput(options),
	);
}

/**
 * Format a multi-document stream: every document is re-emitted in order with
 * its own framing (`---`, `...`, leading/trailing comment blocks — all of
 * which `stringifyDocument` renders per document), so no document is ever
 * dropped. Receives the documents and stream errors from the ONE
 * composition {@link formatDocument} already performed. Returns `undefined`
 * — no edits — when the stream cannot be re-emitted faithfully:
 *
 * - any document (or the stream itself) carries a fatal diagnostic, the same
 *   posture as the single-document path;
 * - any document carries `%YAML`/`%TAG` directives — `stringifyDocument`
 *   does not re-emit directive lines, and dropping a `%TAG` would change
 *   what the re-emitted document means.
 *
 * The single-document path ({@link formatDocument}) shares the directive
 * refusal: re-emitting a directive-carrying document without its directive
 * line while keeping the dependent shorthand tags produced unparseable
 * output (probe-verified downstream against an independent oracle).
 */
function formatStream(
	text: string,
	documents: ReadonlyArray<RawYamlDocument>,
	streamErrors: ReadonlyArray<RawDiagnostic>,
	options: YamlFormattingOptions | undefined,
): string | undefined {
	if (streamErrors.some((e) => isFatalCode(e.code))) return undefined;
	if (documents.some((d) => d.errors.some((e) => isFatalCode(e.code)))) return undefined;
	if (documents.some((d) => d.directives.length > 0)) return undefined;

	const preserveComments = options?.preserveComments ?? true;
	const base = toStringifyInput(options);
	const parts: Array<string> = [];
	for (let i = 0; i < documents.length; i++) {
		const doc = documents[i] as RawYamlDocument;
		// A document after the first is separated from its predecessor by its
		// own `---` or the predecessor's `...`; the composer guarantees one of
		// the two, so a stream violating it cannot be re-emitted — refuse.
		if (i > 0 && !doc.hasDocumentStart && !(documents[i - 1] as RawYamlDocument).hasDocumentEnd) return undefined;
		// Every document but the last must end in a newline for the next
		// document's framing to start on its own line; the caller's
		// `finalNewline` applies only to the last document.
		const docOptions = i < documents.length - 1 ? { ...base, finalNewline: true } : base;
		parts.push(stringifyDocument(toOutputDocument(requoteDocument(doc, text, options), preserveComments), docOptions));
	}
	return parts.join("");
}

// ── modify: pure AST navigation ─────────────────────────────────────────────

/** Convert a plain JS scalar value into a synthetic `YamlScalar` (offset/length are irrelevant — immediately re-stringified). */
function jsValueToNode(value: unknown): YamlNode {
	return YamlScalar.make({ value, style: "plain", offset: 0, length: 0 });
}

function modifyDocument(doc: RawYamlDocument, path: YamlPath, value: unknown): YamlNode | null {
	if (path.length === 0) {
		return value === undefined ? null : jsValueToNode(value);
	}
	if (doc.contents === null) {
		throw new ModifyFailure("EmptyDocument", "Cannot navigate path in empty document", 0, 0);
	}
	return modifyNode(doc.contents, path, 0, value);
}

function modifyNode(node: YamlNode, path: YamlPath, depth: number, value: unknown): YamlNode {
	const segment = path[depth] as YamlSegment;
	const isLast = depth === path.length - 1;

	if (node instanceof YamlMap) {
		const pairIndex = node.items.findIndex((pair) => pair.key instanceof YamlScalar && pair.key.value === segment);

		if (isLast) {
			if (value === undefined) {
				if (pairIndex < 0) return node; // Nothing to remove
				const newItems = [...node.items];
				newItems.splice(pairIndex, 1);
				return rebuildMap(node, newItems);
			}

			const newValueNode = jsValueToNode(value);
			if (pairIndex >= 0) {
				const newItems = [...node.items];
				const oldPair = newItems[pairIndex] as YamlPair;
				// Comments live on the key and value nodes, so the key carries its
				// own through unchanged; the replacement value is a fresh node and
				// deliberately starts with no comments of its own.
				newItems[pairIndex] = YamlPair.make({ key: oldPair.key, value: newValueNode });
				return rebuildMap(node, newItems);
			}

			// Insert new key — appends after the last pair.
			const keyNode = YamlScalar.make({ value: String(segment), style: "plain", offset: 0, length: 0 });
			const newPair = YamlPair.make({ key: keyNode, value: newValueNode });
			return rebuildMap(node, [...node.items, newPair]);
		}

		// Navigate deeper.
		if (pairIndex < 0) {
			throw new ModifyFailure(
				"PathNotFound",
				`Key "${String(segment)}" not found in mapping`,
				node.offset,
				node.length,
			);
		}
		const pair = node.items[pairIndex] as YamlPair;
		if (pair.value === null) {
			throw new ModifyFailure("PathNotFound", `Value at key "${String(segment)}" is null`, node.offset, node.length);
		}
		const newValue = modifyNode(pair.value, path, depth + 1, value);
		const newItems = [...node.items];
		newItems[pairIndex] = YamlPair.make({ key: pair.key, value: newValue });
		return rebuildMap(node, newItems);
	}

	if (node instanceof YamlSeq) {
		const idx = typeof segment === "number" ? segment : Number(segment);
		if (Number.isNaN(idx) || idx < 0) {
			throw new ModifyFailure("InvalidIndex", `Invalid sequence index: ${String(segment)}`, node.offset, node.length);
		}

		if (isLast) {
			const newItems = [...node.items];
			if (value === undefined) {
				if (idx < newItems.length) newItems.splice(idx, 1);
			} else if (idx < newItems.length) {
				newItems[idx] = jsValueToNode(value);
			} else {
				newItems.push(jsValueToNode(value)); // Appends after the last element.
			}
			return rebuildSeq(node, newItems);
		}

		if (idx >= node.items.length) {
			throw new ModifyFailure("InvalidIndex", `Index ${idx} out of bounds`, node.offset, node.length);
		}
		const child = node.items[idx] as YamlNode;
		const newChild = modifyNode(child, path, depth + 1, value);
		const newItems = [...node.items];
		newItems[idx] = newChild;
		return rebuildSeq(node, newItems);
	}

	throw new ModifyFailure(
		"NotNavigable",
		`Cannot navigate through ${node._tag} at segment "${String(segment)}"`,
		node.offset,
		node.length,
	);
}

function rebuildMap(node: YamlMap, items: ReadonlyArray<YamlPair>): YamlMap {
	return YamlMap.make({
		items,
		style: node.style,
		...definedFields({
			tag: node.tag,
			anchor: node.anchor,
			commentBefore: node.commentBefore,
			comment: node.comment,
			spaceBefore: node.spaceBefore,
			sourceMultiline: node.sourceMultiline,
		}),
		offset: node.offset,
		length: node.length,
	});
}

function rebuildSeq(node: YamlSeq, items: ReadonlyArray<YamlNode>): YamlSeq {
	return YamlSeq.make({
		items,
		style: node.style,
		...definedFields({
			tag: node.tag,
			anchor: node.anchor,
			commentBefore: node.commentBefore,
			comment: node.comment,
			spaceBefore: node.spaceBefore,
			sourceMultiline: node.sourceMultiline,
		}),
		offset: node.offset,
		length: node.length,
	});
}

// ── Facade ──────────────────────────────────────────────────────────────────

/**
 * Formatting and modification statics. Not instantiable.
 *
 * @remarks
 * `format`/`formatToString` are pure and total (edit computation never fails
 * — malformed input yields no edits rather than corrupting the document).
 * `modify`/`modifyToString` carry a real error channel: navigation failures
 * against the composed AST raise {@link YamlModificationError}, which — per
 * the structure-preserving-errors house rule — carries
 * `diagnostics: ReadonlyArray<YamlDiagnostic>`, never a collapsed `reason`
 * string.
 *
 * `format`/`formatToString` handle multi-document streams whole — every
 * document is re-emitted in order with its own framing, never a silently
 * truncated stream. `modify`/`modifyToString` are **single-document**: a
 * {@link YamlPath} carries no document index, so which document of a stream
 * a path names is a rule the format does not define, and a multi-document
 * stream fails typed with a `MultiDocumentStream` diagnostic rather than
 * guessing. Parse a stream with {@link Yaml.parseAll} /
 * `Yaml.parseAllResult`.
 *
 * **Directive-carrying input is refused on every path.** The stringifier does
 * not re-emit `%YAML`/`%TAG` directive lines, and re-emitting a document
 * without its `%TAG` while keeping the shorthand tags that depend on it
 * (`!e!foo`) turns a valid file into one no parser can read. So
 * `format`/`formatToString` leave such input byte-identical (no edits), and
 * `modify`/`modifyToString` fail typed with a `DirectiveCarryingDocument`
 * diagnostic. Directive re-emission is unimplemented, not undesired — the
 * refusal is the floor that stops corruption until it lands.
 *
 * @public
 */
export class YamlFormat {
	private constructor() {}

	/**
	 * Compute formatting edits for a YAML document. Non-mutating — apply the
	 * result with `YamlEdit.applyAll` (or use {@link YamlFormat.formatToString}).
	 * Pure and total: malformed input (a fatal parse error) yields `[]` rather
	 * than corrupting the document.
	 *
	 * **Multi-document streams format whole.** Input containing more than one
	 * document (a `---`-separated stream — a Kubernetes manifest, a pnpm 11
	 * `pnpm-lock.yaml` with a config-dependency preamble) formats every
	 * document in order, re-emitting each document's own framing (`---`,
	 * `...`, comment blocks); no document is ever dropped. Document detection
	 * is CST-level, so a `---` inside a block scalar or quoted string is
	 * content, not a document boundary. Two multi-document shapes yield `[]`
	 * (untouched) because they cannot be re-emitted faithfully: a stream with
	 * a fatal diagnostic in any document (the same posture as single-document
	 * input) and a stream carrying `%YAML`/`%TAG` directives.
	 *
	 * **Directive-carrying documents yield `[]` on the single-document path
	 * too.** Directive lines are not re-emitted, and dropping a `%TAG` while
	 * keeping the shorthand tags that depend on it would turn a valid document
	 * into an unparseable one — so a document carrying `%YAML`/`%TAG`
	 * directives is left untouched. Detection is directive-token-level: a
	 * literal `%TAG` inside a scalar is content and formats normally.
	 *
	 * @remarks
	 * The positional `range` argument takes precedence over
	 * `options?.range` when both are given; either accepts a plain
	 * `{ offset, length }` object as well as a {@link YamlRange} instance, so
	 * callers do not need `YamlRange.make(...)` for the common case.
	 *
	 * Formatting preserves an existing scalar's own quote style by default —
	 * `quoteStyle` governs only quotes the stringifier introduces. The opt-in
	 * `options.requoteScalars` makes `quoteStyle` apply to already-quoted
	 * source scalars too, re-quoting only where the parsed value is provably
	 * preserved; see {@link YamlFormattingOptions} for the exact skip rules.
	 *
	 * A plain `<<` mapping key is preserved unquoted, keeping its merge-key
	 * meaning (`tag:yaml.org,2002:merge`) — quoting it to `'<<'` would produce
	 * an ordinary string key that merges nothing, changing what the document
	 * means with no error raised. A key the author quoted explicitly keeps its
	 * quotes, since that is a literal string key they wrote deliberately. Note
	 * that {@link Yaml.stringify} is deliberately the other way round for a
	 * `"<<"` key on a plain JavaScript object.
	 */
	static format(text: string, range?: YamlRangeLike, options?: YamlFormattingOptions): ReadonlyArray<YamlEdit> {
		const formatted = formatDocument(text, options);
		if (formatted === undefined) return [];

		let edits = computeEdits(text, formatted);

		const effectiveRange = resolveRange(range, options?.range);
		if (effectiveRange !== undefined) {
			const rangeStart = effectiveRange.offset;
			const rangeEnd = effectiveRange.offset + effectiveRange.length;
			edits = edits.filter((e) => e.offset >= rangeStart && e.offset + e.length <= rangeEnd);
		}

		return edits.map((e) => YamlEdit.make(e));
	}

	/**
	 * Format `text` and apply the resulting edits in one step
	 * (`YamlEdit.applyAll ∘ format`). Pure and total.
	 *
	 * Inherits the {@link YamlFormat.format} contract: a multi-document stream
	 * is formatted whole — every document re-emitted in order — and input
	 * that cannot be formatted faithfully (a fatal parse error, or any
	 * document — single or in a stream — carrying `%YAML`/`%TAG` directives)
	 * is returned byte-identical — never a truncated first document, never a
	 * document re-emitted without the directive its tags depend on.
	 */
	static formatToString(text: string, range?: YamlRangeLike, options?: YamlFormattingOptions): string {
		return YamlEdit.applyAll(text, YamlFormat.format(text, range, options));
	}

	/**
	 * Compute the edits that insert, replace, or remove a value at `path`.
	 * Passing `value === undefined` removes the target key/element; a missing
	 * insertion target appends after the last pair/element. Only
	 * scalar-compatible values are supported (matching v3 — arbitrary object
	 * graphs are not recursively lowered into AST nodes). Fails with
	 * {@link YamlModificationError} on a fatal parse error or a structural
	 * navigation mismatch.
	 *
	 * **Single-document contract.** A `path` carries no document index, so on
	 * a multi-document stream there is no rule for which document it names —
	 * `modify` fails with {@link YamlModificationError} carrying a
	 * `MultiDocumentStream` diagnostic rather than guessing document 1 (and
	 * unlike {@link YamlFormat.format}, which formats a stream whole because
	 * formatting needs no target). Detection is CST-level: a `---` inside a
	 * block scalar or quoted string is content, not a document boundary.
	 *
	 * **Directive-carrying documents are refused.** A document carrying
	 * `%YAML`/`%TAG` directives fails with {@link YamlModificationError}
	 * carrying a `DirectiveCarryingDocument` diagnostic: modify re-emits the
	 * whole document and does not re-emit directive lines, so applying it
	 * would drop the `%TAG` while keeping the shorthand tags that depend on
	 * it — unparseable output. A typed refusal beats silent corruption;
	 * directive re-emission is unimplemented, not undesired. A literal
	 * `%TAG` inside a scalar is content and does not trigger the refusal.
	 *
	 * @remarks
	 * `options` is a bare {@link YamlStringifyOptions} — it controls only the
	 * internal re-stringify step, not a range (there is no range to restrict
	 * for a path-targeted modification).
	 */
	static readonly modify = Effect.fn("YamlFormat.modify")(function* (
		text: string,
		path: YamlPath,
		value: unknown,
		options?: YamlStringifyOptions,
	) {
		const { document: doc, documentCount } = composeFirstDocumentCounted(text, {});
		if (documentCount > 1) {
			return yield* new YamlModificationError({
				path,
				diagnostics: [
					YamlDiagnostic.fromRaw(
						{
							code: "MultiDocumentStream",
							message: `Cannot modify a multi-document stream (${documentCount} documents): modify re-emits exactly one document`,
							offset: 0,
							length: 0,
						},
						text,
					),
				],
			});
		}
		const fatal = doc.errors.filter((e) => isFatalCode(e.code));
		if (fatal.length > 0) {
			return yield* new YamlModificationError({
				path,
				diagnostics: fatal.map((e) => YamlDiagnostic.fromRaw(e, text)),
			});
		}
		if (doc.directives.length > 0) {
			return yield* new YamlModificationError({
				path,
				diagnostics: [
					YamlDiagnostic.fromRaw(
						{
							code: "DirectiveCarryingDocument",
							message:
								"Cannot modify a document carrying %YAML/%TAG directives: modify does not re-emit directive lines, and dropping a %TAG orphans the shorthand tags that depend on it",
							offset: 0,
							length: 0,
						},
						text,
					),
				],
			});
		}

		let newContents: YamlNode | null;
		try {
			newContents = modifyDocument(doc, path, value);
		} catch (err) {
			if (!(err instanceof ModifyFailure)) throw err;
			return yield* new YamlModificationError({
				path,
				diagnostics: [
					YamlDiagnostic.fromRaw(
						{ code: err.code, message: err.message, offset: err.offset, length: err.length },
						text,
					),
				],
			});
		}

		const outputDoc: RawYamlDocument = { ...doc, contents: newContents };
		const formatted = stringifyDocument(outputDoc, toStringifyInput(options));
		return computeEdits(text, formatted).map((e) => YamlEdit.make(e)) as ReadonlyArray<YamlEdit>;
	});

	/**
	 * Modify `text` and apply the resulting edits in one step
	 * (`YamlEdit.applyAll ∘ modify`). Inherits the {@link YamlFormat.modify}
	 * error channel, including the single-document contract's
	 * `MultiDocumentStream` refusal and the `DirectiveCarryingDocument`
	 * refusal of `%YAML`/`%TAG`-carrying documents.
	 */
	static readonly modifyToString = Effect.fn("YamlFormat.modifyToString")(function* (
		text: string,
		path: YamlPath,
		value: unknown,
		options?: YamlStringifyOptions,
	) {
		const edits = yield* YamlFormat.modify(text, path, value, options);
		return YamlEdit.applyAll(text, edits);
	});
}
