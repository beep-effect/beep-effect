import { $RepoCliId, $SchemaId } from "@beep/identity";
import { LiteralKit, LiteralNotInSetError } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils/index";
import * as S from "effect/Schema";
import { describe, expect, it } from "tstyche";
import type { IdentityString } from "@beep/identity";
import type { LiteralToKey } from "@beep/schema/LiteralKit";
import type { A } from "@beep/utils";
import type * as HashSet from "effect/HashSet";
import type { LiteralValue } from "effect/SchemaAST";

describe("LiteralToKey", () => {
  it("maps booleans to 'true' | 'false'", () => {
    expect<LiteralToKey<true>>().type.toBe<"true">();
    expect<LiteralToKey<false>>().type.toBe<"false">();
  });

  it("maps bigints to 'bigint${N}n'", () => {
    expect<LiteralToKey<20n>>().type.toBe<"bigint20n">();
    expect<LiteralToKey<0n>>().type.toBe<"bigint0n">();
  });

  it("maps numbers to 'number${N}'", () => {
    expect<LiteralToKey<1>>().type.toBe<"number1">();
    expect<LiteralToKey<200>>().type.toBe<"number200">();
  });

  it("passes strings through as-is", () => {
    expect<LiteralToKey<"hello">>().type.toBe<"hello">();
    expect<LiteralToKey<"pending">>().type.toBe<"pending">();
  });
});

describe("LiteralKit", () => {
  const Status = LiteralKit([1, 20n, true, false, "hello"]);

  it("preserves the literal tuple on Options", () => {
    expect<typeof Status.Options>().type.toBe<readonly [1, 20n, true, false, "hello"]>();
  });

  it("types HashSet from the literal union and preserves it across rebuilds", () => {
    const Annotated = Status.annotate({ title: "Annotated status" });
    const Reattached = S.Literals(Status.Options).pipe(SchemaUtils.withLiteralKitStatics(Status));

    expect(Status.HashSet).type.toBe<HashSet.HashSet<1 | 20n | true | false | "hello">>();
    expect(Annotated.HashSet).type.toBe<HashSet.HashSet<1 | 20n | true | false | "hello">>();
    expect(Reattached.HashSet).type.toBe<HashSet.HashSet<1 | 20n | true | false | "hello">>();
  });

  it("builds Enum members keyed by LiteralToKey", () => {
    expect(Status.Enum.number1).type.toBe<1>();
    expect(Status.Enum.bigint20n).type.toBe<20n>();
    expect(Status.Enum.true).type.toBe<true>();
    expect(Status.Enum.false).type.toBe<false>();
    expect(Status.Enum.hello).type.toBe<"hello">();
  });

  it("exposes per-literal guard functions keyed by LiteralToKey", () => {
    expect(Status.is.number1).type.toBe<(i: unknown) => i is 1>();
    expect(Status.is.bigint20n).type.toBe<(i: unknown) => i is 20n>();
    expect(Status.is.true).type.toBe<(i: unknown) => i is true>();
    expect(Status.is.false).type.toBe<(i: unknown) => i is false>();
    expect(Status.is.hello).type.toBe<(i: unknown) => i is "hello">();
  });

  it("pickOptions preserves the provided subset tuple", () => {
    expect(Status.pickOptions([1, "hello"] as const)).type.toBe<readonly [1, "hello"]>();
    expect(Status.pickOptions([true, false] as const)).type.toBe<readonly [true, false]>();
  });

  it("omitOptions excludes selected literals", () => {
    expect(Status.omitOptions([1, 20n, true] as const)).type.toBe<A.NonEmptyReadonlyArray<false | "hello">>();
  });

  it("$match uncurried returns union of case return types", () => {
    expect(
      Status.$match(1, {
        number1: () => "N" as const,
        bigint20n: () => "B" as const,
        true: () => "T" as const,
        false: () => "F" as const,
        hello: () => "H" as const,
      })
    ).type.toBe<"N" | "B" | "T" | "F" | "H">();
  });

  it("$match curried returns a function from value to union of return types", () => {
    const matcher = Status.$match({
      number1: () => 1 as const,
      bigint20n: () => 2 as const,
      true: () => 3 as const,
      false: () => 4 as const,
      hello: () => 5 as const,
    });

    expect(matcher).type.toBe<(value: 1 | 20n | true | false | "hello") => 1 | 2 | 3 | 4 | 5>();
  });

  it("$match narrows value types in case callbacks", () => {
    Status.$match(1, {
      number1: (v) => {
        expect(v).type.toBe<1>();
      },
      bigint20n: (v) => {
        expect(v).type.toBe<20n>();
      },
      true: (v) => {
        expect(v).type.toBe<true>();
      },
      false: (v) => {
        expect(v).type.toBe<false>();
      },
      hello: (v) => {
        expect(v).type.toBe<"hello">();
      },
    });
  });

  it("does not expose toTaggedUnion when literals include non-property-key values", () => {
    expect(Status.toTaggedUnion).type.toBe<never>();
  });
});

describe("LiteralKit with manual Enum mapping", () => {
  const Status = LiteralKit(
    ["one", "two"],
    [
      ["one", "ONE"],
      ["two", "TWO"],
    ]
  );

  it("maps Enum members to the provided manual keys", () => {
    expect(Status.Enum.ONE).type.toBe<"one">();
    expect(Status.Enum.TWO).type.toBe<"two">();
  });

  it("maps the other key-based helpers to the provided manual keys", () => {
    expect(Status.is.ONE).type.toBe<(i: unknown) => i is "one">();
    expect(Status.thunk.TWO).type.toBe<() => "two">();
    expect(
      Status.$match("one", {
        ONE: () => "first" as const,
        TWO: () => "second" as const,
      })
    ).type.toBe<"first" | "second">();

    const Event = Status.toTaggedUnion("kind")({
      ONE: {
        value: S.Literal(1),
      },
      TWO: {
        value: S.Literal(2),
      },
    });

    expect(Event.guards.one).type.toBe<(u: unknown) => u is { readonly kind: "one"; readonly value: 1 }>();

    const wrongMatchCases = {
      one: () => "first" as const,
      two: () => "second" as const,
    } as const;

    // @ts-expect-error!
    Status.$match("one", wrongMatchCases);

    const wrongTaggedCases = {
      one: {
        value: S.Literal(1),
      },
      two: {
        value: S.Literal(2),
      },
    } as const;

    // @ts-expect-error!
    Status.toTaggedUnion("kind")(wrongTaggedCases);
  });

  it("uses mapped keys for branded string helper objects", () => {
    const RepoPkg = LiteralKit(
      [$RepoCliId.identifier, $SchemaId.identifier],
      [
        [$RepoCliId.identifier, "@beep/repo-cli"],
        [$SchemaId.identifier, "@beep/schema"],
      ]
    );

    expect(RepoPkg.Enum["@beep/repo-cli"]).type.toBe<IdentityString<"@beep/repo-cli">>();
    expect(RepoPkg.thunk["@beep/repo-cli"]).type.toBe<() => IdentityString<"@beep/repo-cli">>();
    expect(RepoPkg.is["@beep/repo-cli"]).type.toBe<(i: unknown) => i is IdentityString<"@beep/repo-cli">>();
    expect(
      RepoPkg.$match($RepoCliId.identifier, {
        "@beep/repo-cli": () => "repo-cli" as const,
        "@beep/schema": () => "schema" as const,
      })
    ).type.toBe<"repo-cli" | "schema">();

    const Event = RepoPkg.toTaggedUnion("pkg")({
      "@beep/repo-cli": {
        enabled: S.Literal(true),
      },
      "@beep/schema": {
        enabled: S.Literal(false),
      },
    });

    expect(Event.Type).type.toBe<
      | { readonly pkg: IdentityString<"@beep/repo-cli">; readonly enabled: true }
      | { readonly pkg: IdentityString<"@beep/schema">; readonly enabled: false }
    >();
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

    expect(Mixed.Enum.ONE).type.toBe<1>();
    expect(Mixed.Enum.TRUE).type.toBe<true>();
    expect(Mixed.Enum.TWO).type.toBe<"two">();
    expect(Mixed.is.ONE).type.toBe<(i: unknown) => i is 1>();
    expect(Mixed.is.TRUE).type.toBe<(i: unknown) => i is true>();
    expect(Mixed.is.TWO).type.toBe<(i: unknown) => i is "two">();
  });

  it("preserves exact Enum inference from non-fixed pair arrays", () => {
    type Pair = readonly ["one", "ONE"] | readonly ["two", "TWO"];

    const pairs: readonly [Pair, ...ReadonlyArray<Pair>] = [
      ["one", "ONE"],
      ["two", "TWO"],
    ];

    const StatusFromPairs = LiteralKit(["one", "two"], pairs);

    expect(StatusFromPairs.Enum.ONE).type.toBe<"one">();
    expect(StatusFromPairs.Enum.TWO).type.toBe<"two">();
  });

  it("rejects invalid mappings at compile time", () => {
    // @ts-expect-error!
    LiteralKit(["one", "two"], [["one", "ONE"]]);

    const duplicateSourceMapping = [
      ["one", "ONE"],
      ["one", "UNO"],
    ] as const;

    // @ts-expect-error!
    LiteralKit(["one", "two"], duplicateSourceMapping);

    const duplicateKeyMapping = [
      ["one", "SAME"],
      ["two", "SAME"],
    ] as const;

    // @ts-expect-error!
    LiteralKit(["one", "two"], duplicateKeyMapping);
  });
});

describe("LiteralKit (string-only)", () => {
  const Dir = LiteralKit(["up", "down"]);
  const EventKind = LiteralKit(["created", "deleted"]);

  it("uses string values directly as keys", () => {
    expect(Dir.Enum.up).type.toBe<"up">();
    expect(Dir.Enum.down).type.toBe<"down">();
  });

  it("toTaggedUnion preserves per-case literal narrowing", () => {
    const Event = EventKind.toTaggedUnion("kind")({
      created: {
        value: S.Literal(1),
      },
      deleted: {
        value: S.Literal(2),
      },
    });

    expect(Event).type.toBe<
      S.toTaggedUnion<
        "kind",
        readonly [
          S.Struct<{ readonly kind: S.tag<"created">; readonly value: S.Literal<1> }>,
          S.Struct<{ readonly kind: S.tag<"deleted">; readonly value: S.Literal<2> }>,
        ]
      >
    >();

    expect(Event.cases.created).type.toBe<
      S.Struct<{ readonly kind: S.tag<"created">; readonly value: S.Literal<1> }>
    >();
    expect(Event.cases.deleted).type.toBe<
      S.Struct<{ readonly kind: S.tag<"deleted">; readonly value: S.Literal<2> }>
    >();
    expect(Event.guards.created).type.toBe<(u: unknown) => u is { readonly kind: "created"; readonly value: 1 }>();
    expect(Event.guards.deleted).type.toBe<(u: unknown) => u is { readonly kind: "deleted"; readonly value: 2 }>();
  });

  it("toTaggedUnion enforces exhaustive keys and disallows extras", () => {
    // @ts-expect-error!
    EventKind.toTaggedUnion("kind")({
      created: {
        value: S.Literal(1),
      },
    });

    EventKind.toTaggedUnion("kind")({
      created: {
        value: S.Literal(1),
      },
      deleted: {
        value: S.Literal(2),
      },
      // @ts-expect-error!
      updated: {
        value: S.Literal(3),
      },
    });
  });

  it("toTaggedUnion disallows defining the discriminator field in cases", () => {
    EventKind.toTaggedUnion("kind")({
      created: {
        // @ts-expect-error!
        kind: S.String,
        // @ts-expect-error!
        value: S.Literal(1),
      },
      deleted: {
        value: S.Literal(2),
      },
    });
  });
});

describe("LiteralKit toTaggedUnion (number keys)", () => {
  const NumberKind = LiteralKit([1, 2]);

  it("uses LiteralToKey for case object keys", () => {
    const NumberEvent = NumberKind.toTaggedUnion("kind")({
      number1: {
        value: S.Literal("one"),
      },
      number2: {
        value: S.Literal("two"),
      },
    });

    expect(NumberEvent.guards[1]).type.toBe<(u: unknown) => u is { readonly kind: 1; readonly value: "one" }>();
    expect(NumberEvent.guards[2]).type.toBe<(u: unknown) => u is { readonly kind: 2; readonly value: "two" }>();
  });
});

describe("LiteralNotInSetError", () => {
  it("is constructible and exposes its tagged shape", () => {
    const error = LiteralNotInSetError.make({
      literals: [1, "hello", true],
      input: [],
    });

    expect<LiteralNotInSetError["_tag"]>().type.toBe<"LiteralNotInSetError">();
    expect<LiteralNotInSetError["literals"]>().type.toBe<ReadonlyArray<LiteralValue>>();
    expect<LiteralNotInSetError["input"]>().type.toBe<ReadonlyArray<LiteralValue>>();
    expect(error).type.toBeAssignableTo<LiteralNotInSetError>();
  });
});
