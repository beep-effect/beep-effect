import { HttpsUrl, URLStr } from "@beep/schema/URL";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Array as A, Effect } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownHttpsUrl = S.decodeUnknownEffect(HttpsUrl);

describe("URL", () => {
  it.effect(
    "publishes a canonical arbitrary for URL strings",
    Effect.fnUntraced(function* () {
      const samples = yield* Arbitrary.sampleEffect(Arbitrary.schema(URLStr), { count: 20, seed: 0x5eed });
      A.forEach(samples, (sample, index) => {
        assertTrue(URLStr.is(sample), `URLStr sample ${index}: ${sample}`);
      });
    })
  );

  it.effect(
    "publishes codec statics and a canonical arbitrary for HTTPS URLs",
    Effect.fnUntraced(function* () {
      const samples = yield* Arbitrary.sampleEffect(Arbitrary.schema(HttpsUrl), { count: 20, seed: 0x5eed });
      A.forEach(samples, (sample, index) => {
        assertTrue(HttpsUrl.is(sample), `HttpsUrl sample ${index}: ${sample}`);
      });
      expect(HttpsUrl.decodeUnknownSync("https://example.com/resource")).toBe("https://example.com/resource");
    })
  );

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
