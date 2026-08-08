/**
 * Shared-kernel Membership entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as Shared from "../../identity/Shared.ts";
import { Role, Status } from "./Membership.values.ts";

const $I = $SharedDomainId.create("entities/Membership/Membership.model");

/**
 * Shared organization membership entity schema.
 *
 * **Details**
 *
 * The inherited `orgId` field is the organization being joined.
 *
 * **Example** (Read membership table name)
 *
 * ```ts
 * import { Model } from "@beep/shared-domain/entities/Membership"
 *
 * console.log(Model.definition.entityId.tableName) // "membership"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Model extends BaseEntity.Class<Model>($I`Model`)(
  Shared.MembershipId,
  {
    fields: {
      role: Role,
      status: Status,
      userId: Shared.UserId,
    },
    persisted: {
      role: EntitySchema.persist.literal({
        columnName: "role",
      }),
      status: EntitySchema.persist.literal({
        columnName: "status",
      }),
      userId: EntitySchema.persist.entityId({
        columnName: "user_id",
        indexHints: [EntitySchema.IndexHint.btree, EntitySchema.IndexHint.lookup],
      }),
    },
  },
  $I.annote("Model", {
    description: "Shared organization membership entity.",
  })
) {}
