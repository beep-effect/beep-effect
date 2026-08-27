// YAML 1.2 lexer — tokenizes raw YAML text into YamlToken records.
//
// This is the only mutable module in the pipeline: the scanner uses
// imperative character-by-character scanning with position tracking.
// `createScanner` IS the state machine; `lexAll` drives it to completion.

import type { YamlToken, YamlTokenKind } from "./token.ts";

// ---------------------------------------------------------------------------
// Scanner (mutable, imperative)
// ---------------------------------------------------------------------------

/**
 * A stateful YAML scanner that produces tokens one at a time.
 *
 * Provides a pull-based accessor API: call {@link YamlScanner.scan} to advance
 * to the next token, then use the `getToken*` methods to inspect the current
 * token without advancing again.
 */
export interface YamlScanner {
	/** Advance to the next token and return its kind, or `null` at end-of-input. */
	scan(): YamlTokenKind | null;
	/** Return the kind of the current token without advancing, or `null` before any scan. */
	getToken(): YamlTokenKind | null;
	/** Return the value string of the current token. */
	getTokenValue(): string;
	/** Return the zero-based character offset of the current token start. */
	getTokenOffset(): number;
	/** Return the character length of the current token span. */
	getTokenLength(): number;
	/** Return the zero-based line number of the current token start. */
	getTokenLine(): number;
	/** Return the zero-based column of the current token start. */
	getTokenColumn(): number;
	/** Return the current scanner position (next character to be scanned). */
	getPosition(): number;
	/**
	 * Reset the scanner to the given character offset and rescan from there.
	 *
	 * All block-structure state (indentation, flow depth, pending tokens) is
	 * reset. For reliable results, pass an offset previously returned by
	 * {@link YamlScanner.getTokenOffset} rather than an arbitrary mid-token
	 * position.
	 */
	setPosition(pos: number): void;
}

/**
 * Create a new YAML scanner for the given source text.
 *
 * Returns a stateful, pull-based scanner. Call {@link YamlScanner.scan} to
 * advance to the next token, then use `getToken*` methods to inspect it.
 */
export function createScanner(text: string): YamlScanner {
	let pos = 0;
	let line = 0;
	let col = 0;
	/**
	 * The indentation level of the current line. Set to `col` when we encounter
	 * the first non-whitespace character after a newline (or at start of input).
	 */
	let lineIndent = 0;
	/** Whether `lineIndent` has been locked (set) for the current line. */
	let lineIndentLocked = false;
	/** Flow nesting depth (positive means we are inside flow context). */
	let flowDepth = 0;
	/** Whether we've emitted block-map-start / block-seq-start for the current indent. */
	const blockStarted: Map<number, "map" | "seq"> = new Map();
	/** Set when the block scalar scanner produces an empty value (contentIndent === 0). */
	let afterEmptyBlockScalar = false;
	/** Set when the previous token was a quoted scalar (single or double quoted). */
	let afterQuotedScalar = false;
	let afterFlowCollectionEnd = false;
	/** Buffer of tokens to emit before scanning the next real token. */
	const pending: YamlToken[] = [];
	/** Mutable holder for the most recently produced token, set by the public {@link scan} method. */
	const state = { currentToken: null as YamlToken | null };

	// -----------------------------------------------------------------------
	// Helpers
	// -----------------------------------------------------------------------

	function peek(offset = 0): string {
		const idx = pos + offset;
		return idx < text.length ? (text[idx] ?? "") : "";
	}

	function charAt(i: number): string {
		return i < text.length ? (text[i] ?? "") : "";
	}

	function advance(count = 1): void {
		for (let i = 0; i < count; i++) {
			if (pos < text.length) {
				if (text[pos] === "\n") {
					line++;
					col = 0;
					lineIndentLocked = false;
				} else {
					col++;
				}
				pos++;
			}
		}
	}

	/** Lock the line indent to the current column (called on first non-ws char). */
	function lockLineIndent(): void {
		if (!lineIndentLocked) {
			lineIndent = col;
			lineIndentLocked = true;
			// When dedenting, clear blockStarted entries for indentation levels
			// deeper than the current line. This allows the same indent level
			// to start a new block scope after returning from deeper nesting.
			for (const key of blockStarted.keys()) {
				if (key > lineIndent) {
					blockStarted.delete(key);
				}
			}
		}
	}

	function makeToken(
		kind: YamlTokenKind,
		value: string,
		offset: number,
		tokenLine: number,
		tokenCol: number,
		rawLength?: number,
	): YamlToken {
		return {
			kind,
			value,
			offset,
			length: rawLength ?? value.length,
			line: tokenLine,
			column: tokenCol,
		};
	}

	function isWhitespace(ch: string): boolean {
		return ch === " " || ch === "\t";
	}

	function isNewline(ch: string): boolean {
		return ch === "\n" || ch === "\r";
	}

	function isFlowIndicator(ch: string): boolean {
		return ch === "{" || ch === "}" || ch === "[" || ch === "]" || ch === ",";
	}

	/**
	 * Check if the current position starts a document marker (--- or ...)
	 * followed by whitespace, newline, or EOF. Used inside quoted scalars
	 * to detect unterminated strings broken by document boundaries.
	 */
	function isDocumentMarkerAhead(): boolean {
		const c0 = peek();
		const c1 = peek(1);
		const c2 = peek(2);
		const c3 = peek(3);
		if ((c0 === "-" && c1 === "-" && c2 === "-") || (c0 === "." && c1 === "." && c2 === ".")) {
			return c3 === "" || c3 === " " || c3 === "\t" || c3 === "\n" || c3 === "\r";
		}
		return false;
	}

	/**
	 * Returns true if `ch` cannot appear in a plain scalar at the current position.
	 */
	function isPlainScalarBreak(ch: string): boolean {
		if (ch === "" || isNewline(ch)) return true;
		return flowDepth > 0 && isFlowIndicator(ch);

	}

	// -----------------------------------------------------------------------
	// Block-structure helpers
	// -----------------------------------------------------------------------

	function ensureBlockMap(indent: number, offset: number, tokLine: number, _tokCol: number): void {
		if (flowDepth > 0) return;
		const started = blockStarted.get(indent);
		if (started === "map") return;
		if (started === "seq") {
			// switch from seq to map not supported in same indent; ignore
			return;
		}
		blockStarted.set(indent, "map");
		// Use `indent` (the line indent) as the column for the zero-width
		// block-map-start marker so the parser can correctly determine which
		// block scope this mapping belongs to.
		pending.push(makeToken("block-map-start", "", offset, tokLine, indent));
	}

	function ensureBlockSeq(indent: number, offset: number, tokLine: number, _tokCol: number): void {
		if (flowDepth > 0) return;
		const started = blockStarted.get(indent);
		if (started === "seq") return;
		blockStarted.set(indent, "seq");
		// Use `indent` as the column for consistency with ensureBlockMap.
		pending.push(makeToken("block-seq-start", "", offset, tokLine, indent));
	}

	// -----------------------------------------------------------------------
	// Scanning methods
	// -----------------------------------------------------------------------

	function scanNewline(): YamlToken {
		const start = pos;
		const sLine = line;
		const sCol = col;
		if (peek() === "\r" && peek(1) === "\n") {
			advance(2);
			return makeToken("newline", "\r\n", start, sLine, sCol);
		}
		const ch = peek();
		advance();
		return makeToken("newline", ch, start, sLine, sCol);
	}

	function scanWhitespace(): YamlToken {
		const start = pos;
		const sLine = line;
		const sCol = col;
		// YAML 1.2 §6.1: Tabs are not allowed as indentation characters.
		// Detect tabs in leading whitespace (before lineIndent is locked).
		if (!lineIndentLocked && peek() === "\t") {
			if (flowDepth === 0) {
				// Lookahead: is the rest of the line whitespace-only? (blank/separator line)
				let lookPos = pos;
				while (lookPos < text.length && (text[lookPos] === " " || text[lookPos] === "\t")) {
					lookPos++;
				}
				const nextCh = lookPos < text.length ? text[lookPos] : undefined;
				// Change 2: tab-only blank line → emit whitespace
				// Guard: if we just emitted an empty block scalar (e.g. "foo: |\n\t\n"),
				// the tab line could be intended as block scalar content with tab
				// indentation, which is invalid. Do not exempt it.
				if (!afterEmptyBlockScalar && (nextCh === undefined || nextCh === "\n" || nextCh === "\r")) {
					while (pos < text.length && isWhitespace(peek())) {
						advance();
					}
					return makeToken("whitespace", text.slice(start, pos), start, sLine, sCol);
				}
				// Change 3: tab before flow-opening indicator → emit whitespace
				if (nextCh === "{" || nextCh === "[") {
					while (pos < text.length && isWhitespace(peek())) {
						advance();
					}
					return makeToken("whitespace", text.slice(start, pos), start, sLine, sCol);
				}
				// If no block structures are active, the tab cannot be serving as
				// block indentation — treat as separation whitespace (e.g. plain
				// scalar continuation, YAML 1.2 §6.2).
				if (blockStarted.size === 0) {
					while (pos < text.length && isWhitespace(peek())) {
						advance();
					}
					return makeToken("whitespace", text.slice(start, pos), start, sLine, sCol);
				}
				// Default: tab as block indentation → error
				while (pos < text.length && isWhitespace(peek())) {
					advance();
				}
				return makeToken("error", text.slice(start, pos), start, sLine, sCol);
			}
			// flowDepth > 0: tabs are allowed in specific cases inside flow
			// collections. Check what follows the whitespace run.
			{
				let lookPos = pos;
				while (lookPos < text.length && (text[lookPos] === " " || text[lookPos] === "\t")) {
					lookPos++;
				}
				const nextCh = lookPos < text.length ? text[lookPos] : "";
				// Tabs before closing indicators, newlines, or EOF are valid
				// separation space. Tabs before content are invalid (YAML 1.2 §6.1).
				if (nextCh === "]" || nextCh === "}" || nextCh === "\n" || nextCh === "\r" || nextCh === "") {
					while (pos < text.length && isWhitespace(peek())) {
						advance();
					}
					return makeToken("whitespace", text.slice(start, pos), start, sLine, sCol);
				}
			}
			// Default: tab before content in flow context → error
			while (pos < text.length && isWhitespace(peek())) {
				advance();
			}
			return makeToken("error", text.slice(start, pos), start, sLine, sCol);
		}
		while (pos < text.length && isWhitespace(peek())) {
			advance();
		}
		// Change 5a: mixed tab+space indentation check
		// When whitespace starts with spaces but contains a tab, the tab
		// may be invalid indentation (YAML 1.2 §6.1). We only flag an error
		// when the number of leading spaces matches an existing block scope
		// in blockStarted — meaning the tab is extending indentation at a
		// known block level. Blank/separator lines (next char is newline/EOF)
		// are exempt like Change 2.
		if (!lineIndentLocked && flowDepth === 0 && sCol === 0) {
			const ws = text.slice(start, pos);
			const tabIdx = ws.indexOf("\t");
			if (tabIdx > 0) {
				const nextCh = pos < text.length ? text[pos] : undefined;
				if (nextCh !== undefined && nextCh !== "\n" && nextCh !== "\r") {
					// Check if the number of spaces before the tab aligns with
					// an existing block scope — if so, the tab is trying to be
					// indentation at that level.
					if (blockStarted.has(tabIdx)) {
						return makeToken("error", ws, start, sLine, sCol);
					}
				}
			}
		}
		return makeToken("whitespace", text.slice(start, pos), start, sLine, sCol);
	}

	function scanComment(): YamlToken {
		lockLineIndent();
		const start = pos;
		const sLine = line;
		const sCol = col;
		while (pos < text.length && !isNewline(peek())) {
			advance();
		}
		return makeToken("comment", text.slice(start, pos), start, sLine, sCol);
	}

	function scanDocumentStartOrEnd(): YamlToken | null {
		lockLineIndent();
		const start = pos;
		const sLine = line;
		const sCol = col;
		const marker = text.slice(pos, pos + 3);
		// Must be exactly 3 chars followed by EOF, newline, or whitespace
		const after = charAt(pos + 3);
		if (after !== "" && !isNewline(after) && !isWhitespace(after)) {
			return null; // not a document marker, treat as plain scalar
		}
		advance(3);
		const kind = marker === "---" ? "document-start" : "document-end";
		// Reset block tracking so the next document gets fresh block-start tokens.
		blockStarted.clear();
		return makeToken(kind, marker, start, sLine, sCol);
	}

	function scanPlainScalar(): YamlToken {
		lockLineIndent();
		const start = pos;
		const sLine = line;
		const sCol = col;

		while (pos < text.length) {
			const ch = peek();
			if (isPlainScalarBreak(ch)) break;

			// `: ` or `:\n` or `:EOF` ends a plain scalar key
			if (
				ch === ":" &&
				(isWhitespace(peek(1)) || isNewline(peek(1)) || peek(1) === "" || (flowDepth > 0 && isFlowIndicator(peek(1))))
			) {
				break;
			}

			// ` #` starts a comment
			if (ch === " " && peek(1) === "#") {
				break;
			}

			// `\t#` also starts a comment
			if (ch === "\t" && peek(1) === "#") {
				break;
			}

			advance();
		}

		// Trim trailing whitespace from plain scalar value
		let end = pos;
		while (end > start && isWhitespace(text[end - 1] ?? "")) {
			end--;
		}

		const value = text.slice(start, end);
		return makeToken("scalar", value, start, sLine, sCol);
	}

	function scanSingleQuotedScalar(): YamlToken {
		lockLineIndent();
		const start = pos;
		const sLine = line;
		const sCol = col;
		advance(); // skip opening quote
		let value = "";

		while (pos < text.length) {
			const ch = peek();
			if (ch === "'") {
				if (peek(1) === "'") {
					// escaped single quote
					value += "'";
					advance(2);
				} else {
					// end of string
					advance();
					return makeToken("scalar", value, start, sLine, sCol, pos - start);
				}
			} else if (ch === "\n" || (ch === "\r" && peek(1) === "\n")) {
				// multi-line: newline becomes space (fold)
				value += " ";
				if (ch === "\r") advance(2);
				else advance();
				// Document markers (--- or ...) at column 0 terminate the scalar
				if (col === 0 && isDocumentMarkerAhead()) {
					return makeToken("error", text.slice(start, pos), start, sLine, sCol);
				}
			} else {
				value += ch;
				advance();
			}
		}

		// Unterminated — emit error token
		return makeToken("error", text.slice(start, pos), start, sLine, sCol);
	}

	function scanDoubleQuotedScalar(): YamlToken {
		lockLineIndent();
		const start = pos;
		const sLine = line;
		const sCol = col;
		advance(); // skip opening quote
		let value = "";

		while (pos < text.length) {
			const ch = peek();
			if (ch === '"') {
				advance();
				return makeToken("scalar", value, start, sLine, sCol, pos - start);
			}
			if (ch === "\\") {
				advance(); // skip backslash
				const esc = peek();
				switch (esc) {
					case "\\":
						value += "\\";
						advance();
						break;
					case '"':
						value += '"';
						advance();
						break;
					case "/":
						value += "/";
						advance();
						break;
					case "b":
						value += "\b";
						advance();
						break;
					case "f":
						value += "\f";
						advance();
						break;
					case "n":
						value += "\n";
						advance();
						break;
					case "r":
						value += "\r";
						advance();
						break;
					case "\t":
					case "t":
						value += "\t";
						advance();
						break;
					case "0":
						value += "\0";
						advance();
						break;
					case "a":
						value += "\x07";
						advance();
						break;
					case "e":
						value += "\x1B";
						advance();
						break;
					case "v":
						value += "\x0B";
						advance();
						break;
					case " ":
						value += " ";
						advance();
						break;
					case "N":
						value += "\u0085";
						advance();
						break;
					case "_":
						value += "\u00A0";
						advance();
						break;
					case "L":
						value += "\u2028";
						advance();
						break;
					case "P":
						value += "\u2029";
						advance();
						break;
					case "x": {
						advance(); // skip 'x'
						const hex = text.slice(pos, pos + 2);
						if (hex.length === 2 && /^[\da-fA-F]{2}$/.test(hex)) {
							value += String.fromCharCode(Number.parseInt(hex, 16));
							advance(2);
						} else {
							// Invalid escape — emit error token
							return makeToken("error", text.slice(start, pos), start, sLine, sCol);
						}
						break;
					}
					case "u": {
						advance(); // skip 'u'
						const hex = text.slice(pos, pos + 4);
						if (hex.length === 4 && /^[\da-fA-F]{4}$/.test(hex)) {
							value += String.fromCodePoint(Number.parseInt(hex, 16));
							advance(4);
						} else {
							return makeToken("error", text.slice(start, pos), start, sLine, sCol);
						}
						break;
					}
					case "U": {
						advance(); // skip 'U'
						const hex = text.slice(pos, pos + 8);
						// A well-formed 8-hex-digit escape can still denote a code point
						// above the Unicode maximum (U+10FFFF); that is invalid YAML and
						// must surface as an error token, never a String.fromCodePoint
						// RangeError escaping as an unhandled defect.
						const cp = hex.length === 8 && /^[\da-fA-F]{8}$/.test(hex) ? Number.parseInt(hex, 16) : Number.NaN;
						if (cp <= 0x10ffff) {
							value += String.fromCodePoint(cp);
							advance(8);
						} else {
							return makeToken("error", text.slice(start, pos), start, sLine, sCol);
						}
						break;
					}
					case "\n": {
						// line continuation
						advance();
						// skip leading whitespace on next line
						while (pos < text.length && isWhitespace(peek())) {
							advance();
						}
						break;
					}
					case "\r": {
						advance();
						if (peek() === "\n") advance();
						while (pos < text.length && isWhitespace(peek())) {
							advance();
						}
						break;
					}
					default:
						// Invalid escape sequence — emit error token
						return makeToken("error", text.slice(start, pos), start, sLine, sCol);
				}
			} else if (ch === "\n" || (ch === "\r" && peek(1) === "\n")) {
				value += " ";
				if (ch === "\r") advance(2);
				else advance();
				// Document markers (--- or ...) at column 0 terminate the scalar
				if (col === 0 && isDocumentMarkerAhead()) {
					return makeToken("error", text.slice(start, pos), start, sLine, sCol);
				}
				// Change 5b: tab after bare newline in double-quoted scalar is forbidden
				// when the scalar is nested (sCol > 0), since the tab would be acting
				// as indentation. At column 0, tabs are just leading whitespace.
				if (sCol > 0 && peek() === "\t") {
					advance(); // consume the tab so it's included in the error span
					return makeToken("error", text.slice(start, pos), start, sLine, sCol);
				}
			} else {
				value += ch;
				advance();
			}
		}

		// Unterminated string
		return makeToken("error", text.slice(start, pos), start, sLine, sCol);
	}

	function scanBlockScalar(): YamlToken {
		lockLineIndent();
		const start = pos;
		const sLine = line;
		const sCol = col;
		const indicator = peek(); // '|' or '>'
		const isFolded = indicator === ">";
		advance();

		// Parse header: optional chomping and/or indentation indicator
		let chomp: "clip" | "strip" | "keep" = "clip";
		let explicitIndent = 0;

		// Parse header characters
		for (let hc = 0; hc < 2 && pos < text.length && !isNewline(peek()); hc++) {
			const ch = peek();
			if (ch === "-") {
				chomp = "strip";
				advance();
			} else if (ch === "+") {
				chomp = "keep";
				advance();
			} else if (ch >= "1" && ch <= "9") {
				explicitIndent = Number.parseInt(ch, 10);
				advance();
			} else {
				break;
			}
		}

		// After indicator + modifiers, only whitespace, a comment (preceded by
		// whitespace), or newline/EOF is allowed on the header line.
		// Any other content (e.g., "first line" in "> first line") is invalid.
		let hadHeaderWhitespace = false;
		while (pos < text.length && isWhitespace(peek())) {
			hadHeaderWhitespace = true;
			advance();
		}
		if (pos < text.length && !isNewline(peek()) && peek() !== "") {
			if (peek() === "#" && hadHeaderWhitespace) {
				// Comment on header line preceded by whitespace — valid
				while (pos < text.length && !isNewline(peek())) {
					advance();
				}
			} else {
				// Invalid content after block scalar indicator:
				// either # without preceding whitespace, or arbitrary text
				while (pos < text.length && !isNewline(peek())) {
					advance();
				}
				return makeToken("error", text.slice(start, pos), start, sLine, sCol);
			}
		}

		// Consume the newline after header
		if (pos < text.length && isNewline(peek())) {
			if (peek() === "\r" && peek(1) === "\n") {
				advance(2);
			} else {
				advance();
			}
		}

		// Determine content indentation.
		// When an explicit indentation indicator is present (e.g., |2), the digit
		// specifies the number of additional indentation spaces relative to the
		// current block context level n (YAML 1.2 §8.1.1.1). Content lines must
		// have at least n+m absolute leading spaces. We compute n by scanning
		// backward to find the indentation context of the block scalar.
		let contentIndent = explicitIndent;
		let foundContent = explicitIndent > 0;
		if (explicitIndent > 0) {
			// Determine n (parent context indentation) by looking backward from
			// the block scalar indicator to find the preceding structure:
			// - If preceded by ":" on same line, n = key's column indentation
			// - If preceded by "-" on same line, n = column of "-"
			// - If on its own line (preceded by newline/tag/anchor), n = max
			//   active indent in blockStarted (the parent block's indent level)
			let parentIndent = lineIndent;
			let scanBack = start - 1;
			// Skip whitespace before the indicator
			while (scanBack >= 0 && (text[scanBack] === " " || text[scanBack] === "\t")) {
				scanBack--;
			}
			if (scanBack >= 0 && text[scanBack] === ":") {
				// Mapping value on same line — find the key's indentation
				let lineStart = scanBack;
				while (lineStart > 0 && text[lineStart - 1] !== "\n" && text[lineStart - 1] !== "\r") {
					lineStart--;
				}
				let spaces = 0;
				while (lineStart + spaces < text.length && text[lineStart + spaces] === " ") {
					spaces++;
				}
				// If the first non-space char is "-" followed by space (compact
				// sequence notation), the key starts after "- "
				if (lineStart + spaces < text.length && text[lineStart + spaces] === "-") {
					const afterDash = lineStart + spaces + 1;
					if (afterDash < text.length && (text[afterDash] === " " || text[afterDash] === "\t")) {
						parentIndent = spaces + 2;
					} else {
						parentIndent = spaces;
					}
				} else {
					parentIndent = spaces;
				}
			} else if (scanBack >= 0 && text[scanBack] === "-") {
				// Direct sequence entry value on same line — n = column of "-"
				let lineStart = scanBack;
				while (lineStart > 0 && text[lineStart - 1] !== "\n" && text[lineStart - 1] !== "\r") {
					lineStart--;
				}
				parentIndent = scanBack - lineStart;
			} else {
				// Block scalar is on its own line (e.g., after a tag or anchor
				// on a preceding line). The parent context indent is the highest
				// active block indent level from blockStarted.
				let maxBlockIndent = 0;
				for (const key of blockStarted.keys()) {
					if (key > maxBlockIndent) maxBlockIndent = key;
				}
				parentIndent = maxBlockIndent;
			}
			contentIndent = parentIndent + explicitIndent;
			foundContent = true;
		}
		if (contentIndent === 0) {
			// Auto-detect from first non-empty line
			let scanAhead = pos;
			while (scanAhead < text.length) {
				// Count spaces at start of this line
				let spaces = 0;
				while (scanAhead < text.length && text[scanAhead] === " ") {
					spaces++;
					scanAhead++;
				}
				// Document markers at column 0 terminate the block scalar
				if (spaces === 0 && scanAhead + 2 < text.length) {
					const sc0 = text[scanAhead];
					const sc1 = text[scanAhead + 1];
					const sc2 = text[scanAhead + 2];
					const sc3 = scanAhead + 3 < text.length ? text[scanAhead + 3] : "";
					if (
						((sc0 === "-" && sc1 === "-" && sc2 === "-") || (sc0 === "." && sc1 === "." && sc2 === ".")) &&
						(sc3 === "" || sc3 === " " || sc3 === "\t" || sc3 === "\n" || sc3 === "\r")
					) {
						break;
					}
				}
				// If this is a blank line, skip it
				if (scanAhead >= text.length || text[scanAhead] === "\n" || text[scanAhead] === "\r") {
					if (scanAhead < text.length) {
						scanAhead++; // skip newline
						if (text[scanAhead - 1] === "\r" && scanAhead < text.length && text[scanAhead] === "\n") {
							scanAhead++;
						}
					}
					continue;
				}
				contentIndent = spaces;
				foundContent = true;
				break;
			}
		}

		if (!foundContent || (contentIndent === 0 && blockStarted.size > 0)) {
			// No content lines found, or zero-indent content inside a block structure
			// (zero-indent content is only valid at document level, not inside mappings/sequences)
			if (chomp === "keep") {
				// Count and consume all trailing empty/whitespace-only lines for keep chomp
				let count = 0;
				while (pos < text.length) {
					// Skip whitespace on this line
					while (pos < text.length && (text[pos] === " " || text[pos] === "\t")) {
						pos++;
						col++;
					}
					if (pos >= text.length) {
						// Whitespace-only content at EOF counts as one empty line
						if (count === 0) count = 1;
						break;
					}
					if (text[pos] === "\n") {
						count++;
						pos++;
						line++;
						col = 0;
					} else if (text[pos] === "\r") {
						count++;
						pos++;
						if (pos < text.length && text[pos] === "\n") pos++;
						line++;
						col = 0;
					} else {
						break;
					}
				}
				const value = "\n".repeat(count);
				return makeToken("scalar", value, start, sLine, sCol, pos - start);
			}
			afterEmptyBlockScalar = true;
			return makeToken("scalar", "", start, sLine, sCol, pos - start);
		}

		// Collect content lines
		const lines: string[] = [];
		const trailingNewlines: string[] = [];

		while (pos < text.length) {
			// Count leading spaces
			let spaces = 0;
			const lineStart = pos;
			while (pos < text.length && text[pos] === " ") {
				spaces++;
				pos++;
				col++;
			}

			// Document markers (--- or ...) at column 0 always terminate a block scalar,
			// regardless of indentation level (YAML 1.2 §9.1.2).
			if (spaces === 0 && pos + 2 < text.length) {
				const c0 = text[pos];
				const c1 = text[pos + 1];
				const c2 = text[pos + 2];
				const c3 = pos + 3 < text.length ? text[pos + 3] : "";
				if (
					((c0 === "-" && c1 === "-" && c2 === "-") || (c0 === "." && c1 === "." && c2 === ".")) &&
					(c3 === "" || c3 === " " || c3 === "\t" || c3 === "\n" || c3 === "\r")
				) {
					pos = lineStart;
					col = 0;
					break;
				}
			}

			// Check if this is a blank/empty line (newline or EOF after only spaces)
			if (pos >= text.length || text[pos] === "\n" || text[pos] === "\r") {
				if (spaces > contentIndent) {
					// Whitespace-only line with extra indentation — this is content,
					// not an empty line (YAML 1.2 section 8.1.3)
					for (const nl of trailingNewlines) {
						lines.push(nl);
					}
					trailingNewlines.length = 0;
					lines.push(" ".repeat(spaces - contentIndent));
				} else {
					// Empty line (at or below content indent) — defer as trailing
					trailingNewlines.push("");
				}
				if (pos < text.length) {
					if (text[pos] === "\r" && pos + 1 < text.length && text[pos + 1] === "\n") {
						pos += 2;
					} else {
						pos++;
					}
					line++;
					col = 0;
				}
				continue;
			}

			// If indentation is less than content indent, we're done
			if (spaces < contentIndent) {
				// Rewind to start of this line
				pos = lineStart;
				col = 0; // approximate
				break;
			}

			// Flush trailing newlines into lines
			for (const nl of trailingNewlines) {
				lines.push(nl);
			}
			trailingNewlines.length = 0;

			// Collect the rest of the line (including extra indentation beyond contentIndent)
			const extra = " ".repeat(spaces - contentIndent);
			const contentStart = pos;
			while (pos < text.length && text[pos] !== "\n" && text[pos] !== "\r") {
				pos++;
				col++;
			}
			lines.push(extra + text.slice(contentStart, pos));

			// Consume newline
			if (pos < text.length) {
				if (text[pos] === "\r" && pos + 1 < text.length && text[pos + 1] === "\n") {
					pos += 2;
				} else {
					pos++;
				}
				line++;
				col = 0;
			}
		}

		// Build the scalar value
		let value: string;
		if (isFolded) {
			// Folded (YAML 1.2 §8.1.3): adjacent non-empty lines at base indent
			// fold to space. "More indented" lines (extra leading whitespace/tabs)
			// preserve their newlines. Empty lines are always preserved as newlines.
			let result = "";
			let prevMoreIndented = false;
			let hadContent = false;
			for (let i = 0; i < lines.length; i++) {
				const ln = lines[i] ?? "";
				const isMoreIndented = ln.length > 0 && (ln[0] === " " || ln[0] === "\t");
				if (ln === "") {
					// Empty line — preserved as newline
					result += "\n";
				} else if (!hadContent) {
					// First content line
					result += ln;
					prevMoreIndented = isMoreIndented;
					hadContent = true;
				} else {
					const lastChar = result[result.length - 1];
					if (lastChar === "\n") {
						// After empty line(s): if transition involves more-indented,
						// add extra newline for the preserved line break
						if (isMoreIndented || prevMoreIndented) {
							result += `\n${ln}`;
						} else {
							result += ln;
						}
					} else if (isMoreIndented || prevMoreIndented) {
						// Transition to/from more-indented: preserve newline
						result += `\n${ln}`;
					} else {
						// Normal folding: adjacent base-indent lines fold to space
						result += ` ${ln}`;
					}
					prevMoreIndented = isMoreIndented;
				}
			}
			// Apply chomping
			if (chomp === "strip") {
				// no trailing newline
			} else if (chomp === "keep") {
				result += "\n";
				for (const _nl of trailingNewlines) {
					result += "\n";
				}
			} else {
				// clip: single trailing newline
				result += "\n";
			}
			value = result;
		} else {
			// Literal: join lines with newlines
			value = lines.join("\n");
			if (chomp === "strip") {
				// no trailing newline
			} else if (chomp === "keep") {
				value += "\n";
				for (const _nl of trailingNewlines) {
					value += "\n";
				}
			} else {
				// clip: single trailing newline
				value += "\n";
			}
		}

		return makeToken("scalar", value, start, sLine, sCol, pos - start);
	}

	function scanAnchor(): YamlToken {
		lockLineIndent();
		const start = pos;
		const sLine = line;
		const sCol = col;
		advance(); // skip '&'
		const nameStart = pos;
		// YAML 1.2 ns-anchor-char: any non-whitespace char except c-flow-indicator
		while (pos < text.length && !isWhitespace(peek()) && !isNewline(peek()) && !isFlowIndicator(peek())) {
			advance();
		}
		const name = text.slice(nameStart, pos);
		if (name.length === 0) {
			return makeToken("error", text.slice(start, pos), start, sLine, sCol);
		}
		// The token value is the bare name, but the span covers the '&' sigil
		// too — pass the raw length so the span is not one character short.
		return makeToken("anchor", name, start, sLine, sCol, pos - start);
	}

	function scanAlias(): YamlToken {
		lockLineIndent();
		const start = pos;
		const sLine = line;
		const sCol = col;
		advance(); // skip '*'
		const nameStart = pos;
		// YAML 1.2 ns-anchor-char: any non-whitespace char except c-flow-indicator
		while (pos < text.length && !isWhitespace(peek()) && !isNewline(peek()) && !isFlowIndicator(peek())) {
			advance();
		}
		const name = text.slice(nameStart, pos);
		if (name.length === 0) {
			return makeToken("error", text.slice(start, pos), start, sLine, sCol);
		}
		// The token value is the bare name, but the span covers the '*' sigil
		// too — pass the raw length so the span is not one character short.
		return makeToken("alias", name, start, sLine, sCol, pos - start);
	}

	function scanTag(): YamlToken {
		lockLineIndent();
		const start = pos;
		const sLine = line;
		const sCol = col;
		advance(); // skip first '!'

		if (peek() === "<") {
			// Verbatim tag: !<...>
			advance(); // skip '<'
			while (pos < text.length && peek() !== ">") {
				if (isNewline(peek())) {
					return makeToken("error", text.slice(start, pos), start, sLine, sCol);
				}
				advance();
			}
			if (peek() === ">") {
				advance(); // skip '>'
			} else {
				return makeToken("error", text.slice(start, pos), start, sLine, sCol);
			}
			return makeToken("tag", text.slice(start, pos), start, sLine, sCol);
		}

		if (peek() === "!") {
			// Secondary tag handle: !!
			advance();
		}

		// Collect tag suffix
		while (pos < text.length && !isWhitespace(peek()) && !isNewline(peek()) && !isFlowIndicator(peek())) {
			advance();
		}

		return makeToken("tag", text.slice(start, pos), start, sLine, sCol);
	}

	function scanDirective(): YamlToken {
		lockLineIndent();
		const start = pos;
		const sLine = line;
		const sCol = col;
		// Consume the entire line
		while (pos < text.length && !isNewline(peek())) {
			advance();
		}
		return makeToken("directive", text.slice(start, pos), start, sLine, sCol);
	}

	// -----------------------------------------------------------------------
	// Main scan (internal)
	// -----------------------------------------------------------------------

	function scanNext(): YamlToken | null {
		// Drain pending tokens first
		if (pending.length > 0) {
			const next = pending.shift();
			if (next !== undefined) return next;
		}

		if (pos >= text.length) {
			return null;
		}

		// Save and reset the quoted-scalar flag. The `:` handler reads
		// `prevWasQuoted` to allow adjacent value indicators in flow context
		// (YAML 1.2 §7.18). In flow context, preserve the flag across
		// whitespace, newlines, and comments so that a colon on the next line
		// after a quoted key is still recognized as a value indicator
		// (e.g., { "foo"\n  :bar } or { "foo" # comment\n  :bar }).
		const prevWasQuoted = afterQuotedScalar;
		// Save and reset the flow-collection-end flag. The `:` handler reads
		// `prevWasFlowEnd` to allow adjacent value indicators after a flow
		// collection used as an implicit-mapping key (e.g. `[ {JSON: like}:v ]`).
		const prevWasFlowEnd = afterFlowCollectionEnd;
		if (flowDepth > 0) {
			const ch0 = peek();
			// Only reset when we encounter a content-bearing character that is
			// NOT whitespace, newline, or a comment indicator preceded by space.
			const isComment =
				ch0 === "#" &&
				(pos === 0 ||
					col === 0 ||
					text[pos - 1] === " " ||
					text[pos - 1] === "\t" ||
					text[pos - 1] === "\n" ||
					text[pos - 1] === "\r");
			if (!isWhitespace(ch0) && !isNewline(ch0) && !isComment) {
				afterQuotedScalar = false;
				afterFlowCollectionEnd = false;
			}
		} else {
			afterQuotedScalar = false;
			afterFlowCollectionEnd = false;
		}

		const ch = peek();

		// BOM
		if (ch === "\uFEFF") {
			const start = pos;
			const sLine = line;
			const sCol = col;
			advance();
			return makeToken("byte-order-mark", "\uFEFF", start, sLine, sCol);
		}

		// Newlines
		if (isNewline(ch)) {
			return scanNewline();
		}

		// Whitespace
		if (isWhitespace(ch)) {
			return scanWhitespace();
		}

		// Clear the empty block scalar flag once we reach non-whitespace content.
		afterEmptyBlockScalar = false;

		// Comment: YAML 1.2 §6.6 requires # to be preceded by whitespace
		// (or be at the start of a line) to be a valid comment indicator.
		if (ch === "#") {
			if (pos === 0 || col === 0) {
				return scanComment();
			}
			const prev = text[pos - 1];
			if (prev === " " || prev === "\t" || prev === "\n" || prev === "\r") {
				return scanComment();
			}
			// # without preceding whitespace after a quoted scalar is invalid
			// (e.g., "value"# comment). In other contexts, # is valid scalar content.
			if (prevWasQuoted) {
				const start = pos;
				const sLine = line;
				const sCol = col;
				advance();
				return makeToken("error", "#", start, sLine, sCol);
			}
			// Falls through to plain scalar scanner
		}

		// Document markers (only at column 0)
		if (col === 0 && ch === "-" && peek(1) === "-" && peek(2) === "-") {
			const marker = scanDocumentStartOrEnd();
			if (marker) return marker;
		}
		if (col === 0 && ch === "." && peek(1) === "." && peek(2) === ".") {
			const marker = scanDocumentStartOrEnd();
			if (marker) return marker;
		}

		// Directive (only at column 0 outside flow context)
		if (ch === "%" && col === 0 && flowDepth === 0) {
			return scanDirective();
		}

		// Block scalar indicators
		if ((ch === "|" || ch === ">") && flowDepth === 0) {
			// Check if this is truly a block scalar indicator:
			// must be followed by newline, whitespace, chomping/indent, # or EOF
			const next = peek(1);
			if (
				next === "" ||
				isNewline(next) ||
				isWhitespace(next) ||
				next === "-" ||
				next === "+" ||
				// Includes 0 so |0 enters scanBlockScalar where the header parser rejects it
				(next >= "0" && next <= "9") ||
				next === "#"
			) {
				return scanBlockScalar();
			}
		}

		// Flow indicators
		if (ch === "{") {
			lockLineIndent();
			const start = pos;
			const sLine = line;
			const sCol = col;
			advance();
			flowDepth++;
			return makeToken("flow-map-start", "{", start, sLine, sCol);
		}
		if (ch === "}") {
			lockLineIndent();
			const start = pos;
			const sLine = line;
			const sCol = col;
			advance();
			if (flowDepth > 0) flowDepth--;
			afterFlowCollectionEnd = true;
			return makeToken("flow-map-end", "}", start, sLine, sCol);
		}
		if (ch === "[") {
			lockLineIndent();
			const start = pos;
			const sLine = line;
			const sCol = col;
			advance();
			flowDepth++;
			return makeToken("flow-seq-start", "[", start, sLine, sCol);
		}
		if (ch === "]") {
			lockLineIndent();
			const start = pos;
			const sLine = line;
			const sCol = col;
			advance();
			if (flowDepth > 0) flowDepth--;
			afterFlowCollectionEnd = true;
			return makeToken("flow-seq-end", "]", start, sLine, sCol);
		}
		if (ch === ",") {
			lockLineIndent();
			const start = pos;
			const sLine = line;
			const sCol = col;
			advance();
			// Comma is only valid as an item separator inside flow context.
			// Outside flow ({...}/[...]), a stand-alone comma is malformed input —
			// e.g., U99R `!!str, xxx` where the comma trails a tag.
			if (flowDepth === 0) {
				return makeToken("error", ",", start, sLine, sCol);
			}
			return makeToken("flow-separator", ",", start, sLine, sCol);
		}

		// Anchor
		if (ch === "&") {
			return scanAnchor();
		}

		// Alias
		if (ch === "*") {
			return scanAlias();
		}

		// Tag
		if (ch === "!") {
			return scanTag();
		}

		// Explicit map key
		if (ch === "?" && (isWhitespace(peek(1)) || isNewline(peek(1)) || peek(1) === "")) {
			lockLineIndent();
			const indent = lineIndent;
			const start = pos;
			const sLine = line;
			const sCol = col;
			advance();
			// Change 4: tab in separation space before content after ? is forbidden.
			// After ?, any content at a tab-based position would use the tab as
			// effective indentation for the key content.
			if (flowDepth === 0) {
				let lk = pos;
				let hasTab = false;
				let firstTabPos = -1;
				while (lk < text.length && (text[lk] === " " || text[lk] === "\t")) {
					if (text[lk] === "\t" && !hasTab) {
						hasTab = true;
						firstTabPos = lk;
					}
					lk++;
				}
				if (hasTab && lk < text.length && text[lk] !== "\n" && text[lk] !== "\r") {
					// Tab before any non-whitespace content after ? is an error
					while (pos < firstTabPos) advance();
					const tabStart = pos;
					const tabLine = line;
					const tabCol = col;
					advance();
					ensureBlockMap(indent, start, sLine, sCol);
					pending.push(makeToken("block-map-key", "?", start, sLine, sCol));
					pending.push(makeToken("error", "\t", tabStart, tabLine, tabCol));
					const first = pending.shift();
					if (first !== undefined) return first;
					return makeToken("block-map-key", "?", start, sLine, sCol);
				}
			}
			ensureBlockMap(indent, start, sLine, sCol);
			if (pending.length > 0) {
				// block-map-start was pushed, push the key indicator after it
				pending.push(makeToken("block-map-key", "?", start, sLine, sCol));
				const first = pending.shift();
				if (first !== undefined) return first;
			}
			return makeToken("block-map-key", "?", start, sLine, sCol);
		}

		// Block sequence entry
		if (ch === "-" && (isWhitespace(peek(1)) || isNewline(peek(1)) || peek(1) === "") && flowDepth === 0) {
			lockLineIndent();
			const indent = lineIndent;
			const start = pos;
			const sLine = line;
			const sCol = col;
			advance();
			// Change 4: tab in separation space before nested block structure is forbidden.
			// YAML 1.2 allows tabs in separation space for scalar values, but when
			// the content after tab-containing separation is a block indicator or
			// mapping key, the tab effectively acts as indentation.
			{
				let lk = pos;
				let hasTab = false;
				let firstTabPos = -1;
				while (lk < text.length && (text[lk] === " " || text[lk] === "\t")) {
					if (text[lk] === "\t" && !hasTab) {
						hasTab = true;
						firstTabPos = lk;
					}
					lk++;
				}
				if (hasTab && lk < text.length) {
					const nc = text[lk];
					// Check if next content is a block indicator
					const afterNc = lk + 1 < text.length ? text[lk + 1] : "";
					const isBlockIndicator =
						(nc === "-" &&
							(afterNc === " " || afterNc === "\t" || afterNc === "\n" || afterNc === "\r" || afterNc === "")) ||
						(nc === "?" &&
							(afterNc === " " || afterNc === "\t" || afterNc === "\n" || afterNc === "\r" || afterNc === ""));
					if (isBlockIndicator) {
						// Advance to the tab position and emit error
						while (pos < firstTabPos) advance();
						const tabStart = pos;
						const tabLine = line;
						const tabCol = col;
						advance();
						ensureBlockSeq(indent, start, sLine, sCol);
						pending.push(makeToken("block-seq-entry", "-", start, sLine, sCol));
						pending.push(makeToken("error", "\t", tabStart, tabLine, tabCol));
						const first = pending.shift();
						if (first !== undefined) return first;
						return makeToken("block-seq-entry", "-", start, sLine, sCol);
					}
				}
			}
			ensureBlockSeq(indent, start, sLine, sCol);
			if (pending.length > 0) {
				// block-seq-start was pushed, push the entry after it
				pending.push(makeToken("block-seq-entry", "-", start, sLine, sCol));
				const first = pending.shift();
				if (first !== undefined) return first;
			}
			return makeToken("block-seq-entry", "-", start, sLine, sCol);
		}

		// Value indicator
		// YAML 1.2 §7.18: In flow context, ":" is a valid value indicator
		// immediately after a quoted scalar (JSON-like key) without requiring
		// a following whitespace character.
		if (
			ch === ":" &&
			(isWhitespace(peek(1)) ||
				isNewline(peek(1)) ||
				peek(1) === "" ||
				(flowDepth > 0 && isFlowIndicator(peek(1))) ||
				(flowDepth > 0 && prevWasQuoted) ||
				(flowDepth > 0 && prevWasFlowEnd))
		) {
			lockLineIndent();
			const indent = lineIndent;
			const start = pos;
			const sLine = line;
			const sCol = col;
			advance();
			// Change 4: tab in separation space before nested block structure is forbidden.
			if (flowDepth === 0) {
				let lk = pos;
				let hasTab = false;
				let firstTabPos = -1;
				while (lk < text.length && (text[lk] === " " || text[lk] === "\t")) {
					if (text[lk] === "\t" && !hasTab) {
						hasTab = true;
						firstTabPos = lk;
					}
					lk++;
				}
				if (hasTab && lk < text.length) {
					const nc = text[lk];
					const afterNc = lk + 1 < text.length ? text[lk + 1] : "";
					const isBlockIndicator =
						(nc === "-" &&
							(afterNc === " " || afterNc === "\t" || afterNc === "\n" || afterNc === "\r" || afterNc === "")) ||
						(nc === "?" &&
							(afterNc === " " || afterNc === "\t" || afterNc === "\n" || afterNc === "\r" || afterNc === ""));
					if (isBlockIndicator) {
						while (pos < firstTabPos) advance();
						const tabStart = pos;
						const tabLine = line;
						const tabCol = col;
						advance();
						ensureBlockMap(indent, start, sLine, sCol);
						pending.push(makeToken("block-map-value", ":", start, sLine, sCol));
						pending.push(makeToken("error", "\t", tabStart, tabLine, tabCol));
						const first = pending.shift();
						if (first !== undefined) return first;
						return makeToken("block-map-value", ":", start, sLine, sCol);
					}
				}
			}
			ensureBlockMap(indent, start, sLine, sCol);
			if (pending.length > 0) {
				// block-map-start was pushed, push the value indicator after it
				pending.push(makeToken("block-map-value", ":", start, sLine, sCol));
				const first = pending.shift();
				if (first !== undefined) return first;
			}
			return makeToken("block-map-value", ":", start, sLine, sCol);
		}

		// Quoted scalars
		if (ch === "'") {
			afterQuotedScalar = true;
			return scanSingleQuotedScalar();
		}
		if (ch === '"') {
			afterQuotedScalar = true;
			return scanDoubleQuotedScalar();
		}

		// Plain scalar (fallback)
		afterQuotedScalar = false;
		return scanPlainScalar();
	}

	// -----------------------------------------------------------------------
	// Public scanner interface
	// -----------------------------------------------------------------------

	return {
		scan(): YamlTokenKind | null {
			const token = scanNext();
			state.currentToken = token;
			return token === null ? null : token.kind;
		},
		getToken(): YamlTokenKind | null {
			return state.currentToken === null ? null : state.currentToken.kind;
		},
		getTokenValue(): string {
			return state.currentToken === null ? "" : state.currentToken.value;
		},
		getTokenOffset(): number {
			return state.currentToken === null ? 0 : state.currentToken.offset;
		},
		getTokenLength(): number {
			return state.currentToken === null ? 0 : state.currentToken.length;
		},
		getTokenLine(): number {
			return state.currentToken === null ? 0 : state.currentToken.line;
		},
		getTokenColumn(): number {
			return state.currentToken === null ? 0 : state.currentToken.column;
		},
		getPosition(): number {
			return pos;
		},
		setPosition(newPos: number): void {
			// Recompute line/col by replaying character advances from the start.
			pos = 0;
			line = 0;
			col = 0;
			while (pos < newPos && pos < text.length) {
				if (text[pos] === "\n") {
					line++;
					col = 0;
				} else {
					col++;
				}
				pos++;
			}
			// Reset all mutable scanner state.
			lineIndent = 0;
			lineIndentLocked = false;
			flowDepth = 0;
			blockStarted.clear();
			pending.length = 0;
			afterEmptyBlockScalar = false;
			afterQuotedScalar = false;
			afterFlowCollectionEnd = false;
			state.currentToken = null;
		},
	};
}

// ---------------------------------------------------------------------------
// Batch API
// ---------------------------------------------------------------------------

/**
 * Tokenize a YAML source string into an array of {@link YamlToken} records.
 *
 * Lexer errors are embedded as `"error"` tokens in the result; the downstream
 * parser/composer collects them and records diagnostics as needed.
 */
export function lexAll(text: string): ReadonlyArray<YamlToken> {
	const scanner = createScanner(text);
	const tokens: YamlToken[] = [];
	let kind = scanner.scan();
	while (kind !== null) {
		tokens.push({
			kind,
			value: scanner.getTokenValue(),
			offset: scanner.getTokenOffset(),
			length: scanner.getTokenLength(),
			line: scanner.getTokenLine(),
			column: scanner.getTokenColumn(),
		});
		kind = scanner.scan();
	}
	return tokens;
}
