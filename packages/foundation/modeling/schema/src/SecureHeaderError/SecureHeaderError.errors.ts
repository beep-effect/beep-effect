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

const $I = $SchemaId.create("SecureHeaderError");
const commonFields = {
  message: S.String,
  cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })).pipe(SchemaUtils.withNoneDefault),
} satisfies S.Struct.Fields;

/**
 * Error raised while building a Content-Security-Policy header.
 *
 * **Example** (Construct CspError instance)
 *
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
export class CspError extends TaggedErrorClass<CspError>($I.make("CspError"))(
  SecureHeader.Enum.CONTENT_SECURITY_POLICY,
  commonFields,
  $I.annote("CspError", { description: "A CSP error." })
) {}

/**
 * Error raised while building force-HTTPS redirect headers.
 *
 * **Example** (Construct ForceHttpsRedirectError)
 *
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
export class ForceHttpsRedirectError extends TaggedErrorClass<ForceHttpsRedirectError>(
  $I.make("ForceHttpsRedirectError")
)(
  SecureHeader.Enum.FORCE_HTTPS_REDIRECT,
  commonFields,
  $I.annote("ForceHttpsRedirectError", { description: "A force HTTPS redirect error." })
) {}

/**
 * Error raised while building X-XSS-Protection headers.
 *
 * **Example** (Construct XssProtectionError)
 *
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
export class XssProtectionError extends TaggedErrorClass<XssProtectionError>($I.make("XssProtectionError"))(
  SecureHeader.Enum.XSS_PROTECTION,
  commonFields,
  $I.annote("XssProtectionError", { description: "An XSS protection error." })
) {}

/**
 * Error raised while building Referrer-Policy headers.
 *
 * **Example** (Construct ReferrerPolicyError)
 *
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
export class ReferrerPolicyError extends TaggedErrorClass<ReferrerPolicyError>($I.make("ReferrerPolicyError"))(
  SecureHeader.Enum.REFERRER_POLICY,
  commonFields,
  $I.annote("ReferrerPolicyError", { description: "A referrer policy error." })
) {}

/**
 * Error raised while building X-Content-Type-Options headers.
 *
 * **Example** (Construct NoSniffError instance)
 *
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
export class NoSniffError extends TaggedErrorClass<NoSniffError>($I.make("NoSniffError"))(
  SecureHeader.Enum.NO_SNIFF,
  commonFields,
  $I.annote("NoSniffError", { description: "A no sniff error." })
) {}

/**
 * Error raised while building X-Download-Options headers.
 *
 * **Example** (Construct NoOpenError instance)
 *
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
export class NoOpenError extends TaggedErrorClass<NoOpenError>($I.make("NoOpenError"))(
  SecureHeader.Enum.NO_OPEN,
  commonFields,
  $I.annote("NoOpenError", { description: "A no open error." })
) {}

/**
 * Error raised while building frame-guard headers.
 *
 * **Example** (Construct FrameGuardError instance)
 *
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
export class FrameGuardError extends TaggedErrorClass<FrameGuardError>($I.make("FrameGuardError"))(
  SecureHeader.Enum.FRAME_GUARD,
  commonFields,
  $I.annote("FrameGuardError", { description: "A frame guard error." })
) {}

/**
 * Error raised while building Expect-CT headers.
 *
 * **Example** (Construct ExpectCtError instance)
 *
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
export class ExpectCtError extends TaggedErrorClass<ExpectCtError>($I.make("ExpectCtError"))(
  SecureHeader.Enum.EXPECT_CT,
  commonFields,
  $I.annote("ExpectCtError", { description: "An Expect-CT error." })
) {}

/**
 * Error raised while building Permissions-Policy headers.
 *
 * **Example** (Construct PermissionsPolicyError)
 *
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
export class PermissionsPolicyError extends TaggedErrorClass<PermissionsPolicyError>($I.make("PermissionsPolicyError"))(
  SecureHeader.Enum.PERMISSIONS_POLICY,
  commonFields,
  $I.annote("PermissionsPolicyError", { description: "A permissions policy error." })
) {}

/**
 * Error raised while building Cross-Origin-Opener-Policy headers.
 *
 * **Example** (Construct CrossOriginOpenerPolicyError)
 *
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
export class CrossOriginOpenerPolicyError extends TaggedErrorClass<CrossOriginOpenerPolicyError>(
  $I.make("CrossOriginOpenerPolicyError")
)(
  SecureHeader.Enum.CROSS_ORIGIN_OPENER_POLICY,
  commonFields,
  $I.annote("CrossOriginOpenerPolicyError", { description: "A cross-origin opener policy error." })
) {}

/**
 * Error raised while building Cross-Origin-Embedder-Policy headers.
 *
 * **Example** (Construct CrossOriginEmbedderPolicyError)
 *
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
export class CrossOriginEmbedderPolicyError extends TaggedErrorClass<CrossOriginEmbedderPolicyError>(
  $I.make("CrossOriginEmbedderPolicyError")
)(
  SecureHeader.Enum.CROSS_ORIGIN_EMBEDDER_POLICY,
  commonFields,
  $I.annote("CrossOriginEmbedderPolicyError", { description: "A cross-origin embedder policy error." })
) {}

/**
 * Error raised while building Cross-Origin-Resource-Policy headers.
 *
 * **Example** (Construct CrossOriginResourcePolicyError)
 *
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
export class CrossOriginResourcePolicyError extends TaggedErrorClass<CrossOriginResourcePolicyError>(
  $I.make("CrossOriginResourcePolicyError")
)(
  SecureHeader.Enum.CROSS_ORIGIN_RESOURCE_POLICY,
  commonFields,
  $I.annote("CrossOriginResourcePolicyError", { description: "A cross-origin resource policy error." })
) {}

/**
 * Error raised while building X-Permitted-Cross-Domain-Policies headers.
 *
 * **Example** (Construct PermittedCrossDomainPoliciesError)
 *
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
export class PermittedCrossDomainPoliciesError extends TaggedErrorClass<PermittedCrossDomainPoliciesError>(
  $I.make("PermittedCrossDomainPoliciesError")
)(
  SecureHeader.Enum.PERMITTED_CROSS_DOMAIN_POLICIES,
  commonFields,
  $I.annote("PermittedCrossDomainPoliciesError", { description: "A permitted cross-domain policies error." })
) {}

/**
 * Error raised by shared secure-header infrastructure.
 *
 * **Example** (Construct CoreError instance)
 *
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
export class CoreError extends TaggedErrorClass<CoreError>($I.make("CoreError"))(
  SecureHeader.Enum.CORE,
  commonFields,
  $I.annote("CoreError", { description: "A core error." })
) {}

/**
 * Tagged union schema for all secure-header errors.
 *
 * **Example** (Check SecureHeaderError membership)
 *
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
 * **Example** (Handle SecureHeaderError type)
 *
 * ```ts
 * import { Effect } from "effect"
 * import type { SecureHeaderError } from "@beep/schema/SecureHeaderError"
 *
 * const handle = (error: SecureHeaderError) => Effect.logError(`secure header error: ${error._tag}`)
 * ```
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
