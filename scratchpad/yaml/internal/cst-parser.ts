/**
 * YAML 1.2 CST parser — transforms a token stream into a Concrete Syntax Tree.
 *
 * **Details**
 *
 * The CST preserves every character of the original input, including
 * whitespace, comments, and structural indicators. No value interpretation
 * occurs at this stage — `true` is still the string `"true"`. Nesting is
 * capped at `MAX_NESTING_DEPTH + 8` so the composer diagnostic always fires
 * first.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { HashSet, Match } from "effect";
import type { CstNode, CstNodeType } from "./cst.ts";
import { lexAll } from "./lexer.ts";
import type { YamlToken } from "./token.ts";

// ---------------------------------------------------------------------------
// Internal parser state
// ---------------------------------------------------------------------------

interface ParserState {
	readonly tokens: ReadonlyArray<YamlToken>;
	readonly text: string;
	pos: number;
	/** Current collection-nesting depth — see {@link guardDepth}. */
	depth: number;
}

/**
 * Hardening: cap CST nesting so hostile inputs cannot overflow the stack
 * while the tree is being BUILT. Set slightly above the composer's
 * MAX_NESTING_DEPTH (256) so the composer's own guard — which reports the
 * user-facing NestingDepthExceeded diagnostic — always fires first when the
 * capped tree is composed.
 */
const MAX_CST_DEPTH = 256 + 8;

/**
 * When the depth budget is exhausted, consume the current token and return
 * a flat error node instead of recursing. Returns null when within budget.
 */
function guardDepth(state: ParserState): CstNode | null {
	if (state.depth < MAX_CST_DEPTH) return null;
	const token = advance(state);
	return {
		type: "error",
		source: token?.value ?? "",
		offset: token?.offset ?? state.text.length,
		length: token?.length ?? 0,
	};
}

function atEnd(state: ParserState): boolean {
	return state.pos >= state.tokens.length;
}

function peek(state: ParserState): YamlToken | undefined {
	return state.tokens[state.pos];
}

function advance(state: ParserState): YamlToken | undefined {
	const token = state.tokens[state.pos];
	state.pos++;
	return token;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if the current token is a trivia token (whitespace, newline, comment). */
function isTrivia(token: YamlToken): boolean {
	return token.kind === "whitespace" || token.kind === "newline" || token.kind === "comment";
}

/** Check if the current token starts a new document boundary. */
function isDocumentBoundary(token: YamlToken): boolean {
	return token.kind === "document-start" || token.kind === "document-end";
}

/** Build a CstNode from collected children, computing source from the text. */
function makeContainerNode(type: CstNodeType, children: CstNode[], text: string): CstNode {
	if (children.length === 0) {
		return { type, source: "", offset: 0, length: 0, children };
	}
	const first = children[0];
	const last = children[children.length - 1];
	const offset = first.offset;
	const end = last.offset + last.length;
	const source = text.slice(offset, end);
	return { type, source, offset, length: end - offset, children };
}

/**
 * Create a leaf CstNode from a token, using the raw source text.
 *
 * We slice from the original text rather than using `token.value` because
 * the lexer decodes certain tokens (e.g. quoted scalars have quotes stripped
 * and escape sequences resolved in `value`), but the CST must preserve
 * the raw source text exactly as written.
 */
function makeLeafNode(type: CstNodeType, token: YamlToken, text: string): CstNode {
	return {
		type,
		source: text.slice(token.offset, token.offset + token.length),
		offset: token.offset,
		length: token.length,
	};
}

// ---------------------------------------------------------------------------
// Recursive descent parser
// ---------------------------------------------------------------------------

/**
 * Consume trivia tokens (whitespace, newline, comment) and return them as CST nodes.
 */
function consumeTrivia(state: ParserState): CstNode[] {
	const nodes: CstNode[] = [];
	while (!atEnd(state)) {
		const token = peek(state);
		if (token === undefined || !isTrivia(token)) break;
		advance(state);
		if (token.kind === "comment") {
			nodes.push(makeLeafNode("comment", token, state.text));
		} else if (token.kind === "newline") {
			nodes.push(makeLeafNode("newline", token, state.text));
		} else {
			nodes.push(makeLeafNode("whitespace", token, state.text));
		}
	}
	return nodes;
}

/**
 * Consume a single trivia-or-content token and return it as a CST node.
 * Used for tokens that don't form higher-level structures.
 */
const STRUCTURAL_LEAF_KINDS = HashSet.make(
	"flow-separator",
	"block-map-value",
	"block-map-key",
	"block-seq-entry",
	"document-start",
	"document-end",
	"flow-map-start",
	"flow-map-end",
	"flow-seq-start",
	"flow-seq-end",
	"block-map-start",
	"block-seq-start",
	"byte-order-mark",
);

function consumeLeafToken(state: ParserState): CstNode | undefined {
	const token = peek(state);
	if (token === undefined) return undefined;
	advance(state);
	return Match.value(token.kind).pipe(
		Match.when("whitespace", () => makeLeafNode("whitespace", token, state.text)),
		Match.when("newline", () => makeLeafNode("newline", token, state.text)),
		Match.when("comment", () => makeLeafNode("comment", token, state.text)),
		Match.when("scalar", () => makeLeafNode("flow-scalar", token, state.text)),
		Match.when("anchor", () => makeLeafNode("anchor", token, state.text)),
		Match.when("alias", () => makeLeafNode("alias", token, state.text)),
		Match.when("tag", () => makeLeafNode("tag", token, state.text)),
		Match.when("directive", () => makeLeafNode("directive", token, state.text)),
		Match.when((kind) => HashSet.has(STRUCTURAL_LEAF_KINDS, kind), () =>
			makeLeafNode("whitespace", token, state.text),
		),
		Match.orElse(() => makeLeafNode("error", token, state.text)),
	);
}

/**
 * Parse a flow mapping (curly braces).
 */
function parseFlowMapping(state: ParserState): CstNode {
	const guarded = guardDepth(state);
	if (guarded !== null) return guarded;
	state.depth++;
	try {
		return parseFlowMappingInner(state);
	} finally {
		state.depth--;
	}
}

function parseFlowMappingInner(state: ParserState): CstNode {
	const children: CstNode[] = [];
	// Consume the opening { — typed as "whitespace" since brackets are
	// structural punctuation, not scalar content.
	const open = advance(state);
	if (open !== undefined) {
		children.push(makeLeafNode("whitespace", open, state.text));
	}

	while (!atEnd(state)) {
		const token = peek(state);
		if (token === undefined) break;

		if (token.kind === "flow-map-end") {
			const close = advance(state);
			if (close !== undefined) {
				children.push(makeLeafNode("whitespace", close, state.text));
			}
			break;
		}

		if (token.kind === "flow-map-start") {
			children.push(parseFlowMapping(state));
		} else if (token.kind === "flow-seq-start") {
			children.push(parseFlowSequence(state));
		} else {
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) children.push(leaf);
		}
	}

	return makeContainerNode("flow-map", children, state.text);
}

/**
 * Parse a flow sequence: [ ... ]
 */
function parseFlowSequence(state: ParserState): CstNode {
	const guarded = guardDepth(state);
	if (guarded !== null) return guarded;
	state.depth++;
	try {
		return parseFlowSequenceInner(state);
	} finally {
		state.depth--;
	}
}

function parseFlowSequenceInner(state: ParserState): CstNode {
	const children: CstNode[] = [];
	// Consume the opening [ — typed as "whitespace" since brackets are
	// structural punctuation, not scalar content.
	const open = advance(state);
	if (open !== undefined) {
		children.push(makeLeafNode("whitespace", open, state.text));
	}

	while (!atEnd(state)) {
		const token = peek(state);
		if (token === undefined) break;

		if (token.kind === "flow-seq-end") {
			const close = advance(state);
			if (close !== undefined) {
				children.push(makeLeafNode("whitespace", close, state.text));
			}
			break;
		}

		if (token.kind === "flow-map-start") {
			children.push(parseFlowMapping(state));
		} else if (token.kind === "flow-seq-start") {
			children.push(parseFlowSequence(state));
		} else {
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) children.push(leaf);
		}
	}

	return makeContainerNode("flow-seq", children, state.text);
}

/**
 * Parse a block scalar token. The lexer already handles the block scalar
 * content (literal `|` or folded `\>`), so we just need to wrap it.
 */
function parseBlockScalar(state: ParserState): CstNode {
	const token = advance(state);
	if (token === undefined) {
		return { type: "block-scalar", source: "", offset: 0, length: 0 };
	}
	// The lexer gives us a "scalar" token whose raw span in the original text
	// covers the entire block scalar including the indicator.
	// We use token.offset and token.length to get the raw source.
	const source = state.text.slice(token.offset, token.offset + token.length);
	return {
		type: "block-scalar",
		source,
		offset: token.offset,
		length: token.length,
	};
}

/**
 * Check if the current position has a block scalar indicator in the original text.
 */
function isBlockScalarToken(state: ParserState): boolean {
	const token = peek(state);
	if (token?.kind !== "scalar") return false;
	const ch = state.text[token.offset];
	return ch === "|" || ch === ">";
}

/**
 * Check if the last non-trivia child in a CST node list is a value separator
 * (`:`) with no subsequent value content. This indicates the next block
 * structure should be consumed as the mapping value, not ejected as a sibling.
 */
function lastNonTriviaIsValueSep(children: readonly CstNode[]): boolean {
	for (let i = children.length - 1; i >= 0; i--) {
		const c = children[i];
		if (c === undefined) continue;
		if (c.type === "whitespace" && c.source === ":") return true;
		if (c.type === "newline" || c.type === "comment") continue;
		if (c.type === "whitespace") continue;
		// Anchors and tags are metadata that attach to the next value —
		// they don't count as value content for the purpose of this check.
		if (c.type === "anchor" || c.type === "tag") continue;
		return false;
	}
	return false;
}

/**
 * Find the column of the first block-seq-entry in the token stream,
 * skipping the zero-width block-seq-start marker and any trivia.
 * Falls back to `fallback` if no entry is found.
 */
function findFirstSeqEntryColumn(state: ParserState, fallback: number): number {
	for (let i = state.pos; i < state.tokens.length; i++) {
		const t = state.tokens[i];
		if (t === undefined) break;
		if (t.kind === "block-seq-start") continue;
		if (isTrivia(t)) continue;
		if (t.kind === "block-seq-entry") return t.column;
		break;
	}
	return fallback;
}

/**
 * Parse a block mapping at the given indentation level.
 */
function parseBlockMapping(state: ParserState, indent: number): CstNode {
	const guarded = guardDepth(state);
	if (guarded !== null) return guarded;
	state.depth++;
	try {
		return parseBlockMappingInner(state, indent);
	} finally {
		state.depth--;
	}
}

function parseBlockMappingInner(state: ParserState, indent: number): CstNode {
	const children: CstNode[] = [];
	let sawExplicitKey = false;

	// Consume the block-map-start token
	const startToken = peek(state);
	if (startToken?.kind === "block-map-start") {
		advance(state);
	}

	while (!atEnd(state)) {
		const token = peek(state);
		if (token === undefined) break;

		// Stop conditions
		if (isDocumentBoundary(token)) break;

		// If we hit a block-seq-start at same or lower indent, stop — UNLESS
		// the last non-trivia child was a ":" value separator with no value,
		// meaning this sequence is the value of the previous mapping entry.
		// For explicit key mappings, the sequence after ":" is already
		// consumed by parseBlockValue, so this check only applies to
		// sequences appearing on a subsequent line after ":" (not same-line).
		// Also don't stop when we're in the middle of consuming an explicit
		// key (`?` seen, no `:` yet) and the seq IS the explicit key (KK5P,
		// M5DY: `? - a`). The lexer emits block-seq-start at lineIndent
		// which can be <= the mapping indent in this case.
		if (token.kind === "block-seq-start" && token.column <= indent && children.length > 0) {
			if (!lastNonTriviaIsValueSep(children) && !sawExplicitKey) break;
		}

		// Trivia
		if (isTrivia(token)) {
			children.push(...consumeTrivia(state));
			continue;
		}

		// Block map key indicator (?)
		if (token.kind === "block-map-key") {
			// A `?` at a shallower column than this mapping belongs to an
			// ancestor mapping's next explicit entry — stop so the parent
			// consumes it. Without this, a nested map swallows the sibling
			// `? key` and mis-nests subsequent entries.
			if (token.column < indent && children.length > 0) break;
			sawExplicitKey = true;
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) children.push(leaf);
			continue;
		}

		// Block map value indicator (:)
		if (token.kind === "block-map-value") {
			// A `:` at a shallower column belongs to an ancestor mapping
			// (e.g. the explicit-value indicator of the parent's next entry).
			if (token.column < indent && children.length > 0) break;
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) children.push(leaf);
			// After ":", consume the value. Pass explicitKey context so
			// parseBlockValue knows whether inline sequences are valid.
			children.push(...parseBlockValue(state, indent, sawExplicitKey));
			sawExplicitKey = false;
			continue;
		}

		// Scalar (key), anchor, tag, alias
		if (token.kind === "scalar" || token.kind === "anchor" || token.kind === "alias" || token.kind === "tag") {
			// If this content token is at a lower indent than this mapping, it
			// belongs to a parent scope.
			if (token.column < indent && children.length > 0) break;
			// Check if this is a block scalar
			if (isBlockScalarToken(state)) {
				children.push(parseBlockScalar(state));
				continue;
			}
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) children.push(leaf);
			continue;
		}

		// Nested block structures
		if (token.kind === "block-map-start") {
			if (token.column > indent) {
				children.push(parseBlockMapping(state, token.column));
			} else if (token.column === indent) {
				// Same-indent: lexer re-emitted scope marker; consume and continue
				advance(state);
			} else {
				break;
			}
			continue;
		}

		if (token.kind === "block-seq-start") {
			// When `?` introduces an explicit key followed by a block-seq on
			// the same line (`? - a`), the lexer emits block-seq-start at
			// lineIndent but the actual entries are at a deeper column. Use
			// the entry column in that case so parseBlockSequence's indent
			// comparisons match (KK5P, M5DY, M2N8 explicit-? compact-key
			// form). For implicit-key value position (`key: - a`), keep
			// token.column to preserve invalid-input rejection (5U3A).
			const seqIndent = sawExplicitKey ? findFirstSeqEntryColumn(state, token.column) : token.column;
			children.push(parseBlockSequence(state, seqIndent));
			continue;
		}

		if (token.kind === "block-seq-entry") {
			// Compact block sequence as mapping value: when a seq entry appears
			// at the same indent as the mapping and the last non-trivia was a
			// value separator ":", this sequence is the value of the current key.
			// Build a synthetic block-seq container for these entries.
			if (token.column === indent && lastNonTriviaIsValueSep(children)) {
				const seqChildren: CstNode[] = [];
				while (!atEnd(state)) {
					const seqToken = peek(state);
					if (seqToken === undefined) break;
					if (seqToken.kind === "block-seq-entry" && seqToken.column === indent) {
						seqChildren.push(...consumeTrivia(state));
						const entry = consumeLeafToken(state);
						if (entry !== undefined) seqChildren.push(entry);
						// Consume content after the entry dash
						seqChildren.push(...parseSequenceEntryContent(state, indent));
					} else if (isTrivia(seqToken)) {
						seqChildren.push(...consumeTrivia(state));
					} else {
						break;
					}
				}
				if (seqChildren.length > 0) {
					children.push(makeContainerNode("block-seq", seqChildren, state.text));
				}
				continue;
			}
			// This entry belongs to a parent sequence, stop
			if (token.column <= indent) break;
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) children.push(leaf);
			continue;
		}

		// Flow structures
		if (token.kind === "flow-map-start") {
			children.push(parseFlowMapping(state));
			continue;
		}
		if (token.kind === "flow-seq-start") {
			children.push(parseFlowSequence(state));
			continue;
		}

		// Anything else: consume as leaf
		const leaf = consumeLeafToken(state);
		if (leaf !== undefined) children.push(leaf);
	}

	return makeContainerNode("block-map", children, state.text);
}

/**
 * Parse the value part after a ":" in a block mapping.
 */
function parseBlockValue(state: ParserState, parentIndent: number, explicitKey = false): CstNode[] {
	const nodes: CstNode[] = [];

	while (!atEnd(state)) {
		const token = peek(state);
		if (token === undefined) break;

		// Consume inline whitespace ONLY — never via consumeTrivia, which
		// would greedily swallow a trailing comment AND the newline after it,
		// blowing past the line boundary. The loop would then keep consuming
		// the next line's tokens as value content with no column check, so a
		// dedented sibling key after `value # comment` was absorbed into the
		// nested mapping (shipped P0: trailing comment on the last key of a
		// nested block mapping swallowed the following dedent). Comments and
		// newlines end the value line via the branches below.
		if (token.kind === "whitespace") {
			advance(state);
			nodes.push(makeLeafNode("whitespace", token, state.text));
			continue;
		}

		// Newline: peek ahead for nested structure
		if (token.kind === "newline") {
			break;
		}

		// Comment after value
		if (token.kind === "comment") {
			break;
		}

		// Inline flow structures
		if (token.kind === "flow-map-start") {
			nodes.push(parseFlowMapping(state));
			break;
		}
		if (token.kind === "flow-seq-start") {
			nodes.push(parseFlowSequence(state));
			break;
		}

		// Block scalar
		if (isBlockScalarToken(state)) {
			nodes.push(parseBlockScalar(state));
			break;
		}

		// Block sequence starting on the same line as ":" in an explicit
		// mapping (e.g., "? key\n: - one"). Inline sequences after implicit
		// keys (e.g., "key: - a") are invalid per YAML 1.2 §8.2.1 and are
		// left as leaf tokens for the composer to reject.
		if (explicitKey && (token.kind === "block-seq-start" || token.kind === "block-seq-entry")) {
			// The lexer's block-seq-start column may not match the entry
			// column (it uses lineIndent from the ":" indicator). Find the
			// actual entry column to use as the sequence indent.
			const seqIndent = findFirstSeqEntryColumn(state, token.column);
			nodes.push(parseBlockSequence(state, seqIndent));
			break;
		}

		// Compact mapping starting on the same line as ":" in an explicit
		// mapping (YAML 1.2 §8.2.2: l-block-map-explicit-value admits
		// s-l+block-indented, which includes ns-l-compact-mapping). E.g.
		// `? key\n: dependencies:\n    x: 1` — the whole compact mapping is
		// the value. For implicit keys (`key: a: 1`) this stays invalid and
		// the tokens are left for the composer to reject (ZCZC preserved).
		if (
			explicitKey &&
			token.kind === "scalar" &&
			!isBlockScalarToken(state) &&
			hasImplicitMapAhead(state, parentIndent)
		) {
			nodes.push(parseImplicitBlockMapping(state, parentIndent));
			break;
		}

		// Scalar, anchor, alias, tag
		if (token.kind === "scalar" || token.kind === "anchor" || token.kind === "alias" || token.kind === "tag") {
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) nodes.push(leaf);
			continue;
		}

		break;
	}

	return nodes;
}

/**
 * Parse a block sequence at the given indentation level.
 */
function parseBlockSequence(state: ParserState, indent: number): CstNode {
	const guarded = guardDepth(state);
	if (guarded !== null) return guarded;
	state.depth++;
	try {
		return parseBlockSequenceInner(state, indent);
	} finally {
		state.depth--;
	}
}

function parseBlockSequenceInner(state: ParserState, indent: number): CstNode {
	const children: CstNode[] = [];

	// Consume the block-seq-start token
	const startToken = peek(state);
	if (startToken?.kind === "block-seq-start") {
		advance(state);
	}

	while (!atEnd(state)) {
		const token = peek(state);
		if (token === undefined) break;

		// Stop conditions
		if (isDocumentBoundary(token)) break;

		// Trivia
		if (isTrivia(token)) {
			children.push(...consumeTrivia(state));
			continue;
		}

		// Sequence entry
		if (token.kind === "block-seq-entry") {
			if (token.column < indent) break;
			if (token.column > indent) break;
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) children.push(leaf);
			// Parse the entry content
			children.push(...parseSequenceEntryContent(state, indent));
			continue;
		}

		// If we hit a map/seq start at higher indent, it's entry content
		if (token.kind === "block-map-start" && token.column > indent) {
			children.push(parseBlockMapping(state, token.column));
			continue;
		}

		if (token.kind === "block-seq-start") {
			if (token.column > indent) {
				children.push(parseBlockSequence(state, token.column));
			} else {
				// Same-indent block-seq-start: the lexer re-emitted a scope
				// marker after returning from deeper nesting. Consume and continue.
				advance(state);
			}
			continue;
		}

		// Otherwise, stop — this belongs to parent
		break;
	}

	return makeContainerNode("block-seq", children, state.text);
}

/**
 * Look ahead (without consuming) to see if a block-map-value token exists
 * before the next newline / document boundary / sequence entry at this indent.
 */
function hasImplicitMapAhead(state: ParserState, seqIndent: number): boolean {
	let flowDepth = 0;
	for (let i = state.pos; i < state.tokens.length; i++) {
		const t = state.tokens[i];
		if (t === undefined) break;
		// Track flow depth so we don't mistake a ":" inside { } or [ ] for a
		// block mapping value indicator.
		if (t.kind === "flow-map-start" || t.kind === "flow-seq-start") {
			flowDepth++;
			continue;
		}
		if (t.kind === "flow-map-end" || t.kind === "flow-seq-end") {
			flowDepth--;
			continue;
		}
		if (flowDepth > 0) continue;
		if (t.kind === "newline") return false;
		if (isDocumentBoundary(t)) return false;
		if (t.kind === "block-seq-entry" && t.column <= seqIndent) return false;
		if (t.kind === "block-map-value") return true;
	}
	return false;
}

/**
 * Parse the content of a sequence entry (after the `-`).
 */
function parseSequenceEntryContent(state: ParserState, seqIndent: number): CstNode[] {
	const nodes: CstNode[] = [];

	// If the immediate next non-trivia token is a nested seq entry (deeper
	// indent), parse it as a nested sequence first. This prevents the implicit
	// mapping check from absorbing nested "- key: value" patterns that belong
	// inside the nested sequence.
	const nextToken = findNextNonTrivia(state);
	if (nextToken !== undefined && nextToken.kind === "block-seq-entry" && nextToken.column > seqIndent) {
		// Fall through to the main loop which handles nested seq entries
	} else if (hasImplicitMapAhead(state, seqIndent)) {
		// Check if this entry contains an implicit mapping (scalar followed by ":")
		// Wrap everything up to the next entry / doc boundary into a block-map
		nodes.push(parseImplicitBlockMapping(state, seqIndent));
		return nodes;
	}

	while (!atEnd(state)) {
		const token = peek(state);
		if (token === undefined) break;

		// Stop at document boundary
		if (isDocumentBoundary(token)) break;

		// Stop at next sequence entry at same indent
		if (token.kind === "block-seq-entry" && token.column <= seqIndent) break;

		// Nested sequence entry (deeper indent) without a prior block-seq-start:
		// synthesise a nested sequence parse at this indent level.
		if (token.kind === "block-seq-entry" && token.column > seqIndent) {
			nodes.push(parseBlockSequence(state, token.column));
			continue;
		}

		// Trivia
		if (isTrivia(token)) {
			nodes.push(...consumeTrivia(state));
			continue;
		}

		// Block structures
		if (token.kind === "block-map-start") {
			nodes.push(parseBlockMapping(state, token.column));
			continue;
		}

		if (token.kind === "block-seq-start") {
			// A block-seq-start at or below the current sequence indent is a
			// re-emitted scope marker for a sibling entry — let the parent
			// sequence handler consume it.
			if (token.column <= seqIndent) break;
			nodes.push(parseBlockSequence(state, token.column));
			continue;
		}

		// Flow structures
		if (token.kind === "flow-map-start") {
			nodes.push(parseFlowMapping(state));
			continue;
		}
		if (token.kind === "flow-seq-start") {
			nodes.push(parseFlowSequence(state));
			continue;
		}

		// Block scalar
		if (isBlockScalarToken(state)) {
			nodes.push(parseBlockScalar(state));
			continue;
		}

		// Scalar, value indicator, anchor, alias, tag
		if (
			token.kind === "scalar" ||
			token.kind === "block-map-value" ||
			token.kind === "block-map-key" ||
			token.kind === "anchor" ||
			token.kind === "alias" ||
			token.kind === "tag"
		) {
			// If a content token appears at or below the sequence indent, it
			// belongs to a parent scope (e.g. a sibling key in the parent mapping).
			if (token.column <= seqIndent) break;
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) nodes.push(leaf);
			continue;
		}

		break;
	}

	return nodes;
}

/**
 * Parse an implicit block mapping (no block-map-start token from the lexer).
 * This occurs inside sequence entries like `- a: 1`.
 */
function parseImplicitBlockMapping(state: ParserState, seqIndent: number): CstNode {
	const guarded = guardDepth(state);
	if (guarded !== null) return guarded;
	state.depth++;
	try {
		return parseImplicitBlockMappingInner(state, seqIndent);
	} finally {
		state.depth--;
	}
}

function parseImplicitBlockMappingInner(state: ParserState, seqIndent: number): CstNode {
	const children: CstNode[] = [];
	// Track the indent of the first key in this implicit mapping so we can
	// distinguish "same-level block-map-start" (continuation) from "deeper"
	// (nested sub-mapping).
	let entryIndent = -1;

	while (!atEnd(state)) {
		const token = peek(state);
		if (token === undefined) break;

		// Stop at document boundary
		if (isDocumentBoundary(token)) break;

		// Stop at next sequence entry at same or lower indent
		if (token.kind === "block-seq-entry" && token.column <= seqIndent) break;

		// Stop at an explicit-key indicator (`?`) at or below the parent
		// indent — it introduces the parent mapping's next entry.
		if (token.kind === "block-map-key" && token.column <= seqIndent) break;

		// Trivia
		if (isTrivia(token)) {
			children.push(...consumeTrivia(state));
			continue;
		}

		// Block map value indicator (:)
		if (token.kind === "block-map-value") {
			// A `:` at or below the parent indent terminates this compact
			// mapping — it is the parent's next value indicator (e.g. the
			// `:` of a following explicit entry), not one of our pairs.
			if (token.column <= seqIndent && children.length > 0) break;
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) children.push(leaf);
			// After ":", consume the value
			children.push(...parseBlockValue(state, seqIndent));
			continue;
		}

		// Scalar (key), anchor, tag, alias
		if (token.kind === "scalar" || token.kind === "anchor" || token.kind === "alias" || token.kind === "tag") {
			if (isBlockScalarToken(state)) {
				children.push(parseBlockScalar(state));
				continue;
			}
			// If this content token is at or below the parent sequence indent
			// AND we already have entries, it belongs to a parent scope.
			if (entryIndent >= 0 && token.column <= seqIndent) break;
			// Track the indent of the first key
			if (entryIndent < 0) {
				entryIndent = token.column;
			}
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) children.push(leaf);
			continue;
		}

		// Block-map-start at the same indent as our entries is just the lexer
		// re-emitting a scope marker — consume it and keep going.
		if (token.kind === "block-map-start") {
			if (entryIndent >= 0 && token.column <= entryIndent) {
				// Same-level or shallower: just skip the zero-width marker
				advance(state);
				continue;
			}
			// Deeper indent: nested sub-mapping
			children.push(parseBlockMapping(state, token.column));
			continue;
		}
		if (token.kind === "block-seq-start") {
			// Stop if the block-seq-start is at the parent sequence indent —
			// it belongs to the parent, not this implicit mapping's value.
			if (token.column <= seqIndent && children.length > 0) break;
			children.push(parseBlockSequence(state, token.column));
			continue;
		}

		// Flow structures
		if (token.kind === "flow-map-start") {
			children.push(parseFlowMapping(state));
			continue;
		}
		if (token.kind === "flow-seq-start") {
			children.push(parseFlowSequence(state));
			continue;
		}

		// Anything else
		const leaf = consumeLeafToken(state);
		if (leaf !== undefined) children.push(leaf);
	}

	return makeContainerNode("block-map", children, state.text);
}

/**
 * Parse a single document from the token stream.
 */
function parseDocument(state: ParserState): CstNode {
	const children: CstNode[] = [];

	// Consume leading directives
	while (!atEnd(state)) {
		const token = peek(state);
		if (token === undefined) break;

		if (token.kind === "directive") {
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) children.push(leaf);
			continue;
		}

		if (isTrivia(token) && token.kind !== "comment") {
			// Consume trivia before document-start
			children.push(...consumeTrivia(state));
			continue;
		}

		if (token.kind === "comment") {
			// Before document-start, comments can be directives-adjacent
			const nextNonTrivia = findNextNonTrivia(state);
			if (nextNonTrivia?.kind === "directive" || nextNonTrivia?.kind === "document-start") {
				children.push(...consumeTrivia(state));
				continue;
			}
			break;
		}

		break;
	}

	// Consume document-start marker if present
	if (!atEnd(state)) {
		const token = peek(state);
		if (token?.kind === "document-start") {
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) children.push(leaf);
		}
	}

	// Parse document content
	while (!atEnd(state)) {
		const token = peek(state);
		if (token === undefined) break;

		// Stop at next document boundary
		if (token.kind === "document-start") break;
		if (token.kind === "document-end") {
			const leaf = consumeLeafToken(state);
			if (leaf !== undefined) children.push(leaf);
			// Consume trailing trivia after document-end
			while (!atEnd(state)) {
				const t = peek(state);
				if (t === undefined) break;
				if (t.kind === "newline" || t.kind === "whitespace" || t.kind === "comment") {
					children.push(...consumeTrivia(state));
				} else {
					break;
				}
			}
			break;
		}

		// Trivia
		if (isTrivia(token)) {
			children.push(...consumeTrivia(state));
			continue;
		}

		// Block structures
		if (token.kind === "block-map-start") {
			children.push(parseBlockMapping(state, token.column));
			continue;
		}

		if (token.kind === "block-seq-start") {
			children.push(parseBlockSequence(state, token.column));
			continue;
		}

		// Flow structures
		if (token.kind === "flow-map-start") {
			children.push(parseFlowMapping(state));
			continue;
		}
		if (token.kind === "flow-seq-start") {
			children.push(parseFlowSequence(state));
			continue;
		}

		// Block scalar
		if (isBlockScalarToken(state)) {
			children.push(parseBlockScalar(state));
			continue;
		}

		// Any other token
		const leaf = consumeLeafToken(state);
		if (leaf !== undefined) children.push(leaf);
	}

	return makeContainerNode("document", children, state.text);
}

/**
 * Find the next non-trivia token without consuming.
 */
function findNextNonTrivia(state: ParserState): YamlToken | undefined {
	for (let i = state.pos; i < state.tokens.length; i++) {
		const t = state.tokens[i];
		if (t !== undefined && !isTrivia(t)) return t;
	}
	return undefined;
}

/**
 * Parse all documents from the token stream.
 */
function parseDocuments(tokens: ReadonlyArray<YamlToken>, text: string): CstNode[] {
	const state: ParserState = { tokens, text, pos: 0, depth: 0 };
	const documents: CstNode[] = [];

	if (atEnd(state)) {
		// Empty input — return a single empty document
		return [{ type: "document", source: "", offset: 0, length: 0, children: [] }];
	}

	while (!atEnd(state)) {
		const before = state.pos;
		const doc = parseDocument(state);

		// Skip bare document-end markers that don't contain any content.
		// A document is content-free if it only contains trivia (whitespace,
		// newline, comment) and document-end nodes. Per YAML spec, a standalone
		// `...` without preceding content does not produce a document.
		const hasDocStart = doc.children?.some((c) => c.type === "whitespace" && c.source === "---");
		const hasContent = doc.children?.some(
			(c) => c.type !== "whitespace" && c.type !== "newline" && c.type !== "comment" && c.type !== "error",
		);
		if (hasDocStart === true || hasContent === true || documents.length === 0) {
			documents.push(doc);
		}

		// Safety: if no progress was made, force-advance to avoid infinite loop
		if (state.pos === before && !atEnd(state)) {
			state.pos++;
		}
	}

	return documents;
}

// ---------------------------------------------------------------------------
// Engine API
// ---------------------------------------------------------------------------

/**
 * Parse YAML source text and collect all CST document nodes into an array.
 *
 * **Details**
 *
 * Each CST node preserves every character of the original input, including
 * whitespace, comments, and structural indicators. No value interpretation
 * occurs at this stage — `true` is still the string `"true"`.
 *
 * **Gotchas**
 *
 * CST nesting is capped at `MAX_CST_DEPTH = 256 + 8` so the composer's
 * `NestingDepthExceeded` diagnostic always fires first. {@link Yaml.parse}
 * resolves Core Schema types after this stage.
 *
 * **Example** (Parse every document in a stream)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Yaml } from "@beep/scratchpad/yaml"
 *
 * console.log(Effect.runSync(Yaml.parseAll("a: 1\n---\nb: 2\n"))) // [{ a: 1 }, { b: 2 }]
 * ```
 *
 * @see {@link CstNode} for the uninterpreted tree this parser produces.
 * @see {@link MAX_NESTING_DEPTH} for the composer budget this cap sits above.
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export function parseCSTAll(text: string): ReadonlyArray<CstNode> {
	return parseDocuments(lexAll(text), text);
}
