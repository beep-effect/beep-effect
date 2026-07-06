import { ConsoleErrorReporterOptions, ErrorReporterLayerOptions } from "@beep/observability/server";
import { Equal } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

describe("ErrorReporting", () => {
  it("keeps reporter option defaults on the schema", () => {
    expect(ConsoleErrorReporterOptions.make({}).includeCause).toBe(true);
    expect(ErrorReporterLayerOptions.make({}).includeCause).toBe(true);
    expect(ErrorReporterLayerOptions.make({}).mergeWithExisting).toBe(true);
  });

  it("round-trips schema-derived reporter options", () => {
    fc.assert(
      fc.property(S.toArbitrary(ConsoleErrorReporterOptions), (options) => {
        const decoded = O.flatMap(
          S.encodeOption(ConsoleErrorReporterOptions)(options),
          S.decodeUnknownOption(ConsoleErrorReporterOptions)
        );
        expect(O.exists(decoded, (value) => Equal.equals(value, options))).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  it("round-trips schema-derived reporter layer options", () => {
    fc.assert(
      fc.property(S.toArbitrary(ErrorReporterLayerOptions), (options) => {
        const decoded = O.flatMap(
          S.encodeOption(ErrorReporterLayerOptions)(options),
          S.decodeUnknownOption(ErrorReporterLayerOptions)
        );
        expect(O.exists(decoded, (value) => Equal.equals(value, options))).toBe(true);
      }),
      { numRuns: 50 }
    );
  });
});
