import * as Monoid from "@beep/nlp/Algebra/Monoid";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const testMonoidLaws = <A>(
  name: string,
  monoid: Monoid.Monoid<A>,
  arbitrary: Arbitrary.Arbitrary<A>,
  equals: (a: A, b: A) => boolean = (a, b) => a === b
) => {
  describe(`${name} Monoid Laws`, () => {
    it("satisfies left identity: empty ⊕ x = x", () => {
      expect(
        Effect.runSync(
          Arbitrary.checkEffect(Arbitrary.all([arbitrary]), ([x]) => equals(monoid.combine(monoid.empty, x), x))
        )._tag
      ).toBe("Passed");
    });

    it("satisfies right identity: x ⊕ empty = x", () => {
      expect(
        Effect.runSync(
          Arbitrary.checkEffect(Arbitrary.all([arbitrary]), ([x]) => equals(monoid.combine(x, monoid.empty), x))
        )._tag
      ).toBe("Passed");
    });

    it("satisfies associativity: (x ⊕ y) ⊕ z = x ⊕ (y ⊕ z)", () => {
      expect(
        Effect.runSync(
          Arbitrary.checkEffect(Arbitrary.all([arbitrary, arbitrary, arbitrary]), ([x, y, z]) => {
            const left = monoid.combine(monoid.combine(x, y), z);
            const right = monoid.combine(x, monoid.combine(y, z));
            return equals(left, right);
          })
        )._tag
      ).toBe("Passed");
    });
  });
};

// String monoids
testMonoidLaws("StringConcat", Monoid.StringConcat, Arbitrary.schema(S.String));
testMonoidLaws("StringJoin(' ')", Monoid.StringJoin(" "), Arbitrary.schema(S.String));
testMonoidLaws("StringJoin(', ')", Monoid.StringJoin(", "), Arbitrary.schema(S.String));

// Numeric monoids
testMonoidLaws("NumberSum", Monoid.NumberSum, Arbitrary.schema(S.Int));
testMonoidLaws(
  "NumberProduct",
  Monoid.NumberProduct,
  Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(-100_000), S.isLessThanOrEqualTo(100_000)))
);
testMonoidLaws(
  "NumberMax",
  Monoid.NumberMax,
  Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(-1000), S.isLessThanOrEqualTo(1000)))
);
testMonoidLaws(
  "NumberMin",
  Monoid.NumberMin,
  Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(-1000), S.isLessThanOrEqualTo(1000)))
);

// Array monoid
testMonoidLaws(
  "ArrayConcat<number>",
  Monoid.ArrayConcat<number>(),
  Arbitrary.schema(S.Array(S.Int).check(S.isMinLength(0), S.isMaxLength(10))),
  (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
);

// Boolean monoids
testMonoidLaws("BooleanAll", Monoid.BooleanAll, Arbitrary.schema(S.Boolean));
testMonoidLaws("BooleanAny", Monoid.BooleanAny, Arbitrary.schema(S.Boolean));

// Product monoid
describe("Product Monoid Laws", () => {
  const productMonoid = Monoid.Product(Monoid.NumberSum, Monoid.StringConcat);
  const arbitrary = Arbitrary.all([Arbitrary.schema(S.Int), Arbitrary.schema(S.String)]);
  const equals = (a: readonly [number, string], b: readonly [number, string]) => a[0] === b[0] && a[1] === b[1];
  testMonoidLaws("Product(NumberSum, StringConcat)", productMonoid, arbitrary, equals);
});

// Endomorphism monoid
describe("Endo<number> Monoid Laws", () => {
  const endoMonoid = Monoid.Endo<number>();
  const funcArbitrary = Arbitrary.schema(
    S.Struct({
      scale: S.Int.check(S.isBetween({ minimum: -10, maximum: 10 })),
      offset: S.Int.check(S.isBetween({ minimum: -100, maximum: 100 })),
    })
  ).pipe(
    Arbitrary.map(
      ({ scale, offset }) =>
        (value: number) =>
          scale * value + offset
    )
  );
  const equals = (f: (n: number) => number, g: (n: number) => number) =>
    [0, 1, -1, 42, 100].every((input) => f(input) === g(input));
  testMonoidLaws("Endo<number>", endoMonoid, funcArbitrary, equals);
});

// Dual monoid
describe("Dual Monoid", () => {
  const dualConcat = Monoid.Dual(Monoid.StringConcat);
  it("reverses combination order", () => {
    expect(dualConcat.combine("Hello", " world")).toBe(" worldHello");
  });
  testMonoidLaws("Dual(StringConcat)", dualConcat, Arbitrary.schema(S.String));
});

// Vector monoid
describe("VectorAdd Monoid", () => {
  const vectorMonoid = Monoid.VectorAdd(3);
  it("has the zero vector as identity", () => {
    expect(vectorMonoid.empty).toEqual([0, 0, 0]);
  });
  it("adds vectors element-wise", () => {
    expect(vectorMonoid.combine([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
  });
  testMonoidLaws(
    "VectorAdd(3)",
    vectorMonoid,
    Arbitrary.schema(S.Array(S.Int).check(S.isMinLength(3), S.isMaxLength(3))),
    (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
  );
});

// fold / combineAll
describe("Monoid.fold and combineAll", () => {
  it("folds an empty array to the identity", () => {
    expect(Monoid.fold(Monoid.NumberSum)([])).toBe(0);
  });
  it("folds multiple elements correctly", () => {
    expect(Monoid.fold(Monoid.NumberSum)([1, 2, 3, 4, 5])).toBe(15);
  });
  it("joins strings via fold", () => {
    expect(Monoid.fold(Monoid.StringJoin(" "))(["Hello", "world", "from", "Effect"])).toBe("Hello world from Effect");
  });
  it("combineAll combines all elements", () => {
    expect(Monoid.combineAll(Monoid.NumberSum)([1, 2, 3, 4, 5])).toBe(15);
  });
  it("combineAll handles the empty array", () => {
    expect(Monoid.combineAll(Monoid.NumberSum)([])).toBe(0);
  });
});
