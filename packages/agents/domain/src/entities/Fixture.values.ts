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
  S.isPattern(
    fixtureKeyPattern,
    $I.annote("FixtureKeyPatternCheck", {
      title: "Fixture Key",
      description: "Checks that fixture keys are dotted lowercase identifiers.",
      message: "Fixture keys must be dotted lowercase identifiers, for example agent.reviewer.",
    })
  )
);

/**
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
