/**
 * Shared-kernel Organization entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import { Slug } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import * as M from "@beep/schema/Model";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as S from "effect/Schema";
import * as Shared from "../../identity/Shared.ts";
import { LicenseTier, Settings } from "./Organization.values.ts";

const $I = $SharedDomainId.create("entities/Organization/Organization.model");

/**
 * Shared-kernel Organization entity schema.
 *
 * @example
 * ```ts
 * import { Organization } from "@beep/shared-domain/entities"
 *
 * console.log(Organization.Model.definition.entityId.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Model extends BaseEntity.Class<Model>($I`Model`)(
  Shared.OrganizationId,
  {
    fields: {
      legalName: S.NonEmptyString,
      licenseTier: LicenseTier,
      name: S.NonEmptyString,
      parentOrgId: M.FieldOption(Shared.OrganizationId),
      settings: Settings,
      slug: Slug,
    },
    persisted: {
      legalName: EntitySchema.persist.text({
        columnName: "legal_name",
      }),
      licenseTier: EntitySchema.persist.literal({
        columnName: "license_tier",
        indexHints: [EntitySchema.IndexHint.lookup],
      }),
      name: EntitySchema.persist.text(),
      parentOrgId: EntitySchema.persist.entityId({
        columnName: "parent_org_id",
      }),
      settings: EntitySchema.persist.jsonb(),
      slug: EntitySchema.persist.text({
        indexHints: [EntitySchema.IndexHint.unique],
      }),
    },
  },
  $I.annote("Model", {
    description: "Shared-kernel organization entity used as the tenant root concept.",
  })
) {}
