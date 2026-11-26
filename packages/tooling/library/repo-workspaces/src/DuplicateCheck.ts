/**
 * Duplicate-resolution detection over a parsed lockfile — a pure VALUE, not a
 * service. No IO, nothing in `R`, no error channel. PeerCheck's sibling, on
 * the same posture: format-free, over `@beep/lockfiles`' normalized
 * instances, walking `resolved` edges from each importer's roots.
 *
 * **Details**
 *
 * The question it answers is the one issue #298 could not get from a type
 * error and issue #603 could not get without looping `pnpm why` by hand:
 * "which names resolve at more than one version, and who pulls each copy?"
 * The answer is provenance plus a diff-able version list, not a boolean — a
 * duplicate is harmless while the copies' shapes agree, and what makes them
 * disagree is a stale transitive inside one copy, so the dependent that holds
 * each copy is the actionable part.
 *
 * `instanceId` is OPAQUE here — looked up, never parsed. Splitting one on `@`
 * or "(" would re-introduce the format knowledge this module exists without.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoWorkspacesId } from "@beep/identity/packages";
import { Lockfile } from "@beep/lockfiles";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { indexInstances, rootInstances } from "./internal/roots.ts";
import type { ResolvedPackage } from "@beep/lockfiles";
import type { InstanceIndex } from "./internal/roots.ts";

const $I = $RepoWorkspacesId.create("DuplicateCheck");

/**
 * Controls which package names appear in a {@link DuplicateCheck.run} report.
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface DuplicateCheckOptions {
  /**
   * Which package names to REPORT on. Defaults to every name.
   *
   * **Details**
   *
   * The predicate narrows the report, never the walk: a package it rejects is
   * still followed and still appears as a dependent wherever it pulls a copy
   * of a package it accepts. Pruning the walk instead would drop exactly the
   * culprit a consumer needs named — the untouched third package holding the
   * stale copy. {@link DuplicateCheck.kit} is the predicate every consumer of
   * this kit wants.
   */
  readonly names?: (name: string) => boolean;
}

/**
 * **Details**
 *
 * A tagged union a renderer narrows with `switch (dependent._tag)`:
 *
 * - `"importer"` — a workspace importer takes the instance directly; `path`
 *   is the importer path (`"."` for the root).
 * - `"package"` — a resolved package's own dependency edge points at the
 *   instance; `name` and `version` are that package's.
 *
 * An importer's dependencies are attributed to the importer by path even when
 * the lockfile records a workspace row for it — that row IS the importer, and
 * reporting it as a `"package"` would name a directory with a placeholder
 * version rather than the project that took the dependency.
 *
 * **Example** (Decode an importer dependent)
 *
 * ```ts
 * import { Dependent } from "@beep/repo-workspaces/DuplicateCheck";
 * import * as S from "effect/Schema";
 *
 * const dependent = S.decodeUnknownSync(Dependent)({ _tag: "importer", path: "." });
 * console.log(dependent._tag) // importer
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Dependent = S.Union([
  S.TaggedStruct("importer", { path: S.NonEmptyString }),
  S.TaggedStruct("package", { name: S.NonEmptyString, version: S.String }),
]).pipe($I.annoteSchema("Dependent", { description: "Who pulls one resolved instance into the graph." }));

/**
 * The decoded form of {@link (Dependent:variable)}: who pulls one resolved
 * instance, as a tagged union a renderer narrows with `switch (dependent._tag)`.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type Dependent = typeof Dependent.Type;

const RelationshipKey = S.fromJsonString(S.Tuple([S.String, Dependent])).pipe(
  $I.annoteSchema("RelationshipKey", { description: "An unambiguous key for one target instance and its dependent." })
);
const encodeRelationshipKey = S.encodeResult(RelationshipKey);

/**
 * **Details**
 *
 * `dependents` is deduplicated and in lockfile order: importers first, in the
 * order the lockfile lists them, then packages in the order the lockfile lists
 * them. Two instances of one `name@version` that differ only by peer suffix
 * each get their own row, so the dependents of each variant stay attributed to
 * the variant they actually took.
 *
 * **Example** (Record who pulls a resolved instance)
 *
 * ```ts
 * import { DuplicateInstance } from "@beep/repo-workspaces/DuplicateCheck";
 *
 * const instance = DuplicateInstance.make({
 *   instanceId: "effect@4.0.0", dependents: [{ _tag: "importer", path: "." }],
 * });
 * console.log(instance.dependents.length) // 1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DuplicateInstance extends S.Opaque<DuplicateInstance, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The opaque instance id, as `@beep/lockfiles` records it. */
    instanceId: S.NonEmptyString.pipe(
      $I.annoteKey("DuplicateInstance.instanceId", {
        description: "The opaque instance id, as `@beep/lockfiles` records it.",
      })
    ),
    /** Every importer and package that pulls THIS copy. */
    dependents: S.Array(Dependent).pipe(
      $I.annoteKey("DuplicateInstance.dependents", { description: "Every importer and package that pulls THIS copy." })
    ),
  }).pipe(
    $I.annoteSchema("DuplicateInstance", {
      description: "One resolved instance of a duplicated version, with everything that pulls it.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DuplicateInstance {
  /**
   * The plain, unbranded encoded shape of a {@link DuplicateInstance}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DuplicateInstance.Encoded;
}

/**
 * **Example** (Group instances at one version)
 *
 * ```ts
 * import { DuplicatedVersion, DuplicateInstance } from "@beep/repo-workspaces/DuplicateCheck";
 *
 * const version = DuplicatedVersion.make({
 *   version: "4.0.0", instances: [DuplicateInstance.make({ instanceId: "effect@4.0.0", dependents: [] })],
 * });
 * console.log(version.version) // 4.0.0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DuplicatedVersion extends S.Opaque<DuplicatedVersion, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The resolved version. */
    version: S.String.pipe($I.annoteKey("DuplicatedVersion.version", { description: "The resolved version." })),
    /** Every instance at this version — more than one when peer suffixes differ. */
    instances: S.Array(DuplicateInstance).pipe(
      $I.annoteKey("DuplicatedVersion.instances", {
        description: "Every instance at this version — more than one when peer suffixes differ.",
      })
    ),
  }).pipe($I.annoteSchema("DuplicatedVersion", { description: "One version a duplicated package resolved at." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DuplicatedVersion {
  /**
   * The plain, unbranded encoded shape of a {@link DuplicatedVersion}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DuplicatedVersion.Encoded;
}

/**
 * **Details**
 *
 * `versions` always has at least two entries: a name resolved at one version
 * is never a duplicate, however many peer-suffix instances that version has.
 * Two instances of the same version load identical code and cannot produce the
 * type-identity skew this check exists to catch, so counting them would report
 * a problem nobody has.
 *
 * **Example** (Represent two resolved versions)
 *
 * ```ts
 * import { DuplicatedPackage, DuplicatedVersion } from "@beep/repo-workspaces/DuplicateCheck";
 *
 * const pkg = DuplicatedPackage.make({
 *   name: "effect",
 *   versions: [
 *     DuplicatedVersion.make({ version: "3.0.0", instances: [] }),
 *     DuplicatedVersion.make({ version: "4.0.0", instances: [] }),
 *   ],
 * });
 * console.log(pkg.versions.length) // 2
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DuplicatedPackage extends S.Opaque<DuplicatedPackage, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The package name. */
    name: S.NonEmptyString.pipe($I.annoteKey("DuplicatedPackage.name", { description: "The package name." })),
    /** Every version it resolved at, in lockfile order. Never fewer than two. */
    versions: S.Array(DuplicatedVersion).pipe(
      $I.annoteKey("DuplicatedPackage.versions", {
        description: "Every version it resolved at, in lockfile order. Never fewer than two.",
      })
    ),
  }).pipe(
    $I.annoteSchema("DuplicatedPackage", { description: "One package name reached at two or more distinct versions." })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DuplicatedPackage {
  /**
   * The plain, unbranded encoded shape of a {@link DuplicatedPackage}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DuplicatedPackage.Encoded;
}

/**
 * **Details**
 *
 * A report rather than a bare array, for the reason `PeerCheck` is one: an
 * empty array is indistinguishable from "this importer could not be looked
 * at". `unresolvedImporters` makes that difference legible.
 *
 * Pure and total — construct it with {@link DuplicateCheck.run}, which never
 * fails.
 *
 * **Example** (Report duplicate kit versions and their dependents)
 *
 * ```ts
 * import { Lockfile } from "@beep/lockfiles/Lockfile";
 * import { DuplicateCheck } from "@beep/repo-workspaces/DuplicateCheck";
 * import * as Effect from "effect/Effect";
 *
 * const text = "lockfileVersion: '9.0'\nimporters: { '.': {} }\npackages: {}\nsnapshots: {}\n";
 * const program = Effect.gen(function* () {
 *   const lockfile = yield* Lockfile.parse(text, { format: "pnpm" });
 *   const report = DuplicateCheck.run(lockfile, { names: DuplicateCheck.kit });
 *   for (const pkg of report.duplicates) {
 *     for (const version of pkg.versions) {
 *       for (const instance of version.instances) {
 *         console.log(pkg.name, version.version, instance.dependents);
 *       }
 *     }
 *   }
 *   return report.isClean;
 * });
 * console.log(Effect.runSync(program)) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DuplicateCheck extends S.Class<DuplicateCheck, { readonly brand: unique symbol }>($I`DuplicateCheck`)(
  {
    /**
     * Every reported name resolved at two or more distinct versions, in
     * lockfile order.
     */
    duplicates: S.Array(DuplicatedPackage).pipe(
      $I.annoteKey("DuplicateCheck.duplicates", {
        description: "Every reported name resolved at two or more distinct versions, in lockfile order.",
      })
    ),
    /**
     * Importers whose dependencies could not be resolved to instances, so
     * nothing reachable only through them was counted.
     *
     * **Gotchas**
     *
     * In practice this is the **root importer under npm and bun**: neither
     * records a resolved version per importer dependency, and neither emits a
     * package row for the root, so there is nothing to join on. pnpm records a
     * version per importer dependency and is unaffected. `PeerCheck` reports the
     * same limitation.
     *
     * Reported rather than silently skipped: a gate that sees no duplicates is
     * entitled to know whether that means "clean" or "not looked at".
     */
    unresolvedImporters: S.Array(S.String).pipe(
      $I.annoteKey("DuplicateCheck.unresolvedImporters", {
        description:
          "Importers whose dependencies could not be resolved to instances, so nothing reachable only through them was counted.",
      })
    ),
  },
  $I.annote("DuplicateCheck", {
    description: "The result of checking a lockfile for packages resolved at more than one version.",
  })
) {
  /**
   * Whether no reported name is duplicated.
   *
   * **Gotchas**
   *
   * Answers for the names asked about, not for the whole graph: with a
   * `names` filter, a duplicated name the filter rejects does not make the
   * report unclean. It says nothing about `unresolvedImporters` — a gate
   * wanting a proven-clean answer checks both.
   *
   * **Example** (Inspect a report with unresolved importers)
   *
   * ```ts
   * import { DuplicateCheck } from "@beep/repo-workspaces/DuplicateCheck";
   *
   * const report = DuplicateCheck.make({ duplicates: [], unresolvedImporters: ["."] });
   * console.log(report.isClean) // true
   * ```
   *
   * @returns `true` when the report lists no duplicate.
   * @category predicates
   * @since 0.0.0
   */
  get isClean(): boolean {
    return this.duplicates.length === 0;
  }

  /**
   * The names every consumer of this kit asks about: `effect` itself and every
   * `@effected/*` package.
   *
   * **Details**
   *
   * Exactly those — not `@effect/*`, and not names merely starting with
   * `effect`. A duplicated kit package presents as a `Layer` requirement that
   * looks provided yet cannot be satisfied, at the entry point, naming neither
   * the package nor the skew; this predicate is the check that names both.
   *
   * **Example** (Select only kit package names)
   *
   * ```ts
   * import { DuplicateCheck } from "@beep/repo-workspaces/DuplicateCheck";
   *
   * console.log(DuplicateCheck.kit("effect")) // true
   * console.log(DuplicateCheck.kit("@beep/repo-workspaces")) // true
   * console.log(DuplicateCheck.kit("@effect/platform")) // false
   * ```
   *
   * @param name - a package name
   * @returns whether the name belongs to the kit
   * @category predicates
   * @since 0.0.0
   */
  static kit(name: string): boolean {
    return name === "effect" || Str.startsWith("@effected/")(name);
  }

  /**
   * Compute which packages a parsed lockfile resolves at more than one
   * version, and who pulls each copy.
   *
   * **Details**
   *
   * Pure, total and format-free: no IO, no error channel, and no knowledge of
   * which package manager wrote the file.
   *
   * The walk starts at each importer's resolved dependencies and follows
   * `resolved` edges, so only instances some importer actually reaches are
   * counted — a stale row the lockfile still carries but nothing depends on is
   * not a duplicate. A name is a duplicate when the walk reaches it at **two
   * or more distinct versions**; peer-suffix instances of one version are
   * listed under that version but never make a name a duplicate on their own.
   *
   * Each instance's `dependents` are every importer whose roots include it and
   * every reached package whose `resolved` map points at it, deduplicated, in
   * lockfile order. `options.names` narrows what is reported, never what is
   * walked, so a filtered-out package still appears as a dependent where it
   * pulls a reported copy.
   *
   * The one limit it does not paper over is the npm and bun root importer
   * (see `unresolvedImporters`).
   *
   * **Example** (Check an empty normalized lockfile)
   *
   * ```ts
   * import { DuplicateCheck } from "@beep/repo-workspaces/DuplicateCheck";
   * import { Lockfile } from "@beep/lockfiles/Lockfile";
   * const lockfile = Lockfile.make({
   *   format: "pnpm", lockfileVersion: "9.0", packages: [], workspaceDependencies: [],
   * });
   *
   * const report = DuplicateCheck.run(lockfile, { names: DuplicateCheck.kit });
   * console.log(report.duplicates.length) // 0
   * ```
   *
   * @param lockfile - a lockfile parsed by `@beep/lockfiles`
   * @param options - see {@link DuplicateCheckOptions}
   * @returns the report; never fails
   * @category utilities
   * @since 0.0.0
   */
  static readonly run: {
    (lockfile: Lockfile, options?: DuplicateCheckOptions): DuplicateCheck;
    (options?: DuplicateCheckOptions): (lockfile: Lockfile) => DuplicateCheck;
  } = dual(
    (args) => S.is(Lockfile)(args[0]),
    (lockfile: Lockfile, options?: DuplicateCheckOptions): DuplicateCheck => {
      const names = options?.names ?? (() => true);
      const index = indexInstances(lockfile);
      const seeds = seedRoots(lockfile, index);
      const reached = reachFrom(seeds.queue, index.byId);
      const dependents = dependentsOf(lockfile, index.byId, reached, seeds.importerRoots);
      const duplicates = A.getSomes(
        A.map([...versionsByName(lockfile, reached)], ([name, versions]) =>
          duplicateOf(name, versions, dependents, names)
        )
      );
      return DuplicateCheck.make({ duplicates, unresolvedImporters: seeds.unresolved });
    }
  );
}

/**
 * Where the walk starts, and which importers could not be joined.
 *
 * @internal
 */
interface Seeds {
  readonly importerRoots: ReadonlyArray<readonly [instanceId: string, importerPath: string]>;
  readonly queue: ReadonlyArray<ResolvedPackage>;
  readonly unresolved: ReadonlyArray<string>;
}

/**
 * Every importer's roots; see {@link Seeds}.
 *
 * @param lockfile - The parsed lockfile.
 * @param index - The lockfile's instance index.
 * @returns The walk's seeds.
 * @internal
 */
const seedRoots = (lockfile: Lockfile, index: InstanceIndex): Seeds => {
  const importerRoots: Array<readonly [instanceId: string, importerPath: string]> = [];
  const unresolved: Array<string> = [];
  const queue: Array<ResolvedPackage> = [];
  for (const importer of lockfile.importers) {
    const roots = rootInstances(lockfile, importer.path, index);
    if (roots === undefined) unresolved.push(importer.path);
    else if (roots._tag === "own") queue.push(roots.instance);
    else {
      importerRoots.push(...A.map(roots.instances, (instance) => [instance.instanceId, importer.path] as const));
      queue.push(...roots.instances);
    }
  }
  return { importerRoots, queue, unresolved };
};

/**
 * Every instance reachable from `roots`.
 *
 * **Details**
 *
 * One global walk: reachability is a property of the graph, not of any single
 * importer, and every reached edge is a dependent to record.
 *
 * @param roots - The starting instances.
 * @param byId - Every instance, by id.
 * @returns The reached instance ids.
 * @internal
 */
const reachFrom = (
  roots: ReadonlyArray<ResolvedPackage>,
  byId: MutableHashMap.MutableHashMap<string, ResolvedPackage>
): MutableHashSet.MutableHashSet<string> => {
  const reached = MutableHashSet.empty<string>();
  const queue = [...roots];
  for (const current of queue) {
    if (MutableHashSet.has(reached, current.instanceId)) continue;
    MutableHashSet.add(reached, current.instanceId);
    const unreached = A.filter(R.values(current.resolved), (targetId) => !MutableHashSet.has(reached, targetId));
    queue.push(...A.getSomes(A.map(unreached, (targetId) => MutableHashMap.get(byId, targetId))));
  }
  return reached;
};

/**
 * Every reached instance's dependents, in lockfile order.
 *
 * **Details**
 *
 * Importer roots first, then every reached package's edges in the order the
 * lockfile lists the packages. Built from the lockfile rather than from the
 * walk so the order never depends on which importer happened to reach an
 * instance first.
 *
 * @param lockfile - The parsed lockfile.
 * @param byId - Every instance, by id.
 * @param reached - The reached instance ids.
 * @param importerRoots - The importer-entry roots, in importer order.
 * @returns Each reached instance's dependents.
 * @internal
 */
const dependentsOf = (
  lockfile: Lockfile,
  byId: MutableHashMap.MutableHashMap<string, ResolvedPackage>,
  reached: MutableHashSet.MutableHashSet<string>,
  importerRoots: Seeds["importerRoots"]
): MutableHashMap.MutableHashMap<string, Array<Dependent>> => {
  const dependents = MutableHashMap.empty<string, Array<Dependent>>();
  const seen = MutableHashSet.empty<string>();
  const record = (targetId: string, dependent: Dependent): void => {
    const key = Result.getOrThrow(encodeRelationshipKey([targetId, dependent]));
    if (MutableHashSet.has(seen, key)) return;
    MutableHashSet.add(seen, key);
    const list = O.getOrElse(MutableHashMap.get(dependents, targetId), (): Array<Dependent> => []);
    list.push(dependent);
    MutableHashMap.set(dependents, targetId, list);
  };
  for (const [instanceId, path] of importerRoots) record(instanceId, { _tag: "importer", path });
  for (const pkg of A.filter(lockfile.packages, (row) => MutableHashSet.has(reached, row.instanceId))) {
    const from = dependentOf(pkg);
    for (const targetId of A.filter(R.values(pkg.resolved), (id) => MutableHashMap.has(byId, id))) {
      record(targetId, from);
    }
  }
  return dependents;
};

/**
 * Reached instances grouped by name, then by version, keeping lockfile order
 * on both axes.
 *
 * @param lockfile - The parsed lockfile.
 * @param reached - The reached instance ids.
 * @returns The reached instances, by name and version.
 * @internal
 */
const versionsByName = (
  lockfile: Lockfile,
  reached: MutableHashSet.MutableHashSet<string>
): MutableHashMap.MutableHashMap<string, MutableHashMap.MutableHashMap<string, Array<ResolvedPackage>>> => {
  const byName = MutableHashMap.empty<string, MutableHashMap.MutableHashMap<string, Array<ResolvedPackage>>>();
  for (const pkg of A.filter(lockfile.packages, (row) => MutableHashSet.has(reached, row.instanceId))) {
    const versions = O.getOrElse(MutableHashMap.get(byName, pkg.name), () =>
      MutableHashMap.empty<string, Array<ResolvedPackage>>()
    );
    const instances = O.getOrElse(MutableHashMap.get(versions, pkg.version), (): Array<ResolvedPackage> => []);
    instances.push(pkg);
    MutableHashMap.set(versions, pkg.version, instances);
    MutableHashMap.set(byName, pkg.name, versions);
  }
  return byName;
};

/**
 * The duplicate one name's versions make, when they make one.
 *
 * **Details**
 *
 * Two or more DISTINCT VERSIONS is the rule. Instance count is not:
 * peer-suffix variants of one version are the same code.
 *
 * @param name - A captured package's `name` field.
 * @param versions - The name's reached instances, by version.
 * @param dependents - Each instance's dependents.
 * @param names - The caller's name filter.
 * The duplicate is a plain constructor input, not an admitted record:
 * `DuplicateCheck.make` validates the whole tree once, so no instance is
 * re-validated and copied at each nesting level.
 *
 * @returns The duplicate, or none.
 * @internal
 */
const duplicateOf = (
  name: string,
  versions: MutableHashMap.MutableHashMap<string, Array<ResolvedPackage>>,
  dependents: MutableHashMap.MutableHashMap<string, Array<Dependent>>,
  names: (name: string) => boolean
): O.Option<DuplicatedPackageInput> => {
  if (MutableHashMap.size(versions) < 2 || !names(name)) return O.none();
  return O.some({
    name,
    versions: A.map([...versions], ([version, instances]) => ({
      version,
      instances: A.map(instances, (instance) => ({
        instanceId: instance.instanceId,
        dependents: O.getOrElse(MutableHashMap.get(dependents, instance.instanceId), () => []),
      })),
    })),
  });
};

type DuplicatedPackageInput = (typeof DuplicatedPackage)["~type.make.in"];

/**
 * The dependent an edge leaving `from` is attributed to.
 *
 * **Details**
 *
 * A workspace row standing for an importer is that importer: its edges are the
 * project's own dependencies, so they are attributed by path. A workspace row
 * the lockfile records without a path (npm can) falls back to the package
 * form, which is at least truthful about the name.
 *
 * @param from - The instance the edge leaves.
 * @returns The importer or package the edge is attributed to.
 * @internal
 */
const dependentOf = (from: ResolvedPackage): Dependent =>
  from.isWorkspace && from.relativePath !== undefined
    ? { _tag: "importer", path: from.relativePath }
    : { _tag: "package", name: from.name, version: from.version };
