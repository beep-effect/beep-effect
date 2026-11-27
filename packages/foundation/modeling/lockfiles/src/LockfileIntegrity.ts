/**
 * Pure integrity checking of a parsed lockfile against the workspace
 * manifests it should describe.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LockfilesId } from "@beep/identity/packages";
import { DependencyField } from "@beep/npm-spec/DependencySection";
import { Range, SemVer } from "@beep/semver";
import * as A from "effect/Array";
import * as Exit from "effect/Exit";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { DEP_TYPES, isWorkspaceSpecifier } from "./internal/shared.ts";
import type { Lockfile } from "./Lockfile.ts";

const $I = $LockfilesId.create("LockfileIntegrity");

/**
 * **Details**
 *
 * Deliberately *not* a `@effected/package-json` type — this package takes
 * manifests as plain values so its consumers own the manifest IO (and may
 * derive these from any richer model).
 *
 * **Example** (Construct a manifest for comparison)
 *
 * ```ts
 * import { WorkspaceManifest } from "@beep/lockfiles/LockfileIntegrity";
 *
 * const manifest = WorkspaceManifest.make({ name: "@acme/app", dependencies: { effect: "^4.0.0" } });
 * console.log(manifest.dependencies?.effect); // ^4.0.0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class WorkspaceManifest extends S.Opaque<WorkspaceManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString.pipe(
      $I.annoteKey("WorkspaceManifest.name", {
        description: "Workspace package identity used to match its manifest against lockfile workspace entries",
      })
    ),
    dependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
      $I.annoteKey("WorkspaceManifest.dependencies", {
        description: "Runtime dependency specifiers declared by the workspace manifest",
      })
    ),
    devDependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
      $I.annoteKey("WorkspaceManifest.devDependencies", {
        description: "Development dependency specifiers declared by the workspace manifest",
      })
    ),
    peerDependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
      $I.annoteKey("WorkspaceManifest.peerDependencies", {
        description: "Peer dependency specifiers declared by the workspace manifest",
      })
    ),
    optionalDependencies: S.optionalKey(S.Record(S.String, S.String)).pipe(
      $I.annoteKey("WorkspaceManifest.optionalDependencies", {
        description: "Optional dependency specifiers declared by the workspace manifest",
      })
    ),
  }).pipe(
    $I.annoteSchema("WorkspaceManifest", {
      description:
        "The minimal manifest shape LockfileIntegrity.compare checks a lockfile against: a package name plus the four optional dependency maps.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WorkspaceManifest {
  /**
   * The plain, unbranded encoded shape of a {@link WorkspaceManifest}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WorkspaceManifest.Encoded;
}

const decodeRange = S.decodeUnknownExit(Range.FromString);
const decodeSemVer = S.decodeUnknownExit(SemVer.FromString);

/**
 * **Details**
 *
 * A data type, not an error: it reports *what* mismatches exist without
 * failing anything.
 *
 * - `valid` — `true` when the lockfile is fully consistent.
 * - `missingWorkspaces` — workspace names present in the manifests but
 *   absent from the lockfile.
 * - `extraWorkspaces` — workspace names in the lockfile with no matching
 *   manifest.
 * - `unsatisfiedConstraints` — declared constraints the lockfile's resolved
 *   versions do not satisfy.
 *
 * **Example** (Inspect a consistent report)
 *
 * ```ts
 * import { LockfileIntegrity } from "@beep/lockfiles/LockfileIntegrity";
 *
 * const report = LockfileIntegrity.make({ valid: true, missingWorkspaces: [], extraWorkspaces: [], unsatisfiedConstraints: [] });
 * console.log(report.valid); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LockfileIntegrity extends S.Opaque<LockfileIntegrity, { readonly brand: unique symbol }>()(
  S.Struct({
    valid: S.Boolean.pipe(
      $I.annoteKey("LockfileIntegrity.valid", {
        description:
          "Whether comparison found no missing workspaces, extra workspaces or unsatisfied constraints among the rows it checked",
      })
    ),
    missingWorkspaces: S.Array(S.String).pipe(
      $I.annoteKey("LockfileIntegrity.missingWorkspaces", {
        description: "Workspace package names declared by manifests but absent from the lockfile's workspace entries",
      })
    ),
    extraWorkspaces: S.Array(S.String).pipe(
      $I.annoteKey("LockfileIntegrity.extraWorkspaces", {
        description: "Workspace package names recorded in the lockfile without matching manifests",
      })
    ),
    unsatisfiedConstraints: S.Array(
      S.Struct({
        workspace: S.String,
        dependency: S.String,
        constraint: S.String,
        resolved: S.String,
        depType: DependencyField,
      })
    ).pipe(
      $I.annoteKey("LockfileIntegrity.unsatisfiedConstraints", {
        description:
          "Declared SemVer constraints satisfied by no parseable resolved candidate, with workspace, dependency section and all candidate versions",
      })
    ),
  }).pipe(
    $I.annoteSchema("LockfileIntegrity", {
      description: "Result of checking a parsed lockfile against the workspace's declared manifests.",
    })
  )
) {
  /**
   * Check a lockfile's consistency against workspace manifests — a total,
   * pure function: no Effect, no error channel, no IO.
   *
   * **Details**
   *
   * Constraint checking is best-effort by design: `workspace:` / `link:` /
   * `file:` specifiers and rows whose range (or every resolved version) does
   * not parse as SemVer are skipped.
   * A lockfile may resolve the same package at several versions; a
   * constraint is satisfied when *any* resolved version matches, and an
   * unsatisfied row reports every candidate in `resolved`. The
   * caller reads the manifests (this package does no IO). For pnpm, apply
   * `Lockfile#withImporterNames` first so workspace names align with
   * manifest names.
   *
   * (Named `compare`, not `check`: every `Schema.Class` already carries a
   * `static check(...checks)` for attaching schema checks, and statics cannot
   * be shadowed with an incompatible signature.)
   *
   * **Example** (Report a missing workspace)
   *
   * ```ts
   * import { LockfileIntegrity, WorkspaceManifest } from "@beep/lockfiles/LockfileIntegrity";
   * import { Lockfile } from "@beep/lockfiles/Lockfile";
   *
   * const lockfile = Lockfile.make({ format: "npm", lockfileVersion: "3", packages: [], workspaceDependencies: [] });
   * const report = LockfileIntegrity.compare(lockfile, [WorkspaceManifest.make({ name: "@acme/app" })]);
   * console.log(report.missingWorkspaces.join(", ")); // @acme/app
   * ```
   *
   * @param lockfile - The parsed lockfile.
   * @param manifests - The workspace manifests to compare against.
   * @returns The integrity report.
   * @category validation
   * @since 0.0.0
   */
  static readonly compare: {
    (lockfile: Lockfile, manifests: ReadonlyArray<WorkspaceManifest>): LockfileIntegrity;
    (manifests: ReadonlyArray<WorkspaceManifest>): (lockfile: Lockfile) => LockfileIntegrity;
  } = dual(2, (lockfile: Lockfile, manifests: ReadonlyArray<WorkspaceManifest>): LockfileIntegrity => {
    const lockfileWsNames = MutableHashSet.fromIterable(
      A.flatMap(lockfile.packages, (p) => (p.isWorkspace && p.relativePath !== undefined ? [p.name] : []))
    );
    const manifestNames = MutableHashSet.fromIterable(A.map(manifests, (m) => m.name));
    const missingWorkspaces = A.filter(A.fromIterable(manifestNames), (n) => !MutableHashSet.has(lockfileWsNames, n));
    const extraWorkspaces = A.filter(A.fromIterable(lockfileWsNames), (n) => !MutableHashSet.has(manifestNames, n));
    const resolvedIndex = allResolvedVersionsByName(lockfile);
    const unsatisfiedConstraints = A.flatMap(manifests, (manifest) => unsatisfiedRows(manifest, resolvedIndex));
    return LockfileIntegrity.make({
      valid: missingWorkspaces.length === 0 && extraWorkspaces.length === 0 && unsatisfiedConstraints.length === 0,
      missingWorkspaces,
      extraWorkspaces,
      unsatisfiedConstraints,
    });
  });
}

const allResolvedVersionsByName = (lockfile: Lockfile): MutableHashMap.MutableHashMap<string, Array<string>> => {
  const index = MutableHashMap.empty<string, Array<string>>();
  for (const p of lockfile.packages) {
    const versions = MutableHashMap.get(index, p.name);
    if (O.isNone(versions)) MutableHashMap.set(index, p.name, [p.version]);
    else versions.value.push(p.version);
  }
  return index;
};

type UnsatisfiedConstraint = (typeof LockfileIntegrity.Encoded)["unsatisfiedConstraints"][number];

const unsatisfiedRows = (
  manifest: WorkspaceManifest,
  resolvedIndex: MutableHashMap.MutableHashMap<string, Array<string>>
): ReadonlyArray<UnsatisfiedConstraint> =>
  A.flatMap(DEP_TYPES, (depType) =>
    A.flatMap(R.toEntries(manifest[depType] ?? {}), ([dependency, constraint]) =>
      isWorkspaceSpecifier(constraint)
        ? []
        : O.toArray(
            O.flatMap(MutableHashMap.get(resolvedIndex, dependency), (candidates) =>
              isUnsatisfied(constraint, candidates)
                ? O.some({
                    workspace: manifest.name,
                    dependency,
                    constraint,
                    resolved: A.join(candidates, ", "),
                    depType,
                  })
                : O.none()
            )
          )
    )
  );

const isUnsatisfied = (constraint: string, candidates: ReadonlyArray<string>): boolean => {
  const range = Exit.getSuccess(decodeRange(constraint));
  const versions = A.getSomes(A.map(candidates, (candidate) => Exit.getSuccess(decodeSemVer(candidate))));
  return (
    O.isSome(range) && A.isReadonlyArrayNonEmpty(versions) && !A.some(versions, (version) => range.value.test(version))
  );
};

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LockfileIntegrity {
  /**
   * The plain, unbranded encoded shape of a {@link LockfileIntegrity}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof LockfileIntegrity.Encoded;
}
