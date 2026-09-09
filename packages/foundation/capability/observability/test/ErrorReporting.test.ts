import { ConsoleErrorReporterOptions, ErrorReporterLayerOptions } from "@beep/observability/server";
import { fcRuns } from "@beep/test-utils";
import { Equal } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

const decodeUnknownConsoleErrorReporterOptionsOption = S.decodeUnknownOption(ConsoleErrorReporterOptions);
const decodeUnknownErrorReporterLayerOptionsOption = S.decodeUnknownOption(ErrorReporterLayerOptions);
const encodeConsoleErrorReporterOptionsOption = S.encodeOption(ConsoleErrorReporterOptions);
const encodeErrorReporterLayerOptionsOption = S.encodeOption(ErrorReporterLayerOptions);

describe("ErrorReporting", () => {
  it("keeps reporter option defaults on the schema", () => {
    expect(ConsoleErrorReporterOptions.make({}).includeCause).toBe(true);
    expect(ErrorReporterLayerOptions.make({}).includeCause).toBe(true);
    expect(ErrorReporterLayerOptions.make({}).mergeWithExisting).toBe(true);
  });

  it("round-trips schema-derived reporter options", () => {
    fc.assert(
      fc.property(S.toArbitrary(ConsoleErrorReporterOptions)(fc), (options) => {
        const decoded = O.flatMap(
          encodeConsoleErrorReporterOptionsOption(options),
          decodeUnknownConsoleErrorReporterOptionsOption
        );
        expect(O.exists(decoded, (value) => Equal.equals(value, options))).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it("round-trips schema-derived reporter layer options", () => {
    fc.assert(
      fc.property(S.toArbitrary(ErrorReporterLayerOptions)(fc), (options) => {
        const decoded = O.flatMap(
          encodeErrorReporterLayerOptionsOption(options),
          decodeUnknownErrorReporterLayerOptionsOption
        );
        expect(O.exists(decoded, (value) => Equal.equals(value, options))).toBe(true);
      }),
      fcRuns(50)
    );
  });
});
