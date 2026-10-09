// Canonical markdown serialization: an mdast-shaped tree in, markdown source
// out. Original code (nothing here is ported verbatim); commonmark.js's
// excluded render/commonmark.js and mdast-util-to-markdown informed the
// escaping approach as prior art, but the operational authority is the
// corpus-wide re-parse property in
// `__test__/e2e/stringify-roundtrip.e2e.test.ts`: emitted text must re-parse
// to a render-equivalent document.
//
// THE CANONICAL DEFAULTS TABLE — fidelity fields win when present; when
// absent these spellings apply:
//
//   heading         ATX (`#` × depth); setext only via fidelity, depth <= 2
//   emphasis        `*`     strong  `**`    (flipped to `_` at run junctions)
//   bullet list     `-`     ordered delimiter `.`   start `1`
//   list spread     absent reads as tight
//   code            absent `fenceChar` reads as INDENTED (the node contract:
//                   absence is how fenced and indented are told apart), with
//                   a representability escape to a backtick fence when the
//                   value has a lang/meta, is empty, or has a blank first or
//                   last line
//   fence length    max(3, fidelity, longest interior run + 1)
//   thematic break  `***` (never `---`, which could read as setext under a
//                   lazy paragraph or as frontmatter at offset 0)
//   hard break      backslash
//   table align     `---` / `:--` / `--:` / `:-:`, `---` when unknown
//   frontmatter     `---` yaml, `+++` toml, `---json` json; closed by `---`
//                   (`+++` for toml)
//
// Escaping strategy: an always-escape set for inline text (backslash,
// backtick, `*`, `[`, `]`, `<`, `~`, `|`) plus line-start escapes (`#`, `>`,
// `+`, `-`, `=`, and ordered-list-marker digit runs) applied at the start of
// the block and after every emitted newline. Three characters escape only
// where they could actually bind, so `parse ∘ stringify` is the identity on
// ordinary prose: `_` is raw when both neighbours in the same text value are
// Unicode alphanumerics (an intraword `_` can neither open nor close
// emphasis; a value boundary counts as not alphanumeric, so an edge `_` stays
// escaped whatever the sibling is); `&` is raw unless the rest of the value
// is entity-shaped (the engine's own ENTITY grammar, any name-shaped run —
// the entity map is not consulted), with a value-final `&` escaped only when
// a sibling follows; `>` is escaped only at a line start, the one place it
// binds. In a heading, `#` is escaped only at the head of a `#` run that a
// space or the value start precedes and nothing but whitespace follows to the
// value end — the closing-sequence shape — with a following sibling treated
// as content that may still be blank, so the escape stays.
// Autolink defense under gfm: a `.` right after a boundary-preceded `www` and
// a `:` right after a scheme word (http/https/ftp/mailto/xmpp) are escaped so
// raw-source literal scanners cannot fire; escapes decode away, so the text
// is unchanged. Email-shaped plain text is a RECORDED LIMITATION: the email
// matcher is a postprocess over decoded text,
// so no escape spelling survives to defeat it.
//
// Unrepresentable shapes (documented, synthesized-tree-only — the parser
// never produces them): a tight list whose item holds multiple blocks, two
// adjacent `Delete` siblings, a `Break` inside a heading or table cell
// (serialized as a space), text lines starting with 4+ spaces, and a
// `Frontmatter` node anywhere but the head of `Root`.
//
// Depth guard: serialization recurses over the tree, so the shared
// `MAX_NESTING_DEPTH` cap applies (a decoded hostile tree must trip a typed
// guard, never a RangeError). Blocks and inlines share one counter.

import * as Match from "effect/Match";
import * as HashSet from "effect/HashSet";
import * as A from "effect/Array";
import type {
	Code,
	Definition,
	FlowContent,
	FootnoteDefinition,
	Frontmatter,
	Heading,
	List,
	ListItem,
	MdxJsxAttributeContent,
	MdxJsxFlowElement,
	MdxJsxTextElement,
	MdxjsEsm,
	Paragraph,
	PhrasingContent,
	Root,
	Table,
} from "../MarkdownNode.ts";
import { GuardExceeded } from "./carriers.ts";
import { MAX_NESTING_DEPTH } from "./limits.ts";
import { ENTITY } from "./unescape.ts";
import * as P from "effect/Predicate";

/**
 * How inline content is being assembled.
 */
interface InlineContext {
	/**
	 * No newlines representable (heading, table cell): breaks become spaces.
	 */
	readonly singleLine: boolean;
	/**
	 * Inside a table cell: `|` must not survive unescaped.
	 */
	readonly inTable: boolean;
	/**
	 * Inside a heading: a `#` could read as the closing sequence.
	 */
	readonly inHeading: boolean;
}

const FLOW_CONTEXT: InlineContext = { singleLine: false, inTable: false, inHeading: false };
const HEADING_CONTEXT: InlineContext = { singleLine: true, inTable: false, inHeading: true };
const CELL_CONTEXT: InlineContext = { singleLine: true, inTable: true, inHeading: false };

/**
 * Characters escaped wherever they appear in inline text.
 */
const ALWAYS_ESCAPE = HashSet.fromIterable<string>(["\\", "`", "*", "[", "]", "<", "~", "|"]);

/**
 * A character reference at the head of the string: the engine's own grammar.
 */
const reEntityAhead = new RegExp(`^${ENTITY}`, "i");

const reAlphanumeric = /[\p{L}\p{N}]/u;

/**
 * Line-start characters that could open a block construct.
 */
const LINE_START_ESCAPE = HashSet.fromIterable<string>(["#", ">", "+", "-", "=", "~", "`"]);

const SCHEME_WORDS = HashSet.fromIterable<string>(["http", "https", "ftp", "mailto", "xmpp"]);

const ORDERED_MARKER = /^\d{1,9}[.)]/;

/**
 * The serializer's mutable state.
 */
interface StringifyState {
	depth: number;
	/**
	 * MDX JSX flow-element nesting depth — how many `mdxJsxFlowElement`
	 * ancestors enclose the current emission, counted from the nearest
	 * blockquote or list item (whose own continuation prefixes take over
	 * indentation; the oracle's `inferDepth` break). Drives the two-space
	 * child indentation inside flow elements.
	 */
	jsxDepth: number;
	/**
	 * Whether the tree contains any MDX node. MDX makes `{` significant in
	 * text, so text escaping defends it — but only then, keeping non-MDX
	 * trees byte-identical to the published canonical form.
	 */
	readonly mdx: boolean;
}

const guard = (state: StringifyState, node: { position: { start: { offset: number } } }): void => {
	state.depth += 1;
	if (state.depth > MAX_NESTING_DEPTH) {
		throw new GuardExceeded("NestingDepthExceeded", MAX_NESTING_DEPTH, state.depth, node.position.start.offset);
	}
};

const unguard = (state: StringifyState): void => {
	state.depth -= 1;
};

// --- inline text escaping ---------------------------------------------------

/**
 * Whether `value[index]` ends a `www` run preceded by a word boundary.
 */
const isWwwDot = (value: string, index: number): boolean => {
	if (value.slice(Math.max(0, index - 3), index).toLowerCase() !== "www") return false;
	if (index - 3 <= 0) return true;
	const before = value[index - 4];
	return before === undefined || !/[\p{L}\p{N}]/u.test(before);
};

/**
 * Whether the run of letters ending at `value[index]` is a scheme word.
 */
const isSchemeColon = (value: string, index: number): boolean => {
	let start = index;
	while (start > 0 && /[a-zA-Z]/.test(value.charAt(start - 1))) start -= 1;
	return HashSet.has(SCHEME_WORDS, value.slice(start, index).toLowerCase());
};

/**
 * Whether `value[index]` is a Unicode letter or number (`undefined` is not).
 */
const isAlphanumericAt = (value: string, index: number): boolean => {
	const char = value[index];
	return char !== undefined && reAlphanumeric.test(char);
};

/**
 * Whether the `#` at `value[index]` heads a run that would read as an ATX
 * closing sequence: preceded by whitespace or the value start, and followed
 * by nothing but whitespace to the end of the contiguous text (this value
 * plus `followingText`). A non-text sibling after that may contribute only
 * blank content, so it keeps the escape (conservative).
 */
const isClosingHashRun = (value: string, index: number, followingText: string, nonTextFollows: boolean): boolean => {
	const before = value[index - 1];
	if (before !== undefined && before !== " " && before !== "\t") return false;
	const rest = value.slice(index) + followingText;
	let end = 0;
	while (rest[end] === "#") end += 1;
	return nonTextFollows || /^[ \t\n]*$/.test(rest.slice(end));
};

/**
 * A run that a later sibling could still complete into a character reference.
 */
const reEntityPrefix = /^&[#a-z0-9]*$/i;

/**
 * Escape one text value into `out`, tracking line starts. Returns whether the
 * emission ended at a line start. `followingText` is the concatenated value
 * of the contiguous text siblings after this one (the parser never splits a
 * text run, but a synthesized tree may), and `nonTextFollows` says whether a
 * non-text inline comes after those; together they decide the value-end
 * cases (`&`, and `#` in a heading) against what will actually be emitted.
 */
const escapeText = (
	value: string,
	context: InlineContext,
	atLineStart: boolean,
	mdx: boolean,
	followingText: string,
	nonTextFollows: boolean,
): { text: string; atLineStart: boolean } => {
	let out = "";
	let lineStart = atLineStart;
	for (let index = 0; index < value.length; index += 1) {
		const char = value.charAt(index);
		if (char === "\n") {
			// A soft break survives as a plain newline, INCLUDING at a Text
			// value's boundary (index 0 or the last index) — that is exactly
			// where a line wraps beside a non-text inline (inlineCode, strong,
			// emphasis, link), and the neighbouring inline keeps the paragraph
			// continuous, so a literal `\n` there cannot open a block. Two
			// cases still have no raw spelling and keep the numeric reference:
			// a newline adjacent to another newline WITHIN this value (a
			// literal blank line, which would end the paragraph on re-parse),
			// and a newline that lands at an already-fresh physical line
			// (`lineStart` true — block start, or immediately after a hard
			// break) — emitting it there would open a second, BLANK line,
			// which is the same "blank line ends the block" hazard as the
			// adjacent case, just arriving from the previous sibling instead
			// of from this value. Single-line contexts have no newline
			// spelling at all.
			const adjacent = value[index - 1] === "\n" || value[index + 1] === "\n";
			if (context.singleLine) {
				out += " ";
				lineStart = false;
			} else if (adjacent || lineStart) {
				out += "&#10;";
				lineStart = false;
			} else {
				out += "\n";
				lineStart = true;
			}
			continue;
		}
		if (lineStart) {
			// Leading whitespace at a line start would read as indentation
			// (four columns make an indented code block); the numeric
			// reference is inert.
			if (char === "\t") {
				out += "&#9;";
				lineStart = false;
				continue;
			}
			if (char === " ") {
				out += "&#32;";
				lineStart = false;
				continue;
			}
			const lineEnd = value.indexOf("\n", index);
			const restOfLine = value.slice(index, lineEnd === -1 ? undefined : lineEnd);
			const ordered = ORDERED_MARKER.exec(restOfLine);
			if (ordered !== null) {
				const digits = ordered[0].slice(0, -1);
				const delimiter = ordered[0].slice(-1);
				out += `${digits}\\${delimiter}`;
				index += ordered[0].length - 1;
				lineStart = false;
				continue;
			}
			if (HashSet.has(LINE_START_ESCAPE, char)) {
				out += `\\${char}`;
				lineStart = false;
				continue;
			}
		}
		lineStart = false;
		if (HashSet.has(ALWAYS_ESCAPE, char)) {
			out += `\\${char}`;
			continue;
		}
		// MDX makes `{` open an expression anywhere in text (the oracle's
		// unsafe set: `{` in phrasing and at breaks); `<` is already in the
		// always-escape set. Only trees carrying MDX nodes pay this escape,
		// so non-MDX output is byte-identical to the canonical table.
		if (mdx && char === "{") {
			out += "\\{";
			continue;
		}
		// The intraword-underscore rule: between two alphanumerics an `_`
		// can neither open nor close emphasis, so it stays raw.
		if (char === "_" && !(isAlphanumericAt(value, index - 1) && isAlphanumericAt(value, index + 1))) {
			out += "\\_";
			continue;
		}
		// `&` binds only as a character reference, tested against the
		// contiguous text that will actually be emitted (Text("&a") +
		// Text("mp;") must not fuse). A run a non-text sibling could still
		// complete (`&`, `&am`, `&#12`) is escaped, since that sibling's
		// bytes are unknowable here.
		if (char === "&") {
			const ahead = value.slice(index) + followingText;
			const entityShaped = reEntityAhead.test(ahead) || (nonTextFollows && reEntityPrefix.test(ahead));
			out += entityShaped ? "\\&" : "&";
			continue;
		}
		if (context.inHeading && char === "#" && isClosingHashRun(value, index, followingText, nonTextFollows)) {
			out += "\\#";
			continue;
		}
		if (char === "." && isWwwDot(value, index)) {
			out += "\\.";
			continue;
		}
		if (char === ":" && isSchemeColon(value, index)) {
			out += "\\:";
			continue;
		}
		out += char;
	}
	return { text: out, atLineStart: lineStart };
};

// --- literal text (`escapeStyle: "literal"`) ---------------------------------
//
// The caller vouches the value is already safe markdown source, so every
// escape aimed at the INLINE phase is dropped. What stays is what defends the
// BLOCK phase — the structure around the text, decided before inlines are
// parsed: newlines (blank lines end a paragraph; single-line containers have
// none), line-start block openers and leading whitespace, the heading closing
// sequence, and the table cell's pipes (cells are split before inline
// parsing). MDX's `{`/`<` also stay: MDX reads a stray one as a syntax error.
// Kept apart from `escapeText` so the canonical path is untouched byte for
// byte.

/**
 * Space or tab — the whitespace a list marker or ATX run must be followed by.
 */
const isSpaceOrTab = (char: string | undefined): boolean => char === " " || char === "\t";

/**
 * Every character of `line` is `marker` or space/tab — a thematic-break or setext-shaped run.
 */
const isRunOf = (line: string, marker: string): boolean =>
	line.length > 0 && [...line].every((char) => char === marker || char === " " || char === "\t");

/**
 * Only the characters a GFM delimiter row is made of (re2c's `spacechar` included).
 */
const reDelimiterRowShaped = /^[-:| \t\v\f]+$/;

/**
 * Whether a literal line starting with `line` can open a block, so its first
 * character must be escaped. `line` is the text known to be on the line —
 * the value up to its next newline, then the following text siblings — and
 * `open` says the line may carry more than that (no newline ended it).
 * Beyond the known text sits either the end of the line or content this
 * function cannot see (a non-text sibling, a parent's closing delimiter), so
 * a marker that needs "space, tab or end of line" after it is escaped when
 * it reaches the end of `line`. Every test errs toward escaping: an extra
 * backslash is inert, a missing one changes the document.
 */
const literalLineOpensBlock = (line: string, open: boolean): boolean => {
	const char = line[0];
	if (char === ">" || char === "<" || char === "[" || char === "|" || char === ":") {
		return true;
	} else if (char === "#") {
		const run = /^#{1,6}/.exec(line)?.[0] ?? "";
		return run.length > 0 && (run.length === line.length || isSpaceOrTab(line[run.length]));
	} else if (char === "`" || char === "~") {
		// A fence is 3+ of either; an open line of only 1-2 could be completed.
		return line.startsWith(char.repeat(3)) || (open && [...line].every((each) => each === char));
	} else if (char === "=") {
		// A setext underline, kept escaped even on a paragraph's first line.
		return /^=+[ \t]*$/.test(line);
	} else if (char === "+" || char === "-" || char === "*" || char === "_") {
		const bullet = char !== "_" && (line.length === 1 || isSpaceOrTab(line[1]));
		const breakRun = char !== "+" && isRunOf(line, char);
		const thematic = breakRun && (open || [...line].filter((each) => each === char).length >= 3);
		// `---`/`+++` open frontmatter at the document head (`---json`
		// too). A dash line may be a setext underline or a delimiter row;
		// the delimiter-row shape covers both.
		const frontmatter = (char === "-" || char === "+") && line.startsWith(char.repeat(3));
		const dashLine = char === "-" && reDelimiterRowShaped.test(line);
		return bullet || thematic || frontmatter || dashLine;
	} else {
		return false;
	}
};

/**
 * ASCII punctuation: what a backslash escapes, so `\x` is one cell character.
 */
const reAsciiPunctuation = /[!-/:-@[-`{-~]/;

const literalText = (
	value: string,
	context: InlineContext,
	atLineStart: boolean,
	mdx: boolean,
	followingText: string,
	nonTextFollows: boolean,
): { text: string; atLineStart: boolean } => {
	let out = "";
	let lineStart = atLineStart;
	for (let index = 0; index < value.length; index += 1) {
		const char = value.charAt(index);
		if (char === "\n") {
			// The canonical newline rules, unchanged: they are all structural.
			const adjacent = value[index - 1] === "\n" || value[index + 1] === "\n";
			if (context.singleLine) {
				out += " ";
				lineStart = false;
			} else if (adjacent || lineStart) {
				out += "&#10;";
				lineStart = false;
			} else {
				out += "\n";
				lineStart = true;
			}
			continue;
		}
		if (lineStart) {
			lineStart = false;
			if (char === "\t") {
				out += "&#9;";
				continue;
			}
			if (char === " ") {
				out += "&#32;";
				continue;
			}
			const lineEnd = value.indexOf("\n", index);
			let line = value.slice(index, lineEnd === -1 ? undefined : lineEnd);
			let open = false;
			if (lineEnd === -1) {
				const followingEnd = followingText.indexOf("\n");
				line += followingText.slice(0, followingEnd === -1 ? undefined : followingEnd);
				open = followingEnd === -1;
			}
			const ordered = ORDERED_MARKER.exec(line);
			if (ordered !== null) {
				const after = line[ordered[0].length];
				if (after === undefined || isSpaceOrTab(after)) {
					out += `${ordered[0].slice(0, -1)}\\${ordered[0].slice(-1)}`;
					index += ordered[0].length - 1;
					continue;
				}
			} else if (literalLineOpensBlock(line, open)) {
				out += `\\${char}`;
				continue;
			}
		}
		if (char === "\\") {
			const next = value[index + 1];
			if (next !== undefined && reAsciiPunctuation.test(next)) {
				// An escape pair is atomic — the cell scanner consumes it whole
				// — so an already-escaped `\|` passes through untouched.
				out += `\\${next}`;
				index += 1;
				continue;
			}
			// A value-final backslash with more content after it, in any
			// container, would pair with that content's first character: the
			// backtick of inline code, or a table cell's `\|`, freeing the pipe.
			const followed = followingText !== "" || nonTextFollows;
			out += next === undefined && followed ? "\\\\" : "\\";
			continue;
		}
		// Escaped here as well as by the `escapeCellPipes` post-pass: if a raw
		// sibling ended on a lone backslash, a bare `|` would pair with it and
		// eat it, while `\|` leaves an even run the post-pass repairs.
		if (char === "|" && context.inTable) {
			out += "\\|";
			continue;
		}
		if (mdx && (char === "{" || char === "<")) {
			out += `\\${char}`;
			continue;
		}
		if (context.inHeading && char === "#" && isClosingHashRun(value, index, followingText, nonTextFollows)) {
			out += "\\#";
			continue;
		}
		out += char;
	}
	return { text: out, atLineStart: lineStart };
};

// --- inline serialization ---------------------------------------------------

/**
 * Pick the effective emphasis marker, flipping away from a forbidden char.
 */
const emphasisMarker = (fidelity: "*" | "_" | undefined, forbidden: string | undefined): "*" | "_" => {
	const chosen = fidelity ?? "*";
	return chosen === forbidden ? (chosen === "*" ? "_" : "*") : chosen;
};

/**
 * Emit a reference label for its bracket. Labels (and identifiers) in this
 * tree are SOURCE-FORM — the parser keeps character escapes unparsed, per
 * the mdast identifier contract — so the label already carries any escapes
 * its content needs and re-emitting it verbatim reproduces the original
 * bracket exactly. The only intervention is protecting a synthesized label's
 * UNESCAPED square brackets, which would otherwise break the bracket
 * structure. Definitions and references run through this same function, so
 * identifiers agree on both ends and resolution holds.
 */
const escapeLabel = (label: string): string => label.replace(/(?<!\\)([[\]])/g, "\\$1");

/**
 * Whether a destination character forces the pointy-bracket form.
 */
const forcesPointy = (char: string): boolean => {
	const codePoint = char.codePointAt(0);
	// Controls and space (a bare destination allows neither), plus the
	// bracket/backslash set whose bare spelling is ambiguous.
	return (
		(codePoint !== undefined && codePoint <= 0x20) ||
		char === "<" ||
		char === ">" ||
		char === "[" ||
		char === "]" ||
		char === "\\"
	);
};

/**
 * Wrap a link/image destination, pointy-bracketed when it needs it.
 */
const destination = (url: string): string => {
	if (url === "" || A.some([...url], forcesPointy) || !balancedParens(url)) {
		return `<${url.replace(/[<>\\]/g, (char) => `\\${char}`)}>`;
	}
	return url;
};

const balancedParens = (url: string): boolean => {
	let open = 0;
	for (const char of url) {
		if (char === "(") open += 1;
		if (char === ")") {
			open -= 1;
			if (open < 0) return false;
		}
	}
	return open === 0;
};

const titleSuffix = (title: string | undefined): string =>
	title === undefined ? "" : ` "${title.replace(/[\\"]/g, (char) => `\\${char}`)}"`;

/**
 * Serialize an inline-code span with a fence run longer than any interior run.
 */
const inlineCode = (value: string): string => {
	let longest = 0;
	for (const run of value.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
	const fence = "`".repeat(Math.max(1, longest + 1));
	// Padding restores what the spec's one-space stripping will remove: a
	// value touching a backtick at either end, or one that starts AND could
	// lose its real leading/trailing space. An all-space value is never
	// stripped, so it must NOT be padded.
	const allSpace = value !== "" && value.trim() === "";
	const needsPad =
		!allSpace && (value.startsWith("`") || value.endsWith("`") || value.startsWith(" ") || value.endsWith(" "));
	const padded = needsPad ? ` ${value} ` : value;
	return `${fence}${padded}${fence}`;
};

/**
 * The emphasis-family parent whose markers sit at this run's edges. An
 * edge child's marker choice follows the nesting algebra, fidelity second:
 *
 * **Details**
 *
 *   em{strong}     uniform marker  — `***x***` re-parses em{strong}
 *   em{em}         flip            — `**x**` would read as strong
 *   strong{em}     flip            — `***x***` would swap the nesting order
 *   strong{strong} uniform         — a fused 4+ run splits back into strongs
 *
 * Mid-run children only avoid an actually adjacent marker char. On top of
 * either rule, an `_` that would sit against an alphanumeric cannot flank
 * and is corrected to `*` (the intraword-underscore restriction).
 */
interface JunctionGuard {
	readonly parent: "emphasis" | "strong";
	readonly marker: "*" | "_";
}

const flipMarker = (marker: "*" | "_"): "*" | "_" => (marker === "*" ? "_" : "*");

/**
 * The edge-marker choice for a nested emphasis-family child.
 */
const nestedMarker = (
	child: "emphasis" | "strong",
	fidelity: "*" | "_" | undefined,
	guard: JunctionGuard,
): "*" | "_" => {
	if (guard.parent === "emphasis") {
		return child === "strong" ? guard.marker : flipMarker(guard.marker);
	}
	return child === "emphasis" ? flipMarker(guard.marker) : (fidelity ?? guard.marker);
};

/**
 * Serialize a run of phrasing children. `junctionGuard` carries the marker
 * the PARENT emits at this run's edges, so a first or last emphasis-family
 * child flips away from it; mid-run children only flip away from an actual
 * adjacent marker char.
 */
const serializeInlines = (
	children: ReadonlyArray<PhrasingContent>,
	context: InlineContext,
	state: StringifyState,
	startsLine: boolean,
	junctionGuard?: JunctionGuard,
): string => {
	let out = "";
	let atLineStart = startsLine;
	let index = 0;
	let textRunEnd = 0;
	let textRun = "";
	let textRunOffset = 0;
	for (const child of children) {
		guard(state, child);
		const lastChar = out === "" ? undefined : out[out.length - 1];
		const atEdge = out === "" || index === children.length - 1;
		const adjacentMarker = lastChar === "*" || lastChar === "_" ? lastChar : undefined;
		// A literal `!` right before a link's bracket would turn it into an
		// image; escape it at the junction.
		const bangGuard = (): void => {
			if (out.endsWith("!") && !out.endsWith("\\!")) {
				out = `${out.slice(0, -1)}\\!`;
			}
		};
		Match.value(child).pipe(
			Match.discriminator("type")("text", (child) => {
				if (index >= textRunEnd) {
					const values: string[] = [];
					textRunEnd = index;
					while (textRunEnd < children.length) {
						const following = children[textRunEnd];
						if (following?.type !== "text") break;
						values.push(following.value);
						textRunEnd += 1;
					}
					textRun = A.join(values, "");
					textRunOffset = 0;
				}
				textRunOffset += child.value.length;
				const escaped = (child.escapeStyle === "literal" ? literalText : escapeText)(
					child.value,
					context,
					atLineStart,
					state.mdx,
					textRun.slice(textRunOffset),
					textRunEnd < children.length,
				);
				out += escaped.text;
				atLineStart = escaped.atLineStart;
			}),
			Match.discriminator("type")("inlineCode", (child) => {
				out += inlineCode(child.value);
				atLineStart = false;
			}),
			Match.discriminator("type")("html", (child) => {
				out += child.value;
				atLineStart = false;
			}),
			Match.discriminator("type")("break", (child) => {
				if (context.singleLine) {
					out += " ";
					atLineStart = false;
				} else {
					out += child.breakStyle === "spaces" ? "  \n" : "\\\n";
					atLineStart = true;
				}
			}),
			Match.discriminator("type")("emphasis", "strong", (child) => {
				const kind = child.type;
				let marker: "*" | "_";
				if (atEdge && junctionGuard !== undefined) {
					marker = nestedMarker(kind, child.markerChar, junctionGuard);
				} else {
					marker = emphasisMarker(child.markerChar, adjacentMarker);
				}
				// The intraword-underscore restriction: `_` against an
				// alphanumeric cannot open.
				if (marker === "_" && lastChar !== undefined && /[\p{L}\p{N}]/u.test(lastChar)) {
					marker = "*";
				}
				const run = kind === "strong" ? marker.repeat(2) : marker;
				const inner = serializeInlines(child.children, context, state, false, { parent: kind, marker });
				out += `${run}${inner}${run}`;
				atLineStart = false;
			}),
			Match.discriminator("type")("delete", (child) => {
				out += `~~${serializeInlines(child.children, context, state, false)}~~`;
				atLineStart = false;
			}),
			Match.discriminator("type")("link", (child) => {
				bangGuard();
				out += `[${serializeInlines(child.children, context, state, false)}](${destination(child.url)}${titleSuffix(child.title)})`;
				atLineStart = false;
			}),
			Match.discriminator("type")("image", (child) => {
				const alt = (child.alt ?? "").replace(/[\\[\]]/g, (char) => `\\${char}`);
				out += `![${alt}](${destination(child.url)}${titleSuffix(child.title)})`;
				atLineStart = false;
			}),
			Match.discriminator("type")("linkReference", (child) => {
				// The bracket of a shortcut or collapsed reference IS its
				// label; only a full reference carries free content. Labels go
				// through escapeLabel so definitions agree — see escapeLabel.
				bangGuard();
				const label = escapeLabel(child.label ?? child.identifier);
				if (child.referenceType === "full") {
					const content = serializeInlines(child.children, context, state, false);
					out += `[${content}][${label}]`;
				} else if (child.referenceType === "collapsed") {
					out += `[${label}][]`;
				} else {
					out += `[${label}]`;
				}
				atLineStart = false;
			}),
			Match.discriminator("type")("imageReference", (child) => {
				const label = escapeLabel(child.label ?? child.identifier);
				if (child.referenceType === "full") {
					const alt = (child.alt ?? "").replace(/[\\[\]]/g, (char) => `\\${char}`);
					out += `![${alt}][${label}]`;
				} else if (child.referenceType === "collapsed") {
					out += `![${label}][]`;
				} else {
					out += `![${label}]`;
				}
				atLineStart = false;
			}),
			Match.discriminator("type")("footnoteReference", (child) => {
				out += `[^${escapeLabel(child.label ?? child.identifier)}]`;
				atLineStart = false;
			}),
			Match.discriminator("type")("mdxJsxTextElement", (child) => {
				out += serializeMdxJsxText(child, context, state);
				atLineStart = false;
			}),
			Match.discriminator("type")("mdxTextExpression", (child) => {
				out += mdxExpression(child.value);
				atLineStart = false;
			}),
			Match.exhaustive,
		);
		index += 1;
		unguard(state);
	}
	return out;
};

// --- MDX serialization ------------------------------------------------------
//
// Oracle parity: mdast-util-mdx-jsx@3.2.0's `mdxJsxToMarkdown` with its
// defaults (quote `"`, no quoteSmart, spaced self-closing `<a />`, no
// printWidth — attributes wrap onto their own lines only when one carries a
// line ending), mdast-util-mdx-expression@2.0.1's `{expr}` handler with
// two-space continuation indentation, and mdast-util-mdxjs-esm@2.0.1's
// verbatim value. Child BLOCK content inside a flow element follows this
// package's canonical table (bullet `-`, ATX headings, ...), not the oracle's
// to-markdown defaults — the MDX structure is oracle-shaped, the markdown
// inside it is canonical.

/**
 * The tag string of every MDX node type.
 */
const MDX_NODE_TYPES = HashSet.fromIterable<string>([
	"mdxJsxFlowElement",
	"mdxJsxTextElement",
	"mdxFlowExpression",
	"mdxTextExpression",
	"mdxjsEsm",
]);

/**
 * The minimal structural shape the MDX presence scan needs.
 */
interface WalkableNode {
	readonly type: string;
	readonly children?: ReadonlyArray<WalkableNode>;
}

/**
 * Whether the tree carries any MDX node — iterative, deliberately unguarded.
 */
const treeContainsMdx = (root: WalkableNode): boolean => {
	const stack: WalkableNode[] = [root];
	while (stack.length > 0) {
		const node = stack.pop();
		if (node === undefined) break;
		if (HashSet.has(MDX_NODE_TYPES, node.type)) {
			return true;
		}
		if (node.children !== undefined) {
			for (const child of node.children) {
				stack.push(child);
			}
		}
	}
	return false;
};

/**
 * The oracle's `indentLines` line model (mdast-util-to-markdown
 * `lib/util/indent-lines.js`): lines split on every terminator spelling
 * (`\r\n`, `\n`, bare `\r`), terminators preserved verbatim between the
 * mapped lines, and `blank` meaning an empty line — so a blank CRLF line
 * stays bare instead of having a retained `\r` treated as content.
 */
const mapMdxLines = (value: string, map: (line: string, index: number, blank: boolean) => string): string => {
	const eol = /\r?\n|\r/g;
	const result: string[] = [];
	let start = 0;
	let index = 0;
	for (let match = eol.exec(value); match !== null; match = eol.exec(value)) {
		const line = value.slice(start, match.index);
		result.push(map(line, index, line === ""), match[0]);
		start = match.index + match[0].length;
		index += 1;
	}
	const last = value.slice(start);
	result.push(map(last, index, last === ""));
	return result.join("");
};

/**
 * Serialize an MDX expression body between braces. Continuation lines take
 * the oracle's two-space indent; the first line and blank lines take none.
 */
const mdxExpression = (value: string): string =>
	`{${mapMdxLines(value, (line, index, blank) => (index === 0 || blank ? line : `  ${line}`))}}`;

/**
 * Serialize one JSX attribute. A `null` or absent value is a boolean
 * attribute; a string value is quoted with `"` (the oracle default), the
 * quote itself escaped as `&#x22;` exactly as `stringify-entities` spells
 * it; an expression value goes between braces.
 */
const serializeMdxAttribute = (attribute: MdxJsxAttributeContent): string => {
	if (attribute.type === "mdxJsxExpressionAttribute") {
		return `{${attribute.value}}`;
	}
	const value = attribute.value;
	if (value === undefined || value === null) {
		return attribute.name;
	}
	if (P.isString(value)) {
		return `${attribute.name}="${value.replaceAll('"', "&#x22;")}"`;
	}
	return `${attribute.name}={${value.value}}`;
};

/**
 * Serialize a text (phrasing) JSX element.
 */
const serializeMdxJsxText = (node: MdxJsxTextElement, context: InlineContext, state: StringifyState): string => {
	const attributes = node.attributes.map(serializeMdxAttribute);
	const selfClosing = node.name !== null && node.children.length === 0;
	let out = `<${node.name ?? ""}`;
	if (attributes.length > 0) {
		out += ` ${attributes.join(" ")}`;
	}
	if (selfClosing) {
		return `${out} />`;
	}
	out += ">";
	out += serializeInlines(node.children, context, state, false);
	out += `</${node.name ?? ""}>`;
	return out;
};

/**
 * Prefix every line of a rendered child block; blank lines stay bare.
 */
const indentBlockLines = (content: string, indent: string): string =>
	mapMdxLines(content, (line, _index, blank) => (blank ? line : `${indent}${line}`));

/**
 * Serialize a flow (block) JSX element: opening tag (attributes on their own
 * lines when one carries a line ending), children as indented block layout,
 * closing tag — the oracle's `mdxElement` flow branch.
 */
const serializeMdxJsxFlow = (node: MdxJsxFlowElement, state: StringifyState): string => {
	const currentIndent = "  ".repeat(state.jsxDepth);
	const attributes = node.attributes.map(serializeMdxAttribute);
	const selfClosing = node.name !== null && node.children.length === 0;
	const attributesOnOneLine = attributes.join(" ");
	const attributesOnTheirOwnLine = /[\r\n]/.test(attributesOnOneLine);
	let value = `${currentIndent}<${node.name ?? ""}`;
	if (attributesOnTheirOwnLine) {
		// Only the first line of each attribute is indented — attribute
		// VALUES cannot be re-indented without changing them.
		value += `\n${attributes.map((attribute) => `${currentIndent}  ${attribute}`).join("\n")}\n${currentIndent}`;
	} else if (attributesOnOneLine !== "") {
		value += ` ${attributesOnOneLine}`;
	}
	if (selfClosing) {
		value += `${attributesOnTheirOwnLine ? "" : " "}/`;
	}
	value += ">";
	if (node.children.length > 0) {
		state.jsxDepth += 1;
		const childIndent = "  ".repeat(state.jsxDepth);
		const parts = node.children.map((child) => {
			// A nested flow element indents itself (it reads the deeper
			// jsxDepth); every other block is rendered flush and indented
			// here, blank lines excepted — the oracle's containerFlow.
			if (child.type === "mdxJsxFlowElement") {
				guard(state, child);
				const rendered = serializeMdxJsxFlow(child, state);
				unguard(state);
				return rendered;
			}
			return indentBlockLines(serializeBlocks([child], state), childIndent);
		});
		state.jsxDepth -= 1;
		value += `\n${parts.join("\n\n")}\n`;
	}
	if (!selfClosing) {
		value += `${currentIndent}</${node.name ?? ""}>`;
	}
	return value;
};

// --- block serialization ----------------------------------------------------

/**
 * Prefix every line of `content`; blank lines take the trimmed prefix.
 */
const prefixLines = (content: string, prefix: string, blankPrefix: string): string =>
	content
		.split("\n")
		.map((line) => (line === "" ? blankPrefix : `${prefix}${line}`))
		.join("\n");

/**
 * First line gets `marker`, continuation lines get spaces of its width.
 */
const hangingIndent = (content: string, marker: string): string => {
	const lines = content.split("\n");
	const indent = " ".repeat(marker.length);
	return lines
		.map((line, index) => {
			if (index === 0) return `${marker}${line}`;
			return line === "" ? "" : `${indent}${line}`;
		})
		.join("\n");
};

const serializeCode = (node: Code, forceFence: boolean): string => {
	// The parser's code values end with the block's final line terminator;
	// it belongs to block structure, not content, on the way back out.
	const value = node.value.endsWith("\n") ? node.value.slice(0, -1) : node.value;
	const lines = value === "" ? [] : value.split("\n");
	const indentedRepresentable =
		!forceFence &&
		node.fenceChar === undefined &&
		node.lang === undefined &&
		node.meta === undefined &&
		lines.length > 0 &&
		lines[0] !== "" &&
		lines[lines.length - 1] !== "";
	if (indentedRepresentable) {
		return lines.map((line) => (line === "" ? "" : `    ${line}`)).join("\n");
	}
	const char = node.fenceChar ?? "`";
	let longest = 0;
	const runs = value.match(char === "`" ? /`+/g : /~+/g) ?? [];
	for (const run of runs) longest = Math.max(longest, run.length);
	const length = Math.max(3, node.fenceLength ?? 0, longest + 1);
	const fence = char.repeat(length);
	const info = `${node.lang ?? ""}${node.meta !== undefined ? ` ${node.meta}` : ""}`;
	const body = value === "" ? "" : `${value}\n`;
	return `${fence}${info}\n${body}${fence}`;
};

const setextUnderline = (heading: Heading, content: string): string => {
	const lastLine = content.split("\n").at(-1) ?? "";
	const char = heading.depth === 1 ? "=" : "-";
	return char.repeat(Math.max(1, lastLine.length));
};

const serializeHeading = (heading: Heading, state: StringifyState): string => {
	// Setext content IS a line start (nothing precedes it on its line), so
	// the line-start escapes apply; ATX content follows the `# ` prefix.
	const setext = heading.headingStyle === "setext" && heading.depth <= 2;
	const content = serializeInlines(heading.children, HEADING_CONTEXT, state, setext);
	if (setext && content !== "") {
		return `${content}\n${setextUnderline(heading, content)}`;
	}
	const hashes = "#".repeat(heading.depth);
	return content === "" ? hashes : `${hashes} ${content}`;
};

const serializeDefinition = (node: Definition): string =>
	`[${escapeLabel(node.label ?? node.identifier)}]: ${destination(node.url)}${titleSuffix(node.title)}`;

const serializeFootnoteDefinition = (node: FootnoteDefinition, state: StringifyState): string => {
	// The definition's four-space continuation indent stacks UNDER the JSX
	// indent: the oracle's inferDepth breaks only at blockquote and listItem,
	// so a flow element nested through a footnote definition keeps counting
	// its JSX ancestors and self-indents one step deeper. No jsxDepth reset.
	const content = serializeBlocks(node.children, state);
	const lines = content.split("\n");
	const marker = `[^${escapeLabel(node.label ?? node.identifier)}]:`;
	// Indented code cannot share the marker line — its leading spaces would
	// be stripped as marker padding and the line would re-parse as a
	// paragraph. The bare-marker form starts the content on its own line.
	const bareMarker = node.children[0]?.type === "code";
	if (bareMarker) {
		return [marker, ...lines.map((line) => (line === "" ? "" : `    ${line}`))].join("\n");
	}
	return lines
		.map((line, index) => {
			if (index === 0) return `${marker} ${line}`;
			return line === "" ? "" : `    ${line}`;
		})
		.join("\n");
};

const alignCell = (align: "left" | "right" | "center" | null | undefined): string =>
	Match.value(align).pipe(
		Match.when("left", (_) => ":--"),
		Match.when("right", (_) => "--:"),
		Match.when("center", (_) => ":-:"),
		Match.orElse(() => "---"),
	);

/**
 * Escape every cell pipe the GFM cell splitter would read as a column
 * boundary. The splitter consumes a backslash and the punctuation after it as
 * one character, so `\\` is an escaped backslash: a pipe is escaped already
 * iff the run of backslashes directly before it has odd length, and needs a
 * `\` iff that run is even, zero included.
 */
const escapeCellPipes = (content: string): string => {
	let out = "";
	let backslashes = 0;
	for (const char of content) {
		if (char === "|" && backslashes % 2 === 0) out += "\\";
		backslashes = char === "\\" ? backslashes + 1 : 0;
		out += char;
	}
	return out;
};

const serializeTable = (table: Table, state: StringifyState): string => {
	const columnCount = A.reduce(table.children, 1, (count, row) => Math.max(count, row.children.length));
	const rows = table.children.map((row) => {
		guard(state, row);
		const cells = row.children.map((cell) => {
			guard(state, cell);
			// Text-level pipes are escaped by the cell context; anything a
			// nested emission smuggled through raw (a code span, raw HTML, a
			// destination) gets caught here — the cell splitter unescapes `\|`
			// everywhere in a cell, code spans included, so this is lossless.
			const content = escapeCellPipes(serializeInlines(cell.children, CELL_CONTEXT, state, false));
			unguard(state);
			return content;
		});
		unguard(state);
		while (cells.length < columnCount) cells.push("");
		return `| ${cells.join(" | ")} |`;
	});
	const alignRow = `| ${A.makeBy(columnCount, (column) => alignCell(table.align?.[column])).join(" | ")} |`;
	const [header, ...body] = rows;
	return [header ?? `| ${A.makeBy(columnCount, () => "").join(" | ")} |`, alignRow, ...body].join("\n");
};

/**
 * The marker actually used by a list, for adjacency comparison.
 */
const effectiveListMarker = (list: List, flipped: boolean): string => {
	if (list.ordered === true) {
		const delimiter = list.delimiter ?? ".";
		return flipped ? (delimiter === "." ? ")" : ".") : delimiter;
	}
	const bullet = list.bulletChar ?? "-";
	return flipped ? (bullet === "-" ? "*" : "-") : bullet;
};

const serializeListItem = (item: ListItem, marker: string, state: StringifyState, tight: boolean): string => {
	guard(state, item);
	// In a tight list a blank line anywhere inside an item would loosen the
	// whole list on re-parse, so same-item block pairs join with a bare
	// newline wherever the interruption rules allow it; pairs that genuinely
	// need the blank line are the documented tight-multi-block edge.
	// The item's hanging indent owns indentation from here in, so the JSX
	// indent counter restarts (the oracle's inferDepth break).
	const savedJsxDepth = state.jsxDepth;
	state.jsxDepth = 0;
	const inner = serializeBlocks(item.children, state, tight);
	state.jsxDepth = savedJsxDepth;
	unguard(state);
	const checkbox = item.checked === undefined ? "" : item.checked ? "[x] " : "[ ] ";
	const content = `${checkbox}${inner}`;
	if (content === "") return marker.trimEnd();
	return hangingIndent(content, marker);
};

const serializeList = (list: List, state: StringifyState, flipped: boolean): string => {
	const tight = !(list.spread ?? false);
	const items = list.children.map((item, index) => {
		const marker =
			list.ordered === true
				? `${(list.start ?? 1) + index}${effectiveListMarker(list, flipped)} `
				: `${effectiveListMarker(list, flipped)} `;
		return serializeListItem(item, marker, state, tight);
	});
	return items.join(tight ? "\n" : "\n\n");
};

type Block = FlowContent | Frontmatter | MdxjsEsm | Paragraph;

/**
 * Whether `next` interrupts a paragraph without a blank line before it.
 */
const interruptsParagraph = (next: Block): boolean =>
	Match.value(next).pipe(
		Match.discriminator("type")("list", (next) => next.ordered !== true || (next.start ?? 1) === 1),
		Match.discriminator("type")("blockquote", "thematicBreak", () => true),
		Match.discriminator("type")("heading", (next) => next.headingStyle !== "setext"),
		Match.discriminator("type")("code", (next) => next.fenceChar !== undefined || next.lang !== undefined),
		Match.orElse(() => false),
	);

/**
 * Whether `prev` and `next` may sit on adjacent lines with no blank line
 * between them without either absorbing the other on re-parse. Drives tight
 * list items; anything not provably safe takes the blank line.
 */
const canJoinWithoutBlank = (prev: Block, next: Block): boolean =>
	Match.value(prev).pipe(
		Match.discriminator("type")("heading", () => true),
		Match.discriminator("type")("thematicBreak", () => true),
		Match.discriminator("type")("code", (prev) => {
			// A closed fence self-terminates. Indented code ends at the first
			// insufficiently indented line — but another indented block would
			// merge into it.
			if (prev.fenceChar !== undefined || prev.lang !== undefined) return true;
			return !(next.type === "code" && next.fenceChar === undefined && next.lang === undefined);
		}),
		Match.discriminator("type")("paragraph", () => interruptsParagraph(next)),
		Match.discriminator("type")(
			"blockquote",
			() => next.type !== "blockquote" && next.type !== "paragraph" && interruptsParagraph(next),
		),
		Match.orElse(() => false),
	);

/**
 * Serialize a sequence of flow blocks, handling sibling adjacency. With
 * `tight`, safe pairs join with a bare newline (tight-list items).
 */
const serializeBlocks = (children: ReadonlyArray<Block>, state: StringifyState, tight = false): string => {
	const parts: string[] = [];
	const nodes: Block[] = [];
	let previous: Block | undefined;
	let previousListMarker: string | undefined;
	for (const child of children) {
		guard(state, child);
		Match.value(child).pipe(
			Match.discriminator("type")("paragraph", (child) => {
				parts.push(serializeInlines(child.children, FLOW_CONTEXT, state, true));
				previousListMarker = undefined;
			}),
			Match.discriminator("type")("heading", (child) => {
				parts.push(serializeHeading(child, state));
				previousListMarker = undefined;
			}),
			Match.discriminator("type")("thematicBreak", (child) => {
				parts.push((child.markerChar ?? "*").repeat(3));
				previousListMarker = undefined;
			}),
			Match.discriminator("type")("code", (child) => {
				// An indented block right after a list would be absorbed into
				// its last item on re-parse; force a fence there.
				parts.push(serializeCode(child, previous?.type === "list"));
				previousListMarker = undefined;
			}),
			Match.discriminator("type")("html", (child) => {
				parts.push(child.value);
				previousListMarker = undefined;
			}),
			Match.discriminator("type")("blockquote", (child) => {
				// A blockquote's `> ` prefix owns indentation from here in, so
				// the JSX indent counter restarts (the oracle's inferDepth
				// break at blockquote/listItem).
				const savedJsxDepth = state.jsxDepth;
				state.jsxDepth = 0;
				const inner = serializeBlocks(child.children, state);
				state.jsxDepth = savedJsxDepth;
				parts.push(prefixLines(inner, "> ", ">"));
				previousListMarker = undefined;
			}),
			Match.discriminator("type")("list", (child) => {
				const flipped = previousListMarker !== undefined && previousListMarker === effectiveListMarker(child, false);
				parts.push(serializeList(child, state, flipped));
				previousListMarker = effectiveListMarker(child, flipped);
			}),
			Match.discriminator("type")("definition", (child) => {
				parts.push(serializeDefinition(child));
				previousListMarker = undefined;
			}),
			Match.discriminator("type")("footnoteDefinition", (child) => {
				parts.push(serializeFootnoteDefinition(child, state));
				previousListMarker = undefined;
			}),
			Match.discriminator("type")("table", (child) => {
				parts.push(serializeTable(child, state));
				previousListMarker = undefined;
			}),
			Match.discriminator("type")("frontmatter", (child) => {
				const open = child.format === "toml" ? "+++" : child.format === "json" ? "---json" : "---";
				const close = child.format === "toml" ? "+++" : "---";
				parts.push(child.value === "" ? `${open}\n${close}` : `${open}\n${child.value}\n${close}`);
				previousListMarker = undefined;
			}),
			Match.discriminator("type")("mdxJsxFlowElement", (child) => {
				parts.push(serializeMdxJsxFlow(child, state));
				previousListMarker = undefined;
			}),
			Match.discriminator("type")("mdxFlowExpression", (child) => {
				parts.push(mdxExpression(child.value));
				previousListMarker = undefined;
			}),
			Match.discriminator("type")("mdxjsEsm", (child) => {
				// Verbatim, the oracle's handler: the value IS the emitted
				// block, statement terminators included as written.
				parts.push(child.value);
				previousListMarker = undefined;
			}),
			Match.exhaustive,
		);
		previous = child;
		nodes.push(child);
		unguard(state);
	}
	if (!tight) return parts.join("\n\n");
	let out = "";
	for (let index = 0; index < parts.length; index += 1) {
		if (index > 0) {
			const prev = nodes[index - 1];
			const next = nodes[index];
			if (prev !== undefined && next !== undefined) {
				out += canJoinWithoutBlank(prev, next) ? "\n" : "\n\n";
			}
		}
		out += parts[index] ?? "";
	}
	return out;
};

/**
 * Serialize a document tree to canonical markdown source.
 *
 * **Details**
 *
 * Throws the raw `GuardExceeded` carrier when the tree nests past
 * `MAX_NESTING_DEPTH`; the facade materializes the typed error. Output is
 * empty for an empty root and ends with exactly one newline otherwise.
 *
 * **Example** (Serialize an empty document)
 *
 * ```ts
 * import { stringifyTree } from "@beep/scratchpad/effected/markdown/internal/stringify";
 * import type { Root } from "@beep/scratchpad/effected/markdown/MarkdownNode";
 *
 * const point = { line: 1, column: 1, offset: 0 };
 * const root: Root = {
 *   type: "root",
 *   children: [],
 *   position: { start: point, end: point }
 * };
 * console.log(JSON.stringify(stringifyTree(root))) // ""
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const stringifyTree = (root: Root): string => {
	const state: StringifyState = { depth: 0, jsxDepth: 0, mdx: treeContainsMdx(root) };
	const body = serializeBlocks(root.children, state);
	return body === "" ? "" : `${body}\n`;
};
