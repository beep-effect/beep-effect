/**
 * Persisted skill entity schema for fixture-backed agent capabilities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AgentsDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Agents from "@beep/shared-domain/identity/Agents";
import { SkillFixtureKey, SkillName } from "../Fixture.values.ts";

const $I = $AgentsDomainId.create("entities/Skill/Skill.model");
const pg = ProductEntity.pg;

/**
 * Persisted skill record referenced by fixture-backed agents.
 *
 * **Example** (Log Skill table name)
 *
 * ```ts
 * import { Skill } from "@beep/agents-domain"
 *
 * console.log(Skill.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Skill extends ProductEntity.Entity<Skill>()(Agents.SkillId)(
  {
    fixtureKey: SkillFixtureKey.pipe(pg.text(), pg.columnName("fixture_key")),
    name: SkillName.pipe(pg.text()),
  },
  $I.annote("Skill", {
    description: "Persisted skill record referenced by fixture-backed agents.",
  })
) {}
