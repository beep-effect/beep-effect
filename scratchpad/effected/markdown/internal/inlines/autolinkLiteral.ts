// Ported from cmark-gfm@0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
// Copyright (c) 2014, John MacFarlane; Copyright (c) 2015, GitHub, Inc.
// License: BSD-2-Clause
//
// `extensions/autolink.c`: GFM autolink literals — a bare `www.` host, a bare
// `http`/`https`/`ftp` URL, and a bare email address all become links with no
// markup around them.
//
// WHERE THIS HOOKS, and why it is split in two. Upstream splits it too, and
// the split is not incidental:
//
//   * `www.` and scheme literals are INLINE constructs, registered on the
//     trigger characters `w` and `:` (upstream's `special_inline_chars`).
//     They see the RAW subject, which is what a package that records byte
//     offsets needs — an entity or a backslash escape inside the run has not
//     been decoded yet, so `scanner.pos` still indexes the source and the
//     segment table still maps it.
//   * Email literals are a POSTPROCESS over the finished node list
//     (upstream's `postprocess`/`postprocess_text`), because recognizing one
//     means scanning BACKWARDS over text the parser already consumed, past
//     characters — `_` above all — that may have gone onto the delimiter
//     stack. Doing that mid-parse would mean unlinking a node a live
//     delimiter still points at. After `processEmphasis` has run there is no
//     stack left to corrupt.
//
// Both halves refuse to fire inside a link: the inline constructs check the
// bracket stack (upstream's `cmark_inline_parser_in_bracket`), and the
// postprocess skips every `link`/`linkReference` subtree (upstream's
// `in_link` flag). Code spans and raw HTML are not text nodes, so neither
// half can see inside one.
//
// Divergence from the GFM spec text, recorded deliberately: the spec's
// "Autolinks (extension)" section describes `www.`, `http`, `https` and
// email only, but the vendored C at this pin also linkifies `ftp://`
// (`sd_autolink_issafe`) and `xmpp:` addresses including a `/resource` path
// (`postprocess_text`). `extensions.txt` — the other vendored corpus —
// asserts both, so the C wins and both are implemented.
//
// Registered under the `gfm` dialect only.

import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { InlineNode } from "../inlineNode.ts";
import { appendChild, childrenOf, insertAfter, makeInlineNode, unlink } from "../inlineNode.ts";
import type { InlineConstruct, InlineScanner } from "../inlineTypes.ts";

const C_LOWER_W = 0x77;
const C_COLON = 0x3a;

/** `cmark_isspace`: ASCII only, deliberately — upstream's URL scan uses it. */
const reAsciiSpace = /^[ \t\n\v\f\r]$/;
const reAlnum = /^[0-9A-Za-z]$/;
const reAlpha = /^[A-Za-z]$/;

// `cmark_utf8proc_is_space` and `cmark_utf8proc_is_punctuation`, which the
// HOST-character test uses (a different, wider test than `cmark_isspace`).
// Note what is NOT here: the Unicode S categories. Upstream's punctuation
// table is the P categories plus ASCII punctuation, so a symbol such as an
// emoji is a valid host character — `http://🍄.ga/` links, and the corpus
// says so.
const reUnicodeSpace = /^[\t\n\f\r \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]$/;
const reAsciiPunctuation = /^[!-/:-@[-`{-~]$/;
const reUnicodePunctuation = /^\p{P}$/u;

/** The schemes `sd_autolink_issafe` whitelists, in its order. */
const SAFE_SCHEMES: ReadonlyArray<string> = ["http://", "https://", "ftp://"];

/** Whether the code point at `index` may appear in a host name. */
const isValidHostChar = (subject: string, index: number): boolean => {
	// All callers supply an index strictly inside the subject.
	const code = O.getOrThrow(Str.codePointAt(subject, index));
	const char = String.fromCodePoint(code);
	if (reUnicodeSpace.test(char)) {
		return false;
	}
	return !(code < 128 ? reAsciiPunctuation.test(char) : reUnicodePunctuation.test(char));
};

/**
 * `autolink_delim`: pull the link's end back off trailing punctuation.
 *
 * **Details**
 *
 * Two rules beyond "drop the trailing mark". Parens are BALANCED rather than
 * simply stripped, so `www.a.com/q_(bar)` keeps its group while `(www.a.com/q)`
 * gives its closer back to the surrounding text. And a trailing `;` is
 * examined for an entity reference: `…&hl;` cuts at the `&`, because the
 * writer will re-escape that run and the link must not swallow it.
 */
const autolinkDelim = (subject: string, base: number, end: number): number => {
	let linkEnd = end;
	let opening = 0;
	let closing = 0;

	for (let index = 0; index < linkEnd; index += 1) {
		const char = subject.charAt(base + index);
		if (char === "(") {
			opening += 1;
		} else if (char === ")") {
			closing += 1;
		}
	}

	// Trimming cannot consume the validated prefix (www., ://, or @).
	while (true) {
		const char = subject.charAt(base + linkEnd - 1);
		if (char === ")") {
			if (closing <= opening) {
				return linkEnd;
			}
			closing -= 1;
			linkEnd -= 1;
			continue;
		}
		if ("?!.,:*_~'\"".includes(char)) {
			linkEnd -= 1;
			continue;
		}
		if (char === ";") {
			// Each candidate retains its www., ://, or @ prefix, so a
			// trailing semicolon always has a preceding character.
			let newEnd = linkEnd - 2;
			while (newEnd > 0 && reAlpha.test(subject.charAt(base + newEnd))) {
				newEnd -= 1;
			}
			if (newEnd < linkEnd - 2 && subject.charAt(base + newEnd) === "&") {
				linkEnd = newEnd;
			} else {
				linkEnd -= 1;
			}
			continue;
		}
		return linkEnd;
	}
};

/**
 * `check_domain`: how much of `subject` from `base` is a plausible domain.
 *
 * **Details**
 *
 * The underscore rule is the interesting one and it is a HOST-name rule, not
 * a domain-name rule: an `_` in either of the last two dot-separated segments
 * disqualifies the whole match (`www.xxx._yyy.zzz` is literal text), while one
 * further left is fine (`www._xxx.yyy.zzz` links). The `np > 10` escape hatch
 * is upstream's fix for GHSA-29g3-96g3-jg6c — a very long segmented run stops
 * being re-examined rather than going quadratic.
 */
const checkDomain = (subject: string, base: number, size: number, allowShort: boolean): number => {
	let index = 1;
	let dots = 0;
	let underscoresPenultimate = 0;
	let underscoresLast = 0;

	for (; index < size - 1; index += 1) {
		if (subject.charAt(base + index) === "\\" && index < size - 2) {
			index += 1;
		}
		const char = subject.charAt(base + index);
		if (char === "_") {
			underscoresLast += 1;
		} else if (char === ".") {
			underscoresPenultimate = underscoresLast;
			underscoresLast = 0;
			dots += 1;
		} else if (!isValidHostChar(subject, base + index) && char !== "-") {
			break;
		}
	}

	if ((underscoresPenultimate > 0 || underscoresLast > 0) && dots <= 10) {
		return 0;
	}

	if (allowShort) {
		return index;
	}
	return dots > 0 ? index : 0;
};

/** `sd_autolink_issafe`: does the run at `start` open with a whitelisted scheme. */
const isSafeScheme = (subject: string, start: number, length: number): boolean =>
	SAFE_SCHEMES.some(
		(scheme) =>
			length > scheme.length &&
			subject.slice(start, start + scheme.length).toLowerCase() === scheme &&
			isValidHostChar(subject, start + scheme.length),
	);

/** Extend a matched prefix to the next space or `<`, as both matchers do. */
const extendToBoundary = (subject: string, base: number, from: number, size: number): number => {
	let linkEnd = from;
	while (linkEnd < size) {
		const char = subject.charAt(base + linkEnd);
		if (reAsciiSpace.test(char) || char === "<") {
			break;
		}
		linkEnd += 1;
	}
	return linkEnd;
};

/** Append a literal-autolink `link` node spanning `[start, end)`. */
const appendLiteralLink = (scanner: InlineScanner, start: number, end: number, url: string): void => {
	const text = scanner.subject.slice(start, end);
	const node = makeInlineNode("link", start, end);
	node.data.url = url;
	appendChild(node, makeInlineNode("text", start, end, text));
	scanner.append(node);
	scanner.pos = end;
};

/**
 * `www_match`: a `www.` host with no scheme, which links to `http://` + itself.
 *
 * **Details**
 *
 * The preceding character is the gate — start of line, whitespace, or one of
 * `*`, `_`, `~`, `(` — which is what keeps `xwww.a.com` from linking.
 *
 * **Example** (Register bare www hosts)
 *
 * ```ts
 * import { wwwAutolinkConstruct } from "@beep/scratchpad/effected/markdown/internal/inlines/autolinkLiteral"
 *
 * console.log(wwwAutolinkConstruct.triggers.map((code) => String.fromCharCode(code)).join("")) // w
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const wwwAutolinkConstruct: InlineConstruct = {
	name: "wwwAutolink",
	triggers: [C_LOWER_W],
	parse: (scanner) => {
		if (scanner.brackets !== undefined) {
			return false;
		}

		const start = scanner.pos;
		if (start > 0) {
			const before = scanner.subject.charAt(start - 1);
			if (!"*_~(".includes(before) && !reAsciiSpace.test(before)) {
				return false;
			}
		}

		const size = scanner.subject.length - start;
		if (size < 4 || scanner.subject.slice(start, start + 4) !== "www.") {
			return false;
		}

		const domain = checkDomain(scanner.subject, start, size, false);
		if (domain === 0) {
			return false;
		}

		const linkEnd = autolinkDelim(scanner.subject, start, extendToBoundary(scanner.subject, start, domain, size));

		appendLiteralLink(scanner, start, start + linkEnd, `http://${scanner.subject.slice(start, start + linkEnd)}`);
		return true;
	},
};

/**
 * `url_match`: a bare `http://`, `https://` or `ftp://` URL.
 *
 * **Details**
 *
 * The trigger is the `:`, so the scheme itself is already behind the cursor
 * and already emitted as text. Upstream calls `cmark_node_unput` to take it
 * back; `scanner.unputText` is that, and its refusal is a real bail-out —
 * when the scheme's characters did not come from plain text nodes (a decoded
 * entity, say) the run is not the source text it appears to be and no link
 * forms.
 *
 * **Example** (Register the URL colon trigger)
 *
 * ```ts
 * import { urlAutolinkConstruct } from "@beep/scratchpad/effected/markdown/internal/inlines/autolinkLiteral"
 *
 * console.log(urlAutolinkConstruct.triggers.map((code) => String.fromCharCode(code)).join("")) // :
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const urlAutolinkConstruct: InlineConstruct = {
	name: "urlAutolink",
	triggers: [C_COLON],
	parse: (scanner) => {
		if (scanner.brackets !== undefined) {
			return false;
		}

		const colon = scanner.pos;
		const { subject } = scanner;
		const size = subject.length - colon;
		if (size < 4 || subject.charAt(colon + 1) !== "/" || subject.charAt(colon + 2) !== "/") {
			return false;
		}

		let rewind = 0;
		while (rewind < colon && reAlpha.test(subject.charAt(colon - rewind - 1))) {
			rewind += 1;
		}

		if (!isSafeScheme(subject, colon - rewind, size + rewind)) {
			return false;
		}

		const domain = checkDomain(subject, colon + 3, size - 3, true);
		if (domain === 0) {
			return false;
		}

		const linkEnd = autolinkDelim(subject, colon, extendToBoundary(subject, colon, 3 + domain, size));

		if (!scanner.unputText(rewind)) {
			return false;
		}

		const start = colon - rewind;
		const end = colon + linkEnd;
		appendLiteralLink(scanner, start, end, subject.slice(start, end));
		return true;
	},
};

// --- email literals: the postprocess ----------------------------------------

/** One email run found in a merged text run, in that run's coordinates. */
interface EmailMatch {
	readonly from: number;
	readonly to: number;
	readonly url: string;
}

/**
 * `validate_protocol`: is `protocol` the run immediately left of the address,
 * and is it itself preceded by a non-alphanumeric?
 *
 * **Details**
 *
 * The second half is why `mmmmailto:foo@bar.baz` links only `foo@bar.baz`.
 */
const validateProtocol = (protocol: string, data: string, at: number, rewind: number, maxRewind: number): boolean => {
	const length = protocol.length;
	if (length > maxRewind - rewind) {
		return false;
	}
	if (data.slice(at - rewind - length, at - rewind) !== protocol) {
		return false;
	}
	if (length === maxRewind - rewind) {
		return true;
	}
	return !reAlnum.test(data.charAt(at - rewind - length - 1));
};

/**
 * `postprocess_text`: every email address in one merged run of text.
 *
 * **Details**
 *
 * The shape is upstream's, `goto found_at` included — when the forward scan
 * runs into a SECOND `@` the candidate is re-anchored on it rather than
 * abandoned, which is what makes `a@b@c.d` link `b@c.d`. Neither `auto_mailto`
 * nor `np` is reset on that re-entry, because upstream's `goto` jumps past
 * their initializers.
 */
const scanEmails = (data: string): ReadonlyArray<EmailMatch> => {
	const matches: EmailMatch[] = [];
	let start = 0;
	let offset = 0;
	let remaining = data.length;

	while (offset < remaining) {
		const at = data.indexOf("@", start + offset);
		if (at === -1) {
			break;
		}

		let maxRewind = at - (start + offset);
		let autoMailto = true;
		let isXmpp = false;
		let rewind = 0;
		let linkEnd = 1;
		let dots = 0;
		let reanchored = true;
		let abandoned = false;

		while (reanchored) {
			reanchored = false;

			for (rewind = 0; rewind < maxRewind; rewind += 1) {
				const char = data.charAt(start + offset + maxRewind - rewind - 1);
				if (reAlnum.test(char) || ".+-_".includes(char)) {
					continue;
				}
				if (char === ":") {
					if (validateProtocol("mailto:", data, start + offset + maxRewind, rewind, maxRewind)) {
						autoMailto = false;
						continue;
					}
					if (validateProtocol("xmpp:", data, start + offset + maxRewind, rewind, maxRewind)) {
						autoMailto = false;
						isXmpp = true;
						continue;
					}
				}
				break;
			}

			if (rewind === 0) {
				offset += maxRewind + 1;
				abandoned = true;
				break;
			}

			const bound = remaining - offset - maxRewind;
			for (linkEnd = 1; linkEnd < bound; linkEnd += 1) {
				const char = data.charAt(start + offset + maxRewind + linkEnd);
				if (reAlnum.test(char)) {
					continue;
				}
				if (char === "@") {
					offset += maxRewind + 1;
					maxRewind = linkEnd - 1;
					reanchored = true;
					break;
				}
				if (
					char === "." &&
					linkEnd < bound - 1 &&
					reAlnum.test(data.charAt(start + offset + maxRewind + linkEnd + 1))
				) {
					dots += 1;
					continue;
				}
				if (char === "/" && isXmpp) {
					continue;
				}
				if (char !== "-" && char !== "_") {
					break;
				}
			}
		}

		if (abandoned) {
			continue;
		}

		const last = data.charAt(start + offset + maxRewind + linkEnd - 1);
		if (linkEnd < 2 || dots === 0 || (!reAlpha.test(last) && last !== ".")) {
			offset += maxRewind + linkEnd;
			continue;
		}

		linkEnd = autolinkDelim(data, start + offset + maxRewind, linkEnd);

		const from = start + offset + maxRewind - rewind;
		const to = start + offset + maxRewind + linkEnd;
		const text = data.slice(from, to);
		matches.push({ from, to, url: autoMailto ? `mailto:${text}` : text });

		start += offset + maxRewind + linkEnd;
		remaining -= offset + maxRewind + linkEnd;
		offset = 0;
	}

	return matches;
};

/** One text node's contribution to a merged run. */
interface RunPiece {
	readonly node: InlineNode;
	readonly valueStart: number;
}

/** Replace a run of adjacent text nodes with the same text plus its email links. */
const linkifyRun = (pieces: ReadonlyArray<RunPiece>): void => {
	const merged = pieces.map((piece) => piece.node.value).join("");
	const matches = scanEmails(merged);
	if (matches.length === 0) {
		return;
	}

	/**
	 * The local content index a merged-run index came from.
	 *
	 * **Details**
	 *
	 * Exact whenever the contributing node's value is its source characters,
	 * which is every node the text fallback produced. A node whose value was
	 * DECODED — an entity, a backslash escape — is shorter than the source it
	 * spans, so an index inside it clamps to that node's own range rather than
	 * running past its end. An email address holds neither, so this is a
	 * bound, not a rounding.
	 */
	// Boundary queries are nondecreasing, including repeated exact ends.
	let pieceIndex = 0;
	const localAt = (index: number): number => {
		// The run is dense and nonempty; callers query only [0, merged.length].
		let piece = A.getUnsafe(pieces, pieceIndex);
		while (index > piece.valueStart + piece.node.value.length) {
			pieceIndex += 1;
			piece = A.getUnsafe(pieces, pieceIndex);
		}
		const within = index - piece.valueStart;
		return within === piece.node.value.length
			? piece.node.end
			: piece.node.start + Math.min(within, piece.node.end - piece.node.start);
	};

	const replacements: InlineNode[] = [];
	let cursor = 0;

	const pushText = (from: number, to: number): void => {
		if (to <= from) {
			return;
		}
		replacements.push(makeInlineNode("text", localAt(from), localAt(to), merged.slice(from, to)));
	};

	for (const match of matches) {
		pushText(cursor, match.from);
		const start = localAt(match.from);
		const end = localAt(match.to);
		const link = makeInlineNode("link", start, end);
		link.data.url = match.url;
		appendChild(link, makeInlineNode("text", start, end, merged.slice(match.from, match.to)));
		replacements.push(link);
		cursor = match.to;
	}
	pushText(cursor, merged.length);

	// Splice after the run's last node, then drop the originals — the list has
	// no insert-before, and appending keeps the order without needing one.
	const lastPiece = A.getUnsafe(pieces, pieces.length - 1);
	let tail = lastPiece.node;
	for (const replacement of replacements) {
		insertAfter(tail, replacement);
		tail = replacement;
	}
	for (const piece of pieces) {
		unlink(piece.node);
	}
};

/**
 * Turn every bare email address in the finished list into a link.
 *
 * **Details**
 *
 * Iterative on purpose: this walks the tree emphasis and strikethrough just
 * built, whose depth the input controls, and the parser's depth cap does not
 * apply until materialization. A tree walk has no reason to recurse.
 *
 * **Example** (Linkify an email text node)
 *
 * ```ts
 * import { linkifyEmails } from "@beep/scratchpad/effected/markdown/internal/inlines/autolinkLiteral"
 * import { appendChild, makeInlineNode } from "@beep/scratchpad/effected/markdown/internal/inlineNode"
 *
 * const root = makeInlineNode("text", 0, 15)
 * appendChild(root, makeInlineNode("text", 0, 15, "ada@example.org"))
 * linkifyEmails(root)
 * console.log(root.firstChild?.type, root.firstChild?.data.url) // link mailto:ada@example.org
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const linkifyEmails = (root: InlineNode): void => {
	const pending: InlineNode[] = [root];

	while (pending.length > 0) {
		const container = A.getUnsafe(pending, pending.length - 1);
		pending.pop();

		let pieces: RunPiece[] = [];
		let valueLength = 0;

		const flush = (): void => {
			if (pieces.length > 0) {
				linkifyRun(pieces);
			}
			pieces = [];
			valueLength = 0;
		};

		for (const child of childrenOf(container)) {
			if (child.type === "text") {
				pieces.push({ node: child, valueStart: valueLength });
				valueLength += child.value.length;
				continue;
			}

			flush();
			// A formed link is closed to autolinking — upstream's `in_link`
			// flag, which is why `[foo@bar.baz](/x)` stays one link.
			if (child.type !== "link" && child.type !== "linkReference") {
				pending.push(child);
			}
		}

		flush();
	}
};
