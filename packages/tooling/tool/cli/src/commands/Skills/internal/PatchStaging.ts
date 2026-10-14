/**
 * Containment for skill patch files staged by the reviewed `skills-lock.json` write.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { SkillsCommandError } from "../Skills.errors.ts";

/**
 * Repo-relative root of the generated skill patch series.
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const PATCH_ROOT = ".agents/skill-patches";

/**
 * Resolves a patch file's repo-relative path to its absolute place in a
 * staging directory, refusing a path that escapes it.
 *
 * **Details**
 *
 * The planner only builds `.agents/skill-patches/<skill>/NNNN-<slug>.patch`
 * paths from safe lock keys, so this refusal is the second line of defense:
 * whatever the plan carries, the write never creates a file outside the
 * staging root.
 *
 * **Example** (Refuse a patch path that climbs out of the stage)
 *
 * ```ts
 * import { stagedPatchPath } from "@beep/repo-cli/test/Skills"
 * import { NodeServices } from "@effect/platform-node"
 * import * as Effect from "effect/Effect"
 *
 * const outcome = stagedPatchPath("/repo/.agents/.stage", ".agents/skill-patches/../../outside.patch").pipe(
 *   Effect.as("staged"),
 *   Effect.orElseSucceed(() => "refused"),
 *   Effect.provide(NodeServices.layer)
 * )
 *
 * console.log(Effect.runSync(outcome)) // "refused"
 * ```
 *
 * @internal
 * @param stage - Absolute staging directory standing in for {@link PATCH_ROOT}.
 * @param filePath - Repo-relative patch path under {@link PATCH_ROOT}.
 * @returns The absolute staged path.
 * @effects Fails with {@link SkillsCommandError} when the path resolves outside the stage; performs no I/O.
 * @category validation
 * @since 0.0.0
 */
export const stagedPatchPath = Effect.fn("SkillsLock.stagedPatchPath")(function* (
  stage: string,
  filePath: string
): Effect.fn.Return<string, SkillsCommandError, Path.Path> {
  const path = yield* Path.Path;
  const absolute = path.join(stage, path.relative(PATCH_ROOT, filePath));
  const inside = path.relative(stage, absolute);
  if (Str.startsWith("..")(inside) || path.isAbsolute(inside)) {
    return yield* SkillsCommandError.make({
      message: `Refusing to stage ${filePath}: it resolves outside ${PATCH_ROOT}.`,
      file: filePath,
    });
  }
  return absolute;
});
