/**
 * Shared repository proof-surface definitions for repo-cli orchestration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/repo-run/RepoRun.proofs");

/**
 * GitHub check mode handled by `beep quality github-checks`.
 *
 * **Example** (Validate pre-push check mode)
 *
 * ```ts
 * import { GithubCheckMode } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(GithubCheckMode.is["pre-push"]("pre-push"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GITHUB_CHECK_MODE_VALUES = [
  "cheap-gates",
  "quality",
  "review-fix",
  "repo-sanity",
  "secrets",
  "security",
  "sast",
  "nix",
  "pre-push",
] as const;

/**
 * GitHub check mode handled by `beep quality github-checks`.
 *
 * @category models
 * @since 0.0.0
 */
export const GithubCheckMode = LiteralKit(GITHUB_CHECK_MODE_VALUES).pipe(
  $I.annoteSchema("GithubCheckMode", {
    description: "GitHub verification mode handled by the repo-cli quality command group.",
  })
);

/**
 * GitHub check mode handled by `beep quality github-checks`.
 *
 * @category models
 * @since 0.0.0
 */
export type GithubCheckMode = typeof GithubCheckMode.Type;

/**
 * Named proof surfaces that orchestration commands may require.
 *
 * **Example** (Validate pre-push proof surface)
 *
 * ```ts
 * import { RepoProofSurface } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(RepoProofSurface.is["pre-push"]("pre-push"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RepoProofSurface = LiteralKit(["cheap-gates", "quality", "review-fix", "pre-push"]).pipe(
  $I.annoteSchema("RepoProofSurface", {
    description: "Named repository proof surface backed by a GitHub checks mode.",
  })
);

/**
 * Named proof surfaces that orchestration commands may require.
 *
 * @category models
 * @since 0.0.0
 */
export type RepoProofSurface = typeof RepoProofSurface.Type;

/**
 * Planned command metadata for a repository proof surface.
 *
 * **Example** (Read pre-push step args)
 *
 * ```ts
 * import { repoProofStepDefinition } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(repoProofStepDefinition("pre-push").args)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RepoProofStepDefinition extends S.Class<RepoProofStepDefinition>($I`RepoProofStepDefinition`)(
  {
    surface: RepoProofSurface,
    id: S.String,
    label: S.String,
    args: S.Array(S.String),
  },
  $I.annote("RepoProofStepDefinition", {
    description: "Planned command metadata for a repository proof surface.",
  })
) {}

/**
 * Return the `beep` command metadata that proves a repository proof surface.
 *
 * **Example** (Read quality step label)
 *
 * ```ts
 * import { repoProofStepDefinition } from "@beep/repo-cli/internal/repo-run"
 *
 * console.log(repoProofStepDefinition("quality").label)
 * ```
 *
 * @param surface - Proof surface to run.
 * @returns Command metadata for a `bun run beep ...` plan step.
 * @category constructors
 * @since 0.0.0
 */
export const repoProofStepDefinition = (surface: RepoProofSurface): RepoProofStepDefinition =>
  RepoProofSurface.$match(surface, {
    "cheap-gates": () =>
      RepoProofStepDefinition.make({
        surface,
        id: "full:00-cheap-gates",
        label: "full:cheap-gates",
        args: ["quality", "github-checks", "cheap-gates", "--collect-all"],
      }),
    quality: () =>
      RepoProofStepDefinition.make({
        surface,
        id: "full:01-quality",
        label: "full:quality",
        args: ["quality", "github-checks", "quality"],
      }),
    "review-fix": () =>
      RepoProofStepDefinition.make({
        surface,
        id: "full:01-review-fix",
        label: "full:review-fix",
        args: ["quality", "github-checks", "review-fix"],
      }),
    "pre-push": () =>
      RepoProofStepDefinition.make({
        surface,
        id: "full:01-pre-push",
        label: "full:pre-push",
        args: ["quality", "github-checks", "pre-push"],
      }),
  });
