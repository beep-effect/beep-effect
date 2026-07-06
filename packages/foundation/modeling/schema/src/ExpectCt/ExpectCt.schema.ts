/**
 * Schema for the `Expect-CT` header.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity";
import { A } from "@beep/utils";
import { Effect, pipe, SchemaIssue, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as internal from "../Http/Http.headers.shared.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { ExpectCtError } from "../SecureHeaderError/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("ExpectCt");

const headerName = "Expect-CT" as const;
const defaultMaxAge = 60 * 60 * 24;

/**
 * Configuration for the `Expect-CT` header.
 *
 * @example
 * ```ts
 * import { ExpectCTConfig } from "@beep/schema/ExpectCt"
 *
 * const config = ExpectCTConfig.make({ enforce: true, maxAge: 86400 })
 * console.log(config.enforce)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExpectCTConfig extends S.Class<ExpectCTConfig>($I`ExpectCTConfig`)(
  {
    maxAge: S.optionalKey(internal.HeaderMaxAgeSeconds).pipe(SchemaUtils.withKeyDefaults(defaultMaxAge)),
    enforce: SchemaUtils.BoolKeyDefaultFalse,
    reportURI: S.OptionFromOptionalKey(internal.StringOrUrl).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ExpectCTConfig", {
    description: "Optional configuration values for the `Expect-CT` header.",
  })
) {}

/**
 * Schema for tuple-based enabled `Expect-CT` configuration.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ExpectCTConfig, ExpectCTEnabled } from "@beep/schema/ExpectCt"
 *
 * const enabled = S.decodeUnknownSync(ExpectCTEnabled)([true, ExpectCTConfig.make({ enforce: true })])
 * console.log(enabled[0])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExpectCTEnabled = S.Tuple([S.Literal(true), ExpectCTConfig]).pipe(
  $I.annoteSchema("ExpectCTEnabled", {
    description: "Tuple form used to enable `Expect-CT` with additional configuration.",
  })
);

/**
 * Type for tuple-based enabled `Expect-CT` configuration.
 *
 * @category models
 * @since 0.0.0
 */
export type ExpectCTEnabled = typeof ExpectCTEnabled.Type;

/**
 * Schema for enabled or disabled `Expect-CT` options.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ExpectCTOption } from "@beep/schema/ExpectCt"
 *
 * console.log(S.decodeUnknownSync(ExpectCTOption)(true))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExpectCTOption = S.Union([S.Boolean, ExpectCTEnabled]).pipe(
  $I.annoteSchema("ExpectCTOption", {
    description: "The supported `Expect-CT` option values.",
  })
);

/**
 * Type for enabled or disabled `Expect-CT` options.
 *
 * @category models
 * @since 0.0.0
 */
export type ExpectCTOption = typeof ExpectCTOption.Type;

/**
 * Model for a rendered `Expect-CT` response header.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { ExpectCTResponseHeader } from "@beep/schema/ExpectCt"
 *
 * const header = ExpectCTResponseHeader.make({ name: "Expect-CT", value: O.some("max-age=86400") })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExpectCTResponseHeader extends S.Class<ExpectCTResponseHeader>($I`ExpectCTResponseHeader`)(
  {
    name: S.tag(headerName),
    value: S.OptionFromUndefinedOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ExpectCTResponseHeader", {
    description: "The `Expect-CT` response header.",
  })
) {}

type ExpectCTResponseHeaderEncoded = typeof ExpectCTResponseHeader.Encoded;

const formatExpectCTValue = Effect.fn("ExpectCT.formatExpectCTValue")(function* (
  config: ExpectCTConfig
): Effect.fn.Return<string, SecureHeaderError> {
  const reportURI: O.Option<string> = yield* O.match(config.reportURI, {
    onNone: () => Effect.succeed(O.none<string>()),
    onSome: (reportUriValue) =>
      Effect.map(
        Effect.try({
          try: () => String(internal.encodeStrictURI(reportUriValue)),
          catch: () =>
            ExpectCtError.make({
              message: `Invalid value for "reportURI" option in ${headerName}: ${String(reportUriValue)}`,
              cause: O.none(),
            }),
        }),
        O.some
      ),
  });

  return pipe(
    A.make(
      `max-age=${config.maxAge}`,
      config.enforce ? "enforce" : undefined,
      pipe(
        reportURI,
        O.map((value) => `report-uri=${value}`),
        O.getOrUndefined
      )
    ),
    A.filter(P.isNotUndefined),
    A.join(", ")
  );
});

const decodeExpectCTValue = Effect.fn("ExpectCT.decodeExpectCTValue")(function* (
  input: ExpectCTOption | undefined
): Effect.fn.Return<ExpectCTResponseHeaderEncoded, SchemaIssue.Issue> {
  if (P.isUndefined(input) || input === false) {
    return {
      name: headerName,
      value: undefined,
    } as const;
  }

  if (input === true) {
    return {
      name: headerName,
      value: `max-age=${defaultMaxAge}`,
    } as const;
  }

  const value = yield* formatExpectCTValue(input[1]).pipe(
    Effect.mapError((error) => new SchemaIssue.InvalidValue(O.some(error), { message: error.message }))
  );

  return {
    name: headerName,
    value,
  } as const;
});

/**
 * Schema that renders Expect-CT options into a response header.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ExpectCTHeader } from "@beep/schema/ExpectCt"
 *
 * const header = S.decodeUnknownSync(ExpectCTHeader)(true)
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExpectCTHeader = S.Union([ExpectCTOption, S.Undefined]).pipe(
  S.decodeTo(
    ExpectCTResponseHeader,
    SchemaTransformation.transformOrFail({
      decode: decodeExpectCTValue,
      encode: internal.makeHeaderEncodeForbidden("ExpectCTHeader"),
    })
  ),
  $I.annoteSchema("ExpectCTHeader", {
    description: "A one-way schema that decodes `Expect-CT` options into the response header.",
  }),
  SchemaUtils.withStatics(() => {
    const createValue: (option?: undefined | ExpectCTOption) => Effect.Effect<O.Option<string>, SecureHeaderError> =
      Effect.fnUntraced(function* (option?: undefined | ExpectCTOption) {
        if (P.isUndefined(option) || option === false) {
          return O.none<string>();
        }

        if (option === true) {
          return O.some(`max-age=${defaultMaxAge}`);
        }

        const enabled = yield* S.decodeUnknownEffect(ExpectCTEnabled)(option).pipe(
          Effect.mapError((cause) =>
            ExpectCtError.make({
              message: cause.message,
              cause: O.none(),
            })
          )
        );

        return O.some(yield* formatExpectCTValue(enabled[1]));
      });

    const create: (
      option?: undefined | ExpectCTOption,
      headerValueCreator?: undefined | typeof createValue
    ) => Effect.Effect<O.Option<internal.ResponseHeader>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | ExpectCTOption,
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
 * Type for rendered `Expect-CT` response headers.
 *
 * @category models
 * @since 0.0.0
 */
export type ExpectCTHeader = typeof ExpectCTHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  ExpectCTConfig as Config,
  ExpectCTHeader as Header,
  ExpectCTOption as Option,
  ExpectCTResponseHeader as ResponseHeader,
};
