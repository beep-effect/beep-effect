/**
 * Offset units, unit-tagged text positions and the conversion between units.
 *
 * **Details**
 *
 * A `Position` is a non-empty half-open range `[start, end)` counted in one
 * declared unit. `utf16-code-unit` is the canonical stored unit; code points
 * and UTF-8 bytes are what other tools put on the wire. Conversion is a
 * bijection on valid boundaries and refuses, as a value, a boundary that falls
 * inside a scalar, past the text, or after a lone surrogate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $TextId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { dual } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { convertBoundaries } from "./internal/scalars.ts";

const $I = $TextId.create("OffsetUnit");

/**
 * The units a text position may be counted in. Grapheme clusters are not a
 * unit: they change with the Unicode version.
 *
 * **Example** (Check a unit)
 *
 * ```ts import.meta.vitest name="Check a unit"
 * import { OffsetUnit } from "@beep/text/OffsetUnit"
 *
 * OffsetUnit.is["utf8-byte"]("utf8-byte") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OffsetUnit = LiteralKit(["utf16-code-unit", "unicode-code-point", "utf8-byte"]).pipe(
  $I.annoteSchema("OffsetUnit", {
    description: "Unit of a text position; utf16-code-unit is the canonical stored unit.",
  })
);

/**
 * Type for {@link OffsetUnit}.
 *
 * **Example** (Annotate a unit)
 *
 * ```ts
 * import type { OffsetUnit } from "@beep/text/OffsetUnit"
 *
 * const unit: OffsetUnit = "unicode-code-point"
 * console.log(unit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OffsetUnit = typeof OffsetUnit.Type;

/**
 * A non-empty half-open position `[start, end)` in a declared unit. It is the
 * `Position` case of the selector union.
 *
 * **Example** (Make a code-point position)
 *
 * ```ts import.meta.vitest name="Make a code-point position"
 * import { Position } from "@beep/text/OffsetUnit"
 * import * as S from "effect/Schema"
 *
 * const position = Position.make({ unit: "unicode-code-point", start: 1, end: 2 })
 * S.encodeSync(Position)(position) // => { _tag: "Position", unit: "unicode-code-point", start: 1, end: 2 }
 * S.is(Position)({ _tag: "Position", unit: "utf8-byte", start: 2, end: 2 }) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Position extends S.Opaque<Position, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Position", {
    unit: OffsetUnit.annotateKey({ description: "Unit both offsets are counted in." }),
    start: S.Natural.annotateKey({ description: "Inclusive start offset." }),
    end: S.Natural.annotateKey({ description: "Exclusive end offset." }),
  })
    .check(
      S.makeFilter(
        (position: { readonly start: number; readonly end: number }) => position.start < position.end,
        $I.annote("PositionOrderCheck", {
          title: "Position Order",
          description: "A position is non-empty: start is less than end.",
          message: "Expected start to be less than end.",
        })
      )
    )
    .pipe($I.annoteSchema("Position", { description: "A non-empty half-open text position in one unit." }))
) {}

/**
 * Why a position could not be converted: a boundary inside a surrogate pair or
 * a multi-byte sequence, a boundary past the text, or a lone surrogate before
 * the end boundary.
 *
 * **Example** (Check a refusal reason)
 *
 * ```ts import.meta.vitest name="Check a refusal reason"
 * import { UnitConversionRefusal } from "@beep/text/OffsetUnit"
 *
 * UnitConversionRefusal.is["split-boundary"]("split-boundary") // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const UnitConversionRefusal = LiteralKit(["split-boundary", "out-of-range", "ill-formed-text"]).pipe(
  $I.annoteSchema("UnitConversionRefusal", { description: "Reason a position could not be converted." })
);

/**
 * Type for {@link UnitConversionRefusal}.
 *
 * **Example** (Annotate a refusal reason)
 *
 * ```ts
 * import type { UnitConversionRefusal } from "@beep/text/OffsetUnit"
 *
 * const reason: UnitConversionRefusal = "out-of-range"
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type UnitConversionRefusal = typeof UnitConversionRefusal.Type;

/**
 * Typed refusal of a unit conversion or slice, carrying the position asked for.
 *
 * **Example** (Read a refusal)
 *
 * ```ts import.meta.vitest name="Read a refusal"
 * import { Position, UnitConversionRefused } from "@beep/text/OffsetUnit"
 *
 * const refused = UnitConversionRefused.make({
 *   reason: "split-boundary",
 *   position: Position.make({ unit: "utf16-code-unit", start: 1, end: 2 }),
 * })
 * refused.reason // => "split-boundary"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnitConversionRefused extends S.TaggedError<UnitConversionRefused, { readonly brand: unique symbol }>(
  $I`UnitConversionRefused`
)(
  "UnitConversionRefused",
  {
    reason: UnitConversionRefusal,
    position: Position,
  },
  $I.annoteError<UnitConversionRefused>("UnitConversionRefused", {
    description: "A position whose boundaries are not boundaries of the text in the target unit.",
  })
) {}

/**
 * Convert a position to another unit over the same text.
 *
 * **Details**
 *
 * One forward scan over the code points of `sourceText`. Converting to the
 * position's own unit still checks both boundaries. A boundary inside a
 * surrogate pair or a UTF-8 sequence is `split-boundary`, one past the text is
 * `out-of-range`, and a lone surrogate before the end boundary is
 * `ill-formed-text`: such text has no UTF-8 encoding and no agreed code-point
 * count.
 *
 * **Example** (Convert past an astral character)
 *
 * ```ts import.meta.vitest name="Convert past an astral character"
 * import { convertPosition, Position } from "@beep/text/OffsetUnit"
 * import * as Result from "effect/Result"
 *
 * const b = Position.make({ unit: "unicode-code-point", start: 2, end: 3 })
 * const converted = Result.getOrThrow(convertPosition(b, "utf16-code-unit", "A😀B"))
 * converted.start // => 3
 * converted.end // => 4
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const convertPosition: {
  (unit: OffsetUnit, sourceText: string): (position: Position) => Result.Result<Position, UnitConversionRefused>;
  (position: Position, unit: OffsetUnit, sourceText: string): Result.Result<Position, UnitConversionRefused>;
} = dual(
  3,
  (position: Position, unit: OffsetUnit, sourceText: string): Result.Result<Position, UnitConversionRefused> =>
    convertBoundaries(position, unit, sourceText).pipe(
      Result.map(([start, end]) => Position.make({ unit, start, end })),
      Result.mapError((reason) => UnitConversionRefused.make({ reason, position }))
    )
);

/**
 * The text a position selects, read through its UTF-16 conversion.
 *
 * **Example** (Slice by UTF-8 bytes)
 *
 * ```ts import.meta.vitest name="Slice by UTF-8 bytes"
 * import { Position, slicePosition } from "@beep/text/OffsetUnit"
 * import * as Result from "effect/Result"
 *
 * const bytes = Position.make({ unit: "utf8-byte", start: 1, end: 5 })
 * Result.getOrThrow(slicePosition(bytes, "A😀B")) // => "😀"
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const slicePosition: {
  (sourceText: string): (position: Position) => Result.Result<string, UnitConversionRefused>;
  (position: Position, sourceText: string): Result.Result<string, UnitConversionRefused>;
} = dual(
  2,
  (position: Position, sourceText: string): Result.Result<string, UnitConversionRefused> =>
    convertPosition(position, "utf16-code-unit", sourceText).pipe(
      Result.map((utf16) => Str.slice(utf16.start, utf16.end)(sourceText))
    )
);
