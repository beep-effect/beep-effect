import { fcRuns } from "@beep/fc-runs";
import { $SchemaId } from "@beep/identity/packages";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import {
  withEffectCodecStatics,
  withExitCodecStatics,
  withOptionCodecStatics,
  withPromiseCodecStatics,
  withResultCodecStatics,
  withSyncCodecStatics,
} from "@beep/schema/SchemaUtils/codecStatics";
import { describe, expect, it } from "@effect/vitest";
import { Effect, pipe } from "effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const Count = S.FiniteFromString;
const invalidEncoded = "nope";
const invalidDecoded = "42";

const expectSharedStatics = <Sch extends S.Top & SchemaUtils.SharedCodecStatics<Sch>>(schema: Sch) => {
  expect(schema.is(42)).toBe(true);
  expect(schema.is("42")).toBe(false);
  expect(schema.equivalence(42, 42)).toBe(true);
  expect(schema.equivalence(41)(42)).toBe(false);
  expect(pipe(42, schema.equivalence(42))).toBe(true);
  schema.asserts(42);
  expect(() => schema.asserts("42")).toThrow();
};

describe("codec group statics", () => {
  it("exports the combinators from the SchemaUtils barrel", () => {
    expect(SchemaUtils.withSyncCodecStatics).toBe(withSyncCodecStatics);
    expect(SchemaUtils.withPromiseCodecStatics).toBe(withPromiseCodecStatics);
    expect(SchemaUtils.withEffectCodecStatics).toBe(withEffectCodecStatics);
    expect(SchemaUtils.withExitCodecStatics).toBe(withExitCodecStatics);
    expect(SchemaUtils.withOptionCodecStatics).toBe(withOptionCodecStatics);
    expect(SchemaUtils.withResultCodecStatics).toBe(withResultCodecStatics);
  });

  it("attaches shared statics and the sync decode/encode quartet", () => {
    const Piped = Count.pipe(withSyncCodecStatics);
    const Direct = withSyncCodecStatics(Count);
    const Branded = S.String.pipe(S.brand("MySchema"), withSyncCodecStatics);

    expectSharedStatics(Piped);
    expect(Piped.decodeUnknownSync("42")).toBe(42);
    expect(Piped.decodeSync("42")).toBe(42);
    expect(Piped.encodeSync(42)).toBe("42");
    expect(Piped.encodeUnknownSync(42)).toBe("42");
    expect(() => Piped.decodeUnknownSync(invalidEncoded)).toThrow();
    expect(() => Piped.decodeSync(invalidEncoded)).toThrow();
    expect(() => Piped.encodeUnknownSync(invalidDecoded)).toThrow();
    expect(Direct.decodeUnknownSync("7")).toBe(7);
    expect(Branded.decodeUnknownSync("docs")).toBe("docs");
    expect(Branded.is("docs")).toBe(true);
    expect(Branded.encodeSync("docs")).toBe("docs");
  });

  it("attached sync statics agree with the raw schema codecs over schema-derived samples", () => {
    const Piped = Count.pipe(withSyncCodecStatics);

    fc.assert(
      fc.property(S.toArbitrary(S.Finite)(fc), (sampled) => {
        const encoded = Piped.encodeSync(sampled);
        const decoded = Piped.decodeUnknownSync(encoded);
        expect(Piped.is(sampled)).toBe(S.is(Count)(sampled));
        expect(Piped.equivalence(decoded, sampled)).toBe(true);
        expect(Piped.encodeSync(decoded)).toBe(encoded);
      }),
      fcRuns(50)
    );
  });

  it("attaches Option, Result, and Exit decode/encode quartets", () => {
    const OptionCount = Count.pipe(withOptionCodecStatics);
    const ResultCount = Count.pipe(withResultCodecStatics);
    const ExitCount = Count.pipe(withExitCodecStatics);

    expectSharedStatics(OptionCount);
    expect(OptionCount.decodeUnknownOption("42")).toStrictEqual(O.some(42));
    expect(OptionCount.decodeOption("42")).toStrictEqual(O.some(42));
    expect(O.isNone(OptionCount.decodeUnknownOption(invalidEncoded))).toBe(true);
    expect(O.isNone(OptionCount.decodeOption(invalidEncoded))).toBe(true);
    expect(OptionCount.encodeOption(42)).toStrictEqual(O.some("42"));
    expect(OptionCount.encodeUnknownOption(42)).toStrictEqual(O.some("42"));
    expect(O.isNone(OptionCount.encodeUnknownOption(invalidDecoded))).toBe(true);
    expect(O.isNone(OptionCount.encodeOption(Number.NaN))).toBe(true);

    expectSharedStatics(ResultCount);
    expect(Result.getOrThrow(ResultCount.decodeUnknownResult("42"))).toBe(42);
    expect(Result.getOrThrow(ResultCount.decodeResult("42"))).toBe(42);
    expect(Result.isFailure(ResultCount.decodeUnknownResult(invalidEncoded))).toBe(true);
    expect(Result.isFailure(ResultCount.decodeResult(invalidEncoded))).toBe(true);
    expect(Result.getOrThrow(ResultCount.encodeResult(42))).toBe("42");
    expect(Result.getOrThrow(ResultCount.encodeUnknownResult(42))).toBe("42");
    expect(Result.isFailure(ResultCount.encodeUnknownResult(invalidDecoded))).toBe(true);

    expectSharedStatics(ExitCount);
    expect(Exit.getSuccess(ExitCount.decodeUnknownExit("42"))).toStrictEqual(O.some(42));
    expect(Exit.getSuccess(ExitCount.decodeExit("42"))).toStrictEqual(O.some(42));
    expect(Exit.isFailure(ExitCount.decodeUnknownExit(invalidEncoded))).toBe(true);
    expect(Exit.isFailure(ExitCount.decodeExit(invalidEncoded))).toBe(true);
    expect(Exit.getSuccess(ExitCount.encodeExit(42))).toStrictEqual(O.some("42"));
    expect(Exit.getSuccess(ExitCount.encodeUnknownExit(42))).toStrictEqual(O.some("42"));
    expect(Exit.isFailure(ExitCount.encodeUnknownExit(invalidDecoded))).toBe(true);
  });

  it.effect(
    "attaches Effect decode/encode quartets",
    Effect.fnUntraced(function* () {
      const EffectCount = Count.pipe(withEffectCodecStatics);

      expectSharedStatics(EffectCount);
      expect(yield* EffectCount.decodeUnknownEffect("42")).toBe(42);
      expect(yield* EffectCount.decodeEffect("42")).toBe(42);
      expect(yield* EffectCount.encodeEffect(42)).toBe("42");
      expect(yield* EffectCount.encodeUnknownEffect(42)).toBe("42");

      const failedDecode = yield* Effect.exit(EffectCount.decodeUnknownEffect(invalidEncoded));
      const failedTypedDecode = yield* Effect.exit(EffectCount.decodeEffect(invalidEncoded));
      const failedEncode = yield* Effect.exit(EffectCount.encodeUnknownEffect(invalidDecoded));
      expect(Exit.isFailure(failedDecode)).toBe(true);
      expect(Exit.isFailure(failedTypedDecode)).toBe(true);
      expect(Exit.isFailure(failedEncode)).toBe(true);
    })
  );

  it.effect(
    "attaches Promise decode/encode quartets",
    Effect.fnUntraced(function* () {
      const PromiseCount = Count.pipe(withPromiseCodecStatics);

      expectSharedStatics(PromiseCount);
      expect(yield* Effect.tryPromise(() => PromiseCount.decodeUnknownPromise("42"))).toBe(42);
      expect(yield* Effect.tryPromise(() => PromiseCount.decodePromise("42"))).toBe(42);
      expect(yield* Effect.tryPromise(() => PromiseCount.encodePromise(42))).toBe("42");
      expect(yield* Effect.tryPromise(() => PromiseCount.encodeUnknownPromise(42))).toBe("42");

      const failedDecode = yield* Effect.result(
        Effect.tryPromise({
          try: () => PromiseCount.decodeUnknownPromise(invalidEncoded),
          catch: (cause) => cause,
        })
      );
      const failedEncode = yield* Effect.result(
        Effect.tryPromise({
          try: () => PromiseCount.encodeUnknownPromise(invalidDecoded),
          catch: (cause) => cause,
        })
      );
      expect(Result.isFailure(failedDecode)).toBe(true);
      expect(Result.isFailure(failedEncode)).toBe(true);
    })
  );

  it("preserves group statics when identity annotations run later in the pipeline", () => {
    const Tagged = Count.pipe(
      withResultCodecStatics,
      $SchemaId.annoteSchema("TaggedCount", { description: "Count with result codec statics." })
    );

    expect(Tagged.is(42)).toBe(true);
    expect(Result.isFailure(Tagged.decodeUnknownResult(invalidEncoded))).toBe(true);
    expect(Result.getOrThrow(Tagged.encodeResult(42))).toBe("42");
  });

  it("lets two runner groups stack without dropping shared statics", () => {
    const Stacked = Count.pipe(withOptionCodecStatics, withResultCodecStatics);

    expect(Stacked.is(42)).toBe(true);
    expect(O.isSome(Stacked.decodeUnknownOption("42"))).toBe(true);
    expect(Result.isSuccess(Stacked.decodeUnknownResult("42"))).toBe(true);
    expect(Stacked.encodeResult(42)).toStrictEqual(Result.succeed("42"));
    expect(Stacked.encodeOption(42)).toStrictEqual(O.some("42"));
  });
});
