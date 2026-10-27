/**
 * Reading a tracked file as the merge-base with a base ref holds it, so a
 * pull request cannot vouch for itself (CODEOWNERS owners, the review's old pins).
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import * as Effect from "effect/Effect";
import { SkillsCommandError } from "../Skills.errors.ts";
import type * as O from "effect/Option";

/**
 * Reads `path` at the merge-base of `HEAD` and `baseRef`.
 *
 * **Details**
 *
 * Both reads go through `@beep/git`'s `Git` service. Fails typed when the
 * merge-base cannot be resolved, naming `purpose`. A base that does not carry
 * the file yields `None` beside the merge-base; any other failed read of the
 * file at the base is a typed failure too, never an absent file.
 *
 * @internal
 * @param repoRoot - Absolute repository root.
 * @param baseRef - The ref to take the merge-base with, such as `origin/main`.
 * @param path - Repo-relative path of the file to read.
 * @param purpose - What the read is for, named in the failure.
 * @returns The merge-base revision and the file text, when present.
 * @category queries
 * @since 0.0.0
 */
export const readAtMergeBase = Effect.fn("SkillsMergeBase.readAtMergeBase")(
  function* (
    repoRoot: string,
    baseRef: string,
    path: string,
    purpose: string
  ): Effect.fn.Return<{ readonly base: string; readonly text: O.Option<string> }, SkillsCommandError, Git> {
    const git = yield* Git;
    const base = yield* git
      .mergeBase(repoRoot, "HEAD", baseRef)
      .pipe(
        SkillsCommandError.mapError(`Cannot resolve the merge-base of HEAD and ${baseRef} for ${purpose}`, repoRoot)
      );
    const text = yield* git
      .show(repoRoot, base, path)
      .pipe(SkillsCommandError.mapError(`Cannot read ${path} at the merge-base ${base} for ${purpose}`, repoRoot));
    return { base, text };
  },
  Effect.provideServiceEffect(Git, Git.make)
);
