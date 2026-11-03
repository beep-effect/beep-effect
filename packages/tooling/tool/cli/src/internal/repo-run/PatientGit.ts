/**
 * The patient `Git` instance shared by repo-cli's long-running git calls.
 *
 * **Details**
 *
 * Moved out of Yeet (repo-cli-gh-git-consolidation W7 kit, SPEC D-17) so the
 * command groups outside Yeet and the Worktree commands can take the same
 * 15-minute instance without a library-to-tool import.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git, GitOptions } from "@beep/git/Git";
import * as Duration from "effect/Duration";
import type { GitShape } from "@beep/git/Git";
import type * as Effect from "effect/Effect";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

/**
 * The `GitOptions` for repo-cli's long-running git mutations: a 15-minute per-run
 * timeout instead of the kit's 30-second default, with the default output bound.
 *
 * **Details**
 *
 * `Git.layer` at the runtime edge runs every call under the default 30 s
 * timeout, which the old unbounded repo-run capture never had. Some steps
 * legitimately outlive it: Yeet's head-install preflight `worktree add` and
 * `worktree remove --force` (the remove deletes a checkout that `bun install`
 * just filled with about 227k entries) and network fetches such as
 * `refreshBaseRef`. Those sites build their own `Git` from these options
 * (SPEC D-09) instead of taking the edge instance.
 *
 * **Example** (Read the patient timeout)
 *
 * ```ts
 * import { PATIENT_GIT_OPTIONS } from "@beep/repo-cli/test/RepoRun"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toMinutes(PATIENT_GIT_OPTIONS.timeout)) // 15
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PATIENT_GIT_OPTIONS: GitOptions = GitOptions.make({ timeout: Duration.minutes(15) });

/**
 * A `Git` service under {@link PATIENT_GIT_OPTIONS}, built from the ambient spawner.
 *
 * **Example** (Build the patient service)
 *
 * ```ts
 * import { patientGit } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(patientGit)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const patientGit: Effect.Effect<GitShape, never, ChildProcessSpawner.ChildProcessSpawner> =
  Git.makeWith(PATIENT_GIT_OPTIONS);
