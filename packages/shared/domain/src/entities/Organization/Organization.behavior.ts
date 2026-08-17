/**
 * Pure Organization domain behavior.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Shared } from "@beep/shared-domain/identity";
import * as O from "effect/Option";
import type { Model } from "./Organization.model.ts";

/**
 * Test whether an Organization row is its own tenant root.
 *
 * **Details**
 *
 * Organization is the one shared entity whose tenant scope is itself: a root
 * row satisfies `orgId` and `id` equality.
 *
 * **Example** (Detect tenant root row)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { isTenantRoot } from "@beep/shared-domain/entities/Organization/Organization.behavior"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(Shared.OrganizationId)(1)
 *   return isTenantRoot({ id, orgId: id })
 * })
 * console.log(program)
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isTenantRoot = (organization: Pick<Model, "id" | "orgId">): boolean =>
  Shared.OrganizationId.equivalence(organization.id, organization.orgId);

/**
 * Test whether an Organization belongs to a parent organization.
 *
 * **Example** (Check missing parent organization)
 *
 * ```ts
 * import { Organization } from "@beep/shared-domain/entities"
 * import * as O from "effect/Option"
 *
 * console.log(Organization.hasParentOrganization({ parentOrgId: O.none() }))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasParentOrganization = (organization: Pick<Model, "parentOrgId">): boolean =>
  O.isSome(organization.parentOrgId);

/**
 * Test whether Organization tenant placement fields form a valid root or child
 * relationship.
 *
 * **Details**
 *
 * Root rows satisfy `id === orgId` and must not have a parent organization.
 * Child rows use a different tenant root id and must name a parent
 * organization.
 *
 * **Example** (Validate root tenant placement)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Organization } from "@beep/shared-domain/entities"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(Shared.OrganizationId)(1)
 *   return Organization.hasValidTenantPlacement({ id, orgId: id, parentOrgId: O.none() })
 * })
 * console.log(program)
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasValidTenantPlacement = (organization: Pick<Model, "id" | "orgId" | "parentOrgId">): boolean =>
  isTenantRoot(organization) !== hasParentOrganization(organization);
