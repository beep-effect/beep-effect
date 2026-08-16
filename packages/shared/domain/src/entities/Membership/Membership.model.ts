/**
 * Shared-kernel Membership entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Shared from "../../identity/Shared/index.ts";
import { Role, Status } from "./Membership.values.ts";

const $I = $SharedDomainId.create("entities/Membership/Membership.model");
const MembershipEntity = ProductEntity.make(Shared.MembershipId);

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
 * console.log(Model.sql.tableName) // "shared_membership"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Model extends MembershipEntity.Entity<Model>(MembershipEntity.tableName)(
  {
    role: Role.pipe(MembershipEntity.pg.text()),
    status: Status.pipe(MembershipEntity.pg.text()),
    userId: Shared.UserId.pipe(MembershipEntity.pg.integer(), MembershipEntity.pg.columnName("user_id")),
    ...MembershipEntity.identityFields,
  },
  $I.annote("Model", {
    description: "Shared organization membership entity.",
  }),
  (columns) => [
    MembershipEntity.Table.index("shared_membership_user_id_btree_idx", [columns.userId]),
    ...MembershipEntity.entityExtras(columns),
  ]
) {}
