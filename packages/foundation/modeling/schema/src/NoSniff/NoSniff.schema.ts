/**
 * Schema for the `X-Content-Type-Options` header.
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
import { NoSniffError } from "../SecureHeaderError/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("NoSniff");

const headerName = "X-Content-Type-Options" as const;
const defaultValue = "nosniff" as const;

const NoSniffValueBase = LiteralKit([defaultValue]);

/**
 * Schema for supported `X-Content-Type-Options` header values.
 *
 * **Example** (Decode nosniff value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NoSniffValue } from "@beep/schema/NoSniff"
 *
 * const value = S.decodeUnknownSync(NoSniffValue)("nosniff")
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NoSniffValue = NoSniffValueBase.pipe(
  $I.annoteSchema("NoSniffValue", {
    description: "The supported `X-Content-Type-Options` header values.",
  }),
  SchemaUtils.withLiteralKitStatics(NoSniffValueBase)
);

/**
 * Type-level representation of {@link NoSniffValue}.
 *
 * **Example** (Annotate nosniff type)
 *
 * ```ts
 * import type { NoSniffValue } from "@beep/schema/NoSniff"
 *
 * const value: NoSniffValue = "nosniff"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NoSniffValue = typeof NoSniffValue.Type;

const NoSniffOptionBase = LiteralKit([false, ...NoSniffValueBase.Options]);

/**
 * Schema for `X-Content-Type-Options` option values, including `false` to disable.
 *
 * **Example** (Decode disabled option)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NoSniffOption } from "@beep/schema/NoSniff"
 *
 * const option = S.decodeUnknownSync(NoSniffOption)(false)
 * console.log(option)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NoSniffOption = NoSniffOptionBase.pipe(
  $I.annoteSchema("NoSniffOption", {
    description: "The supported `X-Content-Type-Options` option values.",
  }),
  SchemaUtils.withLiteralKitStatics(NoSniffOptionBase)
);

/**
 * Type-level representation of {@link NoSniffOption}.
 *
 * **Example** (Annotate false option)
 *
 * ```ts
 * import type { NoSniffOption } from "@beep/schema/NoSniff"
 *
 * const option: NoSniffOption = false
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NoSniffOption = typeof NoSniffOption.Type;

/**
 * Parsed `X-Content-Type-Options` response header with name and optional value.
 *
 * **Example** (Construct empty header)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { NoSniffResponseHeader } from "@beep/schema/NoSniff"
 *
 * const header = new NoSniffResponseHeader({ name: "X-Content-Type-Options", value: O.none() })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NoSniffResponseHeader extends S.Class<NoSniffResponseHeader>($I`NoSniffResponseHeader`)(
  {
    name: S.tag(headerName),
    value: S.OptionFromUndefinedOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("NoSniffResponseHeader", {
    description: "The `X-Content-Type-Options` response header.",
  })
) {}

type NoSniffResponseHeaderEncoded = typeof NoSniffResponseHeader.Encoded;

/**
 * One-way schema that decodes `X-Content-Type-Options` options into the response header.
 *
 * **Example** (Create default header)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { NoSniffHeader } from "@beep/schema/NoSniff"
 *
 * const program = NoSniffHeader.create()
 * const header = await Effect.runPromise(program)
 * console.log(header._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NoSniffHeader = S.Union([NoSniffOption, S.Undefined]).pipe(
  S.decodeTo(
    NoSniffResponseHeader,
    SchemaTransformation.transformOrFail({
      decode: (input): Effect.Effect<NoSniffResponseHeaderEncoded> =>
        Effect.succeed({
          name: headerName,
          value: Match.value(input).pipe(
            Match.when(P.isUndefined, () => defaultValue),
            Match.when(false, () => undefined),
            Match.orElse((value) => value)
          ),
        }),
      encode: internal.makeHeaderEncodeForbidden("NoSniffHeader"),
    })
  ),
  $I.annoteSchema("NoSniffHeader", {
    description: "A one-way schema that decodes `X-Content-Type-Options` options into the response header.",
  }),
  SchemaUtils.withStatics(() => {
    const createValue: (option?: undefined | NoSniffOption) => Effect.Effect<O.Option<string>, SecureHeaderError> =
      Effect.fnUntraced(function* (option?: undefined | NoSniffOption) {
        if (P.isUndefined(option)) {
          return O.some(defaultValue);
        }

        if (option === false) {
          return O.none<string>();
        }

        if (S.is(NoSniffValue)(option)) {
          return O.some(option);
        }

        return yield* NoSniffError.make({
          message: `Invalid value for ${headerName}: ${option}`,
          cause: O.none(),
        });
      });

    const create: (
      option?: undefined | NoSniffOption,
      headerValueCreator?: undefined | typeof createValue
    ) => Effect.Effect<O.Option<internal.ResponseHeader>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | NoSniffOption,
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
 * Type-level representation of {@link NoSniffHeader}.
 *
 * **Example** (Assign response header type)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { NoSniffResponseHeader, type NoSniffHeader } from "@beep/schema/NoSniff"
 *
 * const header: NoSniffHeader = new NoSniffResponseHeader({ name: "X-Content-Type-Options", value: O.none() })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NoSniffHeader = typeof NoSniffHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { NoSniffOption as Option, NoSniffResponseHeader as ResponseHeader, NoSniffValue as Value };

/**
 * Concise alias for {@link NoSniffHeader}.
 *
 * **Example** (Create via Header alias)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Header } from "@beep/schema/NoSniff"
 *
 * const program = Header.create()
 * const header = await Effect.runPromise(program)
 * console.log(header._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Header = NoSniffHeader;

/**
 * Type-level representation of {@link Header}.
 *
 * **Example** (Type Header as response)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { NoSniffResponseHeader, type Header } from "@beep/schema/NoSniff"
 *
 * const header: Header = new NoSniffResponseHeader({ name: "X-Content-Type-Options", value: O.none() })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Header = typeof Header.Type;
