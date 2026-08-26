/**
 * Schema for the `Referrer-Policy` header.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity";
import { A } from "@beep/utils";
import { Effect, SchemaIssue, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as internal from "../Http/Http.headers.shared.ts";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { ReferrerPolicyError } from "../SecureHeaderError/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("ReferrerPolicy");

const headerName = "Referrer-Policy" as const;

const ReferrerPolicyValueBase = LiteralKit([
  "no-referrer",
  "no-referrer-when-downgrade",
  "origin",
  "origin-when-cross-origin",
  "same-origin",
  "strict-origin",
  "strict-origin-when-cross-origin",
]);

/**
 * Schema for allowed `Referrer-Policy` values.
 *
 * **Example** (Validate strict-origin value)
 *
 * ```ts import.meta.vitest name="Validate strict-origin value"
 * import * as S from "effect/Schema"
 * import { ReferrerPolicyValue } from "@beep/schema/ReferrerPolicy"
 *
 * S.is(ReferrerPolicyValue)("strict-origin") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReferrerPolicyValue = ReferrerPolicyValueBase.pipe(
  $I.annoteSchema("ReferrerPolicyValue", {
    description: "The supported `Referrer-Policy` header values.",
  }),
  SchemaUtils.withLiteralKitStatics(ReferrerPolicyValueBase)
);

/**
 * Type for allowed `Referrer-Policy` values.
 *
 * **Example** (Assign typed policy value)
 *
 * ```ts
 * import type { ReferrerPolicyValue } from "@beep/schema/ReferrerPolicy"
 *
 * const value: ReferrerPolicyValue = "strict-origin"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReferrerPolicyValue = typeof ReferrerPolicyValue.Type;

/**
 * Schema for fallback lists of `Referrer-Policy` values.
 *
 * **Example** (Decode policy value list)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReferrerPolicyValueList } from "@beep/schema/ReferrerPolicy"
 *
 * const values = S.decodeUnknownSync(ReferrerPolicyValueList)(["origin", "strict-origin"])
 * console.log(values.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReferrerPolicyValueList = S.Array(ReferrerPolicyValue).pipe(
  $I.annoteSchema("ReferrerPolicyValueList", {
    description: "A fallback list of `Referrer-Policy` values for legacy browser support.",
  })
);

/**
 * Type for fallback lists of `Referrer-Policy` values.
 *
 * **Example** (Type policy value list)
 *
 * ```ts
 * import type { ReferrerPolicyValueList } from "@beep/schema/ReferrerPolicy"
 *
 * const values: ReferrerPolicyValueList = ["origin", "strict-origin"]
 * console.log(values.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReferrerPolicyValueList = typeof ReferrerPolicyValueList.Type;

/**
 * Schema for enabled or disabled `Referrer-Policy` options.
 *
 * **Example** (Decode no-referrer option)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReferrerPolicyOption } from "@beep/schema/ReferrerPolicy"
 *
 * console.log(S.decodeUnknownSync(ReferrerPolicyOption)("no-referrer"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReferrerPolicyOption = S.Union([S.Literal(false), ReferrerPolicyValue, ReferrerPolicyValueList]).pipe(
  $I.annoteSchema("ReferrerPolicyOption", {
    description: "The supported `Referrer-Policy` option values.",
  })
);

/**
 * Type for enabled or disabled `Referrer-Policy` options.
 *
 * **Example** (Assign typed option value)
 *
 * ```ts
 * import type { ReferrerPolicyOption } from "@beep/schema/ReferrerPolicy"
 *
 * const option: ReferrerPolicyOption = "no-referrer"
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReferrerPolicyOption = typeof ReferrerPolicyOption.Type;

/**
 * Model for a rendered `Referrer-Policy` response header.
 *
 * **Example** (Make response header model)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ReferrerPolicyResponseHeader } from "@beep/schema/ReferrerPolicy"
 *
 * const header = ReferrerPolicyResponseHeader.make({ name: "Referrer-Policy", value: O.some("no-referrer") })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReferrerPolicyResponseHeader extends S.Class<ReferrerPolicyResponseHeader>(
  $I`ReferrerPolicyResponseHeader`
)(
  {
    name: S.tag(headerName),
    value: S.OptionFromUndefinedOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ReferrerPolicyResponseHeader", {
    description: "The `Referrer-Policy` response header.",
  })
) {}

type ReferrerPolicyResponseHeaderEncoded = typeof ReferrerPolicyResponseHeader.Encoded;

const formatReferrerPolicyValue = Effect.fn("ReferrerPolicy.formatReferrerPolicyValue")(function* (
  option: ReferrerPolicyValue | ReferrerPolicyValueList
): Effect.fn.Return<string, ReferrerPolicyError> {
  const values = internal.wrapArray(option);

  if (A.some(values, (value) => value === ("unsafe-url" as never))) {
    return yield* ReferrerPolicyError.make({
      message: `Cannot specify a dangerous value for ${headerName}: unsafe-url`,
      cause: O.none(),
    });
  }

  if (A.every(values, S.is(ReferrerPolicyValue))) {
    return A.join(values, ", ");
  }

  return yield* ReferrerPolicyError.make({
    message: `Invalid value for ${headerName}: ${String(option)}`,
    cause: O.none(),
  });
});

/**
 * Schema that renders referrer policy options into a response header.
 *
 * **Example** (Decode into response header)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReferrerPolicyHeader } from "@beep/schema/ReferrerPolicy"
 *
 * const header = S.decodeUnknownSync(ReferrerPolicyHeader)("no-referrer")
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReferrerPolicyHeader = S.Union([ReferrerPolicyOption, S.Undefined]).pipe(
  S.decodeTo(
    ReferrerPolicyResponseHeader,
    SchemaTransformation.transformOrFail({
      decode: Effect.fn("ReferrerPolicy.decode")(function* (input): Effect.fn.Return<
        ReferrerPolicyResponseHeaderEncoded,
        SchemaIssue.Issue
      > {
        if (P.isUndefined(input) || input === false) {
          return {
            name: headerName,
            value: undefined,
          } as const;
        }

        const value = yield* formatReferrerPolicyValue(input).pipe(
          Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }))
        );

        return {
          name: headerName,
          value,
        } as const;
      }),
      encode: internal.makeHeaderEncodeForbidden("ReferrerPolicyHeader"),
    })
  ),
  $I.annoteSchema("ReferrerPolicyHeader", {
    description: "A one-way schema that decodes `Referrer-Policy` options into the response header.",
  }),
  SchemaUtils.withStatics(() => {
    const createValue: (
      option?: undefined | ReferrerPolicyOption
    ) => Effect.Effect<O.Option<string>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | ReferrerPolicyOption
    ) {
      if (P.isUndefined(option) || option === false) {
        return O.none<string>();
      }

      return O.some(yield* formatReferrerPolicyValue(option));
    });

    const create: (
      option?: undefined | ReferrerPolicyOption,
      headerValueCreator?: undefined | typeof createValue
    ) => Effect.Effect<O.Option<internal.ResponseHeader>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | ReferrerPolicyOption,
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
 * Type for rendered `Referrer-Policy` response headers.
 *
 * **Example** (Type rendered header value)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ReferrerPolicyResponseHeader, type ReferrerPolicyHeader } from "@beep/schema/ReferrerPolicy"
 *
 * const header: ReferrerPolicyHeader = ReferrerPolicyResponseHeader.make({
 *   name: "Referrer-Policy",
 *   value: O.some("no-referrer"),
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ReferrerPolicyHeader = typeof ReferrerPolicyHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { ReferrerPolicyResponseHeader as ResponseHeader, ReferrerPolicyValue as Value };

/**
 * Concise alias for {@link ReferrerPolicyOption}.
 *
 * **Example** (Decode via Option alias)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Option } from "@beep/schema/ReferrerPolicy"
 *
 * console.log(S.decodeUnknownSync(Option)("no-referrer"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Option = ReferrerPolicyOption;

/**
 * Type-level representation of {@link Option}.
 *
 * **Example** (Type Option alias value)
 *
 * ```ts
 * import type { Option } from "@beep/schema/ReferrerPolicy"
 *
 * const option: Option = "no-referrer"
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Option = typeof Option.Type;

/**
 * Concise alias for {@link ReferrerPolicyHeader}.
 *
 * **Example** (Decode via Header alias)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Header } from "@beep/schema/ReferrerPolicy"
 *
 * const header = S.decodeUnknownSync(Header)("no-referrer")
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Header = ReferrerPolicyHeader;

/**
 * Type-level representation of {@link Header}.
 *
 * **Example** (Type Header alias value)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ReferrerPolicyResponseHeader, type Header } from "@beep/schema/ReferrerPolicy"
 *
 * const header: Header = ReferrerPolicyResponseHeader.make({
 *   name: "Referrer-Policy",
 *   value: O.some("no-referrer"),
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Header = typeof Header.Type;
