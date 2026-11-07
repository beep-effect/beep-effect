/**
 * Checkout-relative locations of the JSON policy data this package owns.
 *
 * **Details**
 *
 * The data files live under `data/` in this package and keep their original
 * JSON bytes. Tools read them from the checkout root rather than importing them,
 * so a value here is always joined onto a checkout root before use.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $RepoConfigsId.create("PolicyData");

const DATA_ROOT = "packages/tooling/policy-pack/repo-configs/data";

/**
 * Checkout-relative path of the reference workspace manifest read by `beep refs`.
 *
 * **Example** (Join the manifest onto a checkout root)
 *
 * ```ts
 * import { ReferencesManifestPath } from "@beep/repo-configs/PolicyData"
 *
 * console.log(`/checkout/${ReferencesManifestPath}`)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ReferencesManifestPath = `${DATA_ROOT}/references.json`;

/**
 * Checkout-relative path of the knowledge reference rewrite rules read by `beep knowledge`.
 *
 * **Example** (Join the rules onto a checkout root)
 *
 * ```ts
 * import { KnowledgeRefsRewriteRulesPath } from "@beep/repo-configs/PolicyData"
 *
 * console.log(`/checkout/${KnowledgeRefsRewriteRulesPath}`)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const KnowledgeRefsRewriteRulesPath = `${DATA_ROOT}/knowledge-refs-rewrite.rules.json`;

/**
 * GitHub Apps whose registration manifest this package owns.
 *
 * **Example** (Recognize an App name)
 *
 * ```ts
 * import { GitHubAppName } from "@beep/repo-configs/PolicyData"
 *
 * console.assert(GitHubAppName.is["beep-reviewer"]("beep-reviewer"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GitHubAppName = LiteralKit(["beep-reviewer", "beep-knowledge-mint"]).pipe(
  $I.annoteSchema("GitHubAppName", {
    description: "GitHub Apps whose registration manifest the repo-configs policy pack owns.",
  })
);

/**
 * Decoded GitHubAppName value.
 *
 * @category models
 * @since 0.0.0
 */
export type GitHubAppName = typeof GitHubAppName.Type;

/**
 * Checkout-relative path of one GitHub App registration manifest.
 *
 * **Example** (Locate the reviewer manifest)
 *
 * ```ts
 * import { gitHubAppManifestPath } from "@beep/repo-configs/PolicyData"
 *
 * console.log(gitHubAppManifestPath("beep-reviewer"))
 * // packages/tooling/policy-pack/repo-configs/data/github-apps/beep-reviewer.manifest.json
 * ```
 *
 * @param app - The GitHub App whose registration manifest to locate.
 * @returns The manifest path relative to the checkout root.
 * @category configuration
 * @since 0.0.0
 */
export const gitHubAppManifestPath = (app: GitHubAppName): string => `${DATA_ROOT}/github-apps/${app}.manifest.json`;
