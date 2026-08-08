/**
 * Typed technical errors for the Firecrawl driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FirecrawlId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { isNonNegative } from "@beep/schema/Number";
import * as O from "@beep/utils/Option";
import { Effect, flow, pipe, Result } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $FirecrawlId.create("Firecrawl.errors");

const FirecrawlNonNegativeInt = S.Int.check(isNonNegative).pipe(
  $I.annoteSchema("FirecrawlNonNegativeInt", {
    description: "Non-negative integer diagnostic value returned by the Firecrawl SDK.",
  })
);

const optionalString = S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault);
const optionalUnknown = S.OptionFromOptionalKey(S.Unknown).pipe(SchemaUtils.withNoneDefault);
const optionalBoolean = S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault);
const optionalNonNegativeInt = S.OptionFromOptionalKey(FirecrawlNonNegativeInt).pipe(SchemaUtils.withNoneDefault);
const isFirecrawlNonNegativeInt = S.is(FirecrawlNonNegativeInt);

const FirecrawlMethodNameBase = LiteralKit([
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
]);

/**
 * Firecrawl SDK methods wrapped by this driver.
 *
 * **Example** (Check scrape method name)
 *
 * ```ts
 * import { FirecrawlMethodName } from "@beep/firecrawl"
 *
 * console.log(FirecrawlMethodName.is.scrape("scrape"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlMethodName = FirecrawlMethodNameBase.pipe(
  $I.annoteSchema("FirecrawlMethodName", {
    description: "Firecrawl SDK methods wrapped by the Firecrawl technical driver.",
  }),
  SchemaUtils.withLiteralKitStatics(FirecrawlMethodNameBase)
);

/**
 * Type for {@link FirecrawlMethodName}.
 *
 * **Example** (Assign method name type)
 *
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

const FirecrawlErrorReasonBase = LiteralKit([
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
]);

/**
 * Technical error reasons emitted by the Firecrawl driver.
 *
 * **Example** (Check transport error reason)
 *
 * ```ts
 * import { FirecrawlErrorReason } from "@beep/firecrawl"
 *
 * console.log(FirecrawlErrorReason.is.transport("transport"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlErrorReason = FirecrawlErrorReasonBase.pipe(
  $I.annoteSchema("FirecrawlErrorReason", {
    description: "Redacted technical error reasons emitted by the Firecrawl driver.",
  }),
  SchemaUtils.withLiteralKitStatics(FirecrawlErrorReasonBase)
);

/**
 * Type for {@link FirecrawlErrorReason}.
 *
 * **Example** (Assign error reason type)
 *
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

const FirecrawlCodecErrorReasonBase = LiteralKit(
  FirecrawlErrorReason.pickOptions(["request encoding", "response decoding"])
);

/**
 * Codec-boundary error reasons emitted while encoding SDK requests and decoding SDK responses.
 *
 * **Example** (Access request encoding reason)
 *
 * ```ts
 * import { FirecrawlCodecErrorReason } from "@beep/firecrawl"
 *
 * console.log(FirecrawlCodecErrorReason.Enum["request encoding"])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FirecrawlCodecErrorReason = FirecrawlCodecErrorReasonBase.pipe(
  $I.annoteSchema("FirecrawlCodecErrorReason", {
    description: "Subset of Firecrawl error reasons used by schema codec boundaries.",
  }),
  SchemaUtils.withLiteralKitStatics(FirecrawlCodecErrorReasonBase)
);

/**
 * Type for {@link FirecrawlCodecErrorReason}.
 *
 * **Example** (Assign codec error reason)
 *
 * ```ts
 * import type { FirecrawlCodecErrorReason } from "@beep/firecrawl"
 *
 * const reason: FirecrawlCodecErrorReason = "request encoding"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FirecrawlCodecErrorReason = typeof FirecrawlCodecErrorReason.Type;

/**
 * Decoded Firecrawl API failure body.
 *
 * **Example** (Make API failure body)
 *
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
    code: optionalString,
    details: optionalUnknown,
    error: S.String,
    status: optionalNonNegativeInt,
    success: S.Literal(false),
  },
  $I.annote("FirecrawlApiFailure", {
    description: "Decoded Firecrawl API failure body with optional diagnostics modeled as Option.",
  })
) {}

/**
 * Options used when constructing Firecrawl driver errors.
 *
 * **Example** (Make error options object)
 *
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
    cause: optionalString,
    failure: S.OptionFromOptionalKey(FirecrawlApiFailure).pipe(SchemaUtils.withNoneDefault),
    method: S.OptionFromOptionalKey(FirecrawlMethodName).pipe(SchemaUtils.withNoneDefault),
    retryAfterSeconds: optionalNonNegativeInt,
    retryable: optionalBoolean,
    sdkVersion: optionalString,
    status: optionalNonNegativeInt,
  },
  $I.annote("FirecrawlErrorOptions", {
    description: "Sanitized options for configuring FirecrawlError instances.",
  })
) {}

class FirecrawlErrorOptionsInput extends S.Class<FirecrawlErrorOptionsInput>($I`FirecrawlErrorOptionsInput`)(
  {
    cause: S.Unknown.pipe(S.optionalKey),
    failure: FirecrawlApiFailure.pipe(S.optionalKey),
    method: FirecrawlMethodName.pipe(S.optionalKey),
    retryAfterSeconds: S.Finite.pipe(S.optionalKey),
    retryable: S.Boolean.pipe(S.optionalKey),
    sdkVersion: S.String.pipe(S.optionalKey),
    status: S.Finite.pipe(S.optionalKey),
  },
  $I.annote("FirecrawlErrorOptionsInput", {
    description: "Plain input bag accepted by FirecrawlError.fromReason before Option normalization.",
  })
) {}

/**
 * Technical failure raised by the Firecrawl driver boundary.
 *
 * **Example** (Create error from reason)
 *
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
    cause: optionalString,
    failure: S.OptionFromOptionalKey(FirecrawlApiFailure).pipe(SchemaUtils.withNoneDefault),
    method: S.OptionFromOptionalKey(FirecrawlMethodName).pipe(SchemaUtils.withNoneDefault),
    reason: FirecrawlErrorReason,
    retryAfterSeconds: optionalNonNegativeInt,
    retryable: optionalBoolean,
    sdkVersion: optionalString,
    status: optionalNonNegativeInt,
  },
  $I.annote("FirecrawlError", {
    description: "Sanitized technical failure raised by the Firecrawl driver boundary.",
  })
) {
  /**
   * Create a Firecrawl driver error.
   *
   * **Example** (Create error from reason)
   *
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
  ): FirecrawlError => {
    const input = FirecrawlErrorOptionsInput.make(options);

    return FirecrawlError.make({
      reason,
      cause: pipe(O.fromUndefinedOr(input.cause), O.map(causeLabelFromInput)),
      failure: O.fromUndefinedOr(input.failure),
      method: O.fromUndefinedOr(input.method),
      retryAfterSeconds: pipe(O.fromUndefinedOr(input.retryAfterSeconds), O.filter(isFirecrawlNonNegativeInt)),
      retryable: O.fromUndefinedOr(input.retryable),
      sdkVersion: O.fromUndefinedOr(input.sdkVersion),
      status: pipe(O.fromUndefinedOr(input.status), O.filter(isFirecrawlNonNegativeInt)),
    });
  };

  /**
   * Convert an unknown SDK throw into a sanitized Firecrawl driver error.
   *
   * **Example** (Convert unknown SDK throw)
   *
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
      ...O.getSomesStruct({ status: statusFromUnknown(cause) }),
    });

  /**
   * Create a failed Effect containing a Firecrawl driver error.
   *
   * **Example** (Fail Effect from reason)
   *
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

const statusFromUnknown = (cause: unknown): O.Option<number> =>
  O.firstSomeOf([readNumber(cause, "status"), readNumber(cause, "statusCode")]);

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- driver-local cause labeling preserves Firecrawl SDK diagnostics
const causeLabel = (cause: unknown): string =>
  pipe(
    O.firstSomeOf([readString(cause, "_tag"), readString(cause, "name"), readString(cause, "code")]),
    // shared driver boundary idiom; no in-family home; future foundation capability candidate.
    // fallow-ignore-next-line code-duplication -- Firecrawl fallback labels mirror peer drivers but stay provider-local
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
