import { HttpsUrl, URLStr } from "@beep/schema/URL";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import { FastCheck as fc } from "effect/testing";

describe("URL", () => {
  const decodeHttpsUrl = S.decodeUnknownEffect(HttpsUrl);

  it("publishes a canonical arbitrary for URL strings", () => {
    expect(SchemaAST.resolve(URLStr.ast)?.toArbitrary).toBeDefined();
    expect(fc.sample(S.toArbitrary(URLStr)(fc), { numRuns: 20, seed: 0x5eed }).every(URLStr.is)).toBe(true);
  });

  it("publishes codec statics and a canonical arbitrary for HTTPS URLs", () => {
    expect(SchemaAST.resolve(HttpsUrl.ast)?.toArbitrary).toBeDefined();
    expect(fc.sample(S.toArbitrary(HttpsUrl)(fc), { numRuns: 20, seed: 0x5eed }).every(HttpsUrl.is)).toBe(true);
    expect(HttpsUrl.fromUnknown("https://example.com/resource")).toBe("https://example.com/resource");
  });

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
