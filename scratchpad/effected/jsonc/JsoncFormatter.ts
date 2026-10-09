// Pure JSONC formatting: compute the minimal set of whitespace edits that
// bring a document to canonical shape, or apply them in one step.
//
// Kept as its own concept module (rather than folded into the `Jsonc` facade)
// so the format surface stays symmetric with sibling document codecs. Both
// statics are pure and total: computing edits never fails.

import { thunk0 } from "@beep/utils/thunk";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { createScanner, SyntaxKind } from "./internal/scanner.ts";
import type { JsoncRange } from "./JsoncEdit.ts";
import { JsoncEdit, JsoncFormattingOptions, type JsoncFormattingOptionsLike } from "./JsoncEdit.ts";

const isSkipped = S.is(SyntaxKind.pick(["Trivia", "LineBreak"]));
const isCloser = S.is(SyntaxKind.pick(["CloseBrace", "CloseBracket"]));
const isOpener = S.is(SyntaxKind.pick(["OpenBrace", "OpenBracket"]));
const isComment = S.is(SyntaxKind.pick(["LineComment", "BlockComment"]));

/**
 * Formats JSONC text into canonical whitespace, as minimal edits or as a
 * finished string, preserving comments. Pure and total; not instantiable.
 *
 * **Example** (Reflow a compact document)
 *
 * ```ts
 * import { JsoncFormatter } from "@beep/scratchpad/effected/jsonc/index"
 *
 * console.log(JsoncFormatter.formatToString('{"a":1,"b":[1,2]} // keep'))
 * // '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n} // keep'
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export abstract class JsoncFormatter {
  /**
   * Compute formatting edits for a JSONC document.
   *
   * **Details**
   *
   * Non-mutating: apply the result with `JsoncEdit.applyAll`. Only edits
   * inside `range` are returned when one is given. Omitted option fields take
   * the {@link JsoncFormattingOptions} defaults.
   *
   * **Example** (Compute edits for a compact object)
   *
   * ```ts
   * import { JsoncFormatter } from "@beep/scratchpad/effected/jsonc/index"
   *
   * const edits = JsoncFormatter.format('{"a":1}')
   *
   * console.log(edits.map((edit) => edit.content)) // ["\n  ", " ", "\n"]
   * ```
   *
   * @param text - The JSONC source to format.
   * @param range - Optional sub-range restricting which edits are returned.
   * @param options - Formatting options as an instance or a plain literal.
   * @returns The edits that bring `text` to canonical shape.
   */
  static format(text: string, range?: JsoncRange, options?: JsoncFormattingOptionsLike): ReadonlyArray<JsoncEdit> {
    return formatImpl(text, O.fromUndefinedOr(range), JsoncFormattingOptions.make(options ?? R.empty()));
  }

  /**
   * Format `text` and apply the resulting edits in one step.
   *
   * **Example** (Format with a final newline)
   *
   * ```ts
   * import { JsoncFormatter } from "@beep/scratchpad/effected/jsonc/index"
   *
   * console.log(JsoncFormatter.formatToString('{"a":1}', undefined, { insertFinalNewline: true })) // '{\n  "a": 1\n}\n'
   * ```
   *
   * @param text - The JSONC source to format.
   * @param range - Optional sub-range restricting which edits are applied.
   * @param options - Formatting options as an instance or a plain literal.
   * @returns The formatted text.
   */
  static formatToString(text: string, range?: JsoncRange, options?: JsoncFormattingOptionsLike): string {
    return JsoncEdit.applyAll(text, JsoncFormatter.format(text, range, options));
  }
}

interface Gap {
  readonly kind: SyntaxKind;
  readonly prevToken: SyntaxKind;
  readonly gap: string;
  readonly depth: number;
}

const formatImpl = (
  text: string,
  range: O.Option<JsoncRange>,
  options: JsoncFormattingOptions
): ReadonlyArray<JsoncEdit> => {
  const indentUnit = options.insertSpaces ? Str.repeat(options.tabSize)(" ") : "\t";
  // A surplus closer drives `depth` below zero. `Str.repeat` clamps that to no
  // indent, so formatting stays total where upstream's `String.prototype.repeat`
  // throws a `RangeError` (a recorded port deviation).
  const newline = (depth: number): string => options.eol + Str.repeat(depth)(indentUnit);
  const breakOrSpace = (gap: string, depth: number): string => (Str.includes("\n")(gap) ? newline(depth) : " ");

  // The canonical gap before a token, given what came before it.
  const gapAtDepth = (g: Gap): string => newline(g.depth);
  const expectedGap: (gap: Gap) => string = Match.type<Gap>().pipe(
    Match.when({ kind: isCloser }, gapAtDepth),
    Match.when({ prevToken: isOpener }, gapAtDepth),
    Match.when({ prevToken: SyntaxKind.Enum.Comma }, gapAtDepth),
    Match.when({ prevToken: SyntaxKind.Enum.Colon }, () => " "),
    Match.when({ kind: isComment }, (g) => breakOrSpace(g.gap, g.depth)),
    Match.when({ prevToken: SyntaxKind.Enum.LineComment }, gapAtDepth),
    Match.when({ prevToken: SyntaxKind.Enum.BlockComment }, (g) => breakOrSpace(g.gap, g.depth)),
    Match.orElse((g) => g.gap)
  );

  const rangeStart = O.match(range, {
    onNone: thunk0,
    onSome: (r) => r.offset,
  });
  const rangeEnd = O.match(range, {
    onNone: () => text.length,
    onSome: (r) => r.offset + r.length,
  });

  // Edits grow in place: an immutable append copies every earlier edit per
  // token gap and makes reflowing a compact document quadratic.
  const edits: Array<JsoncEdit> = [];
  const addEdit = (offset: number, length: number, content: string): void => {
    if (offset >= rangeStart && offset + length <= rangeEnd && text.substring(offset, offset + length) !== content) {
      edits.push(JsoncEdit.make({ offset, length, content }));
    }
  };

  const scanner = createScanner(text, false);
  let depth = 0;
  let previous = O.none<{ readonly token: SyntaxKind; readonly end: number }>();

  for (let kind = scanner.scan(); !SyntaxKind.is.EOF(kind); kind = scanner.scan()) {
    if (isSkipped(kind)) {
      continue;
    }
    const tokenOffset = scanner.getTokenOffset();
    if (O.isSome(previous)) {
      // Only a closer with a predecessor closes a level: a leading closer has
      // nothing to close and leaves the depth alone, as upstream does.
      if (isCloser(kind)) {
        depth--;
      }
      const gap = text.substring(previous.value.end, tokenOffset);
      const content =
        options.keepLines && Str.includes("\n")(gap)
          ? gap
          : expectedGap({ kind, prevToken: previous.value.token, gap, depth });
      addEdit(previous.value.end, tokenOffset - previous.value.end, content);
    }
    if (isOpener(kind)) {
      depth++;
    }
    previous = O.some({
      token: kind,
      end: tokenOffset + scanner.getTokenLength(),
    });
  }

  if (options.insertFinalNewline && O.isSome(previous)) {
    const trailing = text.substring(previous.value.end);
    if (!Str.endsWith(options.eol)(trailing)) {
      // Routed through addEdit so the range restriction applies here too.
      addEdit(previous.value.end, trailing.length, options.eol);
    }
  }

  return edits;
};
