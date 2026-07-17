import { HttpsUrl } from "@beep/schema/URL";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

describe("URL", () => {
  const decodeHttpsUrl = S.decodeUnknownEffect(HttpsUrl);

  it.effect(
    "accepts valid https URL strings",
    Effect.fnUntraced(function* () {
      expect(yield* decodeHttpsUrl("https://example.com/api/v1")).toBe("https://example.com/api/v1");
      expect(yield* decodeHttpsUrl("https://localhost:8443/path?ready=true#status")).toBe(
        "https://localhost:8443/path?ready=true#status"
      );
    })
  );

  it.effect(
    "rejects non-https and malformed URL strings",
    Effect.fnUntraced(function* () {
      const httpError = yield* Effect.flip(decodeHttpsUrl("http://example.com"));
      const malformedError = yield* Effect.flip(decodeHttpsUrl("A:!"));

      expect(httpError.message).toContain("URL must use the https protocol");
      expect(malformedError.message).toContain("URL must use the https protocol");
    })
  );
});
