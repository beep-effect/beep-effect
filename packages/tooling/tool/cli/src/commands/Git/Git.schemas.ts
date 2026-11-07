/**
 * Schemas for the projection merge driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Git/Git.schemas");

/**
 * Fixed repository paths that are pure generator projections.
 *
 * **Example** (Recognise a projection file)
 *
 * ```ts
 * import { MergeDriverProjectionFile } from "@beep/repo-cli/commands/Git"
 *
 * console.log(MergeDriverProjectionFile.is["tsconfig.json"]("tsconfig.json")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MergeDriverProjectionFile = LiteralKit([
  "standards/fallow.boundaries.generated.jsonc",
  "tsconfig.json",
  "tsconfig.packages.json",
  "apps/professional-desktop/src/runtime/Migrations.gen.ts",
]).pipe(
  $I.annoteSchema("MergeDriverProjectionFile", {
    description: "Fixed repository path the regenerate merge driver accepts as a generator projection.",
  })
);

/**
 * Runtime type for {@link MergeDriverProjectionFile}.
 *
 * @category models
 * @since 0.0.0
 */
export type MergeDriverProjectionFile = typeof MergeDriverProjectionFile.Type;

/**
 * A goal packet's generated `goals/<slug>/ops/manifest.json`.
 *
 * **Details**
 *
 * Mirrors the shell `case` glob `goals/*\/ops/manifest.json`, whose `*` also
 * matches `/`, so nested and empty slugs are accepted as before.
 *
 * **Example** (Recognise a goal manifest)
 *
 * ```ts
 * import { GoalManifestProjectionPath } from "@beep/repo-cli/commands/Git"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GoalManifestProjectionPath)("goals/demo/ops/manifest.json")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GoalManifestProjectionPath = S.String.check(S.isPattern(/^goals\/.*\/ops\/manifest\.json$/su)).pipe(
  $I.annoteSchema("GoalManifestProjectionPath", {
    description: "Goal packet ops manifest path the regenerate merge driver accepts as a generator projection.",
  })
);

/**
 * Runtime type for {@link GoalManifestProjectionPath}.
 *
 * @category models
 * @since 0.0.0
 */
export type GoalManifestProjectionPath = typeof GoalManifestProjectionPath.Type;

/**
 * Any repository path the regenerate merge driver accepts.
 *
 * **Example** (Reject a hand-authored file)
 *
 * ```ts
 * import { MergeDriverProjectionPath } from "@beep/repo-cli/commands/Git"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MergeDriverProjectionPath)("bun.lock")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MergeDriverProjectionPath = S.Union([MergeDriverProjectionFile, GoalManifestProjectionPath]).pipe(
  $I.annoteSchema("MergeDriverProjectionPath", {
    description: "Repository path the regenerate merge driver treats as a pure generator projection.",
  })
);

/**
 * Runtime type for {@link MergeDriverProjectionPath}.
 *
 * @category models
 * @since 0.0.0
 */
export type MergeDriverProjectionPath = typeof MergeDriverProjectionPath.Type;
