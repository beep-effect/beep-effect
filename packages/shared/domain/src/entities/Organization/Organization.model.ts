/**
 * Shared-kernel Organization entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import { SchemaUtils, Slug } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as S from "effect/Schema";
import * as Shared from "../../identity/Shared/index.ts";
import { LicenseTier, Settings } from "./Organization.values.ts";

const $I = $SharedDomainId.create("entities/Organization/Organization.model");
const OrganizationEntity = ProductEntity.make(Shared.OrganizationId);

/**
 * Shared-kernel Organization entity schema.
 *
 * **Example** (Access organization table name)
 *
 * ```ts
 * import { Organization } from "@beep/shared-domain/entities"
 *
 * console.log(Organization.Model.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Model extends OrganizationEntity.Entity<Model>(OrganizationEntity.tableName)(
  {
    legalName: S.NonEmptyString.pipe(OrganizationEntity.pg.text(), OrganizationEntity.pg.columnName("legal_name")),
    licenseTier: LicenseTier.pipe(OrganizationEntity.pg.text(), OrganizationEntity.pg.columnName("license_tier")),
    name: S.NonEmptyString.pipe(OrganizationEntity.pg.text()),
    parentOrgId: S.OptionFromNullOr(Shared.OrganizationId).pipe(
      SchemaUtils.withNoneDefault,
      OrganizationEntity.pg.integer(),
      OrganizationEntity.pg.columnName("parent_org_id")
    ),
    settings: Settings.pipe(OrganizationEntity.pg.jsonb()),
    slug: Slug.pipe(OrganizationEntity.pg.text()),
    ...OrganizationEntity.identityFields,
  },
  $I.annote("Model", {
    description: "Shared-kernel organization entity used as the tenant root concept.",
  }),
  (columns) => [
    OrganizationEntity.Table.index("shared_organization_license_tier_lookup_idx", [columns.licenseTier]),
    OrganizationEntity.Table.uniqueIndex("shared_organization_slug_unique_idx", [columns.slug]),
    ...OrganizationEntity.entityExtras(columns),
  ]
) {}
