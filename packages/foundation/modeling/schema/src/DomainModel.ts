/**
 * Shared domain model base with audit and bookkeeping fields.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";
import { NonNegativeInt } from "./Int.ts";
import * as Model from "./Model/index.ts";

const $I = $SchemaId.create("DomainModel");

/**
 * Default audit and bookkeeping fields for persisted domain models.
 *
 * **Details**
 *
 * The base intentionally does not include an `id` field. Derived models add the
 * branded identifier that belongs to their aggregate or entity.
 *
 * **Example** (List default field names)
 *
 * ```ts
 * import { defaultFields } from "@beep/schema/DomainModel"
 *
 * const fieldNames = Object.keys(defaultFields)
 *
 * console.log(fieldNames)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const defaultFields = {
  createdAt: Model.DateTimeInsertFromNumber,
  updatedAt: Model.DateTimeUpdateFromNumber,
  deletedAt: Model.FieldOption(S.DateTimeUtcFromMillis),
  createdBy: Model.FieldOption(S.String),
  updatedBy: Model.FieldOption(S.String),
  deletedBy: Model.FieldOption(S.String),
  version: Model.Generated(NonNegativeInt),
  source: Model.FieldOption(S.String),
} as const;

/**
 * Base class for persisted domain models that share audit metadata.
 *
 * **Example** (Extend model with branded id)
 *
 * ```ts
 * import { DomainModel } from "@beep/schema/DomainModel"
 * import * as Model from "@beep/schema/Model"
 * import * as S from "effect/Schema"
 *
 * const OrganizationId = S.String.pipe(S.brand("OrganizationId"))
 *
 * class Organization extends DomainModel.extend<Organization, typeof DomainModel>("Organization")({
 *   id: Model.Generated(OrganizationId)
 * }) {}
 *
 * console.log(Organization.insert)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DomainModel extends Model.Class<DomainModel>($I`DomainModel`)(
  defaultFields,
  $I.annote("DomainModel", {
    description: "Base persisted domain model with shared audit and bookkeeping fields.",
  })
) {}
