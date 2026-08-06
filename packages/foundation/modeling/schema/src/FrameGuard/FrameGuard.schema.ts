/**
 * Schema for the `X-Frame-Options` header.
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
import { FrameGuardError } from "../SecureHeaderError/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("FrameGuard");

const headerName = "X-Frame-Options" as const;
const defaultValue = "deny" as const;

const FrameGuardModeBase = LiteralKit(["deny", "sameorigin"]);

/**
 * Schema for direct `X-Frame-Options` policy modes.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { FrameGuardMode } from "@beep/schema/FrameGuard"
 *
 * console.log(S.is(FrameGuardMode)("deny")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FrameGuardMode = FrameGuardModeBase.pipe(
  $I.annoteSchema("FrameGuardMode", {
    description: "The direct `X-Frame-Options` policy values.",
  }),
  SchemaUtils.withLiteralKitStatics(FrameGuardModeBase)
);

/**
 * Type for direct `X-Frame-Options` policy modes.
 *
 * @example
 * ```ts
 * import type { FrameGuardMode } from "@beep/schema/FrameGuard"
 *
 * const mode: FrameGuardMode = "deny"
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FrameGuardMode = typeof FrameGuardMode.Type;

/**
 * Configuration for the deprecated `allow-from` frame guard mode.
 *
 * @example
 * ```ts
 * import { FrameGuardAllowFromConfig } from "@beep/schema/FrameGuard"
 *
 * const config = FrameGuardAllowFromConfig.make({ uri: "https://example.com" })
 * console.log(config.uri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrameGuardAllowFromConfig extends S.Class<FrameGuardAllowFromConfig>($I`FrameGuardAllowFromConfig`)(
  {
    uri: internal.StringOrUrl,
  },
  $I.annote("FrameGuardAllowFromConfig", {
    description: "Configuration for the deprecated `allow-from` `X-Frame-Options` variant.",
  })
) {}

/**
 * Schema for tuple-based `allow-from` frame guard configuration.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { FrameGuardAllowFrom, FrameGuardAllowFromConfig } from "@beep/schema/FrameGuard"
 *
 * const value = S.decodeUnknownSync(FrameGuardAllowFrom)([
 *   "allow-from",
 *   FrameGuardAllowFromConfig.make({ uri: "https://example.com" }),
 * ])
 * console.log(value[0])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FrameGuardAllowFrom = S.Tuple([S.Literal("allow-from"), FrameGuardAllowFromConfig]).pipe(
  $I.annoteSchema("FrameGuardAllowFrom", {
    description: "Tuple form used to configure `X-Frame-Options: allow-from`.",
  })
);

/**
 * Type for tuple-based `allow-from` frame guard configuration.
 *
 * @example
 * ```ts
 * import { FrameGuardAllowFromConfig, type FrameGuardAllowFrom } from "@beep/schema/FrameGuard"
 *
 * const value: FrameGuardAllowFrom = ["allow-from", FrameGuardAllowFromConfig.make({ uri: "https://example.com" })]
 * console.log(value[0])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FrameGuardAllowFrom = typeof FrameGuardAllowFrom.Type;

/**
 * Schema for enabled, disabled, or `allow-from` frame guard options.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { FrameGuardOption } from "@beep/schema/FrameGuard"
 *
 * console.log(S.decodeUnknownSync(FrameGuardOption)("sameorigin"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FrameGuardOption = S.Union([S.Literal(false), FrameGuardMode, FrameGuardAllowFrom]).pipe(
  $I.annoteSchema("FrameGuardOption", {
    description: "The supported `X-Frame-Options` option values.",
  })
);

/**
 * Type for enabled, disabled, or `allow-from` frame guard options.
 *
 * @example
 * ```ts
 * import type { FrameGuardOption } from "@beep/schema/FrameGuard"
 *
 * const option: FrameGuardOption = "sameorigin"
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FrameGuardOption = typeof FrameGuardOption.Type;

/**
 * Model for a rendered `X-Frame-Options` response header.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { FrameGuardResponseHeader } from "@beep/schema/FrameGuard"
 *
 * const header = FrameGuardResponseHeader.make({ name: "X-Frame-Options", value: O.some("deny") })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrameGuardResponseHeader extends S.Class<FrameGuardResponseHeader>($I`FrameGuardResponseHeader`)(
  {
    name: S.tag(headerName),
    value: S.OptionFromUndefinedOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("FrameGuardResponseHeader", {
    description: "The `X-Frame-Options` response header.",
  })
) {}

type FrameGuardResponseHeaderEncoded = typeof FrameGuardResponseHeader.Encoded;

const encodeAllowFromUri = (value: internal.StringOrUrl, message: string): Effect.Effect<string, FrameGuardError> =>
  Effect.try({
    try: () => internal.encodeStrictURI(value),
    catch: () =>
      FrameGuardError.make({
        message,
        cause: O.none(),
      }),
  });

const formatFrameGuardValue = Effect.fn("FrameGuard.formatFrameGuardValue")(function* (
  option: FrameGuardMode | FrameGuardAllowFrom
): Effect.fn.Return<string, FrameGuardError> {
  if (option === "deny" || option === "sameorigin") {
    return option;
  }

  if (A.isArray(option) && option[0] === "allow-from") {
    const uri = yield* encodeAllowFromUri(option[1].uri, `Invalid value for ${headerName}: ${String(option[1].uri)}`);

    return `${option[0]} ${uri}`;
  }

  return yield* FrameGuardError.make({
    message: `Invalid value for ${headerName}: ${option}`,
    cause: O.none(),
  });
});

/**
 * Schema that renders frame guard options into a response header.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { FrameGuardHeader } from "@beep/schema/FrameGuard"
 *
 * const header = S.decodeUnknownSync(FrameGuardHeader)("deny")
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FrameGuardHeader = S.Union([FrameGuardOption, S.Undefined]).pipe(
  S.decodeTo(
    FrameGuardResponseHeader,
    SchemaTransformation.transformOrFail({
      decode: Effect.fn("FrameGuard.decode")(function* (input): Effect.fn.Return<
        FrameGuardResponseHeaderEncoded,
        SchemaIssue.Issue
      > {
        if (P.isUndefined(input)) {
          return {
            name: headerName,
            value: defaultValue,
          } as const;
        }

        if (input === false) {
          return {
            name: headerName,
            value: undefined,
          } as const;
        }

        const value = yield* formatFrameGuardValue(input).pipe(
          Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }))
        );

        return {
          name: headerName,
          value,
        } as const;
      }),
      encode: internal.makeHeaderEncodeForbidden("FrameGuardHeader"),
    })
  ),
  $I.annoteSchema("FrameGuardHeader", {
    description: "A one-way schema that decodes `X-Frame-Options` options into the response header.",
  }),
  SchemaUtils.withStatics(() => {
    const createValue: (option?: undefined | FrameGuardOption) => Effect.Effect<O.Option<string>, SecureHeaderError> =
      Effect.fnUntraced(function* (option?: undefined | FrameGuardOption) {
        if (P.isUndefined(option)) {
          return O.some(defaultValue);
        }

        if (option === false) {
          return O.none<string>();
        }

        return O.some(yield* formatFrameGuardValue(option));
      });

    const create: (
      option?: undefined | FrameGuardOption,
      headerValueCreator?: undefined | typeof createValue
    ) => Effect.Effect<O.Option<internal.ResponseHeader>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | FrameGuardOption,
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
 * Type for rendered `X-Frame-Options` response headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { FrameGuardResponseHeader, type FrameGuardHeader } from "@beep/schema/FrameGuard"
 *
 * const header: FrameGuardHeader = FrameGuardResponseHeader.make({ name: "X-Frame-Options", value: O.some("deny") })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FrameGuardHeader = typeof FrameGuardHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { FrameGuardMode as Mode, FrameGuardResponseHeader as ResponseHeader };

/**
 * Concise alias for {@link FrameGuardOption}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Option } from "@beep/schema/FrameGuard"
 *
 * console.log(S.decodeUnknownSync(Option)("sameorigin"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Option = FrameGuardOption;

/**
 * Type-level representation of {@link Option}.
 *
 * @example
 * ```ts
 * import type { Option } from "@beep/schema/FrameGuard"
 *
 * const option: Option = "sameorigin"
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Option = typeof Option.Type;

/**
 * Concise alias for {@link FrameGuardHeader}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Header } from "@beep/schema/FrameGuard"
 *
 * const header = S.decodeUnknownSync(Header)("deny")
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Header = FrameGuardHeader;

/**
 * Type-level representation of {@link Header}.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { FrameGuardResponseHeader, type Header } from "@beep/schema/FrameGuard"
 *
 * const header: Header = FrameGuardResponseHeader.make({ name: "X-Frame-Options", value: O.some("deny") })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Header = typeof Header.Type;
