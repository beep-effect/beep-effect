import { convertTextOffsetRange, TextOffsetRange } from "@beep/langextract/VerifiedSpan";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const compareEveryRange = Effect.fnUntraced(function* (source: string) {
  // The former implementation provides an independent bounded reference:
  // JavaScript iteration followed by prefix joins, without sharing the new scan.
  const points = A.fromIterable(source);
  for (let start = 0; start < points.length; start++) {
    for (let end = start + 1; end <= points.length; end++) {
      const actual = yield* convertTextOffsetRange(
        TextOffsetRange.make({
          start: S.Natural.make(start),
          end: S.Natural.make(end),
          unit: "unicode-code-point",
        }),
        source
      );
      expect(actual.startChar).toBe(Str.length(A.join(A.take(points, start), "")));
      expect(actual.endChar).toBe(Str.length(A.join(A.take(points, end), "")));
    }
  }
});

it.effect("preserves every range in ASCII, combining, astral and isolated-surrogate sources", () =>
  Effect.gen(function* () {
    for (const source of ["abc", "A😀B𐐀Z", "e\u0301\r\nB", "\ud800X\udc00Y", "😀\ud800😀\udc00"]) {
      yield* compareEveryRange(source);
    }
  })
);

it.effect("converts near the source ceiling and rejects an out-of-source point", () =>
  Effect.gen(function* () {
    const source = `${Str.repeat(999996)("a")}😀b`;
    const actual = yield* convertTextOffsetRange(
      TextOffsetRange.make({
        start: S.Natural.make(999996),
        end: S.Natural.make(999997),
        unit: "unicode-code-point",
      }),
      source
    );
    expect(actual).toMatchObject({ startChar: 999996, endChar: 999998 });
    const invalid = yield* convertTextOffsetRange(
      TextOffsetRange.make({
        start: S.Natural.make(999998),
        end: S.Natural.make(999999),
        unit: "unicode-code-point",
      }),
      source
    ).pipe(Effect.flip);
    expect(invalid).toMatchObject({ reason: "invalid-offset" });
  })
);

it.effect("allows interruption during a long code-point conversion", () =>
  Effect.gen(function* () {
    const source = Str.repeat(1000000)("a");
    const conversion = convertTextOffsetRange(
      TextOffsetRange.make({
        start: S.Natural.make(999998),
        end: S.Natural.make(999999),
        unit: "unicode-code-point",
      }),
      source
    );
    const fiber = yield* Effect.forkChild(conversion);
    yield* Effect.yieldNow;
    yield* Fiber.interrupt(fiber);
    const exit = yield* Fiber.await(fiber);
    expect(Exit.hasInterrupts(exit)).toBe(true);
  })
);
