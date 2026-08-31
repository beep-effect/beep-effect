/**
 * Best-effort plaintext projection for retained Pandoc table-caption wire.
 *
 * @internal
 * @since 0.0.0
 */

import { A, O, Str } from "@beep/utils";
import { Match } from "effect";
import { constant } from "effect/Function";

const emptyString = constant(Str.empty);

interface TableCaptionWireDecoders {
  readonly decodeConstructorOption: (input: unknown) => O.Option<{
    readonly c?: unknown;
    readonly t: string;
  }>;
  readonly decodeJsonArrayOption: (input: unknown) => O.Option<ReadonlyArray<unknown>>;
  readonly decodeStringOption: (input: unknown) => O.Option<string>;
  readonly decodeTableCaptionPairOption: (
    input: unknown
  ) => O.Option<readonly [ReadonlyArray<unknown> | null, ReadonlyArray<unknown>]>;
}

/**
 * Build a caption plaintext projection from schema-backed wire decoders.
 *
 * **Details**
 *
 * A non-empty short caption deliberately wins over the long block caption for
 * this plaintext preview. An absent or empty short caption falls back to the
 * long form. The retained table payload remains the lossless source of truth.
 *
 * **Example** (Project an emphasized caption)
 *
 * ```ts
 * import { makeTableCaptionPlainTextFromPayload } from "./Pandoc.table-caption.ts"
 * import * as S from "effect/Schema"
 *
 * const JsonArray = S.Array(S.Json)
 * const captionPlainText = makeTableCaptionPlainTextFromPayload({
 *   decodeConstructorOption: S.decodeUnknownOption(
 *     S.Struct({ t: S.String, c: S.optional(S.Json) }),
 *   ),
 *   decodeJsonArrayOption: S.decodeUnknownOption(JsonArray),
 *   decodeStringOption: S.decodeUnknownOption(S.String),
 *   decodeTableCaptionPairOption: S.decodeUnknownOption(
 *     S.Tuple([S.NullOr(JsonArray), JsonArray]),
 *   ),
 * })
 *
 * console.log(
 *   captionPlainText([
 *     null,
 *     [{ t: "Plain", c: [{ t: "Emph", c: [{ t: "Str", c: "Evidence" }] }] }],
 *   ]),
 * ) // "Evidence"
 * ```
 *
 * @param decoders - Schema-backed decoders owned by the Pandoc model boundary.
 * @returns A total best-effort plaintext projection over validated table-caption wire.
 * @invariant Non-empty short-caption text is preferred; otherwise the long-caption projection is returned.
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const makeTableCaptionPlainTextFromPayload = ({
  decodeConstructorOption,
  decodeJsonArrayOption,
  decodeStringOption,
  decodeTableCaptionPairOption,
}: TableCaptionWireDecoders): ((input: unknown) => string) => {
  const jsonArrayAt = (input: unknown, index: number): O.Option<ReadonlyArray<unknown>> =>
    O.flatMap(O.flatMap(decodeJsonArrayOption(input), A.get(index)), decodeJsonArrayOption);

  const jsonStringAt = (input: unknown, index: number): O.Option<string> =>
    O.flatMap(O.flatMap(decodeJsonArrayOption(input), A.get(index)), decodeStringOption);

  const inlinePlainTextFromWire = (input: unknown): string =>
    O.getOrElse(
      O.map(decodeConstructorOption(input), (wire) =>
        Match.value(wire.t).pipe(
          Match.when("Str", () => O.getOrElse(decodeStringOption(wire.c), emptyString)),
          Match.when("Space", () => " "),
          Match.when("SoftBreak", () => " "),
          Match.when("LineBreak", () => "\n"),
          Match.when(
            (name) =>
              A.contains(
                ["Emph", "Underline", "Strong", "Strikeout", "Superscript", "Subscript", "SmallCaps"] as const,
                name
              ),
            () => inlineArrayPlainText(wire.c)
          ),
          Match.when("Quoted", () => O.getOrElse(O.map(jsonArrayAt(wire.c, 1), inlineArrayPlainText), emptyString)),
          Match.when("Cite", () => O.getOrElse(O.map(jsonArrayAt(wire.c, 1), inlineArrayPlainText), emptyString)),
          Match.when("Code", () => O.getOrElse(jsonStringAt(wire.c, 1), emptyString)),
          Match.when("Link", () => O.getOrElse(O.map(jsonArrayAt(wire.c, 1), inlineArrayPlainText), emptyString)),
          Match.when("Image", () => O.getOrElse(O.map(jsonArrayAt(wire.c, 1), inlineArrayPlainText), emptyString)),
          Match.when("Span", () => O.getOrElse(O.map(jsonArrayAt(wire.c, 1), inlineArrayPlainText), emptyString)),
          Match.when("Math", () => O.getOrElse(jsonStringAt(wire.c, 1), emptyString)),
          Match.when("RawInline", () => O.getOrElse(jsonStringAt(wire.c, 1), emptyString)),
          Match.when("Note", () => blockArrayPlainText(wire.c)),
          Match.orElse(emptyString)
        )
      ),
      emptyString
    );

  function inlineArrayPlainText(input: unknown): string {
    return O.getOrElse(
      O.map(decodeJsonArrayOption(input), (values) => A.join(A.map(values, inlinePlainTextFromWire), "")),
      emptyString
    );
  }

  const blockPlainTextFromWire = (input: unknown): string =>
    O.getOrElse(
      O.map(decodeConstructorOption(input), (wire) =>
        Match.value(wire.t).pipe(
          Match.when("Plain", () => inlineArrayPlainText(wire.c)),
          Match.when("Para", () => inlineArrayPlainText(wire.c)),
          Match.when("Header", () => O.getOrElse(O.map(jsonArrayAt(wire.c, 2), inlineArrayPlainText), emptyString)),
          Match.when("CodeBlock", () => O.getOrElse(jsonStringAt(wire.c, 1), emptyString)),
          Match.when("RawBlock", () => O.getOrElse(jsonStringAt(wire.c, 1), emptyString)),
          Match.when("BlockQuote", () => blockArrayPlainText(wire.c)),
          Match.orElse(emptyString)
        )
      ),
      emptyString
    );

  function blockArrayPlainText(input: unknown): string {
    return O.getOrElse(
      O.map(decodeJsonArrayOption(input), (values) => A.join(A.map(values, blockPlainTextFromWire), "\n")),
      emptyString
    );
  }

  return (input) =>
    O.match(decodeTableCaptionPairOption(input), {
      onNone: emptyString,
      onSome: ([shortCaption, longCaption]) => {
        const short = shortCaption === null ? "" : inlineArrayPlainText(shortCaption);
        return Str.isNonEmpty(short) ? short : blockArrayPlainText(longCaption);
      },
    });
};
