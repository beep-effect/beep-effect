/**
 * Persisted agent entity schema for fixture-backed runtime agents.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AgentsDomainId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Agents from "@beep/shared-domain/identity/Agents";
import { Tuple } from "effect";
import * as S from "effect/Schema";
import { AgentFixtureKey, AgentName, SkillFixtureKey } from "../Fixture.values.ts";
import { AgentMode } from "./Agent.values.ts";

const $I = $AgentsDomainId.create("entities/Agent/Agent.model");
const AgentEntity = ProductEntity.make(Agents.AgentId);

/**
 * Persisted agent record that binds a fixture key to one skill fixture and
 * execution mode.
 *
 * **Example** (Log entity type)
 *
 * ```ts
 * import { Agent } from "@beep/agents-domain"
 *
 * console.log(Agent.sql.tableName)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Agent extends AgentEntity.Entity<Agent>(AgentEntity.tableName)(
  {
    fixtureKey: AgentFixtureKey.pipe(AgentEntity.pg.text(), AgentEntity.pg.columnName("fixture_key")),
    mode: AgentMode.pipe(AgentEntity.pg.text()),
    name: AgentName.pipe(AgentEntity.pg.text()),
    skillFixtureKey: SkillFixtureKey.pipe(AgentEntity.pg.text(), AgentEntity.pg.columnName("skill_fixture_key")),
    ...AgentEntity.identityFields,
  },
  $I.annote("Agent", {
    description: "Persisted agent record that binds a fixture key to one skill fixture and execution mode.",
  }),
  AgentEntity.entityExtras
) {
  static readonly toTagged = () =>
    Agent.fields.mode
      .mapMembers(
        Tuple.evolve([
          () => {
            class AgentDeterministicFixtureMember extends S.Class<AgentDeterministicFixtureMember>(
              $I`AgentDeterministicFixtureMember`
            )({
              ...Agent.fields,
              mode: S.tag("deterministic_fixture"),
            }) {}
            return AgentDeterministicFixtureMember;
          },
        ])
      )
      .pipe(S.toTaggedUnion("mode"));
}
