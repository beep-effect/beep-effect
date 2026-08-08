/**
 * Configurable console logging layer for Effect applications.
 *
 * Supports multiple output formats (`pretty`, `structured`, `json`, `logfmt`,
 * `string`) and themeable pretty-printing with ANSI colors.
 *
 * @example
 * ```typescript
 * import { Effect, Layer } from "effect"
 * import { LoggingConfig, layerConsoleLogger } from "@beep/observability"
 *
 * const config = LoggingConfig.make({ format: "pretty", minLogLevel: "Info" })
 * const loggerLayer = layerConsoleLogger(config)
 *
 * const program = Effect.log("hello from pretty logger").pipe(
 *
 * )
 *
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import bc from "@beep/colors";
import { $ObservabilityId } from "@beep/identity/packages";
import { LiteralKit, LogLevel } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Cause, Effect, Inspectable, Layer, Logger, Match, References } from "effect";
import { dual } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $ObservabilityId.create("Logging");

/**
 * Supported console logger formats for shared observability wiring.
 *
 * @example
 * ```typescript
 * import { LoggingConfig, layerConsoleLogger } from "@beep/observability"
 *
 * const config = LoggingConfig.make({ format: "json", minLogLevel: "Debug" })
 * console.log(layerConsoleLogger(config))
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const LogFormat = LiteralKit(["pretty", "structured", "json", "logfmt", "string"]).pipe(
  $I.annoteSchema("LogFormat", {
    description: "Supported console logger formats for shared observability wiring.",
  })
);

/**
 * Runtime type for {@link LogFormat}.
 *
 * @example
 * ```typescript
 * import type { LogFormat } from "@beep/observability"
 *
 * const format: LogFormat = "json"
 * console.log(format)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LogFormat = typeof LogFormat.Type;

/**
 * Theme palette for the custom pretty logger: `"ocean"`, `"forest"`, `"sunrise"`, or `"mono"`.
 *
 * @example
 * ```typescript
 * import { PrettyLoggerConfig } from "@beep/observability"
 *
 * const config = PrettyLoggerConfig.make({ theme: "forest", bannerMode: "off" })
 * console.log(config.theme)// "forest"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const PrettyLogTheme = LiteralKit(["ocean", "forest", "sunrise", "mono"]).pipe(
  $I.annoteSchema("PrettyLogTheme", {
    description: "Theme palette for the custom pretty logger.",
  })
);

/**
 * Runtime type for {@link PrettyLogTheme}.
 *
 * @example
 * ```typescript
 * import type { PrettyLogTheme } from "@beep/observability"
 *
 * const theme: PrettyLogTheme = "forest"
 * console.log(theme)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PrettyLogTheme = typeof PrettyLogTheme.Type;

/**
 * Banner render modes for startup and phase summaries: `"off"`, `"startup"`, `"phase"`, or `"all"`.
 *
 * @example
 * ```typescript
 * import { PrettyLoggerConfig } from "@beep/observability"
 *
 * const config = PrettyLoggerConfig.make({ theme: "ocean", bannerMode: "startup" })
 * console.log(config.bannerMode)// "startup"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export const BannerMode = LiteralKit(["off", "startup", "phase", "all"]).pipe(
  $I.annoteSchema("BannerMode", {
    description: "Banner render modes for startup and phase summaries.",
  })
);

/**
 * Runtime type for {@link BannerMode}.
 *
 * @example
 * ```typescript
 * import type { BannerMode } from "@beep/observability"
 *
 * const mode: BannerMode = "startup"
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BannerMode = typeof BannerMode.Type;

/**
 * Extra configuration for the custom pretty logger including theme and banner mode.
 *
 * @example
 * ```typescript
 * import { PrettyLoggerConfig } from "@beep/observability"
 *
 * const config = PrettyLoggerConfig.make({
 *   theme: "forest",
 *   bannerMode: "off",
 * })
 *
 * console.log(config.theme)// "forest"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class PrettyLoggerConfig extends S.Class<PrettyLoggerConfig>($I`PrettyLoggerConfig`)(
  {
    theme: PrettyLogTheme.pipe(S.withConstructorDefault(Effect.succeed(PrettyLogTheme.Enum.ocean))),
    bannerMode: BannerMode.pipe(S.withConstructorDefault(Effect.succeed(BannerMode.Enum.off))),
  },
  $I.annote("PrettyLoggerConfig", {
    description: "Extra configuration for the custom pretty logger.",
  })
) {}

/**
 * Shared logger configuration for browser-safe and server-safe console logging.
 *
 * @example
 * ```typescript
 * import { LoggingConfig } from "@beep/observability"
 *
 * const config = LoggingConfig.make({
 *   format: "structured",
 *   minLogLevel: "Info",
 * })
 *
 * console.log(config.format)// "structured"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class LoggingConfig extends S.Class<LoggingConfig>($I`LoggingConfig`)(
  {
    format: LogFormat,
    minLogLevel: LogLevel,
  },
  $I.annote("LoggingConfig", {
    description: "Shared logger configuration for browser-safe and server-safe console logging.",
  })
) {}

/**
 * Install only the Effect runtime minimum log level.
 *
 * Unlike {@link layerConsoleLogger}, this layer does not replace or add any
 * logger, so it is safe to compose with OTLP logger layers that merge with the
 * existing runtime logger set.
 *
 * @example
 * ```typescript
 * import { layerMinimumLogLevel } from "@beep/observability"
 * import { Effect } from "effect"
 *
 * const program = Effect.logInfo("visible").pipe(
 *   Effect.provide(layerMinimumLogLevel("Info"))
 * )
 * console.log(program)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const layerMinimumLogLevel = (minLogLevel: LogLevel): Layer.Layer<never> =>
  Layer.succeed(References.MinimumLogLevel, minLogLevel);

/**
 * Options controlling startup/phase log banner rendering.
 *
 * @example
 * ```typescript
 * import { RenderLogBannerOptions } from "@beep/observability"
 *
 * const options = RenderLogBannerOptions.make({ kind: "startup" })
 * console.log(options.kind)
 * // "startup"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RenderLogBannerOptions extends S.Class<RenderLogBannerOptions>($I`RenderLogBannerOptions`)(
  {
    kind: S.Literals(["phase", "startup"]).pipe(S.optionalKey).annotateKey({
      description: "Banner kind used to decide whether the configured banner mode applies.",
    }),
    pretty: S.optionalKey(PrettyLoggerConfig).annotateKey({
      description: "Pretty logger rendering configuration.",
    }),
  },
  $I.annote("RenderLogBannerOptions", {
    description: "Options controlling startup and phase banner rendering.",
  })
) {}

type PaletteFn = (value: string) => string;

type MakePrettyPalette<T extends ReadonlyArray<string>> = {
  readonly [K in T[number]]: PaletteFn;
};
type PrettyPalette = MakePrettyPalette<["accent", "dim", "trace", "debug", "info", "warn", "error", "fatal"]>;

const defaultPrettyLoggerConfig = PrettyLoggerConfig.make({});

const themePalette = (theme: PrettyLogTheme): PrettyPalette =>
  Match.value(theme).pipe(
    Match.when("forest", () => ({
      accent: bc.green,
      dim: bc.dim,
      trace: bc.gray,
      debug: bc.cyan,
      info: bc.green,
      warn: bc.yellow,
      error: bc.red,
      fatal: (value: string) => bc.bgRed(bc.white(value)),
    })),
    Match.when("sunrise", () => ({
      accent: bc.yellow,
      dim: bc.dim,
      trace: bc.gray,
      debug: bc.magenta,
      info: bc.blue,
      warn: bc.yellow,
      error: bc.red,
      fatal: (value: string) => bc.bgRed(bc.white(value)),
    })),
    Match.when("mono", () => ({
      accent: bc.white,
      dim: bc.dim,
      trace: bc.dim,
      debug: bc.white,
      info: bc.white,
      warn: bc.white,
      error: bc.white,
      fatal: bc.white,
    })),
    Match.when("ocean", () => ({
      accent: bc.cyan,
      dim: bc.dim,
      trace: bc.gray,
      debug: bc.blue,
      info: bc.cyan,
      warn: bc.yellow,
      error: bc.red,
      fatal: (value: string) => bc.bgRed(bc.white(value)),
    })),
    Match.exhaustive
  );

const levelColor = (palette: PrettyPalette, level: LogLevel) =>
  Match.value(level).pipe(
    Match.when("Trace", () => palette.trace(level)),
    Match.when("Debug", () => palette.debug(level)),
    Match.when("Info", () => palette.info(level)),
    Match.when("Warn", () => palette.warn(level)),
    Match.when("Error", () => palette.error(level)),
    Match.when("Fatal", () => palette.fatal(level)),
    Match.orElse(() => palette.dim(level))
  );

const renderMessage = (message: unknown | ReadonlyArray<unknown>): string => {
  const values = A.isArray(message) ? message : A.make(message);
  return A.join(
    A.map(values, (value) => Inspectable.toStringUnknown(value, 2)),
    " "
  );
};

const renderBannerGlyph = (kind: "phase" | "startup"): string => (kind === "phase" ? "<>" : "[]");

/**
 * Render an opt-in banner for startup and phase summaries.
 *
 * Returns a plain title when the banner mode is `"off"` or does not match
 * the requested kind. Otherwise renders a themed ASCII banner with glyphs.
 *
 * @example
 * ```typescript
 * import { renderLogBanner, PrettyLoggerConfig } from "@beep/observability"
 *
 * const pretty = PrettyLoggerConfig.make({ theme: "ocean", bannerMode: "all" })
 * const banner = renderLogBanner("Server Ready", { kind: "startup", pretty })
 * console.log(banner)
 * ```
 *
 * @since 0.0.0
 * @category observability
 */
export const renderLogBanner: {
  (title: string, options?: RenderLogBannerOptions): string;
  (options?: RenderLogBannerOptions): (title: string) => string;
} = dual(2, (title: string, options?: RenderLogBannerOptions): string => {
  const pretty = options?.pretty ?? defaultPrettyLoggerConfig;
  const kind = options?.kind ?? "startup";

  if (
    pretty.bannerMode === "off" ||
    (pretty.bannerMode === "startup" && kind !== "startup") ||
    (pretty.bannerMode === "phase" && kind !== "phase")
  ) {
    return title;
  }

  const palette = themePalette(pretty.theme);
  const glyph = renderBannerGlyph(kind);
  const bannerGlyphs = Str.repeat(glyph, 4);
  const line = palette.accent(`${bannerGlyphs} ${Str.toUpperCase(title)} ${bannerGlyphs}`);
  return A.join(A.make(line, palette.dim(Str.repeat("-", Math.max(12, title.length + 10)))), "\n");
});

const makePrettyConsoleLogger = (pretty: PrettyLoggerConfig): Logger.Logger<unknown, void> => {
  const palette = themePalette(pretty.theme);

  return Logger.withConsoleLog(
    Logger.make((options) => {
      const timestamp = palette.dim(options.date.toISOString());
      const level = levelColor(palette, options.logLevel);
      const message = palette.accent(renderMessage(options.message));
      const annotations = options.fiber.getRef(References.CurrentLogAnnotations);
      const logSpans = options.fiber.getRef(References.CurrentLogSpans);
      const renderedAnnotations =
        R.keys(annotations).length === 0 ? "" : ` ${palette.dim(Inspectable.toStringUnknown(annotations, 2))}`;
      const renderedSpans =
        logSpans.length === 0
          ? ""
          : ` ${palette.dim(
              Inspectable.toStringUnknown(
                A.map(logSpans, ([label, startedAt]) => ({
                  label,
                  elapsedMs: Math.max(0, options.date.getTime() - startedAt),
                })),
                2
              )
            )}`;
      const renderedCause = options.cause.reasons.length === 0 ? "" : `\n${palette.dim(Cause.pretty(options.cause))}`;

      return `${timestamp} ${level} ${message}${renderedAnnotations}${renderedSpans}${renderedCause}`;
    })
  );
};

const resolveLogger = (format: LogFormat, pretty = defaultPrettyLoggerConfig) =>
  Match.value(format).pipe(
    Match.when("pretty", () => makePrettyConsoleLogger(pretty)),
    Match.when("structured", () => Logger.consoleStructured),
    Match.when("json", () => Logger.consoleJson),
    Match.when("logfmt", () => Logger.consoleLogFmt),
    Match.when("string", () => Logger.withConsoleLog(Logger.formatSimple)),
    Match.exhaustive
  );

/**
 * Build a console logger layer from a shared logging config.
 *
 * Returns a `Layer<never>` that replaces the default Effect logger with the
 * configured format and sets the minimum log level.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import { LoggingConfig, layerConsoleLogger } from "@beep/observability"
 *
 * const config = LoggingConfig.make({ format: "json", minLogLevel: "Info" })
 * const layer = layerConsoleLogger(config)
 *
 * const program = Effect.log("structured output").pipe(
 *
 * )
 *
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const layerConsoleLogger: {
  (config: LoggingConfig, pretty?: PrettyLoggerConfig): Layer.Layer<never>;
  (pretty?: PrettyLoggerConfig): (config: LoggingConfig) => Layer.Layer<never>;
} = dual(
  2,
  (config: LoggingConfig, pretty: PrettyLoggerConfig = defaultPrettyLoggerConfig): Layer.Layer<never> =>
    Layer.mergeAll(Logger.layer([resolveLogger(config.format, pretty)]), layerMinimumLogLevel(config.minLogLevel))
);
