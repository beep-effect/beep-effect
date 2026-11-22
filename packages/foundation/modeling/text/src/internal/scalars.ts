// The one code-point scan of `@beep/text`: unit conversion and slicing read it here, so every module agrees on what
// a scalar is and how wide it is in each unit.
import { dual } from "effect/Function";
import * as Result from "effect/Result";
import type { OffsetUnit, Position, UnitConversionRefusal } from "../OffsetUnit.ts";

// Performance boundary (single-pass scan): conversion visits every code point of a text before the end boundary,
// so the per-point path iterates the string natively and keeps its running offsets in local variables. Module
// namespace helper calls cost a property lookup per call (a getter call under Vite's module runner); the same
// boundary is drawn in `@beep/langextract` `VerifiedSpan.behavior.ts`. Nothing escapes a call but its result.

// String iteration yields one scalar at a time and a lone surrogate as a one-unit string; single code units compare
// by code-unit value, so the range tests below read no code point.
const isLoneSurrogate = (scalar: string): boolean => scalar.length === 1 && scalar >= "\ud800" && scalar <= "\udfff";

// The first BMP scalars that take two and three UTF-8 bytes.
const FIRST_TWO_BYTE = String.fromCharCode(0x80);
const FIRST_THREE_BYTE = String.fromCharCode(0x800);

// UTF-8 width of one scalar: astral scalars are the two-unit strings; BMP widths by code-point range.
const utf8Width = (scalar: string): number =>
  scalar.length === 2 ? 4 : scalar < FIRST_TWO_BYTE ? 1 : scalar < FIRST_THREE_BYTE ? 2 : 3;

// The converted boundaries `[start, end)` in the target unit, or why they could not be converted.
type Converted = Result.Result<readonly [start: number, end: number], UnitConversionRefusal>;

// Position of each unit's counter in the scan. A record over the literal domain, so a new unit fails to compile.
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
  const source = COUNTER[position.unit];
  const target = COUNTER[to];
  const offsets = { units: 0, scalars: 0, bytes: 0 };
  const read = (counter: 0 | 1 | 2): number =>
    counter === 0 ? offsets.units : counter === 1 ? offsets.scalars : offsets.bytes;
  let targetStart = -1;
  // The outcome once the source counter reaches the end boundary, or undefined while the scan must go on.
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
