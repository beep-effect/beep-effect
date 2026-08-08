/**
 * Typed technical errors for the Microsoft 365 (Graph) driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $M365Id } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { HttpStatus } from "@beep/schema/HttpStatus";
import { O } from "@beep/utils";
import { Effect, flow, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as HttpClientError from "effect/unstable/http/HttpClientError";

const $I = $M365Id.create("M365.errors");

const M365HttpStatusArbitraryValues = HttpStatus.To.Options as readonly [number, ...ReadonlyArray<number>];
const M365HttpStatus = S.Finite.check(
  S.makeFilter((status): status is number => pipe(M365HttpStatusArbitraryValues, A.contains(status)), {
    expected: "known HTTP status code",
  })
).pipe(
  S.annotate({
    toArbitrary: () => (fc) => fc.constantFrom(...M365HttpStatusArbitraryValues),
  }),
  $I.annoteSchema("M365HttpStatus", {
    description: "Numeric HTTP status code carried by Microsoft 365 driver errors.",
  })
);
type M365HttpStatus = typeof M365HttpStatus.Type;

/**
 * Technical error reasons emitted by the Microsoft 365 driver.
 *
 * **Example** (Check throttled reason match)
 *
 * ```ts
 * import { M365ErrorReason } from "@beep/m365"
 *
 * console.log(M365ErrorReason.is.throttled("throttled")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const M365ErrorReason = LiteralKit([
  "config",
  "auth",
  "request encoding",
  "response decoding",
  "response status",
  "transport",
  "throttled",
  "encrypted item",
]).pipe(
  $I.annoteSchema("M365ErrorReason", {
    description: "Redacted technical error reasons emitted by the Microsoft 365 Graph driver.",
  })
);

/**
 * Type for {@link M365ErrorReason}.
 *
 * **Example** (Assign typed reason value)
 *
 * ```ts
 * import type { M365ErrorReason as M365ErrorReasonType } from "@beep/m365"
 *
 * const reason: M365ErrorReasonType = "throttled"
 * console.log(reason) // "throttled"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type M365ErrorReason = typeof M365ErrorReason.Type;

type M365ErrorOptionsInputRaw = {
  readonly cause?: unknown;
  readonly itemId?: string;
  readonly resource?: string;
  readonly retryAfterSeconds?: number;
  readonly status?: number;
  readonly url?: string;
};

const optionalField = <Inner extends S.Top>(inner: Inner, description: string) =>
  S.OptionFromOptionalKey(inner).pipe(SchemaUtils.withNoneDefault).annotateKey({ description });

class M365ErrorOptionsInput extends S.Class<M365ErrorOptionsInput>($I`M365ErrorOptionsInput`)(
  {
    cause: optionalField(S.Unknown, "Original native or third-party cause when one was available."),
    itemId: optionalField(S.String, "Graph item id involved, if any."),
    resource: optionalField(S.String, "Graph resource family involved, if any."),
    retryAfterSeconds: optionalField(
      NonNegativeInt,
      "Honored Retry-After delay in seconds, if the response was throttled."
    ),
    status: optionalField(M365HttpStatus, "HTTP status code associated with the failure, if any."),
    url: optionalField(S.String, "Request URL involved, if any."),
  },
  $I.annote("M365ErrorOptionsInput", {
    description: "Normalized options for configuring Microsoft 365 driver errors.",
  })
) {}

const decodeRetryAfterSecondsOption = S.decodeUnknownOption(NonNegativeInt);
const makeHttpStatus: (status: number) => M365HttpStatus = flow(
  S.decodeUnknownOption(M365HttpStatus),
  O.getOrElse(() => HttpStatus.From.Enum.InternalServerError)
);
const sameM365ErrorReason = S.toEquivalence(M365ErrorReason);
const sameOptionalErrorText = S.toEquivalence(S.Option(S.String));
const sameOptionalRetryAfterSeconds = S.toEquivalence(S.Option(NonNegativeInt));
const sameOptionalHttpStatus = S.toEquivalence(S.Option(M365HttpStatus));

const sameM365ErrorFields = (self: M365Error, that: M365Error): boolean =>
  sameM365ErrorReason(self.reason, that.reason) &&
  sameOptionalErrorText(self.cause, that.cause) &&
  sameOptionalErrorText(self.itemId, that.itemId) &&
  sameOptionalErrorText(self.resource, that.resource) &&
  sameOptionalRetryAfterSeconds(self.retryAfterSeconds, that.retryAfterSeconds) &&
  sameOptionalHttpStatus(self.status, that.status) &&
  sameOptionalErrorText(self.url, that.url);

const normalizeM365ErrorOptions = (options: M365ErrorOptionsInputRaw): M365ErrorOptionsInput =>
  M365ErrorOptionsInput.make({
    cause: O.fromUndefinedOr(options.cause),
    itemId: O.fromUndefinedOr(options.itemId),
    resource: O.fromUndefinedOr(options.resource),
    retryAfterSeconds: pipe(O.fromUndefinedOr(options.retryAfterSeconds), O.flatMap(decodeRetryAfterSecondsOption)),
    status: pipe(O.fromUndefinedOr(options.status), O.map(makeHttpStatus)),
    url: O.fromUndefinedOr(options.url),
  });

const M365ErrorFields = {
  reason: M365ErrorReason.annotateKey({ description: "Redacted technical failure reason." }),
  cause: optionalField(S.String, "Sanitized cause label (tag/name), if any."),
  itemId: optionalField(S.String, "Graph item id involved, if any."),
  resource: optionalField(S.String, "Graph resource family (drives/sites/messages/events), if any."),
  retryAfterSeconds: optionalField(
    NonNegativeInt,
    "Honored Retry-After delay in seconds, if the response was throttled."
  ),
  status: optionalField(M365HttpStatus, "HTTP status code, if any."),
  url: optionalField(S.String, "Request URL involved, if any."),
} satisfies S.Struct.Fields;

/**
 * Technical failure raised by the Microsoft 365 driver boundary.
 *
 * **Details**
 *
 * Carries only sanitized, technical context (reason, HTTP status, requested
 * resource, item id, throttle hint) modeled as `Option`. Never raw file
 * content, mail bodies, or tokens.
 *
 * **Example** (Create error from reason)
 *
 * ```ts
 * import { M365Error } from "@beep/m365"
 *
 * const error = M365Error.fromReason("throttled", {
 *   resource: "drives",
 *   status: 429,
 *   retryAfterSeconds: 12
 * })
 *
 * console.log(error.reason) // "throttled"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class M365Error extends TaggedErrorClass<M365Error>($I`M365Error`)(
  "M365Error",
  M365ErrorFields,
  $I.annoteClass<S.declare<M365Error>, readonly [S.TaggedStruct<"M365Error", typeof M365ErrorFields>]>("M365Error", {
    description: "Redacted technical failure raised by the Microsoft 365 Graph driver boundary.",
    toEquivalence: () => sameM365ErrorFields,
  })
) {
  /**
   * Create a Microsoft 365 driver error.
   *
   * **Example** (Create error with status)
   *
   * ```ts
   * import { M365Error } from "@beep/m365"
   *
   * const error = M365Error.fromReason("response status", { status: 401, resource: "messages" })
   * console.log(error.reason) // "response status"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (reason: M365ErrorReason, options: M365ErrorOptionsInputRaw = {}): M365Error => {
    const normalizedOptions = normalizeM365ErrorOptions(options);

    return M365Error.make({
      reason,
      cause: O.flatMap(normalizedOptions.cause, causeFromUnknown),
      itemId: normalizedOptions.itemId,
      resource: normalizedOptions.resource,
      retryAfterSeconds: normalizedOptions.retryAfterSeconds,
      status: normalizedOptions.status,
      url: normalizedOptions.url,
    });
  };

  /**
   * Create a failed Effect containing a Microsoft 365 driver error.
   *
   * **Example** (Fail Effect from reason)
   *
   * ```ts
   * import { M365Error } from "@beep/m365"
   *
   * const effect = M365Error.failEffectFromReason("transport")
   * console.log(effect)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly failEffectFromReason = flow(this.fromReason, Effect.fail);

  /**
   * Create a thunk returning a failed Effect containing a Microsoft 365 driver error.
   *
   * **Example** (Thunk returning failed Effect)
   *
   * ```ts
   * import { M365Error } from "@beep/m365"
   *
   * const thunk = M365Error.failEffectFromReasonThunk("config")
   * console.log(thunk)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly failEffectFromReasonThunk = flow(this.failEffectFromReason, (effect) => () => effect);
}

const readProperty = (value: unknown, key: PropertyKey): O.Option<unknown> => {
  const target = O.fromNullishOr(value);

  return pipe(
    target,
    O.filter(P.isObject),
    O.flatMap((object) =>
      Result.match(
        Result.try(() => Reflect.get(object, key)),
        {
          onFailure: O.none,
          onSuccess: O.fromUndefinedOr,
        }
      )
    )
  );
};

// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- driver-local string reader keeps unknown M365 causes inside its boundary
const readString =
  (key: PropertyKey) =>
  (value: unknown): O.Option<string> =>
    // shared driver boundary idiom; no in-family home; future foundation capability candidate.
    // fallow-ignore-next-line code-duplication -- M365 property refinement mirrors peer drivers but stays provider-local
    pipe(readProperty(value, key), O.filter(P.isString));

const tryBoolean = (evaluate: () => boolean): Result.Result<boolean, unknown> => Result.try(evaluate);
const safeBoolean: (evaluate: () => boolean) => boolean = flow(
  tryBoolean,
  Result.getOrElse(() => false)
);

const httpClientCauseLabel: (cause: unknown) => O.Option<string> = flow(
  O.fromNullishOr,
  O.filter((value) => safeBoolean(() => HttpClientError.isHttpClientError(value))),
  O.flatMap((value) => readProperty(value, "reason")),
  O.flatMap(readString("_tag")),
  O.map((tag) => `HttpClientError:${tag}`)
);

const stringCauseLabel = (cause: unknown): O.Option<string> => (P.isString(cause) ? O.some("String") : O.none());

const causeLabelReaders: ReadonlyArray<(cause: unknown) => O.Option<string>> = [
  httpClientCauseLabel,
  readString("_tag"),
  readString("name"),
  stringCauseLabel,
];

const causeFromUnknown = (cause: unknown): O.Option<string> =>
  pipe(
    causeLabelReaders,
    A.findFirst((reader) => O.isSome(reader(cause))),
    O.flatMap((reader) => reader(cause))
  );
