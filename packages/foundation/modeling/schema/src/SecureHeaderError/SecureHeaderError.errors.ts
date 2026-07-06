/**
 * CSP header schema & constructor's
 * @since 0.0.0
 * @packageDocumentation
 */
import { $SchemaId } from "@beep/identity";
import { Tuple } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { SecureHeader } from "../SecureHeader/index.ts";
import { TaggedErrorClass } from "../TaggedErrorClass/index.ts";
import type { TaggedErrorClassFromFields } from "../TaggedErrorClass/index.ts";

const $I = $SchemaId.create("SecureHeaderError");
const commonFields = {
  message: S.String,
  cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })).pipe(SchemaUtils.withNoneDefault),
} satisfies S.Struct.Fields;
const makeSecureHeaderErrorBase = <Self, Tag extends string>(
  name: string,
  tag: Tag,
  description: string
): TaggedErrorClassFromFields<Self, Tag, typeof commonFields> =>
  TaggedErrorClass<Self>($I.make(name))(
    tag,
    commonFields,
    $I.annote(name, {
      description,
    })
  );
const CspErrorBase = makeSecureHeaderErrorBase<CspError, typeof SecureHeader.Enum.CONTENT_SECURITY_POLICY>(
  "CspError",
  SecureHeader.Enum.CONTENT_SECURITY_POLICY,
  "A CSP error."
);
const ForceHttpsRedirectErrorBase = makeSecureHeaderErrorBase<
  ForceHttpsRedirectError,
  typeof SecureHeader.Enum.FORCE_HTTPS_REDIRECT
>("ForceHttpsRedirectError", SecureHeader.Enum.FORCE_HTTPS_REDIRECT, "A force HTTPS redirect error.");
const XssProtectionErrorBase = makeSecureHeaderErrorBase<XssProtectionError, typeof SecureHeader.Enum.XSS_PROTECTION>(
  "XssProtectionError",
  SecureHeader.Enum.XSS_PROTECTION,
  "An XSS protection error."
);
const ReferrerPolicyErrorBase = makeSecureHeaderErrorBase<
  ReferrerPolicyError,
  typeof SecureHeader.Enum.REFERRER_POLICY
>("ReferrerPolicyError", SecureHeader.Enum.REFERRER_POLICY, "A referrer policy error.");
const NoSniffErrorBase = makeSecureHeaderErrorBase<NoSniffError, typeof SecureHeader.Enum.NO_SNIFF>(
  "NoSniffError",
  SecureHeader.Enum.NO_SNIFF,
  "A no sniff error."
);
const NoOpenErrorBase = makeSecureHeaderErrorBase<NoOpenError, typeof SecureHeader.Enum.NO_OPEN>(
  "NoOpenError",
  SecureHeader.Enum.NO_OPEN,
  "A no open error."
);
const FrameGuardErrorBase = makeSecureHeaderErrorBase<FrameGuardError, typeof SecureHeader.Enum.FRAME_GUARD>(
  "FrameGuardError",
  SecureHeader.Enum.FRAME_GUARD,
  "A frame guard error."
);
const ExpectCtErrorBase = makeSecureHeaderErrorBase<ExpectCtError, typeof SecureHeader.Enum.EXPECT_CT>(
  "ExpectCtError",
  SecureHeader.Enum.EXPECT_CT,
  "An Expect-CT error."
);
const PermissionsPolicyErrorBase = makeSecureHeaderErrorBase<
  PermissionsPolicyError,
  typeof SecureHeader.Enum.PERMISSIONS_POLICY
>("PermissionsPolicyError", SecureHeader.Enum.PERMISSIONS_POLICY, "A permissions policy error.");
const CrossOriginOpenerPolicyErrorBase = makeSecureHeaderErrorBase<
  CrossOriginOpenerPolicyError,
  typeof SecureHeader.Enum.CROSS_ORIGIN_OPENER_POLICY
>("CrossOriginOpenerPolicyError", SecureHeader.Enum.CROSS_ORIGIN_OPENER_POLICY, "A cross-origin opener policy error.");
const CrossOriginEmbedderPolicyErrorBase = makeSecureHeaderErrorBase<
  CrossOriginEmbedderPolicyError,
  typeof SecureHeader.Enum.CROSS_ORIGIN_EMBEDDER_POLICY
>(
  "CrossOriginEmbedderPolicyError",
  SecureHeader.Enum.CROSS_ORIGIN_EMBEDDER_POLICY,
  "A cross-origin embedder policy error."
);
const CrossOriginResourcePolicyErrorBase = makeSecureHeaderErrorBase<
  CrossOriginResourcePolicyError,
  typeof SecureHeader.Enum.CROSS_ORIGIN_RESOURCE_POLICY
>(
  "CrossOriginResourcePolicyError",
  SecureHeader.Enum.CROSS_ORIGIN_RESOURCE_POLICY,
  "A cross-origin resource policy error."
);
const PermittedCrossDomainPoliciesErrorBase = makeSecureHeaderErrorBase<
  PermittedCrossDomainPoliciesError,
  typeof SecureHeader.Enum.PERMITTED_CROSS_DOMAIN_POLICIES
>(
  "PermittedCrossDomainPoliciesError",
  SecureHeader.Enum.PERMITTED_CROSS_DOMAIN_POLICIES,
  "A permitted cross-domain policies error."
);
const CoreErrorBase = makeSecureHeaderErrorBase<CoreError, typeof SecureHeader.Enum.CORE>(
  "CoreError",
  SecureHeader.Enum.CORE,
  "A core error."
);

/**
 * Error raised while building a Content-Security-Policy header.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { CspError } from "@beep/schema/SecureHeaderError"
 *
 * const error = CspError.make({ message: "Invalid CSP directive", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CspError extends CspErrorBase {}

/**
 * Error raised while building force-HTTPS redirect headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { ForceHttpsRedirectError } from "@beep/schema/SecureHeaderError"
 *
 * const error = ForceHttpsRedirectError.make({ message: "Invalid redirect option", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ForceHttpsRedirectError extends ForceHttpsRedirectErrorBase {}

/**
 * Error raised while building X-XSS-Protection headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { XssProtectionError } from "@beep/schema/SecureHeaderError"
 *
 * const error = XssProtectionError.make({ message: "Invalid XSS protection option", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class XssProtectionError extends XssProtectionErrorBase {}

/**
 * Error raised while building Referrer-Policy headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { ReferrerPolicyError } from "@beep/schema/SecureHeaderError"
 *
 * const error = ReferrerPolicyError.make({ message: "Invalid referrer policy", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReferrerPolicyError extends ReferrerPolicyErrorBase {}

/**
 * Error raised while building X-Content-Type-Options headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { NoSniffError } from "@beep/schema/SecureHeaderError"
 *
 * const error = NoSniffError.make({ message: "Invalid no-sniff option", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class NoSniffError extends NoSniffErrorBase {}

/**
 * Error raised while building X-Download-Options headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { NoOpenError } from "@beep/schema/SecureHeaderError"
 *
 * const error = NoOpenError.make({ message: "Invalid no-open option", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class NoOpenError extends NoOpenErrorBase {}

/**
 * Error raised while building frame-guard headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { FrameGuardError } from "@beep/schema/SecureHeaderError"
 *
 * const error = FrameGuardError.make({ message: "Invalid frame guard option", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FrameGuardError extends FrameGuardErrorBase {}

/**
 * Error raised while building Expect-CT headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { ExpectCtError } from "@beep/schema/SecureHeaderError"
 *
 * const error = ExpectCtError.make({ message: "Invalid Expect-CT option", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ExpectCtError extends ExpectCtErrorBase {}

/**
 * Error raised while building Permissions-Policy headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { PermissionsPolicyError } from "@beep/schema/SecureHeaderError"
 *
 * const error = PermissionsPolicyError.make({ message: "Invalid permissions policy", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PermissionsPolicyError extends PermissionsPolicyErrorBase {}

/**
 * Error raised while building Cross-Origin-Opener-Policy headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { CrossOriginOpenerPolicyError } from "@beep/schema/SecureHeaderError"
 *
 * const error = CrossOriginOpenerPolicyError.make({ message: "Invalid opener policy", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CrossOriginOpenerPolicyError extends CrossOriginOpenerPolicyErrorBase {}

/**
 * Error raised while building Cross-Origin-Embedder-Policy headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { CrossOriginEmbedderPolicyError } from "@beep/schema/SecureHeaderError"
 *
 * const error = CrossOriginEmbedderPolicyError.make({ message: "Invalid embedder policy", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CrossOriginEmbedderPolicyError extends CrossOriginEmbedderPolicyErrorBase {}

/**
 * Error raised while building Cross-Origin-Resource-Policy headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { CrossOriginResourcePolicyError } from "@beep/schema/SecureHeaderError"
 *
 * const error = CrossOriginResourcePolicyError.make({ message: "Invalid resource policy", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CrossOriginResourcePolicyError extends CrossOriginResourcePolicyErrorBase {}

/**
 * Error raised while building X-Permitted-Cross-Domain-Policies headers.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { PermittedCrossDomainPoliciesError } from "@beep/schema/SecureHeaderError"
 *
 * const error = PermittedCrossDomainPoliciesError.make({ message: "Invalid cross-domain policy", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PermittedCrossDomainPoliciesError extends PermittedCrossDomainPoliciesErrorBase {}

/**
 * Error raised by shared secure-header infrastructure.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { CoreError } from "@beep/schema/SecureHeaderError"
 *
 * const error = CoreError.make({ message: "Unable to build secure header", cause: O.none() })
 * console.log(error.message)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CoreError extends CoreErrorBase {}

/**
 * Tagged union schema for all secure-header errors.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { CspError, SecureHeaderError } from "@beep/schema/SecureHeaderError"
 *
 * const error = CspError.make({ message: "Invalid CSP directive", cause: O.none() })
 * console.log(S.is(SecureHeaderError)(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const SecureHeaderError = SecureHeader.mapMembers(
  Tuple.evolve([
    () => CspError,
    () => ForceHttpsRedirectError,
    () => XssProtectionError,
    () => ReferrerPolicyError,
    () => NoSniffError,
    () => NoOpenError,
    () => FrameGuardError,
    () => ExpectCtError,
    () => PermissionsPolicyError,
    () => CrossOriginOpenerPolicyError,
    () => CrossOriginEmbedderPolicyError,
    () => CrossOriginResourcePolicyError,
    () => PermittedCrossDomainPoliciesError,
    () => CoreError,
  ])
).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("SecureHeaderError", {
    description: "A secure header error.",
  })
);

/**
 * Type for all secure-header errors.
 *
 * @category errors
 * @since 0.0.0
 */
export type SecureHeaderError = typeof SecureHeaderError.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { SecureHeaderError as Error };
