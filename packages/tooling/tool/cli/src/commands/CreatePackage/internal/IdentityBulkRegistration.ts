/**
 * Bulk workspace identity registration, composing the flat registration writer
 * with the generated labs segment sync. Lives apart from
 * `IdentityRegistration.ts` so the module graph stays acyclic:
 * `LabIdentitySegment` consumes `IdentityRegistration`, and this module
 * consumes both.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError } from "@beep/repo-utils";
import { A } from "@beep/utils";
import { Effect, FileSystem, Order, Path } from "effect";
import { isLabsWorkspacePath } from "../../../internal/cli/Labs/index.ts";
import { CreatePackageIdentityRegistration } from "./IdentityRegistration.ts";
import { LabIdentitySegment } from "./LabIdentitySegment.ts";

/**
 * Register every workspace package missing from the identity composer
 * registry, returning the slugs that were registered.
 *
 * **Details**
 *
 * The workspace catalog is partitioned by labs path: non-lab slugs go through
 * the flat `ensureIdentityPackageRegistration` loop, while lab slugs
 * (workspaces under `apps/labs/`) are registered by one
 * `LabIdentitySegment.syncLabIdentitySegment` pass that regenerates the
 * marker-fenced labs regions — the sync also prunes labs segment entries whose
 * workspace no longer exists.
 *
 * **Example** (Register missing workspace packages)
 *
 * ```ts
 * import { registerMissingWorkspaceIdentityPackages } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityBulkRegistration"
 * import { Effect } from "effect"
 *
 * const program = registerMissingWorkspaceIdentityPackages("/repo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const registerMissingWorkspaceIdentityPackages = Effect.fn(
  "IdentityRegistration.registerMissingWorkspaceIdentityPackages"
)(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const identityPackagesFilePath = yield* CreatePackageIdentityRegistration.resolveIdentityPackagesFilePath(repoRoot);
  const entries = yield* CreatePackageIdentityRegistration.collectWorkspaceIdentityEntries(repoRoot);
  const absolutePath = path.join(repoRoot, identityPackagesFilePath);
  const registryContent = yield* fs
    .readFileString(absolutePath)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to read "${absolutePath}"`)));
  const isLabEntry = ([, dir]: readonly [slug: string, dir: string]): boolean =>
    isLabsWorkspacePath(path.relative(repoRoot, dir));
  const labSlugs = A.map(A.filter(entries, isLabEntry), ([slug]) => slug);
  const nonLabSlugs = A.map(
    A.filter(entries, (entry) => !isLabEntry(entry)),
    ([slug]) => slug
  );
  const missing = CreatePackageIdentityRegistration.missingIdentityRegistrations(registryContent, nonLabSlugs);

  for (const slug of missing) {
    yield* CreatePackageIdentityRegistration.ensureIdentityPackageRegistration(identityPackagesFilePath, slug);
  }

  const missingLabs = CreatePackageIdentityRegistration.missingIdentityRegistrations(registryContent, labSlugs);
  yield* LabIdentitySegment.syncLabIdentitySegment(repoRoot);

  return A.sort(A.appendAll(missing, missingLabs), Order.String);
});
