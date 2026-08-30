import {
  AI_METRICS_LOCAL_INSECURE_HASH_SALT,
  hashPrivateIdentifier,
  hashPublicTextSha256,
  redactAiMetricsSensitiveText,
} from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const isSha256Hex = S.is(Sha256Hex);
const SecretTokenArbitrary = fc.stringMatching(/^[A-Za-z0-9]{8,64}$/);

describe("AI metrics privacy boundaries", () => {
  it.effect("returns schema-valid SHA-256 digests", () =>
    Effect.gen(function* () {
      const hash = yield* hashPublicTextSha256("public identity");
      expect(isSha256Hex(hash)).toBe(true);
    })
  );

  it.effect("preserves salted and unsalted hash bytes across the Option API migration", () =>
    Effect.gen(function* () {
      const value = "/synthetic/private/session.jsonl";
      const salt = "synthetic-test-salt";
      const salted = yield* hashPrivateIdentifier(value, O.some(salt));
      const unsalted = yield* hashPrivateIdentifier(value, O.none());

      expect(salted).toBe(yield* hashPublicTextSha256(`${salt}\u0000${value}`));
      expect(unsalted).toBe(yield* hashPublicTextSha256(`${AI_METRICS_LOCAL_INSECURE_HASH_SALT}\u0000${value}`));
    })
  );

  it("redacts arbitrary bearer credentials without exposing the token", () =>
    fc.assert(
      fc.property(SecretTokenArbitrary, (token) => {
        const redacted = redactAiMetricsSensitiveText(`Authorization: Bearer ${token}`);

        expect(redacted).not.toContain(token);
        expect(redacted).toContain("[REDACTED]");
      }),
      fcRuns(50)
    ));
});
