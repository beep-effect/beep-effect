/**
 * Shared Vercel provider schemas for infra stacks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $InfraId.create("Vercel");

const VercelAuthenticationDeploymentTypeBase = LiteralKit([
  "standardProtectionNew",
  "standardProtection",
  "allDeployments",
  "onlyPreviewDeployments",
  "none",
]);

/**
 * Vercel deployment authentication modes accepted by infra-managed projects.
 *
 * @example
 * ```ts
 * import { VercelAuthenticationDeploymentType } from "@beep/infra"
 *
 * console.log(VercelAuthenticationDeploymentType.Enum.none)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VercelAuthenticationDeploymentType = VercelAuthenticationDeploymentTypeBase.pipe(
  $I.annoteSchema("VercelAuthenticationDeploymentType", {
    description: "Vercel deployment authentication modes accepted by infra-managed projects.",
  }),
  SchemaUtils.withLiteralKitStatics(VercelAuthenticationDeploymentTypeBase),
  SchemaUtils.withStatics((schema) => ({
    decodeResult: S.decodeUnknownResult(schema),
  }))
);

/**
 * Runtime type for {@link VercelAuthenticationDeploymentType}.
 *
 * @example
 * ```ts
 * import type { VercelAuthenticationDeploymentType } from "@beep/infra"
 *
 * const deploymentType: VercelAuthenticationDeploymentType = "none"
 * console.log(deploymentType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VercelAuthenticationDeploymentType = typeof VercelAuthenticationDeploymentType.Type;
