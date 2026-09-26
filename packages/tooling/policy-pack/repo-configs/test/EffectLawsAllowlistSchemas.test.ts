import {
  decodeAllowlistDocumentFromJsoncText,
  EffectLawsAllowlistDocument,
  EffectLawsAllowlistSnapshot,
} from "@beep/repo-configs/internal/eslint/EffectLawsAllowlistSchemas";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";

const expectRoundTrip = <Schema extends S.Top & S.ConstraintEncoder<unknown> & S.ConstraintDecoder<unknown>>(
  schema: Schema,
  value: Schema["Type"]
) => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  assertTrue(Equal.equals(decoded, value));
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

  it.prop(
    "EffectLawsAllowlistDocument: round-trips allowlist document and snapshot schemas",
    [Arbitrary.schema(EffectLawsAllowlistDocument)],
    ([value]) => {
      expectRoundTrip(EffectLawsAllowlistDocument, value);
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "EffectLawsAllowlistSnapshot: round-trips allowlist document and snapshot schemas",
    [Arbitrary.schema(EffectLawsAllowlistSnapshot)],
    ([value]) => {
      expectRoundTrip(EffectLawsAllowlistSnapshot, value);
    },
    { arbitrary: fcRuns(25) }
  );
});
