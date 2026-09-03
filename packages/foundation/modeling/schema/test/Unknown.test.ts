import { Unknown as RootUnknown, UnknownFromJsonString as RootUnknownFromJsonString } from "@beep/schema";
import { Unknown, UnknownFromJsonString } from "@beep/schema/Unknown";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const input = { name: "Ada", active: true };
const compactJson = '{"name":"Ada","active":true}';
const formattedJson = '{\n  "name": "Ada",\n  "active": true\n}';
const PrettyUnknownFromJsonString = S.fromJsonString(Unknown, { space: 2 });
const decodeUnknown = S.decodeSync(Unknown);
const encodePrettyUnknownEffect = S.encodeUnknownEffect(PrettyUnknownFromJsonString);

describe("Unknown", () => {
  it("exports the plain schema and explicit JSON boundary from the package root", () => {
    expect(RootUnknown).toBe(Unknown);
    expect(RootUnknownFromJsonString).toBe(UnknownFromJsonString);
    expect(decodeUnknown(input)).toBe(input);
  });

  it("exposes only selected compact JSON runners", () => {
    expect(UnknownFromJsonString.decodeUnknownSync(compactJson)).toEqual(input);
    expect(UnknownFromJsonString.encodeUnknownSync(input)).toBe(compactJson);
    expect(UnknownFromJsonString.decodeUnknownOption(compactJson)).toStrictEqual(O.some(input));
    expect(Result.getOrThrow(UnknownFromJsonString.decodeUnknownResult(compactJson))).toEqual(input);
    expect(Result.getOrThrow(UnknownFromJsonString.encodeUnknownResult(input))).toBe(compactJson);
    expect(Reflect.has(UnknownFromJsonString, "decodeUnknownPromise")).toBe(false);
    expect(Reflect.has(UnknownFromJsonString, "encodeUnknownExit")).toBe(false);
  });

  it.effect(
    "uses a separately named schema for fixed pretty-printing policy",
    Effect.fnUntraced(function* () {
      expect(yield* UnknownFromJsonString.decodeUnknownEffect(compactJson)).toEqual(input);
      expect(yield* UnknownFromJsonString.encodeUnknownEffect(input)).toBe(compactJson);
      expect(yield* encodePrettyUnknownEffect(input)).toBe(formattedJson);
    })
  );
});
