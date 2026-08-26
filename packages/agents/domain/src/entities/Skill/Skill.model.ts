/**
 * Persisted skill entity schema for fixture-backed agent capabilities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AgentsDomainId } from "@beep/identity/packages";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Agents from "@beep/shared-domain/identity/Agents";
import * as S from "effect/Schema";
import { SkillFixtureKey, SkillName } from "../Fixture.values.ts";

const $I = $AgentsDomainId.create("entities/Skill/Skill.model");
const SkillEntity = ProductEntity.make(Agents.SkillId);

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
export class Skill extends SkillEntity.Entity<Skill>(SkillEntity.tableName)(
  {
    fixtureKey: SkillFixtureKey.pipe(SkillEntity.pg.text(), SkillEntity.pg.columnName("fixture_key")),
    name: SkillName.pipe(SkillEntity.pg.varchar(64)),
    description: S.NonEmptyString.pipe(
      S.check(
        S.isMaxLength(1024, {
          message: "Skill description must be less than 1024 characters",
        })
      ),
      SkillEntity.pg.varchar(1024)
    ),
    license: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    compatibility: S.NonEmptyString.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      SkillEntity.pg.varchar(500)
    ),
    metadata: S.Record(S.NonEmptyString, S.String).pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      SkillEntity.pg.jsonb()
    ),
    "allowed-tools": S.String,
    ...SkillEntity.identityFields,
  },
  $I.annote("Skill", {
    description: "Persisted skill record referenced by fixture-backed agents.",
  }),
  SkillEntity.entityExtras
) {}
