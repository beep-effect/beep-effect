import {
  LoggingConfig,
  layerConsoleLogger,
  layerMinimumLogLevel,
  PrettyLoggerConfig,
  RenderLogBannerOptions,
  renderLogBanner,
} from "@beep/observability";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it as loggerSubjectIt } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tracer from "effect/Tracer";

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

class CapturedSpanEvents extends Context.Service<CapturedSpanEvents, Array<string>>()(
  "@beep/observability/test/Logging.test/CapturedSpanEvents"
) {}

const capturedSpanEventsLayer: Layer.Layer<CapturedSpanEvents> = Layer.unwrap(
  Effect.sync(() => {
    const events: Array<string> = [];
    const recordingTracer = Layer.effect(
      Tracer.Tracer,
      Effect.map(Effect.tracer, (current) =>
        Tracer.make({
          span(options) {
            const span = current.span(options);
            const originalEvent = span.event;
            span.event = function (this: Tracer.Span, name, startTime, attributes) {
              events.push(name);
              return originalEvent.call(this, name, startTime, attributes);
            };
            return span;
          },
          context: current.context,
        })
      )
    );
    return Layer.mergeAll(
      Layer.succeed(CapturedSpanEvents, events),
      recordingTracer,
      layerConsoleLogger(LoggingConfig.make({ format: "string", minLogLevel: "Info" }))
    );
  })
);

describe("Logging", () => {
  it("returns a layer from the one-argument data-first call", () => {
    const config = LoggingConfig.make({ format: "json", minLogLevel: "Info" });

    expect(Layer.isLayer(layerConsoleLogger(config))).toBe(true);
    expect(Layer.isLayer(layerConsoleLogger(config, PrettyLoggerConfig.make({})))).toBe(true);
    expect(Layer.isLayer(layerConsoleLogger()(config))).toBe(true);
  });

  // The console logger layer is the subject: runner lifecycle logs would add span events.
  loggerSubjectIt.layer(capturedSpanEventsLayer, { timeout: "10 seconds" })(
    "keeps the tracer bridge in the console logger layer",
    (it) =>
      it.effect(
        "records log lines as events on the current span",
        Effect.fnUntraced(function* () {
          const events = yield* CapturedSpanEvents;
          yield* Effect.logInfo("bridged to span").pipe(Effect.withSpan("console-logger"));

          expect(events).toStrictEqual(["bridged to span"]);
        })
      )
  );

  it("keeps pretty logger constructor defaults on the schema", () => {
    const pretty = PrettyLoggerConfig.make({});

    expect(pretty.theme).toBe("ocean");
    expect(pretty.bannerMode).toBe("off");
    assertSome(encodePrettyLoggerConfigOption(pretty), {
      theme: "ocean",
      bannerMode: "off",
    });
  });

  it.prop(
    "round-trips schema-derived pretty logger configs",
    [Arbitrary.schema(PrettyLoggerConfig)],
    ([pretty]) => {
      const decoded = O.flatMap(encodePrettyLoggerConfigOption(pretty), decodeUnknownPrettyLoggerConfigOption);
      expect(O.exists(decoded, (value) => Equal.equals(value, pretty))).toBe(true);

      return true;
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "round-trips schema-derived banner options",
    [Arbitrary.schema(RenderLogBannerOptions)],
    ([options]) => {
      const decoded = O.flatMap(encodeRenderLogBannerOptionsOption(options), decodeUnknownRenderLogBannerOptionsOption);
      expect(O.exists(decoded, (value) => Equal.equals(value, options))).toBe(true);

      return true;
    },
    { arbitrary: fcRuns(50) }
  );

  it("renders with default pretty config when options omit it", () => {
    expect(renderLogBanner("Server Ready", { kind: "startup" })).toBe("Server Ready");
  });

  it("renders a banner only for the configured kind", () => {
    const shown = renderLogBanner("Ready", {
      kind: "startup",
      pretty: PrettyLoggerConfig.make({ theme: "ocean", bannerMode: "all" }),
    });
    const startupSkipsPhase = renderLogBanner("Ready", {
      kind: "phase",
      pretty: PrettyLoggerConfig.make({ theme: "mono", bannerMode: "startup" }),
    });
    const phaseShown = renderLogBanner("Ready", {
      kind: "phase",
      pretty: PrettyLoggerConfig.make({ theme: "forest", bannerMode: "phase" }),
    });

    expect(shown).toContain("READY");
    expect(startupSkipsPhase).toBe("Ready");
    expect(phaseShown).toContain("READY");
  });

  // This layer's logger is the subject: runner lifecycle logs would alter its exact captures.
  loggerSubjectIt.layer(capturedLevelsLayer("Info"), { timeout: "10 seconds" })(
    "filters logs through the independently composable minimum-level layer",
    (it) =>
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

  loggerSubjectIt.layer(capturedLevelsLayer("None"), { timeout: "10 seconds" })(
    "filters every log at the None level",
    (it) =>
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
