import { EmailString } from "@beep/schema/Email";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import * as S from "effect/Schema";

const decodeUnknownEmailString = S.decodeUnknownEffect(EmailString);

describe("EmailString", () => {
  it.effect(
    "normalizes valid email strings without redacting the decoded value",
    Effect.fnUntraced(function* () {
      const email = yield* decodeUnknownEmailString(" Admin@Example.COM ");

      expect(email).toBe("admin@example.com");
      expect(Redacted.isRedacted(email)).toBe(false);
    })
  );

  it.effect(
    "rejects invalid email strings",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(decodeUnknownEmailString("not-an-email"));

      expect(error.message).toContain("Invalid email format");
    })
  );
});
