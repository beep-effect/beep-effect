/**
 * Context packet entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $WorkspaceDomainId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Workspace from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";

const $I = $WorkspaceDomainId.create("entities/ContextPacket/ContextPacket.model");
const pg = ProductEntity.pg;

/**
 * Bounded context packet returned through the SDK facade.
 *
 * **Example** (Log table name)
 *
 * ```ts
 * import { ContextPacket } from "@beep/workspace-domain"
 *
 * console.log(ContextPacket.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ContextPacket extends ProductEntity.Entity<ContextPacket>()(Workspace.ContextPacketId)(
  {
    fixtureKey: S.NonEmptyString.annotateKey({
      description: "Stable fixture key for the context packet.",
    }).pipe(pg.text(), pg.columnName("fixture_key")),
    scenarioFixtureKey: S.NonEmptyString.annotateKey({
      description: "Stable fixture key for the scenario that produced the packet.",
    }).pipe(pg.text(), pg.columnName("scenario_fixture_key")),
    snapshot: UnknownRecord.annotateKey({
      description: "Opaque context snapshot returned through the SDK facade.",
    }).pipe(pg.jsonb()),
  },
  $I.annote("ContextPacket", {
    description: "Bounded context packet returned through the SDK facade.",
  })
) {}
