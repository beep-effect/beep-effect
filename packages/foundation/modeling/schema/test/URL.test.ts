import { HttpsUrl, URLStr } from "@beep/schema/URL";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownHttpsUrl = S.decodeUnknownEffect(HttpsUrl);

describe("URL", () => {
  it("publishes a canonical arbitrary for URL strings", () => {
    expect(
      Effect.runSync(Arbitrary.sampleEffect(Arbitrary.schema(URLStr), { count: 20, seed: 0x5eed })).every(URLStr.is)
    ).toBe(true);
  });

  it("publishes codec statics and a canonical arbitrary for HTTPS URLs", () => {
    expect(
      Effect.runSync(Arbitrary.sampleEffect(Arbitrary.schema(HttpsUrl), { count: 20, seed: 0x5eed })).every(HttpsUrl.is)
    ).toBe(true);
    expect(HttpsUrl.decodeUnknownSync("https://example.com/resource")).toBe("https://example.com/resource");
  });

  it.effect(
    "accepts valid https URL strings",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownHttpsUrl("https://example.com/api/v1")).toBe("https://example.com/api/v1");
      expect(yield* decodeUnknownHttpsUrl("https://localhost:8443/path?ready=true#status")).toBe(
        "https://localhost:8443/path?ready=true#status"
      );
    })
  );

  it.effect(
    "rejects non-https and malformed URL strings",
    Effect.fnUntraced(function* () {
      const httpError = yield* Effect.flip(decodeUnknownHttpsUrl("http://example.com"));
      const malformedError = yield* Effect.flip(decodeUnknownHttpsUrl("A:!"));

      expect(httpError.message).toContain("URL must use the https protocol");
      expect(malformedError.message).toContain("URL must use the https protocol");
    })
  );
});
