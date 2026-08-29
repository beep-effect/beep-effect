/**
 * Typed technical errors for the Firecrawl driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FirecrawlId } from "@beep/identity/packages";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { Effect, flow, pipe, Result } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $FirecrawlId.create("Firecrawl.errors");

/**
 * Firecrawl SDK methods wrapped by this driver.
 *
 * @example
 * ```ts
 * import { FirecrawlMethodName } from "@beep/firecrawl"
 *
 * console.log(FirecrawlMethodName.is.scrape("scrape"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlMethodName = LiteralKit([
  "scrape",
  "interact",
  "stopInteraction",
  "parse",
  "search",
  "map",
  "startCrawl",
  "getCrawlStatus",
  "cancelCrawl",
  "crawl",
  "getCrawlErrors",
  "getActiveCrawls",
  "crawlParamsPreview",
  "createMonitor",
  "listMonitors",
  "getMonitor",
  "updateMonitor",
  "deleteMonitor",
  "runMonitor",
  "listMonitorChecks",
  "getMonitorCheck",
  "startBatchScrape",
  "getBatchScrapeStatus",
  "getBatchScrapeErrors",
  "cancelBatchScrape",
  "batchScrape",
  "startAgent",
  "getAgentStatus",
  "agent",
  "cancelAgent",
  "browser",
  "browserExecute",
  "deleteBrowser",
  "listBrowsers",
  "getConcurrency",
  "getCreditUsage",
  "getTokenUsage",
  "getCreditUsageHistorical",
  "getTokenUsageHistorical",
  "getQueueStatus",
  "watcher",
]).pipe(
  $I.annoteSchema("FirecrawlMethodName", {
    description: "Firecrawl SDK methods wrapped by the Firecrawl technical driver.",
  })
);

/**
 * Type for {@link FirecrawlMethodName}.
 *
 * @example
 * ```ts
 * import type { FirecrawlMethodName } from "@beep/firecrawl"
 *
 * const method: FirecrawlMethodName = "scrape"
 * console.log(method)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlMethodName = typeof FirecrawlMethodName.Type;

/**
 * Technical error reasons emitted by the Firecrawl driver.
 *
 * @example
 * ```ts
 * import { FirecrawlErrorReason } from "@beep/firecrawl"
 *
 * console.log(FirecrawlErrorReason.is.transport("transport"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlErrorReason = LiteralKit([
  "config",
  "request encoding",
  "response decoding",
  "response status",
  "transport",
  "sdk thrown",
  "schema decoding",
  "watcher",
  "timeout",
  "interrupted",
]).pipe(
  $I.annoteSchema("FirecrawlErrorReason", {
    description: "Redacted technical error reasons emitted by the Firecrawl driver.",
  })
);

/**
 * Type for {@link FirecrawlErrorReason}.
 *
 * @example
 * ```ts
 * import type { FirecrawlErrorReason } from "@beep/firecrawl"
 *
 * const reason: FirecrawlErrorReason = "response status"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlErrorReason = typeof FirecrawlErrorReason.Type;

/**
 * Decoded Firecrawl API failure body.
 *
 * @example
 * ```ts
 * import { FirecrawlApiFailure } from "@beep/firecrawl"
 * import * as O from "effect/Option"
 *
 * const failure = FirecrawlApiFailure.make({
 *   code: O.none(),
 *   details: O.none(),
 *   error: "Unauthorized",
 *   status: O.none(),
 *   success: false
 * })
 *
 * console.log(failure.error)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FirecrawlApiFailure extends S.Class<FirecrawlApiFailure>($I`FirecrawlApiFailure`)(
  {
    code: S.OptionFromOptionalKey(S.String),
    details: S.OptionFromOptionalKey(S.Unknown),
    error: S.String,
    status: S.OptionFromOptionalKey(S.Number),
    success: S.Literal(false),
  },
  $I.annote("FirecrawlApiFailure", {
    description: "Decoded Firecrawl API failure body with optional diagnostics modeled as Option.",
  })
) {}

/**
 * Options used when constructing Firecrawl driver errors.
 *
 * @example
 * ```ts
 * import { FirecrawlErrorOptions } from "@beep/firecrawl"
 * import * as O from "effect/Option"
 *
 * const options = FirecrawlErrorOptions.make({
 *   cause: O.none(),
 *   failure: O.none(),
 *   method: O.some("scrape"),
 *   retryAfterSeconds: O.none(),
 *   retryable: O.none(),
 *   sdkVersion: O.none(),
 *   status: O.some(429)
 * })
 *
 * console.log(options.status)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FirecrawlErrorOptions extends S.Class<FirecrawlErrorOptions>($I`FirecrawlErrorOptions`)(
  {
    cause: S.OptionFromOptionalKey(S.String),
    failure: S.OptionFromOptionalKey(FirecrawlApiFailure),
    method: S.OptionFromOptionalKey(FirecrawlMethodName),
    retryAfterSeconds: S.OptionFromOptionalKey(S.Number),
    retryable: S.OptionFromOptionalKey(S.Boolean),
    sdkVersion: S.OptionFromOptionalKey(S.String),
    status: S.OptionFromOptionalKey(S.Number),
  },
  $I.annote("FirecrawlErrorOptions", {
    description: "Sanitized options for configuring FirecrawlError instances.",
  })
) {}

type FirecrawlErrorOptionsInput = {
  readonly cause?: unknown;
  readonly failure?: FirecrawlApiFailure;
  readonly method?: FirecrawlMethodName;
  readonly retryAfterSeconds?: number;
  readonly retryable?: boolean;
  readonly sdkVersion?: string;
  readonly status?: number;
};

/**
 * Technical failure raised by the Firecrawl driver boundary.
 *
 * @example
 * ```ts
 * import { FirecrawlError } from "@beep/firecrawl"
 *
 * const error = FirecrawlError.fromReason("transport", { method: "scrape" })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FirecrawlError extends TaggedErrorClass<FirecrawlError>($I`FirecrawlError`)(
  "FirecrawlError",
  {
    cause: S.OptionFromOptionalKey(S.String),
    failure: S.OptionFromOptionalKey(FirecrawlApiFailure),
    method: S.OptionFromOptionalKey(FirecrawlMethodName),
    reason: FirecrawlErrorReason,
    retryAfterSeconds: S.OptionFromOptionalKey(S.Number),
    retryable: S.OptionFromOptionalKey(S.Boolean),
    sdkVersion: S.OptionFromOptionalKey(S.String),
    status: S.OptionFromOptionalKey(S.Number),
  },
  $I.annote("FirecrawlError", {
    description: "Sanitized technical failure raised by the Firecrawl driver boundary.",
  })
) {
  /**
   * Create a Firecrawl driver error.
   *
   * @example
   * ```ts
   * import { FirecrawlError } from "@beep/firecrawl"
   *
   * const error = FirecrawlError.fromReason("config")
   * console.log(error.reason)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (
    reason: FirecrawlErrorReason,
    options: FirecrawlErrorOptionsInput = {}
  ): FirecrawlError =>
    FirecrawlError.make({
      reason,
      cause: pipe(O.fromUndefinedOr(options.cause), O.map(causeLabelFromInput)),
      failure: O.fromUndefinedOr(options.failure),
      method: O.fromUndefinedOr(options.method),
      retryAfterSeconds: O.fromUndefinedOr(options.retryAfterSeconds),
      retryable: O.fromUndefinedOr(options.retryable),
      sdkVersion: O.fromUndefinedOr(options.sdkVersion),
      status: O.fromUndefinedOr(options.status),
    });

  /**
   * Convert an unknown SDK throw into a sanitized Firecrawl driver error.
   *
   * @example
   * ```ts
   * import { FirecrawlError } from "@beep/firecrawl"
   *
   * const error = FirecrawlError.fromUnknown("scrape", new Error("boom"))
   * console.log(error.method)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromUnknown = (method: FirecrawlMethodName, cause: unknown): FirecrawlError =>
    FirecrawlError.fromReason(reasonFromUnknown(cause), {
      cause: causeLabel(cause),
      method,
      ...R.getSomes({ status: statusFromUnknown(cause) }),
    });

  /**
   * Create a failed Effect containing a Firecrawl driver error.
   *
   * @example
   * ```ts
   * import { FirecrawlError } from "@beep/firecrawl"
   *
   * const effect = FirecrawlError.failEffectFromReason("config")
   * console.log(effect)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly failEffectFromReason = flow(this.fromReason, Effect.fail);
}

const readProperty = (value: unknown, key: PropertyKey): O.Option<unknown> =>
  P.isObject(value)
    ? O.fromUndefinedOr(
        Result.getOrElse(
          Result.try(() => Reflect.get(value, key)),
          () => undefined
        )
      )
    : O.none();

const readString = (value: unknown, key: PropertyKey): O.Option<string> =>
  pipe(readProperty(value, key), O.filter(P.isString));

const readNumber = (value: unknown, key: PropertyKey): O.Option<number> =>
  pipe(readProperty(value, key), O.filter(P.isNumber));

const statusFromUnknown = (cause: unknown): O.Option<number> => readNumber(cause, "status");

const causeLabel = (cause: unknown): string =>
  pipe(
    O.firstSomeOf([readString(cause, "_tag"), readString(cause, "name"), readString(cause, "code")]),
    O.getOrElse(() => (P.isString(cause) ? "String" : "Unknown"))
  );

const causeLabelFromInput = (cause: unknown): string => (P.isString(cause) ? cause : causeLabel(cause));

const reasonFromUnknown = (cause: unknown): FirecrawlErrorReason =>
  pipe(
    readString(cause, "code"),
    O.filter((code) => code === "JOB_TIMEOUT"),
    O.match({
      onNone: () => "sdk thrown",
      onSome: () => "timeout",
    })
  );
