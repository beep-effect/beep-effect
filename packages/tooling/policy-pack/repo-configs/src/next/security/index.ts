/**
 * Secure header helpers for shared Next.js configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { pipe } from "effect";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { NextConfig } from "next";

const $I = $RepoConfigsId.create("next/security/index");

const defaultHeaderSource = "/(.*)";
const isFalse = (value: unknown): value is false => Eq.equals(false)(value);

/**
 * A secure HTTP response header emitted through Next.js `headers()`.
 *
 * @example
 * ```ts
 * import { SecureHeader } from "@beep/repo-configs/next/security"
 * const header = SecureHeader.make({
 *   key: "X-Content-Type-Options",
 *   value: "nosniff"
 * })
 * console.log(header)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class SecureHeader extends S.Class<SecureHeader>($I`SecureHeader`)(
  {
    key: S.String.annotateKey({
      description: "HTTP response header name.",
    }),
    value: S.String.annotateKey({
      description: "HTTP response header value.",
    }),
  },
  $I.annote("SecureHeader", {
    description: "A secure HTTP response header emitted through Next.js headers().",
  })
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
 * @example
 * ```ts
 * import { DEFAULT_BEEP_SECURE_HEADERS } from "@beep/repo-configs/next/security"
 * const headers = DEFAULT_BEEP_SECURE_HEADERS
 * console.log(headers)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_BEEP_SECURE_HEADERS: ReadonlyArray<SecureHeader> = defaultBeepSecureHeaders;

class SecureHeadersConfigValue extends S.Class<SecureHeadersConfigValue>($I`SecureHeadersConfigValue`)(
  {
    source: S.String.pipe(SchemaUtils.withKeyDefaults(defaultHeaderSource)).annotateKey({
      description: "Next.js route source receiving the secure headers.",
    }),
    headers: HeaderList.pipe(SchemaUtils.withKeyDefaults(defaultBeepSecureHeaders)).annotateKey({
      description: "Replacement secure header list.",
    }),
    additionalHeaders: HeaderList.pipe(SchemaUtils.withKeyDefaults(emptySecureHeaders)).annotateKey({
      description: "Additional secure headers merged with the repo default list.",
    }),
  },
  $I.annote("SecureHeadersConfigValue", {
    description: "Object form of shared secure-header configuration for the repo Next.js preset.",
  })
) {}

/**
 * Shared secure-header configuration for the repo Next.js preset.
 *
 * @remarks
 * `false` disables shared secure headers. An object with `headers` replaces
 * the repo default set; an object with `additionalHeaders` merges additively
 * with app values winning by header key.
 * @example
 * ```ts
 * import type { SecureHeadersConfig } from "@beep/repo-configs/next/security"
 * const config: SecureHeadersConfig = {
 *   additionalHeaders: [{ key: "X-Beep", value: "1" }]
 * }
 * console.log(config)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const SecureHeadersConfig = S.Union([S.Literal(false), SecureHeadersConfigValue]).pipe(
  $I.annoteSchema("SecureHeadersConfig", {
    description: "Shared secure-header configuration for the repo Next.js preset.",
  })
);

/**
 * Shared secure-header configuration for the repo Next.js preset.
 *
 * @example
 * ```ts
 * import type { SecureHeadersConfig } from "@beep/repo-configs/next/security"
 * const config: SecureHeadersConfig = {
 *   source: "/(.*)"
 * }
 * console.log(config)
 * ```
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

const configValue = (config: SecureHeadersConfig | undefined): O.Option<SecureHeadersConfigObject> => {
  if (isFalse(config)) return O.none();
  if (P.isUndefined(config)) return O.none();
  return O.some(config);
};

const headerSource = (config: SecureHeadersConfig | undefined): string =>
  pipe(
    configValue(config),
    O.map((value) => value.source),
    O.getOrElse(() => defaultHeaderSource)
  );

/**
 * Build the secure header list for the shared Next.js preset.
 *
 * @param config - Secure header override or extension settings.
 * @returns The secure HTTP header list to attach to the Next.js config.
 * @example
 * ```ts
 * import { makeSecureHeaders } from "@beep/repo-configs/next/security"
 * const headers = makeSecureHeaders({
 *   additionalHeaders: [{ key: "X-Beep", value: "1" }]
 * })
 * console.log(headers)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const makeSecureHeaders = (config?: SecureHeadersConfig): ReadonlyArray<SecureHeader> =>
  pipe(
    configValue(config),
    O.map((value) => mergeHeadersByKey(value.headers, value.additionalHeaders)),
    O.getOrElse(() => (isFalse(config) ? A.empty<SecureHeader>() : DEFAULT_BEEP_SECURE_HEADERS))
  );

/**
 * Add shared secure headers to a Next.js config.
 *
 * @param config - Base Next.js configuration receiving secure headers.
 * @param secureHeadersConfig - Secure header override or extension settings.
 * @returns A Next.js configuration with the shared secure-header route prepended.
 * @remarks
 * Existing app `headers()` are called only when Next.js calls the composed
 * `headers()` function. The shared secure-header route is prepended so app
 * routes remain visible and can add more specific behavior after the baseline.
 * @example
 * ```ts
 * import { withSecureHeaders } from "@beep/repo-configs/next/security"
 * const config = withSecureHeaders({ reactStrictMode: true })
 * console.log(config)
 * ```
 * @category combinators
 * @since 0.0.0
 */
export const withSecureHeaders = (config: NextConfig, secureHeadersConfig?: SecureHeadersConfig): NextConfig =>
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
