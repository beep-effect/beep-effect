import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationRegexAtomSets,
  makeCitationRegexAlphabet,
} from "@beep/law-practice-server/internal/Citation/RegexAlphabet";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("test/CitationRegexAlphabet");
const Point = S.Natural.check(S.isLessThanOrEqualTo(0x10ffff)).pipe(
  $I.annoteSchema("Point", { description: "Synthetic source points, including surrogate points." })
);
const Points = S.Array(Point)
  .check(S.isMaxLength(16))
  .pipe($I.annoteSchema("Points", { description: "Bounded generated source points." }));
const native = (points: ReadonlyArray<number>) => {
  const bytes = new Uint8Array(A.length(points) * 4);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < A.length(points); index++) {
    view.setUint32(index * 4, A.getUnsafe(points, index), true);
  }
  return { width: 4, bytes };
};
const letters = (cells: ReadonlyArray<number>) =>
  A.join(
    A.map(cells, (cell) => String.fromCodePoint(0x100 + cell)),
    ""
  );

it.effect("partitions intersecting atom sets into constant-membership cells", () =>
  Effect.gen(function* () {
    const citationResult1 = yield* defaultCitationEnginePolicy;
    const alphabet = yield* makeCitationRegexAlphabet(citationResult1.limits);
    const result = yield* alphabet.prepare(
      {
        atoms: 3,
        intervals: [
          { atom: 0, start: 0, end: 100 },
          { atom: 1, start: 50, end: 150 },
          { atom: 2, start: 96, end: 250 },
        ],
      },
      native([0, 49, 50, 95, 96, 100, 101, 150, 151, 250, 251, 0x10ffff])
    );
    expect(result.cells).toBe(6);
    expect(result.pythonLength).toBe(12);
    expect(result.source).toBe(letters([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]));
    expect(result.atoms).toEqual([
      `[${letters([0])}-${letters([2])}]`,
      `[${letters([1])}-${letters([3])}]`,
      `[${letters([2])}-${letters([4])}]`,
    ]);
  })
);

it.effect("distinguishes literal surrogate points from a scalar with identical display projection", () =>
  Effect.gen(function* () {
    const citationResult2 = yield* defaultCitationEnginePolicy;
    const alphabet = yield* makeCitationRegexAlphabet(citationResult2.limits);
    const sets = {
      atoms: 4,
      intervals: [
        { atom: 0, start: 48, end: 57 },
        { atom: 1, start: 0xd835, end: 0xd835 },
        { atom: 2, start: 0x1d7ce, end: 0x1d7ce },
        { atom: 3, start: 0, end: 0x10ffff },
      ],
    };
    const pair = yield* alphabet.prepare(sets, { width: 2, bytes: new Uint8Array([0x35, 0xd8, 0xce, 0xdf]) });
    const scalar = yield* alphabet.prepare(sets, native([0x1d7ce]));
    expect(pair.source).toBe(letters([3, 4]));
    expect(scalar.source).toBe(letters([5]));
    expect(pair.pythonLength).toBe(2);
    expect(scalar.pythonLength).toBe(1);
    expect(pair.atoms).toEqual(scalar.atoms);
    expect(pair.atoms).toEqual([
      `[${letters([1])}]`,
      `[${letters([3])}]`,
      `[${letters([5])}]`,
      `[${letters([0])}-${letters([6])}]`,
    ]);
  })
);

it.effect.prop(
  "preserves atomic interval membership for every generated native source point",
  [Point, Point, Points],
  ([left, right, points]) =>
    Effect.gen(function* () {
      const start = Num.min(left, right);
      const end = Num.max(left, right);
      const citationResult3 = yield* defaultCitationEnginePolicy;
      const alphabet = yield* makeCitationRegexAlphabet(citationResult3.limits);
      const inputs = [...points, start, end, 0x10ffff];
      const result = yield* alphabet.prepare({ atoms: 1, intervals: [{ atom: 0, start, end }] }, native(inputs));
      const wanted = letters([start === 0 ? 0 : 1]);
      expect(result.atoms).toEqual([`[${wanted}]`]);
      for (let index = 0; index < A.length(inputs); index++) {
        const point = A.getUnsafe(inputs, index);
        expect(result.source[index] === wanted).toBe(point >= start && point <= end);
      }
      expect(result.pythonLength).toBe(A.length(inputs));
    })
);

it.effect("retains empty predicates and handles a complete universe without extra cells", () =>
  Effect.gen(function* () {
    const citationResult4 = yield* defaultCitationEnginePolicy;
    const alphabet = yield* makeCitationRegexAlphabet(citationResult4.limits);
    const result = yield* alphabet.prepare(
      { atoms: 2, intervals: [{ atom: 1, start: 0, end: 0x10ffff }] },
      native([0, 0xd800, 0x10ffff])
    );
    expect(result.cells).toBe(1);
    expect(result.atoms).toEqual(["(?!)", `[${letters([0])}]`]);
    expect(result.source).toBe(letters([0, 0, 0]));
    const empty = yield* alphabet.prepare({ atoms: 1, intervals: [] }, { width: 1, bytes: new Uint8Array(0) });
    expect(empty.source).toBe("");
    expect(empty.pythonLength).toBe(0);
    expect(empty.atoms).toEqual(["(?!)"]);
  })
);

it.effect("rejects noncanonical sets and charges encoded atom expansion before source preparation", () =>
  Effect.gen(function* () {
    const policy = (yield* defaultCitationEnginePolicy).limits;
    const alphabet = yield* makeCitationRegexAlphabet(policy);
    for (const intervals of [
      [{ atom: 0, start: 3, end: 2 }],
      [{ atom: 1, start: 0, end: 1 }],
      [
        { atom: 0, start: 1, end: 2 },
        { atom: 0, start: 2, end: 3 },
      ],
      [
        { atom: 0, start: 1, end: 2 },
        { atom: 0, start: 3, end: 4 },
      ],
    ]) {
      const citationResult8 = yield* alphabet
        .prepare({ atoms: 1, intervals }, { width: 1, bytes: new Uint8Array(0) })
        .pipe(Effect.flip);
      expect(citationResult8).toMatchObject({ reason: "invalid-frame" });
    }
    const small = yield* makeCitationRegexAlphabet({ ...policy, patternUtf16: 2 });
    const citationResult5 = yield* small
      .prepare({ atoms: 1, intervals: [{ atom: 0, start: 48, end: 57 }] }, "invalid source")
      .pipe(Effect.flip);
    expect(citationResult5).toMatchObject({ limit: "patternUtf16" });
    const citationResult6 = yield* S.decodeEffect(CitationRegexAtomSets)({ atoms: 0, intervals: [] }).pipe(Effect.flip);
    expect(citationResult6).toBeDefined();
  })
);

it.effect("captures Clock identity and the shorter total-operation deadline", () =>
  Effect.gen(function* () {
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const clock = yield* Clock.Clock;
    const immediate: Clock.Clock = { ...clock, sleep: () => Effect.void };
    const disabled: Clock.Clock = { ...clock, sleep: () => Effect.never };
    const alphabet = yield* makeCitationRegexAlphabet({ ...limits, operationDeadline: Duration.millis(1) }).pipe(
      Effect.provideService(Clock.Clock, immediate)
    );
    const citationResult7 = yield* alphabet
      .prepare({ atoms: 1, intervals: [] }, { width: 1, bytes: new Uint8Array(0) })
      .pipe(Effect.provideService(Clock.Clock, disabled), Effect.flip);
    expect(citationResult7).toMatchObject({ operation: "extract", limit: "operationDeadline" });
  })
);
