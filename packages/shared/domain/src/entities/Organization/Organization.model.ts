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
const pg = ProductEntity.pg;

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
export class Model extends ProductEntity.Entity<Model>()(Shared.OrganizationId)(
  {
    legalName: S.NonEmptyString.pipe(pg.text(), pg.columnName("legal_name")),
    licenseTier: LicenseTier.pipe(
      pg.text(),
      pg.columnName("license_tier"),
      pg.index({ name: "shared_organization_license_tier_lookup_idx" })
    ),
    name: S.NonEmptyString.pipe(pg.text()),
    parentOrgId: S.OptionFromNullOr(Shared.OrganizationId).pipe(
      SchemaUtils.withNoneDefault,
      pg.integer(),
      pg.columnName("parent_org_id")
    ),
    settings: Settings.pipe(pg.jsonb()),
    slug: Slug.pipe(pg.text(), pg.uniqueIndex()),
  },
  $I.annote("Model", {
    description: "Shared-kernel organization entity used as the tenant root concept.",
  })
) {}
