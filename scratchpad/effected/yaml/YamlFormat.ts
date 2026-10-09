// The formatting/modification concept: computing non-mutating edits that
// reformat a document or change a value at a path, via the library's
// parse → transform AST → stringify → diff pipeline.
//
// Cycle firewall: this module drives the internal engine directly
// (`composeFirstDocumentCounted`, `stringifyDocument`) exactly as `Yaml.ts`
// does; nothing imports `YamlFormat.ts` back.
//
// Neither `format` nor `modify` catch the internal stringifier's
// `StringifyFailure` (the circular-reference guard) or `StringifyDepthExceeded`:
// `format` builds its output AST from already-parsed nodes, and `modify`'s
// `jsValueToNode` runs BOTH guards itself while lowering the caller's value —
// failing typed with a `CircularReference` / `NestingDepthExceeded` diagnostic
// before a node ever reaches the stringifier. So neither internal throw can
// occur here; were one ever thrown it would indicate an internal invariant
// violation, not a user-facing error, and is left to surface as an uncaught
// defect.

import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { EMPTY_DOCUMENT, composeAllDocuments, composeFirstDocumentCounted } from "./internal/composer/document.ts";
import { MAX_NESTING_DEPTH } from "./internal/composer/state.ts";
import type { RawDiagnostic } from "./internal/diagnostics.ts";
import { isFatalCode } from "./internal/diagnostics.ts";
import { computeEdits } from "./internal/diff.ts";
import type { RawYamlDocument } from "./internal/raw-document.ts";
import { requoteScalarText } from "./internal/requote.ts";
import {
	renderDoubleQuoted,
	renderSingleQuoted,
	stringifyDocument,
	stringifyValue,
	stripNodeComments,
} from "./internal/stringifier.ts";
import { YamlStringifyOptions } from "./Yaml.ts";
import { YamlDiagnostic } from "./YamlDiagnostic.ts";
import type { YamlPath } from "./YamlEdit.ts";
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
 * region; the positional `range` argument of {@link YamlFormat.format} takes
 * precedence over this field) and `requoteScalars` (default `false`).
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
 * import { YamlFormat, YamlFormattingOptions } from "./index.ts";
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
export class YamlFormattingOptions extends S.Class<YamlFormattingOptions>("YamlFormattingOptions")({
	...YamlStringifyOptions.fields,
	preserveComments: S.optionalKey(S.Boolean),
	range: S.optionalKey(YamlRange),
	requoteScalars: S.optionalKey(S.Boolean),
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
export class YamlModificationError extends S.TaggedError<YamlModificationError>()("YamlModificationError", {
	path: S.Array(S.Union([S.String, S.Finite])),
	diagnostics: S.Array(YamlDiagnostic),
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
class ModifyFailure extends Data.TaggedError("ModifyFailure")<{
	readonly code:
		| "EmptyDocument"
		| "PathNotFound"
		| "InvalidIndex"
		| "NotNavigable"
		| "CircularReference"
		| "NestingDepthExceeded";
	readonly message: string;
	readonly offset: number;
	readonly length: number;
}> {
	constructor(code: ModifyFailure["code"], message: string, offset: number, length: number) {
		super({ code, message, offset, length });
		this.name = "ModifyFailure";
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
	for (const key in fields) {
		if (!Object.hasOwn(fields, key)) continue;
		if (fields[key] !== undefined) out[key] = fields[key];
	}
	return out;
}

// ── format: opt-in re-quoting ────────────────────────────────────────

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
	if (S.is(YamlScalar)(node)) {
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
	if (S.is(YamlMap)(node)) {
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
	if (S.is(YamlSeq)(node)) {
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
/**
 * Re-attach the source's leading byte-order mark to a whole-document
 * re-emission. The stringifier never emits a BOM (it is framing, not
 * content), so without this every `format` and whole-pipeline `modify` on a
 * BOM-prefixed file would produce a delete-at-offset-0 edit. Preserving it
 * keeps the file's encoding signature the author's business, in line with
 * the fidelity contract that leaves untouched bytes alone.
 */
function withSourceBom(text: string, formatted: string): string {
	return text.startsWith("\uFEFF") ? `\uFEFF${formatted}` : formatted;
}

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
	for (const [i, doc] of documents.entries()) {
		// A document after the first is separated from its predecessor by its
		// own `---` or the predecessor's `...`; the composer guarantees one of
		// the two, so a stream violating it cannot be re-emitted — refuse.
		if (i > 0 && !doc.hasDocumentStart && documents[i - 1]?.hasDocumentEnd !== true) return undefined;
		// Every document but the last must end in a newline for the next
		// document's framing to start on its own line; the caller's
		// `finalNewline` applies only to the last document.
		const docOptions = i < documents.length - 1 ? { ...base, finalNewline: true } : base;
		parts.push(stringifyDocument(toOutputDocument(requoteDocument(doc, text, options), preserveComments), docOptions));
	}
	return parts.join("");
}

// ── modify: pure AST navigation ─────────────────────────────────────────────

/**
 * Lower a plain JavaScript value into synthetic AST nodes (offset/length are
 * irrelevant — the result is immediately re-stringified).
 *
 * Recursive by design: an array becomes a block {@link YamlSeq} and any other
 * non-null object a block {@link YamlMap} over its own enumerable string keys,
 * matching what `Yaml.stringify` does with the same value on the value path.
 * Before this was recursive, a mapping or sequence value fell through to the
 * node stringifier's `String(value)` fallback and landed in the document as
 * the literal text `[object Object]` — a silent corruption that only surfaced
 * on the next read.
 *
 * The two conditions with no finite rendering fail typed rather than hanging
 * or overflowing the stack: a cycle raises `CircularReference` and a graph
 * deeper than `MAX_NESTING_DEPTH` raises `NestingDepthExceeded`. `seen` holds
 * the ancestors of the value being lowered, so a value repeated across
 * siblings (a shared, acyclic sub-object) is lowered twice rather than
 * rejected.
 */
function jsValueToNode(value: unknown, seen: Set<object>, depth: number): YamlNode {
	if (depth > MAX_NESTING_DEPTH) {
		throw new ModifyFailure(
			"NestingDepthExceeded",
			`Replacement value nests deeper than the maximum of ${MAX_NESTING_DEPTH}`,
			0,
			0,
		);
	}
	if (Array.isArray(value) || P.isObject(value)) {
		if (seen.has(value)) {
			throw new ModifyFailure("CircularReference", "Replacement value contains a circular reference", 0, 0);
		}
		seen.add(value);
		try {
			if (Array.isArray(value)) {
				return YamlSeq.make({
					items: value.map((item) => jsValueToNode(item, seen, depth + 1)),
					style: "block",
					offset: 0,
					length: 0,
				});
			}
			return YamlMap.make({
				items: Object.keys(value).map((key) =>
					YamlPair.make({
						key: YamlScalar.make({ value: key, style: "plain", offset: 0, length: 0 }),
						value: jsValueToNode(value[key], seen, depth + 1),
					}),
				),
				style: "block",
				offset: 0,
				length: 0,
			});
		} finally {
			seen.delete(value);
		}
	}
	return YamlScalar.make({ value, style: "plain", offset: 0, length: 0 });
}

/** Entry point for {@link jsValueToNode}: one `seen` set per lowering. */
function lowerValue(value: unknown): YamlNode {
	return jsValueToNode(value, new Set<object>(), 0);
}

function modifyDocument(doc: RawYamlDocument, path: YamlPath, value: unknown): YamlNode | null {
	if (path.length === 0) {
		return value === undefined ? null : lowerValue(value);
	}
	if (doc.contents === null) {
		throw new ModifyFailure("EmptyDocument", "Cannot navigate path in empty document", 0, 0);
	}
	return modifyNode(doc.contents, path, 0, value);
}

function modifyNode(node: YamlNode, path: YamlPath, depth: number, value: unknown): YamlNode {
	const segment = path[depth];
	const isLast = depth === path.length - 1;

	if (S.is(YamlMap)(node)) {
		const pairIndex = node.items.findIndex((pair) => S.is(YamlScalar)(pair.key) && pair.key.value === segment);

		if (isLast) {
			if (value === undefined) {
				if (pairIndex < 0) return node; // Nothing to remove
				const newItems = [...node.items];
				newItems.splice(pairIndex, 1);
				return rebuildMap(node, newItems);
			}

			const newValueNode = lowerValue(value);
			if (pairIndex >= 0) {
				const newItems = [...node.items];
				const oldPair = newItems[pairIndex];
				if (oldPair === undefined) throw new TypeError("Cannot read properties of undefined (reading 'key')");
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
		const pair = node.items[pairIndex];
		if (pair === undefined) throw new TypeError("Cannot read properties of undefined (reading 'value')");
		if (pair.value === null) {
			throw new ModifyFailure("PathNotFound", `Value at key "${String(segment)}" is null`, node.offset, node.length);
		}
		const newValue = modifyNode(pair.value, path, depth + 1, value);
		const newItems = [...node.items];
		newItems[pairIndex] = YamlPair.make({ key: pair.key, value: newValue });
		return rebuildMap(node, newItems);
	}

	if (S.is(YamlSeq)(node)) {
		const idx = typeof segment === "number" ? segment : Number(segment);
		if (Number.isNaN(idx) || idx < 0) {
			throw new ModifyFailure("InvalidIndex", `Invalid sequence index: ${String(segment)}`, node.offset, node.length);
		}

		if (isLast) {
			const newItems = [...node.items];
			if (value === undefined) {
				if (idx < newItems.length) newItems.splice(idx, 1);
			} else if (idx < newItems.length) {
				newItems[idx] = lowerValue(value);
			} else {
				newItems.push(lowerValue(value)); // Appends after the last element.
			}
			return rebuildSeq(node, newItems);
		}

		if (idx >= node.items.length) {
			throw new ModifyFailure("InvalidIndex", `Index ${idx} out of bounds`, node.offset, node.length);
		}
		const child = node.items[idx];
		if (child === undefined) throw new TypeError("Cannot read properties of undefined (reading '_tag')");
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

// ── modify: region-confined scalar replacement ───────────────────────

/**
 * Whether a value carries characters single-quoted style cannot express (it
 * escapes only `'`): C0 controls — newline, carriage return, tab among them —
 * plus DEL and the C1 range, the same conservative set the requote helper
 * uses. A value carrying any of these keeps the whole-document pipeline
 * rather than switching quote style. Char-code based, mirroring the
 * stringifier's own control-character checks.
 */
function isSingleQuoteUnsafe(s: string): boolean {
	for (let i = 0; i < s.length; i++) {
		const code = s.charCodeAt(i);
		if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
	}
	return false;
}

/**
 * Read-only navigation twin of `modifyNode`: returns the EXISTING node at
 * `path` together with whether its parent collection is flow-styled, or
 * `undefined` whenever the path does not resolve to a node (missing
 * key/index, non-navigable node, empty path, null value mid-path).
 * `undefined` sends `modify` down its normal pipeline, which owns the
 * insert/append/remove semantics and the typed navigation errors — this
 * helper never throws and never guesses.
 */
function findExistingTarget(
	contents: YamlNode | null,
	path: YamlPath,
): { readonly node: YamlNode | null; readonly inFlow: boolean } | undefined {
	if (contents === null || path.length === 0) return undefined;
	let current: YamlNode = contents;
	for (let depth = 0; depth < path.length; depth++) {
		const segment = path[depth];
		const isLast = depth === path.length - 1;
		if (S.is(YamlMap)(current)) {
			const pair = current.items.find((p) => S.is(YamlScalar)(p.key) && p.key.value === segment);
			if (pair === undefined) return undefined;
			if (isLast) return { node: pair.value, inFlow: current.style === "flow" };
			if (pair.value === null) return undefined;
			current = pair.value;
		} else if (S.is(YamlSeq)(current)) {
			const idx = typeof segment === "number" ? segment : Number(segment);
			if (Number.isNaN(idx) || idx < 0 || idx >= current.items.length) return undefined;
			const child = current.items[idx];
			if (child === undefined) return undefined;
			if (isLast) return { node: child, inFlow: current.style === "flow" };
			current = child;
		} else {
			return undefined;
		}
	}
	return undefined;
}

/**
 * Render the replacement text for a region-confined splice, or `undefined`
 * to fall back. A string keeps the target's quote style when that style can
 * express it (single-quoted escapes only `'`, so newlines/tabs/controls bail
 * out; double-quoted expresses everything); a non-string into a quoted
 * target renders through `stringifyValue` — quoting it would change the
 * resolved type — as does any plain target, so the stringifier's own
 * plain-safety rules decide whether the text needs quotes — under the
 * target's own context, so a flow indicator inside a value spliced into a
 * flow collection is quoted rather than corrupting the collection. A
 * rendering that spans lines (folding, block styles) bails out: the fast
 * path never introduces a line break inside the spliced region.
 */
function renderRegionalScalarText(
	target: YamlScalar,
	value: string | number | boolean,
	inFlow: boolean,
	options?: YamlStringifyOptions,
): string | undefined {
	let rendered: string;
	if (typeof value === "string" && target.style === "single-quoted") {
		if (isSingleQuoteUnsafe(value)) return undefined;
		rendered = renderSingleQuoted(value);
	} else if (typeof value === "string" && target.style === "double-quoted") {
		rendered = renderDoubleQuoted(value);
	} else {
		// finalNewline: false — the splice renders a scalar, never a document.
		rendered = stringifyValue(value, { ...toStringifyInput(options), finalNewline: false, inFlow });
	}
	if (/[\n\r]/.test(rendered)) return undefined;
	return rendered;
}

/**
 * Prove the rendered text means exactly what the caller asked: re-compose a
 * one-pair probe document and compare the resolved scalar with `Object.is`.
 * The probe mirrors the target's context — `k: [rendered]` for a flow
 * parent, so a rendering that would split or close the collection is caught
 * as a structural surprise rather than a quiet corruption. Any parse error,
 * structural surprise, or value drift (a plain rendering that re-resolves
 * as a bool/timestamp instead of the caller's string, say) bails out to the
 * whole-document pipeline.
 */
function regionalRenderPreservesValue(rendered: string, value: string | number | boolean, inFlow: boolean): boolean {
	const probeText = inFlow ? `k: [${rendered}]\n` : `k: ${rendered}\n`;
	const { document: probeDoc } = composeFirstDocumentCounted(probeText, {});
	if (probeDoc.errors.some((e) => isFatalCode(e.code))) return false;
	const contents = probeDoc.contents;
	if (!(S.is(YamlMap)(contents))) return false;
	const pair = contents.items.find((p) => S.is(YamlScalar)(p.key) && p.key.value === "k");
	let node = pair?.value;
	if (inFlow) {
		if (!(S.is(YamlSeq)(node)) || node.items.length !== 1) return false;
		node = node.items[0];
	}
	if (!(S.is(YamlScalar)(node))) return false;
	return Object.is(node.value, value);
}

/**
 * Attempt the region-confined scalar splice for `modify`: replace
 * only the target scalar's byte range, re-emitting its original quote
 * character and leaving line endings (and every other byte) elsewhere
 * untouched. Returns the single edit, an empty array for a no-op
 * replacement, or `undefined` when any precondition fails — the caller then
 * runs the existing compose → replace → re-stringify → diff pipeline
 * unchanged.
 */
function tryRegionalScalarEdit(
	text: string,
	doc: RawYamlDocument,
	path: YamlPath,
	value: unknown,
	options?: YamlStringifyOptions,
): ReadonlyArray<{ offset: number; length: number; content: string }> | undefined {
	// `undefined` (removal), null, and object graphs keep the full pipeline:
	// null renders as an empty scalar there (`a:` — the stringifier's own
	// convention), and splicing an empty replacement would leave a trailing
	// space instead.
	if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
		return undefined;
	}
	// Document-shaping options (sortKeys, indent, indentSequences, finalNewline)
	// and explicit style requests all steer the whole-document pipeline.
	// Silently dropping them on the fast path would change the output without
	// error, so bail out to the existing compose → replace → re-stringify path.
	if (
		options?.defaultScalarStyle !== undefined ||
		(options?.forceDefaultStyles === true) ||
		options?.sortKeys === true ||
		options?.indent !== undefined ||
		options?.indentSequences !== undefined ||
		options?.finalNewline !== undefined
	)
		return undefined;
	const found = findExistingTarget(doc.contents, path);
	if (found === undefined) return undefined;
	const { node: target, inFlow } = found;
	if (!(S.is(YamlScalar)(target))) return undefined;
	// A synthesised empty span (`key:` with no value) is an insertion site,
	// not a replaceable range.
	if (target.length <= 0) return undefined;
	if (target.tag !== undefined || target.anchor !== undefined) return undefined;
	if (target.style !== "plain" && target.style !== "single-quoted" && target.style !== "double-quoted") {
		return undefined;
	}
	if (target.sourceMultiline === true) return undefined;
	const span = text.slice(target.offset, target.offset + target.length);
	if (/[\n\r]/.test(span)) return undefined;
	const rendered = renderRegionalScalarText(target, value, inFlow, options);
	if (rendered === undefined) return undefined;
	if (rendered === span) return []; // no-op replace: the span already says exactly this
	if (!regionalRenderPreservesValue(rendered, value, inFlow)) return undefined;
	return [{ offset: target.offset, length: target.length, content: rendered }];
}

// ── Facade ──────────────────────────────────────────────────────────────────

/**
 * Formats YAML text and modifies values at a path as byte-minimal edits that
 * preserve comments and layout elsewhere. Not instantiable.
 *
 * @example
 * ```ts
 * import { YamlFormat } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const formatted = YamlFormat.formatToString("a:   1\nb:\n    - x\n    - y # c\n");
 * // => "a: 1\nb:\n- x\n- y # c\n"
 *
 * const program = Effect.gen(function* () {
 *   return yield* YamlFormat.modifyToString("port: 3000 # dev\n", ["port"], 8080);
 *   // => "port: 8080 # dev\n"
 * });
 * ```
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
 * diagnostic. Directive re-emission is unimplemented, and the refusal is what
 * stops the corruption.
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
	 * @param text - The YAML source to format.
	 * @param range - Optional sub-range; only edits fully within it are returned.
	 * @param options - Optional {@link YamlFormattingOptions}.
	 * @returns The edits that bring `text` to canonical shape; apply them with
	 *   `YamlEdit.applyAll`. Empty when the input cannot be formatted faithfully.
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

		let edits = computeEdits(text, withSourceBom(text, formatted));

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
	 *
	 * @param text - The YAML source to format.
	 * @param range - Optional sub-range; only edits fully within it are applied.
	 * @param options - Optional {@link YamlFormattingOptions}.
	 * @returns The formatted text, or `text` unchanged when it cannot be
	 *   formatted faithfully.
	 */
	static formatToString(text: string, range?: YamlRangeLike, options?: YamlFormattingOptions): string {
		return YamlEdit.applyAll(text, YamlFormat.format(text, range, options));
	}

	/**
	 * Compute the edits that insert, replace, or remove a value at `path`.
	 * Passing `value === undefined` removes the target key/element; a missing
	 * insertion target appends after the last pair/element. Fails with
	 * {@link YamlModificationError} on a fatal parse error or a structural
	 * navigation mismatch.
	 *
	 * **`value` may be a whole object graph.** An array is written as a block
	 * sequence and any other non-null object as a block mapping over its own
	 * enumerable string keys, recursively — the same lowering
	 * {@link Yaml.stringify} applies to the same value, so `modify` and
	 * `stringify` agree on what a given JavaScript value means. For a synthesized
	 * subtree (an object/array value) only the surrounding document is
	 * preserved byte-for-byte; the subtree carries no comments and takes the
	 * stringifier's styles.
	 *
	 * **Scalar replacement is region-confined and quote-preserving.**
	 * When the path resolves to an existing single-line `plain`,
	 * `single-quoted`, or `double-quoted` scalar with no tag or anchor, and
	 * the replacement is a string, number, or boolean, `modify` splices
	 * ONLY the target scalar's source span and emits a single edit: a string
	 * into a quoted scalar keeps the original quote character, a non-string
	 * renders plain (quoting it would change the resolved type), and every
	 * byte outside the span — line endings included, so a CRLF document keeps
	 * its CRLFs and a same-line trailing comment survives — is untouched. The
	 * splice is taken only when the rendered text re-parses to exactly the
	 * caller's value and renders as a single line; a no-op replacement yields
	 * no edits. Anything else — removals (`value === undefined`), nulls,
	 * insertions, object/array values, block or multi-line scalars, tagged or anchored
	 * targets, or any document-shaping / explicit-style option
	 * (`defaultScalarStyle`, `forceDefaultStyles`, `sortKeys`, `indent`,
	 * `indentSequences`, `finalNewline`) — falls back to re-serialising the
	 * whole document, which normalises line endings to LF, applies those
	 * options, and renders the replacement in the stringifier's styles.
	 *
	 * Two replacement values have no finite rendering and fail typed rather
	 * than hanging or overflowing the stack: one containing a circular
	 * reference (`CircularReference`) and one nesting deeper than 256 levels
	 * (`NestingDepthExceeded`).
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
	 * @param text - The YAML source to modify.
	 * @param path - The location to insert, replace or remove.
	 * @param value - The JavaScript value to write; `undefined` removes the
	 *   target instead.
	 * @param options - Optional {@link YamlStringifyOptions} for the
	 *   re-stringify step.
	 * @returns An `Effect` that succeeds with the edits to apply (via
	 *   `YamlEdit.applyAll`), or fails with {@link YamlModificationError}.
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
			return yield* YamlModificationError.make({
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
			return yield* YamlModificationError.make({
				path,
				diagnostics: fatal.map((e) => YamlDiagnostic.fromRaw(e, text)),
			});
		}
		if (doc.directives.length > 0) {
			return yield* YamlModificationError.make({
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

		// Region-confined scalar replacement: when the target is an
		// existing single-line untagged scalar and the value is scalar-shaped,
		// splice just its span — quote style preserved, CRLFs and every other
		// byte outside the span untouched. Any precondition miss falls through
		// to the whole-document pipeline below, unchanged.
		const regional = tryRegionalScalarEdit(text, doc, path, value, options);
		if (regional !== undefined) {
			return regional.map((e) => YamlEdit.make(e));
		}

		const newContents = yield* Effect.try({
			try: () => modifyDocument(doc, path, value),
			catch: (err) => {
				if (!(err instanceof ModifyFailure)) throw err;
				return YamlModificationError.make({
					path,
					diagnostics: [
						YamlDiagnostic.fromRaw(
							{ code: err.code, message: err.message, offset: err.offset, length: err.length },
							text,
						),
					],
				});
			},
		});

		const outputDoc: RawYamlDocument = { ...doc, contents: newContents };
		const formatted = stringifyDocument(outputDoc, toStringifyInput(options));
		return computeEdits(text, withSourceBom(text, formatted)).map((e) => YamlEdit.make(e));
	});

	/**
	 * Modify `text` and apply the resulting edits in one step
	 * (`YamlEdit.applyAll ∘ modify`). Inherits the {@link YamlFormat.modify}
	 * error channel, including the single-document contract's
	 * `MultiDocumentStream` refusal and the `DirectiveCarryingDocument`
	 * refusal of `%YAML`/`%TAG`-carrying documents.
	 *
	 * @param text - The YAML source to modify.
	 * @param path - The location to insert, replace or remove.
	 * @param value - The JavaScript value to write; `undefined` removes the
	 *   target instead.
	 * @param options - Optional {@link YamlStringifyOptions} for the
	 *   re-stringify step.
	 * @returns An `Effect` that succeeds with the modified text, or fails with
	 *   {@link YamlModificationError}.
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
