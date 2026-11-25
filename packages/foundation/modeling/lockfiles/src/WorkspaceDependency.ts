/**
 * A directed dependency edge between two workspace packages, as the
 * lockfile records it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LockfilesId } from "@beep/identity/packages";
import { DependencyField } from "@beep/npm-spec/DependencySection";
import * as S from "effect/Schema";

const $I = $LockfilesId.create("WorkspaceDependency");

/**
 * **Details**
 *
 * - `from` — the workspace package declaring the dependency. For pnpm this
 *   is the importer path until `Lockfile#withImporterNames` rewrites it.
 * - `to` — the workspace package depended upon.
 * - `depType` — which dependency map holds the edge, spelled with
 *   `@effected/npm`'s kit-wide `DependencyField` vocabulary.
 * - `constraint` — the declared specifier (e.g. `"workspace:*"`, `"^1.0.0"`).
 *
 * **Example** (Construct a workspace dependency edge)
 *
 * ```ts
 * import { WorkspaceDependency } from "@beep/lockfiles/WorkspaceDependency";
 *
 * const edge = WorkspaceDependency.make({ from: "@acme/app", to: "@acme/lib", depType: "dependencies", constraint: "workspace:*" });
 * console.log(edge.constraint); // workspace:*
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class WorkspaceDependency extends S.Class<WorkspaceDependency, { readonly brand: unique symbol }>(
  $I`WorkspaceDependency`
)(
  {
    from: S.NonEmptyString.pipe(
      $I.annoteKey("WorkspaceDependency.from", {
        description:
          "Workspace package declaring the dependency; pnpm initially uses its importer path until rewritten with its manifest name",
      })
    ),
    to: S.NonEmptyString.pipe(
      $I.annoteKey("WorkspaceDependency.to", {
        description: "Workspace package depended upon by the declaring package",
      })
    ),
    depType: DependencyField.pipe(
      $I.annoteKey("WorkspaceDependency.depType", {
        description: "Dependency section containing this workspace edge, such as `dependencies` or `devDependencies`",
      })
    ),
    constraint: S.String.pipe(
      $I.annoteKey("WorkspaceDependency.constraint", {
        description: "Declared dependency specifier for this workspace edge, such as `workspace:*` or `^1.0.0`",
      })
    ),
  },
  $I.annote("WorkspaceDependency", {
    description: "A directed dependency edge between two workspace packages as recorded in the lockfile.",
  })
) {
  /**
   * This edge with its endpoints renamed, keeping its section and constraint.
   *
   * **Example** (Rename both ends of an edge)
   *
   * ```ts
   * import { WorkspaceDependency } from "@beep/lockfiles/WorkspaceDependency";
   *
   * const edge = WorkspaceDependency.make({ from: "packages/app", to: "packages/lib", depType: "dependencies", constraint: "workspace:*" });
   * console.log(edge.withEndpoints("@acme/app", "@acme/lib").to); // @acme/lib
   * console.log(edge.withEndpoints("packages/app", "packages/lib") === edge); // true
   * ```
   *
   * @param from - The new, non-empty declaring workspace name.
   * @param to - The new, non-empty depended-upon workspace name.
   * @returns This edge when both endpoints are unchanged, otherwise a renamed copy.
   * @category mapping
   * @since 0.0.0
   */
  withEndpoints(from: string, to: string): WorkspaceDependency {
    return from === this.from && to === this.to ? this : WorkspaceDependency.make({ ...this, from, to });
  }
}
