/**
 * Schema for the `Strict-Transport-Security` header.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity";
import { A } from "@beep/utils";
import { Effect, Match, pipe, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as internal from "../Http/Http.headers.shared.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { ForceHttpsRedirectError } from "../SecureHeaderError/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("ForceHttpsRedirect");

const headerName = "Strict-Transport-Security" as const;
const defaultMaxAge = 60 * 60 * 24 * 365 * 2;

/**
 * Configuration for the `Strict-Transport-Security` header.
 *
 * @example
 * ```ts
 * import { ForceHttpsRedirectConfig } from "@beep/schema/ForceHttpsRedirect"
 *
 * const config = ForceHttpsRedirectConfig.make({ includeSubDomains: true, preload: true })
 * console.log(config.includeSubDomains)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ForceHttpsRedirectConfig extends S.Class<ForceHttpsRedirectConfig>($I`ForceHttpsRedirectConfig`)(
  {
    maxAge: S.optionalKey(internal.HeaderMaxAgeSeconds).pipe(SchemaUtils.withKeyDefaults(defaultMaxAge)),
    includeSubDomains: SchemaUtils.BoolKeyDefaultFalse,
    preload: SchemaUtils.BoolKeyDefaultFalse,
  },
  $I.annote("ForceHttpsRedirectConfig", {
    description: "Optional configuration values for the `Strict-Transport-Security` header.",
  })
) {}

/**
 * Schema for tuple-based enabled `Strict-Transport-Security` configuration.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ForceHttpsRedirectConfig, ForceHttpsRedirectEnabled } from "@beep/schema/ForceHttpsRedirect"
 *
 * const enabled = S.decodeUnknownSync(ForceHttpsRedirectEnabled)([
 *   true,
 *   ForceHttpsRedirectConfig.make({ includeSubDomains: true }),
 * ])
 * console.log(enabled[0])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ForceHttpsRedirectEnabled = S.Tuple([S.Literal(true), ForceHttpsRedirectConfig]).pipe(
  $I.annoteSchema("ForceHttpsRedirectEnabled", {
    description: "Tuple form used to enable `Strict-Transport-Security` with additional configuration.",
  })
);

/**
 * Type for tuple-based enabled `Strict-Transport-Security` configuration.
 *
 * @example
 * ```ts
 * import { ForceHttpsRedirectConfig, type ForceHttpsRedirectEnabled } from "@beep/schema/ForceHttpsRedirect"
 *
 * const enabled: ForceHttpsRedirectEnabled = [true, ForceHttpsRedirectConfig.make({ includeSubDomains: true })]
 * console.log(enabled[0])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ForceHttpsRedirectEnabled = typeof ForceHttpsRedirectEnabled.Type;

/**
 * Schema for enabled or disabled `Strict-Transport-Security` options.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ForceHttpsRedirectOption } from "@beep/schema/ForceHttpsRedirect"
 *
 * console.log(S.decodeUnknownSync(ForceHttpsRedirectOption)(true))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ForceHttpsRedirectOption = S.Union([S.Boolean, ForceHttpsRedirectEnabled]).pipe(
  $I.annoteSchema("ForceHttpsRedirectOption", {
    description: "The supported `Strict-Transport-Security` option values.",
  })
);

/**
 * Type for enabled or disabled `Strict-Transport-Security` options.
 *
 * @example
 * ```ts
 * import type { ForceHttpsRedirectOption } from "@beep/schema/ForceHttpsRedirect"
 *
 * const option: ForceHttpsRedirectOption = true
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ForceHttpsRedirectOption = typeof ForceHttpsRedirectOption.Type;

/**
 * Model for a rendered `Strict-Transport-Security` response header.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { ForceHttpsRedirectResponseHeader } from "@beep/schema/ForceHttpsRedirect"
 *
 * const header = ForceHttpsRedirectResponseHeader.make({
 *   name: "Strict-Transport-Security",
 *   value: O.some("max-age=31536000"),
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ForceHttpsRedirectResponseHeader extends S.Class<ForceHttpsRedirectResponseHeader>(
  $I`ForceHttpsRedirectResponseHeader`
)(
  {
    name: S.tag(headerName),
    value: S.OptionFromUndefinedOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ForceHttpsRedirectResponseHeader", {
    description: "The `Strict-Transport-Security` response header.",
  })
) {}

type ForceHttpsRedirectResponseHeaderEncoded = typeof ForceHttpsRedirectResponseHeader.Encoded;

const formatForceHttpsRedirectValue = (config: ForceHttpsRedirectConfig): string =>
  pipe(
    A.make(
      `max-age=${config.maxAge}`,
      config.includeSubDomains ? "includeSubDomains" : undefined,
      config.preload ? "preload" : undefined
    ),
    A.filter(P.isNotUndefined),
    A.join("; ")
  );

/**
 * Schema that renders Strict-Transport-Security options into a response header.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ForceHttpsRedirectHeader } from "@beep/schema/ForceHttpsRedirect"
 *
 * const header = S.decodeUnknownSync(ForceHttpsRedirectHeader)(true)
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ForceHttpsRedirectHeader = S.Union([ForceHttpsRedirectOption, S.Undefined]).pipe(
  S.decodeTo(
    ForceHttpsRedirectResponseHeader,
    SchemaTransformation.transformOrFail({
      decode: (input): Effect.Effect<ForceHttpsRedirectResponseHeaderEncoded> =>
        Effect.succeed({
          name: headerName,
          value: Match.value(input).pipe(
            Match.when(P.isUndefined, () => `max-age=${defaultMaxAge}`),
            Match.when(true, () => `max-age=${defaultMaxAge}`),
            Match.when(false, () => undefined),
            Match.orElse((value) => formatForceHttpsRedirectValue(value[1]))
          ),
        }),
      encode: internal.makeHeaderEncodeForbidden("ForceHttpsRedirectHeader"),
    })
  ),
  $I.annoteSchema("ForceHttpsRedirectHeader", {
    description: "A one-way schema that decodes `Strict-Transport-Security` options into the response header.",
  }),
  SchemaUtils.withStatics(() => {
    const createValue: (
      option?: undefined | ForceHttpsRedirectOption
    ) => Effect.Effect<O.Option<string>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | ForceHttpsRedirectOption
    ) {
      if (P.isUndefined(option) || option === true) {
        return O.some(`max-age=${defaultMaxAge}`);
      }

      if (option === false) {
        return O.none<string>();
      }

      const enabled = yield* S.decodeEffect(ForceHttpsRedirectEnabled)(option).pipe(
        Effect.mapError((cause) =>
          ForceHttpsRedirectError.make({
            message: cause.message,
            cause: O.none(),
          })
        )
      );

      return O.some(formatForceHttpsRedirectValue(enabled[1]));
    });

    const create: (
      option?: undefined | ForceHttpsRedirectOption,
      headerValueCreator?: undefined | typeof createValue
    ) => Effect.Effect<O.Option<internal.ResponseHeader>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | ForceHttpsRedirectOption,
      headerValueCreator: typeof createValue = createValue
    ) {
      const value = yield* headerValueCreator(option);

      return internal.makeResponseHeaderOption(headerName, value);
    });

    return {
      createValue,
      create,
    };
  })
);

/**
 * Type for rendered `Strict-Transport-Security` response headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { ForceHttpsRedirectResponseHeader, type ForceHttpsRedirectHeader } from "@beep/schema/ForceHttpsRedirect"
 *
 * const header: ForceHttpsRedirectHeader = new ForceHttpsRedirectResponseHeader({
 *   name: "Strict-Transport-Security",
 *   value: O.some("max-age=31536000"),
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ForceHttpsRedirectHeader = typeof ForceHttpsRedirectHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { ForceHttpsRedirectConfig as Config, ForceHttpsRedirectResponseHeader as ResponseHeader };

/**
 * Concise alias for {@link ForceHttpsRedirectOption}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Option } from "@beep/schema/ForceHttpsRedirect"
 *
 * console.log(S.decodeUnknownSync(Option)(true))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Option = ForceHttpsRedirectOption;

/**
 * Type-level representation of {@link Option}.
 *
 * @example
 * ```ts
 * import type { Option } from "@beep/schema/ForceHttpsRedirect"
 *
 * const option: Option = true
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Option = typeof Option.Type;

/**
 * Concise alias for {@link ForceHttpsRedirectHeader}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Header } from "@beep/schema/ForceHttpsRedirect"
 *
 * const header = S.decodeUnknownSync(Header)(true)
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Header = ForceHttpsRedirectHeader;

/**
 * Type-level representation of {@link Header}.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { ForceHttpsRedirectResponseHeader, type Header } from "@beep/schema/ForceHttpsRedirect"
 *
 * const header: Header = new ForceHttpsRedirectResponseHeader({
 *   name: "Strict-Transport-Security",
 *   value: O.some("max-age=31536000"),
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Header = typeof Header.Type;
