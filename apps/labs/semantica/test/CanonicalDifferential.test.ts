// @vitest-environment node

// Goal canonical-digest-owner, for the lab's own encoder.
//
// Slice A held `canonicalJson` in `src/corpus/Canonical.ts` byte-equal to the
// owner, `JsoncFingerprint.canonicalizeResult` (RFC 8785), wherever the owner
// emits, and fixed its output for values that are not plain JSON. Slice C made
// the owner its body, so the byte-equality property would now compare the
// owner with itself and is gone. What still carries information: the table of
// behaviour changes (the legacy output, recorded from slice A, beside the
// refusal the export now throws) and the replay of the committed W1 digest.
// The epistemics and PacketCore encoders have the same table in
// `packages/tooling/tool/cli/test/canonical-digest-owner-differential.test.ts`;
// this one lives in the app because a package cannot import an app (decision
// `2026-11-12-differential-test-placement` in the goal packet).
import { JsoncCanonicalizeError, JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import { describe, expect, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import * as DateTime from "effect/DateTime";
import * as Hex from "effect/encoding/Hex";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { canonicalJson, canonicalJsonResult } from "@/corpus/Canonical";
import { contentDigestSync } from "@/schema/Digest";
import { RdfStatement } from "@/schema/Reasoning";
import w1Manifest from "../fixtures/w1.manifest.json" with { type: "json" };
import type { JsoncCanonicalizeErrorCode } from "@beep/jsonc/JsoncFingerprint";

// The export throws the owner's typed error; read it back as its code.
const exported = (value: unknown): Result.Result<string, JsoncCanonicalizeErrorCode | "not refused"> =>
  Result.try({
    try: () => canonicalJson(value),
    catch: (thrown) => (S.is(JsoncCanonicalizeError)(thrown) ? thrown.code : "not refused"),
  });

describe("semantica canonicalJson against the canonical digest owner", () => {
  // Each row is a behaviour change of the swap: `legacy` is what the lab's own
  // encoder wrote, as slice A observed it (the code is gone, so it is a
  // record, not an assertion); the export now throws the owner's refusal.
  const offDomain: ReadonlyArray<
    readonly [input: string, value: unknown, legacy: string, refusal: JsoncCanonicalizeErrorCode]
  > = [
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

  it.each(offDomain)("refuses %s, which the legacy encoder wrote as %s", (_input, value, _legacy, refusal) => {
    assertFailure(exported(value), refusal);
  });

  // Since review round 1 the lab's digest helpers and schema checks go through
  // the Result twin, so the same refusal fails typed instead of throwing.
  it("fails the lab's digest helpers typed and keeps its schema checks total", () => {
    const named = (refusal: string) => (error: S.SchemaError) => Str.includes(refusal)(error.message);

    assertFailure(Result.mapError(canonicalJsonResult({ a: "\ud800" }), named('LoneSurrogate at "/a"')), true);
    assertFailure(
      Result.mapError(
        contentDigestSync(S.Struct({ text: S.String }))({ text: "\ud800" }),
        named('LoneSurrogate at "/text"')
      ),
      true
    );
    // The statement id check hashes the triple; a term with no canonical form
    // makes the guard false instead of making it throw.
    const illFormed = { id: Str.repeat(64)("0"), subject: "\ud800", predicate: "p", object: "o" };
    expect(S.is(RdfStatement)(illFormed)).toBe(false);
  });

  // Stored-digest replay for the lab: the W1 manifest's `corpusHash` is
  // SHA-256 over the canonical bytes of `rows`, committed before the swap. It
  // must recompute through the owner and through the export.
  it("recomputes the committed W1 manifest corpus hash through the owner", () => {
    const hashOf = (text: string): string => Hex.encode(sha256(new TextEncoder().encode(text)));

    assertSuccess(Result.map(JsoncFingerprint.canonicalizeResult(w1Manifest.rows), hashOf), w1Manifest.corpusHash);
    assertSuccess(Result.map(exported(w1Manifest.rows), hashOf), w1Manifest.corpusHash);
  });
});
