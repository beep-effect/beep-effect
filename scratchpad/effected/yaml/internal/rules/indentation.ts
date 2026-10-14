// indentation: block-structure indent STYLE — the one rule that
// reasons about structure rather than a token and its neighbours, built
// last by design. Two checks:
//
//   1. Every new block level indents by the same unit (`spaces`: a number,
//      or "consistent" — the first observed delta decides).
//   2. Sequences under a mapping key follow one policy (`indentSequences`:
//      true, false, or "consistent" — the first occurrence decides).
//
// Structural LEGALITY is the parser's job (a dedent to an unknown level is
// a parse error parse-validity reports); this rule only speaks where the
// document is well-formed and the style drifts. Lines inside scalar content
// or flow collections are skipped — their layout is value or flow syntax,
// not block indentation. No fix: reindenting is formatting.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as A from "effect/Array";
import * as N from "effect/Number";
import type { LintContext, YamlRule } from "../../YamlLintRule.ts";
import { LintLine, StyleVote, YamlLintDiagnostic, YamlLintSeverity } from "../../YamlLintRule.ts";
import type { YamlScalar } from "../../YamlNode.ts";
import { coveringToken, isScalarContinuationLine, nonNegativeIntegerOption, walkScalars } from "./util.ts";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/yaml/internal/rules/indentation");

/**
 * Configure the indentation unit and placement of sequences beneath mapping keys.
 *
 * **Details**
 *
 * Options for `indentation`: `spaces` per level (number or "consistent",
 * default "consistent") and `indentSequences` (boolean or "consistent",
 * default "consistent").
 *
 * **Example** (Decode indentation options)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { indentationOptions } from "@beep/scratchpad/effected/yaml/internal/rules/indentation";
 *
 * const options = S.decodeUnknownSync(indentationOptions)({ spaces: 2, indentSequences: true });
 * console.log(options.spaces) // 2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const indentationOptions = S.Struct({
	severity: S.optionalKey(YamlLintSeverity).annotateKey({
		description: "Reporting level for block-indentation style findings, defaulting to `error`",
	}),
	spaces: S.optionalKey(S.Union([nonNegativeIntegerOption, S.Literals(["consistent"])])).annotateKey({
		description:
			"Spaces per block-indentation level, or `consistent` to use the first observed increase; defaults to `consistent`",
	}),
	indentSequences: S.optionalKey(S.Union([S.Boolean, S.Literals(["consistent"])])).annotateKey({
		description:
			"Whether sequences indent beneath mapping keys, or `consistent` to follow the first observed placement; defaults to `consistent`",
	}),
}).pipe(
	$I.annoteSchema("indentationOptions", {
		description:
			'Options for `indentation`: `spaces` per level (number or "consistent", default "consistent") and `indentSequences` (boolean or "consistent", default "consistent").',
	}),
);

/**
 * Decoded options for the `indentation` lint rule.
 *
 * @category type-level
 * @since 0.0.0
 */
export type indentationOptions = typeof indentationOptions.Type;

const ContentLine = S.Struct({
	line: LintLine.annotateKey({ description: "Positioned source line contributing block structure" }),
	prefixWidth: nonNegativeIntegerOption.annotateKey({ description: "Initial stream BOM width excluded from indentation" }),
	propertiesOnly: S.Boolean.annotateKey({ description: "Whether the line contains only node anchors and tags" }),
	indent: nonNegativeIntegerOption.annotateKey({ description: "Leading indentation column of the line" }),
	firstChar: S.String.annotateKey({ description: "First non-whitespace character on the line" }),
	indents: S.NonEmptyArray(nonNegativeIntegerOption).annotateKey({
		description: "Line indentation followed by the innermost same-line compact collection columns",
	}),
	opensKey: S.Boolean.annotateKey({ description: "Whether the mapping separator has no same-line value content" }),
}).pipe($I.annoteSchema("ContentLine", { description: "A structural line with a nonempty progression of nonnegative indentation columns" }));
type ContentLine = typeof ContentLine.Type;

/** Flow-collection depth at each line start, from the token stream. */
const flowDepthAtLineStarts = (ctx: LintContext): ReadonlyArray<number> => {
	const depths: Array<number> = [];
	let depth = 0;
	let tokenIdx = 0;
	for (const line of ctx.lines) {
		// Advance through tokens that END at or before this line's start.
		while (tokenIdx < ctx.tokens.length) {
			const token = ctx.tokens[tokenIdx];
			if (token === undefined || token.offset + token.length > line.offset) break;
			if (token.kind === "flow-map-start" || token.kind === "flow-seq-start") depth++;
			if (token.kind === "flow-map-end" || token.kind === "flow-seq-end") depth = Math.max(0, depth - 1);
			tokenIdx++;
		}
		depths.push(depth);
	}
	return depths;
};

/**
 * The content lines block structure speaks about — shared by the check and
 * the inference hook so the two read the same lines. Skips blanks, comment
 * lines, directives, tab-indented lines (the parser's error), lines inside
 * flow collections, scalar continuations and document markers.
 */
const contentLines = (ctx: LintContext): ReadonlyArray<ContentLine> => {
	const flowDepths = flowDepthAtLineStarts(ctx);
	const multilineScalars: Array<YamlScalar> = [];
	walkScalars(ctx.document.contents, "root", (scalar) => {
		if (scalar.sourceMultiline === true) multilineScalars.push(scalar);
	});
	const scalarSpans = A.sortWith(multilineScalars, (scalar) => scalar.offset, N.Order);
	let scalarIdx = 0;
	const content: Array<ContentLine> = [];
	let tokenIdx = 0;
	let explicitKeyColumn: number | undefined;
	for (const line of ctx.lines) {
		const prefixWidth = line.offset === 0 && line.text[0] === "\uFEFF" ? 1 : 0;
		let indent = 0;
		while (line.text[prefixWidth + indent] === " ") indent++;
		const probeOffset = line.offset + prefixWidth + indent;
		const firstChar = line.text[prefixWidth + indent];
		if (firstChar === undefined) continue; // blank
		if (firstChar === "#") continue; // comment lines are not block structure
		if (firstChar === "%") continue; // directives
		if (firstChar === "\t") continue; // tab indent is the parser's error
		if (A.getUnsafe(flowDepths, line.number) > 0) continue; // inside a flow collection
		if (isScalarContinuationLine(ctx.tokens, line.offset, probeOffset)) continue; // scalar content
		while (scalarIdx < scalarSpans.length) {
			const scalar = A.getUnsafe(scalarSpans, scalarIdx);
			if (scalar.offset + scalar.length > probeOffset) break;
			scalarIdx++;
		}
		const scalar = scalarSpans[scalarIdx];
		if (scalar !== undefined && scalar.offset < line.offset && probeOffset < scalar.offset + scalar.length) continue;
		const firstToken = coveringToken(ctx.tokens, probeOffset);
		if (firstToken?.kind === "document-start" || firstToken?.kind === "document-end") {
			explicitKeyColumn = undefined;
			continue;
		}
		const continuationKeyColumn = explicitKeyColumn;
		if (explicitKeyColumn !== undefined && indent <= explicitKeyColumn) explicitKeyColumn = undefined;
		// Read significant tokens, rather than treating quoted ` # ` as a comment.
		while (tokenIdx < ctx.tokens.length && A.getUnsafe(ctx.tokens, tokenIdx).offset < line.offset) tokenIdx++;
		const indents = A.of(indent);
		let opensKey = false;
		let propertiesOnly = true;
		let hasBlockIndicator = false;
		let afterEntry = false;
		let compactKeyIndent: number | undefined;
		let inlineFlowDepth = 0;
		while (tokenIdx < ctx.tokens.length) {
			const token = ctx.tokens[tokenIdx];
			if (token === undefined || token.offset >= line.offset + line.text.length) break;
			tokenIdx++;
			if (token.length === 0 || token.kind === "whitespace" || token.kind === "comment") continue;
			if (token.kind !== "anchor" && token.kind !== "tag") propertiesOnly = false;
			if (token.kind === "flow-map-start" || token.kind === "flow-seq-start") inlineFlowDepth++;
			if (token.kind === "flow-map-end" || token.kind === "flow-seq-end") inlineFlowDepth--;
			if (afterEntry) {
				if (token.kind === "block-seq-entry" || token.kind === "block-map-key") indents.push(token.character - prefixWidth);
				else compactKeyIndent = token.character - prefixWidth;
			}
			if (token.kind === "block-map-value" && inlineFlowDepth === 0 && compactKeyIndent !== undefined) {
				indents.push(compactKeyIndent);
				compactKeyIndent = undefined;
			}
			if (inlineFlowDepth === 0) {
				if (token.kind === "block-map-key") explicitKeyColumn = token.character - prefixWidth;
				if (token.kind === "block-map-value") explicitKeyColumn = undefined;
				if (token.kind === "block-map-key" || token.kind === "block-map-value" || token.kind === "block-seq-entry") hasBlockIndicator = true;
			}
			afterEntry = token.kind === "block-seq-entry";
			if (token.kind === "block-map-value" && inlineFlowDepth === 0) opensKey = true;
			else if (token.kind !== "anchor" && token.kind !== "tag") opensKey = false;
		}
		// Explicit plain keys can be composed from separate tokens while their
		// AST span still covers only the first fragment. Keep the later ':'
		// structural, but omit deeper scalar fragments until that indicator.
		if (continuationKeyColumn !== undefined && indent > continuationKeyColumn && firstToken?.kind === "scalar" && !hasBlockIndicator) continue;
		content.push({ line, indent, firstChar, indents, opensKey, prefixWidth, propertiesOnly });
	}
	return content;
};

/**
 * True when consecutive content lines `prev` → `curr` are a mapping key
 * followed by a sequence entry — the pair the `indentSequences` policy is
 * about. Shared by the check and the inference hook.
 */
const isKeyThenSeqEntry = (
	ctx: LintContext,
	prev: ContentLine,
	curr: ContentLine,
	unit: number,
): boolean => {
	if (curr.firstChar !== "-") return false;
	// A leading `-` is not necessarily a sequence entry: `-5` and `--flag`
	// are plain scalars (YAML 1.2 §7.1). The lexer already knows — only a
	// line whose first content token is `block-seq-entry` is one.
	if (coveringToken(ctx.tokens, curr.line.offset + curr.prefixWidth + curr.indent)?.kind !== "block-seq-entry") return false;
	if (!prev.opensKey) return false;
	const keyIndent = A.getUnsafe(prev.indents, prev.indents.length - 1);
	return curr.indent === keyIndent || curr.indent === keyIndent + unit;
};

/**
 * Check block-structure indentation style.
 *
 * **Details**
 *
 * The rule checks the indentation unit and sequence placement under mapping
 * keys. In consistent mode, the first observed increase determines the unit
 * and the first key-to-sequence pair determines sequence placement. Scalar
 * continuations and flow collections are skipped. Inference votes on the same
 * content lines used by the check.
 *
 * **Gotchas**
 *
 * Structural legality belongs to the parser. This rule reports style drift
 * and offers no fix: reindenting is formatting.
 *
 * **Example** (Find an indentation-unit mismatch)
 *
 * ```ts
 * import { indentation } from "@beep/scratchpad/effected/yaml/internal/rules/indentation";
 * import { YamlLint, YamlLintConfig } from "@beep/scratchpad/effected/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({
 *   rules: { "indentation": { spaces: 2 } },
 * });
 * const diagnostics = YamlLint.run("parent:\n    child: value\n", [indentation], config);
 * console.log(diagnostics.length) // 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const indentation: YamlRule = {
	id: "indentation",
	check: (ctx, options) => {
		const spacesOpt =
			P.hasProperty(options, "spaces") && S.is(indentationOptions.fields.spaces.schema)(options.spaces)
				? options.spaces
				: "consistent";
		const seqOpt =
			P.hasProperty(options, "indentSequences") &&
			S.is(indentationOptions.fields.indentSequences.schema)(options.indentSequences)
				? options.indentSequences
				: "consistent";
		const out: Array<YamlLintDiagnostic> = [];

		// The content lines this rule speaks about.
		const content = contentLines(ctx);

		// Check 1: every new level indents by one consistent unit.
		let unit = P.isNumber(spacesOpt) ? spacesOpt : undefined;
		const stack: Array<number> = [0];
		for (const { line, indents, prefixWidth } of content) {
			for (let columnIndex = 0; columnIndex < indents.length; columnIndex++) {
				const indent = A.getUnsafe(indents, columnIndex);
				if (columnIndex > 0) {
					stack.push(indent);
					continue;
				}
				const top = A.getUnsafe(stack, stack.length - 1);
				if (indent > top) {
					const delta = indent - top;
					if (unit === undefined) {
						unit = delta;
					} else if (delta !== unit) {
						out.push(
							YamlLintDiagnostic.make({
								rule: "indentation",
								severity: "error",
								message: `Indent of ${delta} spaces, expected ${unit}`,
								offset: line.offset + prefixWidth,
								length: indent,
								line: line.number,
								character: prefixWidth,
							}),
						);
					}
					stack.push(indent);
				} else if (indent < top) {
					while (stack.length > 1 && A.getUnsafe(stack, stack.length - 1) > indent) stack.pop();
					// A dedent to an unknown level is a parse error — parse-validity's
					// business, not style.
				}
			}
		}

		// Check 2: sequences under a mapping key follow one policy. Detected
		// on content-line pairs `key:` → `- item`, looking past node properties.
		let seqIndented = P.isBoolean(seqOpt) ? seqOpt : undefined;
		const pairedContent = A.filter(content, (line) => !line.propertiesOnly);
		for (let i = 1; i < pairedContent.length; i++) {
			const prev = A.getUnsafe(pairedContent, i - 1);
			const curr = A.getUnsafe(pairedContent, i);
			if (!isKeyThenSeqEntry(ctx, prev, curr, unit ?? 0)) continue;
			const indented = curr.indent > A.getUnsafe(prev.indents, prev.indents.length - 1);
			if (seqIndented === undefined) {
				seqIndented = indented;
			} else if (indented !== seqIndented) {
				out.push(
					YamlLintDiagnostic.make({
						rule: "indentation",
						severity: "error",
						message: seqIndented
							? "Sequence under a mapping key should be indented"
							: "Sequence under a mapping key should not be indented",
						offset: curr.line.offset + curr.prefixWidth,
						length: curr.indent,
						line: curr.line.number,
						character: curr.prefixWidth,
					}),
				);
			}
		}

		return out;
	},
	// Inference: every indent INCREASE votes its delta for `spaces`,
	// and every key-then-sequence-entry pair votes whether the sequence is
	// indented for `indentSequences` — the same content lines and the same
	// detection the check polices in "consistent" mode.
	infer: (ctx) => {
		const out: Array<StyleVote> = [];
		const content = contentLines(ctx);

		let unit: number | undefined;
		const stack: Array<number> = [0];
		for (const { line, indents, prefixWidth } of content) {
			for (let columnIndex = 0; columnIndex < indents.length; columnIndex++) {
				const indent = A.getUnsafe(indents, columnIndex);
				if (columnIndex > 0) {
					stack.push(indent);
					continue;
				}
				const top = A.getUnsafe(stack, stack.length - 1);
				if (indent > top) {
					out.push(
						StyleVote.make({
							dimension: "spaces",
							value: indent - top,
							offset: line.offset + prefixWidth,
							length: indent,
							line: line.number,
							character: prefixWidth,
						}),
					);
					if (unit === undefined) unit = indent - top;
					stack.push(indent);
				} else if (indent < top) {
					while (stack.length > 1 && A.getUnsafe(stack, stack.length - 1) > indent) stack.pop();
				}
			}
		}

		const pairedContent = A.filter(content, (line) => !line.propertiesOnly);
		for (let i = 1; i < pairedContent.length; i++) {
			const prev = A.getUnsafe(pairedContent, i - 1);
			const curr = A.getUnsafe(pairedContent, i);
			if (!isKeyThenSeqEntry(ctx, prev, curr, unit ?? 0)) continue;
			out.push(
				StyleVote.make({
					dimension: "indentSequences",
					value: curr.indent > A.getUnsafe(prev.indents, prev.indents.length - 1),
					offset: curr.line.offset + curr.prefixWidth,
					length: curr.indent,
					line: curr.line.number,
					character: curr.prefixWidth,
				}),
			);
		}

		return out;
	},
};
