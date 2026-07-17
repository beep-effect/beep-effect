import { EmailString } from "@beep/schema/Email";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import * as S from "effect/Schema";

describe("EmailString", () => {
  const decode = S.decodeUnknownEffect(EmailString);

  it.effect(
    "normalizes valid email strings without redacting the decoded value",
    Effect.fnUntraced(function* () {
      const email = yield* decode(" Admin@Example.COM ");

      expect(email).toBe("admin@example.com");
      expect(Redacted.isRedacted(email)).toBe(false);
    })
  );

  it.effect(
    "rejects invalid email strings",
    Effect.fnUntraced(function* () {
      const error = yield* Effect.flip(decode("not-an-email"));

      expect(error.message).toContain("Invalid email format");
    })
  );
});
