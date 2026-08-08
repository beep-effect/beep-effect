/**
 * Schema for the `Permissions-Policy` header.
 *
 * @since 0.0.0
 * @packageDocumentation
 */
import { $SchemaId } from "@beep/identity";
import { A, Struct } from "@beep/utils";
import { Effect, pipe, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as internal from "../Http/Http.headers.shared.ts";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { PermissionsPolicyError } from "../SecureHeaderError/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("PermissionsPolicy");

const headerName = "Permissions-Policy" as const;
const quotedOriginPattern = /^".*"$/;

const PermissionsPolicyDirectiveBase = LiteralKit([
  "accelerometer",
  "ambient-light-sensor",
  "autoplay",
  "battery",
  "camera",
  "cross-origin-isolated",
  "display-capture",
  "document-domain",
  "encrypted-media",
  "execution-while-not-rendered",
  "execution-while-out-of-viewport",
  "fullscreen",
  "geolocation",
  "gyroscope",
  "keyboard-map",
  "magnetometer",
  "microphone",
  "midi",
  "navigation-override",
  "payment",
  "picture-in-picture",
  "publickey-credentials-get",
  "screen-wake-lock",
  "sync-xhr",
  "usb",
  "web-share",
  "xr-spatial-tracking",
]);

/**
 * Schema for supported `Permissions-Policy` directive names.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PermissionsPolicyDirective } from "@beep/schema/PermissionsPolicy"
 *
 * console.log(S.is(PermissionsPolicyDirective)("camera")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermissionsPolicyDirective = PermissionsPolicyDirectiveBase.pipe(
  $I.annoteSchema("PermissionsPolicyDirective", {
    description: "The supported directive names for the `Permissions-Policy` header.",
  }),
  SchemaUtils.withLiteralKitStatics(PermissionsPolicyDirectiveBase)
);

/**
 * Type for supported `Permissions-Policy` directive names.
 *
 * @example
 * ```ts
 * import type { PermissionsPolicyDirective } from "@beep/schema/PermissionsPolicy"
 *
 * const directive: PermissionsPolicyDirective = "camera"
 * console.log(directive)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PermissionsPolicyDirective = typeof PermissionsPolicyDirective.Type;

/**
 * Schema for record keys accepted by `PermissionsPolicyDirectives`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PermissionsPolicyDirectiveKey } from "@beep/schema/PermissionsPolicy"
 *
 * console.log(S.decodeUnknownSync(PermissionsPolicyDirectiveKey)("fullscreen"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermissionsPolicyDirectiveKey = S.String.check(
  S.makeFilter(S.is(PermissionsPolicyDirective), {
    identifier: "PermissionsPolicyDirectiveKey",
    title: "PermissionsPolicyDirectiveKey",
    description: "A valid `Permissions-Policy` directive name.",
    message: "Invalid directive name",
  })
).pipe(
  $I.annoteSchema("PermissionsPolicyDirectiveKey", {
    description: "A validated `Permissions-Policy` directive record key.",
  })
);

/**
 * Type for record keys accepted by `PermissionsPolicyDirectives`.
 *
 * @example
 * ```ts
 * import type { PermissionsPolicyDirectiveKey } from "@beep/schema/PermissionsPolicy"
 *
 * const key: PermissionsPolicyDirectiveKey = "fullscreen"
 * console.log(key)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PermissionsPolicyDirectiveKey = typeof PermissionsPolicyDirectiveKey.Type;

/**
 * Schema for quoted origin values in directive allowlists.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { QuotedOrigin } from "@beep/schema/PermissionsPolicy"
 *
 * console.log(S.decodeUnknownSync(QuotedOrigin)("\"https://example.com\""))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QuotedOrigin = S.String.check(
  S.isPattern(quotedOriginPattern, {
    title: "QuotedOrigin",
    description: "A quoted origin string.",
    message: "Origin must be quoted",
  })
).pipe(
  $I.annoteSchema("QuotedOrigin", {
    description: "A quoted origin value used by `Permissions-Policy`.",
  })
);

/**
 * Type for quoted origin values in directive allowlists.
 *
 * @example
 * ```ts
 * import type { QuotedOrigin } from "@beep/schema/PermissionsPolicy"
 *
 * const origin: QuotedOrigin = '"https://example.com"'
 * console.log(origin)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type QuotedOrigin = typeof QuotedOrigin.Type;

const PermissionsPolicyDirectiveValueSingleBase = LiteralKit(["*", "self", "none"]);

/**
 * Schema for single-token directive allowlist values.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PermissionsPolicyDirectiveValueSingle } from "@beep/schema/PermissionsPolicy"
 *
 * console.log(S.is(PermissionsPolicyDirectiveValueSingle)("self")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermissionsPolicyDirectiveValueSingle = PermissionsPolicyDirectiveValueSingleBase.pipe(
  $I.annoteSchema("PermissionsPolicyDirectiveValueSingle", {
    description: "Single-value `Permissions-Policy` allowlist forms.",
  }),
  SchemaUtils.withLiteralKitStatics(PermissionsPolicyDirectiveValueSingleBase)
);

/**
 * Type for single-token directive allowlist values.
 *
 * @example
 * ```ts
 * import type { PermissionsPolicyDirectiveValueSingle } from "@beep/schema/PermissionsPolicy"
 *
 * const value: PermissionsPolicyDirectiveValueSingle = "self"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PermissionsPolicyDirectiveValueSingle = typeof PermissionsPolicyDirectiveValueSingle.Type;

/**
 * Schema for origins accepted inside list-valued directives.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PermissionsPolicyAllowlistedOrigin } from "@beep/schema/PermissionsPolicy"
 *
 * console.log(S.decodeUnknownSync(PermissionsPolicyAllowlistedOrigin)("self"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermissionsPolicyAllowlistedOrigin = S.Union([S.Literal("self"), QuotedOrigin]).pipe(
  $I.annoteSchema("PermissionsPolicyAllowlistedOrigin", {
    description: "A `Permissions-Policy` allowlisted origin item.",
  })
);

/**
 * Type for origins accepted inside list-valued directives.
 *
 * @example
 * ```ts
 * import type { PermissionsPolicyAllowlistedOrigin } from "@beep/schema/PermissionsPolicy"
 *
 * const origin: PermissionsPolicyAllowlistedOrigin = "self"
 * console.log(origin)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PermissionsPolicyAllowlistedOrigin = typeof PermissionsPolicyAllowlistedOrigin.Type;

/**
 * Schema for any directive value accepted by `Permissions-Policy`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PermissionsPolicyDirectiveValue } from "@beep/schema/PermissionsPolicy"
 *
 * console.log(S.decodeUnknownSync(PermissionsPolicyDirectiveValue)(["self"]))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermissionsPolicyDirectiveValue = S.Union([
  PermissionsPolicyDirectiveValueSingle,
  QuotedOrigin,
  S.Array(PermissionsPolicyAllowlistedOrigin),
]).pipe(
  $I.annoteSchema("PermissionsPolicyDirectiveValue", {
    description: "A `Permissions-Policy` directive value.",
  })
);

/**
 * Type for any directive value accepted by `Permissions-Policy`.
 *
 * @example
 * ```ts
 * import type { PermissionsPolicyDirectiveValue } from "@beep/schema/PermissionsPolicy"
 *
 * const value: PermissionsPolicyDirectiveValue = ["self"]
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PermissionsPolicyDirectiveValue = typeof PermissionsPolicyDirectiveValue.Type;

/**
 * Schema for a directive map used to build the header value.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PermissionsPolicyDirectives } from "@beep/schema/PermissionsPolicy"
 *
 * const directives = S.decodeUnknownSync(PermissionsPolicyDirectives)({ camera: "none" })
 * console.log(directives.camera)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermissionsPolicyDirectives = S.Record(
  PermissionsPolicyDirectiveKey,
  PermissionsPolicyDirectiveValue
).pipe(
  $I.annoteSchema("PermissionsPolicyDirectives", {
    description: "A record of `Permissions-Policy` directives to allowlist values.",
  })
);

/**
 * Type for a directive map used to build the header value.
 *
 * @example
 * ```ts
 * import type { PermissionsPolicyDirectives } from "@beep/schema/PermissionsPolicy"
 *
 * const directives: PermissionsPolicyDirectives = { camera: "none" }
 * console.log(directives.camera)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PermissionsPolicyDirectives = typeof PermissionsPolicyDirectives.Type;

/**
 * Structured configuration for the `Permissions-Policy` header.
 *
 * @example
 * ```ts
 * import { PermissionsPolicyOptionStruct } from "@beep/schema/PermissionsPolicy"
 *
 * const option = PermissionsPolicyOptionStruct.make({ directives: { camera: "none" } })
 * console.log(option.directives.camera)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PermissionsPolicyOptionStruct extends S.Class<PermissionsPolicyOptionStruct>(
  $I`PermissionsPolicyOptionStruct`
)(
  {
    directives: PermissionsPolicyDirectives,
  },
  $I.annote("PermissionsPolicyOptionStruct", {
    description: "Structured configuration for the `Permissions-Policy` header.",
  })
) {}

/**
 * Schema for enabled or disabled `Permissions-Policy` configuration.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PermissionsPolicyOption } from "@beep/schema/PermissionsPolicy"
 *
 * console.log(S.decodeUnknownSync(PermissionsPolicyOption)(false))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermissionsPolicyOption = S.Union([S.Literal(false), PermissionsPolicyOptionStruct]).pipe(
  $I.annoteSchema("PermissionsPolicyOption", {
    description: "The supported `Permissions-Policy` option values.",
  })
);

/**
 * Type for enabled or disabled `Permissions-Policy` configuration.
 *
 * @example
 * ```ts
 * import type { PermissionsPolicyOption } from "@beep/schema/PermissionsPolicy"
 *
 * const option: PermissionsPolicyOption = false
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PermissionsPolicyOption = typeof PermissionsPolicyOption.Type;

/**
 * Model for the rendered `Permissions-Policy` response header.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { PermissionsPolicyResponseHeader } from "@beep/schema/PermissionsPolicy"
 *
 * const header = PermissionsPolicyResponseHeader.make({ name: "Permissions-Policy", value: O.some("camera=()") })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PermissionsPolicyResponseHeader extends S.Class<PermissionsPolicyResponseHeader>(
  $I`PermissionsPolicyResponseHeader`
)(
  {
    name: S.tag(headerName),
    value: S.OptionFromUndefinedOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PermissionsPolicyResponseHeader", {
    description: "The `Permissions-Policy` response header.",
  })
) {}

type PermissionsPolicyResponseHeaderEncoded = typeof PermissionsPolicyResponseHeader.Encoded;

const formatDirectiveValue = (value: PermissionsPolicyDirectiveValue): string => {
  if (value === "*") {
    return "*";
  }

  if (value === "none") {
    return "()";
  }

  if (value === "self") {
    return "(self)";
  }

  if (A.isArray(value)) {
    return `(${A.join(value, " ")})`;
  }

  return `(${value})`;
};

const buildHeaderValue = (directives: PermissionsPolicyDirectives): O.Option<string> =>
  pipe(
    Struct.entries(directives),
    A.map(([key, value]) => `${key}=${formatDirectiveValue(value)}`),
    A.match({
      onEmpty: O.none<string>,
      onNonEmpty: (parts) => O.some(A.join(parts, ", ")),
    })
  );

/**
 * Schema that renders options into a `Permissions-Policy` response header.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PermissionsPolicyHeader } from "@beep/schema/PermissionsPolicy"
 *
 * const header = S.decodeUnknownSync(PermissionsPolicyHeader)({ directives: { camera: "none" } })
 * console.log(header.value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermissionsPolicyHeader = S.Union([PermissionsPolicyOption, S.Undefined]).pipe(
  S.decodeTo(
    PermissionsPolicyResponseHeader,
    SchemaTransformation.transformOrFail({
      decode: (input): Effect.Effect<PermissionsPolicyResponseHeaderEncoded> =>
        Effect.succeed({
          name: headerName,
          value:
            P.isUndefined(input) || input === false ? undefined : O.getOrUndefined(buildHeaderValue(input.directives)),
        }),
      encode: internal.makeHeaderEncodeForbidden("PermissionsPolicyHeader"),
    })
  ),
  $I.annoteSchema("PermissionsPolicyHeader", {
    description: "A one-way schema that decodes `Permissions-Policy` options into the response header.",
  }),
  SchemaUtils.withStatics(() => {
    const createValue: (
      option?: undefined | PermissionsPolicyOption
    ) => Effect.Effect<O.Option<string>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | PermissionsPolicyOption
    ) {
      if (P.isUndefined(option) || option === false) {
        return O.none<string>();
      }

      const decodedOption = yield* S.decodeEffect(PermissionsPolicyOptionStruct)(option).pipe(
        Effect.mapError((cause) =>
          PermissionsPolicyError.make({
            message: cause.message,
            cause: O.none(),
          })
        )
      );

      return buildHeaderValue(decodedOption.directives);
    });

    const create: (
      option?: undefined | PermissionsPolicyOption,
      headerValueCreator?: undefined | typeof createValue
    ) => Effect.Effect<O.Option<internal.ResponseHeader>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | PermissionsPolicyOption,
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
 * Type for rendered `Permissions-Policy` response headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { PermissionsPolicyResponseHeader, type PermissionsPolicyHeader } from "@beep/schema/PermissionsPolicy"
 *
 * const header: PermissionsPolicyHeader = PermissionsPolicyResponseHeader.make({
 *   name: "Permissions-Policy",
 *   value: O.some("camera=()"),
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PermissionsPolicyHeader = typeof PermissionsPolicyHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { PermissionsPolicyResponseHeader as ResponseHeader };

/**
 * Concise alias for {@link PermissionsPolicyOption}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Option } from "@beep/schema/PermissionsPolicy"
 *
 * console.log(S.decodeUnknownSync(Option)(false))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Option = PermissionsPolicyOption;

/**
 * Type-level representation of {@link Option}.
 *
 * @example
 * ```ts
 * import type { Option } from "@beep/schema/PermissionsPolicy"
 *
 * const option: Option = false
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Option = typeof Option.Type;

/**
 * Concise alias for {@link PermissionsPolicyHeader}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Header } from "@beep/schema/PermissionsPolicy"
 *
 * const header = S.decodeUnknownSync(Header)({ directives: { camera: "none" } })
 * console.log(header.value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Header = PermissionsPolicyHeader;

/**
 * Type-level representation of {@link Header}.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { PermissionsPolicyResponseHeader, type Header } from "@beep/schema/PermissionsPolicy"
 *
 * const header: Header = PermissionsPolicyResponseHeader.make({
 *   name: "Permissions-Policy",
 *   value: O.some("camera=()"),
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Header = typeof Header.Type;
