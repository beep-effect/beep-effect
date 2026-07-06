import { $RepoCliId, $SchemaId } from "@beep/identity";
import {
  LiteralKit,
  LiteralKitEnumMappingCoverageError,
  LiteralKitEnumMappingDuplicateLiteralError,
  LiteralKitKeyCollisionError,
  LiteralNotInSetError,
} from "@beep/schema/LiteralKit";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const createRuntimeLiteralKit = (
  literals: ReadonlyArray<unknown>,
  enumMapping: ReadonlyArray<readonly [unknown, string]>
): unknown => Function.prototype.apply.call(LiteralKit, undefined, [literals, enumMapping]);

describe("LiteralKit", () => {
  const Status = LiteralKit([1, 20n, true, false, "hello"]);

  it("exposes Options with the original literal tuple", () => {
    expect(Status.Options).toEqual([1, 20n, true, false, "hello"]);
  });

  it("round-trips schema-derived literal samples", () => {
    const arbitrary = S.toArbitrary(Status);
    const decode = S.decodeUnknownSync(Status);
    const encode = S.encodeSync(Status);

    fc.assert(
      fc.property(arbitrary, (literal) => {
        expect(Status.Options).toContain(literal);
        expect(decode(encode(literal))).toBe(literal);
      }),
      { numRuns: 25 }
    );
  });

  it("creates an Enum map with LiteralToKey keys", () => {
    expect(Status.Enum.number1).toBe(1);
    expect(Status.Enum.bigint20n).toBe(20n);
    expect(Status.Enum.true).toBe(true);
    expect(Status.Enum.false).toBe(false);
    expect(Status.Enum.hello).toBe("hello");
  });

  it("creates per-literal guards keyed by LiteralToKey", () => {
    expect(Status.is.number1(1)).toBe(true);
    expect(Status.is.number1(2)).toBe(false);
    expect(Status.is.bigint20n(20n)).toBe(true);
    expect(Status.is.bigint20n(1n)).toBe(false);
    expect(Status.is.true(true)).toBe(true);
    expect(Status.is.true(false)).toBe(false);
    expect(Status.is.false(false)).toBe(true);
    expect(Status.is.false(true)).toBe(false);
    expect(Status.is.hello("hello")).toBe(true);
    expect(Status.is.hello("world")).toBe(false);
    expect(Status.is.number1(null)).toBe(false);
  });

  it("defines helper properties as readonly and non-configurable", () => {
    const enumDescriptor = Object.getOwnPropertyDescriptor(Status, "Enum");
    const matchDescriptor = Object.getOwnPropertyDescriptor(Status, "$match");

    expect(enumDescriptor?.enumerable).toBe(true);
    expect(enumDescriptor?.writable).toBe(false);
    expect(enumDescriptor?.configurable).toBe(false);
    expect(matchDescriptor?.writable).toBe(false);
    expect(matchDescriptor?.configurable).toBe(false);
  });

  it("returns the provided subset with pickOptions", () => {
    const picked = Status.pickOptions([1, "hello"] as const);
    expect(picked).toEqual([1, "hello"]);
  });

  it("omits literals outside the provided subset", () => {
    const omitted = Status.omitOptions([1, 20n, true] as const);
    expect(omitted).toEqual([false, "hello"]);
  });

  it("throws LiteralNotInSetError when omitOptions removes every literal", () => {
    expect(() => Status.omitOptions([1, 20n, true, false, "hello"] as const)).toThrow(LiteralNotInSetError);
  });

  it("throws LiteralKitKeyCollisionError when different literals encode to the same helper key", () => {
    expect(() => LiteralKit([true, "true"])).toThrow(LiteralKitKeyCollisionError);
    expect(() => LiteralKit([1, "number1"])).toThrow(LiteralKitKeyCollisionError);
    expect(() => LiteralKit([1n, "bigint1n"])).toThrow(LiteralKitKeyCollisionError);
    expect(() => LiteralKit([0, -0])).toThrow(LiteralKitKeyCollisionError);
  });

  it("matches literals in uncurried form", () => {
    const result = Status.$match(1, {
      number1: (v) => `got:${v}`,
      bigint20n: (v) => `got:${v}`,
      true: () => "yes",
      false: () => "no",
      hello: (v) => `greeting:${v}`,
    });

    expect(result).toBe("got:1");
  });

  it("matches literals in curried form", () => {
    const matcher = Status.$match({
      number1: (v) => `num:${v}`,
      bigint20n: (v) => `big:${v}`,
      true: () => "yes",
      false: () => "no",
      hello: (v) => `str:${v}`,
    });

    expect(matcher(1)).toBe("num:1");
    expect(matcher(20n)).toBe("big:20");
    expect(matcher(true)).toBe("yes");
    expect(matcher(false)).toBe("no");
    expect(matcher("hello")).toBe("str:hello");
  });

  it("narrows value types in match case callbacks", () => {
    Status.$match(1, {
      number1: (v) => {
        const narrowed: 1 = v;
        return narrowed;
      },
      bigint20n: (v) => {
        const narrowed: 20n = v;
        return narrowed;
      },
      true: (v) => {
        const narrowed: true = v;
        return narrowed;
      },
      false: (v) => {
        const narrowed: false = v;
        return narrowed;
      },
      hello: (v) => {
        const narrowed: "hello" = v;
        return narrowed;
      },
    });
  });
});

describe("LiteralKit (string-only)", () => {
  const Direction = LiteralKit(["up", "down", "left", "right"]);
  const EventKind = LiteralKit(["created", "deleted"]);
  const Event = EventKind.toTaggedUnion("kind")({
    created: {
      value: S.Literal(1),
    },
    deleted: {
      value: S.Literal(2),
    },
  });

  it("uses string values as-is for keys (same as StringLiteralKit)", () => {
    expect(Direction.Enum.up).toBe("up");
    expect(Direction.Enum.down).toBe("down");
    expect(Direction.is.left("left")).toBe(true);
    expect(Direction.is.right("up")).toBe(false);
  });

  it("matches string-only literals", () => {
    const result = Direction.$match("up", {
      up: () => 0,
      down: () => 1,
      left: () => 2,
      right: () => 3,
    });
    expect(result).toBe(0);
  });

  it("builds tagged unions from literal members", () => {
    expect(
      S.decodeSync(Event)({
        kind: "created",
        value: 1,
      })
    ).toEqual({
      kind: "created",
      value: 1,
    });
    expect(Event.guards.created({ kind: "created", value: 1 })).toBe(true);
    expect(Event.guards.deleted({ kind: "created", value: 1 })).toBe(false);
    expect(
      Event.match(
        { kind: "deleted", value: 2 },
        {
          created: () => "created" as const,
          deleted: () => "deleted" as const,
        }
      )
    ).toBe("deleted");
  });
});

describe("LiteralKit (manual Enum mapping)", () => {
  const Status = LiteralKit(
    ["one", "two"],
    [
      ["one", "ONE"],
      ["two", "TWO"],
    ]
  );

  it("maps Enum keys from the provided manual names", () => {
    expect(Status.Enum.ONE).toBe("one");
    expect(Status.Enum.TWO).toBe("two");
  });

  it("maps is, thunk, and $match to the provided manual keys", () => {
    expect(Status.is.ONE("one")).toBe(true);
    expect(Status.thunk.TWO()).toBe("two");
    expect(
      Status.$match("one", {
        ONE: () => "first",
        TWO: () => "second",
      })
    ).toBe("first");
  });

  it("maps toTaggedUnion case keys to the provided manual keys", () => {
    const Event = Status.toTaggedUnion("kind")({
      ONE: {
        value: S.Literal(1),
      },
      TWO: {
        value: S.Literal(2),
      },
    });

    expect(Event.guards.one({ kind: "one", value: 1 })).toBe(true);
    expect(Event.guards.two({ kind: "one", value: 1 })).toBe(false);
  });

  it("uses mapped keys for branded string helper objects", () => {
    const RepoPkg = LiteralKit(
      [$RepoCliId.identifier, $SchemaId.identifier],
      [
        [$RepoCliId.identifier, "@beep/repo-cli"],
        [$SchemaId.identifier, "@beep/schema"],
      ]
    );

    expect(RepoPkg.Enum["@beep/repo-cli"]).toBe("@beep/repo-cli");
    expect(RepoPkg.thunk["@beep/repo-cli"]()).toBe("@beep/repo-cli");
    expect(RepoPkg.is["@beep/repo-cli"]("@beep/repo-cli")).toBe(true);
    expect(
      RepoPkg.$match($RepoCliId.identifier, {
        "@beep/repo-cli": () => "repo-cli",
        "@beep/schema": () => "schema",
      })
    ).toBe("repo-cli");

    const Event = RepoPkg.toTaggedUnion("pkg")({
      "@beep/repo-cli": {
        enabled: S.Literal(true),
      },
      "@beep/schema": {
        enabled: S.Literal(false),
      },
    });

    expect(Event.cases).toBeDefined();
  });

  it("preserves mapped Enum keys after annotate", () => {
    const Annotated = Status.annotate({
      title: "Annotated status",
    });

    expect(Annotated.Enum.ONE).toBe("one");
    expect(Annotated.Enum.TWO).toBe("two");
  });

  it("supports mixed source literal types", () => {
    const Mixed = LiteralKit(
      [1, true, "two"],
      [
        [1, "ONE"],
        [true, "TRUE"],
        ["two", "TWO"],
      ]
    );

    expect(Mixed.Enum.ONE).toBe(1);
    expect(Mixed.Enum.TRUE).toBe(true);
    expect(Mixed.Enum.TWO).toBe("two");
    expect(Mixed.is.ONE(1)).toBe(true);
    expect(Mixed.is.TRUE(true)).toBe(true);
    expect(Mixed.is.TWO("two")).toBe(true);
  });

  it("throws LiteralKitEnumMappingDuplicateLiteralError for duplicate source literals at runtime", () => {
    expect(() =>
      createRuntimeLiteralKit(
        ["one", "two"],
        [
          ["one", "ONE"],
          ["one", "UNO"],
        ]
      )
    ).toThrow(LiteralKitEnumMappingDuplicateLiteralError);
  });

  it("throws LiteralKitKeyCollisionError for duplicate mapped Enum keys at runtime", () => {
    expect(() =>
      createRuntimeLiteralKit(
        ["one", "two"],
        [
          ["one", "SAME"],
          ["two", "SAME"],
        ]
      )
    ).toThrow(LiteralKitKeyCollisionError);
  });

  it("throws LiteralKitEnumMappingCoverageError when the mapping does not exactly cover the literals", () => {
    expect(() =>
      createRuntimeLiteralKit(
        ["one", "two"],
        [
          ["one", "ONE"],
          ["three", "THREE"],
        ]
      )
    ).toThrow(LiteralKitEnumMappingCoverageError);
  });
});

describe("LiteralKit toTaggedUnion (number keys)", () => {
  const NumberKind = LiteralKit([1, 2]);
  const NumberEvent = NumberKind.toTaggedUnion("kind")({
    number1: {
      value: S.Literal("one"),
    },
    number2: {
      value: S.Literal("two"),
    },
  });

  it("uses LiteralToKey keys for numeric literals and preserves numeric tags", () => {
    expect(
      NumberEvent.match(
        { kind: 1, value: "one" },
        {
          1: () => "one" as const,
          2: () => "two" as const,
        }
      )
    ).toBe("one");
    expect(NumberEvent.guards[1]({ kind: 1, value: "one" })).toBe(true);
    expect(NumberEvent.guards[2]({ kind: 1, value: "one" })).toBe(false);
  });
});
