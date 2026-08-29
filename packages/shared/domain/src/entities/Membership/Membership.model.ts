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
const pg = ProductEntity.pg;

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
export class Model extends ProductEntity.Entity<Model>()(Shared.MembershipId)(
  {
    role: Role.pipe(pg.text()),
    status: Status.pipe(pg.text()),
    userId: Shared.UserId.pipe(pg.integer(), pg.columnName("user_id"), pg.index()),
  },
  $I.annote("Model", {
    description: "Shared organization membership entity.",
  })
) {}
