import { Unknown as RootUnknown } from "@beep/schema";
import { Unknown } from "@beep/schema/Unknown";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Result from "effect/Result";

const input = { name: "Ada", active: true };
const compactJson = '{"name":"Ada","active":true}';
const formattedJson = '{\n  "name": "Ada",\n  "active": true\n}';
const assertsUnknown: typeof Unknown.asserts = Unknown.asserts;

describe("Unknown", () => {
  it("exports the codec-enhanced schema from the package root", () => {
    expect(RootUnknown).toBe(Unknown);
    expect(Unknown.is(input)).toBe(true);
    expect(Unknown.equivalence(input, input)).toBe(true);
    assertsUnknown(input);
  });

  it("exposes Sync, Option, Result, and Exit codecs", () => {
    expect(Unknown.decodeUnknownSync(input)).toBe(input);
    expect(Unknown.encodeUnknownSync(input)).toBe(input);
    expect(Unknown.decodeUnknownSyncFromJsonString(compactJson)).toEqual(input);
    expect(Unknown.encodeUnknownSyncFromJsonString(input, { space: 2 })).toBe(formattedJson);

    expect(Unknown.decodeUnknownOptionFromJsonString(compactJson)).toStrictEqual(O.some(input));
    expect(Unknown.encodeUnknownOptionFromJsonString(input)).toStrictEqual(O.some(compactJson));
    expect(Result.getOrThrow(Unknown.decodeUnknownResultFromJsonString(compactJson))).toEqual(input);
    expect(Result.getOrThrow(Unknown.encodeUnknownResultFromJsonString(input))).toBe(compactJson);
    expect(Exit.getSuccess(Unknown.decodeUnknownExitFromJsonString(compactJson))).toStrictEqual(O.some(input));
    expect(Exit.getSuccess(Unknown.encodeUnknownExitFromJsonString(input))).toStrictEqual(O.some(compactJson));
  });

  it.effect(
    "exposes Effect and Promise JSON codecs with per-call options",
    Effect.fnUntraced(function* () {
      expect(yield* Unknown.decodeUnknownEffectFromJsonString(compactJson)).toEqual(input);
      expect(yield* Unknown.encodeUnknownEffectFromJsonString(input, { space: 2 })).toBe(formattedJson);
      expect(yield* Effect.tryPromise(() => Unknown.decodeUnknownPromiseFromJsonString(compactJson))).toEqual(input);
      expect(yield* Effect.tryPromise(() => Unknown.encodeUnknownPromiseFromJsonString(input, { space: 2 }))).toBe(
        formattedJson
      );
    })
  );
});
