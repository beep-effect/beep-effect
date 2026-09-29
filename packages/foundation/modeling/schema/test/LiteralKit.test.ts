import { fcRuns } from "@beep/fc-runs";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils/index";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as S from "effect/Schema";

const Status = LiteralKit([1, 20n, true, false, "hello"]);
const decodeUnknownStatusEffect = S.decodeUnknownEffect(Status);
const encodeStatusEffect = S.encodeEffect(Status);
const Direction = LiteralKit(["up", "down", "left", "right"]);
const EventKind = LiteralKit(["created", "deleted"]);
const Event = EventKind.toTaggedUnion("kind")({
  created: { value: S.Literal(1) },
  deleted: { value: S.Literal(2) },
});
const decodeEventEffect = S.decodeEffect(Event);

describe("LiteralKit", () => {
  it("exposes the original literal tuple through upstream literals", () => {
    expect(Status.literals).toEqual([1, 20n, true, false, "hello"]);
  });

  {
    const arbitrary = Arbitrary.schema(Status);
    it.effect.prop(
      "round-trips schema-derived literal samples",
      [arbitrary],
      Effect.fnUntraced(function* ([literal]) {
        expect(Status.literals).toContain(literal);
        expect(yield* decodeUnknownStatusEffect(yield* encodeStatusEffect(literal))).toBe(literal);

        return true;
      }),
      { arbitrary: fcRuns(25) }
    );
  }

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
    const readonlyStatic = { enumerable: true, writable: false, configurable: false };

    expect(Object.getOwnPropertyDescriptor(Status, "Enum")).toMatchObject(readonlyStatic);
    expect(Object.getOwnPropertyDescriptor(Status, "is")).toMatchObject(readonlyStatic);
    expect(Object.getOwnPropertyDescriptor(Status, "$match")).toMatchObject(readonlyStatic);
    expect(Object.getOwnPropertyDescriptor(Status, "rebuild")).toMatchObject({ enumerable: false });
  });

  it("no longer carries the retired facets", () => {
    for (const retired of ["Options", "HashSet", "pickOptions", "omitOptions", "thunk"]) {
      expect(Reflect.has(Status, retired)).toBe(false);
    }
  });

  it("derives subsets through upstream pick", () => {
    expect(Status.pick([1, "hello"]).literals).toEqual([1, "hello"]);
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

  it.effect(
    "builds tagged unions from literal members",
    Effect.fnUntraced(function* () {
      expect(
        yield* decodeEventEffect({
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
    })
  );
});

describe("LiteralKit statics across derivations", () => {
  const notDown = S.makeFilter(
    (direction: "up" | "down" | "left" | "right") => direction !== "down" || "down is closed"
  );

  const expectKitStatics = (derived: typeof Direction): void => {
    expect(derived).not.toBe(Direction);
    expect(derived.Enum).toBe(Direction.Enum);
    expect(derived.is).toBe(Direction.is);
    expect(derived.$match).toBe(Direction.$match);
    expect(derived.toTaggedUnion).toBe(Direction.toTaggedUnion);
    expect(derived.literals).toEqual(Direction.literals);
  };

  it("keeps statics through the check method", () => {
    const Checked = Direction.check(notDown);
    expectKitStatics(Checked);
    expect(S.is(Checked)("up")).toBe(true);
    expect(S.is(Checked)("down")).toBe(false);
  });

  it("keeps statics through annotate and annotateKey", () => {
    const Annotated = Direction.annotate({ title: "Direction" });
    const KeyAnnotated = Direction.annotateKey({ description: "Direction key" });
    expectKitStatics(Annotated);
    expectKitStatics(KeyAnnotated);
    expect(Annotated.ast.annotations?.title).toBe("Direction");
  });

  it("keeps statics through pipe(S.check(...)) and pipe(S.annotate(...))", () => {
    const Piped = Direction.pipe(S.check(notDown), S.annotate({ title: "Open direction" }));
    expectKitStatics(Piped);
    expect(S.is(Piped)("down")).toBe(false);
    expect(Piped.Enum.left).toBe("left");
  });

  it("keeps statics through chained derivations", () => {
    const Chained = Direction.annotate({ title: "a" }).check(notDown).annotateKey({ description: "b" });
    expectKitStatics(Chained);
    expect(Chained.$match("left", { up: () => 0, down: () => 1, left: () => 2, right: () => 3 })).toBe(2);
  });

  it("still reattaches keyed helpers onto derivations that build a new schema", () => {
    const Branded = Direction.pipe(S.brand("Direction"), SchemaUtils.withLiteralKitStatics(Direction));
    expect(Branded.Enum).toBe(Direction.Enum);
    expect(Branded.is.up("up")).toBe(true);
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
