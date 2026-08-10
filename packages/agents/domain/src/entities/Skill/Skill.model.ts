/**
 * Persisted skill entity schema for fixture-backed agent capabilities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AgentsDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as Agents from "@beep/shared-domain/identity/Agents";
import { SkillFixtureKey, SkillName } from "../Fixture.values.ts";

const $I = $AgentsDomainId.create("entities/Skill/Skill.model");

/**
 * Persisted skill record referenced by fixture-backed agents.
 *
 * **Example** (Log Skill table name)
 *
 * ```ts
 * import { Skill } from "@beep/agents-domain"
 *
 * console.log(Skill.definition.entityId.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Skill extends BaseEntity.Class<Skill>($I`Skill`)(
  Agents.SkillId,
  {
    fields: {
      fixtureKey: SkillFixtureKey,
      name: SkillName,
    },
    persisted: {
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      name: EntitySchema.persist.text({
        columnName: "name",
      }),
    },
  },
  $I.annote("Skill", {
    description: "Persisted skill record referenced by fixture-backed agents.",
  })
) {}
