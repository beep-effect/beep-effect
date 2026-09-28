import { ConsoleErrorReporterOptions, ErrorReporterLayerOptions } from "@beep/observability/server";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { Equal } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as S from "effect/Schema";

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

  it.prop(
    "round-trips schema-derived reporter options",
    [Arbitrary.schema(ConsoleErrorReporterOptions)],
    ([options]) => {
      const decoded = O.flatMap(
        encodeConsoleErrorReporterOptionsOption(options),
        decodeUnknownConsoleErrorReporterOptionsOption
      );
      expect(O.exists(decoded, (value) => Equal.equals(value, options))).toBe(true);

      return true;
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "round-trips schema-derived reporter layer options",
    [Arbitrary.schema(ErrorReporterLayerOptions)],
    ([options]) => {
      const decoded = O.flatMap(
        encodeErrorReporterLayerOptionsOption(options),
        decodeUnknownErrorReporterLayerOptionsOption
      );
      expect(O.exists(decoded, (value) => Equal.equals(value, options))).toBe(true);

      return true;
    },
    { arbitrary: fcRuns(50) }
  );
});
