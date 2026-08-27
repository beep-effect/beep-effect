/**
 * Fixture-backed entity field schemas shared by agent-domain entities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $AgentsDomainId.create("entities/Fixture.values");
const fixtureKeyPattern = /^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+$/u;
const skillNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const FixtureKey = S.NonEmptyString.check(
  S.isPattern(fixtureKeyPattern, {
    identifier: $I`FixtureKeyPatternCheck`,
    title: "Fixture Key",
    description: "Checks that fixture keys are dotted lowercase identifiers.",
    message: "Fixture keys must be dotted lowercase identifiers, for example agent.reviewer.",
  })
);

/**
 * Stable dotted fixture key for an agent entity.
 *
 * **Example** (Decode agent fixture key)
 *
 * ```ts
 * import { AgentFixtureKey } from "@beep/agents-domain/entities"
 * import * as S from "effect/Schema"
 *
 * const fixtureKey = S.decodeUnknownSync(AgentFixtureKey)("agent.reviewer")
 * console.log(fixtureKey)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AgentFixtureKey = FixtureKey.pipe(
  $I.annoteSchema("AgentFixtureKey", {
    description: "Stable dotted fixture key for an agent entity.",
  })
);

/**
 * Type accepted by the {@link AgentFixtureKey} schema.
 *
 * **Example** (Type agent fixture key)
 *
 * ```ts
 * import { AgentFixtureKey } from "@beep/agents-domain/entities"
 * import * as S from "effect/Schema"
 *
 * const fixtureKey: AgentFixtureKey = S.decodeUnknownSync(AgentFixtureKey)("agent.reviewer")
 * console.log(fixtureKey)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AgentFixtureKey = typeof AgentFixtureKey.Type;

/**
 * Stable dotted fixture key for a skill entity.
 *
 * **Example** (Decode skill fixture key)
 *
 * ```ts
 * import { SkillFixtureKey } from "@beep/agents-domain/entities"
 * import * as S from "effect/Schema"
 *
 * const fixtureKey = S.decodeUnknownSync(SkillFixtureKey)("skill.review")
 * console.log(fixtureKey)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SkillFixtureKey = FixtureKey.pipe(
  $I.annoteSchema("SkillFixtureKey", {
    description: "Stable dotted fixture key for a skill entity.",
  })
);

/**
 * Type accepted by the {@link SkillFixtureKey} schema.
 *
 * **Example** (Type skill fixture key)
 *
 * ```ts
 * import { SkillFixtureKey } from "@beep/agents-domain/entities"
 * import * as S from "effect/Schema"
 *
 * const fixtureKey: SkillFixtureKey = S.decodeUnknownSync(SkillFixtureKey)("skill.review")
 * console.log(fixtureKey)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SkillFixtureKey = typeof SkillFixtureKey.Type;

/**
 * Non-empty display name for a fixture-backed agent.
 *
 * **Example** (Decode agent display name)
 *
 * ```ts
 * import { AgentName } from "@beep/agents-domain/entities"
 * import * as S from "effect/Schema"
 *
 * const name = S.decodeUnknownSync(AgentName)("Reviewer Agent")
 * console.log(name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AgentName = S.NonEmptyString.pipe(
  $I.annoteSchema("AgentName", {
    description: "Non-empty display name for a fixture-backed agent.",
  })
);

/**
 * Type accepted by the {@link AgentName} schema.
 *
 * **Example** (Type agent display name)
 *
 * ```ts
 * import { AgentName } from "@beep/agents-domain/entities"
 * import * as S from "effect/Schema"
 *
 * const name: AgentName = S.decodeUnknownSync(AgentName)("Reviewer Agent")
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AgentName = typeof AgentName.Type;

/**
 * Agent Skills-compatible name for a fixture-backed skill.
 *
 * **Example** (Decode skill display name)
 *
 * ```ts
 * import { SkillName } from "@beep/agents-domain/entities"
 * import * as S from "effect/Schema"
 *
 * const name = S.decodeUnknownSync(SkillName)("review-skill")
 * console.log(name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SkillName = S.NonEmptyString.pipe(
  S.check(
    S.makeFilterGroup([
      S.isMaxLength(64, {
        message: "Skill name must be at most 64 characters long",
      }),
      S.isPattern(skillNamePattern, {
        message: "Skill names may contain lowercase letters, digits, and single hyphens between segments",
      }),
    ])
  ),
  $I.annoteSchema("SkillName", {
    description: "Agent Skills-compatible lowercase name for a fixture-backed skill.",
  })
);

/**
 * Type accepted by the {@link SkillName} schema.
 *
 * **Example** (Type skill display name)
 *
 * ```ts
 * import { SkillName } from "@beep/agents-domain/entities"
 * import * as S from "effect/Schema"
 *
 * const name: SkillName = S.decodeUnknownSync(SkillName)("review-skill")
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SkillName = typeof SkillName.Type;
