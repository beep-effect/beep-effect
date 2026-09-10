import {
  decodeAllowlistDocumentFromJsoncText,
  EffectLawsAllowlistDocument,
  EffectLawsAllowlistSnapshot,
} from "@beep/repo-configs/internal/eslint/EffectLawsAllowlistSchemas";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const expectRoundTrip = <Schema extends S.Top & S.ConstraintEncoder<unknown> & S.ConstraintDecoder<unknown>>(
  schema: Schema,
  value: Schema["Type"]
) => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Equal.equals(decoded, value)).toBe(true);
};

describe("Effect laws allowlist schemas", () => {
  it.effect(
    "normalizes entry file paths during JSONC decode",
    Effect.fnUntraced(function* () {
      const document = yield* decodeAllowlistDocumentFromJsoncText(`{
        // JSONC comments are accepted at this boundary.
        "version": 1,
        "entries": [
          {
            "rule": "effect-imports",
            "file": "packages\\\\tooling\\\\example.ts",
            "kind": "fixture",
            "reason": "fixture",
            "owner": "@beep/repo-configs",
            "issue": "fixture"
          },
        ]
      }`);

      expect(document.entries[0]?.file).toBe("packages/tooling/example.ts");
    })
  );

  it("round-trips allowlist document and snapshot schemas", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(EffectLawsAllowlistDocument)]),
          ([value]) => {
            expectRoundTrip(EffectLawsAllowlistDocument, value);
            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(EffectLawsAllowlistSnapshot)]),
          ([value]) => {
            expectRoundTrip(EffectLawsAllowlistSnapshot, value);
            return true;
          },
          fcRuns(25)
        )
      )._tag
    ).toBe("Passed");
  });
});
