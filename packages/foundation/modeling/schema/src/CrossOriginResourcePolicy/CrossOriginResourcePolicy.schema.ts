/**
 * Schema for the `Cross-Origin-Resource-Policy` header.
 *
 * @since 0.0.0
 * @packageDocumentation
 */
import { $SchemaId } from "@beep/identity";
import { Effect, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as internal from "../Http/Http.headers.shared.ts";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { CrossOriginResourcePolicyError } from "../SecureHeaderError/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("CrossOriginResourcePolicy");

const headerName = "Cross-Origin-Resource-Policy" as const;

const CorpValueBase = LiteralKit(["same-site", "same-origin", "cross-origin"]);

/**
 * Schema for allowed `Cross-Origin-Resource-Policy` values.
 *
 * **Example** (Validate same-origin CORP value)
 *
 * ```ts import.meta.vitest name="Validate same-origin CORP value"
 * import * as S from "effect/Schema"
 * import { CorpValue } from "@beep/schema/CrossOriginResourcePolicy"
 *
 * S.is(CorpValue)("same-origin") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CorpValue = CorpValueBase.pipe(
  $I.annoteSchema("CorpValue", {
    description: "The supported `Cross-Origin-Resource-Policy` header values.",
  }),
  SchemaUtils.withLiteralKitStatics(CorpValueBase)
);

/**
 * Type for allowed `Cross-Origin-Resource-Policy` values.
 *
 * **Example** (Assign same-origin CorpValue type)
 *
 * ```ts import.meta.vitest name="Assign same-origin CorpValue type"
 * import type { CorpValue } from "@beep/schema/CrossOriginResourcePolicy"
 *
 * const value: CorpValue = "same-origin"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CorpValue = typeof CorpValue.Type;

const CrossOriginResourcePolicyOptionBase = LiteralKit([false, ...CorpValueBase.Options]);

/**
 * Schema for enabled or disabled `Cross-Origin-Resource-Policy` options.
 *
 * **Example** (Decode same-site CORP option)
 *
 * ```ts import.meta.vitest name="Decode same-site CORP option"
 * import * as S from "effect/Schema"
 * import { CrossOriginResourcePolicyOption } from "@beep/schema/CrossOriginResourcePolicy"
 *
 * console.log(S.decodeUnknownSync(CrossOriginResourcePolicyOption)("same-site"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CrossOriginResourcePolicyOption = CrossOriginResourcePolicyOptionBase.pipe(
  $I.annoteSchema("CrossOriginResourcePolicyOption", {
    description: "The supported `Cross-Origin-Resource-Policy` option values.",
  }),
  SchemaUtils.withLiteralKitStatics(CrossOriginResourcePolicyOptionBase)
);

/**
 * Type for enabled or disabled `Cross-Origin-Resource-Policy` options.
 *
 * **Example** (Assign disabled CORP option)
 *
 * ```ts import.meta.vitest name="Assign disabled CORP option"
 * import type { CrossOriginResourcePolicyOption } from "@beep/schema/CrossOriginResourcePolicy"
 *
 * const option: CrossOriginResourcePolicyOption = false
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CrossOriginResourcePolicyOption = typeof CrossOriginResourcePolicyOption.Type;

/**
 * Model for a rendered `Cross-Origin-Resource-Policy` response header.
 *
 * **Example** (Make CORP response header)
 *
 * ```ts import.meta.vitest name="Make CORP response header"
 * import * as O from "effect/Option"
 * import { CrossOriginResourcePolicyResponseHeader } from "@beep/schema/CrossOriginResourcePolicy"
 *
 * const header = CrossOriginResourcePolicyResponseHeader.make({
 *   name: "Cross-Origin-Resource-Policy",
 *   value: O.some("same-origin"),
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CrossOriginResourcePolicyResponseHeader extends S.Class<CrossOriginResourcePolicyResponseHeader>(
  $I`CrossOriginResourcePolicyResponseHeader`
)(
  {
    name: S.tag(headerName),
    value: S.OptionFromUndefinedOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CrossOriginResourcePolicyResponseHeader", {
    description: "The `Cross-Origin-Resource-Policy` response header.",
  })
) {}

type CrossOriginResourcePolicyResponseHeaderEncoded = typeof CrossOriginResourcePolicyResponseHeader.Encoded;

/**
 * Schema that renders CORP options into a response header.
 *
 * **Example** (Decode CORP into header)
 *
 * ```ts import.meta.vitest name="Decode CORP into header"
 * import * as S from "effect/Schema"
 * import { CrossOriginResourcePolicyHeader } from "@beep/schema/CrossOriginResourcePolicy"
 *
 * const header = S.decodeUnknownSync(CrossOriginResourcePolicyHeader)("same-origin")
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CrossOriginResourcePolicyHeader = S.Union([CrossOriginResourcePolicyOption, S.Undefined]).pipe(
  S.decodeTo(
    CrossOriginResourcePolicyResponseHeader,
    SchemaTransformation.transformOrFail({
      decode: (input): Effect.Effect<CrossOriginResourcePolicyResponseHeaderEncoded> =>
        Effect.succeed({
          name: headerName,
          value: P.isUndefined(input) || input === false ? undefined : input,
        }),
      encode: internal.makeHeaderEncodeForbidden("CrossOriginResourcePolicyHeader"),
    })
  ),
  $I.annoteSchema("CrossOriginResourcePolicyHeader", {
    description: "A one-way schema that decodes CORP options into the Cross-Origin-Resource-Policy response header.",
  }),
  SchemaUtils.withStatics(() => {
    const createValue: (
      option?: undefined | CrossOriginResourcePolicyOption
    ) => Effect.Effect<O.Option<string>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | CrossOriginResourcePolicyOption
    ) {
      if (P.isUndefined(option) || option === false) {
        return O.none<string>();
      }

      if (S.is(CorpValue)(option)) {
        return O.some(option);
      }

      return yield* CrossOriginResourcePolicyError.make({
        message: `Invalid value for ${headerName}: ${option}`,
        cause: O.none(),
      });
    });

    const create: (
      option?: undefined | CrossOriginResourcePolicyOption,
      headerValueCreator?: undefined | typeof createValue
    ) => Effect.Effect<O.Option<internal.ResponseHeader>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | CrossOriginResourcePolicyOption,
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
 * Type for rendered `Cross-Origin-Resource-Policy` response headers.
 *
 * **Example** (Type rendered CORP header)
 *
 * ```ts import.meta.vitest name="Type rendered CORP header"
 * import * as O from "effect/Option"
 * import { CrossOriginResourcePolicyResponseHeader, type CrossOriginResourcePolicyHeader } from "@beep/schema/CrossOriginResourcePolicy"
 *
 * const header: CrossOriginResourcePolicyHeader = CrossOriginResourcePolicyResponseHeader.make({
 *   name: "Cross-Origin-Resource-Policy",
 *   value: O.some("same-origin"),
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CrossOriginResourcePolicyHeader = typeof CrossOriginResourcePolicyHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { CrossOriginResourcePolicyOption as Option, CrossOriginResourcePolicyResponseHeader as ResponseHeader };

/**
 * Concise alias for {@link CrossOriginResourcePolicyHeader}.
 *
 * **Example** (Decode via Header alias)
 *
 * ```ts import.meta.vitest name="Decode via Header alias"
 * import * as S from "effect/Schema"
 * import { Header } from "@beep/schema/CrossOriginResourcePolicy"
 *
 * const header = S.decodeUnknownSync(Header)("same-origin")
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Header = CrossOriginResourcePolicyHeader;

/**
 * Type-level representation of {@link Header}.
 *
 * **Example** (Type Header alias value)
 *
 * ```ts import.meta.vitest name="Type Header alias value"
 * import * as O from "effect/Option"
 * import { CrossOriginResourcePolicyResponseHeader, type Header } from "@beep/schema/CrossOriginResourcePolicy"
 *
 * const header: Header = CrossOriginResourcePolicyResponseHeader.make({
 *   name: "Cross-Origin-Resource-Policy",
 *   value: O.some("same-origin"),
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Header = typeof Header.Type;
