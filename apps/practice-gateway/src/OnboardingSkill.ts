/**
 * Pure helpers that turn the shipped onboarding `SKILL.md` into the text the
 * gateway serves, shared by `scripts/sync-onboarding-skill.ts` and the drift
 * test.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Str from "effect/String";

const FRONTMATTER_FENCE = /^---\s*$/m;

/**
 * Return a skill file's body: everything after its YAML frontmatter, trimmed.
 *
 * **Details**
 *
 * A file without a closed frontmatter block is returned trimmed and whole.
 *
 * **Example** (Strip frontmatter)
 *
 * ```ts
 * import { skillBody } from "@beep/practice-gateway/OnboardingSkill"
 *
 * console.log(skillBody("---\nname: x\n---\n\n# Guide\n")) // "# Guide"
 * ```
 *
 * @category transformations
 * @since 0.0.0
 */
export const skillBody = (markdown: string): string => {
  const parts = Str.split(markdown, FRONTMATTER_FENCE);
  return Str.trim(parts.length >= 3 ? pipe(parts, A.drop(2), A.join("---")) : markdown);
};

/**
 * Render the generated TypeScript module that carries a skill body.
 *
 * **Example** (Render a module)
 *
 * ```ts
 * import { renderOnboardingSkillModule } from "@beep/practice-gateway/OnboardingSkill"
 *
 * console.log(renderOnboardingSkillModule("# Guide").includes("ONBOARDING_SKILL_BODY"))
 * ```
 *
 * @category transformations
 * @since 0.0.0
 */
export const renderOnboardingSkillModule = (body: string): string => `/**
 * Generated from \`plugin/skills/practice-onboarding/SKILL.md\` by
 * \`bun run sync:onboarding-skill\`. Do not edit by hand.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Body of the shipped \`practice-onboarding\` skill, without its frontmatter.
 *
 * @category constants
 * @since 0.0.0
 */
export const ONBOARDING_SKILL_BODY = ${JSON.stringify(body)};
`;
