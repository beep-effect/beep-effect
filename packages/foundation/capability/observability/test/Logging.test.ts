import { PrettyLoggerConfig, RenderLogBannerOptions, renderLogBanner } from "@beep/observability";
import { Equal } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

describe("Logging", () => {
  it("keeps pretty logger constructor defaults on the schema", () => {
    const pretty = PrettyLoggerConfig.make({});

    expect(pretty.theme).toBe("ocean");
    expect(pretty.bannerMode).toBe("off");
    expect(S.encodeOption(PrettyLoggerConfig)(pretty)).toStrictEqual(
      O.some({
        theme: "ocean",
        bannerMode: "off",
      })
    );
  });

  it("round-trips schema-derived pretty logger configs", () => {
    fc.assert(
      fc.property(S.toArbitrary(PrettyLoggerConfig), (pretty) => {
        const decoded = O.flatMap(
          S.encodeOption(PrettyLoggerConfig)(pretty),
          S.decodeUnknownOption(PrettyLoggerConfig)
        );
        expect(O.exists(decoded, (value) => Equal.equals(value, pretty))).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  it("round-trips schema-derived banner options", () => {
    fc.assert(
      fc.property(S.toArbitrary(RenderLogBannerOptions), (options) => {
        const decoded = O.flatMap(
          S.encodeOption(RenderLogBannerOptions)(options),
          S.decodeUnknownOption(RenderLogBannerOptions)
        );
        expect(O.exists(decoded, (value) => Equal.equals(value, options))).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  it("renders with default pretty config when options omit it", () => {
    expect(renderLogBanner("Server Ready", { kind: "startup" })).toBe("Server Ready");
  });
});
