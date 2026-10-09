import { EmailString } from "@beep/schema/Email";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
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
