/**
 * Secure header helpers for shared Next.js configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { NextConfig } from "next";

const $I = $RepoConfigsId.create("next/security/index");

const defaultHeaderSource = "/(.*)";
const isFalse = (value: unknown): value is false => Eq.equals(false)(value);

/**
 * **Example** (Make secure header instance)
 *
 * ```ts
 * import { SecureHeader } from "@beep/repo-configs/next/security"
 * const header = SecureHeader.make({
 *   key: "X-Content-Type-Options",
 *   value: "nosniff"
 * })
 * console.log(header)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SecureHeader extends S.Opaque<SecureHeader, { readonly brand: unique symbol }>()(
  S.Struct({
    key: S.String.annotateKey({
      description: "HTTP response header name.",
    }),
    value: S.String.annotateKey({
      description: "HTTP response header value.",
    }),
  }).pipe(
    $I.annoteSchema("SecureHeader", {
      description: "A secure HTTP response header emitted through Next.js headers().",
    })
  )
) {}

const HeaderList = SecureHeader.pipe(
  S.Array,
  S.mutable,
  $I.annoteSchema("SecureHeaderList", {
    description: "List of secure HTTP response headers.",
  })
);

const defaultBeepSecureHeaders: Array<SecureHeader> = [
  SecureHeader.make({
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  }),
  SecureHeader.make({
    key: "X-Content-Type-Options",
    value: "nosniff",
  }),
  SecureHeader.make({
    key: "X-Frame-Options",
    value: "DENY",
  }),
  SecureHeader.make({
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  }),
];
const emptySecureHeaders: Array<SecureHeader> = [];

/**
 * Default secure headers shared by current Next.js apps in this repo.
 *
 * **Example** (Log default secure headers)
 *
 * ```ts
 * import { DEFAULT_BEEP_SECURE_HEADERS } from "@beep/repo-configs/next/security"
 * const headers = DEFAULT_BEEP_SECURE_HEADERS
 * console.log(headers)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_BEEP_SECURE_HEADERS: ReadonlyArray<SecureHeader> = defaultBeepSecureHeaders;

/**
 * **Details**
 *
 * `source` is the Next.js route source receiving the headers; `additionalHeaders` are appended after
 * the shared defaults.
 *
 * **Example** (Add one header to the shared defaults)
 *
 * ```ts
 * import { DEFAULT_BEEP_SECURE_HEADERS, SecureHeader, SecureHeadersConfigValue } from "@beep/repo-configs/next/security"
 *
 * const config = SecureHeadersConfigValue.make({
 *   additionalHeaders: [SecureHeader.make({ key: "X-Robots-Tag", value: "noindex" })]
 * })
 *
 * console.log(config.source) // => "/(.*)"
 * console.log(config.headers.length === DEFAULT_BEEP_SECURE_HEADERS.length) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SecureHeadersConfigValue extends S.Opaque<SecureHeadersConfigValue, { readonly brand: unique symbol }>()(
  S.Struct({
    source: S.String.pipe(
      S.withConstructorDefault(Effect.succeed(defaultHeaderSource)),
      S.annotateKey({
        description: "Next.js route source receiving the secure headers.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultHeaderSource))
    ),
    headers: HeaderList.pipe(
      S.withConstructorDefault(Effect.succeed(defaultBeepSecureHeaders)),
      S.annotateKey({
        description: "Replacement secure header list.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultBeepSecureHeaders))
    ),
    additionalHeaders: HeaderList.pipe(
      S.withConstructorDefault(Effect.succeed(emptySecureHeaders)),
      S.annotateKey({
        description: "Additional secure headers merged with the repo default list.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed(emptySecureHeaders))
    ),
  }).pipe(
    $I.annoteSchema("SecureHeadersConfigValue", {
      description: "Object form of shared secure-header configuration for the repo Next.js preset.",
    })
  )
) {}

/**
 * **Details**
 *
 * `false` disables shared secure headers. An object with `headers` replaces
 * the repo default set; an object with `additionalHeaders` merges additively
 * with app values winning by header key.
 *
 * **Example** (Decode disabled and additive configs)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import { SecureHeadersConfig } from "@beep/repo-configs/next/security"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(SecureHeadersConfig)
 *
 * strictEqual(decode(false), false)
 *
 * const config = decode({ additionalHeaders: [{ key: "X-Beep", value: "1" }] })
 * if (config !== false) {
 *   strictEqual(config.source, "/(.*)")
 *   strictEqual(config.headers.length, 4)
 * }
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SecureHeadersConfig = S.Union([S.Literal(false), SecureHeadersConfigValue]).pipe(
  $I.annoteSchema("SecureHeadersConfig", {
    description: "Shared secure-header configuration for the repo Next.js preset.",
  })
);

/**
 * **Example** (Type secure headers config)
 *
 * ```ts
 * import type { SecureHeadersConfig } from "@beep/repo-configs/next/security"
 * import { SecureHeader, SecureHeadersConfigValue } from "@beep/repo-configs/next/security"
 *
 * const disabled: SecureHeadersConfig = false
 * const replaced: SecureHeadersConfig = SecureHeadersConfigValue.make({
 *   headers: [SecureHeader.make({ key: "X-Frame-Options", value: "DENY" })]
 * })
 * console.log(disabled, replaced)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SecureHeadersConfig = typeof SecureHeadersConfig.Type;

const replaceHeaderByKey = (headers: ReadonlyArray<SecureHeader>, header: SecureHeader): ReadonlyArray<SecureHeader> =>
  pipe(
    headers,
    A.filter((existing) => !Eq.equals(existing.key)(header.key)),
    A.append(header)
  );

const mergeHeadersByKey = (
  baseHeaders: ReadonlyArray<SecureHeader>,
  additionalHeaders: ReadonlyArray<SecureHeader>
): ReadonlyArray<SecureHeader> => pipe(additionalHeaders, A.reduce(baseHeaders, replaceHeaderByKey));

type SecureHeadersConfigObject = Exclude<SecureHeadersConfig, false>;
type SecureHeadersConfigObjectInput = {
  readonly source?: string | null | undefined;
  readonly headers?: ReadonlyArray<SecureHeader> | null | undefined;
  readonly additionalHeaders?: ReadonlyArray<SecureHeader> | null | undefined;
};

/**
 * Constructor input accepted by direct secure-header helpers.
 *
 * **Example** (Disable or set source)
 *
 * ```ts
 * import type { SecureHeadersConfigInput } from "@beep/repo-configs/next/security"
 * const disabled: SecureHeadersConfigInput = false
 * const withSource: SecureHeadersConfigInput = { source: "/api/:path*" }
 * console.log(disabled, withSource)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SecureHeadersConfigInput = false | SecureHeadersConfigObjectInput;

const decodeSecureHeadersConfigValue = S.decodeUnknownOption(SecureHeadersConfigValue);

const secureHeadersConfigValueInput = (value: SecureHeadersConfigObjectInput) => ({
  source: value.source ?? defaultHeaderSource,
  headers: value.headers ?? defaultBeepSecureHeaders,
  additionalHeaders: value.additionalHeaders ?? emptySecureHeaders,
});

const configValue = (config: SecureHeadersConfigInput | undefined): O.Option<SecureHeadersConfigObject> => {
  if (isFalse(config)) return O.none();
  if (P.isUndefined(config)) return O.none();
  return decodeSecureHeadersConfigValue(secureHeadersConfigValueInput(config));
};

const headerSource = (config: SecureHeadersConfigInput | undefined): string =>
  pipe(
    configValue(config),
    O.flatMap((value) => O.fromNullishOr(value.source)),
    O.getOrElse(() => defaultHeaderSource)
  );

/**
 * Build the secure header list for the shared Next.js preset.
 *
 * **Example** (Build secure header list)
 *
 * ```ts
 * import { makeSecureHeaders, SecureHeader } from "@beep/repo-configs/next/security"
 *
 * const headers = makeSecureHeaders({
 *   headers: [SecureHeader.make({ key: "X-Frame-Options", value: "DENY" })],
 *   additionalHeaders: [
 *     SecureHeader.make({ key: "X-Frame-Options", value: "SAMEORIGIN" }),
 *     SecureHeader.make({ key: "X-Beep", value: "1" })
 *   ]
 * })
 * console.log(headers.map((header) => `${header.key}: ${header.value}`))
 * // ["X-Frame-Options: SAMEORIGIN", "X-Beep: 1"]
 * ```
 *
 * @param config - Secure header override or extension settings.
 * @returns The secure HTTP header list to attach to the Next.js config.
 * @category constructors
 * @since 0.0.0
 */
export const makeSecureHeaders = (config?: SecureHeadersConfigInput): ReadonlyArray<SecureHeader> =>
  pipe(
    configValue(config),
    O.map((value) => mergeHeadersByKey(value.headers, value.additionalHeaders)),
    O.getOrElse(() => (isFalse(config) ? A.empty<SecureHeader>() : DEFAULT_BEEP_SECURE_HEADERS))
  );

/**
 * Add shared secure headers to a Next.js config.
 *
 * **Details**
 *
 * Existing app `headers()` are called only when Next.js calls the composed
 * `headers()` function. The shared secure-header route is prepended so app
 * routes remain visible and can add more specific behavior after the baseline.
 *
 * **Example** (Wrap Next.js config)
 *
 * ```ts
 * import { withSecureHeaders } from "@beep/repo-configs/next/security"
 * const config = withSecureHeaders()({ reactStrictMode: true })
 * console.log(config)
 * ```
 *
 * @param secureHeadersConfig - Secure header override or extension settings.
 * @returns A Next.js configuration with the shared secure-header route prepended.
 * @category combinators
 * @since 0.0.0
 */
export const withSecureHeaders =
  (secureHeadersConfig?: SecureHeadersConfigInput) =>
  (config: NextConfig): NextConfig =>
    pipe(
      makeSecureHeaders(secureHeadersConfig),
      A.match({
        onEmpty: () => config,
        onNonEmpty: (secureHeaders) => {
          const previousHeaders = config.headers;
          return {
            ...config,
            headers: () =>
              Promise.resolve(P.isFunction(previousHeaders) ? previousHeaders() : A.empty()).then((headers) => [
                {
                  source: headerSource(secureHeadersConfig),
                  headers: A.fromIterable(secureHeaders),
                },
                ...headers,
              ]),
          };
        },
      })
    );
