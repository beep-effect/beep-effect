/**
 * Service contract for reading the repository state the catalog usage check evaluates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { CatalogUsageSnapshot } from "./CatalogUsage.schemas.ts";
import type { CatalogUsageError } from "./Quality.errors.ts";

const $I = $RepoCliId.create("commands/Quality/CatalogUsage.service");

/**
 * Operations a catalog usage source provides.
 *
 * @category models
 * @since 0.0.0
 */
export type CatalogUsageSourceShape = {
  readonly snapshot: (repoRoot: string) => Effect.Effect<CatalogUsageSnapshot, CatalogUsageError>;
};

/**
 * Source of the root manifest, workspace manifests, lockfile package names and
 * generator template references for one checkout.
 *
 * **Details**
 *
 * The live layer reads tracked workspace manifests through the root
 * `workspaces` globs, `bun.lock`, and the tracked package generator and
 * scaffolder sources. Tests substitute a fixture checkout or a fixed snapshot.
 *
 * **Example** (Read the service key)
 *
 * ```ts
 * import { CatalogUsageSource } from "@beep/repo-cli/commands/Quality/CatalogUsage.service"
 *
 * console.log(CatalogUsageSource.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CatalogUsageSource extends Context.Service<CatalogUsageSource, CatalogUsageSourceShape>()(
  $I`CatalogUsageSource`
) {}
