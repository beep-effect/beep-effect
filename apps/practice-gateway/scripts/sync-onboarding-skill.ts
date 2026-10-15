/**
 * Regenerate `src/OnboardingSkill.generated.ts` from the shipped onboarding
 * skill (`plugin/skills/practice-onboarding/SKILL.md`): the skill body
 * without its YAML frontmatter, served by `setup_onboarding_guide` and the
 * `onboard_practice` prompt.
 *
 * Run after editing SKILL.md: `bun run sync:onboarding-skill`.
 * `test/OnboardingSkill.test.ts` fails when the two drift apart.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { BunRuntime } from "@effect/platform-bun";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { renderOnboardingSkillModule, skillBody } from "../src/OnboardingSkill.ts";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(import.meta.dirname, "..");
  const skill = yield* fs.readFileString(path.join(root, "plugin/skills/practice-onboarding/SKILL.md"));
  yield* fs.writeFileString(
    path.join(root, "src/OnboardingSkill.generated.ts"),
    renderOnboardingSkillModule(skillBody(skill))
  );
});

BunRuntime.runMain(program.pipe(Effect.provide(Layer.mergeAll(BunFileSystem.layer, BunPath.layer))));
