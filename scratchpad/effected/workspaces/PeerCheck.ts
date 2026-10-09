// Unsatisfied peer-dependency detection over a parsed lockfile — a pure
// VALUE, not a service. No IO, nothing in `R`, no error channel.
//
// The computation is FORMAT-FREE. `@effected/lockfiles` normalizes every
// manager's lockfile into package *instances* carrying `instanceId`,
// `peerDependencies`, `peerDependenciesMeta` and `resolved` (name → the
// instanceId that name actually resolved to), so this module never learns
// which manager wrote the file. That is the whole point of the model work
// behind it: shelling out to each package manager's own peer command cannot
// deliver bun (which reports nothing on a no-op install and never records the
// wanted range), so the answer has to come from the graph.
//
// `instanceId` is OPAQUE here — looked up, never parsed. Splitting one on "@"
// or "(" would re-introduce the format knowledge this module exists without.

import type { Lockfile, ResolvedPackage } from "../lockfiles/index.ts";
import { Range, SemVer } from "../semver/index.ts";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { PeerDependencyRules } from "./ConfigDependencyHooks.ts";
import type { PeerNameMatcher } from "./internal/peerPatterns.ts";
import { peerNameMatcher } from "./internal/peerPatterns.ts";
import type { ImporterRoots } from "./internal/roots.ts";
import { indexInstances, rootInstances } from "./internal/roots.ts";
import type { CatalogSet } from "./WorkspaceCatalogs.ts";
import type { WorkspacePackage } from "./WorkspacePackage.ts";

/**
 * Why a report is not a complete answer.
 *
 * @remarks
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
 * @public
 */
export type UnverifiedReason =
	| "peerRulesNotApplied"
	| "unresolvedEdge"
	| "peerRangeUnresolved"
	| "peerVersionUnresolved";

/**
 * Options for {@link PeerCheck.run}.
 *
 * @remarks
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
 * @public
 */
export interface PeerCheckOptions {
	/** The workspace's effective rules, from `WorkspaceCatalogs.peerDependencyRules()`. */
	readonly peerDependencyRules?: PeerDependencyRules;
	/**
	 * The workspace's discovered packages, from `WorkspaceDiscovery` — the
	 * manifests a `link:`-resolved parent's peers have to be read from,
	 * because the lockfile does not record them.
	 *
	 * @remarks
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
	readonly workspacePackages?: ReadonlyArray<WorkspacePackage>;
	/**
	 * The workspace's catalogs, from `WorkspaceCatalogs.set()` — which already
	 * includes any catalogs a config-dependency hook injects.
	 *
	 * @remarks
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
	readonly catalogs?: CatalogSet;
}

/**
 * One link in the chain from an importer to the package that declared an
 * unsatisfied peer.
 *
 * @remarks
 * Mirrors the shape `pnpm peers check --json` reports, so the two can be
 * compared directly.
 *
 * @public
 */
export class PeerParent extends S.Class<PeerParent>("PeerParent")({
	/** The package name. */
	name: S.NonEmptyString,
	/** The resolved version of that package. */
	version: S.String,
}) {}

/**
 * One peer dependency that is declared but not satisfied.
 *
 * @remarks
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
 * @public
 */
export class UnsatisfiedPeer extends S.Class<UnsatisfiedPeer>("UnsatisfiedPeer")({
	/** The importer path the problem belongs to (`"."` for the root). */
	importer: S.NonEmptyString,
	/** The peer dependency's name. */
	dependency: S.NonEmptyString,
	/** The range the declaring package asked for. */
	wanted: S.String,
	/** The version that resolved, or `null` when nothing resolved. */
	found: S.NullOr(S.String),
	/** Whether the declaring package marked the peer optional. */
	optional: S.Boolean,
	/** The path from the importer to the declaring package. */
	parents: S.Array(PeerParent),
}) {}

/**
 * The formats whose lockfiles record peer resolution.
 *
 * An allowlist rather than a `!== "yarn"` denylist, so a format added to
 * `Lockfile["format"]` is unsupported until someone says otherwise. A denylist
 * would report the new format `supported: true` with an empty `unsatisfied`
 * before any parser records peer resolution for it — a clean bill of health
 * produced by a limitation, which is the failure this module exists to avoid.
 *
 * @internal
 */
const PEER_RESOLVING_FORMATS: ReadonlySet<Lockfile["format"]> = new Set(["npm", "pnpm", "bun"]);

/** @internal */
const supportsPeerResolution = (format: Lockfile["format"]): boolean => PEER_RESOLVING_FORMATS.has(format);

/**
 * The protocol pnpm records a workspace-directory resolution under, passed
 * through verbatim on `ImporterDependency.version` by `@effected/lockfiles`.
 *
 * @internal
 */
const LINK_PREFIX = "link:";

interface Walk {
	readonly instance: ResolvedPackage;
	readonly path: ReadonlyArray<PeerParent>;
}

/**
 * The workspace-relative directory a `link:` version names, resolved against
 * the importer that recorded it.
 *
 * @remarks
 * `link:../a` in `packages/b` is `packages/a`. Deliberately pure string
 * arithmetic rather than `node:path`: `link:` targets are spelled POSIX in a
 * lockfile, and a Windows host would otherwise translate them to backslashes
 * and stop matching the importer paths the same file uses.
 *
 * @internal
 */
const linkTargetPath = (importerPath: string, target: string): string => {
	const segments = importerPath === "." ? [] : importerPath.split("/");
	const resolved: Array<string> = [];
	for (const segment of [...segments, ...target.split("/")]) {
		if (segment === "" || segment === ".") continue;
		if (segment === "..") {
			resolved.pop();
			continue;
		}
		resolved.push(segment);
	}
	return resolved.length === 0 ? "." : resolved.join("/");
};

/**
 * One `link:`-resolved importer dependency, classified before the walk.
 *
 * @internal
 */
interface LinkEdge {
	/** The name the importer depends on the target under. */
	readonly name: string;
	/** The workspace row the target directory stands for, when the lockfile records one. */
	readonly row: ResolvedPackage | undefined;
	/** Whether the caller supplied a manifest for the target directory. */
	readonly covered: boolean;
}

/**
 * An importer's walk roots with its `link:` targets seeded in.
 *
 * @remarks
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
const withLinkRoots = (
	roots: ImporterRoots | undefined,
	links: ReadonlyArray<LinkEdge>,
	dependencies: ReadonlyArray<{ readonly version?: string | undefined }>,
): ImporterRoots | undefined => {
	const rows = links.flatMap((link) => (link.row === undefined ? [] : [link.row]));
	if (roots?._tag === "own" || rows.length === 0) return roots;
	if (roots === undefined) {
		const versioned = dependencies.filter((dep) => dep.version !== undefined).length;
		if (versioned !== rows.length) return undefined;
		return { _tag: "dependencies", instances: rows };
	}
	return { _tag: "dependencies", instances: [...roots.instances, ...rows] };
};

/**
 * The workspace-relative directories a `link:` to `pkg` can name.
 *
 * @remarks
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
const linkTargetsOf = (relativePath: string, pkg: WorkspacePackage): ReadonlyArray<string> => {
	const directory = pkg.publishConfig?.directory;
	if (directory === undefined || pkg.publishConfig?.linkDirectory === false) return [relativePath];
	const published = linkTargetPath(relativePath, directory);
	return published === relativePath ? [relativePath] : [relativePath, published];
};

/**
 * The caller-supplied manifests, the `link:` targets they cover, and the
 * dependency set a joined parent's peers resolve from.
 *
 * @internal
 */
interface Join {
	/** Supplied manifests by `relativePath` — the spelling a `link:` target uses. */
	readonly manifests: ReadonlyMap<string, WorkspacePackage>;
	/** Instance ids of the rows a COVERED `link:` edge lands on: the nodes whose peers are joined. */
	readonly joinable: ReadonlySet<string>;
	/** The importer's own dependency instances, by name. */
	readonly context: ReadonlyMap<string, ResolvedPackage>;
	/** The caller's catalogs, which a joined `catalog:` peer range resolves through. */
	readonly catalogs: CatalogSet | undefined;
}

/**
 * The dependency instances a joined parent's peers resolve against.
 *
 * @remarks
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
const providerContext = (
	roots: ImporterRoots,
	byId: ReadonlyMap<string, ResolvedPackage>,
	links: ReadonlyArray<LinkEdge>,
): ReadonlyMap<string, ResolvedPackage> => {
	const context = new Map<string, ResolvedPackage>();
	if (roots._tag === "dependencies") {
		for (const instance of roots.instances) context.set(instance.name, instance);
		// A workspace row is named by its DIRECTORY, so a linked provider is
		// keyed by the name the importer depends on it under, which is the
		// name a peer asks for.
		for (const link of links) if (link.row !== undefined) context.set(link.name, link.row);
		return context;
	}
	for (const [name, instanceId] of Object.entries(roots.instance.resolved)) {
		const provider = byId.get(instanceId);
		if (provider !== undefined) context.set(name, provider);
	}
	return context;
};

/**
 * The supplied manifest for a node the walk reached through a covered `link:`
 * edge, or `undefined` for every other node.
 *
 * @remarks
 * The importer's OWN node is deliberately excluded — {@link collect} only
 * consults this for nodes with a non-empty chain. pnpm reports nothing for a
 * linked package's own unsatisfied peers (it reports them through a consumer),
 * so joining them onto the importer's own chain would emit rows the oracle
 * does not have.
 *
 * @internal
 */
const joinedManifest = (join: Join, instance: ResolvedPackage): WorkspacePackage | undefined => {
	if (instance.relativePath === undefined || !join.joinable.has(instance.instanceId)) return undefined;
	return join.manifests.get(instance.relativePath);
};

/**
 * The peers a joined manifest marks optional.
 *
 * @remarks
 * Read from the raw manifest record rather than from a typed model, because
 * `WorkspacePackage` carries `peerDependenciesMeta` as it was written, exactly
 * as the lockfile model carries its own. A malformed block yields no optional
 * peers, which is the stricter answer: an unsatisfied peer is reported rather
 * than silently excused.
 *
 * @internal
 */
const optionalPeers = (manifest: WorkspacePackage): ReadonlySet<string> => {
	const optional = new Set<string>();
	const meta: unknown = manifest.manifestRecord.peerDependenciesMeta;
	if (typeof meta !== "object" || meta === null) return optional;
	for (const [name, entry] of Object.entries(meta as Record<string, unknown>)) {
		if (typeof entry === "object" && entry !== null && (entry as { optional?: unknown }).optional === true) {
			optional.add(name);
		}
	}
	return optional;
};

/**
 * The chain element a node contributes, named from the supplied manifest when
 * the node is a joined link target.
 *
 * @remarks
 * The lockfile names a workspace row by its DIRECTORY (`packages/a`) at the
 * placeholder version `0.0.0`, because pnpm records neither for an importer;
 * `pnpm peers check` reports the real `probe-a@1.0.0` it read from the
 * manifest, and the supplied manifest is the only place those two facts exist.
 *
 * @internal
 */
const parentLabel = (join: Join, instance: ResolvedPackage): PeerParent => {
	const manifest = joinedManifest(join, instance);
	return PeerParent.make({
		name: manifest?.name ?? instance.name,
		version: manifest?.version ?? instance.version,
	});
};

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
 * @remarks
 * The one test both halves of a comparison use: a range that is one yields
 * `"peerRangeUnresolved"`, a provider version that is one (`file:vendor/x`,
 * which `@effected/lockfiles` passes through for a `file:` provider) yields
 * `"peerVersionUnresolved"`.
 *
 * @internal
 */
const isProtocolSpecifier = (value: string): boolean => PROTOCOL_SPECIFIER.test(value);

/** @internal */
const CATALOG_PREFIX = "catalog:";

/**
 * The range a joined manifest's declared peer specifier stands for, or
 * `undefined` when it is a protocol specifier that cannot be resolved.
 *
 * @remarks
 * A `catalog:` specifier resolves through the caller's catalogs; an omitted
 * set resolves nothing, since nothing was looked up. A resolution that is
 * itself a protocol specifier is no more a range than the input was. A plain
 * range passes through untouched, parseable or not — an unparseable
 * non-protocol range is declined as {@link judge} declines one.
 *
 * @internal
 */
const resolvePeerRange = (catalogs: CatalogSet | undefined, peer: string, wanted: string): string | undefined => {
	let range = wanted;
	if (wanted.startsWith(CATALOG_PREFIX)) {
		const resolved = catalogs === undefined ? O.none() : catalogs.resolveSpecifier(peer, wanted);
		if (O.isNone(resolved)) return undefined;
		range = resolved.value;
	}
	return isProtocolSpecifier(range) ? undefined : range;
};

/**
 * What {@link judge} or {@link judgeJoined} concluded: a row to report,
 * nothing to report, or a peer it could not judge — with the reasons the
 * comparison was never performed, which the report surfaces on `unverified`.
 *
 * @internal
 */
type Verdict =
	| { readonly _tag: "unsatisfied"; readonly found: string | null }
	| { readonly _tag: "satisfied" }
	| { readonly _tag: "unjudged"; readonly reasons: ReadonlyArray<UnverifiedReason> };

/**
 * A {@link Verdict} for a joined manifest's peer, whose row reports the
 * RESOLVED range as `wanted`.
 *
 * @internal
 */
type JoinedVerdict =
	| { readonly _tag: "unsatisfied"; readonly found: string | null; readonly wanted: string }
	| Exclude<Verdict, { readonly _tag: "unsatisfied" }>;

/** @internal */
const SATISFIED: Verdict = { _tag: "satisfied" };

/**
 * A lockfile row's {@link Verdict}, carrying the declared range as `wanted`.
 *
 * @internal
 */
const withWanted = (verdict: Verdict, wanted: string): JoinedVerdict =>
	verdict._tag === "unsatisfied" ? { ...verdict, wanted } : verdict;

/**
 * Compare a resolved version against a wanted range, both already known not
 * to be protocol specifiers.
 *
 * @remarks
 * Either side failing to parse is `"satisfied"` in the sense of "no row":
 * asserting "unsatisfied" on a comparison that was never performed would be a
 * wrong answer rather than a gap (see {@link PeerCheck.run}).
 *
 * @internal
 */
const compare = (wanted: string, found: string): Verdict => {
	const range = Range.parseResult(wanted);
	const version = SemVer.parseResult(found);
	if (Result.isFailure(range) || Result.isFailure(version)) return SATISFIED;
	if (Range.satisfies(version.success, range.success)) return SATISFIED;
	return { _tag: "unsatisfied", found };
};

/**
 * Decide whether one peer DECLARED BY A JOINED MANIFEST is unsatisfied.
 *
 * @remarks
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
const judgeJoined = (
	context: ReadonlyMap<string, ResolvedPackage>,
	catalogs: CatalogSet | undefined,
	peer: string,
	declared: string,
	optional: boolean,
): JoinedVerdict => {
	const resolvedRange = resolvePeerRange(catalogs, peer, declared);
	const wanted = resolvedRange ?? declared;
	const provider = context.get(peer);
	if (provider === undefined) {
		if (optional) return SATISFIED;
		return { _tag: "unsatisfied", found: null, wanted };
	}
	// A workspace row carries the placeholder version `0.0.0`, so accepting it
	// on name alone is the same decline {@link judge} makes: an edge exists and
	// a provider exists, and nothing indicates dissatisfaction.
	if (provider.isWorkspace) return SATISFIED;
	const reasons: Array<UnverifiedReason> = [];
	if (resolvedRange === undefined) reasons.push("peerRangeUnresolved");
	if (isProtocolSpecifier(provider.version)) reasons.push("peerVersionUnresolved");
	if (resolvedRange === undefined || reasons.length > 0) return { _tag: "unjudged", reasons };
	return withWanted(compare(resolvedRange, provider.version), wanted);
};

/** The effective suppression policy, with both list axes compiled to predicates. */
interface Policy {
	readonly allowed: Readonly<Record<string, string>>;
	readonly ignoreMissing: PeerNameMatcher;
	readonly allowAny: PeerNameMatcher;
}

/**
 * The result of checking a lockfile for unsatisfied peer dependencies.
 *
 * @remarks
 * A report rather than a bare array, because an empty array is the most
 * dangerous success shape this domain has: it is indistinguishable from "this
 * format cannot be checked". `supported` and `unresolvedImporters` make the
 * difference legible, so a consumer cannot read a limitation as a clean bill
 * of health.
 *
 * Pure and total — construct it with {@link PeerCheck.run}, which never fails.
 *
 * @example
 * ```ts
 * import { Lockfile } from "../lockfiles/index.ts";
 * import { PeerCheck } from "./index.ts";
 * import { Effect } from "effect";
 *
 * declare const text: string; // the text of a pnpm-lock.yaml
 *
 * const program = Effect.gen(function* () {
 *   const lockfile = yield* Lockfile.parse(text, { format: "pnpm" });
 *   const report = PeerCheck.run(lockfile);
 *   return report.supported ? report.required : [];
 * });
 * ```
 *
 * @public
 */
export class PeerCheck extends S.Class<PeerCheck>("PeerCheck")({
	/**
	 * Whether the lockfile's format records peer resolution at all.
	 *
	 * `false` for yarn: yarn resolves peers **virtually**, giving a
	 * peer-bearing package one `@virtual:` locator per consumer, and the
	 * lockfile does not record which virtual instance satisfied which peer.
	 * The answer is not recoverable, so it is not fabricated — `unsatisfied`
	 * is empty and this flag says why.
	 */
	supported: S.Boolean,
	/** Every unsatisfied peer found, optional ones included. */
	unsatisfied: S.Array(UnsatisfiedPeer),
	/**
	 * Importers whose dependencies could not be resolved to instances, so no
	 * verdict was reached for them.
	 *
	 * @remarks
	 * In practice this is the **root importer under npm and bun**: neither
	 * records a resolved version per importer dependency, and neither emits a
	 * package row for the root, so there is nothing to join on. pnpm records a
	 * version per importer dependency and is unaffected.
	 *
	 * Reported rather than silently skipped, for the same reason `supported`
	 * exists: a gate that sees no rows is entitled to know whether that means
	 * "clean" or "not looked at".
	 */
	unresolvedImporters: S.Array(S.String),
	/**
	 * Why this report is not a complete answer, or empty when it is.
	 *
	 * @remarks
	 * See {@link UnverifiedReason}. A gate must treat a non-empty `unverified`
	 * as **not proven clean** rather than as a pass: every reason means some
	 * finding may be missing or spurious, and failing closed is the requirement.
	 */
	unverified: S.Array(
		S.Literals(["peerRulesNotApplied", "unresolvedEdge", "peerRangeUnresolved", "peerVersionUnresolved"]),
	),
}) {
	/** The unsatisfied peers a gate should act on — the non-optional ones. */
	get required(): ReadonlyArray<UnsatisfiedPeer> {
		return this.unsatisfied.filter((row) => !row.optional);
	}

	/**
	 * Compute the unsatisfied peer dependencies of a parsed lockfile.
	 *
	 * @remarks
	 * Pure, total and format-free: no IO, no error channel, and no knowledge of
	 * which package manager wrote the file. Range satisfaction is
	 * `@effected/semver`'s, never hand-rolled.
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
	 * @param lockfile - a lockfile parsed by `@effected/lockfiles`
	 * @param options - the workspace's effective rules, manifests and catalogs; see
	 *   {@link PeerCheckOptions}
	 * @returns the report; never fails
	 */
	static run(lockfile: Lockfile, options?: PeerCheckOptions): PeerCheck {
		// PRESENCE of the key is the assertion, not its contents: supplying
		// `NoPeerDependencyRules` asserts the workspace has none, while omitting
		// the option says nothing was looked up. Collapsing the two would tell a
		// gate that an unchecked workspace is clean.
		const keySupplied = options !== undefined && "peerDependencyRules" in options;
		const rules = options?.peerDependencyRules;
		// All three axes are applied, so supplied rules yield a verified report.
		// Each list axis compiles to a name predicate ONCE here rather than per
		// row; both are `() => false` when the axis is empty.
		const policy: Policy = {
			allowed: rules?.allowedVersions ?? {},
			ignoreMissing: peerNameMatcher(rules?.ignoreMissing ?? []),
			allowAny: peerNameMatcher(rules?.allowAny ?? []),
		};
		const unverified: Array<UnverifiedReason> = keySupplied ? [] : ["peerRulesNotApplied"];

		if (!supportsPeerResolution(lockfile.format)) {
			return PeerCheck.make({ supported: false, unsatisfied: [], unresolvedImporters: [], unverified });
		}

		const index = indexInstances(lockfile);
		const { byId } = index;

		// The caller's manifests, keyed the way a `link:` target is spelled: a
		// workspace-relative POSIX directory. Empty when the key is omitted,
		// which is what keeps every `link:` edge on the fail-closed branch.
		const manifests = new Map<string, WorkspacePackage>();
		// The same manifests keyed by every directory a `link:` to them can
		// name: the package directory, and its publish directory when pnpm
		// links into it (see {@link linkTargetsOf}).
		const byLinkTarget = new Map<string, WorkspacePackage>();
		for (const pkg of options?.workspacePackages ?? []) {
			const relativePath = linkTargetPath(".", pkg.relativePath);
			if (!manifests.has(relativePath)) manifests.set(relativePath, pkg);
			for (const target of linkTargetsOf(relativePath, pkg)) {
				if (!byLinkTarget.has(target)) byLinkTarget.set(target, pkg);
			}
		}

		// The `link:` importer edges, classified ONCE, before the walk: a target
		// the caller supplied is joinable (its manifest's peers can be judged
		// for real), and a target they did not supply keeps the report
		// fail-closed. Both halves need the same normalized path resolution —
		// a `link:` version is spelled relative to the importer that recorded
		// it — so they are computed in one pass rather than twice.
		const joinable = new Set<string>();
		const linksByImporter = new Map<string, ReadonlyArray<LinkEdge>>();
		let unjoinedLink = false;
		for (const importer of lockfile.importers) {
			const edges: Array<LinkEdge> = [];
			for (const dep of importer.dependencies) {
				const version = dep.version;
				if (version?.startsWith(LINK_PREFIX) !== true) continue;
				const target = linkTargetPath(importer.path, version.slice(LINK_PREFIX.length));
				// The row the edge lands on, when the target is an importer at
				// all: `link:` can also point outside the workspace globs, in
				// which case there is nothing to walk, its peers are never
				// judged, and the post-walk check below keeps the marker.
				// A publish-directory target (`packages/a/dist`) stands for the
				// package directory's row, which is what the lockfile model
				// resolves the same edge to.
				const pkg = byLinkTarget.get(target);
				const row = index.workspaceByPath.get(pkg === undefined ? target : linkTargetPath(".", pkg.relativePath));
				const covered = pkg !== undefined;
				if (!covered) unjoinedLink = true;
				if (covered && row !== undefined) joinable.add(row.instanceId);
				edges.push({ name: dep.name, row, covered });
			}
			if (edges.length > 0) linksByImporter.set(importer.path, edges);
		}

		const rows: Array<UnsatisfiedPeer> = [];
		const unresolved: Array<string> = [];
		const unjudged = new Set<UnverifiedReason>();
		const seen = new Set<string>();

		for (const importer of lockfile.importers) {
			const links = linksByImporter.get(importer.path) ?? [];
			const roots = withLinkRoots(rootInstances(lockfile, importer.path, index), links, importer.dependencies);
			if (roots === undefined) {
				unresolved.push(importer.path);
				// Nothing was walked, so no covered edge here was judged.
				if (links.length > 0) unjoinedLink = true;
				continue;
			}
			// A joinable parent's peers are judged against the IMPORTER's own
			// dependency set, which is where pnpm resolves them from; see
			// {@link providerContext}.
			const join: Join = {
				manifests,
				joinable,
				context: providerContext(roots, byId, links),
				catalogs: options?.catalogs,
			};
			const judged = new Set<string>();
			collect(importer.path, walksFrom(roots, join), byId, rows, seen, policy, join, judged, unjudged);
			// A covered edge clears the marker ONLY when the walk actually read
			// the target's manifest peers for THIS importer. Covering the path
			// is not judging it: a target with no lockfile row, or one the walk
			// never reached, is still invisible, and the report says so.
			for (const edge of links) {
				if (edge.covered && (edge.row === undefined || !judged.has(edge.row.instanceId))) unjoinedLink = true;
			}
		}

		// An edge the lockfile records but the model could not name means some
		// peer may be satisfied by something invisible here — so the report is
		// incomplete, and says so rather than presenting its rows as the answer.
		//
		// A `link:`-resolved importer dependency is the same gap from the other
		// side: pnpm records no peer declarations for workspace
		// projects, so a parent reached through `link:` joins at best to a row
		// whose peers are empty BY DESIGN, and at worst — the root importer —
		// to nothing at all, while `pnpm peers check` reads the linked manifest
		// on disk and reports those peers. Where the caller supplied that
		// manifest AND the walk read it for the importer that recorded the edge,
		// those peers were judged for real and this marker is not owed; where it
		// did not — the key omitted, a target outside the supplied set, or a
		// covered target the walk could not reach — the peers are still
		// invisible, and the report says so rather than presenting its rows as
		// the answer. `version` is
		// populated by pnpm only, so npm and bun never reach the branch and the
		// scan stays format-free.
		if (unjoinedLink || lockfile.packages.some((pkg) => pkg.unresolvedEdges.length > 0)) {
			unverified.push("unresolvedEdge");
		}
		// A peer whose range or provider version could not be named was never
		// compared: neither satisfied nor unsatisfied, so the report cannot
		// present its silence as clean. Pushed in a fixed order so the array
		// does not depend on which importer the walk met first.
		if (unjudged.has("peerRangeUnresolved")) unverified.push("peerRangeUnresolved");
		if (unjudged.has("peerVersionUnresolved")) unverified.push("peerVersionUnresolved");

		return PeerCheck.make({
			supported: true,
			unsatisfied: rows,
			unresolvedImporters: unresolved,
			unverified,
		});
	}
}

/**
 * An importer's roots as walk nodes with their `parents` chain started.
 *
 * The importer's own row is the walk's first node with an empty chain — its
 * peers are the importer's own. A dependency instance joined from the importer
 * entry starts the chain with itself, as `pnpm peers check` reports it.
 *
 * @internal
 */
const walksFrom = (roots: ImporterRoots, join: Join): ReadonlyArray<Walk> =>
	roots._tag === "own"
		? [{ instance: roots.instance, path: [] }]
		: roots.instances.map((instance) => ({ instance, path: [parentLabel(join, instance)] }));

/**
 * Walk the resolution graph from an importer's roots, emitting a row for every
 * unsatisfied peer declared anywhere along the way.
 *
 * Adds to `unjudged` the reason each peer it could not judge was never
 * compared (see {@link judge} and {@link judgeJoined}); the caller surfaces
 * them on `unverified`.
 *
 * @internal
 */
const collect = (
	importerPath: string,
	roots: ReadonlyArray<Walk>,
	byId: ReadonlyMap<string, ResolvedPackage>,
	rows: Array<UnsatisfiedPeer>,
	seen: Set<string>,
	policy: Policy,
	join: Join,
	judged: Set<string>,
	unjudged: Set<UnverifiedReason>,
): void => {
	const visited = new Set<string>();
	const queue: Array<Walk> = [...roots];

	while (queue.length > 0) {
		const current = queue.shift();
		if (current === undefined) break;
		if (visited.has(current.instance.instanceId)) continue;
		visited.add(current.instance.instanceId);

		// A parent the walk reached through a covered `link:` edge contributes
		// its MANIFEST's peers, which is the whole point of supplying the
		// manifests: the lockfile records none for a workspace project. The
		// importer's own node (an empty chain) is never joined — pnpm reports a
		// linked package's unsatisfied peers through a consumer, not on itself.
		const linked = current.path.length === 0 ? undefined : joinedManifest(join, current.instance);
		const declared = linked?.peerDependencies ?? current.instance.peerDependencies;
		const optionalNames = linked === undefined ? undefined : optionalPeers(linked);
		const declaring = linked?.name ?? current.instance.name;
		// Recorded so the caller can tell a covered edge that was JUDGED from
		// one that was merely covered; see {@link PeerCheck.run}.
		if (linked !== undefined) judged.add(current.instance.instanceId);

		for (const [peer, wanted] of Object.entries(declared)) {
			if (peer === "") continue;
			const optional =
				optionalNames === undefined
					? current.instance.peerDependenciesMeta[peer]?.optional === true
					: optionalNames.has(peer);
			const verdict: JoinedVerdict =
				linked === undefined
					? withWanted(judge(current.instance, peer, wanted, optional, byId), wanted)
					: judgeJoined(join.context, join.catalogs, peer, wanted, optional);
			if (verdict._tag === "unjudged") for (const reason of verdict.reasons) unjudged.add(reason);
			if (verdict._tag !== "unsatisfied") continue;
			// pnpm computes the same violation and then SUPPRESSES it when a rule
			// permits the version that resolved. Replicating that is the whole
			// point: without it we report findings pnpm calls clean.
			if (suppressedByRule(policy, declaring, peer, verdict.found)) continue;
			// One row per (importer, peer, declaring INSTANCE) — which is what pnpm
			// reports. Measured on `peers/diamond`, where one importer reaches
			// `use-sync-external-store@1.2.2` through both react-redux and zustand:
			// `pnpm peers check --json` emits that package's unsatisfied `react`
			// once, carrying the chain it reached first, and says nothing about the
			// other. So a second chain is not a second fact, and the walk below
			// judges each instance once per importer for the same reason.
			//
			// The set is a guard rather than a live filter under the current walk —
			// the per-importer `visited` set already admits each instance once, and
			// deleting the guard changes no test. It earns its place by holding the
			// invariant at the point the row is emitted: swap the walk for a
			// per-chain one and this is what still collapses the diamond, which is
			// mutation-checked in both directions.
			const key = `${importerPath}\u0000${peer}\u0000${current.instance.instanceId}`;
			if (seen.has(key)) continue;
			seen.add(key);
			rows.push(
				UnsatisfiedPeer.make({
					importer: importerPath,
					dependency: peer,
					wanted: verdict.wanted,
					found: verdict.found,
					optional,
					parents: current.path,
				}),
			);
		}

		// Attribution STOPS at a workspace package the walk reached from the
		// importer. Its dependencies — linked workspace packages and registry
		// packages alike — are that package's own importer's business, and are
		// judged by that importer's walk. Measured against pnpm 12.6.0: with `b`
		// linking `a` and `a` linking `c`, `c`'s unmet peer is reported on `a`
		// only, whoever provides it (`linkchain-*/`), and a registry dependency
		// of a linked package reports its peers on that package's importer, never
		// on the consumer (`linkchain-registry/`). Walking on would judge a
		// deeper package's peers against the wrong importer's dependencies.
		if (current.path.length > 0 && current.instance.isWorkspace) continue;
		for (const targetId of Object.values(current.instance.resolved)) {
			const next = byId.get(targetId);
			if (next === undefined || visited.has(targetId)) continue;
			queue.push({
				instance: next,
				path: [...current.path, parentLabel(join, next)],
			});
		}
	}
};

/**
 * The parent name a `peerDependencyRules.allowedVersions` key names, with the
 * parent's version stripped.
 *
 * @remarks
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
 * @internal
 */
const ruleParentName = (parent: string): string => {
	const at = parent.lastIndexOf("@");
	return at > 0 ? parent.slice(0, at) : parent;
};

/**
 * Whether the effective rules suppress this row, the way pnpm would.
 *
 * @remarks
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
const suppressedByRule = (policy: Policy, parentName: string, peer: string, found: string | null): boolean => {
	if (found === null) return policy.ignoreMissing(peer);
	if (policy.allowAny(peer)) return true;
	const version = SemVer.parseResult(found);
	if (Result.isFailure(version)) return false;
	for (const [key, permitted] of Object.entries(policy.allowed)) {
		const separator = key.indexOf(">");
		// A key starting with ">" names no parent at all — malformed, and a
		// malformed rule suppresses nothing.
		if (separator === 0) continue;
		if (separator === -1) {
			// A BARE key applies to every parent that declares this peer. Measured
			// against pnpm 11.22.0: with `allowedVersions: { react: "17" }` and
			// nothing else, `pnpm peers check --json` reports the same workspace
			// clean that it reports `react-dom>react` for — and still reports the
			// row when the bare key's range does not cover the found version.
			// Skipping bare keys therefore reports rows pnpm suppresses, while
			// the report claims the policy was applied.
			if (key !== peer) continue;
		} else {
			if (key.slice(separator + 1) !== peer) continue;
			if (ruleParentName(key.slice(0, separator)) !== parentName) continue;
		}
		const range = Range.parseResult(permitted);
		// A rule whose own value is unparseable suppresses nothing — it cannot be
		// evaluated, and treating it as a wildcard would hide real findings.
		if (Result.isFailure(range)) continue;
		if (Range.satisfies(version.success, range.success)) return true;
	}
	return false;
};

/**
 * Decide whether one declared peer is unsatisfied.
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
const judge = (
	instance: ResolvedPackage,
	peer: string,
	wanted: string,
	optional: boolean,
	byId: ReadonlyMap<string, ResolvedPackage>,
): Verdict => {
	const providerId = instance.resolved[peer];
	const provider = providerId === undefined ? undefined : byId.get(providerId);
	if (provider === undefined) {
		// An ABSENT optional peer is satisfied by definition — that is what
		// "optional" means, and reporting it would be a false positive. An
		// optional peer installed at the WRONG version still is one, and is
		// reported below with the flag set. Confirmed against `pnpm peers check`,
		// whose `missing` section carries only non-optional entries while its
		// `bad` section carries optional ones.
		if (optional) return SATISFIED;
		// The edge IS recorded — the lockfile just spells its target in a way
		// the model could not name (a `link:` into a build-output directory, say).
		// So this peer may well be satisfied, and reporting it as unsatisfied is
		// precisely the false positive `unresolvedEdges` exists to prevent. It is
		// declined here and surfaced on the report's `unverified` instead: not
		// proven clean, but not falsely accused either.
		if (instance.unresolvedEdges.includes(peer)) return SATISFIED;
		// Nothing resolved for a required peer, and nothing recorded either:
		// reportable without any range arithmetic, and reported even when the
		// range itself is junk — "no provider" is a fact about the graph, not
		// about the range.
		return { _tag: "unsatisfied", found: null };
	}

	// A peer satisfied by a WORKSPACE package is accepted without a version
	// check, and that is correct rather than a hole: pnpm records no version for
	// an importer, so a workspace row carries the placeholder `"0.0.0"` and any
	// comparison would be against a placeholder rather than the real version.
	// An edge exists and a provider exists, so nothing indicates dissatisfaction
	// — a declined answer beats a false one, and reporting `found: "0.0.0"`
	// against a real range would be exactly that false answer.
	if (provider.isWorkspace) return SATISFIED;

	// A provider resolved through a protocol — a `file:` dependency or
	// override, or a git or remote tarball pnpm keys by its URL — carries the
	// specifier where a version belongs:
	// `@effected/lockfiles` passes it through, and for a `file:` DIRECTORY the
	// lockfile records no version at all. `pnpm peers check` reports such a
	// peer `bad`, with the specifier as `foundVersion`, even when the
	// directory's own manifest satisfies the range (`filedep/`,
	// `filedep-override/`, `filedep-tarball/`). Skipping it as unparseable
	// would call a peer pnpm rejects satisfied and the report proven clean,
	// so it fails the report closed instead, with no fabricated row either.
	if (isProtocolSpecifier(provider.version)) return { _tag: "unjudged", reasons: ["peerVersionUnresolved"] };

	// Something resolved but the comparison cannot be performed. Claiming
	// "unsatisfied" here would assert the result of a test that never ran.
	return compare(wanted, provider.version);
};
