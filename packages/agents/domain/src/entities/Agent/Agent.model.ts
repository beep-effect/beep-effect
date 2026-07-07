/**
 * Persisted agent entity schema for fixture-backed runtime agents.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $AgentsDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as Agents from "@beep/shared-domain/identity/Agents";
import { Tuple } from "effect";
import * as S from "effect/Schema";
import { AgentFixtureKey, AgentName, SkillFixtureKey } from "../Fixture.values.js";
import { AgentMode } from "./Agent.values.js";

const $I = $AgentsDomainId.create("entities/Agent/Agent.model");

/**
 * Persisted agent record that binds a fixture key to one skill fixture and
 * execution mode.
 *
 * @example
 * ```ts
 * import { Agent } from "@beep/agents-domain"
 *
 * console.log(Agent.definition.entityId.entityType)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Agent extends BaseEntity.Class<Agent>($I`Agent`)(
  Agents.AgentId,
  {
    fields: {
      fixtureKey: AgentFixtureKey,
      mode: AgentMode,
      name: AgentName,
      skillFixtureKey: SkillFixtureKey,
    },
    persisted: {
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      mode: EntitySchema.persist.literal({
        columnName: "mode",
      }),
      name: EntitySchema.persist.text({
        columnName: "name",
      }),
      skillFixtureKey: EntitySchema.persist.text({
        columnName: "skill_fixture_key",
      }),
    },
  },
  $I.annote("Agent", {
    description: "Persisted agent record that binds a fixture key to one skill fixture and execution mode.",
  })
) {
  static readonly toTagged = () =>
    Agent.fields.mode
      .mapMembers(
        Tuple.evolve([
          () =>
            S.Struct({
              ...Agent.fields,
              mode: S.tag("deterministic_fixture"),
            }),
        ])
      )
      .pipe(S.toTaggedUnion("mode"));
}
