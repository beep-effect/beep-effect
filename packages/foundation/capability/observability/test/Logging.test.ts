import { layerMinimumLogLevel, PrettyLoggerConfig, RenderLogBannerOptions, renderLogBanner } from "@beep/observability";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Equal, Layer, Logger } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeUnknownPrettyLoggerConfigOption = S.decodeUnknownOption(PrettyLoggerConfig);
const decodeUnknownRenderLogBannerOptionsOption = S.decodeUnknownOption(RenderLogBannerOptions);
const encodePrettyLoggerConfigOption = S.encodeOption(PrettyLoggerConfig);
const encodeRenderLogBannerOptionsOption = S.encodeOption(RenderLogBannerOptions);

class CapturedLevels extends Context.Service<CapturedLevels, Array<string>>()(
  "@beep/observability/test/Logging.test/CapturedLevels"
) {}

const capturedLevelsLayer = (minimumLevel: "Info" | "None"): Layer.Layer<CapturedLevels> => {
  const levels: Array<string> = [];
  const logger = Logger.make<unknown, void>((options) => {
    levels.push(options.logLevel);
  });
  return Layer.mergeAll(
    Layer.succeed(CapturedLevels, levels),
    Logger.layer([logger]),
    layerMinimumLogLevel(minimumLevel)
  );
};

describe("Logging", () => {
  it("keeps pretty logger constructor defaults on the schema", () => {
    const pretty = PrettyLoggerConfig.make({});

    expect(pretty.theme).toBe("ocean");
    expect(pretty.bannerMode).toBe("off");
    expect(encodePrettyLoggerConfigOption(pretty)).toStrictEqual(
      O.some({
        theme: "ocean",
        bannerMode: "off",
      })
    );
  });

  it("round-trips schema-derived pretty logger configs", () => {
    fc.assert(
      fc.property(S.toArbitrary(PrettyLoggerConfig)(fc), (pretty) => {
        const decoded = O.flatMap(encodePrettyLoggerConfigOption(pretty), decodeUnknownPrettyLoggerConfigOption);
        expect(O.exists(decoded, (value) => Equal.equals(value, pretty))).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it("round-trips schema-derived banner options", () => {
    fc.assert(
      fc.property(S.toArbitrary(RenderLogBannerOptions)(fc), (options) => {
        const decoded = O.flatMap(
          encodeRenderLogBannerOptionsOption(options),
          decodeUnknownRenderLogBannerOptionsOption
        );
        expect(O.exists(decoded, (value) => Equal.equals(value, options))).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it("renders with default pretty config when options omit it", () => {
    expect(renderLogBanner("Server Ready", { kind: "startup" })).toBe("Server Ready");
  });

  it.layer(capturedLevelsLayer("Info"))("filters logs through the independently composable minimum-level layer", (it) =>
    it.effect(
      "keeps Info and above",
      Effect.fnUntraced(function* () {
        const levels = yield* CapturedLevels;
        yield* Effect.all(
          [Effect.logDebug("debug"), Effect.logInfo("info"), Effect.logWarning("warn"), Effect.logError("error")],
          { discard: true }
        );

        expect(levels).toStrictEqual(["Info", "Warn", "Error"]);
      })
    )
  );

  it.layer(capturedLevelsLayer("None"))("filters every log at the None level", (it) =>
    it.effect(
      "captures no records",
      Effect.fnUntraced(function* () {
        const levels = yield* CapturedLevels;
        yield* Effect.logError("hidden");
        expect(levels).toStrictEqual([]);
      })
    )
  );
});
