import { A } from "@beep/utils";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import { describe, expect, it } from "tstyche";
import type { O } from "@beep/utils";

const nonEmpty: A.NonEmptyReadonlyArray<number> = [1, 2, 3];

describe("mapNonEmpty", () => {
  it("data-first returns NonEmptyArray", () => {
    expect(A.mapNonEmpty(nonEmpty, (x) => String(x))).type.toBe<A.NonEmptyArray<string>>();
  });

  it("data-last returns NonEmptyArray", () => {
    expect(
      pipe(
        nonEmpty,
        A.mapNonEmpty((x) => String(x))
      )
    ).type.toBe<A.NonEmptyArray<string>>();
  });

  it("callback receives element and index", () => {
    A.mapNonEmpty(nonEmpty, (a, i) => {
      expect(a).type.toBe<number>();
      expect(i).type.toBe<number>();
      return a;
    });
  });
});

describe("flatMapNonEmpty", () => {
  it("data-first returns NonEmptyArray", () => {
    expect(A.flatMapNonEmpty(nonEmpty, (x): A.NonEmptyReadonlyArray<string> => [String(x)])).type.toBe<
      A.NonEmptyArray<string>
    >();
  });

  it("data-last returns NonEmptyArray", () => {
    expect(
      pipe(
        nonEmpty,
        A.flatMapNonEmpty((x): A.NonEmptyReadonlyArray<string> => [String(x)])
      )
    ).type.toBe<A.NonEmptyArray<string>>();
  });
});

describe("mapNonEmptyReadonly", () => {
  it("data-first returns NonEmptyReadonlyArray", () => {
    expect(A.mapNonEmptyReadonly(nonEmpty, (x) => String(x))).type.toBe<A.NonEmptyReadonlyArray<string>>();
  });

  it("data-last returns NonEmptyReadonlyArray", () => {
    expect(
      pipe(
        nonEmpty,
        A.mapNonEmptyReadonly((x) => String(x))
      )
    ).type.toBe<A.NonEmptyReadonlyArray<string>>();
  });
});

describe("flatMapNonEmptyReadonly", () => {
  it("data-first returns NonEmptyReadonlyArray", () => {
    expect(A.flatMapNonEmptyReadonly(nonEmpty, (x): A.NonEmptyReadonlyArray<string> => [String(x)])).type.toBe<
      A.NonEmptyReadonlyArray<string>
    >();
  });

  it("data-last returns NonEmptyReadonlyArray", () => {
    expect(
      pipe(
        nonEmpty,
        A.flatMapNonEmptyReadonly((x): A.NonEmptyReadonlyArray<string> => [String(x)])
      )
    ).type.toBe<A.NonEmptyReadonlyArray<string>>();
  });
});

describe("indexOf", () => {
  it("data-first returns Option<number>", () => {
    expect(A.indexOf(["a", "b"], "a")).type.toBe<O.Option<number>>();
  });

  it("data-last returns Option<number>", () => {
    expect(pipe(["a", "b"], A.indexOf("b"))).type.toBe<O.Option<number>>();
  });
});

describe("lastIndexOf", () => {
  it("data-first returns Option<number>", () => {
    expect(A.lastIndexOf(["a", "b"], "a")).type.toBe<O.Option<number>>();
  });

  it("data-last returns Option<number>", () => {
    expect(pipe(["a", "b"], A.lastIndexOf("b"))).type.toBe<O.Option<number>>();
  });
});

describe("slice", () => {
  it("data-first returns Array", () => {
    expect(A.slice(["a", "b"], { start: 0, end: 1 })).type.toBe<Array<string>>();
  });

  it("data-last returns Array", () => {
    expect(pipe(["a", "b"], A.slice({ start: 0, end: 1 }))).type.toBe<Array<string>>();
  });
});

describe("entries keys values", () => {
  it("entries preserves value type", () => {
    expect(A.entries(["a", "b"])).type.toBe<Array<readonly [number, string]>>();
  });

  it("keys returns numeric indexes", () => {
    expect(A.keys(["a", "b"])).type.toBe<Array<number>>();
  });

  it("values returns a mutable copy type", () => {
    expect(A.values(["a", "b"])).type.toBe<Array<string>>();
  });
});

describe("mutation helpers", () => {
  it("appendInPlace returns the same mutable array type", () => {
    expect(A.appendInPlace([1, 2], 3)).type.toBe<Array<number>>();
    expect(pipe([1, 2], A.appendInPlace(3))).type.toBe<Array<number>>();
  });

  it("appendAllInPlace returns the same mutable array type", () => {
    expect(A.appendAllInPlace([1], [2, 3])).type.toBe<Array<number>>();
    expect(pipe([1], A.appendAllInPlace([2, 3]))).type.toBe<Array<number>>();
  });

  it("sortInPlace accepts an explicit order", () => {
    expect(A.sortInPlace([3, 1, 2], Order.Number)).type.toBe<Array<number>>();
    expect(pipe([3, 1, 2], A.sortInPlace(Order.Number))).type.toBe<Array<number>>();
  });

  it("spliceInPlace returns removed values", () => {
    expect(A.spliceInPlace(["a", "b"], { start: 1, deleteCount: 1, items: ["x"] })).type.toBe<Array<string>>();
    expect(pipe(["a", "b"], A.spliceInPlace({ start: 1, deleteCount: 1, items: ["x"] }))).type.toBe<Array<string>>();
  });
});
