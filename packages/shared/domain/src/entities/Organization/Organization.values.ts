/**
 * Concept-local Organization value vocabulary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { PosInt } from "@beep/schema/Int";
import * as S from "effect/Schema";

const $I = $SharedDomainId.create("entities/Organization/Organization.values");
const LicenseTierBase = LiteralKit(["solo", "team", "enterprise"]);

/**
 * Commercial license tier assigned to an organization.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Organization } from "@beep/shared-domain/entities"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const tier = yield* S.decodeUnknownEffect(Organization.LicenseTier)("enterprise")
 *   return Organization.LicenseTier.is.enterprise(tier)
 * })
 * console.log(program)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LicenseTier = LicenseTierBase.pipe(
  $I.annoteSchema("LicenseTier", {
    description: "Commercial license tier assigned to a shared-kernel organization.",
  }),
  SchemaUtils.withLiteralKitStatics(LicenseTierBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Runtime type for {@link LicenseTier}.
 *
 * @example
 * ```ts
 * import { Organization } from "@beep/shared-domain/entities"
 *
 * const printTier = (tier: Organization.LicenseTier) => console.log(tier)
 * console.log(printTier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type LicenseTier = typeof LicenseTier.Type;

/**
 * Compliance and automation settings owned by an organization.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Organization } from
 * "@beep/shared-domain/entities"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const settings = yield* S.decodeUnknownEffect(Organization.Settings)({
 *     allowAgentActions: true,
 *     defaultRetentionDays: 90,
 *   })
 *   return settings.allowAgentActions
 * })
 * console.log(program)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Settings extends S.Class<Settings>($I`Settings`)(
  {
    allowAgentActions: S.Boolean.annotateKey({
      description: "Whether this organization allows agent-driven actions.",
    }),
    defaultRetentionDays: PosInt.annotateKey({
      description: "Default retention period for organization-owned records, in days.",
    }),
  },
  $I.annote("Settings", {
    description: "Compliance and audit settings owned by a shared-kernel organization.",
  })
) {}
