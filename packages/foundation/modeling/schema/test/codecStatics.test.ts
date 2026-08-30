import { fcRuns } from "@beep/fc-runs";
import {
  CodecStaticKey,
  CodecStaticSelectionError,
  classStatics,
  withCodecStatics,
} from "@beep/schema/SchemaUtils/withCodecStatics";
import { withStatics } from "@beep/schema/SchemaUtils/withStatics";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { expectTypeOf } from "vitest";

const Count = S.FiniteFromString;
const decodeUnknownCountSync = S.decodeUnknownSync(Count);
const finiteArbitrary = S.toArbitrary(S.Finite)(fc);
const isCodecStaticKey = S.is(CodecStaticKey);
const isCount = S.is(Count);

class User extends S.Class<User>("CodecStaticUser")({ name: S.String }) {
  static readonly utils = classStatics(this, ["decodeUnknownEffect", "is"]);
}

class Event extends S.TaggedClass<Event>("CodecStaticEvent")("event", { value: S.Finite }) {
  static readonly utils = classStatics(this, ["is"]);
}

const decodeUnknownUserEffect = S.decodeUnknownEffect(User);
const isUser = S.is(User);

const invalidSelectionsAreRejectedAtCompileTime = () => {
  // @ts-expect-error Duplicate selections are rejected by the tuple type.
  Count.pipe(withCodecStatics(["is", "is"]));
  // @ts-expect-error Empty selections are rejected by the tuple type.
  Count.pipe(withCodecStatics([]));
};

describe("withCodecStatics", () => {
  it("supports pipeable and data-first declarations with exact surfaces", () => {
    const Piped = Count.pipe(withCodecStatics(["decodeUnknownSync", "is"]));
    const Direct = withCodecStatics(Count, ["decodeUnknownSync", "is"]);

    expectTypeOf(invalidSelectionsAreRejectedAtCompileTime).toBeFunction();
    expect(Piped.decodeUnknownSync("42")).toBe(42);
    expect(Direct.decodeUnknownSync("42")).toBe(42);
    expect(Piped.is(42)).toBe(true);
    expect(Reflect.has(Piped, "decodeEffect")).toBe(false);
    expect(Reflect.has(Direct, "encodeUnknownSync")).toBe(false);
    expectTypeOf(Piped.decodeUnknownSync).toEqualTypeOf(decodeUnknownCountSync);
    expectTypeOf(Piped.is).toEqualTypeOf(isCount);
    expectTypeOf(Direct).toEqualTypeOf(Piped);
    expectTypeOf(Piped).not.toHaveProperty("decodeEffect");
  });

  it("owns a fresh schema and installs strict hidden descriptors", () => {
    const Selected = Count.pipe(withCodecStatics(["is"]));
    const descriptor = Reflect.getOwnPropertyDescriptor(Selected, "is");

    expect(Selected).not.toBe(Count);
    expect(Reflect.has(Count, "is")).toBe(false);
    expect(descriptor).toMatchObject({ configurable: false, enumerable: false, writable: false });
    expect(Object.keys(Selected)).not.toContain("is");
    expect(Reflect.set(Selected, "is", () => false)).toBe(false);
  });

  it("agrees with its source schema over schema-derived finite numbers", () => {
    const Selected = Count.pipe(withCodecStatics(["decodeUnknownSync", "encodeSync", "equivalence", "is"]));

    fc.assert(
      fc.property(finiteArbitrary, (sampled) => {
        const encoded = Selected.encodeSync(sampled);
        const decoded = Selected.decodeUnknownSync(encoded);

        expect(Selected.is(sampled)).toBe(true);
        expect(Selected.equivalence(decoded, sampled)).toBe(true);
        expect(Selected.encodeSync(decoded)).toBe(encoded);
      }),
      fcRuns(50)
    );
  });

  it("preserves the selection through schema rebuilds", () => {
    const Selected = Count.pipe(withCodecStatics(["decodeUnknownOption", "is"]));
    const Annotated = Selected.annotate({ title: "Annotated count" });
    const is = Reflect.get(Annotated, "is");
    const decodeUnknownOption = Reflect.get(Annotated, "decodeUnknownOption");

    expect(P.isFunction(is)).toBe(true);
    expect(P.isFunction(decodeUnknownOption)).toBe(true);
    if (P.isFunction(is) && P.isFunction(decodeUnknownOption)) {
      expect(Reflect.apply(is, undefined, [42])).toBe(true);
      expect(Reflect.apply(decodeUnknownOption, undefined, ["42"])).toStrictEqual(O.some(42));
    }
    expect(Reflect.has(Annotated, "decodeEffect")).toBe(false);
  });

  it("preserves rebuilt schema-owned statics through compatible legacy wrappers", () => {
    const Selected = S.Union([
      S.Struct({ type: S.Literal("first"), value: S.String }),
      S.Struct({ type: S.Literal("second"), value: S.Finite }),
    ]).pipe(withCodecStatics(["decodeUnknownSync", "is"]));
    const Tagged = Selected.pipe(
      S.toTaggedUnion("type"),
      withStatics(() => ({ decodeUnknownSync: Selected.decodeUnknownSync, is: Selected.is }))
    );
    const Annotated = Tagged.annotate({ title: "Annotated tagged union" });
    const decodeUnknownSync = Reflect.get(Annotated, "decodeUnknownSync");
    const is = Reflect.get(Annotated, "is");

    expect(P.isFunction(decodeUnknownSync)).toBe(true);
    expect(P.isFunction(is)).toBe(true);
    if (P.isFunction(decodeUnknownSync) && P.isFunction(is)) {
      expect(Reflect.apply(decodeUnknownSync, undefined, [{ type: "first", value: "ok" }])).toStrictEqual({
        type: "first",
        value: "ok",
      });
      expect(Reflect.apply(is, undefined, [{ type: "second", value: 42 }])).toBe(true);
      expect(is).not.toBe(Selected.is);
    }
  });

  it("rejects duplicate keys and pre-attached custom statics", () => {
    const FreshCount = Count.rebuild(Count.ast);
    const WithCustomIs = FreshCount.pipe(withStatics(() => ({ is: () => true })));
    const WithSelectedIs = Count.pipe(withCodecStatics(["is"]));

    expect(() => Reflect.apply(withCodecStatics, undefined, [Count, ["is", "is"]])).toThrow(CodecStaticSelectionError);
    expect(() => Reflect.apply(withCodecStatics, undefined, [Count, []])).toThrow(CodecStaticSelectionError);
    expect(() => WithCustomIs.pipe(withCodecStatics(["is"]))).toThrow(CodecStaticSelectionError);
    expect(() => WithSelectedIs.pipe(withCodecStatics(["decodeUnknownSync"]))).toThrow(CodecStaticSelectionError);
    expect(isCodecStaticKey("decodeUnknownJsonStringEffect")).toBe(false);
  });

  it("keeps JSON construction policy separate from per-call parse options", () => {
    const JsonStruct = S.fromJsonString(S.Struct({ value: S.String }), { space: 2 }).pipe(
      withCodecStatics(["decodeUnknownResult", "encodeUnknownSync"])
    );

    expect(JsonStruct.encodeUnknownSync({ value: "ok" })).toBe('{\n  "value": "ok"\n}');
    expect(
      Result.isFailure(JsonStruct.decodeUnknownResult('{"value":"ok","extra":true}', { onExcessProperty: "error" }))
    ).toBe(true);
  });

  it.effect(
    "binds selected Effect, Exit, Option, Promise, Result, and Sync runners once",
    Effect.fnUntraced(function* () {
      const Selected = Count.pipe(
        withCodecStatics([
          "decodeEffect",
          "decodeUnknownExit",
          "decodeUnknownOption",
          "decodeUnknownPromise",
          "decodeUnknownResult",
          "decodeUnknownSync",
          "encodeEffect",
          "encodeUnknownExit",
          "encodeUnknownOption",
          "encodeUnknownPromise",
          "encodeUnknownResult",
          "encodeUnknownSync",
        ])
      );
      const decodeUnknownSync = Selected.decodeUnknownSync;

      expect(yield* Selected.decodeEffect("42")).toBe(42);
      expect(yield* Selected.encodeEffect(42)).toBe("42");
      expect(Exit.getSuccess(Selected.decodeUnknownExit("42"))).toStrictEqual(O.some(42));
      expect(Exit.getSuccess(Selected.encodeUnknownExit(42))).toStrictEqual(O.some("42"));
      expect(Selected.decodeUnknownOption("42")).toStrictEqual(O.some(42));
      expect(Selected.encodeUnknownOption(42)).toStrictEqual(O.some("42"));
      expect(Result.getOrThrow(Selected.decodeUnknownResult("42"))).toBe(42);
      expect(Result.getOrThrow(Selected.encodeUnknownResult(42))).toBe("42");
      expect(Selected.decodeUnknownSync("42")).toBe(42);
      expect(Selected.decodeUnknownSync).toBe(decodeUnknownSync);
      expect(Selected.encodeUnknownSync(42)).toBe("42");
      expect(yield* Effect.tryPromise(() => Selected.decodeUnknownPromise("42"))).toBe(42);
      expect(yield* Effect.tryPromise(() => Selected.encodeUnknownPromise(42))).toBe("42");
    })
  );
});

describe("classStatics", () => {
  it.effect(
    "provides frozen destructurable bags without replacing class constructors",
    Effect.fnUntraced(function* () {
      const { decodeUnknownEffect, is } = User.utils;
      const user = User.make({ name: "Ada" });
      const event = Event.make({ value: 1 });

      expect(is(user)).toBe(true);
      expect((yield* decodeUnknownEffect({ name: "Grace" })).name).toBe("Grace");
      expect(Event.utils.is(event)).toBe(true);
      expect(Object.isFrozen(User.utils)).toBe(true);
      expect(Object.isFrozen(Event.utils)).toBe(true);
      expect(Reflect.has(User, "decodeUnknownEffect")).toBe(false);
      expectTypeOf(User.utils.decodeUnknownEffect).toEqualTypeOf(decodeUnknownUserEffect);
      expectTypeOf(User.utils.is).toEqualTypeOf(isUser);
      expectTypeOf(User.utils).not.toHaveProperty("decodeUnknownSync");
    })
  );
});
