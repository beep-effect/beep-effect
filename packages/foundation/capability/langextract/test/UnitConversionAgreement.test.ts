import { convertTextOffsetRange, TextOffsetRange, TextOffsetUnit } from "@beep/langextract/VerifiedSpan";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { convertPosition, Position } from "@beep/text/OffsetUnit";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

// Well-formed text by construction: printable BMP scalars below the surrogate block plus 64 astral emoji. The
// boundaries of each shared unit are computed from the code points, and ranges sit on scalar boundaries.
const CodePointPick = S.Int.check(S.isBetween({ minimum: 0x20, maximum: 0x2fff + 64 }));
const toCodePoint = (pick: number): number => (pick > 0x2fff ? 0x1f600 + (pick - 0x3000) : pick);
const between = (minimum: number, maximum: number) => Arbitrary.schema(S.Int.check(S.isBetween({ minimum, maximum })));

const caseArbitrary = Arbitrary.flatMap(
  Arbitrary.array(Arbitrary.schema(CodePointPick), { minLength: 1, maxLength: 80 }),
  (picks) => {
    const codePoints = A.map(picks, toCodePoint);
    return Arbitrary.flatMap(between(0, codePoints.length - 1), (first) =>
      Arbitrary.map(
        Arbitrary.all([between(first + 1, codePoints.length), Arbitrary.schema(TextOffsetUnit)]),
        ([last, unit]) => ({
          text: A.join(
            A.map(codePoints, (codePoint) => String.fromCodePoint(codePoint)),
            ""
          ),
          boundaries: {
            "utf16-code-unit": A.scan(codePoints, 0, (offset, codePoint) => offset + (codePoint > 0xffff ? 2 : 1)),
            "unicode-code-point": A.scan(codePoints, 0, (offset) => offset + 1),
          },
          first,
          last,
          unit,
        })
      )
    );
  }
);

const agreement = Effect.fnUntraced(function* (unit: TextOffsetUnit, start: number, end: number, text: string) {
  const position = Position.make({ unit, start, end });
  const legacy = yield* Effect.result(
    convertTextOffsetRange(TextOffsetRange.make({ unit, start: S.Natural.make(start), end: S.Natural.make(end) }), text)
  );
  const converted = convertPosition(position, "utf16-code-unit", text);
  return { legacy, converted };
});

describe("@beep/langextract unit conversion agreement with @beep/text", () => {
  it.effect.prop(
    "convertTextOffsetRange and convertPosition agree on the two shared units",
    { generated: caseArbitrary },
    ({ generated }) =>
      Effect.gen(function* () {
        const boundaries = generated.boundaries[generated.unit];
        const start = A.getUnsafe(boundaries, generated.first);
        const end = A.getUnsafe(boundaries, generated.last);
        const { legacy, converted } = yield* agreement(generated.unit, start, end, generated.text);
        const utf16 = Result.getOrThrow(converted);
        expect(Result.getOrThrow(legacy)).toMatchObject({ startChar: utf16.start, endChar: utf16.end });
        expect(utf16).toEqual(
          Position.make({
            unit: "utf16-code-unit",
            start: A.getUnsafe(generated.boundaries["utf16-code-unit"], generated.first),
            end: A.getUnsafe(generated.boundaries["utf16-code-unit"], generated.last),
          })
        );
      }),
    { arbitrary: fcRuns(100) }
  );

  it.effect(
    "both refuse a split surrogate pair and a range past the text",
    Effect.fnUntraced(function* () {
      for (const [unit, start, end] of [
        ["utf16-code-unit", 1, 2],
        ["utf16-code-unit", 2, 3],
        ["utf16-code-unit", 3, 9],
        ["unicode-code-point", 2, 4],
      ] as const) {
        const { legacy, converted } = yield* agreement(unit, start, end, "A😀B");
        legacy.pipe(Result.isFailure, assertTrue);
        converted.pipe(Result.isFailure, assertTrue);
      }
    })
  );
});
