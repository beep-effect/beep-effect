import { ConsoleErrorReporterOptions, ErrorReporterLayerOptions } from "@beep/observability/server";
import { fcRuns } from "@beep/test-utils";
import { Effect, Equal } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
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
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(ConsoleErrorReporterOptions)]),
          ([options]) => {
            const decoded = O.flatMap(
              encodeConsoleErrorReporterOptionsOption(options),
              decodeUnknownConsoleErrorReporterOptionsOption
            );
            expect(O.exists(decoded, (value) => Equal.equals(value, options))).toBe(true);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed");
  });

  it("round-trips schema-derived reporter layer options", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([Arbitrary.schema(ErrorReporterLayerOptions)]),
          ([options]) => {
            const decoded = O.flatMap(
              encodeErrorReporterLayerOptionsOption(options),
              decodeUnknownErrorReporterLayerOptionsOption
            );
            expect(O.exists(decoded, (value) => Equal.equals(value, options))).toBe(true);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed");
  });
});
