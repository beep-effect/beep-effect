/**
 * Schema for the `X-XSS-Protection` header.
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
import { XssProtectionError } from "../SecureHeaderError/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("XssProtection");

const headerName = "X-XSS-Protection" as const;

const XSSProtectionModeBase = LiteralKit(["sanitize", "block-rendering"]);

/**
 * Schema for direct `X-XSS-Protection` policy modes.
 *
 * **Example** (Validate block-rendering mode)
 *
 * ```ts import.meta.vitest name="Validate block-rendering mode"
 * import * as S from "effect/Schema"
 * import { XSSProtectionMode } from "@beep/schema/XssProtection"
 *
 * S.is(XSSProtectionMode)("block-rendering") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XSSProtectionMode = XSSProtectionModeBase.pipe(
  $I.annoteSchema("XSSProtectionMode", {
    description: "The direct `X-XSS-Protection` policy modes.",
  }),
  SchemaUtils.withLiteralKitStatics(XSSProtectionModeBase)
);

/**
 * Type for direct `X-XSS-Protection` policy modes.
 *
 * **Example** (Assign block-rendering mode)
 *
 * ```ts import.meta.vitest name="Assign block-rendering mode"
 * import type { XSSProtectionMode } from "@beep/schema/XssProtection"
 *
 * const mode: XSSProtectionMode = "block-rendering"
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XSSProtectionMode = typeof XSSProtectionMode.Type;

/**
 * Configuration for `X-XSS-Protection` report mode.
 *
 * **Example** (Make report config)
 *
 * ```ts import.meta.vitest name="Make report config"
 * import { XSSProtectionReportConfig } from "@beep/schema/XssProtection"
 *
 * const config = XSSProtectionReportConfig.make({ uri: "https://example.com/report" })
 * console.log(config.uri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XSSProtectionReportConfig extends S.Class<XSSProtectionReportConfig>($I`XSSProtectionReportConfig`)(
  {
    uri: internal.StringOrUrl,
  },
  $I.annote("XSSProtectionReportConfig", {
    description: "Configuration for the `X-XSS-Protection` report mode.",
  })
) {}

/**
 * Schema for tuple-based `X-XSS-Protection` report configuration.
 *
 * **Example** (Decode report tuple)
 *
 * ```ts import.meta.vitest name="Decode report tuple"
 * import * as S from "effect/Schema"
 * import { XSSProtectionReport, XSSProtectionReportConfig } from "@beep/schema/XssProtection"
 *
 * const value = S.decodeUnknownSync(XSSProtectionReport)([
 *   "report",
 *   XSSProtectionReportConfig.make({ uri: "https://example.com/report" }),
 * ])
 * console.log(value[0])
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XSSProtectionReport = S.Tuple([S.Literal("report"), XSSProtectionReportConfig]).pipe(
  $I.annoteSchema("XSSProtectionReport", {
    description: "Tuple form used to configure `X-XSS-Protection` report mode.",
  })
);

/**
 * Type for tuple-based `X-XSS-Protection` report configuration.
 *
 * **Example** (Assign report tuple)
 *
 * ```ts import.meta.vitest name="Assign report tuple"
 * import { XSSProtectionReportConfig, type XSSProtectionReport } from "@beep/schema/XssProtection"
 *
 * const value: XSSProtectionReport = ["report", XSSProtectionReportConfig.make({ uri: "https://example.com/report" })]
 * console.log(value[0])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XSSProtectionReport = typeof XSSProtectionReport.Type;

/**
 * Schema for enabled, disabled, or report-mode XSS protection options.
 *
 * **Example** (Decode sanitize option)
 *
 * ```ts import.meta.vitest name="Decode sanitize option"
 * import * as S from "effect/Schema"
 * import { XSSProtectionOption } from "@beep/schema/XssProtection"
 *
 * console.log(S.decodeUnknownSync(XSSProtectionOption)("sanitize"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XSSProtectionOption = S.Union([S.Literal(false), XSSProtectionMode, XSSProtectionReport]).pipe(
  $I.annoteSchema("XSSProtectionOption", {
    description: "The supported `X-XSS-Protection` option values.",
  })
);

/**
 * Type for enabled, disabled, or report-mode XSS protection options.
 *
 * **Example** (Assign sanitize option)
 *
 * ```ts import.meta.vitest name="Assign sanitize option"
 * import type { XSSProtectionOption } from "@beep/schema/XssProtection"
 *
 * const option: XSSProtectionOption = "sanitize"
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XSSProtectionOption = typeof XSSProtectionOption.Type;

/**
 * Model for a rendered `X-XSS-Protection` response header.
 *
 * **Example** (Make response header)
 *
 * ```ts import.meta.vitest name="Make response header"
 * import * as O from "effect/Option"
 * import { XSSProtectionResponseHeader } from "@beep/schema/XssProtection"
 *
 * const header = XSSProtectionResponseHeader.make({ name: "X-XSS-Protection", value: O.some("1") })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class XSSProtectionResponseHeader extends S.Class<XSSProtectionResponseHeader>($I`XSSProtectionResponseHeader`)(
  {
    name: S.tag(headerName),
    value: S.OptionFromUndefinedOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("XSSProtectionResponseHeader", {
    description: "The `X-XSS-Protection` response header.",
  })
) {}

type XSSProtectionResponseHeaderEncoded = typeof XSSProtectionResponseHeader.Encoded;

const encodeReportUri = (value: internal.StringOrUrl): Effect.Effect<string, XssProtectionError> =>
  Effect.try({
    try: () => internal.encodeStrictURI(value),
    catch: () =>
      XssProtectionError.make({
        message: `Invalid value for ${headerName}: ${String(value)}`,
        cause: O.none(),
      }),
  });

const formatXSSProtectionValue = Effect.fn("XSSProtection.formatXSSProtectionValue")(function* (
  option: undefined | XSSProtectionOption
): Effect.fn.Return<string, XssProtectionError> {
  if (P.isUndefined(option) || option === "sanitize") {
    return "1";
  }

  if (option === false) {
    return "0";
  }

  if (option === "block-rendering") {
    return "1; mode=block";
  }

  if (A.isArray(option) && option[0] === "report") {
    const uri = yield* encodeReportUri(option[1].uri);

    return `1; report=${uri}`;
  }

  return yield* XssProtectionError.make({
    message: `Invalid value for ${headerName}: ${option}`,
    cause: O.none(),
  });
});

/**
 * Schema that renders XSS protection options into a response header.
 *
 * **Example** (Decode block-rendering header)
 *
 * ```ts import.meta.vitest name="Decode block-rendering header"
 * import * as S from "effect/Schema"
 * import { XSSProtectionHeader } from "@beep/schema/XssProtection"
 *
 * const header = S.decodeUnknownSync(XSSProtectionHeader)("block-rendering")
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XSSProtectionHeader = S.Union([XSSProtectionOption, S.Undefined]).pipe(
  S.decodeTo(
    XSSProtectionResponseHeader,
    SchemaTransformation.transformOrFail({
      decode: Effect.fnUntraced(function* (input): Effect.fn.Return<
        XSSProtectionResponseHeaderEncoded,
        SchemaIssue.Issue
      > {
        return yield* formatXSSProtectionValue(input).pipe(
          Effect.map((value) => ({
            name: headerName,
            value,
          })),
          Effect.mapError((error) => new SchemaIssue.InvalidValue({ message: error.message }))
        );
      }),
      encode: internal.makeHeaderEncodeForbidden("XSSProtectionHeader"),
    })
  ),
  $I.annoteSchema("XSSProtectionHeader", {
    description: "A one-way schema that decodes `X-XSS-Protection` options into the response header.",
  }),
  SchemaUtils.withStatics(() => {
    const createValue: (
      option?: undefined | XSSProtectionOption
    ) => Effect.Effect<O.Option<string>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | XSSProtectionOption
    ) {
      return O.some(yield* formatXSSProtectionValue(option));
    });

    const create = Effect.fnUntraced(function* (
      option?: undefined | XSSProtectionOption,
      headerValueCreator: typeof createValue = createValue
    ): Effect.fn.Return<O.Option<internal.ResponseHeader>, SecureHeaderError> {
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
 * Type for rendered `X-XSS-Protection` response headers.
 *
 * **Example** (Assign response header type)
 *
 * ```ts import.meta.vitest name="Assign response header type"
 * import * as O from "effect/Option"
 * import { XSSProtectionResponseHeader, type XSSProtectionHeader } from "@beep/schema/XssProtection"
 *
 * const header: XSSProtectionHeader = XSSProtectionResponseHeader.make({ name: "X-XSS-Protection", value: O.some("1") })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XSSProtectionHeader = typeof XSSProtectionHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { XSSProtectionMode as Mode, XSSProtectionResponseHeader as ResponseHeader };

/**
 * Concise alias for {@link XSSProtectionOption}.
 *
 * **Example** (Decode sanitize via alias)
 *
 * ```ts import.meta.vitest name="Decode sanitize via alias"
 * import * as S from "effect/Schema"
 * import { Option } from "@beep/schema/XssProtection"
 *
 * console.log(S.decodeUnknownSync(Option)("sanitize"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Option = XSSProtectionOption;

/**
 * Type-level representation of {@link Option}.
 *
 * **Example** (Assign Option alias type)
 *
 * ```ts import.meta.vitest name="Assign Option alias type"
 * import type { Option } from "@beep/schema/XssProtection"
 *
 * const option: Option = "sanitize"
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Option = typeof Option.Type;

/**
 * Concise alias for {@link XSSProtectionHeader}.
 *
 * **Example** (Decode header via alias)
 *
 * ```ts import.meta.vitest name="Decode header via alias"
 * import * as S from "effect/Schema"
 * import { Header } from "@beep/schema/XssProtection"
 *
 * const header = S.decodeUnknownSync(Header)("block-rendering")
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Header = XSSProtectionHeader;

/**
 * Type-level representation of {@link Header}.
 *
 * **Example** (Assign Header alias type)
 *
 * ```ts import.meta.vitest name="Assign Header alias type"
 * import * as O from "effect/Option"
 * import { XSSProtectionResponseHeader, type Header } from "@beep/schema/XssProtection"
 *
 * const header: Header = XSSProtectionResponseHeader.make({ name: "X-XSS-Protection", value: O.some("1") })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Header = typeof Header.Type;
