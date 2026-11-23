import { dual } from "effect/Function";
import * as Result from "effect/Result";
import type { OffsetUnit, Position, UnitConversionRefusal } from "../OffsetUnit.ts";

const isLoneSurrogate = (scalar: string): boolean => scalar.length === 1 && scalar >= "\ud800" && scalar <= "\udfff";

const FIRST_TWO_UTF8_BYTE_SCALAR = String.fromCharCode(0x80);
const FIRST_THREE_UTF8_BYTE_SCALAR = String.fromCharCode(0x800);

const utf8Width = (scalar: string): number =>
  scalar.length === 2 ? 4 : scalar < FIRST_TWO_UTF8_BYTE_SCALAR ? 1 : scalar < FIRST_THREE_UTF8_BYTE_SCALAR ? 2 : 3;

type Converted = Result.Result<readonly [start: number, end: number], UnitConversionRefusal>;

const COUNTER: { readonly [Unit in OffsetUnit]: 0 | 1 | 2 } = {
  "utf16-code-unit": 0,
  "unicode-code-point": 1,
  "utf8-byte": 2,
};

/**
 * Convert the half-open boundaries of `position` to the unit `to` over `text`.
 *
 * The scan walks the scalars once, keeping the three running offsets (UTF-16 units, scalars, UTF-8 bytes), and
 * records the target offset when the source counter equals a boundary. A boundary the counter steps over is
 * `split-boundary`; one past the end of the text is `out-of-range`; a lone surrogate met before the end boundary is
 * `ill-formed-text`. `start < end` holds for every `Position`.
 */
export const convertBoundaries: {
  (to: OffsetUnit, text: string): (position: Position) => Converted;
  (position: Position, to: OffsetUnit, text: string): Converted;
} = dual(3, (position: Position, to: OffsetUnit, text: string): Converted => {
  // decision: native-scan-hot-paths
  const source = COUNTER[position.unit];
  const target = COUNTER[to];
  const offsets = { units: 0, scalars: 0, bytes: 0 };
  const read = (counter: 0 | 1 | 2): number =>
    counter === 0 ? offsets.units : counter === 1 ? offsets.scalars : offsets.bytes;
  let targetStart = -1;
  const settle = (): Converted | undefined => {
    const at = read(source);
    if (targetStart < 0 && at >= position.start) {
      if (at > position.start) {
        return Result.fail("split-boundary");
      }
      targetStart = read(target);
    }
    if (at < position.end) {
      return undefined;
    }
    return at === position.end ? Result.succeed([targetStart, read(target)]) : Result.fail("split-boundary");
  };
  for (const scalar of text) {
    const settled = settle();
    if (settled !== undefined) {
      return settled;
    }
    if (isLoneSurrogate(scalar)) {
      return Result.fail("ill-formed-text");
    }
    offsets.units += scalar.length;
    offsets.scalars += 1;
    offsets.bytes += utf8Width(scalar);
  }
  return settle() ?? Result.fail("out-of-range");
});
