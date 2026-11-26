import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type { Lockfile } from "@beep/lockfiles";

/**
 * One importer's dependency-name → resolved-version map, keyed by importer path.
 *
 * **Details**
 *
 * Structural on purpose: the public alias of this shape is `ImporterVersions`,
 * declared beside the service member that returns it in `WorkspaceCatalogs.ts`.
 * Naming it there rather than here keeps a `@public` type out of `internal/`
 * without an import cycle between the two modules.
 *
 * @internal
 */
type VersionIndex = Readonly<Record<string, Readonly<Record<string, string>>>>;

const stripPeerSuffix = (version: string): string =>
  O.match(Str.indexOf("(")(version), {
    onNone: () => version,
    onSome: (paren) => Str.slice(0, paren)(version),
  });

const isConcreteVersion = (version: string): boolean =>
  version.length > 0 && !Str.startsWith("link:")(version) && !Str.startsWith("file:")(version);

/**
 * Build the importer-path → dependency-name → version index a snapshot uses to
 * answer `catalog:` specifiers its catalog set cannot resolve.
 *
 * **Details**
 *
 * Keyed by **name only** within each importer, deliberately across every
 * dependency field. The bug this fixes is a peer declared `catalog:effect:peers`
 * whose importer records no `peerDependencies` entry at all — pnpm writes peer
 * declarations into the importer block only when they are also installed, so the
 * concrete version lives on the package's `devDependencies` row for the same
 * name. Joining by name across fields is what finds it; joining by field, or by
 * matching the recorded specifier, would not.
 *
 * Only pnpm populates importer versions; bun and npm record resolved versions on
 * their package entries instead, so those formats yield an empty index and the
 * fallback is inert for them.
 *
 * **Example** (Index a pnpm development dependency)
 *
 * ```ts
 * import { importerVersionsOf } from "@beep/repo-workspaces/internal/importerVersions";
 * import { Lockfile } from "@beep/lockfiles/Lockfile";
 * import { LockfileImporter } from "@beep/lockfiles/LockfileImporter";
 * import { ImporterDependency } from "@beep/lockfiles/ImporterDependency";
 * import * as S from "effect/Schema";
 *
 * const dependency = S.decodeUnknownSync(ImporterDependency)({
 *   name: "effect", specifier: "catalog:effect:peers",
 *   version: "4.0.0(effect@4.0.0)", depType: "devDependencies",
 * });
 * const lockfile = Lockfile.make({
 *   format: "pnpm", lockfileVersion: "9.0", packages: [], workspaceDependencies: [],
 *   importers: [LockfileImporter.make({ path: "packages/core", dependencies: [dependency] })],
 * });
 * console.log(importerVersionsOf(lockfile)["packages/core"]?.effect); // 4.0.0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const importerVersionsOf = (lockfile: Lockfile): VersionIndex => {
  const index = MutableHashMap.empty<string, Record<string, string>>();
  for (const importer of lockfile.importers) MutableHashMap.set(index, importer.path, versionsOfImporter(importer));
  return R.fromEntries(index);
};

const versionsOfImporter = (importer: Lockfile["importers"][number]): Record<string, string> => {
  const versions = MutableHashMap.empty<string, string>();
  for (const dependency of importer.dependencies) {
    const version = O.filter(O.map(O.fromUndefinedOr(dependency.version), stripPeerSuffix), isConcreteVersion);
    if (O.isSome(version) && !MutableHashMap.has(versions, dependency.name)) {
      MutableHashMap.set(versions, dependency.name, version.value);
    }
  }
  return R.fromEntries(versions);
};

/**
 * The version every importer agrees `dependency` resolved to, or `undefined`
 * when they disagree or none record it.
 *
 * **Details**
 *
 * The unambiguity rule is what makes a workspace-wide answer safe from a
 * snapshot method that receives no importer context. Two packages in one
 * monorepo may legitimately hold different versions of the same dependency; in
 * that case there is no single correct answer, so this yields nothing and the
 * caller keeps today's behavior (no row) rather than inventing a wrong one.
 *
 * **Example** (Distinguish agreement from conflicting versions)
 *
 * ```ts
 * import { unanimousVersionOf } from "@beep/repo-workspaces/internal/importerVersions";
 *
 * const agreed = { "packages/a": { effect: "4.0.0" }, "packages/b": { effect: "4.0.0" } };
 * const conflicting = { "packages/a": { effect: "4.0.0" }, "packages/b": { effect: "4.0.1" } };
 * console.log(unanimousVersionOf(agreed, "effect")); // 4.0.0
 * console.log(unanimousVersionOf("effect")(conflicting)); // undefined
 * console.log(unanimousVersionOf(agreed, "missing")); // undefined
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const unanimousVersionOf: {
  (dependency: string): (index: VersionIndex) => string | undefined;
  (index: VersionIndex, dependency: string): string | undefined;
} = dual(2, (index: VersionIndex, dependency: string): string | undefined => {
  let agreed: string | undefined;
  for (const versions of R.values(index)) {
    const version = O.getOrUndefined(R.get(versions, dependency));
    if (version === undefined) continue;
    if (agreed === undefined) {
      agreed = version;
      continue;
    }
    if (agreed !== version) return undefined;
  }
  return agreed;
});
