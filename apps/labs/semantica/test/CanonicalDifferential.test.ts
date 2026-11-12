// @vitest-environment node

// Slice A of goals/canonical-digest-owner, for the lab's own encoder.
//
// `canonicalJson` in `src/corpus/Canonical.ts` is held byte-equal to the owner,
// `JsoncFingerprint.canonicalizeResult` (RFC 8785), wherever the owner emits,
// and its present output for values that are not plain JSON is fixed row by
// row. The epistemics and PacketCore encoders have the same two tests in
// `packages/tooling/tool/cli/test/canonical-digest-owner-differential.test.ts`;
// this one lives in the app because a package cannot import an app (decision
// `2026-11-12-differential-test-placement` in the goal packet).
import { JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Hex from "effect/encoding/Hex";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { canonicalJson } from "@/corpus/Canonical";
import w1Manifest from "../fixtures/w1.manifest.json" with { type: "json" };
import type { JsoncCanonicalizeErrorCode } from "@beep/jsonc/JsoncFingerprint";

const ownerText = (value: unknown): string => Result.getOrThrow(JsoncFingerprint.canonicalizeResult(value));

const ownerRefusal = (value: unknown): JsoncCanonicalizeErrorCode | "emitted" =>
  Result.match(JsoncFingerprint.canonicalizeResult(value), {
    onSuccess: (): JsoncCanonicalizeErrorCode | "emitted" => "emitted",
    onFailure: (failure) => failure.code,
  });

describe("semantica canonicalJson against the canonical digest owner", () => {
  // `Arbitrary.schema(S.Json)` covers the whole double range, `__proto__`
  // keys, null-prototype objects and astral strings. It also generates
  // unpaired surrogates, the one thing in `S.Json` that is not I-JSON: there
  // the owner refuses, and the row below fixes what this encoder does instead.
  it.prop(
    "emits the owner's RFC 8785 bytes wherever the owner emits",
    { value: Arbitrary.schema(S.Json) },
    ({ value }) => {
      Result.match(JsoncFingerprint.canonicalizeResult(value), {
        onSuccess: (text) => expect(canonicalJson(value)).toBe(text),
        onFailure: (failure) => expect(failure.code).toBe("LoneSurrogate"),
      });
    },
    { arbitrary: fcRuns(600) }
  );

  it("orders keys by UTF-16 code unit and serializes numbers as ECMAScript does", () => {
    // U+10000 is the unit pair D800 DC00, so it sorts before U+E000 and
    // U+FB00 although its code point is larger.
    const keys = { "\ufb00": 1, "\u{10000}": 2, "\ue000": 3, "": 4, a: 5, A: 6, "10": 7, "9": 8 };
    const numbers = [0, -0, 1e21, 1e-7, 5e-324, 2 ** 53, 0.1 + 0.2, Number.MAX_VALUE, -Number.MAX_VALUE];
    const strings = ['"', "\\", "/", "\u0000", "\u001f", "\u2028", "\u2029", "\u00e9", "e\u0301", "\u{1f600}"];

    expect(canonicalJson(keys)).toBe('{"":4,"10":7,"9":8,"A":6,"a":5,"\u{10000}":2,"\ue000":3,"\ufb00":1}');
    for (const value of [keys, numbers, strings, { keys, numbers, strings }]) {
      expect(canonicalJson(value)).toBe(ownerText(value));
    }
  });

  // Present behaviour, not a contract: slice C replaces the body with the
  // owner, and each row here is a place where the output changes to a typed
  // refusal (or, for an `undefined` member, stays the same through the one
  // permitted pre-pass).
  const offDomain: ReadonlyArray<readonly [input: string, value: unknown, today: string, owner: string]> = [
    ["an object member whose value is undefined", { a: undefined, b: 1 }, '{"b":1}', "UnrepresentableValue"],
    ["an undefined array element", [1, undefined, 2], "[1,null,2]", "UnrepresentableValue"],
    ["undefined at the root", undefined, "null", "UnrepresentableValue"],
    ["NaN", { n: Number.NaN }, '{"n":null}', "NonFiniteNumber"],
    ["Infinity", [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY], "[null,null]", "NonFiniteNumber"],
    ["a Date", { d: DateTime.toDate(DateTime.makeUnsafe(0)) }, '{"d":{}}', "NonPlainObject"],
    ["a bigint", { b: 1n }, '{"b":null}', "BigIntValue"],
    ["a lone surrogate in a string value", ["\ud800"], '["\\ud800"]', "LoneSurrogate"],
    ["a lone surrogate in a member key", { "\udc00": 1 }, '{"\\udc00":1}', "LoneSurrogate"],
  ];

  it.each(offDomain)("fixes today's output and the owner's refusal for %s", (_input, value, today, owner) => {
    expect(canonicalJson(value)).toBe(today);
    expect(ownerRefusal(value)).toBe(owner);
  });

  // Stored-digest replay for the lab: a digest committed in a fixture must
  // recompute through the owner before slice C swaps this encoder. The W1
  // manifest's `corpusHash` is SHA-256 over this encoder's bytes for `rows`.
  it("recomputes the committed W1 manifest corpus hash through the owner", () => {
    expect(Hex.encode(sha256(new TextEncoder().encode(ownerText(w1Manifest.rows))))).toBe(w1Manifest.corpusHash);
    expect(canonicalJson(w1Manifest.rows)).toBe(ownerText(w1Manifest.rows));
  });
});
