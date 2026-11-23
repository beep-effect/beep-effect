/**
 * One workspace importer's declared dependencies, keyed by its
 * root-relative path.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LockfilesId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { ImporterDependency } from "./ImporterDependency.ts";
import type * as O from "effect/Option";

const $I = $LockfilesId.create("LockfileImporter");

/**
 * **Details**
 *
 * - `path` — the importer path relative to the workspace root, `"."` for the
 *   root package (never empty — a `NonEmptyString`) — the same keys as
 *   `WorkspaceDiscovery.importerMap` in
 *   `@effected/workspaces`. This is the stable join key: `Lockfile#importer`
 *   looks importers up by it, and `Lockfile#withImporterNames` deliberately
 *   leaves importers untouched because the path — not a package name — keys
 *   them.
 * - `dependencies` — each declared dependency as an {@link ImporterDependency}.
 *
 * Populated by the pnpm, bun and npm parsers. yarn does not record importers,
 * so a yarn lockfile always yields an empty `importers` array.
 *
 * **Example** (Construct the root importer)
 *
 * ```ts
 * import { LockfileImporter } from "@beep/lockfiles/LockfileImporter";
 *
 * const importer = LockfileImporter.make({ path: ".", dependencies: [] });
 * console.log(importer.path); // .
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LockfileImporter extends S.Class<LockfileImporter, { readonly brand: unique symbol }>(
  $I`LockfileImporter`
)(
  {
    path: S.NonEmptyString.pipe(
      $I.annoteKey("LockfileImporter.path", {
        description: "Importer path relative to the workspace root, with `.` identifying the root package",
      })
    ),
    dependencies: S.Array(ImporterDependency).pipe(
      $I.annoteKey("LockfileImporter.dependencies", {
        description:
          "Dependencies declared by this importer across its runtime, development, peer and optional sections",
      })
    ),
  },
  $I.annote("LockfileImporter", {
    description: "One workspace importer's declared dependencies, as the lockfile records them.",
  })
) {
  /**
   * The first declared dependency with the given name, in section order
   * (`dependencies`, `devDependencies`, `peerDependencies`,
   * `optionalDependencies`).
   *
   * **Example** (Look up a declared dependency)
   *
   * ```ts
   * import { LockfileImporter } from "@beep/lockfiles/LockfileImporter";
   * import * as O from "effect/Option";
   *
   * const importer = LockfileImporter.make({ path: ".", dependencies: [] });
   * console.log(O.isNone(importer.dependency("effect"))); // true
   * ```
   *
   * @param name - The dependency's package name.
   * @returns The matching {@link ImporterDependency}, or `Option.none()`.
   * @category getters
   * @since 0.0.0
   */
  dependency(name: string): O.Option<ImporterDependency> {
    return A.findFirst(this.dependencies, (dependency) => dependency.name === name);
  }
}
