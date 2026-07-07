/**
 * Console-backed server error reporting helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import bc from "@beep/colors";
import { $ObservabilityId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { ErrorReporter, Inspectable, Match, pipe } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { renderObservedCause, summarizeCause } from "../CauseDiagnostics.ts";

const $I = $ObservabilityId.create("server/ErrorReporting");

const writeErrorLine = (line: string): void => {
  globalThis.process.stderr.write(`${line}\n`);
};

/**
 * Options for the console-backed error reporter.
 *
 * @since 0.0.0
 * @category models
 */
export class ConsoleErrorReporterOptions extends S.Class<ConsoleErrorReporterOptions>($I`ConsoleErrorReporterOptions`)(
  {
    includeCause: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)).annotateKey({
      description: "Whether to render the pretty Effect cause after the error line.",
    }),
  },
  $I.annote("ConsoleErrorReporterOptions", {
    description: "Options for the console-backed error reporter.",
  })
) {}

/**
 * Options for registering the console-backed error reporter layer.
 *
 * @since 0.0.0
 * @category models
 */
export class ErrorReporterLayerOptions extends S.Class<ErrorReporterLayerOptions>($I`ErrorReporterLayerOptions`)(
  {
    includeCause: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)).annotateKey({
      description: "Whether the registered reporter should render the pretty Effect cause.",
    }),
    mergeWithExisting: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true)).annotateKey({
      description: "Whether to merge this reporter with already registered reporters.",
    }),
  },
  $I.annote("ErrorReporterLayerOptions", {
    description: "Options for registering the console-backed error reporter layer.",
  })
) {}

/**
 * Create a console-backed error reporter with cause fingerprints and pretty rendering.
 *
 * @example
 * ```typescript
 * import { makeConsoleErrorReporter } from "@beep/observability/server"
 *
 * const reporter = makeConsoleErrorReporter({ includeCause: true })
 * console.log(reporter)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const makeConsoleErrorReporter = (options?: ConsoleErrorReporterOptions): ErrorReporter.ErrorReporter => {
  const resolvedOptions = ConsoleErrorReporterOptions.make(options ?? {});

  return ErrorReporter.make(({ cause, error, severity, attributes }) => {
    const summary = summarizeCause(cause);
    const severityColor = Match.value(severity).pipe(
      Match.when("Fatal", () => bc.bgRed(bc.white(` ${severity} `))),
      Match.when("Error", () => bc.red(severity)),
      Match.when("Warn", () => bc.yellow(severity)),
      Match.when("Info", () => bc.cyan(severity)),
      Match.when("Debug", () => bc.gray(severity)),
      Match.when("Trace", () => bc.dim(severity)),
      Match.exhaustive
    );

    writeErrorLine(
      `${severityColor} ${error.name}: ${error.message} fingerprint=${summary.fingerprint.value} classification=${summary.classification}`
    );

    if (R.keys(attributes).length > 0) {
      writeErrorLine(Inspectable.toStringUnknown(attributes, 2));
    }

    if (resolvedOptions.includeCause) {
      writeErrorLine(pipe(cause, renderObservedCause));
    }
  });
};

/**
 * Register a console-backed error reporter.
 *
 * @example
 * ```typescript
 * import { Layer } from "effect"
 * import { ErrorReporterLayerOptions, layerErrorReporter } from "@beep/observability/server"
 *
 * const ErrorReporterLive = layerErrorReporter(ErrorReporterLayerOptions.make({ includeCause: true }))
 * console.log(ErrorReporterLive)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const layerErrorReporter = (options?: ErrorReporterLayerOptions) => {
  const resolvedOptions = ErrorReporterLayerOptions.make(options ?? {});

  return ErrorReporter.layer([makeConsoleErrorReporter({ includeCause: resolvedOptions.includeCause })], {
    mergeWithExisting: resolvedOptions.mergeWithExisting,
  });
};
