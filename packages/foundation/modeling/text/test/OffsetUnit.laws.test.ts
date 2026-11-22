import { fcRuns } from "@beep/fc-runs";
import { it } from "@beep/test-runner";
import { convertPosition, OffsetUnit, Position, slicePosition, UnitConversionRefused } from "@beep/text/OffsetUnit";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { rangeIn, scalarRangeIn, wellFormedText } from "./support/generators.ts";
import type { UnitConversionRefusal } from "@beep/text/OffsetUnit";

const runs = { arbitrary: fcRuns(100) };

const unitArbitrary = Arbitrary.schema(OffsetUnit);

// A generated text, a scalar range in it, and three units: the position of the range in each unit is read from
// the generator's own boundary lists, never from the scan under test.
const caseArbitrary = Arbitrary.flatMap(wellFormedText, (generated) =>
  Arbitrary.map(
    Arbitrary.all([scalarRangeIn(generated.codePoints.length), unitArbitrary, unitArbitrary, unitArbitrary]),
    ([range, u, v, w]) => ({ ...generated, range, u, v, w })
  )
);

const positionOf = (
  boundaries: Record<OffsetUnit, A.NonEmptyReadonlyArray<number>>,
  range: { readonly first: number; readonly last: number },
  unit: OffsetUnit
): Position => Position.make({ unit, ...rangeIn(boundaries[unit])(range) });

const refusal = (reason: UnitConversionRefusal, unit: OffsetUnit, start: number, end: number) =>
  UnitConversionRefused.make({ reason, position: Position.make({ unit, start, end }) });

describe("@beep/text OffsetUnit laws", () => {
  it.prop(
    "L1-2 unit conversion is a bijection on valid boundaries and refuses split surrogates",
    [caseArbitrary],
    ([{ text, boundaries, range, u, v, w }]) => {
      const p = positionOf(boundaries, range, u);
      const inV = Result.getOrThrow(convertPosition(p, v, text));
      // Conversion lands on the independently computed position in the target unit.
      expect(inV).toEqual(positionOf(boundaries, range, v));
      // There and back is the identity.
      assertSuccess(convertPosition(inV, u, text), p);
      // u to v to w equals u to w.
      assertSuccess(convertPosition(inV, w, text), Result.getOrThrow(convertPosition(p, w, text)));
      // The slice is the same in every unit, and it is the text of the scalars in the range.
      const quote = A.join(A.take(A.drop(A.fromIterable(text), range.first), range.last - range.first), "");
      for (const unit of OffsetUnit.literals) {
        assertSuccess(slicePosition(positionOf(boundaries, range, unit), text), quote);
      }
    },
    runs
  );

  it("L1-2 refuses a boundary inside a surrogate pair", () => {
    assertFailure(
      convertPosition(Position.make({ unit: "utf16-code-unit", start: 1, end: 2 }), "unicode-code-point", "A😀B"),
      refusal("split-boundary", "utf16-code-unit", 1, 2)
    );
    assertFailure(
      convertPosition(Position.make({ unit: "utf16-code-unit", start: 2, end: 3 }), "utf8-byte", "A😀B"),
      refusal("split-boundary", "utf16-code-unit", 2, 3)
    );
    // Converting to the position's own unit still checks both boundaries.
    assertFailure(
      slicePosition(Position.make({ unit: "utf16-code-unit", start: 2, end: 3 }), "A😀B"),
      refusal("split-boundary", "utf16-code-unit", 2, 3)
    );
  });

  it("L1-2 refuses a boundary inside a UTF-8 sequence", () => {
    assertFailure(
      convertPosition(Position.make({ unit: "utf8-byte", start: 0, end: 1 }), "utf16-code-unit", "é"),
      refusal("split-boundary", "utf8-byte", 0, 1)
    );
    assertFailure(
      convertPosition(Position.make({ unit: "utf8-byte", start: 1, end: 2 }), "utf16-code-unit", "é"),
      refusal("split-boundary", "utf8-byte", 1, 2)
    );
    assertFailure(
      convertPosition(Position.make({ unit: "utf8-byte", start: 1, end: 3 }), "unicode-code-point", "A€"),
      refusal("split-boundary", "utf8-byte", 1, 3)
    );
  });

  it("L1-2 refuses a boundary past the text", () => {
    assertFailure(
      convertPosition(Position.make({ unit: "unicode-code-point", start: 1, end: 4 }), "utf16-code-unit", "abc"),
      refusal("out-of-range", "unicode-code-point", 1, 4)
    );
    assertFailure(
      convertPosition(Position.make({ unit: "utf8-byte", start: 5, end: 6 }), "utf8-byte", "abc"),
      refusal("out-of-range", "utf8-byte", 5, 6)
    );
    assertFailure(
      slicePosition(Position.make({ unit: "utf16-code-unit", start: 0, end: 1 }), ""),
      refusal("out-of-range", "utf16-code-unit", 0, 1)
    );
  });

  it("L1-2 refuses a lone surrogate before the end boundary", () => {
    assertFailure(
      convertPosition(Position.make({ unit: "utf16-code-unit", start: 1, end: 2 }), "utf8-byte", "\ud800X"),
      refusal("ill-formed-text", "utf16-code-unit", 1, 2)
    );
    assertFailure(
      convertPosition(Position.make({ unit: "unicode-code-point", start: 0, end: 2 }), "utf16-code-unit", "X\udc00"),
      refusal("ill-formed-text", "unicode-code-point", 0, 2)
    );
    // A lone surrogate after the end boundary is never read.
    assertSuccess(
      convertPosition(Position.make({ unit: "unicode-code-point", start: 0, end: 1 }), "utf8-byte", "😀\ud800"),
      Position.make({ unit: "utf8-byte", start: 0, end: 4 })
    );
  });

  it("L1-2 converts through the pipeable forms", () => {
    const b = Position.make({ unit: "unicode-code-point", start: 2, end: 3 });
    assertSuccess(
      convertPosition("utf16-code-unit", "A😀B")(b),
      Position.make({ unit: "utf16-code-unit", start: 3, end: 4 })
    );
    assertSuccess(slicePosition("A😀B")(b), "B");
    expect(Str.length(Result.getOrThrow(slicePosition(b, "A😀B")))).toBe(1);
  });

  it("L1-2 a position is non-empty and encodes with its tag", () => {
    expect(S.is(Position)({ _tag: "Position", unit: "utf8-byte", start: 3, end: 3 })).toBe(false);
    expect(Result.getOrThrow(S.encodeResult(Position)(Position.make({ unit: "utf8-byte", start: 0, end: 3 })))).toEqual(
      {
        _tag: "Position",
        unit: "utf8-byte",
        start: 0,
        end: 3,
      }
    );
  });
});
