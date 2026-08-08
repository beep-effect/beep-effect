/**
 * Aggregate secure-header option schema and creation helpers.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity";
import { A } from "@beep/utils";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CrossOriginEmbedderPolicyHeader,
  CrossOriginEmbedderPolicyOption,
} from "../CrossOriginEmbedderPolicy/index.ts";
import { CrossOriginOpenerPolicyHeader, CrossOriginOpenerPolicyOption } from "../CrossOriginOpenerPolicy/index.ts";
import {
  CrossOriginResourcePolicyHeader,
  CrossOriginResourcePolicyOption,
} from "../CrossOriginResourcePolicy/index.ts";
import { ContentSecurityPolicyHeader, ContentSecurityPolicyOption } from "../Csp/index.ts";
import { ExpectCTHeader, ExpectCTOption } from "../ExpectCt/index.ts";
import { ForceHttpsRedirectHeader, ForceHttpsRedirectOption } from "../ForceHttpsRedirect/index.ts";
import { FrameGuardHeader, FrameGuardOption } from "../FrameGuard/index.ts";
import { NoOpenHeader, NoOpenOption } from "../NoOpen/index.ts";
import { NoSniffHeader, NoSniffOption } from "../NoSniff/index.ts";
import { PermissionsPolicyHeader, PermissionsPolicyOption } from "../PermissionsPolicy/index.ts";
import {
  PermittedCrossDomainPoliciesHeader,
  PermittedCrossDomainPoliciesOption,
} from "../PermittedCrossDomainPolicies/index.ts";
import { ReferrerPolicyHeader, ReferrerPolicyOption } from "../ReferrerPolicy/index.ts";
import { XSSProtectionHeader, XSSProtectionOption } from "../XssProtection/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("SecureHeaderOptions");

type ResolvedHeader = {
  readonly name: string;
  readonly value: string;
};

/**
 * Aggregate input options for configuring all secure response headers.
 *
 * **Example** (Make SecureHeaderOptions instance)
 *
 * ```ts
 * import { SecureHeaderOptions } from "@beep/schema/SecureHeaderOptions"
 *
 * const options = SecureHeaderOptions.make({ nosniff: "nosniff" })
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SecureHeaderOptions extends S.Class<SecureHeaderOptions>($I`SecureHeaderOptions`)(
  {
    contentSecurityPolicy: S.optionalKey(ContentSecurityPolicyOption),
    crossOriginEmbedderPolicy: S.optionalKey(CrossOriginEmbedderPolicyOption),
    crossOriginOpenerPolicy: S.optionalKey(CrossOriginOpenerPolicyOption),
    crossOriginResourcePolicy: S.optionalKey(CrossOriginResourcePolicyOption),
    expectCT: S.optionalKey(ExpectCTOption),
    forceHttpsRedirect: S.optionalKey(ForceHttpsRedirectOption),
    frameGuard: S.optionalKey(FrameGuardOption),
    noopen: S.optionalKey(NoOpenOption),
    nosniff: S.optionalKey(NoSniffOption),
    permissionsPolicy: S.optionalKey(PermissionsPolicyOption),
    permittedCrossDomainPolicies: S.optionalKey(PermittedCrossDomainPoliciesOption),
    referrerPolicy: S.optionalKey(ReferrerPolicyOption),
    xssProtection: S.optionalKey(XSSProtectionOption),
  },
  $I.annote("SecureHeaderOptions", {
    description: "Aggregate input options for secure response-header creation.",
  })
) {}

/**
 * A rendered secure header pair in `{ key, value }` format.
 *
 * **Example** (Make SecureHeaderEntry pair)
 *
 * ```ts
 * import { SecureHeaderEntry } from "@beep/schema/SecureHeaderOptions"
 *
 * const entry = SecureHeaderEntry.make({ key: "X-Content-Type-Options", value: "nosniff" })
 * console.log(entry)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SecureHeaderEntry extends S.Class<SecureHeaderEntry>($I`SecureHeaderEntry`)(
  {
    key: S.String,
    value: S.String,
  },
  $I.annote("SecureHeaderEntry", {
    description: "A rendered secure header pair in `{ key, value }` format.",
  })
) {}

const resolveHeaders = Effect.fnUntraced(function* (
  options: SecureHeaderOptions = {}
): Effect.fn.Return<ReadonlyArray<ResolvedHeader>, SecureHeaderError> {
  const headerEffects = A.make(
    ContentSecurityPolicyHeader.create(options.contentSecurityPolicy),
    CrossOriginEmbedderPolicyHeader.create(options.crossOriginEmbedderPolicy),
    CrossOriginOpenerPolicyHeader.create(options.crossOriginOpenerPolicy),
    CrossOriginResourcePolicyHeader.create(options.crossOriginResourcePolicy),
    ExpectCTHeader.create(options.expectCT),
    ForceHttpsRedirectHeader.create(options.forceHttpsRedirect),
    FrameGuardHeader.create(options.frameGuard),
    NoOpenHeader.create(options.noopen),
    NoSniffHeader.create(options.nosniff),
    PermissionsPolicyHeader.create(options.permissionsPolicy),
    PermittedCrossDomainPoliciesHeader.create(options.permittedCrossDomainPolicies),
    ReferrerPolicyHeader.create(options.referrerPolicy),
    XSSProtectionHeader.create(options.xssProtection)
  );

  const headers = yield* Effect.all(headerEffects, {
    concurrency: headerEffects.length,
  });

  let resolvedHeaders = A.empty<ResolvedHeader>();

  A.forEach(headers, (headerOption) => {
    if (O.isNone(headerOption)) {
      return;
    }

    const header = headerOption.value;

    if (O.isNone(header.value)) {
      return;
    }

    resolvedHeaders = A.append(resolvedHeaders, {
      name: header.name,
      value: header.value.value,
    });
  });

  return resolvedHeaders;
});

/**
 * Resolve secure-header options into a plain `Record<string, string>` header object.
 *
 * **Example** (Create headers record object)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { createHeadersObject } from "@beep/schema/SecureHeaderOptions"
 *
 * const headers = Effect.runSync(createHeadersObject({ nosniff: "nosniff" }))
 * console.log(headers["X-Content-Type-Options"]) // "nosniff"
 * ```
 *
 * @effects
 * Resolves configured secure-header options in memory; it performs no I/O.
 * @category constructors
 * @since 0.0.0
 */
export const createHeadersObject = Effect.fn("SecureHeaderOptions.createHeadersObject")(function* (
  options: SecureHeaderOptions = {}
): Effect.fn.Return<Record<string, string>, SecureHeaderError> {
  const headers = yield* resolveHeaders(options);

  return pipe(
    headers,
    A.reduce({} as Record<string, string>, (acc, header) => ({
      ...acc,
      [header.name]: header.value,
    }))
  );
});

/**
 * Resolve secure-header options into an array of {@link SecureHeaderEntry} pairs.
 *
 * **Example** (Create SecureHeaderEntry array)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { createSecureHeaders } from "@beep/schema/SecureHeaderOptions"
 *
 * const headers = Effect.runSync(createSecureHeaders({ nosniff: "nosniff" }))
 * console.log(headers[0]?.key) // "X-Content-Type-Options"
 * ```
 *
 * @effects
 * Resolves configured secure-header options in memory; it performs no I/O.
 * @category constructors
 * @since 0.0.0
 */
export const createSecureHeaders = Effect.fn("SecureHeaderOptions.createSecureHeaders")(function* (
  options: SecureHeaderOptions = {}
): Effect.fn.Return<ReadonlyArray<SecureHeaderEntry>, SecureHeaderError> {
  const headers = yield* resolveHeaders(options);

  return A.map(headers, (header) =>
    SecureHeaderEntry.make({
      key: header.name,
      value: header.value,
    })
  );
});

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { SecureHeaderOptions as Schema };
