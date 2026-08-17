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
const validJsonEncoded = '"42"';
const invalidJsonEncoded = '"nope"';

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

  it("attaches shared statics and sync codecs for direct and JSON-string boundaries", () => {
    const Piped = Count.pipe(withSyncCodecStatics);
    const Direct = withSyncCodecStatics(Count);
    const Branded = S.String.pipe(S.brand("MySchema"), withSyncCodecStatics);

    expectSharedStatics(Piped);
    expect(Piped.decodeUnknownSync("42")).toBe(42);
    expect(Piped.decodeSync("42")).toBe(42);
    expect(Piped.decodeUnknownSyncFromJsonString(validJsonEncoded)).toBe(42);
    expect(Piped.decodeSyncFromJsonString(validJsonEncoded)).toBe(42);
    expect(Piped.encodeSync(42)).toBe("42");
    expect(Piped.encodeUnknownSync(42)).toBe("42");
    expect(Piped.encodeSyncFromJsonString(42)).toBe(validJsonEncoded);
    expect(Piped.encodeUnknownSyncFromJsonString(42)).toBe(validJsonEncoded);
    expect(() => Piped.decodeUnknownSync(invalidEncoded)).toThrow();
    expect(() => Piped.decodeSync(invalidEncoded)).toThrow();
    expect(() => Piped.decodeUnknownSyncFromJsonString(42)).toThrow();
    expect(() => Piped.decodeSyncFromJsonString(invalidJsonEncoded)).toThrow();
    expect(() => Piped.encodeUnknownSync(invalidDecoded)).toThrow();
    expect(() => Piped.encodeUnknownSyncFromJsonString(invalidDecoded)).toThrow();
    expect(Direct.decodeUnknownSync("7")).toBe(7);
    expect(Branded.decodeUnknownSync("docs")).toBe("docs");
    expect(Branded.is("docs")).toBe(true);
    expect(Branded.encodeUnknownSync(Branded.decodeUnknownSync("docs"))).toBe("docs");
  });

  it("attached sync statics agree with the raw schema codecs over schema-derived samples", () => {
    const Piped = Count.pipe(withSyncCodecStatics);

    fc.assert(
      fc.property(S.toArbitrary(S.Finite)(fc), (sampled) => {
        const encoded = Piped.encodeSync(sampled);
        const decoded = Piped.decodeUnknownSync(encoded);
        const jsonEncoded = Piped.encodeSyncFromJsonString(sampled);
        const jsonDecoded = Piped.decodeUnknownSyncFromJsonString(jsonEncoded);
        expect(Piped.is(sampled)).toBe(S.is(Count)(sampled));
        expect(Piped.equivalence(decoded, sampled)).toBe(true);
        expect(Piped.equivalence(jsonDecoded, sampled)).toBe(true);
        expect(Piped.encodeSync(decoded)).toBe(encoded);
        expect(Piped.encodeSyncFromJsonString(jsonDecoded)).toBe(jsonEncoded);
      }),
      fcRuns(50)
    );
  });

  it("attaches Option, Result, and Exit codecs for direct and JSON-string boundaries", () => {
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
    expect(OptionCount.decodeOptionFromJsonString(validJsonEncoded)).toStrictEqual(O.some(42));
    expect(OptionCount.decodeUnknownOptionFromJsonString(validJsonEncoded)).toStrictEqual(O.some(42));
    expect(OptionCount.encodeOptionFromJsonString(42)).toStrictEqual(O.some(validJsonEncoded));
    expect(OptionCount.encodeUnknownOptionFromJsonString(42)).toStrictEqual(O.some(validJsonEncoded));
    expect(O.isNone(OptionCount.encodeUnknownOption(invalidDecoded))).toBe(true);
    expect(O.isNone(OptionCount.encodeOption(Number.NaN))).toBe(true);
    expect(O.isNone(OptionCount.decodeUnknownOptionFromJsonString(42))).toBe(true);
    expect(O.isNone(OptionCount.decodeOptionFromJsonString(invalidJsonEncoded))).toBe(true);
    expect(O.isNone(OptionCount.encodeUnknownOptionFromJsonString(invalidDecoded))).toBe(true);

    expectSharedStatics(ResultCount);
    expect(Result.getOrThrow(ResultCount.decodeUnknownResult("42"))).toBe(42);
    expect(Result.getOrThrow(ResultCount.decodeResult("42"))).toBe(42);
    expect(Result.isFailure(ResultCount.decodeUnknownResult(invalidEncoded))).toBe(true);
    expect(Result.isFailure(ResultCount.decodeResult(invalidEncoded))).toBe(true);
    expect(Result.getOrThrow(ResultCount.encodeResult(42))).toBe("42");
    expect(Result.getOrThrow(ResultCount.encodeUnknownResult(42))).toBe("42");
    expect(Result.getOrThrow(ResultCount.decodeResultFromJsonString(validJsonEncoded))).toBe(42);
    expect(Result.getOrThrow(ResultCount.decodeUnknownResultFromJsonString(validJsonEncoded))).toBe(42);
    expect(Result.getOrThrow(ResultCount.encodeResultFromJsonString(42))).toBe(validJsonEncoded);
    expect(Result.getOrThrow(ResultCount.encodeUnknownResultFromJsonString(42))).toBe(validJsonEncoded);
    expect(Result.isFailure(ResultCount.encodeUnknownResult(invalidDecoded))).toBe(true);
    expect(Result.isFailure(ResultCount.decodeUnknownResultFromJsonString(42))).toBe(true);
    expect(Result.isFailure(ResultCount.decodeResultFromJsonString(invalidJsonEncoded))).toBe(true);
    expect(Result.isFailure(ResultCount.encodeUnknownResultFromJsonString(invalidDecoded))).toBe(true);

    expectSharedStatics(ExitCount);
    expect(Exit.getSuccess(ExitCount.decodeUnknownExit("42"))).toStrictEqual(O.some(42));
    expect(Exit.getSuccess(ExitCount.decodeExit("42"))).toStrictEqual(O.some(42));
    expect(Exit.isFailure(ExitCount.decodeUnknownExit(invalidEncoded))).toBe(true);
    expect(Exit.isFailure(ExitCount.decodeExit(invalidEncoded))).toBe(true);
    expect(Exit.getSuccess(ExitCount.encodeExit(42))).toStrictEqual(O.some("42"));
    expect(Exit.getSuccess(ExitCount.encodeUnknownExit(42))).toStrictEqual(O.some("42"));
    expect(Exit.getSuccess(ExitCount.decodeExitFromJsonString(validJsonEncoded))).toStrictEqual(O.some(42));
    expect(Exit.getSuccess(ExitCount.decodeUnknownExitFromJsonString(validJsonEncoded))).toStrictEqual(O.some(42));
    expect(Exit.getSuccess(ExitCount.encodeExitFromJsonString(42))).toStrictEqual(O.some(validJsonEncoded));
    expect(Exit.getSuccess(ExitCount.encodeUnknownExitFromJsonString(42))).toStrictEqual(O.some(validJsonEncoded));
    expect(Exit.isFailure(ExitCount.encodeUnknownExit(invalidDecoded))).toBe(true);
    expect(Exit.isFailure(ExitCount.decodeUnknownExitFromJsonString(42))).toBe(true);
    expect(Exit.isFailure(ExitCount.decodeExitFromJsonString(invalidJsonEncoded))).toBe(true);
    expect(Exit.isFailure(ExitCount.encodeUnknownExitFromJsonString(invalidDecoded))).toBe(true);
  });

  it.effect(
    "attaches Effect codecs for direct and JSON-string boundaries",
    Effect.fnUntraced(function* () {
      const EffectCount = Count.pipe(withEffectCodecStatics);

      expectSharedStatics(EffectCount);
      expect(yield* EffectCount.decodeUnknownEffect("42")).toBe(42);
      expect(yield* EffectCount.decodeEffect("42")).toBe(42);
      expect(yield* EffectCount.decodeUnknownEffectFromJsonString(validJsonEncoded)).toBe(42);
      expect(yield* EffectCount.decodeEffectFromJsonString(validJsonEncoded)).toBe(42);
      expect(yield* EffectCount.encodeEffect(42)).toBe("42");
      expect(yield* EffectCount.encodeUnknownEffect(42)).toBe("42");
      expect(yield* EffectCount.encodeEffectFromJsonString(42)).toBe(validJsonEncoded);
      expect(yield* EffectCount.encodeUnknownEffectFromJsonString(42)).toBe(validJsonEncoded);

      const failedDecode = yield* Effect.exit(EffectCount.decodeUnknownEffect(invalidEncoded));
      const failedTypedDecode = yield* Effect.exit(EffectCount.decodeEffect(invalidEncoded));
      const failedEncode = yield* Effect.exit(EffectCount.encodeUnknownEffect(invalidDecoded));
      const failedUnknownJsonDecode = yield* Effect.exit(EffectCount.decodeUnknownEffectFromJsonString(42));
      const failedJsonDecode = yield* Effect.exit(EffectCount.decodeEffectFromJsonString(invalidJsonEncoded));
      const failedUnknownJsonEncode = yield* Effect.exit(EffectCount.encodeUnknownEffectFromJsonString(invalidDecoded));
      expect(Exit.isFailure(failedDecode)).toBe(true);
      expect(Exit.isFailure(failedTypedDecode)).toBe(true);
      expect(Exit.isFailure(failedEncode)).toBe(true);
      expect(Exit.isFailure(failedUnknownJsonDecode)).toBe(true);
      expect(Exit.isFailure(failedJsonDecode)).toBe(true);
      expect(Exit.isFailure(failedUnknownJsonEncode)).toBe(true);
    })
  );

  it.effect(
    "attaches Promise codecs for direct and JSON-string boundaries",
    Effect.fnUntraced(function* () {
      const PromiseCount = Count.pipe(withPromiseCodecStatics);

      expectSharedStatics(PromiseCount);
      expect(yield* Effect.tryPromise(() => PromiseCount.decodeUnknownPromise("42"))).toBe(42);
      expect(yield* Effect.tryPromise(() => PromiseCount.decodePromise("42"))).toBe(42);
      expect(yield* Effect.tryPromise(() => PromiseCount.decodeUnknownPromiseFromJsonString(validJsonEncoded))).toBe(
        42
      );
      expect(yield* Effect.tryPromise(() => PromiseCount.decodePromiseFromJsonString(validJsonEncoded))).toBe(42);
      expect(yield* Effect.tryPromise(() => PromiseCount.encodePromise(42))).toBe("42");
      expect(yield* Effect.tryPromise(() => PromiseCount.encodeUnknownPromise(42))).toBe("42");
      expect(yield* Effect.tryPromise(() => PromiseCount.encodePromiseFromJsonString(42))).toBe(validJsonEncoded);
      expect(yield* Effect.tryPromise(() => PromiseCount.encodeUnknownPromiseFromJsonString(42))).toBe(
        validJsonEncoded
      );

      const failedDecode = yield* Effect.result(
        Effect.tryPromise(() => PromiseCount.decodeUnknownPromise(invalidEncoded))
      );
      const failedEncode = yield* Effect.result(
        Effect.tryPromise(() => PromiseCount.encodeUnknownPromise(invalidDecoded))
      );
      const failedUnknownJsonDecode = yield* Effect.result(
        Effect.tryPromise(() => PromiseCount.decodeUnknownPromiseFromJsonString(42))
      );
      const failedJsonDecode = yield* Effect.result(
        Effect.tryPromise(() => PromiseCount.decodePromiseFromJsonString(invalidJsonEncoded))
      );
      const failedUnknownJsonEncode = yield* Effect.result(
        Effect.tryPromise(() => PromiseCount.encodeUnknownPromiseFromJsonString(invalidDecoded))
      );
      expect(Result.isFailure(failedDecode)).toBe(true);
      expect(Result.isFailure(failedEncode)).toBe(true);
      expect(Result.isFailure(failedUnknownJsonDecode)).toBe(true);
      expect(Result.isFailure(failedJsonDecode)).toBe(true);
      expect(Result.isFailure(failedUnknownJsonEncode)).toBe(true);
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
