/**
 * Unsatisfied peer-dependency detection over a parsed lockfile — a pure
 * VALUE, not a service. No IO, nothing in `R`, no error channel.
 *
 * **Details**
 *
 * The computation is FORMAT-FREE. `@beep/lockfiles` normalizes every
 * manager's lockfile into package *instances* carrying `instanceId`,
 * `peerDependencies`, `peerDependenciesMeta` and `resolved` (name → the
 * instanceId that name actually resolved to), so this module never learns
 * which manager wrote the file. That is the whole point of the model work
 * behind it: shelling out to each package manager's own peer command cannot
 * deliver bun (which reports nothing on a no-op install and never records the
 * wanted range), so the answer has to come from the graph.
 *
 * `instanceId` is OPAQUE here — looked up, never parsed. Splitting one on `@`
 * or "(" would re-introduce the format knowledge this module exists without.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoWorkspacesId } from "@beep/identity/packages";
import { Lockfile, ResolvedPackage } from "@beep/lockfiles";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Range, SemVer } from "@beep/semver";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PeerDependencyRules } from "./ConfigDependencyHooks.ts";
import { peerNameMatcher } from "./internal/peerPatterns.ts";
import { indexInstances, rootInstances } from "./internal/roots.ts";
import { CatalogSet } from "./WorkspaceCatalogs.ts";
import { WorkspacePackage } from "./WorkspacePackage.ts";
import type { PeerNameMatcher } from "./internal/peerPatterns.ts";
import type { ImporterRoots, InstanceIndex } from "./internal/roots.ts";

const $I = $RepoWorkspacesId.create("PeerCheck");

/**
 * **Details**
 *
 * Closed at exactly four:
 *
 * - `"peerRulesNotApplied"` — the effective suppression policy was not applied,
 *   so pnpm's post-hoc suppression could not be replicated and some reported
 *   rows may be ones pnpm hides. **Omitting the option always produces this**,
 *   because "nobody looked" and "I looked and there are none" are different
 *   facts. Supplied rules never produce it: all three axes —
 *   `allowedVersions`, `ignoreMissing` and `allowAny` — are applied with
 *   pnpm's semantics.
 * - `"unresolvedEdge"` — some instance records an edge this model could not
 *   name (`ResolvedPackage.unresolvedEdges`), or an importer dependency
 *   resolved through `link:` whose target the caller did not supply, so its
 *   manifest peers are still invisible. Either way the peers that edge
 *   involves are neither confirmed satisfied nor confirmed unmet.
 *
 * Supplying {@link PeerCheckOptions.workspacePackages} clears the second
 * trigger for every `link:` target the supplied set covers AND the walk
 * reaches: the linked manifest's peers are joined and judged for real, which
 * is what makes the report an answer rather than a refusal. Omitting the
 * option — or omitting a linked target from it — leaves the edge unverified,
 * because an unjoined parent's peers are recorded nowhere in the lockfile; so
 * does a covered target the lockfile records no workspace row for, since
 * there is nothing to walk and its peers were never judged.
 *
 * - `"peerRangeUnresolved"` — a peer declared by a joined `link:` manifest has
 *   a range that is a protocol specifier this check could not turn into a
 *   range, while something resolved for that peer, so the comparison was
 *   never performed. The trigger is a `catalog:` specifier with
 *   {@link PeerCheckOptions.catalogs} omitted, a `catalog:` specifier the
 *   supplied set names nothing for, or any other protocol (`workspace:*` and
 *   friends). A peer with NOTHING resolved never produces it: "no provider"
 *   is reportable without the range, so that row is emitted as usual.
 * - `"peerVersionUnresolved"` — a peer resolved to a non-workspace provider
 *   whose version is a protocol specifier rather than a version, so the
 *   comparison was never performed. That is any `file:` provider — a
 *   directory, a tarball, or either through a `file:` override
 *   (`file:../x`) — and equally a git or remote-tarball provider, which
 *   pnpm keys by its URL (`https://codeload.github.com/…`,
 *   `git+https://…`), so the URL stands where a version belongs. The
 *   lockfile records no version for a `file:` directory at all, and
 *   `pnpm peers check` reports such a peer as a `bad` row carrying the
 *   specifier as its found version even when the directory's own manifest
 *   satisfies the range, so calling it satisfied would pass a workspace
 *   pnpm rejects. Applies to a peer declared by a lockfile row and
 *   by a joined `link:` manifest alike. A workspace-row provider never
 *   produces it (it is accepted as always), and neither does a plain
 *   unparseable version, which is skipped.
 *
 * All four mean **fail closed**: a gate should treat an unverified report as
 * "not proven clean" rather than as a pass.
 *
 * **Example** (Recognize an incomplete report reason)
 *
 * ```ts
 * import { UnverifiedReason } from "@beep/repo-workspaces/PeerCheck";
 * import * as S from "effect/Schema";
 * console.log(S.is(UnverifiedReason)("unresolvedEdge")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const UnverifiedReason = LiteralKit([
  "peerRulesNotApplied",
  "unresolvedEdge",
  "peerRangeUnresolved",
  "peerVersionUnresolved",
]).pipe($I.annoteSchema("UnverifiedReason", { description: "Why a peer report is not a complete answer." }));
/**
 * The decoded reason an incomplete peer report cannot prove cleanliness.
 *
 * @category type-level
 * @since 0.0.0
 */
export type UnverifiedReason = typeof UnverifiedReason.Type;

/**
 * **Gotchas**
 *
 * **Presence of `peerDependencyRules` is the assertion; its contents are the
 * value.** Supplying `NoPeerDependencyRules` asserts the workspace has none and
 * yields a verified report; omitting the key entirely says nothing was looked
 * up and always yields `"peerRulesNotApplied"`. The two are deliberately
 * different results, because a gate must be able to tell "clean" from
 * "unchecked".
 *
 * **All three axes of the supplied rules are applied**, each with pnpm's
 * semantics (see {@link PeerCheck.run}): `allowedVersions`
 * permits a resolved version by range, `ignoreMissing` hides a required peer
 * nothing resolved for, and `allowAny` hides a peer that resolved outside its
 * range. The two list axes are name patterns, never `parent>peer` keys.
 *
 * **Example** (Validate explicit empty peer rules)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { PeerCheckOptions } from "@beep/repo-workspaces/PeerCheck";
 *
 * console.log(S.is(PeerCheckOptions)({ peerDependencyRules: { allowedVersions: {}, ignoreMissing: [], allowAny: [] } })) // true
 * console.log(S.is(PeerCheckOptions)(null)) // false
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class PeerCheckOptions extends S.Opaque<PeerCheckOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The workspace's effective rules, from `WorkspaceCatalogs.peerDependencyRules()`.
     */
    peerDependencyRules: S.optionalKey(PeerDependencyRules).pipe(
      $I.annoteKey("PeerCheckOptions.peerDependencyRules", {
        description: "The workspace's effective peer-suppression rules; absence leaves the policy unverified.",
      })
    ),
    /**
     * The workspace's discovered packages, from `WorkspaceDiscovery` — the
     * manifests a `link:`-resolved parent's peers have to be read from,
     * because the lockfile does not record them.
     *
     * **Details**
     *
     * **Supplying this key is what turns a `link:` edge from a refusal into an
     * answer.** pnpm records no peer declarations for workspace projects, so a
     * parent reached through `link:` joins at best to a row whose peers are
     * empty *by design*; with the manifests supplied, that parent's declared
     * peers are joined and judged instead. A `link:` target absent from the
     * supplied set — and every target, when the key is omitted — keeps the
     * report's `"unresolvedEdge"` marker, on the same presence-is-the-
     * assertion rule as `peerDependencyRules`.
     *
     * A `link:` target matches a package when it names the package's
     * `relativePath` — the POSIX workspace-relative directory the lockfile's
     * importer paths are spelled in — or its publish directory: pnpm links a
     * workspace dependency INTO `publishConfig.directory` unless
     * `publishConfig.linkDirectory` is `false` (it defaults to true), so the
     * lockfile then records `link:../a/dist`. Both spellings are normalized,
     * and the caller passes what discovery produced without re-spelling
     * anything.
     *
     * For a publish-directory link, pnpm reads the peers from the manifest AT
     * the link target — the built one — while this check reads the supplied
     * source manifest and resolves its `catalog:` ranges through
     * {@link PeerCheckOptions.catalogs}. The two agree when the build emits the
     * peer ranges the source's specifiers resolve to, which is the contract a
     * publish-directory build keeps.
     */
    workspacePackages: WorkspacePackage.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("PeerCheckOptions.workspacePackages", {
        description: "Discovered workspace manifests whose linked peers can be joined and judged.",
      })
    ),
    /**
     * The workspace's catalogs, from `WorkspaceCatalogs.set()` — which already
     * includes any catalogs a config-dependency hook injects.
     *
     * **Details**
     *
     * A joined manifest may declare a peer as `catalog:` or `catalog:<name>`
     * rather than as a range. With this key supplied, such a specifier is
     * resolved through the set and the RESOLVED range is judged and reported
     * as `wanted`, which is what `pnpm peers check` reports as `wantedRange`.
     * A specifier the set names nothing for — and every `catalog:` specifier,
     * when the key is omitted — cannot be judged against a provider, and the
     * report carries `"peerRangeUnresolved"` rather than calling the peer
     * satisfied: the same presence-is-the-assertion rule as the other two
     * keys.
     */
    catalogs: S.optionalKey(CatalogSet).pipe(
      $I.annoteKey("PeerCheckOptions.catalogs", {
        description: "The workspace catalogs used to resolve joined peer ranges.",
      })
    ),
  }).pipe(
    $I.annoteSchema("PeerCheckOptions", {
      description:
        "Optional caller-supplied peer policy, workspace manifests and catalogs; defaults remain lazy in the check.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PeerCheckOptions {
  /**
   * The plain, unbranded encoded shape of a {@link PeerCheckOptions}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PeerCheckOptions.Encoded;
  /**
   * The constructor input of a {@link PeerCheckOptions}: decoded field values without the
   * brand, so a caller passes live `PeerDependencyRules`, `WorkspacePackage` and `CatalogSet` values rather than their encoded forms.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Input = (typeof PeerCheckOptions)["~type.make.in"];
}

/**
 * **Details**
 *
 * Mirrors the shape `pnpm peers check --json` reports, so the two can be
 * compared directly.
 *
 * **Example** (Record the declaring package)
 *
 * ```ts
 * import { PeerParent } from "@beep/repo-workspaces/PeerCheck";
 * const parent = PeerParent.make({ name: "react-dom", version: "18.3.1" });
 * console.log(parent.name) // react-dom
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PeerParent extends S.Opaque<PeerParent, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The package name.
     */
    name: S.NonEmptyString.pipe($I.annoteKey("PeerParent.name", { description: "The package name." })),
    /**
     * The resolved version of that package.
     */
    version: S.String.pipe(
      $I.annoteKey("PeerParent.version", { description: "The resolved version of that package." })
    ),
  }).pipe(
    $I.annoteSchema("PeerParent", {
      description: "One link in the chain from an importer to the package that declared an unsatisfied peer.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PeerParent {
  /**
   * The plain, unbranded encoded shape of a {@link PeerParent}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PeerParent.Encoded;
}

/**
 * **Details**
 *
 * `found` carries the version that actually resolved, or `null` when nothing
 * resolved at all. There is deliberately **no separate discriminant** between
 * "missing" and "unmet": `found === null` is the whole distinction, and a
 * renderer reads it directly.
 *
 * `optional` must be respected by any gate — an unsatisfied *optional* peer is
 * normal and should not fail a build, which is why the flag travels with the
 * row rather than being filtered out here. {@link PeerCheck.required} is the
 * convenience for the common case.
 *
 * `parents` is the path from the importer down to the package that declared
 * the peer, nearest-to-the-importer first. It is a path rather than a single
 * package because a peer declared by a transitive dependency is still that
 * importer's problem, and the chain is what makes the report actionable.
 *
 * A package an importer reaches by more than one path yields **one** row, not
 * one per path, carrying the path the walk reached first — which is what
 * `pnpm peers check` reports for the same graph. Read `parents` as *a* route to
 * the declaring package, never as the complete set of them.
 *
 * **Example** (Record a missing required peer)
 *
 * ```ts
 * import { UnsatisfiedPeer } from "@beep/repo-workspaces/PeerCheck";
 * const peer = UnsatisfiedPeer.make({ importer: ".", dependency: "react", wanted: "^18.0.0", found: null, optional: false, parents: [] });
 * console.log(peer.found) // null
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class UnsatisfiedPeer extends S.Opaque<UnsatisfiedPeer, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The importer path the problem belongs to (`"."` for the root).
     */
    importer: S.NonEmptyString.pipe(
      $I.annoteKey("UnsatisfiedPeer.importer", {
        description: 'The importer path the problem belongs to (`"."` for the root).',
      })
    ),
    /**
     * The peer dependency's name.
     */
    dependency: S.NonEmptyString.pipe(
      $I.annoteKey("UnsatisfiedPeer.dependency", { description: "The peer dependency's name." })
    ),
    /**
     * The range the declaring package asked for.
     */
    wanted: S.String.pipe(
      $I.annoteKey("UnsatisfiedPeer.wanted", { description: "The range the declaring package asked for." })
    ),
    /**
     * The version that resolved, or `null` when nothing resolved.
     */
    found: S.NullOr(S.String).pipe(
      $I.annoteKey("UnsatisfiedPeer.found", {
        description: "The version that resolved, or `null` when nothing resolved.",
      })
    ),
    /**
     * Whether the declaring package marked the peer optional.
     */
    optional: S.Boolean.pipe(
      $I.annoteKey("UnsatisfiedPeer.optional", {
        description: "Whether the declaring package marked the peer optional.",
      })
    ),
    /**
     * The path from the importer to the declaring package.
     */
    parents: S.Array(PeerParent).pipe(
      $I.annoteKey("UnsatisfiedPeer.parents", { description: "The path from the importer to the declaring package." })
    ),
  }).pipe(
    $I.annoteSchema("UnsatisfiedPeer", { description: "One peer dependency that is declared but not satisfied." })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UnsatisfiedPeer {
  /**
   * The plain, unbranded encoded shape of a {@link UnsatisfiedPeer}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof UnsatisfiedPeer.Encoded;
}

/**
 * The formats whose lockfiles record peer resolution.
 *
 * **Details**
 *
 * An allowlist rather than a `!== "yarn"` denylist, so a format added to
 * `Lockfile["format"]` is unsupported until someone says otherwise. A denylist
 * would report the new format `supported: true` with an empty `unsatisfied`
 * before any parser records peer resolution for it — a clean bill of health
 * produced by a limitation, which is the failure this module exists to avoid.
 *
 * @internal
 */
const PEER_RESOLVING_FORMATS: MutableHashSet.MutableHashSet<Lockfile["format"]> = MutableHashSet.fromIterable<
  Lockfile["format"]
>(["npm", "pnpm", "bun"]);

/**
 * @param format - The lockfile's format.
 * @returns `true` when the format records peer resolutions.
 * @internal
 */
const supportsPeerResolution = (format: Lockfile["format"]): boolean =>
  MutableHashSet.has(PEER_RESOLVING_FORMATS, format);

/**
 * The protocol pnpm records a workspace-directory resolution under, passed
 * through verbatim on `ImporterDependency.version` by `@beep/lockfiles`.
 *
 * @internal
 */
const LINK_PREFIX = "link:";

const Walk = S.Struct({
  instance: ResolvedPackage.pipe(
    $I.annoteKey("Walk.instance", { description: "The resolved package instance reached by the walk." })
  ),
  path: S.Array(PeerParent).pipe(
    $I.annoteKey("Walk.path", { description: "The ordered parent chain from the importer to this instance." })
  ),
}).pipe($I.annoteSchema("Walk", { description: "One plain traversal node and its ordered peer-attribution chain." }));
type Walk = (typeof Walk)["~type.make.in"];
type PeerParentInput = (typeof PeerParent)["~type.make.in"];
type UnsatisfiedPeerInput = (typeof UnsatisfiedPeer)["~type.make.in"];

/**
 * The workspace-relative directory a `link:` version names, resolved against
 * the importer that recorded it.
 *
 * **Details**
 *
 * `link:../a` in `packages/b` is `packages/a`. Deliberately pure string
 * arithmetic rather than `node:path`: `link:` targets are spelled POSIX in a
 * lockfile, and a Windows host would otherwise translate them to backslashes
 * and stop matching the importer paths the same file uses.
 *
 * @internal
 */
const linkTargetPath: {
  (importerPath: string, target: string): string;
  (target: string): (importerPath: string) => string;
} = dual(2, (importerPath: string, target: string): string => {
  const absolute = Str.startsWith("/")(target);
  const segments = absolute || importerPath === "." ? [] : Str.split(importerPath, "/");
  const path = A.join(A.reduce([...segments, ...Str.split(target, "/")], [], resolveSegment), "/");
  if (absolute) return `/${path}`;
  return path === "" ? "." : path;
});

/**
 * Append one POSIX path segment to the segments resolved so far.
 *
 * **Details**
 *
 * Empty and `.` segments vanish; `..` pops the last segment unless there is
 * none, or it is itself a `..` that climbs above the start.
 *
 * @param resolved - The segments resolved so far.
 * @param segment - The next segment.
 * @returns The segments with `segment` applied.
 * @internal
 */
const resolveSegment = (resolved: ReadonlyArray<string>, segment: string): ReadonlyArray<string> => {
  if (segment === "" || segment === ".") return resolved;
  if (segment !== "..") return A.append(resolved, segment);
  const last = A.last(resolved);
  return O.isNone(last) || last.value === ".." ? A.append(resolved, segment) : A.dropRight(resolved, 1);
};

/**
 * One `link:`-resolved importer dependency, classified before the walk.
 *
 * @internal
 */
const LinkEdge = S.Struct({
  name: S.String.pipe(
    $I.annoteKey("LinkEdge.name", { description: "The dependency name the importer uses for this link." })
  ),
  row: S.UndefinedOr(ResolvedPackage).pipe(
    $I.annoteKey("LinkEdge.row", {
      description: "The target's workspace row, or explicit undefined when no row is recorded.",
    })
  ),
  covered: S.Boolean.pipe(
    $I.annoteKey("LinkEdge.covered", { description: "Whether the supplied manifest set covers this link target." })
  ),
}).pipe(
  $I.annoteSchema("LinkEdge", {
    description: "One plain classified link edge, retaining an explicitly absent row and manifest coverage.",
  })
);
type LinkEdge = typeof LinkEdge.Type;

/**
 * An importer's walk roots with its `link:` targets seeded in.
 *
 * **Details**
 *
 * An importer with its own workspace row already reaches its link targets
 * through that row's `resolved` edges. One without — the ROOT under pnpm —
 * does not: the shared join composes `name@link:…`, matches no instance, and
 * drops the dependency, so a covered target there would never be walked.
 * Seeding the target rows here, rather than forking the shared join in
 * `internal/roots.ts`, keeps `DuplicateCheck` on the join it was measured
 * against while letting the peer walk judge the root's linked parents against
 * the root's own provider context, as pnpm does (`linkdeep-root/`).
 *
 * An importer the shared join gave up on is rescued only when EVERY versioned
 * dependency it has is a `link:` edge with a row: that failure was then the
 * missing link seed and nothing else. Any other unjoinable dependency keeps the
 * importer unresolved.
 *
 * @internal
 */
const withLinkRoots: {
  (
    roots: ImporterRoots | undefined,
    links: ReadonlyArray<LinkEdge>,
    dependencies: ReadonlyArray<{ readonly version?: string | undefined }>
  ): ImporterRoots | undefined;
  (
    links: ReadonlyArray<LinkEdge>,
    dependencies: ReadonlyArray<{ readonly version?: string | undefined }>
  ): (roots: ImporterRoots | undefined) => ImporterRoots | undefined;
} = dual(
  3,
  (
    roots: ImporterRoots | undefined,
    links: ReadonlyArray<LinkEdge>,
    dependencies: ReadonlyArray<{ readonly version?: string | undefined }>
  ): ImporterRoots | undefined => {
    const rows = A.flatMap(links, (link) => (link.row === undefined ? [] : [link.row]));
    if (roots?._tag === "own" || rows.length === 0) return roots;
    if (roots === undefined) {
      const versioned = A.filter(dependencies, (dep) => dep.version !== undefined).length;
      if (versioned !== rows.length) return undefined;
      return { _tag: "dependencies", instances: rows };
    }
    return { _tag: "dependencies", instances: [...roots.instances, ...rows] };
  }
);

/**
 * The workspace-relative directories a `link:` to `pkg` can name.
 *
 * **Details**
 *
 * The package directory always, and — when `publishConfig.directory` is set
 * and `publishConfig.linkDirectory` is not `false` — the publish directory
 * inside it, because that is where pnpm links a workspace dependency then.
 * Measured against pnpm 12.6.0, not assumed: `directory` alone records
 * `link:../a/dist` (`linkdeep-directory/`, byte-identical with and without
 * `linkDirectory: true`), and `linkDirectory: false` records `link:../a`
 * (`linkdeep-directory-false/`). pnpm defaults `linkDirectory` to true.
 *
 * pnpm reads a publish-directory target's peers from the manifest AT that
 * target — the built one — while the join reads the supplied source manifest
 * and resolves `catalog:` ranges through the caller's catalogs. The two agree
 * exactly when the build emits the peer ranges the source's specifiers
 * resolve to, which is the contract a publish-directory build keeps.
 *
 * @internal
 */
const linkTargetsOf: {
  (relativePath: string, pkg: WorkspacePackage): ReadonlyArray<string>;
  (pkg: WorkspacePackage): (relativePath: string) => ReadonlyArray<string>;
} = dual(2, (relativePath: string, pkg: WorkspacePackage): ReadonlyArray<string> => {
  const directory = pkg.publishConfig?.directory;
  if (directory === undefined || pkg.publishConfig?.linkDirectory === false) return [relativePath];
  const published = linkTargetPath(relativePath, directory);
  return published === relativePath ? [relativePath] : [relativePath, published];
});

/**
 * The caller-supplied manifests, the `link:` targets they cover, and the
 * dependency set a joined parent's peers resolve from.
 *
 * @internal
 */
interface Join {
  readonly catalogs: CatalogSet | undefined;
  readonly context: MutableHashMap.MutableHashMap<string, ResolvedPackage>;
  readonly joinable: MutableHashSet.MutableHashSet<string>;
  readonly manifests: MutableHashMap.MutableHashMap<string, WorkspacePackage>;
}

/**
 * The dependency instances a joined parent's peers resolve against.
 *
 * **Details**
 *
 * **The importer's own dependency set, not the workspace's.** Measured
 * against pnpm 12.5.1 and 12.6.0 on the `linkdeep*` probe workspace, one
 * variable at a time: `react@18.3.1` as `packages/b`'s OWN dependency leaves
 * the linked `probe-a`'s `react: ^18.0.0` peer satisfied (pnpm 12.5.1 reports
 * the importer clean), the same version installed only by a SIBLING importer
 * does not (`packages/b` reports it missing), and `react@17.0.2` of its own
 * is a `bad` row carrying `foundVersion: "17.0.2"`. A workspace-wide
 * name lookup — the obvious shortcut, since the instances are all in one
 * lockfile — would have reported the sibling case clean, which pnpm does not.
 *
 * Both root shapes answer the same question: an importer with its own
 * workspace row resolves peers against that row's recorded edges, and an
 * importer without one (the root under pnpm, npm and bun) against the
 * instances its dependency records joined to.
 *
 * @internal
 */
const providerContext: {
  (
    roots: ImporterRoots,
    byId: MutableHashMap.MutableHashMap<string, ResolvedPackage>,
    links: ReadonlyArray<LinkEdge>
  ): MutableHashMap.MutableHashMap<string, ResolvedPackage>;
  (
    byId: MutableHashMap.MutableHashMap<string, ResolvedPackage>,
    links: ReadonlyArray<LinkEdge>
  ): (roots: ImporterRoots) => MutableHashMap.MutableHashMap<string, ResolvedPackage>;
} = dual(
  3,
  (
    roots: ImporterRoots,
    byId: MutableHashMap.MutableHashMap<string, ResolvedPackage>,
    links: ReadonlyArray<LinkEdge>
  ): MutableHashMap.MutableHashMap<string, ResolvedPackage> => {
    const entries =
      roots._tag === "dependencies"
        ? [
            ...A.map(roots.instances, (instance) => [instance.name, instance] as const),
            ...A.flatMap(links, (link) => (link.row === undefined ? [] : [[link.name, link.row] as const])),
          ]
        : A.getSomes(
            A.map(R.toEntries(roots.instance.resolved), ([name, instanceId]) =>
              O.map(MutableHashMap.get(byId, instanceId), (provider) => [name, provider] as const)
            )
          );
    return MutableHashMap.fromIterable(entries);
  }
);

/**
 * The supplied manifest for a node the walk reached through a covered `link:`
 * edge, or `undefined` for every other node.
 *
 * **Details**
 *
 * The importer's OWN node is deliberately excluded — {@link collect} only
 * consults this for nodes with a non-empty chain. pnpm reports nothing for a
 * linked package's own unsatisfied peers (it reports them through a consumer),
 * so joining them onto the importer's own chain would emit rows the oracle
 * does not have.
 *
 * @internal
 */
const joinedManifest: {
  (join: Join, instance: ResolvedPackage): WorkspacePackage | undefined;
  (instance: ResolvedPackage): (join: Join) => WorkspacePackage | undefined;
} = dual(2, (join: Join, instance: ResolvedPackage): WorkspacePackage | undefined => {
  if (instance.relativePath === undefined || !MutableHashSet.has(join.joinable, instance.instanceId)) return undefined;
  return O.getOrUndefined(MutableHashMap.get(join.manifests, instance.relativePath));
});

/**
 * The peers a joined manifest marks optional.
 *
 * **Details**
 *
 * Read from the raw manifest record rather than from a typed model, because
 * `WorkspacePackage` carries `peerDependenciesMeta` as it was written, exactly
 * as the lockfile model carries its own. A malformed block yields no optional
 * peers, which is the stricter answer: an unsatisfied peer is reported rather
 * than silently excused.
 *
 * @param manifest - The joined manifest.
 * @returns The names of its optional peers.
 * @internal
 */
const optionalPeers = (manifest: WorkspacePackage): MutableHashSet.MutableHashSet<string> => {
  const optional = MutableHashSet.empty<string>();
  const meta: unknown = manifest.manifestRecord.peerDependenciesMeta;
  if (!P.isObjectOrArray(meta)) return optional;
  for (const [name, entry] of R.toEntries({ ...meta })) {
    if (
      P.isObjectKeyword(entry) &&
      !P.isFunction(entry) &&
      ("optional" in entry ? entry.optional : undefined) === true
    ) {
      MutableHashSet.add(optional, name);
    }
  }
  return optional;
};

/**
 * The chain element a node contributes, named from the supplied manifest when
 * the node is a joined link target.
 *
 * **Details**
 *
 * The lockfile names a workspace row by its DIRECTORY (`packages/a`) at the
 * placeholder version `0.0.0`, because pnpm records neither for an importer;
 * `pnpm peers check` reports the real `probe-a@1.0.0` it read from the
 * manifest, and the supplied manifest is the only place those two facts exist.
 *
 * @internal
 */
const parentLabel: {
  (join: Join, instance: ResolvedPackage): PeerParentInput;
  (instance: ResolvedPackage): (join: Join) => PeerParentInput;
} = dual(2, (join: Join, instance: ResolvedPackage): PeerParentInput => {
  const manifest = joinedManifest(join, instance);
  return {
    name: manifest?.name ?? instance.name,
    version: manifest?.version ?? instance.version,
  };
});

/**
 * A range or version that is really a protocol specifier (`catalog:`,
 * `workspace:`, `npm:`, `file:` …). Neither a semver range nor a semver
 * version starts with `<scheme>:`.
 *
 * @internal
 */
const PROTOCOL_SPECIFIER = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/**
 * Whether a declared range or a resolved version is a protocol specifier
 * rather than something semver can compare.
 *
 * **Details**
 *
 * The one test both halves of a comparison use: a range that is one yields
 * `"peerRangeUnresolved"`, a provider version that is one (`file:vendor/x`,
 * which `@beep/lockfiles` passes through for a `file:` provider) yields
 * `"peerVersionUnresolved"`.
 *
 * @param value - A declared range or a resolved version.
 * @returns `true` when it starts with a `<scheme>:` protocol.
 * @internal
 */
const isProtocolSpecifier = (value: string): boolean => PROTOCOL_SPECIFIER.test(value);

/**
 * @internal
 */
const CATALOG_PREFIX = "catalog:";

/**
 * The range a joined manifest's declared peer specifier stands for, or
 * `undefined` when it is a protocol specifier that cannot be resolved.
 *
 * **Details**
 *
 * A `catalog:` specifier resolves through the caller's catalogs; an omitted
 * set resolves nothing, since nothing was looked up. A resolution that is
 * itself a protocol specifier is no more a range than the input was. A plain
 * range passes through untouched, parseable or not — an unparseable
 * non-protocol range is declined as {@link judge} declines one.
 *
 * @internal
 */
const resolvePeerRange: {
  (catalogs: CatalogSet | undefined, peer: string, wanted: string): string | undefined;
  (peer: string, wanted: string): (catalogs: CatalogSet | undefined) => string | undefined;
} = dual(3, (catalogs: CatalogSet | undefined, peer: string, wanted: string): string | undefined => {
  let range = wanted;
  if (Str.startsWith(CATALOG_PREFIX)(wanted)) {
    const resolved = catalogs === undefined ? O.none() : catalogs.resolveSpecifier(peer, wanted);
    if (O.isNone(resolved)) return undefined;
    range = resolved.value;
  }
  return isProtocolSpecifier(range) ? undefined : range;
});

/**
 * What {@link judge} or {@link judgeJoined} concluded: a row to report,
 * nothing to report, or a peer it could not judge — with the reasons the
 * comparison was never performed, which the report surfaces on `unverified`.
 *
 * @internal
 */
const UnsatisfiedVerdict = S.TaggedStruct("unsatisfied", {
  found: S.NullOr(S.String).pipe(
    $I.annoteKey("UnsatisfiedVerdict.found", {
      description: "The resolved version spelling, or null when no provider resolved.",
    })
  ),
  version: S.NullOr(SemVer).pipe(
    $I.annoteKey("UnsatisfiedVerdict.version", {
      description: "The parsed provider version, or null when no provider resolved.",
    })
  ),
}).pipe(
  $I.annoteSchema("UnsatisfiedVerdict", { description: "A reportable peer mismatch or missing required provider." })
);
const SatisfiedVerdict = S.TaggedStruct("satisfied", {}).pipe(
  $I.annoteSchema("SatisfiedVerdict", { description: "A peer judgment with no row to report." })
);
const UnjudgedVerdict = S.TaggedStruct("unjudged", {
  reasons: S.Array(UnverifiedReason).pipe(
    $I.annoteKey("UnjudgedVerdict.reasons", {
      description: "The ordered reasons the peer comparison could not be performed.",
    })
  ),
}).pipe(
  $I.annoteSchema("UnjudgedVerdict", {
    description: "An incomplete peer judgment whose reasons remain visible in the report.",
  })
);
const Verdict = S.Union([UnsatisfiedVerdict, SatisfiedVerdict, UnjudgedVerdict]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Verdict", { description: "The three plain-object peer judgment variants." })
);
type Verdict = typeof Verdict.Type;

/**
 * A {@link Verdict} for a joined manifest's peer, whose row reports the
 * RESOLVED range as `wanted`.
 *
 * @internal
 */
const JoinedUnsatisfiedVerdict = S.Struct({
  ...UnsatisfiedVerdict.fields,
  wanted: S.String.pipe(
    $I.annoteKey("JoinedUnsatisfiedVerdict.wanted", {
      description: "The resolved peer range reported for the joined manifest.",
    })
  ),
}).pipe(
  $I.annoteSchema("JoinedUnsatisfiedVerdict", {
    description: "An unsatisfied peer judgment carrying the joined manifest's resolved range.",
  })
);
const JoinedVerdict = S.Union([JoinedUnsatisfiedVerdict, SatisfiedVerdict, UnjudgedVerdict]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("JoinedVerdict", {
    description: "The peer judgment variants with a resolved wanted range on reportable rows.",
  })
);
type JoinedVerdict = typeof JoinedVerdict.Type;

/**
 * @internal
 */
const SATISFIED: Verdict = { _tag: "satisfied" };

/**
 * A lockfile row's {@link Verdict}, carrying the declared range as `wanted`.
 *
 * @internal
 */
const withWanted: {
  (verdict: Verdict, wanted: string): JoinedVerdict;
  (wanted: string): (verdict: Verdict) => JoinedVerdict;
} = dual(
  2,
  (verdict: Verdict, wanted: string): JoinedVerdict =>
    verdict._tag === "unsatisfied" ? { ...verdict, wanted } : verdict
);

/**
 * Compare a resolved version against a wanted range, both already known not
 * to be protocol specifiers.
 *
 * **Details**
 *
 * Either side failing to parse is `"satisfied"` in the sense of "no row":
 * asserting "unsatisfied" on a comparison that was never performed would be a
 * wrong answer rather than a gap (see {@link PeerCheck.run}).
 *
 * @internal
 */
const compare: {
  (wanted: string, found: string): Verdict;
  (found: string): (wanted: string) => Verdict;
} = dual(2, (wanted: string, found: string): Verdict => {
  const range = Range.parseResult(wanted);
  const version = SemVer.parseResult(found);
  if (Result.isFailure(range) || Result.isFailure(version)) return SATISFIED;
  if (Range.satisfies(version.success, range.success)) return SATISFIED;
  return { _tag: "unsatisfied", found, version: version.success };
});

/**
 * Decide whether one peer DECLARED BY A JOINED MANIFEST is unsatisfied.
 *
 * **Details**
 *
 * Same three judgements as {@link judge}, against a different provider set:
 * the linked parent's own `resolved` map is empty by construction (pnpm
 * records no peer declarations or resolutions for workspace projects), so the
 * provider is whatever the importer's own dependency set gives that name —
 * see {@link providerContext}.
 *
 * A manifest range may be a protocol specifier rather than a range —
 * `catalog:build:peers` in a repo that sources peers from a catalog,
 * `workspace:*` in one that pins peers to its own version. A `catalog:`
 * specifier is resolved through the supplied catalogs (see
 * {@link resolvePeerRange}) and reported by its resolved range, as pnpm does.
 * One that stays unresolvable with a non-workspace provider present is
 * `"unjudged"`: the comparison was never performed, so the report is marked
 * `"peerRangeUnresolved"` rather than calling the peer satisfied. With NO
 * provider the row needs no range, so it is still reported, echoing whatever
 * range could be named.
 *
 * A non-workspace provider whose version is a protocol specifier (a `file:`
 * dependency) is `"unjudged"` the same way, as `"peerVersionUnresolved"`: see
 * {@link judge}. pnpm reads such a provider's real version off disk for a
 * joined parent (`filedep-joined/`), which this check cannot, so it declines
 * rather than guessing. An unresolvable range and version raise both reasons.
 *
 * @internal
 */
const judgeJoined: {
  (
    context: MutableHashMap.MutableHashMap<string, ResolvedPackage>,
    catalogs: CatalogSet | undefined,
    peer: string,
    declared: string,
    optional: boolean
  ): JoinedVerdict;
  (
    catalogs: CatalogSet | undefined,
    peer: string,
    declared: string,
    optional: boolean
  ): (context: MutableHashMap.MutableHashMap<string, ResolvedPackage>) => JoinedVerdict;
} = dual(
  5,
  (
    context: MutableHashMap.MutableHashMap<string, ResolvedPackage>,
    catalogs: CatalogSet | undefined,
    peer: string,
    declared: string,
    optional: boolean
  ): JoinedVerdict => {
    const resolvedRange = resolvePeerRange(catalogs, peer, declared);
    const wanted = resolvedRange ?? declared;
    const provider = O.getOrUndefined(MutableHashMap.get(context, peer));
    if (provider === undefined)
      return optional ? SATISFIED : { _tag: "unsatisfied", found: null, version: null, wanted };
    if (provider.isWorkspace) return SATISFIED;
    const reasons = unjudgedReasons(resolvedRange, provider.version);
    if (resolvedRange === undefined || reasons.length > 0) return { _tag: "unjudged", reasons };
    return withWanted(compare(resolvedRange, provider.version), wanted);
  }
);

/**
 * Why a joined peer with a non-workspace provider cannot be compared: its
 * range, its provider's version, or both are protocol specifiers.
 *
 * @param resolvedRange - The peer's resolved range, when it has one.
 * @param version - The provider's version.
 * @returns The reasons, in a fixed order.
 * @internal
 */
const unjudgedReasons = (resolvedRange: string | undefined, version: string): ReadonlyArray<UnverifiedReason> => [
  ...(resolvedRange === undefined ? (["peerRangeUnresolved"] as const) : []),
  ...(isProtocolSpecifier(version) ? (["peerVersionUnresolved"] as const) : []),
];

interface Policy {
  readonly allowAny: PeerNameMatcher;
  readonly allowed: Readonly<Record<string, string>>;
  readonly ignoreMissing: PeerNameMatcher;
}

/**
 * **Details**
 *
 * A report rather than a bare array, because an empty array is the most
 * dangerous success shape this domain has: it is indistinguishable from "this
 * format cannot be checked". `supported` and `unresolvedImporters` make the
 * difference legible, so a consumer cannot read a limitation as a clean bill
 * of health.
 *
 * Pure and total — construct it with {@link PeerCheck.run}, which never fails.
 *
 * **Example** (Parse a pnpm lockfile and collect required peer failures)
 *
 * ```ts
 * import { Lockfile } from "@beep/lockfiles/Lockfile";
 * import { PeerCheck } from "@beep/repo-workspaces/PeerCheck";
 * import * as Effect from "effect/Effect";
 *
 * const text = "lockfileVersion: '9.0'\nimporters: {}\n"; // pnpm-lock.yaml text
 *
 * const program = Effect.gen(function* () {
 *   const lockfile = yield* Lockfile.parse(text, { format: "pnpm" });
 *   const report = PeerCheck.run(lockfile);
 *   return report.supported ? report.required : [];
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PeerCheck extends S.Class<PeerCheck, { readonly brand: unique symbol }>($I`PeerCheck`)(
  {
    /**
     * Whether the lockfile's format records peer resolution at all.
     *
     * **Details**
     *
     * `false` for yarn: yarn resolves peers **virtually**, giving a
     * peer-bearing package one `@virtual:` locator per consumer, and the
     * lockfile does not record which virtual instance satisfied which peer.
     * The answer is not recoverable, so it is not fabricated — `unsatisfied`
     * is empty and this flag says why.
     */
    supported: S.Boolean.pipe(
      $I.annoteKey("PeerCheck.supported", {
        description: "Whether the lockfile's format records peer resolution at all.",
      })
    ),
    /**
     * Every unsatisfied peer found, optional ones included.
     */
    unsatisfied: S.Array(UnsatisfiedPeer).pipe(
      $I.annoteKey("PeerCheck.unsatisfied", { description: "Every unsatisfied peer found, optional ones included." })
    ),
    /**
     * Importers whose dependencies could not be resolved to instances, so no
     * verdict was reached for them.
     *
     * **Details**
     *
     * In practice this is the **root importer under npm and bun**: neither
     * records a resolved version per importer dependency, and neither emits a
     * package row for the root, so there is nothing to join on. pnpm records a
     * version per importer dependency and is unaffected.
     *
     * Reported rather than silently skipped, for the same reason `supported`
     * exists: a gate that sees no rows is entitled to know whether that means
     * "clean" or "not looked at".
     */
    unresolvedImporters: S.Array(S.String).pipe(
      $I.annoteKey("PeerCheck.unresolvedImporters", {
        description:
          "Importers whose dependencies could not be resolved to instances, so no verdict was reached for them.",
      })
    ),
    /**
     * Why this report is not a complete answer, or empty when it is.
     *
     * **Gotchas**
     *
     * See {@link UnverifiedReason}. A gate must treat a non-empty `unverified`
     * as **not proven clean** rather than as a pass: every reason means some
     * finding may be missing or spurious, and failing closed is the requirement.
     */
    unverified: S.Array(UnverifiedReason).pipe(
      $I.annoteKey("PeerCheck.unverified", {
        description: "Why this report is not a complete answer, or empty when it is.",
      })
    ),
  },
  $I.annote("PeerCheck", { description: "The result of checking a lockfile for unsatisfied peer dependencies." })
) {
  /**
   * The unsatisfied peers a gate should act on — the non-optional ones.
   *
   * **Example** (Read required findings)
   *
   * ```ts
   * import { PeerCheck } from "@beep/repo-workspaces/PeerCheck";
   * const report = PeerCheck.make({ supported: true, unsatisfied: [], unresolvedImporters: [], unverified: [] });
   * console.log(report.required.length) // 0
   * ```
   *
   * @returns The non-optional unsatisfied peers.
   * @category getters
   * @since 0.0.0
   */
  get required(): ReadonlyArray<UnsatisfiedPeer> {
    return A.filter(this.unsatisfied, (row) => !row.optional);
  }

  /**
   * Compute the unsatisfied peer dependencies of a parsed lockfile.
   *
   * **Details**
   *
   * Pure, total and format-free: no IO, no error channel, and no knowledge of
   * which package manager wrote the file. Range satisfaction is
   * `@beep/semver`'s, never hand-rolled.
   *
   * The walk starts at each importer's resolved dependencies and follows
   * `resolved` edges, so a peer declared by a *transitive* dependency is
   * attributed to the importer that pulls it in, with the chain in
   * `parents` — matching how `pnpm peers check` attributes them.
   * Attribution stops at a workspace package: a linked package's own
   * dependencies — registry or linked — are judged by that package's own
   * importer, and a linked package's manifest peers are judged only for the
   * importer that links it DIRECTLY, against that importer's dependencies.
   * pnpm never surfaces them on a consumer one link further out.
   *
   * Four judgements are deliberate:
   *
   * - **A required peer with nothing resolved is reported** (`found: null`),
   *   whether or not the declared range is parseable — a peer with no
   *   provider is a fact about the graph that needs no range arithmetic.
   * - **An ABSENT optional peer is not reported at all**, because that is
   *   what optional means. An optional peer resolved at the *wrong* version
   *   still is, carrying `optional: true`. Both halves match
   *   `pnpm peers check`, whose `missing` section contains only required
   *   peers while its `bad` section carries optional ones.
   * - **An unparseable range or version with something resolved is skipped.**
   *   The check cannot judge it, and asserting "unsatisfied" on a comparison
   *   that was never performed would be a wrong answer rather than a gap.
   *   Two protocol-specifier cases are the exception and fail the report
   *   closed instead: a joined manifest's range, and a provider whose version
   *   is a protocol specifier (both below).
   * - **A workspace-linked provider counts.** Resolution is followed through
   *   whatever the edge names, including a workspace row.
   *
   * Known limits it does not paper over: yarn (see `supported`), the npm and
   * bun root importer (see `unresolvedImporters`), and pnpm recording no peer
   * declarations for workspace projects themselves — under pnpm a workspace
   * package's *own* unsatisfied peers are not in the lockfile at all, and
   * `pnpm peers check` does not report them either. A `link:`-resolved
   * importer dependency is the same blind spot from the other side, and there
   * `pnpm peers check` DOES report the linked parent's peers (it reads the
   * manifest on disk): every `link:` edge whose target the caller did not
   * supply therefore fails the report closed rather than letting the
   * invisible parent pass as checked.
   *
   * Supplying {@link PeerCheckOptions.workspacePackages} closes that gap for
   * every `link:` target the set covers — the root importer's included,
   * whose linked targets the walk seeds itself because the root has no
   * workspace row to reach them through: the claimed manifest's declared
   * peers are walked, judged against the importer's own dependency set
   * (never a sibling importer's), and reported with the manifest's name and
   * version in `parents` — the two facts a workspace row cannot carry, since
   * the lockfile names an importer by directory at the placeholder version
   * `0.0.0`.
   *
   * A joined manifest's peer range may be a protocol specifier rather than a
   * range. A `catalog:` specifier is resolved through
   * {@link PeerCheckOptions.catalogs} and judged and reported by its
   * resolved range, as `pnpm peers check` reports `wantedRange`. One that
   * stays unresolvable — the catalogs key omitted, a catalog naming nothing
   * for the peer, or another protocol such as `workspace:*` — is not judged
   * against a provider that resolved for it, and the report carries
   * `"peerRangeUnresolved"` rather than passing the peer as satisfied. With
   * nothing resolved for it, the row is still reported, since "no provider"
   * needs no range.
   *
   * The provider side has the same hole: a peer that resolved to a `file:`
   * dependency, directly or through a `file:` override, carries the specifier
   * (`file:vendor/react`) where a version belongs, and for a `file:` directory
   * the lockfile records no version anywhere. `pnpm peers check` reports such a
   * peer as a `bad` row with the specifier as its found version, even when the
   * directory's manifest satisfies the range. Such a peer is neither reported
   * nor passed: no row is fabricated, and the report carries
   * `"peerVersionUnresolved"`, for a lockfile row's peer and a joined
   * manifest's peer alike. A workspace-row provider is still accepted without a
   * version check, and a plain unparseable version is still skipped.
   *
   * **Example** (Check a parsed pnpm lockfile)
   *
   * ```ts
   * import { PeerCheck } from "@beep/repo-workspaces/PeerCheck";
   * import { Lockfile } from "@beep/lockfiles/Lockfile";
   * import * as Effect from "effect/Effect";
   * const program = Effect.gen(function* () {
   *   const lockfile = yield* Lockfile.parse("lockfileVersion: '9.0'\nimporters: {}\n", { format: "pnpm" });
   *   return PeerCheck.run(lockfile);
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @param lockfile - a lockfile parsed by `@beep/lockfiles`
   * @param options - the workspace's effective rules, manifests and catalogs; see
   *   {@link PeerCheckOptions}
   * @returns the report; never fails
   * @category utilities
   * @since 0.0.0
   */
  static readonly run: {
    (lockfile: Lockfile, options?: PeerCheckOptions.Input): PeerCheck;
    (options?: PeerCheckOptions.Input): (lockfile: Lockfile) => PeerCheck;
  } = dual(
    (args) => S.is(Lockfile)(args[0]),
    (lockfile: Lockfile, options?: PeerCheckOptions.Input): PeerCheck => {
      const keySupplied = options !== undefined && "peerDependencyRules" in options;
      const unverified: Array<UnverifiedReason> = keySupplied ? [] : ["peerRulesNotApplied"];

      if (!supportsPeerResolution(lockfile.format)) {
        return PeerCheck.make({ supported: false, unsatisfied: [], unresolvedImporters: [], unverified });
      }

      const index = indexInstances(lockfile);
      const manifests = manifestIndexOf(options?.workspacePackages ?? []);
      const scope: RunScope = {
        lockfile,
        index,
        policy: policyOf(options?.peerDependencyRules),
        manifests: manifests.byPath,
        links: scanLinks(lockfile, { byLinkTarget: manifests.byLinkTarget, workspaceByPath: index.workspaceByPath }),
        catalogs: options?.catalogs,
        findings: {
          rows: [],
          unresolved: [],
          unjudged: MutableHashSet.empty<UnverifiedReason>(),
          seen: MutableHashSet.empty<string>(),
        },
      };
      const unjoinedFlagPerImporterBeforeCombining = A.map(lockfile.importers, (importer) =>
        walkImporter(scope, importer)
      );
      const walkedUnjoined = A.some(unjoinedFlagPerImporterBeforeCombining, P.isTruthy);

      return PeerCheck.make({
        supported: true,
        unsatisfied: scope.findings.rows,
        unresolvedImporters: scope.findings.unresolved,
        unverified: [...unverified, ...trailingReasons(scope, scope.links.unjoined || walkedUnjoined)],
      });
    }
  );
}

/**
 * Where every importer's walk records what it found.
 *
 * @internal
 */
interface Findings {
  readonly rows: Array<UnsatisfiedPeerInput>;
  readonly seen: MutableHashSet.MutableHashSet<string>;
  readonly unjudged: MutableHashSet.MutableHashSet<UnverifiedReason>;
  readonly unresolved: Array<string>;
}

/**
 * What one importer's walk shares with the run.
 *
 * @internal
 */
interface WalkScope {
  readonly byId: MutableHashMap.MutableHashMap<string, ResolvedPackage>;
  readonly findings: Findings;
  readonly importerPath: string;
  readonly join: Join;
  readonly judged: MutableHashSet.MutableHashSet<string>;
  readonly policy: Policy;
}

/**
 * The supplied manifests, keyed the way a `link:` target is spelled: a
 * workspace-relative POSIX directory.
 *
 * @internal
 */
interface ManifestIndex {
  readonly byLinkTarget: MutableHashMap.MutableHashMap<string, WorkspacePackage>;
  readonly byPath: MutableHashMap.MutableHashMap<string, WorkspacePackage>;
}

/**
 * Sets `key` unless it is already present: the first manifest to claim a
 * directory keeps it.
 *
 * @param map - The index to fill.
 * @param key - The directory.
 * @param value - The manifest.
 * @internal
 */
const setFirst = <V>(map: MutableHashMap.MutableHashMap<string, V>, key: string, value: V): void => {
  if (!MutableHashMap.has(map, key)) MutableHashMap.set(map, key, value);
};

/**
 * Index the caller's manifests; see {@link ManifestIndex}.
 *
 * @param packages - The caller's manifests.
 * @returns The manifests by package directory and by link target.
 * @internal
 */
const manifestIndexOf = (packages: ReadonlyArray<WorkspacePackage>): ManifestIndex => {
  const byPath = MutableHashMap.empty<string, WorkspacePackage>();
  const byLinkTarget = MutableHashMap.empty<string, WorkspacePackage>();
  for (const pkg of packages) {
    const relativePath = linkTargetPath(".", pkg.relativePath);
    setFirst(byPath, relativePath, pkg);
    for (const target of linkTargetsOf(relativePath, pkg)) setFirst(byLinkTarget, target, pkg);
  }
  return { byPath, byLinkTarget };
};

/**
 * The effective rules as a {@link Policy}.
 *
 * **Details**
 *
 * All three axes are applied, so supplied rules yield a verified report. Each
 * list axis compiles to a name predicate ONCE here rather than per row; both
 * are `() => false` when the axis is empty.
 *
 * @param rules - The effective rules, when supplied.
 * @returns Both list axes compiled to name predicates, beside the allowed ranges.
 * @internal
 */
const policyOf = (rules: PeerDependencyRules.Encoded | undefined): Policy => ({
  allowed: rules?.allowedVersions ?? {},
  ignoreMissing: peerNameMatcher(rules?.ignoreMissing ?? []),
  allowAny: peerNameMatcher(rules?.allowAny ?? []),
});

/**
 * What a `link:` edge's target is looked up in.
 *
 * @internal
 */
interface LinkLookup {
  readonly byLinkTarget: MutableHashMap.MutableHashMap<string, WorkspacePackage>;
  readonly workspaceByPath: MutableHashMap.MutableHashMap<string, ResolvedPackage>;
}

/**
 * The `link:` importer edges, classified ONCE, before the walk.
 *
 * @internal
 */
interface LinkScan {
  readonly byImporter: MutableHashMap.MutableHashMap<string, ReadonlyArray<LinkEdge>>;
  readonly joinable: MutableHashSet.MutableHashSet<string>;
  readonly unjoined: boolean;
}

/**
 * The target a dependency's `link:` version names, when it is one.
 *
 * @param version - An importer dependency's recorded version.
 * @returns The link target, or none.
 * @internal
 */
const linkVersionOf = (version: string | undefined): O.Option<string> =>
  O.map(O.filter(O.fromUndefinedOr(version), Str.startsWith(LINK_PREFIX)), Str.slice(LINK_PREFIX.length));

/**
 * One `link:` edge, resolved against the importer that recorded it.
 *
 * **Details**
 *
 * The row the edge lands on, when the target is an importer at all: `link:`
 * can also point outside the workspace globs, in which case there is nothing
 * to walk, its peers are never judged, and the run keeps the marker. A
 * publish-directory target (`packages/a/dist`) stands for the package
 * directory's row, which is what the lockfile model resolves the same edge to.
 *
 * @param lookup - Where link targets are looked up.
 * @param importerPath - The importer that recorded the edge.
 * @param name - A dependency's package name, matched exactly.
 * @param version - The link target, relative to the importer.
 * @returns The classified edge.
 * @internal
 */
const linkEdgeAt = (lookup: LinkLookup, importerPath: string, name: string, version: string): LinkEdge => {
  const target = linkTargetPath(importerPath, version);
  const pkg = O.getOrUndefined(MutableHashMap.get(lookup.byLinkTarget, target));
  const rowPath = pkg === undefined ? target : linkTargetPath(".", pkg.relativePath);
  return {
    name,
    row: O.getOrUndefined(MutableHashMap.get(lookup.workspaceByPath, rowPath)),
    covered: pkg !== undefined,
  };
};

/**
 * Classify every importer's `link:` edges; see {@link LinkScan}.
 *
 * **Details**
 *
 * A target the caller supplied is joinable (its manifest's peers can be judged
 * for real), and a target they did not supply keeps the report fail-closed.
 * Both halves need the same normalized path resolution — a `link:` version is
 * spelled relative to the importer that recorded it — so they are computed in
 * one pass rather than twice.
 *
 * @param lockfile - The parsed lockfile.
 * @param lookup - Where link targets are looked up.
 * @returns The classified edges.
 * @internal
 */
const scanLinks = (lockfile: Lockfile, lookup: LinkLookup): LinkScan => {
  const perImporter = A.map(lockfile.importers, (importer): readonly [string, ReadonlyArray<LinkEdge>] => [
    importer.path,
    A.getSomes(
      A.map(importer.dependencies, (dep) =>
        O.map(linkVersionOf(dep.version), (target) => linkEdgeAt(lookup, importer.path, dep.name, target))
      )
    ),
  ]);
  const edges = A.flatMap(perImporter, ([, importerEdges]) => importerEdges);
  return {
    byImporter: MutableHashMap.fromIterable(A.filter(perImporter, ([, importerEdges]) => importerEdges.length > 0)),
    joinable: MutableHashSet.fromIterable(
      A.flatMap(edges, (edge) => (edge.covered && edge.row !== undefined ? [edge.row.instanceId] : []))
    ),
    unjoined: A.some(edges, (edge) => !edge.covered),
  };
};

/**
 * Everything the run hands each importer's walk.
 *
 * @internal
 */
interface RunScope {
  readonly catalogs: CatalogSet | undefined;
  readonly findings: Findings;
  readonly index: InstanceIndex;
  readonly links: LinkScan;
  readonly lockfile: Lockfile;
  readonly manifests: MutableHashMap.MutableHashMap<string, WorkspacePackage>;
  readonly policy: Policy;
}

/**
 * Walk one importer, returning whether a `link:` edge it recorded stayed
 * unjudged.
 *
 * **Details**
 *
 * A joinable parent's peers are judged against the IMPORTER's own dependency
 * set, which is where pnpm resolves them from; see {@link providerContext}. A
 * covered edge clears the marker ONLY when the walk actually read the target's
 * manifest peers for THIS importer. Covering the path is not judging it: a
 * target with no lockfile row, or one the walk never reached, is still
 * invisible, and the report says so.
 *
 * @param scope - The run's shared state.
 * @param importer - The importer to walk.
 * @returns `true` when a link edge it recorded stayed unjudged.
 * @internal
 */
const walkImporter = (scope: RunScope, importer: Lockfile["importers"][number]): boolean => {
  const links = O.getOrElse(
    MutableHashMap.get(scope.links.byImporter, importer.path),
    (): ReadonlyArray<LinkEdge> => []
  );
  const roots = withLinkRoots(rootInstances(scope.lockfile, importer.path, scope.index), links, importer.dependencies);
  if (roots === undefined) {
    scope.findings.unresolved.push(importer.path);
    const unwalkedLinkEdgesStayUnjudged = links.length > 0;
    return unwalkedLinkEdgesStayUnjudged;
  }
  const join: Join = {
    manifests: scope.manifests,
    joinable: scope.links.joinable,
    context: providerContext(roots, scope.index.byId, links),
    catalogs: scope.catalogs,
  };
  const judged = MutableHashSet.empty<string>();
  collect(
    {
      importerPath: importer.path,
      byId: scope.index.byId,
      policy: scope.policy,
      join,
      judged,
      findings: scope.findings,
    },
    walksFrom(roots, join)
  );
  return A.some(
    links,
    (edge) => edge.covered && (edge.row === undefined || !MutableHashSet.has(judged, edge.row.instanceId))
  );
};

/**
 * @internal
 */
const UNJUDGED_ORDER: ReadonlyArray<UnverifiedReason> = ["peerRangeUnresolved", "peerVersionUnresolved"];

/**
 * The markers the walk owes the report, in a fixed order.
 *
 * **Details**
 *
 * An edge the lockfile records but the model could not name means some peer
 * may be satisfied by something invisible here — so the report is incomplete,
 * and says so rather than presenting its rows as the answer.
 *
 * A `link:`-resolved importer dependency is the same gap from the other side:
 * pnpm records no peer declarations for workspace projects, so a parent
 * reached through `link:` joins at best to a row whose peers are empty BY
 * DESIGN, and at worst — the root importer — to nothing at all, while
 * `pnpm peers check` reads the linked manifest on disk and reports those
 * peers. Where the caller supplied that manifest AND the walk read it for the
 * importer that recorded the edge, those peers were judged for real and this
 * marker is not owed; where it did not — the key omitted, a target outside the
 * supplied set, or a covered target the walk could not reach — the peers are
 * still invisible, and the report says so rather than presenting its rows as
 * the answer. `version` is populated by pnpm only, so npm and bun never reach
 * the branch and the scan stays format-free.
 *
 * A peer whose range or provider version could not be named was never
 * compared: neither satisfied nor unsatisfied, so the report cannot present
 * its silence as clean. The order is fixed so the array does not depend on
 * which importer the walk met first.
 *
 * @param scope - The run's shared state.
 * @param unjoinedLink - Whether some link edge stayed unjudged.
 * @returns The markers, in a fixed order.
 * @internal
 */
const trailingReasons = (scope: RunScope, unjoinedLink: boolean): ReadonlyArray<UnverifiedReason> => {
  const unresolvedEdge = unjoinedLink || A.some(scope.lockfile.packages, (pkg) => pkg.unresolvedEdges.length > 0);
  return [
    ...(unresolvedEdge ? (["unresolvedEdge"] as const) : []),
    ...A.filter(UNJUDGED_ORDER, (reason) => MutableHashSet.has(scope.findings.unjudged, reason)),
  ];
};

/**
 * An importer's roots as walk nodes with their `parents` chain started.
 *
 * **Details**
 *
 * The importer's own row is the walk's first node with an empty chain — its
 * peers are the importer's own. A dependency instance joined from the importer
 * entry starts the chain with itself, as `pnpm peers check` reports it.
 *
 * @internal
 */
const walksFrom: {
  (roots: ImporterRoots, join: Join): ReadonlyArray<Walk>;
  (join: Join): (roots: ImporterRoots) => ReadonlyArray<Walk>;
} = dual(
  2,
  (roots: ImporterRoots, join: Join): ReadonlyArray<Walk> =>
    roots._tag === "own"
      ? [{ instance: roots.instance, path: [] }]
      : A.map(roots.instances, (instance) => ({ instance, path: [parentLabel(join, instance)] }))
);

/**
 * Walk the resolution graph from an importer's roots, emitting a row for every
 * unsatisfied peer declared anywhere along the way.
 *
 * **Details**
 *
 * Adds to `unjudged` the reason each peer it could not judge was never
 * compared (see {@link judge} and {@link judgeJoined}); the caller surfaces
 * them on `unverified`.
 *
 * @internal
 */
const collect: {
  (scope: WalkScope, roots: ReadonlyArray<Walk>): void;
  (roots: ReadonlyArray<Walk>): (scope: WalkScope) => void;
} = dual(2, (scope: WalkScope, roots: ReadonlyArray<Walk>): void => {
  const visited = MutableHashSet.empty<string>();
  const queue: Array<Walk> = [...roots];

  while (A.isArrayNonEmpty(queue)) {
    const current = queue[0];
    queue.shift();
    if (MutableHashSet.has(visited, current.instance.instanceId)) continue;
    MutableHashSet.add(visited, current.instance.instanceId);
    const declaration = declarationOf(scope, current);
    for (const [peer, wanted] of R.toEntries(declaration.declared)) {
      judgePeer(scope, current, declaration, peer, wanted);
    }
    queue.push(...nextWalks(scope, current, visited));
  }
});

/**
 * The peers one walk node declares, and how each is judged.
 *
 * **Details**
 *
 * A parent the walk reached through a covered `link:` edge contributes its
 * MANIFEST's peers, which is the whole point of supplying the manifests: the
 * lockfile records none for a workspace project. The importer's own node (an
 * empty chain) is never joined — pnpm reports a linked package's unsatisfied
 * peers through a consumer, not on itself.
 *
 * @internal
 */
interface Declaration {
  readonly declared: Readonly<Record<string, string>>;
  readonly declaring: string;
  readonly isOptional: (peer: string) => boolean;
  readonly verdictOf: (peer: string, wanted: string, optional: boolean) => JoinedVerdict;
}

/**
 * The {@link Declaration} for `current`, from its joined manifest when it has
 * one and from its lockfile row otherwise.
 *
 * **Details**
 *
 * A joined node is recorded on the scope's `judged` set, so the run can tell a
 * covered edge that was JUDGED from one that was merely covered; see
 * {@link PeerCheck.run}.
 *
 * @internal
 */
const declarationOf: {
  (scope: WalkScope, current: Walk): Declaration;
  (current: Walk): (scope: WalkScope) => Declaration;
} = dual(2, (scope: WalkScope, current: Walk): Declaration => {
  const instance = current.instance;
  const linked = current.path.length === 0 ? undefined : joinedManifest(scope.join, instance);
  if (linked === undefined) {
    return {
      declared: instance.peerDependencies,
      declaring: instance.name,
      isOptional: (peer) => instance.peerDependenciesMeta[peer]?.optional === true,
      verdictOf: (peer, wanted, optional) => withWanted(judge(instance, peer, wanted, optional, scope.byId), wanted),
    };
  }
  MutableHashSet.add(scope.judged, instance.instanceId);
  const optionalNames = optionalPeers(linked);
  return {
    declared: linked.peerDependencies,
    declaring: linked.name,
    isOptional: (peer) => MutableHashSet.has(optionalNames, peer),
    verdictOf: (peer, wanted, optional) => judgeJoined(scope.join.context, scope.join.catalogs, peer, wanted, optional),
  };
});

/**
 * Judge one declared peer and record what it found on the scope.
 *
 * **Details**
 *
 * pnpm computes the same violation and then SUPPRESSES it when a rule permits
 * the version that resolved. Replicating that is the whole point: without it
 * we report findings pnpm calls clean.
 *
 * One row per (importer, peer, declaring INSTANCE) — which is what pnpm
 * reports. Measured on `peers/diamond`, where one importer reaches
 * `use-sync-external-store@1.2.2` through both react-redux and zustand:
 * `pnpm peers check --json` emits that package's unsatisfied `react` once,
 * carrying the chain it reached first, and says nothing about the other. So a
 * second chain is not a second fact, and the walk judges each instance once
 * per importer for the same reason.
 *
 * The `seen` set is a guard rather than a live filter under the current walk
 * — the per-importer `visited` set already admits each instance once, and
 * deleting the guard changes no test. It earns its place by holding the
 * invariant at the point the row is emitted: swap the walk for a per-chain one
 * and this is what still collapses the diamond, which is mutation-checked in
 * both directions.
 *
 * @param scope - The walk's shared state.
 * @param current - The node declaring the peer.
 * @param declaration - The node's declared peers.
 * @param peer - The peer the row is about.
 * @param wanted - The declared range.
 * @internal
 */
const judgePeer = (scope: WalkScope, current: Walk, declaration: Declaration, peer: string, wanted: string): void => {
  if (peer === "") return;
  const { findings } = scope;
  const optional = declaration.isOptional(peer);
  const verdict = declaration.verdictOf(peer, wanted, optional);
  if (verdict._tag === "unjudged")
    A.forEach(verdict.reasons, (reason) => MutableHashSet.add(findings.unjudged, reason));
  if (verdict._tag !== "unsatisfied") return;
  if (suppressedByRule(scope.policy, declaration.declaring, peer, verdict.version)) return;
  const key = `${scope.importerPath}\u0000${peer}\u0000${current.instance.instanceId}`;
  if (MutableHashSet.has(findings.seen, key)) return;
  MutableHashSet.add(findings.seen, key);
  findings.rows.push({
    importer: scope.importerPath,
    dependency: peer,
    wanted: verdict.wanted,
    found: verdict.found,
    optional,
    parents: current.path,
  });
};

/**
 * The unvisited nodes `current` leads to, each with its chain extended.
 *
 * **Details**
 *
 * Attribution STOPS at a workspace package the walk reached from the importer.
 * Its dependencies — linked workspace packages and registry packages alike —
 * are that package's own importer's business, and are judged by that
 * importer's walk. Measured against pnpm 12.6.0: with `b` linking `a` and `a`
 * linking `c`, `c`'s unmet peer is reported on `a` only, whoever provides it
 * (the `linkchain-*` probes), and a registry dependency of a linked package reports its
 * peers on that package's importer, never on the consumer
 * (`linkchain-registry/`). Walking on would judge a deeper package's peers
 * against the wrong importer's dependencies.
 *
 * @param scope - The walk's shared state.
 * @param current - The node just judged.
 * @param visited - The nodes already admitted.
 * @returns The next nodes, in edge order.
 * @internal
 */
const nextWalks = (
  scope: WalkScope,
  current: Walk,
  visited: MutableHashSet.MutableHashSet<string>
): ReadonlyArray<Walk> => {
  if (current.path.length > 0 && current.instance.isWorkspace) return [];
  const unvisited = A.filter(R.values(current.instance.resolved), (targetId) => !MutableHashSet.has(visited, targetId));
  return A.getSomes(
    A.map(unvisited, (targetId) =>
      O.map(MutableHashMap.get(scope.byId, targetId), (next) => ({
        instance: next,
        path: [...current.path, parentLabel(scope.join, next)],
      }))
    )
  );
};

/**
 * The parent name a `peerDependencyRules.allowedVersions` key names, with the
 * parent's version stripped.
 *
 * **Details**
 *
 * **pnpm ignores the parent version in a rule key**, so
 * `"react-dom@18.0.0>react"` suppresses a `react-dom@18.3.1` instance too.
 * Replicating that is not optional: matching on the version would suppress a
 * strictly smaller set than pnpm does, and every row in the difference is a
 * false positive. Measured against pnpm 11.22.0, one axis at a time: a rule
 * keyed at a version the installed parent does not have still suppresses, and
 * so does one keyed at a wildly different version, while a rule keyed on an
 * ANCESTOR of the declaring package suppresses nothing. The parent is the
 * declarer, matched by name.
 *
 * Both spellings occur in the wild and both must work — parent-versioned, as
 * `pnpm:export` materializes into `pnpm-workspace.yaml`, and unversioned, as a
 * config-dependency plugin injects. A scoped name keeps its leading `@`, so the
 * version separator is the LAST `@`, and only when it is not the first
 * character.
 *
 * A key naming no parent at all (`"react"`, with no `>`) never reaches this
 * function: {@link suppressedByRule} matches it against every parent, which is
 * what pnpm does with it.
 *
 * @param parent - The parent half of a rule key.
 * @returns The text before the parent's version separator, or all of it when unversioned.
 * @internal
 */
const ruleParentName = (parent: string): string =>
  O.match(
    O.filter(Str.lastIndexOf("@")(parent), (at) => at > 0),
    { onNone: () => parent, onSome: (at) => Str.slice(0, at)(parent) }
  );

const ruleKeyApplies = (key: string, parentName: string, peer: string): boolean =>
  O.match(Str.indexOf(">")(key), {
    onNone: () => key === peer,
    onSome: (separator) =>
      separator > 0 &&
      Str.slice(separator + 1)(key) === peer &&
      ruleParentName(Str.slice(0, separator)(key)) === parentName,
  });

const rangeCovers = (permitted: string, version: SemVer): boolean =>
  Result.match(Range.parseResult(permitted), {
    onFailure: () => false,
    onSuccess: (range) => Range.satisfies(version, range),
  });

/**
 * Whether the effective rules suppress this row, the way pnpm would.
 *
 * **Details**
 *
 * The three axes partition on `found`, and the partition is the measured
 * no-cross rule (pnpm 12.5.1, `__test__/fixtures/peers/allowany/` and
 * `ignoremissing/`):
 *
 * - **Nothing resolved** (`found === null`): only `ignoreMissing` can hide the
 *   row, by matching the peer name. `allowedVersions` cannot — with no version
 *   there is nothing for a range to permit, and pnpm's `missing` section is not
 *   suppressed by it either — and neither can `allowAny`
 *   (`ignoremissing/peers-check-allowany-react.json` keeps all three rows).
 * - **Something resolved outside the range**: `allowAny` hides it by name, and
 *   `allowedVersions` hides it when a matching key's range covers the found
 *   version. `ignoreMissing` never does
 *   (`allowany/peers-check-ignoremissing-react-redux.json` keeps both rows).
 *
 * @internal
 */
const suppressedByRule: {
  (policy: Policy, parentName: string, peer: string, version: SemVer | null): boolean;
  (parentName: string, peer: string, version: SemVer | null): (policy: Policy) => boolean;
} = dual(4, (policy: Policy, parentName: string, peer: string, version: SemVer | null): boolean => {
  if (version === null) return policy.ignoreMissing(peer);
  if (policy.allowAny(peer)) return true;
  return A.some(
    R.toEntries(policy.allowed),
    ([key, permitted]) => ruleKeyApplies(key, parentName, peer) && rangeCovers(permitted, version)
  );
});

/**
 * Decide whether one declared peer is unsatisfied.
 *
 * **Details**
 *
 * Returns `"satisfied"` for "satisfied, or not judgeable and skipped" — the
 * two cases that produce no row and no marker. They are deliberately merged
 * here and separated in the TSDoc on {@link PeerCheck.run}. A provider whose
 * version is a protocol specifier is the one unjudgeable case that is NOT
 * skipped: it is `"unjudged"`, and the report carries
 * `"peerVersionUnresolved"`.
 *
 * @internal
 */
const judge: {
  (
    instance: ResolvedPackage,
    peer: string,
    wanted: string,
    optional: boolean,
    byId: MutableHashMap.MutableHashMap<string, ResolvedPackage>
  ): Verdict;
  (
    peer: string,
    wanted: string,
    optional: boolean,
    byId: MutableHashMap.MutableHashMap<string, ResolvedPackage>
  ): (instance: ResolvedPackage) => Verdict;
} = dual(
  5,
  (
    instance: ResolvedPackage,
    peer: string,
    wanted: string,
    optional: boolean,
    byId: MutableHashMap.MutableHashMap<string, ResolvedPackage>
  ): Verdict => {
    const providerId = instance.resolved[peer];
    const provider = providerId === undefined ? undefined : O.getOrUndefined(MutableHashMap.get(byId, providerId));
    if (provider === undefined) {
      if (optional) return SATISFIED;
      if (instance.unresolvedEdges.includes(peer)) return SATISFIED;
      return { _tag: "unsatisfied", found: null, version: null };
    }

    if (provider.isWorkspace) return SATISFIED;

    if (isProtocolSpecifier(provider.version)) return { _tag: "unjudged", reasons: ["peerVersionUnresolved"] };

    return compare(wanted, provider.version);
  }
);
