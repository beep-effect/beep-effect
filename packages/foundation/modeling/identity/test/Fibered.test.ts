import { fcRuns } from "@beep/fc-runs";
import { Fibered } from "@beep/identity";
import { describe, expect, expectTypeOf, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const Base = S.Literals(["text", "count", "flag"]);
const points = [...Base.literals];
const Section = S.Struct({
  label: S.String,
  rank: S.Finite,
  route: S.String,
});
const decodeSection = S.decodeUnknownEffect(Section);
const sectionValues = {
  text: { label: "Text", rank: 1, route: "/text" },
  count: { label: "Count", rank: 2, route: "/count" },
  flag: { label: "Flag", rank: 3, route: "/flag" },
};
const family = Fibered.make({
  base: Base,
  fibers: {
    text: S.String,
    count: S.Finite,
    flag: S.Boolean,
  },
  section: {
    schema: Section,
    values: sectionValues,
  },
});
const decodeFamilyUnion = S.decodeUnknownEffect(family.union);
const decodeUnknownFamilyUnionExit = S.decodeUnknownExit(family.union);

describe("Fibered", () => {
  it("is total over the base and preserves declaration order", () => {
    expect(family.points).toBe(Base.literals);
    expect(family.points).toEqual(["text", "count", "flag"]);

    for (const point of Base.literals) {
      expect(family.member(point)).toBe(family.members[point]);
      expect(family.meta(point)).toBeDefined();
    }
  });

  it.effect(
    "decodes each section value once and uses the default annotation key",
    Effect.fnUntraced(function* () {
      for (const point of Base.literals) {
        const expected = yield* decodeSection(sectionValues[point]);
        const first = family.meta(point);

        expect(first).toEqual(expected);
        expect(family.meta(point)).toBe(first);
        expect(S.resolveAnnotations(family.member(point))?.fiberedSection).toBe(first);
      }
    })
  );

  it.prop(
    "maps every schema-generated union value to its point's section",
    [Arbitrary.schema(family.union)],
    ([value]) => {
      expect(family.fiberOf(value)).toBe(family.meta(value._tag));
      expect(S.is(family.member(value._tag))(value)).toBe(true);

      return true;
    },
    { arbitrary: fcRuns(100) }
  );

  it.effect(
    "maps decoded member values back to their section metadata",
    Effect.fnUntraced(function* () {
      const text = yield* S.decodeEffect(family.member("text"))({ _tag: "text", value: "hello" });
      const count = yield* S.decodeEffect(family.member("count"))({ _tag: "count", value: 3 });

      expect(family.fiberOf(text)).toBe(family.meta("text"));
      expect(family.fiberOf(count)).toBe(family.meta("count"));
    })
  );

  it.effect(
    "accepts every member encoding and rejects wrong tags and payloads",
    Effect.fnUntraced(function* () {
      expect(yield* decodeFamilyUnion({ _tag: "text", value: "hello" })).toEqual({
        _tag: "text",
        value: "hello",
      });
      expect(yield* decodeFamilyUnion({ _tag: "count", value: 3 })).toEqual({
        _tag: "count",
        value: 3,
      });
      expect(yield* decodeFamilyUnion({ _tag: "flag", value: true })).toEqual({
        _tag: "flag",
        value: true,
      });
      expect(decodeUnknownFamilyUnionExit({ _tag: "missing", value: "hello" })._tag).toBe("Failure");
      expect(decodeUnknownFamilyUnionExit({ _tag: "count", value: "three" })._tag).toBe("Failure");
    })
  );

  it("projects named section keys and permits the empty projection", () => {
    expect(family.project("text", ["label", "route"])).toEqual({ label: "Text", route: "/text" });
    expect(family.project("count", [])).toEqual({});
  });

  it.prop(
    "property-checks pullback restriction and composition over random subsets",
    [
      Arbitrary.schema(S.Array(S.Literals(points)).check(S.isMaxLength(points.length))).pipe(Arbitrary.map(A.dedupe)),
      Arbitrary.schema(S.Array(S.Literals(points)).check(S.isMaxLength(points.length))).pipe(Arbitrary.map(A.dedupe)),
    ],
    ([subset, candidate]) => {
      const subsubset = A.filter(subset, (point) => A.contains(candidate, point));
      const restricted = family.pullback(subset);
      const composed = restricted.pullback(subsubset);
      const direct = family.pullback(subsubset);

      expect(restricted.points).toEqual(subset);
      for (const point of subset) {
        expect(restricted.member(point)).toBe(family.member(point));
        expect(restricted.meta(point)).toBe(family.meta(point));
      }

      expect(composed.points).toEqual(direct.points);
      for (const point of subsubset) {
        expect(composed.member(point)).toBe(direct.member(point));
        expect(composed.meta(point)).toBe(direct.meta(point));
      }

      return true;
    },
    { arbitrary: fcRuns(100) }
  );

  it("preserves point-specific member and pullback types", () => {
    expectTypeOf(family.member("text")).not.toEqualTypeOf(family.member("count"));
    const textOnly = family.pullback(["text"]);
    expectTypeOf(textOnly.meta).parameter(0).toEqualTypeOf<"text">();
    const rejectExcludedPoint = () => {
      // @ts-expect-error The pullback excludes the count point.
      textOnly.meta("count");
    };
    expectTypeOf(rejectExcludedPoint).toBeFunction();
  });

  it("requires a section value for every base point at compile time", () => {
    const rejectPartialSection = () =>
      Fibered.make({
        base: S.Literals(["x", "y"]),
        fibers: { x: S.String, y: S.Finite },
        section: {
          schema: S.Struct({ label: S.String }),
          // @ts-expect-error A total section over x and y must include y.
          values: { x: { label: "X" } },
        },
      });

    expectTypeOf(rejectPartialSection).toBeFunction();
  });

  it("rejects member hooks that return a non-member schema", () => {
    const rejectInvalidMemberHook = () =>
      Fibered.make({
        base: S.Literals(["text"]),
        fibers: { text: S.String },
        // @ts-expect-error Member hooks must preserve the tagged member shape.
        member: () => S.String,
        section: {
          schema: S.Struct({ label: S.String }),
          values: { text: { label: "Text" } },
        },
      });

    expectTypeOf(rejectInvalidMemberHook).toBeFunction();
  });

  it("returns the schema produced by a conforming member hook", () => {
    const customFamily = Fibered.make({
      base: S.Literals(["custom"]),
      fibers: { custom: S.String },
      member: (point, fiber) =>
        S.Struct({ _tag: S.tag(point), value: fiber }).annotate({ description: "Custom member schema" }),
      section: {
        schema: S.Struct({ label: S.String }),
        values: { custom: { label: "Custom" } },
      },
    });
    const member = customFamily.member("custom");

    expect(S.resolveAnnotations(member)?.description).toBe("Custom member schema");
    expect(S.is(member)({ _tag: "custom", value: "payload" })).toBe(true);
  });
});
