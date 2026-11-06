/**
 * Formatter port for `beep goals manifest --write`.
 *
 * **Details**
 *
 * The writer lands comment-preserving JSONC edits and then formats exactly the
 * manifests it rewrote so the bytes match the repository formatter (Biome
 * collapses short arrays to one line; the edit cannot predict that). The live
 * command runs `bunx biome format --write`; tests provide a no-op so the
 * projection logic is proven without spawning a formatter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type { CliReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as Effect from "effect/Effect";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliId.create("commands/Goals/Manifest.service");

/**
 * Shape of the manifest formatter: format the given repo-relative paths in place.
 *
 * **Example** (A no-op formatter)
 *
 * ```ts
 * import type { GoalManifestFormatterShape } from "@beep/repo-cli/commands/Goals/Manifest.service"
 * import * as Effect from "effect/Effect"
 *
 * const formatter: GoalManifestFormatterShape = { format: () => Effect.void }
 * console.log(typeof formatter.format) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type GoalManifestFormatterShape = {
  readonly format: (
    repoRoot: string,
    paths: ReadonlyArray<string>
  ) => Effect.Effect<void, CliReportedExit, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner>;
};

/**
 * Formatter port the manifest writer calls after it rewrote manifests.
 *
 * **Details**
 *
 * Optional: `runGoalsManifest` reads it through `Effect.serviceOption` and
 * falls back to the live Biome formatter when the service is absent.
 *
 * **Example** (Provide a no-op formatter)
 *
 * ```ts
 * import { GoalManifestFormatter } from "@beep/repo-cli/commands/Goals/Manifest.service"
 * import * as Effect from "effect/Effect"
 *
 * const provided = Effect.provideService(Effect.void, GoalManifestFormatter, { format: () => Effect.void })
 * console.log(Effect.isEffect(provided)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GoalManifestFormatter extends Context.Service<GoalManifestFormatter, GoalManifestFormatterShape>()(
  $I`GoalManifestFormatter`
) {}
