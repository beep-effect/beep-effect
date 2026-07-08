/**
 * CSP header schema & constructor's
 * @since 0.0.0
 * @packageDocumentation
 */
import { $SchemaId } from "@beep/identity";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("SecureHeader");

const SecureHeaderBase = LiteralKit([
  "CONTENT_SECURITY_POLICY",
  "FORCE_HTTPS_REDIRECT",
  "XSS_PROTECTION",
  "REFERRER_POLICY",
  "NO_SNIFF",
  "NO_OPEN",
  "FRAME_GUARD",
  "EXPECT_CT",
  "PERMISSIONS_POLICY",
  "CROSS_ORIGIN_OPENER_POLICY",
  "CROSS_ORIGIN_EMBEDDER_POLICY",
  "CROSS_ORIGIN_RESOURCE_POLICY",
  "PERMITTED_CROSS_DOMAIN_POLICIES",
  "CORE",
]);

/**
 * Secure header literal schema.
 *
 * @example
 * ```ts
 * import { SecureHeader } from "@beep/schema/SecureHeader"
 *
 * console.log(SecureHeader.Options.includes("NO_SNIFF"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SecureHeader = SecureHeaderBase.pipe(
  $I.annoteSchema("SecureHeader", {
    description: "A secure header.",
  }),
  SchemaUtils.withLiteralKitStatics(SecureHeaderBase)
);

/**
 * Runtime type for secure header identifiers.
 *
 * @example
 * ```ts
 * import { SecureHeader } from "@beep/schema/SecureHeader"
 *
 * const header: SecureHeader = "NO_SNIFF"
 * console.log(SecureHeader.Options.includes(header))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SecureHeader = typeof SecureHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { SecureHeader as Schema };
