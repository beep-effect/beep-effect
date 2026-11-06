import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { InvalidRangeError, Range, SemVer, UnsatisfiableConstraintError } from "@beep/semver";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

describe("Range", () => {
  describe("parse", () => {
    it.effect("desugars caret ranges into primitive comparators", () =>
      Effect.gen(function* () {
        const range = yield* Range.parse("^1.2.3");
        assert.strictEqual(range.toString(), ">=1.2.3 <2.0.0-0");
      })
    );

    it.effect("parses OR unions of comparator sets", () =>
      Effect.gen(function* () {
        const range = yield* Range.parse("^1.2.0 || 2.x");
        assert.strictEqual(range.sets.length, 2);
      })
    );

    it.effect("parses the empty string as match-all", () =>
      Effect.gen(function* () {
        const range = yield* Range.parse("");
        const parsed = yield* SemVer.parse("0.0.1");
        assert.isTrue(range.test(parsed));
        const parsed1 = yield* SemVer.parse("999.0.0");
        assert.isTrue(range.test(parsed1));
      })
    );

    it.effect("normalizes duplicate comparators differing only in build metadata", () =>
      Effect.gen(function* () {
        const range = yield* Range.parse(">=1.0.0+a >=1.0.0+b");
        assert.strictEqual(range.sets[0]?.length, 1);
      })
    );

    it.effect("fails with InvalidRangeError carrying input and position", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(Range.parse("~>1.0.0"));
        assert.instanceOf(error, InvalidRangeError);
        assert.strictEqual(error._tag, "InvalidRangeError");
        assert.strictEqual(error.input, "~>1.0.0");
        assert.isNumber(error.position);
      })
    );
  });

  it.effect("partial strict upper bounds exclude boundary prereleases even with tuple permission", () =>
    Effect.gen(function* () {
      for (const [upper, tuple] of [
        ["1.x", "1.0.0"],
        ["1", "1.0.0"],
        ["1.2.x", "1.2.0"],
        ["1.2", "1.2.0"],
      ] as const) {
        const input = `>=${tuple}-alpha <${upper}`;
        const range = yield* Range.parse(input);
        assert.strictEqual(range.toString(), `>=${tuple}-alpha <${tuple}-0`);
        assertSuccess(Range.parseResult(input), range);
        const versions = yield* Effect.forEach(
          ["0.9.9", `${tuple}-0`, `${tuple}-alpha`, `${tuple}-beta`, tuple, "2.0.0"],
          SemVer.parse
        );
        for (const version of versions) assert.isFalse(range.test(version), `${input} at ${version}`);
        assert.deepStrictEqual(range.filter(versions), []);
        assert.deepStrictEqual(Range.filter(versions, range), []);
        assertNone(Range.maxSatisfying(versions, range));
        const concrete = yield* Range.parse(`>=${tuple}-alpha <${tuple}`);
        const parsed2 = yield* SemVer.parse(`${tuple}-beta`);
        assert.isTrue(concrete.test(parsed2));
      }
    })
  );

  it.effect("caret and hyphen ranges discard lower components after the first wildcard", () =>
    Effect.gen(function* () {
      const cases: ReadonlyArray<readonly [string, string, string]> = [
        ["^1.x.3", ">=1.0.0 <2.0.0-0", "1.0.0"],
        ["^1.*.3", ">=1.0.0 <2.0.0-0", "1.0.0"],
        ["^1.x.0-alpha", ">=1.0.0 <2.0.0-0", "1.0.0"],
        ["^1.*.0-alpha", ">=1.0.0 <2.0.0-0", "1.0.0"],
        ["^0.x.5", ">=0.0.0 <1.0.0-0", "0.0.0"],
        ["^0.*.5", ">=0.0.0 <1.0.0-0", "0.0.0"],
        ["^1.*.2", ">=1.0.0 <2.0.0-0", "1.0.0"],
        ["^1.x.2", ">=1.0.0 <2.0.0-0", "1.0.0"],
        ["^0.*.2", ">=0.0.0 <1.0.0-0", "0.0.0"],
        ["^0.x.2", ">=0.0.0 <1.0.0-0", "0.0.0"],
        ["~1.x.2", ">=1.0.0 <2.0.0-0", "1.0.0"],
        ["~1.*.2", ">=1.0.0 <2.0.0-0", "1.0.0"],
        ["1.x.3 - 2", ">=1.0.0 <3.0.0-0", "1.0.0"],
        ["1.*.3 - 2", ">=1.0.0 <3.0.0-0", "1.0.0"],
        ["*.1.3 - 2", "<3.0.0-0", "0.0.0"],
        ["x.1.3 - 2", "<3.0.0-0", "0.0.0"],
        ["x.2 - 1.0.0", "<=1.0.0", "0.1.0"],
        ["*.2 - 1.0.0", "<=1.0.0", "0.1.0"],
        ["x.2.3 - 2.0.0", "<=2.0.0", "0.0.0"],
        ["*.2.3 - 2.0.0", "<=2.0.0", "0.0.0"],
        ["1.x.2 - 2.0.0", ">=1.0.0 <=2.0.0", "1.0.0"],
        ["1.*.2 - 2.0.0", ">=1.0.0 <=2.0.0", "1.0.0"],
        ["1.x.0-alpha - 2", ">=1.0.0 <3.0.0-0", "1.0.0"],
        ["1.*.0-alpha - 2", ">=1.0.0 <3.0.0-0", "1.0.0"],
      ];
      for (const [input, expected, stable] of cases) {
        const range = yield* Range.parse(input);
        assert.strictEqual(range.toString(), expected, input);
        assertSuccess(Range.parseResult(input), range);
        const parsed3 = yield* SemVer.parse(stable);
        assert.isTrue(range.test(parsed3), input);
        for (const version of ["0.0.0-alpha", "0.1.0-alpha", "1.0.0-alpha", "1.0.0-beta", "2.0.0-alpha"]) {
          const parsed4 = yield* SemVer.parse(version);
          assert.isFalse(range.test(parsed4), `${input} at ${version}`);
        }
        const parsed5 = yield* SemVer.parse("3.0.0");
        assert.isFalse(range.test(parsed5), input);
      }
    })
  );

  it.effect("primitive X-ranges reject concrete components following a wildcard", () =>
    Effect.gen(function* () {
      for (const input of ["1.x.2", "1.*.0", "1.*.2", "*.1", "*.1.2", "x.1", "x.1.2", ">1.x.2", ">=*.1", ">*.1"]) {
        const error = yield* Effect.flip(Range.parse(input));
        assert.instanceOf(error, InvalidRangeError);
        assert.strictEqual(error.input, input);
        assert.strictEqual(error.position, input.length);
        assertFailure(Range.parseResult(input), error);
      }
      for (const input of ["1.x", "1.x.x", "1.2.x", "*", "~1.x.2", "^1.x.2"]) {
        const range = yield* Range.parse(input);
        assertSuccess(Range.parseResult(input), range);
        const parsed6 = yield* SemVer.parse("1.2.0");
        assert.isTrue(range.test(parsed6), input);
      }
    })
  );

  describe("FromString", () => {
    it.effect("decodes and encodes canonically", () =>
      Effect.gen(function* () {
        const range = yield* S.decodeEffect(Range.FromString)("^1.0.0 || 2.x");
        assert.instanceOf(range, Range);
        const encoded = yield* S.encodeUnknownEffect(Range.FromString)(range);
        const reparsed = yield* S.decodeEffect(Range.FromString)(encoded);
        assert.strictEqual(reparsed.toString(), range.toString());
      })
    );
  });

  describe("test and filter", () => {
    for (const input of ["~*", "~x", "^*", "^x"]) {
      it.effect(`${input} admits every stable version and excludes prereleases`, () =>
        Effect.gen(function* () {
          const range = yield* Range.parse(input);
          assert.strictEqual(range.toString(), ">=0.0.0");
          assertSuccess(Range.parseResult(input), range);
          const stable = yield* Effect.forEach(["0.0.0", "0.9.9", "1.0.0", "2.0.0", "999.0.0"], SemVer.parse);
          const prereleases = yield* Effect.forEach(
            ["0.0.0-0", "0.5.0-alpha", "1.0.0-beta", "2.0.0-rc.1"],
            SemVer.parse
          );
          for (const version of stable) assert.isTrue(range.test(version), `${input} at ${version}`);
          for (const version of prereleases) assert.isFalse(range.test(version), `${input} at ${version}`);
          const versions = [...stable, ...prereleases];
          assert.deepStrictEqual(range.filter(versions), stable);
          assert.deepStrictEqual(Range.filter(versions, range), stable);
        })
      );
    }

    for (const input of [">*", ">x", "<*", "<x"]) {
      it.effect(`${input} matches and filters no stable or prerelease version`, () =>
        Effect.gen(function* () {
          const range = yield* Range.parse(input);
          assert.strictEqual(range.toString(), "<0.0.0-0");
          assertSuccess(Range.parseResult(input), range);
          const versions = yield* Effect.forEach(
            ["0.0.0-0", "0.0.0-alpha", "0.0.0", "0.9.9", "1.0.0-beta", "1.0.0", "2.0.0-rc.1", "2.0.0", "999.0.0"],
            SemVer.parse
          );
          for (const version of versions) assert.isFalse(range.test(version), `${input} at ${version}`);
          assert.deepStrictEqual(range.filter(versions), []);
          assert.deepStrictEqual(Range.filter(versions, range), []);
        })
      );
    }

    it.effect.prop(
      "instance and static satisfaction agree for every schema-generated range and version",
      [Arbitrary.schema(Range), Arbitrary.schema(SemVer)],
      ([range, version]) =>
        Effect.sync(() => {
          assert.strictEqual(Range.satisfies(version, range), range.test(version));
          assert.strictEqual(Range.satisfies(range)(version), range.test(version));
        }),
      { arbitrary: fcRuns(100) }
    );

    it.effect("matches instance and static forms identically", () =>
      Effect.gen(function* () {
        const range = yield* Range.parse("^1.0.0");
        const versions = yield* Effect.forEach(["0.9.0", "1.0.0", "1.9.9", "2.0.0"], (s) => SemVer.parse(s));
        assert.deepStrictEqual(A.map(range.filter(versions), String), ["1.0.0", "1.9.9"]);
        assert.deepStrictEqual(Range.filter(versions, range), range.filter(versions));
        const parsed7 = yield* SemVer.parse("1.5.0");
        assert.isTrue(Range.satisfies(parsed7, range));
        const argument = Range.satisfies(range);
        const parsed43 = yield* SemVer.parse("1.5.0");
        assert.isTrue(argument(parsed43));
      })
    );

    it.effect("enforces the prerelease tuple restriction", () =>
      Effect.gen(function* () {
        const range = yield* Range.parse(">=1.0.0 <2.0.0");
        const parsed8 = yield* SemVer.parse("1.5.0-alpha");
        assert.isFalse(range.test(parsed8));
        const withTuple = yield* Range.parse(">=1.5.0-0 <2.0.0");
        const parsed9 = yield* SemVer.parse("1.5.0-alpha");
        assert.isTrue(withTuple.test(parsed9));
      })
    );
  });

  describe("maxSatisfying / minSatisfying", () => {
    it.effect("finds the extremum satisfying version as an Option", () =>
      Effect.gen(function* () {
        const versions = yield* Effect.forEach(["0.9.0", "1.0.0", "1.5.0", "1.9.9", "2.0.0"], (s) => SemVer.parse(s));
        const range = yield* Range.parse("^1.0.0");
        assertSome(Range.maxSatisfying(versions, range).pipe(O.map(String)), "1.9.9");
        assertSome(Range.minSatisfying(versions, range).pipe(O.map(String)), "1.0.0");
        const parsed10 = yield* Range.parse(">=3.0.0");
        assertNone(Range.maxSatisfying(versions, parsed10));
      })
    );
  });

  describe("algebra", () => {
    const preservedBounds: ReadonlyArray<readonly [string, string, string]> = [
      ["^1.0.0", ">=1.5.0", ">=1.0.0 <2.0.0-0 >=1.5.0"],
      ["~1.2.3", ">=1.2.5", ">=1.2.3 <1.3.0-0 >=1.2.5"],
    ];
    for (const [input, lower, expected] of preservedBounds) {
      it.effect(`intersect preserves ${input} formatting and its prerelease upper bound`, () =>
        Effect.gen(function* () {
          const left = yield* Range.parse(input);
          const right = yield* Range.parse(lower);
          const both = yield* Range.intersect(left, right);
          assert.strictEqual(both.toString(), expected);
          assert.deepStrictEqual(both.sets, [[...A.flatten(left.sets), ...A.flatten(right.sets)]]);
          const upper = A.findFirst(A.flatten(both.sets), (comparator) => comparator.operator === "<");
          assertSome(
            O.map(upper, (comparator) => comparator.version.prerelease),
            [0]
          );
        })
      );
    }

    it.effect("union combines with OR semantics", () =>
      Effect.gen(function* () {
        const parsed11 = yield* Range.parse("^1.0.0");
        const parsed33 = yield* Range.parse("^2.0.0");
        const combined = Range.union(parsed11, parsed33);
        const parsed12 = yield* SemVer.parse("1.5.0");
        assert.isTrue(combined.test(parsed12));
        const parsed13 = yield* SemVer.parse("2.5.0");
        assert.isTrue(combined.test(parsed13));
        const parsed14 = yield* SemVer.parse("3.0.0");
        assert.isFalse(combined.test(parsed14));
      })
    );

    it.effect("intersect keeps only versions matching both", () =>
      Effect.gen(function* () {
        const parsed15 = yield* Range.parse(">=1.0.0");
        const parsed34 = yield* Range.parse("<2.0.0");
        const both = yield* Range.intersect(parsed15, parsed34);
        const parsed16 = yield* SemVer.parse("1.5.0");
        assert.isTrue(both.test(parsed16));
        const parsed17 = yield* SemVer.parse("2.0.0");
        assert.isFalse(both.test(parsed17));
        const parsed18 = yield* SemVer.parse("0.9.0");
        assert.isFalse(both.test(parsed18));
      })
    );

    it.effect("intersect supports the data-last call form", () =>
      Effect.gen(function* () {
        const lower = yield* Range.parse(">=1.0.0");
        const upper = yield* Range.parse("<2.0.0");
        // Data-last: intersect(that)(self) intersects self with that.
        const both = yield* Range.intersect(upper)(lower);
        const parsed19 = yield* SemVer.parse("1.5.0");
        assert.isTrue(both.test(parsed19));
        const parsed20 = yield* SemVer.parse("2.0.0");
        assert.isFalse(both.test(parsed20));
      })
    );

    it.effect("intersect fails typed on unsatisfiable constraints", () =>
      Effect.gen(function* () {
        const parsed21 = yield* Range.parse("<1.0.0");
        const parsed35 = yield* Range.parse(">=2.0.0");
        const error = yield* Effect.flip(Range.intersect(parsed21, parsed35));
        assert.instanceOf(error, UnsatisfiableConstraintError);
        assert.strictEqual(error._tag, "UnsatisfiableConstraintError");
        assert.strictEqual(error.constraints.length, 2);
        assert.strictEqual(error.message, "No version satisfies all 2 constraints");
      })
    );

    it.effect("isSubset detects containment and documents its conservative approximation", () =>
      Effect.gen(function* () {
        const parsed22 = yield* Range.parse("^1.2.0");
        const parsed36 = yield* Range.parse(">=1.0.0");
        assert.isTrue(Range.isSubset(parsed22, parsed36));
        const parsed23 = yield* Range.parse(">=1.0.0");
        const parsed37 = yield* Range.parse("^1.2.0");
        assert.isFalse(Range.isSubset(parsed23, parsed37));
        // Documented false negative: the sub-range straddles sup's set boundary.
        const parsed24 = yield* Range.parse(">=1.0.0 <3.0.0");
        const parsed38 = yield* Range.parse(">=1.0.0 <2.0.0 || >=2.0.0 <3.0.0");
        assert.isFalse(Range.isSubset(parsed24, parsed38));
      })
    );

    it.effect("equivalent is mutual subset", () =>
      Effect.gen(function* () {
        const parsed25 = yield* Range.parse("^1.2.3");
        const parsed39 = yield* Range.parse(">=1.2.3 <2.0.0-0");
        assert.isTrue(Range.equivalent(parsed25, parsed39));
        const parsed26 = yield* Range.parse("^1.2.3");
        const parsed40 = yield* Range.parse("~1.2.3");
        assert.isFalse(Range.equivalent(parsed26, parsed40));
      })
    );

    it.effect("simplify drops redundant comparator sets", () =>
      Effect.gen(function* () {
        const range = yield* Range.parse("^1.2.0 || >=1.0.0");
        const simplified = Range.simplify(range);
        assert.strictEqual(simplified.sets.length, 1);
        assert.strictEqual(simplified.toString(), ">=1.0.0");
      })
    );
  });

  // `parseResult` and `intersectResult` are the primitives; `parse` and
  // `intersect` derive from them via `Effect.fromResult` and add only the
  // tracing span. Both directions are asserted per row so the two forms
  // cannot drift.
  describe("Result parity", () => {
    const parseRows: ReadonlyArray<readonly [label: string, input: string]> = [
      ["a caret range", "^1.0.0"],
      ["a tilde range", "~1.2.3"],
      ["an x-range", "1.x"],
      ["a wildcard", "*"],
      ["a hyphen range", "1.0.0 - 2.0.0"],
      ["a union", "^1.2.0 || >=3.0.0"],
      ["a prerelease bound", ">=1.0.0-rc.1 <2.0.0"],
      ["a bad operator", "~>1.2.3"],
      ["an unparseable operand", "^not-a-version"],
      ["the empty string", ""],
    ];

    for (const [label, input] of parseRows) {
      it.effect(`parse and parseResult agree on ${label}`, () =>
        Effect.gen(function* () {
          const viaEffect = yield* Effect.result(Range.parse(input));
          assert.deepStrictEqual(Range.parseResult(input), viaEffect);
        })
      );
    }

    it("parseResult succeeds with a normalized Range", () => {
      const result = Range.parseResult("^1.0.0");
      if (Result.isFailure(result)) {
        return assert.fail("expected a successful parse");
      }
      assert.instanceOf(result.success, Range);
      assert.strictEqual(result.success.toString(), ">=1.0.0 <2.0.0-0");
    });

    it("parseResult carries the typed failure, not a throw", () => {
      const result = Range.parseResult("~>1.2.3");
      if (Result.isSuccess(result)) {
        return assert.fail("expected a typed parse failure");
      }
      assert.instanceOf(result.failure, InvalidRangeError);
      assert.strictEqual(result.failure.input, "~>1.2.3");
    });

    const intersectRows: ReadonlyArray<readonly [label: string, a: string, b: string]> = [
      ["overlapping ranges", "^1.0.0", ">=1.5.0"],
      ["identical ranges", "^1.0.0", "^1.0.0"],
      ["a wildcard against a caret", "*", "^2.0.0"],
      ["unions on both sides", "^1.0.0 || ^3.0.0", "^1.2.0 || ^3.1.0"],
      ["disjoint ranges", "^1.0.0", "^2.0.0"],
      ["a fully empty intersection", "<1.0.0", ">=2.0.0"],
    ];

    for (const [label, a, b] of intersectRows) {
      it.effect(`intersect and intersectResult agree on ${label}`, () =>
        Effect.gen(function* () {
          const left = yield* Range.parse(a);
          const right = yield* Range.parse(b);
          const viaEffect = yield* Effect.result(Range.intersect(left, right));
          assert.deepStrictEqual(Range.intersectResult(left, right), viaEffect);
        })
      );
    }

    // `Range` is a `Schema.Class`, which is not `Pipeable` in v4, so the
    // data-last forms are applied directly rather than through `.pipe`.
    it.effect("the data-last forms of both agree too", () =>
      Effect.gen(function* () {
        const left = yield* Range.parse("^1.0.0");
        const right = yield* Range.parse(">=1.5.0");
        const viaEffect = yield* Effect.result(Range.intersect(right)(left));
        const viaResult = Range.intersectResult(right)(left);
        assert.deepStrictEqual(viaResult, viaEffect);
        assert.deepStrictEqual(viaResult, Range.intersectResult(left, right));
      })
    );

    it.effect("intersectResult carries the typed failure, not a throw", () =>
      Effect.gen(function* () {
        const left = yield* Range.parse("^1.0.0");
        const right = yield* Range.parse("^2.0.0");
        const result = Range.intersectResult(left, right);
        if (Result.isSuccess(result)) {
          return assert.fail("expected a typed intersection failure");
        }
        assert.instanceOf(result.failure, UnsatisfiableConstraintError);
        assert.deepStrictEqual([...result.failure.constraints], [left, right]);
      })
    );
  });
});

// Required round-1 regressions; upstream assertions above remain intact.
describe("Range round-1 regressions", () => {
  it.effect("simplify retains the earliest duplicate alongside unrelated branches", () =>
    Effect.gen(function* () {
      const range = yield* Range.parse(">=1.0.0+a || >=1.0.0+b || <0.5.0");
      const simplified = Range.simplify(range);
      assert.strictEqual(simplified.sets.length, 2);
      assert.strictEqual(simplified.toString(), ">=1.0.0+a || <0.5.0");
      for (const input of ["0.0.0", "0.4.9", "0.5.0", "1.2.3", "2.0.0", "1.0.0-beta"]) {
        const version = yield* SemVer.parse(input);
        assert.strictEqual(simplified.test(version), range.test(version), input);
      }
    })
  );

  it.effect("simplify retains the earliest mutually containing but distinct set", () =>
    Effect.gen(function* () {
      const range = yield* Range.parse(">=1.0.0 <2.0.0 || >=0.0.0 >=1.0.0 <2.0.0 || >=3.0.0");
      const simplified = Range.simplify(range);
      assert.strictEqual(simplified.toString(), ">=1.0.0 <2.0.0 || >=3.0.0");
      assert.isTrue(simplified.test(SemVer.of(1, 5, 0)));
      assert.isTrue(simplified.test(SemVer.of(3, 0, 0)));
      const parsed27 = yield* Range.parse(">=1.0.0 || >=1.0.0");
      assert.strictEqual(Range.simplify(parsed27).sets.length, 1);
    })
  );

  it.effect("intersection does not inherit a prerelease permission from just one operand", () =>
    Effect.gen(function* () {
      const a = yield* Range.parse(">=1.0.0-alpha");
      const b = yield* Range.parse("<2.0.0");
      const v = yield* SemVer.parse("1.0.0-beta");
      assert.isTrue(a.test(v));
      assert.isFalse(b.test(v));
      const both = yield* Range.intersect(a, b);
      assert.isFalse(both.test(v));
      assert.isTrue(both.test(SemVer.of(1, 0, 0)));
    })
  );

  it.effect("intersection membership equals conjunction across stable and prerelease branches", () =>
    Effect.gen(function* () {
      const ranges = yield* Effect.forEach(
        [
          ">=1.0.0-alpha",
          "<2.0.0",
          ">=1.0.0-beta <1.0.1",
          ">1.0.0 <1.0.1",
          ">=0.0.0 <2.0.0-beta",
          ">=1.0.0-0 <2.0.0-0",
          "1.0.0-alpha",
          ">1.0.0-alpha <1.0.0-alpha.0",
          ">1.0.0-alpha <1.0.0-alpha.0.0",
          ">=1.0.0-0 <2.0.0 || >=2.0.0-beta",
          "*",
          "<0.0.0-0",
        ],
        Range.parse
      );
      ranges.push(Range.make({ sets: [[]] }), Range.make({ sets: [] }));
      const versions = yield* Effect.forEach(
        [
          "0.0.0-0",
          "0.0.0",
          "0.9.9",
          "1.0.0-0",
          "1.0.0-alpha",
          "1.0.0-alpha.0",
          "1.0.0-alpha.0.0",
          "1.0.0-beta",
          "1.0.0",
          "1.0.1-0",
          "1.0.1-beta",
          "1.0.1",
          "1.5.0-alpha",
          "1.5.0",
          "2.0.0-0",
          "2.0.0-alpha",
          "2.0.0-beta",
          "2.0.0",
        ],
        SemVer.parse
      );
      for (const a of ranges) {
        for (const b of ranges) {
          const intersection = Range.intersectResult(a, b);
          for (const v of versions) {
            const actual = Result.isSuccess(intersection) && intersection.success.test(v);
            assert.strictEqual(actual, a.test(v) && b.test(v), `${a} AND ${b} at ${v}`);
          }
        }
      }
    })
  );

  it.effect("subset and union simplification preserve prerelease tuple permissions", () =>
    Effect.gen(function* () {
      const sub = yield* Range.parse(">=1.0.0-alpha <2.0.0");
      const sup = yield* Range.parse(">=0.0.0 <2.0.0");
      assert.isFalse(Range.isSubset(sub, sup));
      assert.isFalse(Range.isSubset(Range.make({ sets: [[]] }), sup));
      assert.isTrue(Range.isSubset(sub, Range.make({ sets: [[]] })));
      const union = Range.union(sub, sup);
      const simplified = Range.simplify(union);
      assert.strictEqual(simplified.sets.length, 2);
      for (const input of ["0.0.0", "1.0.0-alpha", "1.0.0-beta", "1.0.0", "1.5.0-beta", "2.0.0"]) {
        const v = yield* SemVer.parse(input);
        assert.strictEqual(simplified.test(v), union.test(v), input);
      }
      // A mentioned tuple with no possible prerelease witness adds no permission.
      const parsed28 = yield* Range.parse(">=1.0.0 <2.0.0-0");
      assert.isTrue(Range.isSubset(parsed28, sup));
    })
  );

  it.effect("intersection rejects adjacent stable gaps and checks actual prerelease witnesses", () =>
    Effect.gen(function* () {
      for (const [a, b] of [
        [">1.0.0", "<1.0.1"],
        [">1.0.0-alpha", "<1.0.0-alpha.0"],
        [">9007199254740991.9007199254740991.9007199254740991", "*"],
      ] as const) {
        const left = yield* Range.parse(a);
        const right = yield* Range.parse(b);
        const result = Range.intersectResult(left, right);
        const error = yield* Effect.flip(Range.intersect(left, right));
        assertFailure(result, error);
        assert.instanceOf(error, UnsatisfiableConstraintError);
      }
      const parsed29 = yield* Range.parse(">1.0.0-alpha");
      const parsed41 = yield* Range.parse("<1.0.0-alpha.0.0");
      const pre = yield* Range.intersect(parsed29, parsed41);
      const parsed30 = yield* SemVer.parse("1.0.0-alpha.0");
      assert.isTrue(pre.test(parsed30));
      const parsed31 = yield* Range.parse(">0.0.9007199254740991");
      const parsed42 = yield* Range.parse("<0.1.1");
      const carry = yield* Range.intersect(parsed31, parsed42);
      assert.isTrue(carry.test(SemVer.of(0, 1, 0)));
    })
  );

  it.effect("incrementing sugar overflow fails typed through parseResult and parse", () =>
    Effect.gen(function* () {
      for (const input of [
        "^9007199254740991.0.0",
        "~1.9007199254740991.0",
        "^0.9007199254740991.0",
        "^0.0.9007199254740991",
        "9007199254740991.x",
        "1.9007199254740991.x",
      ]) {
        const result = Range.parseResult(input);
        if (Result.isSuccess(result)) return assert.fail(`expected overflow failure for ${input}`);
        assert.instanceOf(result.failure, InvalidRangeError);
        assert.strictEqual(result.failure.input, input);
        const error = yield* Effect.flip(Range.parse(input));
        assert.instanceOf(error, InvalidRangeError);
        assert.strictEqual(error.input, input);
      }
      for (const input of ["9007199254740991.0.0", "^9007199254740990.0.0", "~1.9007199254740990.0"]) {
        const argument1 = Range.parseResult(input);
        const parsed44 = yield* Range.parse(input);
        assertSuccess(argument1, parsed44);
      }
    })
  );

  it.effect("FromString round-trips empty unions without inventing members", () =>
    Effect.gen(function* () {
      const original = Range.make({ sets: [] });
      const encoded = yield* S.encodeEffect(Range.FromString)(original);
      assert.strictEqual(encoded, "<0.0.0-0");
      const decoded = yield* S.decodeEffect(Range.FromString)(encoded);
      for (const input of ["0.0.0-0", "0.0.0", "1.0.0-beta", "1.0.0"]) {
        const v = yield* SemVer.parse(input);
        assert.isFalse(original.test(v));
        assert.strictEqual(decoded.test(v), original.test(v));
      }
      assert.strictEqual(original.toString(), "");
    })
  );

  it.effect("FromString rejects unrepresentable unrestricted empty sets with a schema issue", () =>
    Effect.gen(function* () {
      for (const sets of [[[]], [[], []]]) {
        const original = Range.make({ sets });
        const parsed32 = yield* SemVer.parse("1.0.0-beta");
        assert.isTrue(original.test(parsed32));
        const error = yield* Effect.flip(S.encodeEffect(Range.FromString)(original));
        assert.strictEqual(error._tag, "SchemaError");
        assert.include(error.message, "unrestricted empty comparator set");
      }
    })
  );

  it.effect("normalization preserves operator weights, stable ties and build deduplication", () =>
    Effect.gen(function* () {
      const range = yield* Range.parse("<=2.0.0 =1.0.0+b >1.0.0 <2.0.0 >=1.0.0 >=0.5.0 =1.0.0+a");
      assert.strictEqual(range.toString(), ">=0.5.0 >=1.0.0 >1.0.0 1.0.0+b <2.0.0 <=2.0.0");
    })
  );
});
