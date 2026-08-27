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
import { Struct } from "effect";
import * as S from "effect/Schema";
import { SkillFixtureKey, SkillName } from "../Fixture.values.ts";

const $I = $AgentsDomainId.create("entities/Skill/Skill.model");
const pg = ProductEntity.pg;

/**
 * Persisted skill record referenced by fixture-backed agents.
 *
 * **Details**
 *
 * `name` derives its `varchar(64)` bound from the `SkillName` value schema.
 * `description` gets its bound from `varchar(1024)`. Because `compatibility`
 * is nullable, its inner string schema declares the 500-character bound and
 * bare `varchar()` derives that bound through the nullable encoding.
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
    name: SkillName.pipe(pg.varchar()),
    description: S.NonEmptyString.pipe(pg.varchar(1024)),
    license: S.OptionFromNullOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault, pg.text()),
    compatibility: S.OptionFromNullOr(S.NonEmptyString.check(S.isMaxLength(500))).pipe(
      SchemaUtils.withNoneDefault,
      pg.varchar()
    ),
    metadata: S.OptionFromNullOr(S.Record(S.NonEmptyString, S.String)).pipe(SchemaUtils.withNoneDefault, pg.jsonb()),
    allowedTools: S.OptionFromNullOr(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      pg.text(),
      pg.columnName("allowed_tools")
    ),
  },
  $I.annote("Skill", {
    description: "Persisted skill record referenced by fixture-backed agents.",
  })
) {}

/**
 * Agent Skills frontmatter codec derived from the skill model.
 *
 * **Details**
 *
 * `jsonCreate` already excludes identity, audit, and org columns. The derived
 * struct also omits the persistence-only `fixtureKey`; `encodeKeys` renames
 * `allowedTools` to the specification's kebab-case `allowed-tools` on the
 * encoded side. Optional fields encode as `null` rather than absent keys.
 *
 * **Example** (Decode frontmatter with kebab-case keys)
 *
 * ```ts
 * import { SkillFrontmatter } from "@beep/agents-domain/entities/Skill"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const frontmatter = yield* S.decodeUnknownEffect(SkillFrontmatter)({
 *     "allowed-tools": "Bash, Read",
 *     compatibility: null,
 *     description: "Formats commit messages.",
 *     license: null,
 *     metadata: null,
 *     name: "commit-format",
 *   })
 *   return frontmatter.allowedTools
 * })
 * console.log(program)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SkillFrontmatter = Skill.jsonCreate
  .mapFields(Struct.omit(["fixtureKey"]))
  .pipe(S.encodeKeys({ allowedTools: "allowed-tools" }));
