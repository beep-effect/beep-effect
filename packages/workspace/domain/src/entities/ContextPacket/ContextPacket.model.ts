/**
 * Context packet entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $WorkspaceDomainId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as Workspace from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";

const $I = $WorkspaceDomainId.create("entities/ContextPacket/ContextPacket.model");

/**
 * Bounded context packet returned through the SDK facade.
 *
 * **Example** (Log table name)
 *
 * ```ts
 * import { ContextPacket } from "@beep/workspace-domain"
 *
 * console.log(ContextPacket.definition.entityId.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContextPacket extends BaseEntity.Class<ContextPacket>($I`ContextPacket`)(
  Workspace.ContextPacketId,
  {
    fields: {
      fixtureKey: S.NonEmptyString.annotateKey({
        description: "Stable fixture key for the context packet.",
      }),
      scenarioFixtureKey: S.NonEmptyString.annotateKey({
        description: "Stable fixture key for the scenario that produced the packet.",
      }),
      snapshot: UnknownRecord.annotateKey({
        description: "Opaque context snapshot returned through the SDK facade.",
      }),
    },
    persisted: {
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      scenarioFixtureKey: EntitySchema.persist.text({
        columnName: "scenario_fixture_key",
      }),
      snapshot: EntitySchema.persist.jsonb({
        columnName: "snapshot",
      }),
    },
  },
  $I.annote("ContextPacket", {
    description: "Bounded context packet returned through the SDK facade.",
  })
) {}
