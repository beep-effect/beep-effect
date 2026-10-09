// The formatting/modification concept: non-mutating text splices (TomlEdit)
// that conservatively normalize whitespace or change a value at a path, both
// computed against the linear CST so comments and layout survive every
// operation. Format is syntactic and structural — every edit derives from an
// expression or value span, never from naive line splitting, so a byte
// inside a multi-line string is untouchable by construction. Modify resolves
// its path through the SEMANTIC view and pins the insertion-placement rules:
// root inserts land after the last root expression (before the first
// header), section inserts after the section's last non-trivia expression,
// dotted tables render as dotted keys appended to their defining section,
// and inline or implicit tables refuse with a typed error.
//
// Cycle firewall: the engine throws raw carriers (RawTomlError,
// GuardExceeded); this module materializes TomlDiagnostic instances and the
// tagged TomlModificationError. The dependency edge runs facade → engine
// only.

import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import type { TomlErrorCodeRaw } from "./internal/diagnostics.ts";
import { isRawTomlError } from "./internal/diagnostics.ts";
import { MAX_NESTING_DEPTH, isGuardExceeded } from "./internal/limits.ts";
import { parseExpressions } from "./internal/parser.ts";
import { analyze } from "./internal/semantic.ts";
import { renderInlineValue, renderKey } from "./internal/stringifyValue.ts";
import { TomlDiagnostic, TomlErrorCode } from "./TomlDiagnostic.ts";
import { TomlDocument } from "./TomlDocument.ts";
import type { TomlPath, TomlRange, TomlSegment } from "./TomlEdit.ts";
import { TomlEdit } from "./TomlEdit.ts";
import type { TomlExpression, TomlInlineEntry, TomlValueNode } from "./TomlNode.ts";
import type {
	TomlArray,
	TomlArrayTableHeader,
	TomlInlineTable,
	TomlKeyValue,
	TomlTableHeader,
	TomlTrivia,
} from "./TomlNode.ts";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/toml/TomlFormat");

class TomlFormatInvariantError extends S.TaggedError<TomlFormatInvariantError>($I`TomlFormatInvariantError`)(
	"TomlFormatInvariantError",
	{ message: S.String.annotateKey({ description: "Explanation of the missing CST node, path segment or splice span required by formatting or modification." }) },
	$I.annote("TomlFormatInvariantError", { description: "A programmer defect encountered while computing TOML formatting or modification edits." }),
) {}

/**
 * A range accepted at the `format`/`formatToString` call sites: either a
 * {@link TomlRange} instance or a plain `{ offset, length }` literal (the two
 * are structurally interchangeable — only `offset`/`length` are read).
 *
 * @public
 */
export type TomlRangeLike = TomlRange | { readonly offset: number; readonly length: number };

/**
 * Options controlling formatting and modification behavior. The only knob is
 * `newline`: for `format` it normalizes every newline outside multi-line
 * strings; for `modify` it overrides the dominant newline inherited by
 * inserted lines.
 *
 * @public
 */
export class TomlFormattingOptions extends S.Class<TomlFormattingOptions>($I`TomlFormattingOptions`)({
	newline: S.optionalKey(S.Literals(["\n", "\r\n"])).annotateKey({ description: "LF or CRLF used to normalize line endings outside multiline strings during formatting and terminate inserted lines during modification" }),
}, $I.annote("TomlFormattingOptions", { description: "Options controlling formatting and modification behavior. The only knob is `newline`: for `format` it normalizes every newline outside multi-line strings; for `modify` it overrides the dominant newline inherited by inserted lines." })) {}

/**
 * Raised when `TomlFormat.modify` cannot resolve the requested path against
 * the document's semantic view, when the insertion target refuses (an inline
 * table or an implicitly created table), or when the replacement value
 * cannot render as TOML. Carries one structured {@link TomlDiagnostic} —
 * never a collapsed `reason` string.
 *
 * @public
 */
export class TomlModificationError extends S.TaggedError<TomlModificationError>($I`TomlModificationError`)("TomlModificationError", {
	diagnostic: TomlDiagnostic.annotateKey({ description: "Structured failure detail carrying the code, message and source position explaining why modification failed" }),
}, $I.annote("TomlModificationError", { description: "Raised when `TomlFormat.modify` cannot resolve the requested path against the document's semantic view, when the insertion target refuses (an inline table or an implicitly created table), or when the replacement value cannot render as TOML. Carries one structured TomlDiagnostic — never a collapsed `reason` string." })) {
	override get message(): string {
		return `TOML modification failed: ${this.diagnostic.code} ${this.diagnostic.message}`;
	}
}

// ── Internal: shared text helpers ───────────────────────────────────────────

const TAB = 0x09;
const LF = 0x0a;
const CR = 0x0d;
const SPACE = 0x20;
const BANG = 0x21;
const HASH = 0x23;
const BOM = 0xfeff;

const isWs = (code: number): boolean => code === SPACE || code === TAB;

const scanWs = (source: string, pos: number, end: number): number => {
	let i = pos;
	while (i < end && isWs(source.charCodeAt(i))) {
		i++;
	}
	return i;
};

const scanWsBack = (source: string, pos: number, start: number): number => {
	let i = pos;
	while (i > start && isWs(source.charCodeAt(i - 1))) {
		i--;
	}
	return i;
};

/** The document's dominant newline: CRLF only when CRLF pairs outnumber bare LFs. */
const dominantNewline = (source: string): "\n" | "\r\n" => {
	let lf = 0;
	let crlf = 0;
	for (let i = 0; i < source.length; i++) {
		if (source.charCodeAt(i) === LF) {
			if (i > 0 && source.charCodeAt(i - 1) === CR) {
				crlf++;
			} else {
				lf++;
			}
		}
	}
	return crlf > lf ? "\r\n" : "\n";
};

// ── Internal: format ─────────────────────────────────────────────────────────

/** A raw splice tagged with its owning expression's span for range filtering. */
interface TaggedEdit {
	readonly offset: number;
	readonly length: number;
	readonly newText: string;
	readonly exprOffset: number;
	readonly exprEnd: number;
}

/** Multi-line string value spans — the bytes formatting must never touch. */
const collectMultilineSpans = (node: TomlValueNode, out: Array<readonly [number, number]>): void => {
	if (P.isTagged(node, "TomlString")) {
		if (node.style === "multiline-basic" || node.style === "multiline-literal") {
			out.push([node.offset, node.offset + node.length]);
		}
		return;
	}
	if (P.isTagged(node, "TomlArray")) {
		for (const item of node.items) {
			collectMultilineSpans(item, out);
		}
		return;
	}
	if (P.isTagged(node, "TomlInlineTable")) {
		for (const entry of node.entries) {
			collectMultilineSpans(entry.value, out);
		}
	}
};

/** Accumulates format edits for one document; drops no-op splices to keep format idempotent. */
class FormatEmitter {
	readonly edits: Array<TaggedEdit> = [];
	private readonly source: string;
	constructor(source: string) {
		this.source = source;
	}

	push(expr: TomlExpression, offset: number, length: number, newText: string): void {
		if (this.source.slice(offset, offset + length) !== newText) {
			this.edits.push({ offset, length, newText, exprOffset: expr.offset, exprEnd: expr.offset + expr.length });
		}
	}
}

/** Rule 2: strip the expression's leading indentation (the first line's BOM excluded). */
const formatLeading = (source: string, emit: FormatEmitter, expr: TomlExpression): void => {
	let start = expr.offset;
	if (start === 0 && source.charCodeAt(0) === BOM) {
		start = 1;
	}
	const end = scanWs(source, start, expr.offset + expr.length);
	if (end > start) {
		emit.push(expr, start, end - start, "");
	}
};

/** Rule 4 (space after `#`) and the rule-3 trailing-whitespace strip, for one comment body. */
const formatCommentBody = (
	source: string,
	emit: FormatEmitter,
	expr: TomlExpression,
	bodyStart: number,
	lineEnd: number,
): void => {
	const bodyEnd = scanWsBack(source, lineEnd, bodyStart);
	if (bodyEnd < lineEnd) {
		emit.push(expr, bodyEnd, lineEnd - bodyEnd, "");
	}
	if (bodyEnd > bodyStart) {
		const code = source.charCodeAt(bodyStart);
		if (code !== SPACE && code !== TAB && code !== BANG) {
			emit.push(expr, bodyStart, 0, " ");
		}
	}
};

/** Rule 3: the run between an expression's content end and its newline — trailing ws and the comment gap. */
const formatTail = (source: string, emit: FormatEmitter, expr: TomlExpression, contentEnd: number): void => {
	const exprEnd = expr.offset + expr.length;
	let nlStart = exprEnd;
	if (nlStart > contentEnd && source.charCodeAt(nlStart - 1) === LF) {
		nlStart -= 1;
		if (nlStart > contentEnd && source.charCodeAt(nlStart - 1) === CR) {
			nlStart -= 1;
		}
	}
	// The tail grammar is whitespace then an optional comment, so the first
	// non-ws character is `#` or there is no comment — a bounded scan, never
	// an unbounded indexOf across the rest of the document.
	const hashIdx = scanWs(source, contentEnd, nlStart);
	if (hashIdx >= nlStart || source.charCodeAt(hashIdx) !== HASH) {
		if (nlStart > contentEnd) {
			emit.push(expr, contentEnd, nlStart - contentEnd, "");
		}
		return;
	}
	emit.push(expr, contentEnd, hashIdx - contentEnd, " ");
	formatCommentBody(source, emit, expr, hashIdx + 1, nlStart);
};

/** Rules 2–4 over a trivia run's blank and comment-only lines. */
const formatTrivia = (source: string, emit: FormatEmitter, expr: TomlTrivia): void => {
	const end = expr.offset + expr.length;
	let i = expr.offset;
	while (i < end) {
		const lineStart = i;
		let j = i;
		while (j < end && source.charCodeAt(j) !== LF && source.charCodeAt(j) !== CR) {
			j++;
		}
		let start = lineStart;
		if (start === 0 && source.charCodeAt(0) === BOM) {
			start = 1;
		}
		const wsEnd = scanWs(source, start, j);
		if (wsEnd >= j) {
			if (j > start) {
				emit.push(expr, start, j - start, "");
			}
		} else {
			if (wsEnd > start) {
				emit.push(expr, start, wsEnd - start, "");
			}
			formatCommentBody(source, emit, expr, wsEnd + 1, j);
		}
		if (j < end && source.charCodeAt(j) === CR && j + 1 < end && source.charCodeAt(j + 1) === LF) {
			j += 2;
		} else if (j < end) {
			j += 1;
		}
		i = j;
	}
};

/** Rule 6: normalize every newline within the expression span, skipping the protected string spans. */
const normalizeNewlines = (
	source: string,
	emit: FormatEmitter,
	expr: TomlExpression,
	protectedSpans: ReadonlyArray<readonly [number, number]>,
	target: "\n" | "\r\n",
): void => {
	const end = expr.offset + expr.length;
	let p = 0;
	let i = expr.offset;
	while (i < end) {
		let protectedSpan = protectedSpans[p];
		while (protectedSpan !== undefined && protectedSpan[1] <= i) {
			p++;
			protectedSpan = protectedSpans[p];
		}
		if (protectedSpan !== undefined && i >= protectedSpan[0]) {
			i = protectedSpan[1];
			continue;
		}
		const code = source.charCodeAt(i);
		if (code === CR && i + 1 < end && source.charCodeAt(i + 1) === LF) {
			if (target === "\n") {
				emit.push(expr, i, 2, "\n");
			}
			i += 2;
		} else if (code === LF) {
			if (target === "\r\n") {
				emit.push(expr, i, 1, "\r\n");
			}
			i += 1;
		} else {
			i += 1;
		}
	}
};

/** The position just past a header's closing bracket(s). */
const headerContentEnd = (source: string, expr: TomlTableHeader | TomlArrayTableHeader): number => {
	const lastKey = expr.keyPath[expr.keyPath.length - 1];
	if (lastKey === undefined) {
		throw TomlFormatInvariantError.make({ message: "missing TOML element" });
	}
	const bracket = scanWs(source, lastKey.offset + lastKey.length, expr.offset + expr.length);
	return bracket + (P.isTagged(expr, "TomlArrayTableHeader") ? 2 : 1);
};

/** All six format rules over the expression list; `[]` on malformed input (never corrupt it). */
const computeFormatEdits = (source: string, options: TomlFormattingOptions | undefined): Array<TaggedEdit> => {
	let expressions: ReadonlyArray<TomlExpression>;
	try {
		expressions = parseExpressions(source);
	} catch {
		return [];
	}
	const emit = new FormatEmitter(source);
	const target = options?.newline;
	for (const expr of expressions) {
		let protectedSpans: ReadonlyArray<readonly [number, number]> = [];
		if (P.isTagged(expr, "TomlTrivia")) {
			formatTrivia(source, emit, expr);
		} else if (P.isTagged(expr, "TomlKeyValue")) {
			formatLeading(source, emit, expr);
			const lastKey = expr.keyPath[expr.keyPath.length - 1];
			if (lastKey === undefined) {
				throw TomlFormatInvariantError.make({ message: "missing TOML element" });
			}
			const keyEnd = lastKey.offset + lastKey.length;
			emit.push(expr, keyEnd, expr.value.offset - keyEnd, " = ");
			formatTail(source, emit, expr, expr.value.offset + expr.value.length);
			if (target !== undefined) {
				const spans: Array<readonly [number, number]> = [];
				collectMultilineSpans(expr.value, spans);
				protectedSpans = spans;
			}
		} else {
			formatLeading(source, emit, expr);
			formatTail(source, emit, expr, headerContentEnd(source, expr));
		}
		if (target !== undefined) {
			normalizeNewlines(source, emit, expr, protectedSpans, target);
		}
	}
	// Rule 5: a single final newline.
	if (expressions.length > 0 && source.charCodeAt(source.length - 1) !== LF) {
		const last = expressions[expressions.length - 1];
		if (last === undefined) {
			throw TomlFormatInvariantError.make({ message: "missing TOML element" });
		}
		emit.push(last, source.length, 0, target ?? dominantNewline(source));
	}
	return emit.edits;
};

// ── Internal: modify — the semantic index ───────────────────────────────────

/** One document section: the root run or a header's contiguous run of expressions. */
interface Section {
	readonly header: TomlTableHeader | TomlArrayTableHeader | undefined;
	/** End offset of the section's last non-trivia expression — the insertion point. */
	insertAfter: number | undefined;
}

/** A table in the resolution tree, tagged with how it came to exist and where inserts land. */
interface ResTable {
	readonly kind: "table";
	origin: "root" | "explicit" | "implicit" | "dotted" | "element";
	readonly entries: MutableHashMap.MutableHashMap<string, ResNode>;
	sectionIndex: number;
	/** Dotted tables only: the key path relative to the defining section's header. */
	readonly relPath: ReadonlyArray<string>;
}

interface ResArrayTables {
	readonly kind: "array-tables";
	readonly elements: Array<ResTable>;
}

/** A value assigned by a key-value expression; `expr` is the deletable host line. */
interface ResValue {
	readonly kind: "value";
	readonly node: TomlValueNode;
	readonly expr: TomlKeyValue;
}

type ResNode = ResTable | ResArrayTables | ResValue;

const mkTable = (origin: ResTable["origin"], sectionIndex = 0, relPath: ReadonlyArray<string> = []): ResTable => ({
	kind: "table",
	origin,
	entries: MutableHashMap.empty<string, ResNode>(),
	sectionIndex,
	relPath,
});

/** Descend into a navigable node: tables pass through, array-of-tables yield their last element. */
const intoTable = (node: ResNode | undefined): ResTable => {
	if (node !== undefined && node.kind === "array-tables") {
		const element = node.elements[node.elements.length - 1];
		if (element === undefined) {
			throw TomlFormatInvariantError.make({ message: "missing TOML element" });
		}
		return element;
	}
	if (node !== undefined && node.kind === "table") {
		return node;
	}
	// The semantic pass already validated every navigation; reaching a value here is an invariant violation.
	throw TomlFormatInvariantError.make({ message: "invariant: semantic pass admitted a value where a table was navigated" });
};

/**
 * Build the resolution tree and section list by riding `analyze`'s visitor.
 * The expressions were validated at parse time, so the walk cannot throw;
 * `onKeyValue` paths are name-only, so array-of-tables element association
 * comes from descending into the LAST element — expressions arrive in
 * document order, so the last element is always the current one.
 */
const buildSemanticIndex = (
	expressions: ReadonlyArray<TomlExpression>,
): { readonly root: ResTable; readonly sections: ReadonlyArray<Section> } => {
	const sections: Array<Section> = [{ header: undefined, insertAfter: undefined }];
	for (const expr of expressions) {
		if (P.isTagged(expr, "TomlTableHeader") || P.isTagged(expr, "TomlArrayTableHeader")) {
			sections.push({ header: expr, insertAfter: expr.offset + expr.length });
		} else if (!P.isTagged(expr, "TomlTrivia")) {
			const section = sections[sections.length - 1];
			if (section === undefined) {
				throw TomlFormatInvariantError.make({ message: "missing TOML element" });
			}
			section.insertAfter = expr.offset + expr.length;
		}
	}
	const root = mkTable("root");
	let sectionCounter = 0;
	const navigateHeaderPrefix = (path: ReadonlyArray<string>): ResTable => {
		let current = root;
		for (let i = 0; i < path.length - 1; i++) {
			const name = path[i];
			if (name === undefined) {
				throw TomlFormatInvariantError.make({ message: "missing TOML element" });
			}
			let child = O.getOrUndefined(MutableHashMap.get(current.entries, name));
			if (child === undefined) {
				child = mkTable("implicit");
				MutableHashMap.set(current.entries, name, child);
			}
			current = intoTable(child);
		}
		return current;
	};
	analyze(expressions, {
		onTableStart: (path, header) => {
			if (header === undefined) {
				return;
			}
			sectionCounter += 1;
			const parent = navigateHeaderPrefix(path);
			const name = path[path.length - 1];
			if (name === undefined) {
				throw TomlFormatInvariantError.make({ message: "missing TOML element" });
			}
			const existing = O.getOrUndefined(MutableHashMap.get(parent.entries, name));
			if (existing !== undefined && existing.kind === "table") {
				existing.origin = "explicit";
				existing.sectionIndex = sectionCounter;
			} else {
				MutableHashMap.set(parent.entries, name, mkTable("explicit", sectionCounter));
			}
		},
		onArrayTableStart: (path, _index, _header) => {
			sectionCounter += 1;
			const parent = navigateHeaderPrefix(path);
			const name = path[path.length - 1];
			if (name === undefined) {
				throw TomlFormatInvariantError.make({ message: "missing TOML element" });
			}
			const existing = O.getOrUndefined(MutableHashMap.get(parent.entries, name));
			if (existing !== undefined && existing.kind === "array-tables") {
				existing.elements.push(mkTable("element", sectionCounter));
			} else {
				MutableHashMap.set(parent.entries, name, { kind: "array-tables", elements: [mkTable("element", sectionCounter)] });
			}
		},
		onKeyValue: (path, expr) => {
			const names = expr.keyPath.map((key) => key.value);
			let current = root;
			for (let i = 0; i < path.length - names.length; i++) {
				const name = path[i];
				if (name === undefined) {
					throw TomlFormatInvariantError.make({ message: "missing TOML element" });
				}
				current = current.entries.pipe(MutableHashMap.get(name), O.getOrUndefined, intoTable);
			}
			for (let j = 0; j < names.length - 1; j++) {
				const name = names[j];
				if (name === undefined) {
					throw TomlFormatInvariantError.make({ message: "missing TOML element" });
				}
				let child = O.getOrUndefined(MutableHashMap.get(current.entries, name));
				if (child === undefined) {
					child = mkTable("dotted", sectionCounter, names.slice(0, j + 1));
					MutableHashMap.set(current.entries, name, child);
				}
				current = intoTable(child);
			}
			const name = names[names.length - 1];
			if (name === undefined) {
				throw TomlFormatInvariantError.make({ message: "missing TOML element" });
			}
			MutableHashMap.set(current.entries, name, { kind: "value", node: expr.value, expr });
		},
	});
	return { root, sections };
};

// ── Internal: modify — path resolution ──────────────────────────────────────

/** Thrown by the pure resolution helpers; `modify` materializes {@link TomlModificationError}. */
class ModifyFailure extends S.TaggedError<ModifyFailure>($I`ModifyFailure`)("ModifyFailure", {
	code: TomlErrorCode.annotateKey({ description: "Diagnostic category explaining why the modification path or target was rejected." }),
	message: S.String.annotateKey({ description: "Original path-resolution or modification failure message." }),
	offset: S.Finite.annotateKey({ description: "Starting source position of the rejected target in UTF-16 code units." }),
	len: S.Finite.annotateKey({ description: "Length of the rejected target span in UTF-16 code units." }),
}, $I.annote("ModifyFailure", { description: "Internal modification failure materialized as a TomlModificationError at the facade boundary." })) {
	override readonly name = "ModifyFailure";
}

const isModifyFailure = S.is(ModifyFailure);

const failResolve = (code: TomlErrorCodeRaw, message: string, offset = 0, length = 0): never => {
	throw ModifyFailure.make({ code, message, offset, len: length });
};

const requireIndex = (segment: TomlSegment, what: string, offset: number, length: number): number => {
	if (!P.isNumber(segment) || !Number.isInteger(segment) || segment < 0) {
		return failResolve(
			"DottedKeyConflict",
			`${what} requires a non-negative integer index, received "${String(segment)}"`,
			offset,
			length,
		);
	}
	return segment;
};

interface Candidate {
	readonly entry: TomlInlineEntry;
	readonly index: number;
}

type DeleteTarget =
	| { readonly kind: "expression"; readonly expr: TomlKeyValue }
	| { readonly kind: "inline-entry"; readonly table: TomlInlineTable; readonly index: number }
	| { readonly kind: "array-item"; readonly array: TomlArray; readonly index: number };

type Cursor =
	| { readonly t: "table"; readonly table: ResTable }
	| { readonly t: "array-tables"; readonly node: ResArrayTables }
	| { readonly t: "cst"; readonly node: TomlValueNode; readonly del: DeleteTarget }
	| {
			readonly t: "inline";
			readonly table: TomlInlineTable;
			readonly candidates: ReadonlyArray<Candidate>;
			readonly depth: number;
	  };

/** Wrap a CST value as a cursor; inline tables open as an entry scope (dotted keys included). */
const cstCursor = (node: TomlValueNode, del: DeleteTarget): Cursor =>
	P.isTagged(node, "TomlInlineTable")
		? { t: "inline", table: node, candidates: node.entries.map((entry, index) => ({ entry, index })), depth: 0 }
		: { t: "cst", node, del };

const stepInline = (
	cur: Extract<Cursor, { t: "inline" }>,
	key: string,
): { readonly matches: ReadonlyArray<Candidate>; readonly full: Candidate | undefined } => {
	const matches = cur.candidates.filter((candidate) => candidate.entry.keyPath[cur.depth]?.value === key);
	const first = matches[0];
	const full = matches.length === 1 && first !== undefined && first.entry.keyPath.length === cur.depth + 1 ? first : undefined;
	return { matches, full };
};

/** One navigation step (never the terminal segment). */
const step = (cur: Cursor, segment: TomlSegment): Cursor => {
	if (cur.t === "table") {
		const key = String(segment);
		const child = O.getOrUndefined(MutableHashMap.get(cur.table.entries, key));
		if (child === undefined) {
			return failResolve(
				"DottedKeyConflict",
				`key "${key}" does not resolve — intermediate tables are never auto-created`,
			);
		}
		if (child.kind === "table") {
			return { t: "table", table: child };
		}
		if (child.kind === "array-tables") {
			return { t: "array-tables", node: child };
		}
		return cstCursor(child.node, { kind: "expression", expr: child.expr });
	}
	if (cur.t === "array-tables") {
		const idx = requireIndex(segment, "an array of tables", 0, 0);
		if (idx >= cur.node.elements.length) {
			return failResolve("DottedKeyConflict", `array-of-tables index ${idx} is out of bounds`);
		}
		const table = cur.node.elements[idx];
		if (table === undefined) {
			throw TomlFormatInvariantError.make({ message: "missing TOML element" });
		}
		return { t: "table", table };
	}
	if (cur.t === "inline") {
		const key = String(segment);
		const { matches, full } = stepInline(cur, key);
		if (matches.length === 0) {
			return failResolve(
				"DottedKeyConflict",
				`key "${key}" does not resolve in the inline table`,
				cur.table.offset,
				cur.table.length,
			);
		}
		if (full !== undefined) {
			return cstCursor(full.entry.value, { kind: "inline-entry", table: cur.table, index: full.index });
		}
		return { t: "inline", table: cur.table, candidates: matches, depth: cur.depth + 1 };
	}
	const node = cur.node;
	if (P.isTagged(node, "TomlArray")) {
		const idx = requireIndex(segment, "an array", node.offset, node.length);
		if (idx >= node.items.length) {
			return failResolve("DottedKeyConflict", `array index ${idx} is out of bounds`, node.offset, node.length);
		}
		const item = node.items[idx];
		if (item === undefined) {
			throw TomlFormatInvariantError.make({ message: "missing TOML element" });
		}
		return cstCursor(item, { kind: "array-item", array: node, index: idx });
	}
	return failResolve("DottedKeyConflict", "cannot navigate through a scalar value", node.offset, node.length);
};

// ── Internal: modify — terminal edits ───────────────────────────────────────

interface RawEdit {
	readonly offset: number;
	readonly length: number;
	readonly newText: string;
}

interface ModifyContext {
	readonly source: string;
	readonly sections: ReadonlyArray<Section>;
	readonly nl: "\n" | "\r\n";
}

/** Delete one array item, splicing the separator: leading comma for a last item, trailing for the rest. */
const spliceArrayItem = (array: TomlArray, index: number): RawEdit => {
	const items = array.items;
	if (items.length === 1) {
		return { offset: array.offset + 1, length: array.length - 2, newText: "" };
	}
	const current = items[index];
	if (current === undefined) {
		throw TomlFormatInvariantError.make({ message: "missing TOML element" });
	}
	if (index < items.length - 1) {
		const next = items[index + 1];
		if (next === undefined) {
			throw TomlFormatInvariantError.make({ message: "missing TOML element" });
		}
		return { offset: current.offset, length: next.offset - current.offset, newText: "" };
	}
	const previous = items[index - 1];
	if (previous === undefined) {
		throw TomlFormatInvariantError.make({ message: "missing TOML element" });
	}
	const prevEnd = previous.offset + previous.length;
	return { offset: prevEnd, length: current.offset + current.length - prevEnd, newText: "" };
};

/** Delete one inline-table entry with the same separator-splicing rule. */
const spliceInlineEntry = (table: TomlInlineTable, index: number): RawEdit => {
	const entries = table.entries;
	if (entries.length === 1) {
		return { offset: table.offset + 1, length: table.length - 2, newText: "" };
	}
	const current = entries[index];
	if (current === undefined) {
		throw TomlFormatInvariantError.make({ message: "missing TOML element" });
	}
	if (index < entries.length - 1) {
		const next = entries[index + 1];
		if (next === undefined) {
			throw TomlFormatInvariantError.make({ message: "missing TOML element" });
		}
		return { offset: current.offset, length: next.offset - current.offset, newText: "" };
	}
	const previous = entries[index - 1];
	if (previous === undefined) {
		throw TomlFormatInvariantError.make({ message: "missing TOML element" });
	}
	const prevEnd = previous.offset + previous.length;
	return { offset: prevEnd, length: current.offset + current.length - prevEnd, newText: "" };
};

/** The pinned insertion-placement rules: where a new `key = value` line lands and how its key renders. */
const insertEdit = (table: ResTable, key: string, value: unknown, ctx: ModifyContext): RawEdit => {
	if (table.origin === "implicit") {
		return failResolve(
			"DottedKeyConflict",
			"the table was created implicitly by a longer header and has no section of its own to insert into",
		);
	}
	const keyPath = table.origin === "dotted" ? [...table.relPath, key] : [key];
	const line = `${keyPath.map(renderKey).join(".")} = ${renderInlineValue(value)}`;
	let offset: number;
	if (table.sectionIndex === 0) {
		const firstHeader = ctx.sections.length > 1 ? ctx.sections[1]?.header : undefined;
		const section = ctx.sections[0];
		if (section === undefined) {
			throw TomlFormatInvariantError.make({ message: "missing TOML element" });
		}
		offset = section.insertAfter ?? firstHeader?.offset ?? 0;
	} else {
		const section = ctx.sections[table.sectionIndex];
		if (section === undefined) {
			throw TomlFormatInvariantError.make({ message: "missing TOML element" });
		}
		offset = section.insertAfter ?? 0;
	}
	const needLeading = offset > 0 && ctx.source.charCodeAt(offset - 1) !== LF;
	return { offset, length: 0, newText: `${needLeading ? ctx.nl : ""}${line}${ctx.nl}` };
};

/** Resolve the final segment against the parent cursor and produce the terminal edits. */
const terminal = (cur: Cursor, segment: TomlSegment, value: unknown, ctx: ModifyContext): Array<RawEdit> => {
	if (cur.t === "table") {
		const key = String(segment);
		const existing = O.getOrUndefined(MutableHashMap.get(cur.table.entries, key));
		if (value === undefined) {
			if (existing === undefined) {
				return [];
			}
			if (existing.kind !== "value") {
				return failResolve("DottedKeyConflict", `"${key}" is a table section, not a deletable value`);
			}
			return [{ offset: existing.expr.offset, length: existing.expr.length, newText: "" }];
		}
		if (existing === undefined) {
			return [insertEdit(cur.table, key, value, ctx)];
		}
		if (existing.kind !== "value") {
			return failResolve("DottedKeyConflict", `"${key}" is already defined as a table and cannot become a value`);
		}
		return [{ offset: existing.node.offset, length: existing.node.length, newText: renderInlineValue(value) }];
	}
	if (cur.t === "array-tables") {
		const idx = requireIndex(segment, "an array of tables", 0, 0);
		if (value === undefined && idx >= cur.node.elements.length) {
			return [];
		}
		return failResolve(
			"DottedKeyConflict",
			idx < cur.node.elements.length
				? `array-of-tables element ${idx} is a table section, not an addressable value`
				: `array-of-tables index ${idx} is out of bounds`,
		);
	}
	if (cur.t === "inline") {
		const key = String(segment);
		const { matches, full } = stepInline(cur, key);
		if (value === undefined) {
			if (matches.length === 0) {
				return [];
			}
			if (full === undefined) {
				return failResolve(
					"DottedKeyConflict",
					`"${key}" is a dotted-key group inside an inline table, not a single entry`,
					cur.table.offset,
					cur.table.length,
				);
			}
			return [spliceInlineEntry(cur.table, full.index)];
		}
		if (matches.length === 0) {
			return failResolve(
				"InlineTableExtended",
				`inline table cannot be extended with new key "${key}"`,
				cur.table.offset,
				cur.table.length,
			);
		}
		if (full === undefined) {
			return failResolve(
				"DottedKeyConflict",
				`"${key}" is a dotted-key group inside an inline table, not a single entry`,
				cur.table.offset,
				cur.table.length,
			);
		}
		return [{ offset: full.entry.value.offset, length: full.entry.value.length, newText: renderInlineValue(value) }];
	}
	const node = cur.node;
	if (P.isTagged(node, "TomlArray")) {
		const idx = requireIndex(segment, "an array", node.offset, node.length);
		if (value === undefined) {
			if (idx >= node.items.length) {
				return [];
			}
			return [spliceArrayItem(node, idx)];
		}
		if (idx >= node.items.length) {
			return failResolve(
				"DottedKeyConflict",
				`array index ${idx} is out of bounds — modify never appends array elements`,
				node.offset,
				node.length,
			);
		}
		const item = node.items[idx];
		if (item === undefined) {
			throw TomlFormatInvariantError.make({ message: "missing TOML element" });
		}
		return [{ offset: item.offset, length: item.length, newText: renderInlineValue(value) }];
	}
	return failResolve("DottedKeyConflict", "cannot address a key beneath a scalar value", node.offset, node.length);
};

// ── Facade ──────────────────────────────────────────────────────────────────

/**
 * Formats TOML text and modifies values at a path as byte-minimal edits that
 * leave comments and layout elsewhere untouched. Not instantiable.
 *
 * @example
 * ```ts
 * import { TomlFormat } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const formatted = TomlFormat.formatToString('  title="x"   #note\n[server]\nport=1');
 * // => 'title = "x" # note\n[server]\nport = 1\n'
 *
 * const program = Effect.gen(function* () {
 *   return yield* TomlFormat.modifyToString("[server]\nport = 1 # dev\n", ["server", "port"], 2);
 *   // => "[server]\nport = 2 # dev\n"
 * });
 * ```
 *
 * @remarks
 * `format`/`formatToString` are pure and total: malformed input yields no
 * edits rather than corrupting the document, and every edit derives from an
 * expression or value span, so bytes inside multi-line strings are
 * untouchable by construction. `modify`/`modifyToString` carry a real error
 * channel — {@link TomlParseError} when the source does not parse and
 * {@link TomlModificationError} for path-resolution and insertion-target
 * failures — and every document they produce reparses cleanly.
 *
 * @public
 */
export class TomlFormat {
	private constructor() {}

	/**
	 * Compute conservative formatting edits: one space around `=`, leading
	 * indentation stripped, trailing whitespace stripped with one space before
	 * a trailing `#`, one space after a non-empty `#` (unless it starts with
	 * space, tab or `!`), a single final newline, and — when
	 * `options.newline` is set — every newline normalized outside multi-line
	 * strings. Nothing else: no reordering, no blank-line collapsing, no value
	 * rewriting. `range` restricts edits to the expressions intersecting it.
	 * Non-mutating — apply with `TomlEdit.applyAll` (or use
	 * {@link TomlFormat.formatToString}). Pure and total.
	 *
	 * @param text - The TOML source to format.
	 * @param range - Optional sub-range; only edits whose expression intersects
	 *   it are returned.
	 * @param options - Optional {@link TomlFormattingOptions}.
	 * @returns The edits that bring `text` (or `range`) to canonical shape;
	 *   apply them with `TomlEdit.applyAll`.
	 */
	static format(text: string, range?: TomlRangeLike, options?: TomlFormattingOptions): ReadonlyArray<TomlEdit> {
		const tagged = computeFormatEdits(text, options);
		const filtered =
			range === undefined
				? tagged
				: tagged.filter(
						(edit) => Math.max(edit.exprOffset, range.offset) <= Math.min(edit.exprEnd, range.offset + range.length),
					);
		return filtered.map((edit) => TomlEdit.make({ offset: edit.offset, length: edit.length, content: edit.newText }));
	}

	/**
	 * Format `text` and apply the resulting edits in one step
	 * (`TomlEdit.applyAll ∘ format`). Pure and total.
	 *
	 * @param text - The TOML source to format.
	 * @param range - Optional sub-range; only edits whose expression intersects
	 *   it are applied.
	 * @param options - Optional {@link TomlFormattingOptions}.
	 * @returns The formatted text.
	 */
	static formatToString(text: string, range?: TomlRangeLike, options?: TomlFormattingOptions): string {
		return TomlEdit.applyAll(text, TomlFormat.format(text, range, options));
	}

	/**
	 * Compute the edits that replace, delete, or insert a value at `path`,
	 * resolved through the document's semantic view. Every segment but the
	 * last must resolve — intermediate tables are never auto-created. A
	 * `value` of `undefined` deletes: a key-value's whole line, an inline
	 * entry, or an array item, splicing separators. A new key inserts per the
	 * pinned placement rules: root keys land after the last root expression
	 * (before the first header), section keys after the section's last
	 * expression, dotted-table keys as dotted keys appended to the defining
	 * section; inline and implicitly created tables refuse. Inserted lines
	 * inherit the document's dominant newline unless `options.newline`
	 * overrides it. Every modified document reparses cleanly.
	 *
	 * @param text - The TOML source to modify.
	 * @param path - The location to set, replace or delete.
	 * @param value - The plain JavaScript value to write; `undefined` deletes the
	 *   target instead.
	 * @param options - Optional {@link TomlFormattingOptions}; `newline` overrides
	 *   the newline used for inserted lines.
	 * @returns An `Effect` that succeeds with the edits to apply (via
	 *   `TomlEdit.applyAll`), or fails with {@link TomlParseError} when the
	 *   source does not parse, or {@link TomlModificationError} when `path`
	 *   cannot be resolved or the insertion target is not allowed.
	 */
	static readonly modify = Effect.fn("TomlFormat.modify")(function* (
		text: string,
		path: TomlPath,
		value: unknown,
		options?: TomlFormattingOptions,
	) {
		const failWith = (code: TomlErrorCodeRaw, message: string, offset = 0, length = 0): TomlModificationError =>
			TomlModificationError.make({ diagnostic: TomlDiagnostic.fromRaw(text, { code, message, offset, length }) });
		if (path.length === 0) {
			return yield* failWith("DottedKeyConflict", "an empty path does not address a value");
		}
		if (path.length > MAX_NESTING_DEPTH) {
			return yield* failWith("NestingDepthExceeded", `path depth ${path.length} exceeds the ${MAX_NESTING_DEPTH} cap`);
		}
		const doc = yield* TomlDocument.parse(text);
		const diagnostic = doc.diagnostics[0];
		if (diagnostic !== undefined) {
			return yield* TomlModificationError.make({ diagnostic });
		}
		const { root, sections } = buildSemanticIndex(doc.expressions);
		const ctx: ModifyContext = { source: text, sections, nl: options?.newline ?? dominantNewline(text) };
		const raw = yield* Effect.try({
			try: () => {
				let cursor: Cursor = { t: "table", table: root };
				for (let i = 0; i < path.length - 1; i++) {
					const segment = path[i];
					if (segment === undefined) {
						throw TomlFormatInvariantError.make({ message: "missing TOML path segment" });
					}
					cursor = step(cursor, segment);
				}
				const segment = path[path.length - 1];
				if (segment === undefined) {
					throw TomlFormatInvariantError.make({ message: "missing TOML path segment" });
				}
				return terminal(cursor, segment, value, ctx);
			},
			catch: (defect) => {
				if (isModifyFailure(defect)) {
					return failWith(defect.code, defect.message, defect.offset, defect.len);
				}
				if (isRawTomlError(defect)) {
					return TomlModificationError.make({ diagnostic: TomlDiagnostic.fromRaw(text, defect.diagnostic) });
				}
				if (isGuardExceeded(defect)) {
					return failWith("NestingDepthExceeded", defect.message, defect.offset);
				}
				throw defect;
			},
		});
		return raw.map((edit) =>
			TomlEdit.make({ offset: edit.offset, length: edit.length, content: edit.newText }),
		);
	});

	/**
	 * Modify `text` and apply the resulting edits in one step
	 * (`TomlEdit.applyAll ∘ modify`).
	 *
	 * @param text - The TOML source to modify.
	 * @param path - The location to set, replace or delete.
	 * @param value - The plain JavaScript value to write; `undefined` deletes the
	 *   target instead.
	 * @param options - Optional {@link TomlFormattingOptions}.
	 * @returns An `Effect` that succeeds with the modified text, or fails with
	 *   {@link TomlParseError} or {@link TomlModificationError}, as
	 *   {@link TomlFormat.modify} does.
	 */
	static readonly modifyToString = Effect.fn("TomlFormat.modifyToString")(function* (
		text: string,
		path: TomlPath,
		value: unknown,
		options?: TomlFormattingOptions,
	) {
		const edits = yield* TomlFormat.modify(text, path, value, options);
		return TomlEdit.applyAll(text, edits);
	});
}
