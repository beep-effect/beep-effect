/**
 * Conservative TOML formatting and path-based modification as non-mutating
 * text splices computed against the linear CST.
 *
 * **Details**
 *
 * Format is syntactic and structural — every edit derives from an expression
 * or value span, never from naive line splitting, so a byte inside a
 * multi-line string is untouchable by construction. Modify resolves its path
 * through the semantic view and pins the insertion-placement rules: root
 * inserts land after the last root expression (before the first header),
 * section inserts after the section's last non-trivia expression, dotted
 * tables render as dotted keys appended to their defining section, and inline
 * or implicit tables refuse with a typed error. Cycle firewall: the engine
 * throws raw carriers (`RawTomlError`, `GuardExceeded`); this module
 * materializes {@link TomlDiagnostic} instances and the tagged
 * {@link TomlModificationError}. The dependency edge runs facade → engine
 * only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import {Effect, Schema} from "effect";
import type {TomlErrorCodeRaw} from "./internal/diagnostics.ts";
import {isRawTomlError} from "./internal/diagnostics.ts";
import {isGuardExceeded, MAX_NESTING_DEPTH} from "./internal/limits.ts";
import {parseExpressions} from "./internal/parser.ts";
import {analyze} from "./internal/semantic.ts";
import {renderInlineValue, renderKey} from "./internal/stringifyValue.ts";
import {TomlDiagnostic} from "./TomlDiagnostic.ts";
import {TomlDocument} from "./TomlDocument.ts";
import type {TomlPath, TomlRange, TomlSegment} from "./TomlEdit.ts";
import {TomlEdit} from "./TomlEdit.ts";
import type {
  TomlExpression,
  TomlInlineEntry,
  TomlValueNode
} from "./TomlNode.ts";
import {
  TomlArray,
  TomlArrayTableHeader,
  TomlInlineTable,
  TomlKeyValue,
  TomlString,
  TomlTableHeader,
  TomlTrivia,
} from "./TomlNode.ts";

const $I = $ScratchpadId.create("toml/TomlFormat");

/**
 * A range accepted at the `format`/`formatToString` call sites: either a
 * {@link TomlRange} instance or a plain `{ offset, length }` literal (the two
 * are structurally interchangeable — only `offset`/`length` are read).
 *
 * @see {@link TomlRange} for the schema-backed range class.
 * @see {@link TomlFormat.format} for the call site that accepts this union.
 * @category type-level
 * @since 0.0.0
 */
export type TomlRangeLike = TomlRange | { readonly offset: number; readonly length: number };

/**
 * Options controlling formatting and modification behavior. The only knob is
 * `newline`: for `format` it normalizes every newline outside multi-line
 * strings; for `modify` it overrides the dominant newline inherited by
 * inserted lines.
 *
 * **Example** (Normalize newlines to CRLF)
 *
 * ```ts
 * import { TomlFormat, TomlFormattingOptions } from "@beep/scratchpad/toml"
 *
 * const options = TomlFormattingOptions.make({ newline: "\r\n" })
 * const formatted = TomlFormat.formatToString('name = "Alice"\n', undefined, options)
 * console.log(formatted) // "name = \"Alice\"\r\n"
 * ```
 *
 * @see {@link TomlFormat.format} for the syntactic formatter that consumes these options.
 * @category configuration
 * @since 0.0.0
 */
export class TomlFormattingOptions extends Schema.Class<TomlFormattingOptions>($I`TomlFormattingOptions`)(
	{
		newline: Schema.optionalKey(Schema.Literals(["\n", "\r\n"])),
	},
	$I.annote("TomlFormattingOptions", {
		description: "Formatting and modification options whose only knob is newline.",
	}),
) {}

/**
 * Raised when `TomlFormat.modify` cannot resolve the requested path against
 * the document's semantic view, when the insertion target refuses (an inline
 * table or an implicitly created table), or when the replacement value
 * cannot render as TOML. Carries one structured {@link TomlDiagnostic} —
 * never a collapsed `reason` string.
 *
 * **Example** (Fail an empty path)
 *
 * ```ts
 * import { Effect, Result } from "effect"
 * import { TomlFormat } from "@beep/scratchpad/toml"
 *
 * const outcome = Effect.runSync(Effect.result(TomlFormat.modify('name = "Alice"\n', [], "Bob")))
 * console.log(Result.isFailure(outcome) && outcome.failure._tag) // "TomlModificationError"
 * console.log(Result.isFailure(outcome) && outcome.failure.diagnostic.code) // "DottedKeyConflict"
 * ```
 *
 * @see {@link TomlParseError} for syntax failures raised before modification is attempted.
 * @see {@link TomlFormat.modify} for the entry point that raises this error.
 * @category errors
 * @since 0.0.0
 */
export class TomlModificationError extends Schema.TaggedError<TomlModificationError>($I`TomlModificationError`)(
	"TomlModificationError",
	{
		diagnostic: TomlDiagnostic,
	},
	$I.annote("TomlModificationError", {
		description: "Tagged modification failure carrying one TomlDiagnostic for path or insertion-target errors.",
	}),
) {
	/** @internal */
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
	if (node instanceof TomlString) {
		if (node.style === "multiline-basic" || node.style === "multiline-literal") {
			out.push([node.offset, node.offset + node.length]);
		}
		return;
	}
	if (node instanceof TomlArray) {
		for (const item of node.items) {
			collectMultilineSpans(item, out);
		}
		return;
	}
	if (node instanceof TomlInlineTable) {
		for (const entry of node.entries) {
			collectMultilineSpans(entry.value, out);
		}
	}
};

/** Accumulates format edits for one document; drops no-op splices to keep format idempotent. */
class FormatEmitter {
	readonly edits: Array<TaggedEdit> = [];
  private readonly source: string
	constructor(source: string) {
    this.source = source
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
  let nlStart = expr.offset + expr.length;
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
		while (p < protectedSpans.length && protectedSpans[p][1] <= i) {
			p++;
		}
		if (p < protectedSpans.length && i >= protectedSpans[p][0]) {
			i = protectedSpans[p][1];
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
	const bracket = scanWs(source, lastKey.offset + lastKey.length, expr.offset + expr.length);
	return bracket + (expr instanceof TomlArrayTableHeader ? 2 : 1);
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
		if (expr instanceof TomlTrivia) {
			formatTrivia(source, emit, expr);
		} else if (expr instanceof TomlKeyValue) {
			formatLeading(source, emit, expr);
			const lastKey = expr.keyPath[expr.keyPath.length - 1];
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
	readonly entries: Map<string, ResNode>;
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
	entries: new Map(),
	sectionIndex,
	relPath,
});

/** Descend into a navigable node: tables pass through, array-of-tables yield their last element. */
const intoTable = (node: ResNode | undefined): ResTable => {
	if (node !== undefined && node.kind === "array-tables") {
		return node.elements[node.elements.length - 1];
	}
	if (node !== undefined && node.kind === "table") {
		return node;
	}
	// The semantic pass already validated every navigation; reaching a value here is an invariant violation.
	throw new Error("invariant: semantic pass admitted a value where a table was navigated");
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
		if (expr instanceof TomlTableHeader || expr instanceof TomlArrayTableHeader) {
			sections.push({ header: expr, insertAfter: expr.offset + expr.length });
		} else if (!(expr instanceof TomlTrivia)) {
			sections[sections.length - 1].insertAfter = expr.offset + expr.length;
		}
	}
	const root = mkTable("root");
	let sectionCounter = 0;
	const navigateHeaderPrefix = (path: ReadonlyArray<string>): ResTable => {
		let current = root;
		for (let i = 0; i < path.length - 1; i++) {
			let child = current.entries.get(path[i]);
			if (child === undefined) {
				child = mkTable("implicit");
				current.entries.set(path[i], child);
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
			const existing = parent.entries.get(name);
			if (existing !== undefined && existing.kind === "table") {
				existing.origin = "explicit";
				existing.sectionIndex = sectionCounter;
			} else {
				parent.entries.set(name, mkTable("explicit", sectionCounter));
			}
		},
		onArrayTableStart: (path, _index, _header) => {
			sectionCounter += 1;
			const parent = navigateHeaderPrefix(path);
			const name = path[path.length - 1];
			const existing = parent.entries.get(name);
			if (existing !== undefined && existing.kind === "array-tables") {
				existing.elements.push(mkTable("element", sectionCounter));
			} else {
				parent.entries.set(name, { kind: "array-tables", elements: [mkTable("element", sectionCounter)] });
			}
		},
		onKeyValue: (path, expr) => {
			const names = expr.keyPath.map((key) => key.value);
			let current = root;
			for (let i = 0; i < path.length - names.length; i++) {
				current = intoTable(current.entries.get(path[i]));
			}
			for (let j = 0; j < names.length - 1; j++) {
				let child = current.entries.get(names[j]);
				if (child === undefined) {
					child = mkTable("dotted", sectionCounter, names.slice(0, j + 1));
					current.entries.set(names[j], child);
				}
				current = intoTable(child);
			}
			current.entries.set(names[names.length - 1], { kind: "value", node: expr.value, expr });
		},
	});
	return { root, sections };
};

// ── Internal: modify — path resolution ──────────────────────────────────────

/** Thrown by the pure resolution helpers; `modify` materializes {@link TomlModificationError}. */
class ModifyFailure extends Error {
  readonly code: TomlErrorCodeRaw
  readonly offset: number
  readonly len: number
	constructor(
		code: TomlErrorCodeRaw,
		message: string,
		offset: number,
		len: number,
	) {
		super(message);
		this.name = "ModifyFailure";
    this.code = code
    this.offset = offset
    this.len = len
	}
}

const failResolve = (code: TomlErrorCodeRaw, message: string, offset = 0, length = 0): never => {
	throw new ModifyFailure(code, message, offset, length);
};

const requireIndex = (segment: TomlSegment, what: string, offset: number, length: number): number => {
	if (typeof segment !== "number" || !Number.isInteger(segment) || segment < 0) {
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
	node instanceof TomlInlineTable
		? { t: "inline", table: node, candidates: node.entries.map((entry, index) => ({ entry, index })), depth: 0 }
		: { t: "cst", node, del };

const stepInline = (
	cur: Extract<Cursor, { t: "inline" }>,
	key: string,
): { readonly matches: ReadonlyArray<Candidate>; readonly full: Candidate | undefined } => {
	const matches = cur.candidates.filter((candidate) => candidate.entry.keyPath[cur.depth].value === key);
	const full = matches.length === 1 && matches[0].entry.keyPath.length === cur.depth + 1 ? matches[0] : undefined;
	return { matches, full };
};

/** One navigation step (never the terminal segment). */
const step = (cur: Cursor, segment: TomlSegment): Cursor => {
	if (cur.t === "table") {
		const key = String(segment);
		const child = cur.table.entries.get(key);
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
		return { t: "table", table: cur.node.elements[idx] };
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
	if (node instanceof TomlArray) {
		const idx = requireIndex(segment, "an array", node.offset, node.length);
		if (idx >= node.items.length) {
			return failResolve("DottedKeyConflict", `array index ${idx} is out of bounds`, node.offset, node.length);
		}
		return cstCursor(node.items[idx], { kind: "array-item", array: node, index: idx });
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
	if (index < items.length - 1) {
		return { offset: items[index].offset, length: items[index + 1].offset - items[index].offset, newText: "" };
	}
	const prevEnd = items[index - 1].offset + items[index - 1].length;
	return { offset: prevEnd, length: items[index].offset + items[index].length - prevEnd, newText: "" };
};

/** Delete one inline-table entry with the same separator-splicing rule. */
const spliceInlineEntry = (table: TomlInlineTable, index: number): RawEdit => {
	const entries = table.entries;
	if (entries.length === 1) {
		return { offset: table.offset + 1, length: table.length - 2, newText: "" };
	}
	if (index < entries.length - 1) {
		return { offset: entries[index].offset, length: entries[index + 1].offset - entries[index].offset, newText: "" };
	}
	const prevEnd = entries[index - 1].offset + entries[index - 1].length;
	return { offset: prevEnd, length: entries[index].offset + entries[index].length - prevEnd, newText: "" };
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
		const firstHeader = ctx.sections.length > 1 ? ctx.sections[1].header : undefined;
		offset = ctx.sections[0].insertAfter ?? firstHeader?.offset ?? 0;
	} else {
		const section = ctx.sections[table.sectionIndex];
		offset = section.insertAfter ?? 0;
	}
	const needLeading = offset > 0 && ctx.source.charCodeAt(offset - 1) !== LF;
	return { offset, length: 0, newText: `${needLeading ? ctx.nl : ""}${line}${ctx.nl}` };
};

/** Resolve the final segment against the parent cursor and produce the terminal edits. */
const terminal = (cur: Cursor, segment: TomlSegment, value: unknown, ctx: ModifyContext): Array<RawEdit> => {
	if (cur.t === "table") {
		const key = String(segment);
		const existing = cur.table.entries.get(key);
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
	if (node instanceof TomlArray) {
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
		return [{ offset: node.items[idx].offset, length: node.items[idx].length, newText: renderInlineValue(value) }];
	}
	return failResolve("DottedKeyConflict", "cannot address a key beneath a scalar value", node.offset, node.length);
};

// ── Facade ──────────────────────────────────────────────────────────────────

/**
 * Conservative, span-preserving TOML formatting and path-based modification.
 * Both operations compute non-mutating CST splices: `format` is total
 * (malformed input yields no edits), and `modify` fails typed without
 * auto-creating tables or appending array elements.
 *
 * **Gotchas**
 *
 * `format`/`formatToString` are pure and total: malformed input yields no
 * edits rather than corrupting the document, so an empty edit list is not
 * proof the source was already formatted. Bytes inside multi-line strings are
 * untouchable by construction. `modify` never auto-creates intermediate
 * tables, never appends array elements, and fails typed on an empty path or a
 * path deeper than `MAX_NESTING_DEPTH`. Semantic diagnostics on the document
 * become {@link TomlModificationError}; unparseable source becomes
 * {@link TomlParseError}.
 *
 * **Example** (Format a compacted pair)
 *
 * ```ts
 * import { TomlFormat } from "@beep/scratchpad/toml"
 *
 * const formatted = TomlFormat.formatToString('name="Alice"')
 * console.log(formatted) // 'name = "Alice"\n'
 * console.log(TomlFormat.format("not = = toml").length) // 0
 * ```
 *
 * **Example** (Replace a value at a path)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { TomlFormat } from "@beep/scratchpad/toml"
 *
 * const updated = Effect.runSync(TomlFormat.modifyToString('name = "Alice"\n', ["name"], "Bob"))
 * console.log(updated.includes("Bob")) // true
 * ```
 *
 * @see {@link TomlEdit.applyAll} to apply the edits `format`/`modify` compute.
 * @see {@link TomlDocument.parse} for the lossless parse `modify` rides on.
 * @see {@link TomlParseError} for syntax failures from `modify`.
 * @see {@link TomlModificationError} for path-resolution and insertion-target failures.
 * @category formatting
 * @since 0.0.0
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
	 * {@link TomlFormat.formatToString}).
	 *
	 * **Example** (Emit a spacing edit)
	 *
	 * ```ts
	 * import { TomlFormat } from "@beep/scratchpad/toml"
	 *
	 * const edits = TomlFormat.format('name="Alice"')
	 * console.log(edits.length > 0) // true
	 * console.log(TomlFormat.format("not = = toml")) // []
	 * ```
	 *
	 * @see {@link TomlEdit.applyAll} to apply the returned splices.
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
	 * **Example** (Normalize compacted assignment)
	 *
	 * ```ts
	 * import { TomlFormat } from "@beep/scratchpad/toml"
	 *
	 * console.log(TomlFormat.formatToString('name="Alice"')) // 'name = "Alice"\n'
	 * ```
	 *
	 * @see {@link TomlFormat.format} for the non-applying edit list.
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
	 * **Gotchas**
	 *
	 * Malformed source fails with {@link TomlParseError}. Path-resolution,
	 * empty-path, depth-cap, and insertion-target failures fail with
	 * {@link TomlModificationError}. Modify never creates `[table]` headers
	 * for missing intermediates and never appends array elements.
	 *
	 * @see {@link TomlFormat.format} for the total syntactic formatter.
	 * @see {@link TomlModificationError} for path and insertion-target failures.
	 */
	static readonly modify = Effect.fn("TomlFormat.modify")(function* (
		text: string,
		path: TomlPath,
		value: unknown,
		options?: TomlFormattingOptions,
	) {
		const failWith = (code: TomlErrorCodeRaw, message: string, offset = 0, length = 0): TomlModificationError =>
			new TomlModificationError({ diagnostic: TomlDiagnostic.fromRaw(text, { code, message, offset, length }) });
		if (path.length === 0) {
			return yield* failWith("DottedKeyConflict", "an empty path does not address a value");
		}
		if (path.length > MAX_NESTING_DEPTH) {
			return yield* failWith("NestingDepthExceeded", `path depth ${path.length} exceeds the ${MAX_NESTING_DEPTH} cap`);
		}
		const doc = yield* TomlDocument.parse(text);
		if (doc.diagnostics.length > 0) {
			return yield* new TomlModificationError({ diagnostic: doc.diagnostics[0] });
		}
		const { root, sections } = buildSemanticIndex(doc.expressions);
		const ctx: ModifyContext = { source: text, sections, nl: options?.newline ?? dominantNewline(text) };
		let raw: Array<RawEdit>;
		try {
			let cursor: Cursor = { t: "table", table: root };
			for (let i = 0; i < path.length - 1; i++) {
				cursor = step(cursor, path[i]);
			}
			raw = terminal(cursor, path[path.length - 1], value, ctx);
		} catch (defect) {
			if (defect instanceof ModifyFailure) {
				return yield* failWith(defect.code, defect.message, defect.offset, defect.len);
			}
			if (isRawTomlError(defect)) {
				return yield* new TomlModificationError({ diagnostic: TomlDiagnostic.fromRaw(text, defect.diagnostic) });
			}
			if (isGuardExceeded(defect)) {
				return yield* failWith("NestingDepthExceeded", defect.message, defect.offset);
			}
			throw defect;
		}
		return raw.map((edit) =>
			TomlEdit.make({ offset: edit.offset, length: edit.length, content: edit.newText }),
		) as ReadonlyArray<TomlEdit>;
	});

	/**
	 * Modify `text` and apply the resulting edits in one step
	 * (`TomlEdit.applyAll ∘ modify`).
	 *
	 * @see {@link TomlFormat.modify} for the non-applying edit list.
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
