// The git-config engine: a lossless, line-oriented scanner producing raw
// structural records over the source text, plus the splice-based edit
// primitives the facade compiles surgical edits into.
//
// Never exported from the package. This module emits raw carriers (plain
// records with offsets) and never imports the public `GitConfig` classes — the
// facade materializes typed errors and Schema classes from what it finds here.
//
// The grammar is git-config (git-config(5)), NOT generic INI:
//
// - `[section]` and `[section "subsection"]` headers; section and variable
//   names are case-insensitive, quoted subsection names are case-SENSITIVE.
// - The deprecated dotted form `[section.subsection]` splits at the FIRST
//   dot and compares its subsection case-insensitively (git lowercases it).
// - Variable names start with a letter and contain letters, digits and `-`.
// - A bare `key` line (no `=`) is git's boolean-true shorthand.
// - Values: unquoted trailing whitespace is discarded, internal whitespace
//   kept verbatim; `"` toggles quoting; `\"`, `\\`, `\n`, `\t`, `\b` are the
//   recognized escapes; a backslash at end of line continues the value onto
//   the next line; `#` and `;` start a comment outside quotes.

/** The diagnostic vocabulary the scanner can emit. */
export type RawDiagnosticCode =
	| "invalidSectionHeader"
	| "invalidKey"
	| "invalidLine"
	| "unterminatedQuote"
	| "invalidEscape"
	| "unexpectedCharacter";

/** One raw scanner diagnostic, positions in character offsets. */
export interface RawDiagnostic {
	readonly code: RawDiagnosticCode;
	readonly message: string;
	readonly offset: number;
	readonly length: number;
}

/** One raw variable line (possibly continued across lines). */
export interface RawEntry {
	/** The variable name, raw spelling preserved. */
	readonly key: string;
	/** The decoded value; `undefined` for the bare boolean-true shorthand. */
	readonly value: string | undefined;
	/** Offset of the entry's line start (including leading whitespace). */
	readonly offset: number;
	/** Length through the final line's newline (for whole-line removal). */
	readonly length: number;
	/** Offset just past the key text (where ` = value` inserts for a bare key). */
	readonly keyEnd: number;
	/** Offset of the raw value region's first character; `-1` for a bare key. */
	readonly valueOffset: number;
	/** Length of the raw value region (excludes trailing comment and unquoted trailing whitespace). */
	readonly valueLength: number;
}

/** One raw section: header spans plus the entries scanned under it. */
export interface RawSection {
	/** The section name, raw spelling preserved (dotted form already split). */
	readonly name: string;
	/** The decoded subsection name, when present. */
	readonly subsection: string | undefined;
	/** True when the subsection came from the deprecated dotted form and compares case-insensitively. */
	readonly fold: boolean;
	/** Offset of the header's line start. */
	readonly offset: number;
	/** Offset of the `[`. */
	readonly bracketOffset: number;
	/** Length of `[...]` inclusive. */
	readonly bracketLength: number;
	/** Offset just past the header line's newline — where the section body starts. */
	readonly bodyStart: number;
	/** Where the section's span ends: the next header's line start, or text end. */
	readonly contentEnd: number;
	readonly entries: ReadonlyArray<RawEntry>;
}

/** The scanner's result: sections in order plus every diagnostic found. */
export interface RawParse {
	readonly sections: ReadonlyArray<RawSection>;
	readonly diagnostics: ReadonlyArray<RawDiagnostic>;
}

interface MutableSection {
	name: string;
	subsection: string | undefined;
	fold: boolean;
	offset: number;
	bracketOffset: number;
	bracketLength: number;
	bodyStart: number;
	contentEnd: number;
	entries: Array<RawEntry>;
}

const isWs = (ch: string | undefined): boolean => ch === " " || ch === "\t";
const isNameChar = (ch: string): boolean => /[A-Za-z0-9.-]/.test(ch);
const isKeyChar = (ch: string): boolean => /[A-Za-z0-9-]/.test(ch);

/** git variable names: a letter, then letters/digits/`-`. */
export const isValidKey = (key: string): boolean => /^[A-Za-z][A-Za-z0-9-]*$/.test(key);

/** git section names: letters, digits, `-` and `.`. */
export const isValidSectionName = (name: string): boolean => /^[A-Za-z0-9.-]+$/.test(name);

/** Advances past the current line's newline (handles `\r\n`, `\n` and EOF). */
const skipToLineEnd = (text: string, from: number): number => {
	let i = from;
	while (i < text.length && text[i] !== "\n") i += 1;
	return i < text.length ? i + 1 : i;
};

/**
 * Scans a git-config document into raw sections/entries/diagnostics. Never
 * throws; every malformed shape lands in `diagnostics` (the facade turns a
 * non-empty array into the typed parse error).
 */
export const scan = (text: string): RawParse => {
	const diagnostics: Array<RawDiagnostic> = [];
	const sections: Array<MutableSection> = [];
	const nul = text.indexOf("\0");
	if (nul >= 0) {
		diagnostics.push({
			code: "unexpectedCharacter",
			message: "NUL byte in git-config text",
			offset: nul,
			length: 1,
		});
		return { sections: [], diagnostics };
	}
	let offset = 0;
	const len = text.length;

	const closeSection = (end: number): void => {
		const current = sections[sections.length - 1];
		if (current !== undefined && current.contentEnd === -1) current.contentEnd = end;
	};

	while (offset < len) {
		const lineStart = offset;
		let i = offset;
		while (isWs(text[i])) i += 1;
		const ch = text[i];
		if (i >= len || ch === "\n" || ch === "\r" || ch === "#" || ch === ";") {
			offset = skipToLineEnd(text, i);
			continue;
		}
		if (ch === "[") {
			const header = scanHeader(text, lineStart, i, diagnostics);
			offset = header.next;
			if (header.section !== undefined) {
				closeSection(lineStart);
				sections.push({ ...header.section, bodyStart: header.next, contentEnd: -1, entries: [] });
			}
			continue;
		}
		const entryResult = scanEntry(text, lineStart, i, diagnostics);
		offset = entryResult.next;
		if (entryResult.entry !== undefined) {
			const current = sections[sections.length - 1];
			if (current === undefined) {
				diagnostics.push({
					code: "invalidLine",
					message: `variable "${entryResult.entry.key}" appears before any section header`,
					offset: lineStart,
					length: entryResult.next - lineStart,
				});
			} else {
				current.entries.push(entryResult.entry);
			}
		}
	}
	closeSection(len);
	return { sections, diagnostics };
};

interface HeaderScan {
	readonly section: Omit<MutableSection, "bodyStart" | "contentEnd" | "entries"> | undefined;
	readonly next: number;
}

const scanHeader = (
	text: string,
	lineStart: number,
	bracketOffset: number,
	diagnostics: Array<RawDiagnostic>,
): HeaderScan => {
	const len = text.length;
	let i = bracketOffset + 1;
	const nameStart = i;
	while (i < len && isNameChar(text[i] as string)) i += 1;
	let name = text.slice(nameStart, i);
	const fail = (message: string): HeaderScan => {
		const next = skipToLineEnd(text, i);
		diagnostics.push({ code: "invalidSectionHeader", message, offset: lineStart, length: next - lineStart });
		return { section: undefined, next };
	};
	if (name === "") return fail("section header has no name");
	while (isWs(text[i])) i += 1;
	let subsection: string | undefined;
	let quoted = false;
	if (text[i] === '"') {
		quoted = true;
		i += 1;
		let value = "";
		let closed = false;
		while (i < len) {
			const ch = text[i] as string;
			if (ch === "\n" || ch === "\r") break;
			if (ch === '"') {
				closed = true;
				i += 1;
				break;
			}
			if (ch === "\\") {
				// In a subsection name a backslash escapes ANY next character
				// (git drops the backslash and keeps the character).
				const next = text[i + 1];
				if (next === undefined || next === "\n" || next === "\r") break;
				value += next;
				i += 2;
				continue;
			}
			value += ch;
			i += 1;
		}
		if (!closed) {
			const next = skipToLineEnd(text, i);
			diagnostics.push({
				code: "unterminatedQuote",
				message: "unterminated subsection name",
				offset: lineStart,
				length: next - lineStart,
			});
			return { section: undefined, next };
		}
		subsection = value;
		while (isWs(text[i])) i += 1;
	}
	if (text[i] !== "]") return fail("expected ']' to close the section header");
	const bracketLength = i - bracketOffset + 1;
	i += 1;
	while (isWs(text[i])) i += 1;
	const trailing = text[i];
	if (i < len && trailing !== "\n" && trailing !== "\r" && trailing !== "#" && trailing !== ";") {
		return fail("unexpected text after the section header");
	}
	let fold = false;
	if (!quoted && name.includes(".")) {
		// The deprecated [section.subsection] form: split at the FIRST dot;
		// this form's subsection compares case-insensitively (git lowercases it).
		const dot = name.indexOf(".");
		subsection = name.slice(dot + 1);
		name = name.slice(0, dot);
		fold = true;
		if (name === "" || subsection === "") return fail("malformed dotted section header");
	}
	return {
		section: { name, subsection, fold, offset: lineStart, bracketOffset, bracketLength },
		next: skipToLineEnd(text, i),
	};
};

interface EntryScan {
	readonly entry: RawEntry | undefined;
	readonly next: number;
}

const scanEntry = (text: string, lineStart: number, keyStart: number, diagnostics: Array<RawDiagnostic>): EntryScan => {
	const len = text.length;
	let i = keyStart;
	if (!/[A-Za-z]/.test(text[i] as string)) {
		const next = skipToLineEnd(text, i);
		diagnostics.push({
			code: "invalidKey",
			message: "variable names must start with a letter",
			offset: lineStart,
			length: next - lineStart,
		});
		return { entry: undefined, next };
	}
	while (i < len && isKeyChar(text[i] as string)) i += 1;
	const key = text.slice(keyStart, i);
	const keyEnd = i;
	while (isWs(text[i])) i += 1;
	const after = text[i];
	if (i >= len || after === "\n" || after === "\r" || after === "#" || after === ";") {
		// Bare `key` — git's boolean-true shorthand.
		const next = skipToLineEnd(text, i);
		return {
			entry: {
				key,
				value: undefined,
				offset: lineStart,
				length: next - lineStart,
				keyEnd,
				valueOffset: -1,
				valueLength: 0,
			},
			next,
		};
	}
	if (after !== "=") {
		const next = skipToLineEnd(text, i);
		diagnostics.push({
			code: "invalidLine",
			message: `unexpected character ${JSON.stringify(after)} after variable name "${key}"`,
			offset: lineStart,
			length: next - lineStart,
		});
		return { entry: undefined, next };
	}
	i += 1;
	while (isWs(text[i])) i += 1;
	const valueOffset = i;
	let decoded = "";
	// The decoded length and raw end of the last SIGNIFICANT character —
	// unquoted trailing whitespace is discarded by slicing back to these.
	let significantDecoded = 0;
	let significantEnd = valueOffset - 1;
	let inQuotes = false;
	while (i < len) {
		const ch = text[i] as string;
		if (ch === "\n") break;
		if (ch === "\r" && text[i + 1] === "\n") break;
		if (ch === "\\") {
			const next = text[i + 1];
			if (next === "\n") {
				// Line continuation: the backslash and newline are both dropped.
				i += 2;
				continue;
			}
			if (next === "\r" && text[i + 2] === "\n") {
				i += 3;
				continue;
			}
			const mapped =
				next === "n"
					? "\n"
					: next === "t"
						? "\t"
						: next === "b"
							? "\b"
							: next === '"'
								? '"'
								: next === "\\"
									? "\\"
									: undefined;
			if (mapped === undefined) {
				diagnostics.push({
					code: "invalidEscape",
					message: `invalid escape sequence \\${next ?? ""} in value of "${key}"`,
					offset: i,
					length: 2,
				});
				i += 2;
				continue;
			}
			decoded += mapped;
			i += 2;
			significantDecoded = decoded.length;
			significantEnd = i - 1;
			continue;
		}
		if (ch === '"') {
			inQuotes = !inQuotes;
			i += 1;
			significantDecoded = decoded.length;
			significantEnd = i - 1;
			continue;
		}
		if (!inQuotes && (ch === "#" || ch === ";")) {
			// Trailing comment: the value ended at the last significant character.
			break;
		}
		decoded += ch;
		i += 1;
		if (inQuotes || !isWs(ch)) {
			significantDecoded = decoded.length;
			significantEnd = i - 1;
		}
	}
	if (inQuotes) {
		diagnostics.push({
			code: "unterminatedQuote",
			message: `unterminated quoted value of "${key}"`,
			offset: valueOffset,
			length: Math.max(1, i - valueOffset),
		});
	}
	const next = skipToLineEnd(text, i);
	return {
		entry: {
			key,
			value: decoded.slice(0, significantDecoded),
			offset: lineStart,
			length: next - lineStart,
			keyEnd,
			valueOffset,
			valueLength: significantEnd >= valueOffset ? significantEnd - valueOffset + 1 : 0,
		},
		next,
	};
};

/** Does `section` match the (name, subsection) address under git's case rules? */
export const matchesSection = (section: RawSection, name: string, subsection: string | undefined): boolean => {
	if (section.name.toLowerCase() !== name.toLowerCase()) return false;
	if (subsection === undefined) return section.subsection === undefined;
	if (section.subsection === undefined) return false;
	return section.fold
		? section.subsection.toLowerCase() === subsection.toLowerCase()
		: section.subsection === subsection;
};

/** Does `entry` carry `key` (variable names compare case-insensitively)? */
export const matchesKey = (entry: RawEntry, key: string): boolean => entry.key.toLowerCase() === key.toLowerCase();

/**
 * Serializes a value for insertion into a config line: quoted and escaped
 * exactly when git's grammar demands it, verbatim otherwise.
 */
export const serializeValue = (value: string): string => {
	const needsQuoting = value === "" || value !== value.trim() || /["\\\n\t\b#;]/.test(value);
	if (!needsQuoting) return value;
	const escaped = value
		.replaceAll("\\", "\\\\")
		.replaceAll('"', '\\"')
		.replaceAll("\n", "\\n")
		.replaceAll("\t", "\\t")
		.replaceAll("\b", "\\b");
	return `"${escaped}"`;
};

/** Serializes a section header. The subsection is quoted-and-escaped when present. */
export const serializeHeader = (name: string, subsection: string | undefined): string =>
	subsection === undefined ? `[${name}]` : `[${name} "${subsection.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`;

/** One text splice: replace `length` characters at `offset` with `content`. */
export interface Splice {
	readonly offset: number;
	readonly length: number;
	readonly content: string;
}

/** Applies a single splice to the text. */
export const applySplice = (text: string, splice: Splice): string =>
	text.slice(0, splice.offset) + splice.content + text.slice(splice.offset + splice.length);

/** The indentation to use for a new entry in `section`: its first entry's, else a tab. */
export const sectionIndent = (text: string, section: RawSection): string => {
	const first = section.entries[0];
	if (first === undefined) return "\t";
	let end = first.offset;
	while (isWs(text[end])) end += 1;
	return text.slice(first.offset, end);
};

/** Where a new entry line inserts in `section`: after its last entry, else right after the header line. */
export const sectionInsertOffset = (section: RawSection): number => {
	const last = section.entries[section.entries.length - 1];
	return last === undefined ? section.bodyStart : last.offset + last.length;
};
