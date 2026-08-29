/**
 * Range and chunk models for strict verified-span mapping.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { identity } from "effect/Function";
import * as S from "effect/Schema";

const $I = $LangExtractId.create("VerifiedSpan");

/**
 * Offset units accepted at explicit foreign-boundary adapters.
 *
 * **Example** (Check offset unit membership)
 *
 * ```ts import.meta.vitest name="Check offset unit membership"
 * import { TextOffsetUnit } from "@beep/langextract/VerifiedSpan"
 *
 * TextOffsetUnit.is["utf16-code-unit"]("utf16-code-unit") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TextOffsetUnit = LiteralKit(["unicode-code-point", "utf16-code-unit"]).pipe(
  $I.annoteSchema("TextOffsetUnit", {
    description: "Declared unit for an incoming half-open source-text offset range.",
  })
);

/**
 * Type for {@link TextOffsetUnit}.
 *
 * **Example** (Annotate offset unit type)
 *
 * ```ts
 * import type { TextOffsetUnit } from "@beep/langextract/VerifiedSpan"
 *
 * const unit: TextOffsetUnit = "unicode-code-point"
 * console.log(unit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TextOffsetUnit = typeof TextOffsetUnit.Type;

class TextOffsetRangeStruct extends S.Class<TextOffsetRangeStruct>($I`TextOffsetRangeStruct`)(
  {
    end: NonNegativeInt.annotateKey({
      description: "Exclusive end offset in unit.",
    }),
    start: NonNegativeInt.annotateKey({
      description: "Inclusive start offset in unit.",
    }),
    unit: TextOffsetUnit,
  },
  $I.annote("TextOffsetRangeStruct", {
    description: "Internal structural base for an explicitly unit-tagged half-open text range.",
  })
) {}

const TextOffsetRangeInvariant = TextOffsetRangeStruct.mapFields(identity)
  .check(
    S.makeFilter(({ end, start }) => start < end, {
      identifier: $I`TextOffsetRangeOrderCheck`,
      title: "Text Offset Range Order",
      description: "Checks that an incoming half-open text range is non-empty and forward ordered.",
      message: "Expected start to be less than end.",
    })
  )
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(
          fc.nat(10_000),
          fc.integer({
            min: 1,
            max: 10_000,
          }),
          fc.constantFrom(...TextOffsetUnit.Options)
        )
        .map(([start, width, unit]) =>
          TextOffsetRangeStruct.make({
            end: NonNegativeInt.make(start + width),
            start: NonNegativeInt.make(start),
            unit,
          })
        ),
  });

/**
 * Half-open incoming offset range with an explicit unit.
 *
 * **Example** (Create half-open offset range)
 *
 * ```ts
 * import { TextOffsetRange } from "@beep/langextract/VerifiedSpan"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const range = TextOffsetRange.make({
 *   start: NonNegativeInt.make(1),
 *   end: NonNegativeInt.make(2),
 *   unit: "unicode-code-point",
 * })
 * console.log(range.unit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TextOffsetRange extends S.Class<TextOffsetRange>($I`TextOffsetRange`)(
  TextOffsetRangeInvariant,
  $I.annote("TextOffsetRange", {
    description: "A non-empty half-open incoming text range whose offset unit is declared explicitly.",
  })
) {}

class Utf16TextRangeStruct extends S.Class<Utf16TextRangeStruct>($I`Utf16TextRangeStruct`)(
  {
    endChar: NonNegativeInt.annotateKey({
      description: "Exclusive UTF-16 code-unit offset.",
    }),
    startChar: NonNegativeInt.annotateKey({
      description: "Inclusive UTF-16 code-unit offset.",
    }),
  },
  $I.annote("Utf16TextRangeStruct", {
    description: "Internal structural base for a canonical half-open UTF-16 code-unit range.",
  })
) {}

const Utf16TextRangeInvariant = Utf16TextRangeStruct.mapFields(identity)
  .check(
    S.makeFilter(({ endChar, startChar }) => startChar < endChar, {
      identifier: $I`Utf16TextRangeOrderCheck`,
      title: "UTF-16 Text Range Order",
      description: "Checks that a canonical half-open UTF-16 range is non-empty and forward ordered.",
      message: "Expected startChar to be less than endChar.",
    })
  )
  .annotate({
    toArbitrary: () => (fc) =>
      fc
        .tuple(
          fc.nat(10_000),
          fc.integer({
            min: 1,
            max: 10_000,
          })
        )
        .map(([startChar, width]) =>
          Utf16TextRangeStruct.make({
            endChar: NonNegativeInt.make(startChar + width),
            startChar: NonNegativeInt.make(startChar),
          })
        ),
  });

/**
 * Canonical half-open UTF-16 code-unit range.
 *
 * **Example** (Create UTF-16 text range)
 *
 * ```ts import.meta.vitest name="Create UTF-16 text range"
 * import { Utf16TextRange } from "@beep/langextract/VerifiedSpan"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const range = Utf16TextRange.make({
 *   startChar: NonNegativeInt.make(1),
 *   endChar: NonNegativeInt.make(3),
 * })
 * range.endChar // => 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Utf16TextRange extends S.Class<Utf16TextRange>($I`Utf16TextRange`)(
  Utf16TextRangeInvariant,
  $I.annote("Utf16TextRange", {
    description: "Canonical non-empty half-open UTF-16 code-unit source-text range.",
  })
) {}

/**
 * One raw source chunk at an explicit global UTF-16 offset.
 *
 * **Details**
 *
 * Separators are part of `text`; reconstruction never inserts one.
 *
 * **Example** (Create raw text chunk)
 *
 * ```ts
 * import { RawTextChunk } from "@beep/langextract/VerifiedSpan"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const chunk = RawTextChunk.make({
 *   startChar: NonNegativeInt.make(0),
 *   text: "page one\f",
 * })
 * console.log(chunk.text)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawTextChunk extends S.Class<RawTextChunk>($I`RawTextChunk`)(
  {
    startChar: NonNegativeInt.annotateKey({
      description: "Global UTF-16 code-unit offset of the first code unit in text.",
    }),
    text: S.NonEmptyString.annotateKey({
      description: "Exact raw chunk text, including every separator after the preceding content.",
    }),
  },
  $I.annote("RawTextChunk", {
    description: "An exact raw source chunk with an explicit global UTF-16 start offset.",
  })
) {}
