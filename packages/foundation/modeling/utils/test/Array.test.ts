import { A, O } from "@beep/utils";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import { describe, expect, it } from "vitest";

const nonEmpty: A.NonEmptyReadonlyArray<number> = [1, 2, 3];

describe("@beep/utils Array.mapNonEmpty", () => {
  it("data-first: maps elements", () => {
    const result = A.mapNonEmpty(nonEmpty, (x) => x * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it("data-last: maps elements", () => {
    const result = pipe(
      nonEmpty,
      A.mapNonEmpty((x) => x * 2)
    );
    expect(result).toEqual([2, 4, 6]);
  });

  it("provides index to callback", () => {
    const result = A.mapNonEmpty(nonEmpty, (_, i) => i);
    expect(result).toEqual([0, 1, 2]);
  });

  it("throws on empty array at runtime", () => {
    const empty: A.NonEmptyReadonlyArray<number> = [] as unknown as A.NonEmptyReadonlyArray<number>;
    expect(() => A.mapNonEmpty(empty, (x) => x)).toThrow();
  });
});

describe("@beep/utils Array.flatMapNonEmpty", () => {
  it("data-first: flatMaps elements", () => {
    const result = A.flatMapNonEmpty(nonEmpty, (x): A.NonEmptyReadonlyArray<number> => [x, x * 2]);
    expect(result).toEqual([1, 2, 2, 4, 3, 6]);
  });

  it("data-last: flatMaps elements", () => {
    const result = pipe(
      nonEmpty,
      A.flatMapNonEmpty((x): A.NonEmptyReadonlyArray<number> => [x, x * 2])
    );
    expect(result).toEqual([1, 2, 2, 4, 3, 6]);
  });

  it("provides index to callback", () => {
    const result = A.flatMapNonEmpty(nonEmpty, (_, i): A.NonEmptyReadonlyArray<number> => [i]);
    expect(result).toEqual([0, 1, 2]);
  });

  it("throws on empty array at runtime", () => {
    const empty: A.NonEmptyReadonlyArray<number> = [] as unknown as A.NonEmptyReadonlyArray<number>;
    expect(() => A.flatMapNonEmpty(empty, (x): A.NonEmptyReadonlyArray<number> => [x])).toThrow();
  });
});

describe("@beep/utils Array.mapNonEmptyReadonly", () => {
  it("data-first: maps elements", () => {
    const result = A.mapNonEmptyReadonly(nonEmpty, (x) => x * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it("data-last: maps elements", () => {
    const result = pipe(
      nonEmpty,
      A.mapNonEmptyReadonly((x) => x * 2)
    );
    expect(result).toEqual([2, 4, 6]);
  });

  it("throws on empty array at runtime", () => {
    const empty: A.NonEmptyReadonlyArray<number> = [] as unknown as A.NonEmptyReadonlyArray<number>;
    expect(() => A.mapNonEmptyReadonly(empty, (x) => x)).toThrow();
  });
});

describe("@beep/utils Array.flatMapNonEmptyReadonly", () => {
  it("data-first: flatMaps elements", () => {
    const result = A.flatMapNonEmptyReadonly(nonEmpty, (x): A.NonEmptyReadonlyArray<number> => [x, x * 2]);
    expect(result).toEqual([1, 2, 2, 4, 3, 6]);
  });

  it("data-last: flatMaps elements", () => {
    const result = pipe(
      nonEmpty,
      A.flatMapNonEmptyReadonly((x): A.NonEmptyReadonlyArray<number> => [x, x * 2])
    );
    expect(result).toEqual([1, 2, 2, 4, 3, 6]);
  });

  it("throws on empty array at runtime", () => {
    const empty: A.NonEmptyReadonlyArray<number> = [] as unknown as A.NonEmptyReadonlyArray<number>;
    expect(() => A.flatMapNonEmptyReadonly(empty, (x): A.NonEmptyReadonlyArray<number> => [x])).toThrow();
  });
});

describe("@beep/utils Array.indexOf", () => {
  it("returns Some with the first matching index", () => {
    expect(A.indexOf(["a", "b", "a"], "a")).toEqual(O.some(0));
  });

  it("supports data-last usage and native fromIndex semantics", () => {
    expect(pipe(["a", "b", "a"], A.indexOf("a", { fromIndex: 1 }))).toEqual(O.some(2));
  });

  it("returns None when absent", () => {
    expect(A.indexOf(["a", "b"], "c")).toEqual(O.none());
  });
});

describe("@beep/utils Array.lastIndexOf", () => {
  it("returns Some with the last matching index", () => {
    expect(A.lastIndexOf(["a", "b", "a"], "a")).toEqual(O.some(2));
  });

  it("supports data-last usage and native fromIndex semantics", () => {
    expect(pipe(["a", "b", "a"], A.lastIndexOf("a", { fromIndex: 1 }))).toEqual(O.some(0));
  });

  it("returns None when absent", () => {
    expect(A.lastIndexOf(["a", "b"], "c")).toEqual(O.none());
  });
});

describe("@beep/utils Array.slice", () => {
  it("copies the whole array when no range is provided", () => {
    const input = [1, 2, 3];
    const result = A.slice(input);

    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it("supports data-last range selection", () => {
    expect(pipe([1, 2, 3, 4], A.slice({ start: 1, end: 3 }))).toEqual([2, 3]);
  });
});

describe("@beep/utils Array.entries/keys/values", () => {
  it("materializes entries", () => {
    expect(A.entries(["x", "y"])).toEqual([
      [0, "x"],
      [1, "y"],
    ]);
  });

  it("materializes keys", () => {
    expect(A.keys(["x", "y"])).toEqual([0, 1]);
  });

  it("materializes values as a copy", () => {
    const input = ["x", "y"];
    const result = A.values(input);

    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });
});

describe("@beep/utils Array mutation helpers", () => {
  it("appendInPlace appends and preserves identity", () => {
    const input = [1, 2];
    const result = A.appendInPlace(input, 3);

    expect(result).toBe(input);
    expect(input).toEqual([1, 2, 3]);
  });

  it("appendAllInPlace appends many values and preserves identity", () => {
    const input = ["a"];
    const result = pipe(input, A.appendAllInPlace(["b", "c"]));

    expect(result).toBe(input);
    expect(input).toEqual(["a", "b", "c"]);
  });

  it("sortInPlace sorts with an explicit order and preserves identity", () => {
    const input = [3, 1, 2];
    const result = A.sortInPlace(input, Order.Number);

    expect(result).toBe(input);
    expect(input).toEqual([1, 2, 3]);
  });

  it("spliceInPlace returns removed values and mutates the input", () => {
    const input = ["a", "b", "c"];
    const removed = A.spliceInPlace(input, { start: 1, deleteCount: 1, items: ["x"] });

    expect(removed).toEqual(["b"]);
    expect(input).toEqual(["a", "x", "c"]);
  });
});
