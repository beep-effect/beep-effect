/**
 * Schema for the `X-Download-Options` header.
 *
 * @since 0.0.0
 * @packageDocumentation
 */
import { $SchemaId } from "@beep/identity";
import { Effect, Match, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as internal from "../Http/Http.headers.shared.ts";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { NoOpenError } from "../SecureHeaderError/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("NoOpen");

const headerName = "X-Download-Options" as const;
const defaultValue = "noopen" as const;

const NoOpenValueBase = LiteralKit([defaultValue]);

/**
 * Schema for the `X-Download-Options` header value.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NoOpenValue } from "@beep/schema/NoOpen"
 *
 * console.log(S.is(NoOpenValue)("noopen")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NoOpenValue = NoOpenValueBase.pipe(
  $I.annoteSchema("NoOpenValue", {
    description: "The supported `X-Download-Options` header values.",
  }),
  SchemaUtils.withLiteralKitStatics(NoOpenValueBase)
);

/**
 * Type for the `X-Download-Options` header value.
 *
 * @example
 * ```ts
 * import { NoOpenValue } from "@beep/schema/NoOpen"
 *
 * const value: NoOpenValue = "noopen"
 * console.log(NoOpenValue.Options.includes(value))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NoOpenValue = typeof NoOpenValue.Type;

const NoOpenOptionBase = LiteralKit([false, ...NoOpenValueBase.Options]);

/**
 * Schema for enabled or disabled `X-Download-Options` options.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NoOpenOption } from "@beep/schema/NoOpen"
 *
 * console.log(S.decodeUnknownSync(NoOpenOption)("noopen"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NoOpenOption = NoOpenOptionBase.pipe(
  $I.annoteSchema("NoOpenOption", {
    description: "The supported `X-Download-Options` option values.",
  }),
  SchemaUtils.withLiteralKitStatics(NoOpenOptionBase)
);

/**
 * Type for enabled or disabled `X-Download-Options` options.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NoOpenOption } from "@beep/schema/NoOpen"
 *
 * const option: NoOpenOption = S.decodeUnknownSync(NoOpenOption)("noopen")
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NoOpenOption = typeof NoOpenOption.Type;

/**
 * Model for a rendered `X-Download-Options` response header.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { NoOpenResponseHeader } from "@beep/schema/NoOpen"
 *
 * const header = NoOpenResponseHeader.make({ name: "X-Download-Options", value: O.some("noopen") })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NoOpenResponseHeader extends S.Class<NoOpenResponseHeader>($I`NoOpenResponseHeader`)(
  {
    name: S.tag(headerName),
    value: S.OptionFromUndefinedOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("NoOpenResponseHeader", {
    description: "The `X-Download-Options` response header.",
  })
) {}

type NoOpenResponseHeaderEncoded = typeof NoOpenResponseHeader.Encoded;

/**
 * Schema that renders X-Download-Options options into a response header.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NoOpenHeader } from "@beep/schema/NoOpen"
 *
 * const header = S.decodeUnknownSync(NoOpenHeader)("noopen")
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NoOpenHeader = S.UndefinedOr(NoOpenOption).pipe(
  S.decodeTo(
    NoOpenResponseHeader,
    SchemaTransformation.transformOrFail({
      decode: (input): Effect.Effect<NoOpenResponseHeaderEncoded> =>
        Effect.succeed({
          name: headerName,
          value: Match.value(input).pipe(
            Match.when(P.isUndefined, () => defaultValue),
            Match.when(false, () => undefined),
            Match.orElse((value) => value)
          ),
        }),
      encode: internal.makeHeaderEncodeForbidden("NoOpenHeader"),
    })
  ),
  $I.annoteSchema("NoOpenHeader", {
    description: "A one-way schema that decodes `X-Download-Options` options into the response header.",
  }),
  SchemaUtils.withStatics(() => {
    const createValue: (option?: undefined | NoOpenOption) => Effect.Effect<O.Option<string>, SecureHeaderError> =
      Effect.fnUntraced(function* (option?: undefined | NoOpenOption) {
        if (P.isUndefined(option)) {
          return O.some(defaultValue);
        }

        if (option === false) {
          return O.none<string>();
        }

        if (S.is(NoOpenValue)(option)) {
          return O.some(option);
        }

        return yield* NoOpenError.make({
          message: `Invalid value for ${headerName}: ${option}`,
          cause: O.none(),
        });
      });

    const create: (
      option?: undefined | NoOpenOption,
      headerValueCreator?: undefined | typeof createValue
    ) => Effect.Effect<O.Option<internal.ResponseHeader>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | NoOpenOption,
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
 * Type for rendered `X-Download-Options` response headers.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NoOpenHeader } from "@beep/schema/NoOpen"
 *
 * const header: NoOpenHeader = S.decodeUnknownSync(NoOpenHeader)("noopen")
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NoOpenHeader = typeof NoOpenHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { NoOpenHeader as Header, NoOpenOption as Option, NoOpenResponseHeader as ResponseHeader, NoOpenValue as Value };
