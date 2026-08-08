/**
 * Schema for the `X-Permitted-Cross-Domain-Policies` header.
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
import { PermittedCrossDomainPoliciesError } from "../SecureHeaderError/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("PermittedCrossDomainPolicies");

const headerName = "X-Permitted-Cross-Domain-Policies" as const;
const defaultValue = "none" as const;

const PermittedCrossDomainPoliciesValueBase = LiteralKit([
  "none",
  "master-only",
  "by-content-type",
  "by-ftp-filename",
  "all",
]);

/**
 * Schema for allowed `X-Permitted-Cross-Domain-Policies` values.
 *
 * **Example** (Validate none policy value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PermittedCrossDomainPoliciesValue } from "@beep/schema/PermittedCrossDomainPolicies"
 *
 * console.log(S.is(PermittedCrossDomainPoliciesValue)("none")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermittedCrossDomainPoliciesValue = PermittedCrossDomainPoliciesValueBase.pipe(
  $I.annoteSchema("PermittedCrossDomainPoliciesValue", {
    description: "The supported `X-Permitted-Cross-Domain-Policies` header values.",
  }),
  SchemaUtils.withLiteralKitStatics(PermittedCrossDomainPoliciesValueBase)
);

/**
 * Type for allowed `X-Permitted-Cross-Domain-Policies` values.
 *
 * **Example** (Assign none policy type)
 *
 * ```ts
 * import type { PermittedCrossDomainPoliciesValue } from "@beep/schema/PermittedCrossDomainPolicies"
 *
 * const value: PermittedCrossDomainPoliciesValue = "none"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PermittedCrossDomainPoliciesValue = typeof PermittedCrossDomainPoliciesValue.Type;

const PermittedCrossDomainPoliciesOptionBase = LiteralKit([false, ...PermittedCrossDomainPoliciesValueBase.Options]);

/**
 * Schema for enabled or disabled cross-domain policy options.
 *
 * **Example** (Decode master-only option)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PermittedCrossDomainPoliciesOption } from "@beep/schema/PermittedCrossDomainPolicies"
 *
 * console.log(S.decodeUnknownSync(PermittedCrossDomainPoliciesOption)("master-only"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermittedCrossDomainPoliciesOption = PermittedCrossDomainPoliciesOptionBase.pipe(
  $I.annoteSchema("PermittedCrossDomainPoliciesOption", {
    description: "The supported `X-Permitted-Cross-Domain-Policies` option values.",
  }),
  SchemaUtils.withLiteralKitStatics(PermittedCrossDomainPoliciesOptionBase)
);

/**
 * Type for enabled or disabled cross-domain policy options.
 *
 * **Example** (Assign master-only option type)
 *
 * ```ts
 * import type { PermittedCrossDomainPoliciesOption } from "@beep/schema/PermittedCrossDomainPolicies"
 *
 * const option: PermittedCrossDomainPoliciesOption = "master-only"
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PermittedCrossDomainPoliciesOption = typeof PermittedCrossDomainPoliciesOption.Type;

/**
 * Model for a rendered `X-Permitted-Cross-Domain-Policies` response header.
 *
 * **Example** (Make response header model)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { PermittedCrossDomainPoliciesResponseHeader } from "@beep/schema/PermittedCrossDomainPolicies"
 *
 * const header = PermittedCrossDomainPoliciesResponseHeader.make({
 *   name: "X-Permitted-Cross-Domain-Policies",
 *   value: O.some("none"),
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PermittedCrossDomainPoliciesResponseHeader extends S.Class<PermittedCrossDomainPoliciesResponseHeader>(
  $I`PermittedCrossDomainPoliciesResponseHeader`
)(
  {
    name: S.tag(headerName),
    value: S.OptionFromUndefinedOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PermittedCrossDomainPoliciesResponseHeader", {
    description: "The `X-Permitted-Cross-Domain-Policies` response header.",
  })
) {}

type PermittedCrossDomainPoliciesResponseHeaderEncoded = typeof PermittedCrossDomainPoliciesResponseHeader.Encoded;

/**
 * Schema that renders cross-domain policy options into a response header.
 *
 * **Example** (Decode none into header)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PermittedCrossDomainPoliciesHeader } from "@beep/schema/PermittedCrossDomainPolicies"
 *
 * const header = S.decodeUnknownSync(PermittedCrossDomainPoliciesHeader)("none")
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermittedCrossDomainPoliciesHeader = S.Union([PermittedCrossDomainPoliciesOption, S.Undefined]).pipe(
  S.decodeTo(
    PermittedCrossDomainPoliciesResponseHeader,
    SchemaTransformation.transformOrFail({
      decode: (input): Effect.Effect<PermittedCrossDomainPoliciesResponseHeaderEncoded> =>
        Effect.succeed({
          name: headerName,
          value: Match.value(input).pipe(
            Match.when(P.isUndefined, () => defaultValue),
            Match.when(false, () => undefined),
            Match.orElse((value) => value)
          ),
        }),
      encode: internal.makeHeaderEncodeForbidden("PermittedCrossDomainPoliciesHeader"),
    })
  ),
  $I.annoteSchema("PermittedCrossDomainPoliciesHeader", {
    description: "A one-way schema that decodes `X-Permitted-Cross-Domain-Policies` options into the response header.",
  }),
  SchemaUtils.withStatics(() => {
    const createValue: (
      option?: undefined | PermittedCrossDomainPoliciesOption
    ) => Effect.Effect<O.Option<string>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | PermittedCrossDomainPoliciesOption
    ) {
      if (P.isUndefined(option)) {
        return O.some(defaultValue);
      }

      if (option === false) {
        return O.none<string>();
      }

      if (S.is(PermittedCrossDomainPoliciesValue)(option)) {
        return O.some(option);
      }

      return yield* PermittedCrossDomainPoliciesError.make({
        message: `Invalid value for ${headerName}: ${option}`,
        cause: O.none(),
      });
    });

    const create: (
      option?: undefined | PermittedCrossDomainPoliciesOption,
      headerValueCreator?: undefined | typeof createValue
    ) => Effect.Effect<O.Option<internal.ResponseHeader>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | PermittedCrossDomainPoliciesOption,
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
 * Type for rendered `X-Permitted-Cross-Domain-Policies` response headers.
 *
 * **Example** (Type annotated header value)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import {
 *   PermittedCrossDomainPoliciesResponseHeader,
 *   type PermittedCrossDomainPoliciesHeader,
 * } from "@beep/schema/PermittedCrossDomainPolicies"
 *
 * const header: PermittedCrossDomainPoliciesHeader = PermittedCrossDomainPoliciesResponseHeader.make({
 *   name: "X-Permitted-Cross-Domain-Policies",
 *   value: O.some("none"),
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PermittedCrossDomainPoliciesHeader = typeof PermittedCrossDomainPoliciesHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  PermittedCrossDomainPoliciesOption as Option,
  PermittedCrossDomainPoliciesResponseHeader as ResponseHeader,
  PermittedCrossDomainPoliciesValue as Value,
};

/**
 * Concise alias for {@link PermittedCrossDomainPoliciesHeader}.
 *
 * **Example** (Decode via Header alias)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Header } from "@beep/schema/PermittedCrossDomainPolicies"
 *
 * const header = S.decodeUnknownSync(Header)("none")
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Header = PermittedCrossDomainPoliciesHeader;

/**
 * Type-level representation of {@link Header}.
 *
 * **Example** (Type annotated Header alias)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { PermittedCrossDomainPoliciesResponseHeader, type Header } from "@beep/schema/PermittedCrossDomainPolicies"
 *
 * const header: Header = PermittedCrossDomainPoliciesResponseHeader.make({
 *   name: "X-Permitted-Cross-Domain-Policies",
 *   value: O.some("none"),
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Header = typeof Header.Type;
