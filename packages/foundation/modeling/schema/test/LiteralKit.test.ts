import { fcRuns } from "@beep/fc-runs";
import {
  LiteralKit,
  LiteralKitEmptySubsetError,
  LiteralKitKeyCollisionError,
  LiteralKitTaggedUnionLiteralError,
  LiteralKitUnhandledCaseError,
  matchLiteral,
} from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils/index";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const Status = LiteralKit([1, 20n, true, false, "hello"]);
const decodeUnknownStatusEffect = S.decodeUnknownEffect(Status);
const encodeStatusEffect = S.encodeEffect(Status);
const Direction = LiteralKit(["up", "down", "left", "right"]);
const notDown = S.makeFilter((direction: "up" | "down" | "left" | "right") => direction !== "down" || "down is closed");
const CheckedDirection = Direction.check(notDown);
const PipedDirection = Direction.pipe(S.check(notDown), S.annotate({ title: "Open direction" }));
const isCheckedDirection = S.is(CheckedDirection);
const isPipedDirection = S.is(PipedDirection);
const EventKind = LiteralKit(["created", "deleted"]);
const Event = EventKind.toTaggedUnion("kind")({
  created: { value: S.tag(1) },
  deleted: { value: S.tag(2) },
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
        const encodedStatusEffect = yield* encodeStatusEffect(literal);
        const decodedUnknownStatusEffect = yield* decodeUnknownStatusEffect(encodedStatusEffect);
        expect(decodedUnknownStatusEffect).toBe(literal);

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
    expect(Object.getOwnPropertyDescriptor(Status, "match")).toMatchObject(readonlyStatic);
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
    const result = Status.match(1, {
      number1: (v) => `got:${v}`,
      bigint20n: (v) => `got:${v}`,
      true: () => "yes",
      false: () => "no",
      hello: (v) => `greeting:${v}`,
    });

    expect(result).toBe("got:1");
  });

  it("matches literals in curried form", () => {
    const matcher = Status.match({
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
    Status.match(1, {
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

describe("LiteralKit helper-key collisions", () => {
  it("rejects a mixed pair that derives the same helper key", () => {
    const error = Result.merge(Result.try(() => LiteralKit([1, "number1"])));
    assertInstanceOf(error, LiteralKitKeyCollisionError);
    deepStrictEqual(
      { key: error.key, existing: error.existing, incoming: error.incoming },
      { key: "number1", existing: 1, incoming: "number1" }
    );
  });

  it("rejects distinct string and bigint literals that derive the same helper key", () => {
    expect(() => LiteralKit([1n, "bigint1n"])).toThrow(LiteralKitKeyCollisionError);
  });

  it("keeps a repeated identical literal, which maps its key to the same value", () => {
    const Kit = LiteralKit(["draft", "live", "draft"]);
    expect(Kit.Enum.draft).toBe("draft");
    expect(Kit.is.draft("draft")).toBe(true);
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
    const result = Direction.match("up", {
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
      const decodedEventEffect = yield* decodeEventEffect({
        kind: "created",
        value: 1,
      });
      expect(decodedEventEffect).toEqual({
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
  const expectKitStatics = (derived: typeof Direction): void => {
    expect(derived).not.toBe(Direction);
    expect(derived.Enum).toBe(Direction.Enum);
    expect(derived.is).toBe(Direction.is);
    expect(derived.match).toBe(Direction.match);
    expect(derived.toTaggedUnion).toBe(Direction.toTaggedUnion);
    expect(derived.literals).toEqual(Direction.literals);
  };

  it("keeps statics through the check method", () => {
    expectKitStatics(CheckedDirection);
    expect(isCheckedDirection("up")).toBe(true);
    expect(isCheckedDirection("down")).toBe(false);
  });

  it("keeps statics through annotate and annotateKey", () => {
    const Annotated = Direction.annotate({ title: "Direction" });
    const KeyAnnotated = Direction.annotateKey({ description: "Direction key" });
    expectKitStatics(Annotated);
    expectKitStatics(KeyAnnotated);
    expect(Annotated.ast.annotations?.title).toBe("Direction");
  });

  it("keeps statics through pipe(S.check(...)) and pipe(S.annotate(...))", () => {
    expectKitStatics(PipedDirection);
    expect(isPipedDirection("down")).toBe(false);
    expect(PipedDirection.Enum.left).toBe("left");
  });

  it("keeps statics through chained derivations", () => {
    const Chained = Direction.annotate({ title: "a" }).check(notDown).annotateKey({ description: "b" });
    expectKitStatics(Chained);
    expect(Chained.match("left", { up: () => 0, down: () => 1, left: () => 2, right: () => 3 })).toBe(2);
  });

  it("still reattaches keyed helpers onto derivations that build a new schema", () => {
    const Branded = Direction.pipe(S.brand("Direction"), SchemaUtils.withLiteralKitStatics(Direction));
    expect(Branded.Enum).toBe(Direction.Enum);
    expect(Branded.is.up("up")).toBe(true);
  });
});

describe("LiteralKit defect guards", () => {
  it("rejects a bigint member in toTaggedUnion past the checker", () => {
    const Big = LiteralKit([1n, "one"]);
    const build = Big.toTaggedUnion as unknown as (tag: string) => (cases: Record<string, S.Struct.Fields>) => unknown;
    expect(() => build("kind")({ bigint1n: {}, one: {} })).toThrow(LiteralKitTaggedUnionLiteralError);
  });

  it("keys a value outside the literal union through String", () => {
    expect(matchLiteral(undefined as unknown as string)).toBe("undefined");
  });
});

describe("LiteralKit toTaggedUnion (number keys)", () => {
  const NumberKind = LiteralKit([1, 2]);
  const NumberEvent = NumberKind.toTaggedUnion("kind")({
    number1: {
      value: S.tag("one"),
    },
    number2: {
      value: S.tag("two"),
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

describe("LiteralKit subsets stay kits", () => {
  const Tier = LiteralKit(["free", "pro", "team", "enterprise"]);

  it("pick returns a kit over the picked tuple", () => {
    const SelfServe = Tier.pick(["free", "pro"]);
    deepStrictEqual(SelfServe.literals, ["free", "pro"]);
    expect(SelfServe.Enum.pro).toBe("pro");
    expect(SelfServe.is.free("free")).toBe(true);
    expect(SelfServe.match("pro", { free: () => 0, pro: () => 1 })).toBe(1);
  });

  it("omit returns a kit over the computed complement in source order", () => {
    const Paid = Tier.omit(["free"]);
    deepStrictEqual(Paid.literals, ["pro", "team", "enterprise"]);
    expect(Paid.Enum.team).toBe("team");
    expect(Reflect.has(Paid.Enum, "free")).toBe(false);
    expect(S.is(Paid)("free")).toBe(false);
    expect(S.is(Paid)("enterprise")).toBe(true);
  });

  it("omit on a mixed kit keeps the helper keys of the kept members", () => {
    const Rest = Status.omit([1, true]);
    deepStrictEqual(Rest.literals, [20n, false, "hello"]);
    expect(Rest.Enum.bigint20n).toBe(20n);
    expect(Rest.is.false(false)).toBe(true);
  });

  it("subset kits keep their helpers through derivations", () => {
    const Paid = Tier.omit(["free"]).annotate({ title: "Paid tier" });
    expect(Paid.Enum.pro).toBe("pro");
    expect(Paid.is.team("team")).toBe(true);
  });

  it("throws the empty-subset defect when omit drops every member past the checker", () => {
    const everything = Tier.literals as unknown as readonly ["free"];
    const failure = Result.try({ try: () => Tier.omit(everything), catch: (error) => error }).pipe(
      Result.flip,
      Result.getOrUndefined
    );
    assertInstanceOf(failure, LiteralKitEmptySubsetError);
    expect(failure.operation).toBe("omit");
    deepStrictEqual(failure.argument, Tier.literals);
  });

  it("throws the empty-subset defect when pick selects nothing past the checker", () => {
    const nothing = [] as unknown as readonly ["free"];
    const failure = Result.try({ try: () => Tier.pick(nothing), catch: (error) => error }).pipe(
      Result.flip,
      Result.getOrUndefined
    );
    assertInstanceOf(failure, LiteralKitEmptySubsetError);
    expect(failure.operation).toBe("pick");
    deepStrictEqual(failure.argument, []);
  });
});

describe("LiteralKit matchOrElse", () => {
  const Tier = LiteralKit(["free", "pro", "team"]);

  it("routes handled members to their case and the rest to orElse (data-first)", () => {
    expect(Tier.matchOrElse("free", { free: () => 0 }, (paid) => paid.length)).toBe(0);
    expect(Tier.matchOrElse("team", { free: () => 0 }, (paid) => paid.length)).toBe(4);
  });

  it("routes handled members to their case and the rest to orElse (curried)", () => {
    const price = Tier.matchOrElse({ free: () => 0, pro: () => 10 }, (rest) => `quote:${rest}`);
    expect(price("free")).toBe(0);
    expect(price("pro")).toBe(10);
    expect(price("team")).toBe("quote:team");
  });

  it("keeps optional case keys in the orElse remainder", () => {
    const cases: { readonly free?: (value: "free") => number; readonly pro?: (value: "pro") => number } = {
      free: () => 0,
    };
    const priced = Tier.matchOrElse("pro", cases, (rest) => {
      const remainder: typeof rest = "pro";
      return remainder;
    });
    const handledReturn: typeof priced = 0;
    expect(handledReturn).toBe(0);
    expect(priced).toBe("pro");
  });

  it("narrows the orElse argument to the unhandled members", () => {
    Tier.matchOrElse("team", { free: () => 0 }, (rest) => {
      const narrowed: "pro" | "team" = rest;
      return narrowed;
    });
  });
});

describe("LiteralKit dispatch", () => {
  const Tier = LiteralKit(["free", "pro"]);

  it("looks cases up by own property so prototype members never match", () => {
    const cases = { free: () => "f", pro: () => "p" };
    const stray = "toString" as unknown as "free";
    expect(() => Tier.match(stray, cases)).toThrow(LiteralKitUnhandledCaseError);
  });

  it("never dispatches a non-literal value to the case its String form names", () => {
    const Node = LiteralKit(["null", "undefined", "[object Object]"]);
    const cases = { null: () => 1, undefined: () => 2, "[object Object]": () => 3 };
    for (const stray of [null, undefined, {}]) {
      expect(() => Node.match(stray as unknown as "null", cases)).toThrow(LiteralKitUnhandledCaseError);
    }
  });

  it("raises the unhandled-case defect for out-of-domain runtime values", () => {
    const cases = { free: () => "f", pro: () => "p" };
    for (const stray of [undefined, null, Number.NaN, { kind: "free" }]) {
      expect(() => Tier.match(stray as unknown as "free", cases)).toThrow(LiteralKitUnhandledCaseError);
    }
  });

  it("names the value, key and members in the unhandled-case defect", () => {
    const cases = { free: () => "f" } as unknown as { free: () => string; pro: () => string };
    const failure = Result.try({ try: () => Tier.match("pro", cases), catch: (error) => error }).pipe(
      Result.flip,
      Result.getOrUndefined
    );
    assertInstanceOf(failure, LiteralKitUnhandledCaseError);
    expect(failure.key).toBe("pro");
    expect(failure.value).toBe("pro");
    deepStrictEqual(failure.literals, ["free", "pro"]);
  });

  it("defines the new helpers as readonly and non-configurable", () => {
    const readonlyStatic = { writable: false, configurable: false, enumerable: true };
    for (const key of ["matchOrElse", "pick", "omit"]) {
      expect(Object.getOwnPropertyDescriptor(Tier, key)).toMatchObject(readonlyStatic);
    }
  });

  it("accepts unary handlers and keeps their return type in the result", () => {
    const result: number | string = Tier.match("pro", { free: (v) => v.length, pro: (v) => `${v}!` });
    expect(result).toBe("pro!");
  });
});

describe("LiteralKit subset and match types", () => {
  const Tier = LiteralKit(["free", "pro", "team"]);

  it("types pick over the exact picked tuple and omit over the complement union", () => {
    const picked: readonly ["free", "pro"] = Tier.pick(["free", "pro"]).literals;
    const omitted: readonly ["pro" | "team", ...Array<"pro" | "team">] = Tier.omit(["free"]).literals;
    expect(picked.length + omitted.length).toBe(4);
  });

  it("keeps upstream members free of array keys on an omit-derived kit", () => {
    type Members = keyof (typeof Tier.omit<readonly ["free"]> extends (literals: never) => infer K
      ? K extends { readonly members: infer M }
        ? M
        : never
      : never);
    const check: "push" extends Members ? never : "length" extends Members ? "length" : never = "length";
    expect(check).toBe("length");
  });

  it("rejects an empty pick, an omit of every member, and a widened subset argument", () => {
    // Type-only assertions: the function is never called, so the rejected
    // calls do not run and only the checker sees them.
    const rejected = (): void => {
      // @ts-expect-error pick requires a non-empty tuple of members.
      Tier.pick([]);
      // @ts-expect-error omitting every member leaves no kit.
      Tier.omit(["free", "pro", "team"]);
      const widened: ReadonlyArray<"free" | "pro" | "team"> = ["free"];
      // @ts-expect-error a widened array has no tuple shape for the checker to subset.
      Tier.omit(widened);
    };
    expect(typeof rejected).toBe("function");
  });

  it("rejects cases that name no member", () => {
    const rejected = (): void => {
      // @ts-expect-error "enterprise" is not a member.
      Tier.matchOrElse("free", { enterprise: () => 1 }, () => 0);
      // @ts-expect-error "enterprise" is not a member.
      Tier.match("free", { free: () => 1, pro: () => 1, team: () => 1, enterprise: () => 1 });
    };
    expect(typeof rejected).toBe("function");
  });
});
