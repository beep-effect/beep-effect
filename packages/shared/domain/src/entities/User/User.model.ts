/**
 * Shared-kernel User entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as S from "effect/Schema";
import * as Shared from "../../identity/Shared/index.ts";

const $I = $SharedDomainId.create("entities/User/User.model");

/**
 * Shared-kernel human account entity schema.
 *
 * **Example** (Read user table name)
 *
 * ```ts
 * import { Model } from "@beep/shared-domain/entities/User"
 *
 * console.log(Model.definition.entityId.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Model extends BaseEntity.Class<Model>($I`Model`)(
  Shared.UserId,
  {
    fields: {
      displayName: S.NonEmptyString,
    },
    persisted: {
      displayName: EntitySchema.persist.text({
        columnName: "display_name",
      }),
    },
  },
  $I.annote("Model", {
    description: "Shared-kernel human account entity.",
  })
) {}
