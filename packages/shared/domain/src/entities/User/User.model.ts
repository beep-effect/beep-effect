/**
 * Shared-kernel User entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as S from "effect/Schema";
import * as Shared from "../../identity/Shared/index.ts";

const $I = $SharedDomainId.create("entities/User/User.model");
const pg = ProductEntity.pg;

/**
 * Shared-kernel human account entity schema.
 *
 * **Example** (Read user table name)
 *
 * ```ts
 * import { Model } from "@beep/shared-domain/entities/User"
 *
 * console.log(Model.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Model extends ProductEntity.Entity<Model>()(Shared.UserId)(
  {
    displayName: S.NonEmptyString.pipe(pg.text(), pg.columnName("display_name")),
  },
  $I.annote("Model", {
    description: "Shared-kernel human account entity.",
  })
) {}
