/**
 * indentation (#129): block-structure indent STYLE — the one rule that
 * reasons about structure rather than a token and its neighbours, built
 * last by design. Two checks:
 *
 *   1. Every new block level indents by the same unit (`spaces`: a number,
 *      or "consistent" — the first observed delta decides).
 *   2. Sequences under a mapping key follow one policy (`indentSequences`:
 *      true, false, or "consistent" — the first occurrence decides).
 *
 * Structural LEGALITY is the parser's job (a dedent to an unknown level is
 * a parse error parse-validity reports); this rule only speaks where the
 * document is well-formed and the style drifts. Lines inside scalar content
 * or flow collections are skipped — their layout is value or flow syntax,
 * not block indentation. No fix: reindenting is formatting.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {Schema} from "effect";
import type {LintContext, LintLine, YamlRule} from "../../YamlLintRule.ts";
import {
  StyleVote,
  YamlLintDiagnostic,
  YamlLintSeverity
} from "../../YamlLintRule.ts";
import {
  coveringToken,
  isScalarContinuationLine,
  nonNegativeIntegerOption
} from "./util.ts";

/**
 * Options for `indentation`: `spaces` per level (number or "consistent",
 * default "consistent") and `indentSequences` (boolean or "consistent",
 * default "consistent").
 */
export const indentationOptions = Schema.Struct({
  severity: Schema.optionalKey(YamlLintSeverity),
  spaces: Schema.optionalKey(Schema.Union([nonNegativeIntegerOption, Schema.Literals(["consistent"])])),
  indentSequences: Schema.optionalKey(Schema.Union([Schema.Boolean, Schema.Literals(["consistent"])])),
});

interface IndentationOptions {
  readonly spaces?: number | "consistent";
  readonly indentSequences?: boolean | "consistent";
}

interface ContentLine {
  readonly line: LintLine;
  readonly indent: number;
  readonly firstChar: string;
}

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
  const content: Array<ContentLine> = [];
  for (const line of ctx.lines) {
    const indent = line.text.length - line.text.trimStart().length;
    const firstChar = line.text[indent];
    if (firstChar === undefined) continue; // blank
    if (firstChar === "#") continue; // comment lines are not block structure
    if (firstChar === "%") continue; // directives
    if (line.text.slice(0, indent).includes("\t")) continue; // tab indent is the parser's error
    if ((flowDepths[line.number] ?? 0) > 0) continue; // inside a flow collection
    if (isScalarContinuationLine(ctx.tokens, line.offset, line.offset + indent)) continue; // scalar content
    if (line.text.slice(indent).startsWith("---") || line.text.slice(indent).startsWith("...")) continue;
    content.push({line, indent, firstChar});
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
  unit: number | undefined,
): boolean => {
  if (curr.firstChar !== "-") return false;
  // A leading `-` is not necessarily a sequence entry: `-5` and `--flag`
  // are plain scalars (YAML 1.2 §7.1). The lexer already knows — only a
  // line whose first content token is `block-seq-entry` is one.
  if (coveringToken(ctx.tokens, curr.line.offset + curr.indent)?.kind !== "block-seq-entry") return false;
  // The previous content line must open a mapping key (ends with `:`
  // after stripping a trailing comment).
  const prevText = prev.line.text.replace(/ #.*$/, "").trimEnd();
  if (!prevText.endsWith(":")) return false;
  return curr.indent === prev.indent || curr.indent === prev.indent + (unit ?? curr.indent - prev.indent);
};

/** Block-structure indent style. */
export const indentation: YamlRule = {
  id: "indentation",
  check: (ctx, options) => {
    const opts = (options ?? {}) as IndentationOptions;
    const spacesOpt = opts.spaces ?? "consistent";
    const seqOpt = opts.indentSequences ?? "consistent";
    const out: Array<YamlLintDiagnostic> = [];

    // The content lines this rule speaks about.
    const content = contentLines(ctx);

    // Check 1: every new level indents by one consistent unit.
    let unit = typeof spacesOpt === "number" ? spacesOpt : undefined;
    const stack: Array<number> = [0];
    for (const {line, indent} of content) {
      const top = stack[stack.length - 1] as number;
      if (indent > top) {
        const delta = indent - top;
        if (unit === undefined) {
          unit = delta;
        } else if (delta !== unit) {
          out.push(
            new YamlLintDiagnostic({
              rule: "indentation",
              severity: "error",
              message: `Indent of ${delta} spaces, expected ${unit}`,
              offset: line.offset,
              length: indent,
              line: line.number,
              character: 0,
            }),
          );
        }
        stack.push(indent);
      } else if (indent < top) {
        while (stack.length > 1 && (stack[stack.length - 1] as number) > indent) stack.pop();
        // A dedent to an unknown level is a parse error — parse-validity's
        // business, not style.
      }
    }

    // Check 2: sequences under a mapping key follow one policy. Detected
    // on consecutive content-line pairs `key:` → `- item`.
    let seqIndented = typeof seqOpt === "boolean" ? seqOpt : undefined;
    for (let i = 1; i < content.length; i++) {
      const prev = content[i - 1] as ContentLine;
      const curr = content[i] as ContentLine;
      if (!isKeyThenSeqEntry(ctx, prev, curr, unit)) continue;
      const indented = curr.indent > prev.indent;
      if (seqIndented === undefined) {
        seqIndented = indented;
      } else if (indented !== seqIndented) {
        out.push(
          new YamlLintDiagnostic({
            rule: "indentation",
            severity: "error",
            message: seqIndented
              ? "Sequence under a mapping key should be indented"
              : "Sequence under a mapping key should not be indented",
            offset: curr.line.offset,
            length: curr.indent,
            line: curr.line.number,
            character: 0,
          }),
        );
      }
    }

    return out;
  },
  // Inference (#345): every indent INCREASE votes its delta for `spaces`,
  // and every key-then-sequence-entry pair votes whether the sequence is
  // indented for `indentSequences` — the same content lines and the same
  // detection the check polices in "consistent" mode.
  infer: (ctx) => {
    const out: Array<StyleVote> = [];
    const content = contentLines(ctx);

    let unit: number | undefined;
    const stack: Array<number> = [0];
    for (const {line, indent} of content) {
      const top = stack[stack.length - 1] as number;
      if (indent > top) {
        out.push(
          StyleVote.make({
            dimension: "spaces",
            value: indent - top,
            offset: line.offset,
            length: indent,
            line: line.number,
            character: 0,
          }),
        );
        if (unit === undefined) unit = indent - top;
        stack.push(indent);
      } else if (indent < top) {
        while (stack.length > 1 && (stack[stack.length - 1] as number) > indent) stack.pop();
      }
    }

    for (let i = 1; i < content.length; i++) {
      const prev = content[i - 1] as ContentLine;
      const curr = content[i] as ContentLine;
      if (!isKeyThenSeqEntry(ctx, prev, curr, unit)) continue;
      out.push(
        StyleVote.make({
          dimension: "indentSequences",
          value: curr.indent > prev.indent,
          offset: curr.line.offset,
          length: curr.indent,
          line: curr.line.number,
          character: 0,
        }),
      );
    }

    return out;
  },
};
