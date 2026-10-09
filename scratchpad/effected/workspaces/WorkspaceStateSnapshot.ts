// The point-in-time value: what a workspace looked like at one moment (a git
// ref, or the live worktree). Serializable by construction — every field is a
// plain scalar, record, or another value class — with the resolution machinery
// living in lazily-built `#private` indexes OUTSIDE the schema, the same
// precedent `DependencyGraph`'s edge index and `Lockfile.packagesNamed` cite.
//
// A snapshot answers "what did this specifier mean HERE" against ITS OWN state:
// `workspace:` against the versions it captured, `catalog:` against the catalog
// set it captured. It also hands back `@effected/npm` resolver layers bound to
// itself, so code written to those contracts can run "as of" a ref.

import { $ScratchpadId } from "@beep/identity/packages";
import { CatalogResolver, DependencyResolutionError, DependencySpecifier, WorkspaceResolver } from "../npm/index.ts";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as HashMap from "effect/HashMap";
import * as R from "effect/Record";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { unanimousVersionOf } from "./internal/importerVersions.ts";
import { CatalogSet } from "./WorkspaceCatalogs.ts";

const $I = $ScratchpadId.create("effected/workspaces/WorkspaceStateSnapshot");

// A readonly empty record shared as the default for every absent
// dependency record — the `WorkspacePackage` precedent, so an omitted record
// round-trips as `{}` rather than `undefined`.
const EMPTY: Readonly<Record<string, string>> = R.fromEntries([]);

const DependencyMap = S.Record(S.String, S.String).pipe(
	S.withDecodingDefaultKey(Effect.succeed(EMPTY)),
	S.withConstructorDefault(Effect.succeed(EMPTY)),
);

/**
 * A snapshot's `version` field: absent when the manifest declared none, and
 * never `""`.
 *
 * **Details**
 *
 * The Type side is a `NonEmptyString`, so `make` rejects `""` outright. The
 * encoded side stays a plain optional string so that a stored value carrying
 * `""` still decodes, to the absent key it meant — a stored value and a fresh
 * capture of the same manifest compare equal.
 */
const SnapshotVersion = S.optionalKey(S.String).pipe(
	S.decodeTo(
		S.optionalKey(S.NonEmptyString),
		SchemaTransformation.transformOptional({
			decode: (encoded) => O.filter(encoded, (version) => version !== ""),
			encode: (version) => version,
		}),
	),
);

/**
 * One workspace member as captured in a {@link WorkspaceStateSnapshot} — the
 * serializable slice a snapshot diff reads: identity, version, location, and the
 * four dependency records.
 *
 * **Details**
 *
 * Deliberately narrower than {@link WorkspacePackage}: a snapshot is a value to
 * store and diff, not a located member to act on, so it carries no absolute
 * paths, `publishConfig`, or `private` flag. The four records are keyed by the
 * standard manifest field names, which are exactly `@effected/npm`'s
 * `DependencyField` values.
 *
 * **Example** (Capture a versionless member)
 *
 * ```ts
 * import { PackageStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const member = PackageStateSnapshot.make({ name: "app", relativePath: "." });
 * console.log(member.name) // app
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PackageStateSnapshot extends S.Class<PackageStateSnapshot>($I`PackageStateSnapshot`)({
	/** The package name. */
	name: S.NonEmptyString.annotateKey({ description: "The package name." }),
	/**
  * The raw `version` string, as recorded at the captured moment — absent for
  * a manifest that declared none.
  *
  * **Details**
  *
  * Optional exactly as `WorkspacePackage.version` is: a version-less member is
  * an ordinary pnpm shape. Both capture paths — `WorkspaceSnapshots.at(ref)`
  * and `WorkspaceSnapshots.worktree` — omit the key for such a member, so
  * the two sides of a diff agree without a placeholder. Never `""`: `make`
  * rejects it, and a stored `""` decodes to the absent key.
  *
  * A version-less member is still a member: it appears in `packages` and
  * answers {@link WorkspaceStateSnapshot.package}, but is absent from
  * {@link WorkspaceStateSnapshot.versions}, resolves a `workspace:` specifier
  * to `Option.none()`, and fails its snapshot-bound `WorkspaceResolver`'s
  * `versionOf` typed.
  */
	version: SnapshotVersion.annotateKey({ description: "The raw `version` string, as recorded at the captured moment — absent for a manifest that declared none." }),
	/** POSIX path relative to the workspace root; `"."` for the root package. */
	relativePath: S.String.annotateKey({ description: "POSIX path relative to the workspace root; `\".\"` for the root package." }),
	/** Production dependencies. */
	dependencies: DependencyMap.annotateKey({ description: "Production dependencies." }),
	/** Development dependencies. */
	devDependencies: DependencyMap.annotateKey({ description: "Development dependencies." }),
	/** Peer dependencies. */
	peerDependencies: DependencyMap.annotateKey({ description: "Peer dependencies." }),
	/** Optional dependencies. */
	optionalDependencies: DependencyMap.annotateKey({ description: "Optional dependencies." }),
}, $I.annote("PackageStateSnapshot", { description: "One workspace member as captured in a WorkspaceStateSnapshot — the serializable slice a snapshot diff reads: identity, version, location, and the four dependency records." })) {
	/**
 * Every dependency, merged across the four kinds.
 *
 * **Details**
 *
 * Precedence on a name declared in several kinds runs
 * `dependencies` \> `devDependencies` \> `peerDependencies` \>
 * `optionalDependencies`.
 *
 * **Example** (Read the merged dependency records)
 *
 * ```ts
 * import { PackageStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const member = PackageStateSnapshot.make({
 *   name: "app", relativePath: ".",
 *   dependencies: { effect: "^4.0.0" },
 *   devDependencies: { effect: "^3.0.0" },
 * });
 * console.log(member.allDependencies.effect) // ^4.0.0
 * ```
 *
 * @since 0.0.0
 */
	get allDependencies(): Record<string, string> {
		return R.fromEntries([
			...R.toEntries(this.optionalDependencies),
			...R.toEntries(this.peerDependencies),
			...R.toEntries(this.devDependencies),
			...R.toEntries(this.dependencies),
		]);
	}
}

/**
 * The state of a whole workspace at one moment — its packages and its assembled
 * catalog set — as a serializable value.
 *
 * **Details**
 *
 * Produced by `WorkspaceSnapshots.at` (a git ref, read with no checkout)
 * or `WorkspaceSnapshots.worktree` (the live tree). The lookup and
 * resolution surfaces (`versions`, `package`, `resolve`, the resolver layers)
 * are backed by `#private` indexes built lazily on first use and never encoded —
 * the `DependencyGraph` edge-index precedent.
 *
 * `resolve` and the resolver layers answer specifiers against THIS snapshot's
 * own captured state, so a consumer can ask "what did `catalog:` /
 * `workspace:*` mean as of that ref". An unmatched specifier is always
 * `Option.none()`, never an error.
 *
 * **Example** (Resolve a catalog specifier at a git ref)
 *
 * ```ts
 * import { WorkspaceSnapshots } from "@beep/scratchpad/effected/workspaces/index";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const snapshots = yield* WorkspaceSnapshots;
 *   const before = yield* snapshots.at("origin/main");
 *   return before.resolve("effect", "catalog:");
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class WorkspaceStateSnapshot extends S.Class<WorkspaceStateSnapshot>($I`WorkspaceStateSnapshot`)({
	/** Every workspace package captured at this moment. */
	packages: S.Array(PackageStateSnapshot).annotateKey({ description: "Every workspace package captured at this moment." }),
	/** The catalog set assembled at this moment. */
	catalogs: CatalogSet.annotateKey({ description: "The catalog set assembled at this moment." }),
	/**
  * Each importer's dependency-name → resolved-version map, as the manager's
  * lockfile recorded it at this moment.
  *
  * **Details**
  *
  * Defaults to `{}` when absent from a stored value; an empty index makes the
  * `catalog:` fallback in {@link WorkspaceStateSnapshot.resolve} inert. Only
  * pnpm records importer versions; bun and npm yield an empty index.
  */
	importerVersions: S.optionalKey(S.Record(S.String, S.Record(S.String, S.String))).annotateKey({ description: "Each importer's dependency-name → resolved-version map, as the manager's lockfile recorded it at this moment." }),
	/**
  * Which version each declared config dependency's hook was replayed from at
  * this moment, keyed by name.
  *
  * **Details**
  *
  * Versions only — WHERE this machine found each pnpmfile (the `source` of a
  * live `HookReplay`) is machine-local provenance, not part of "what the
  * workspace looked like then", so it stays on the live `HookInjection`
  * diagnostic and off this serializable value. Every fresh read sets the
  * field: `{}` under the no-op layer, which resolves nothing, when the file
  * declares no config dependencies, or on the bun / `package.json` path,
  * where config dependencies do not exist. Absent only when decoding a stored
  * value that omits it. Carried through `withSeededCatalogs` and `crossSeed`
  * unchanged, like `importerVersions`.
  */
	hookReplays: S.optionalKey(S.Record(S.String, S.String)).annotateKey({ description: "Which version each declared config dependency's hook was replayed from at this moment, keyed by name." }),
	/**
  * Catalogs supplied from OUTSIDE this moment, consulted only when
  * `catalogs` cannot answer.
  *
  * **Details**
  *
  * **This is deliberately not merged into `catalogs`.** That field means "the
  * catalog set assembled at this moment" and a snapshot is a serializable
  * value someone stores and diffs; blending an external set into it would
  * quietly make the field mean something else, and nothing downstream could
  * tell the two apart afterwards. Kept separate, the ref's own declaration
  * always wins and both halves stay readable.
  *
  * The motivating case is a catalog injected by a config-dependency
  * `pnpmfile` hook. It is recorded in no committed catalog source, so under
  * a non-replaying `ConfigDependencyHooks` layer (`layerNoop`, the default)
  * `WorkspaceSnapshots.at(ref)` cannot see it, and a `catalog:` specifier
  * against it resolves to nothing on BOTH sides of a diff. Seeding the live
  * hook-injected set, or the other side's set, restores a declared RANGE
  * without executing any historical code. Under a replaying layer `at(ref)`
  * replays the ref's own pinned hook and the seed answers only what neither
  * source declared.
  *
  * Defaults to absent, which makes the seed inert.
  */
	seededCatalogs: S.optionalKey(CatalogSet).annotateKey({ description: "Catalogs supplied from OUTSIDE this moment, consulted only when `catalogs` cannot answer." }),
}, $I.annote("WorkspaceStateSnapshot", { description: "The state of a whole workspace at one moment — its packages and its assembled catalog set — as a serializable value." })) {
	/**
 * Caches the name-to-version index outside the serializable schema.
 *
 * **Example** (Observe the cached version index)
 *
 * ```ts
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(snapshot.versions === snapshot.versions) // true
 * ```
 *
 * @since 0.0.0
 */
	#versionIndex: HashMap.HashMap<string, string> | undefined;
	/**
 * Caches versioned names in first-insertion order outside the serializable schema.
 *
 * **Example** (Observe the cached version name order)
 *
 * ```ts
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(snapshot.versionNames === snapshot.versionNames) // true
 * ```
 *
 * @since 0.0.0
 */
	#versionNames: ReadonlyArray<string> | undefined;
	/**
 * Caches captured members by name outside the serializable schema.
 *
 * **Example** (Query the member index)
 *
 * ```ts
 * import * as O from "effect/Option";
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(O.isNone(snapshot.package("missing"))) // true
 * ```
 *
 * @since 0.0.0
 */
	#packageIndex: HashMap.HashMap<string, PackageStateSnapshot> | undefined;
	/**
 * Caches the layer resolving catalogs against this snapshot.
 *
 * **Example** (Observe catalog layer memoization)
 *
 * ```ts
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(snapshot.catalogResolver === snapshot.catalogResolver) // true
 * ```
 *
 * @since 0.0.0
 */
	#catalogResolver: Layer.Layer<CatalogResolver> | undefined;
	/**
 * Caches the layer resolving workspace members against this snapshot.
 *
 * **Example** (Observe workspace layer memoization)
 *
 * ```ts
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(snapshot.workspaceResolver === snapshot.workspaceResolver) // true
 * ```
 *
 * @since 0.0.0
 */
	#workspaceResolver: Layer.Layer<WorkspaceResolver> | undefined;
	/**
 * Caches the merged catalog and workspace resolver layers.
 *
 * **Example** (Observe merged layer memoization)
 *
 * ```ts
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(snapshot.resolvers === snapshot.resolvers) // true
 * ```
 *
 * @since 0.0.0
 */
	#resolvers: Layer.Layer<CatalogResolver | WorkspaceResolver> | undefined;

	/**
 * Builds the version index and insertion-order names lazily, then reuses the index.
 *
 * **Example** (Trigger lazy version indexing)
 *
 * ```ts
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(snapshot.versions === snapshot.versions) // true
 * ```
 *
 * @since 0.0.0
 */
	#versions(): HashMap.HashMap<string, string> {
		if (this.#versionIndex === undefined) {
			let index = HashMap.empty<string, string>();
			const names: Array<string> = [];
			for (const pkg of this.packages) {
				if (pkg.version === undefined) continue;
				if (!HashMap.has(index, pkg.name)) names.push(pkg.name);
				index = HashMap.set(index, pkg.name, pkg.version);
			}
			this.#versionNames = names;
			this.#versionIndex = index;
		}
		return this.#versionIndex;
	}

	/**
 * Builds and reuses the name-to-member index for captured packages.
 *
 * **Example** (Trigger lazy member indexing)
 *
 * ```ts
 * import * as O from "effect/Option";
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(O.isNone(snapshot.package("missing"))) // true
 * ```
 *
 * @since 0.0.0
 */
	#packages(): HashMap.HashMap<string, PackageStateSnapshot> {
		if (this.#packageIndex === undefined) {
			this.#packageIndex = HashMap.fromIterable(this.packages.map((pkg) => [pkg.name, pkg] as const));
		}
		return this.#packageIndex;
	}

	/**
 * Every captured package's name → version, for the packages that declared
 * one. Total; O(1) after the first call.
 *
 * **Gotchas**
 *
 * A member whose manifest declared no version is **absent** from this map,
 * so every value is a real version and presence answers "has a version",
 * not membership — ask {@link WorkspaceStateSnapshot.package} for that.
 *
 * **Example** (Count captured versions)
 *
 * ```ts
 * import * as HashMap from "effect/HashMap";
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(HashMap.size(snapshot.versions)) // 0
 * ```
 *
 * @since 0.0.0
 */
	get versions(): HashMap.HashMap<string, string> {
		return this.#versions();
	}

	/**
 * Versioned package names in first-insertion order, excluding unversioned members.
 *
 * **Example** (Read versioned names in insertion order)
 *
 * ```ts
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(snapshot.versionNames.length) // 0
 * ```
 *
 * @since 0.0.0
 */
	get versionNames(): ReadonlyArray<string> {
		this.#versions();
		return this.#versionNames ?? [];
	}

	/**
 *  A single captured package by name, or `Option.none()`. Total. 
 *
 * **Example** (Look up an absent workspace member)
 *
 * ```ts
 * import * as O from "effect/Option";
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(O.isNone(snapshot.package("missing"))) // true
 * ```
 *
 * @since 0.0.0
 */
	package(name: string): O.Option<PackageStateSnapshot> {
		return HashMap.get(this.#packages(), name);
	}

	/**
 * The concrete range or version a specifier resolved to AS OF this snapshot.
 *
 * **Details**
 *
 * The specifier is classified through `@effected/npm`'s
 * `DependencySpecifier.FromString` — never by prefix-sniffing.
 * A `workspace:` specifier resolves to the captured version of `dependency`; a
 * `catalog:` specifier resolves against the captured catalog set. Every other
 * form — a plain range, a dist-tag, a `file:`/git/url specifier, or an
 * unparseable string — is `Option.none()`, because there is no indirection to
 * resolve. Total.
 *
 * A `catalog:` specifier resolves in three steps, and the order is the
 * contract: this moment's own `catalogs` first,
 * then `seededCatalogs` if one was supplied,
 * then the `importerVersions` fallback below. The first two answer with a
 * declared RANGE and the third with a concrete version, so a seeded snapshot
 * reports a range change where an unseeded one could only report a version —
 * which is the difference between a diff row and no row when both refs
 * recorded the same installed version.
 *
 * A `catalog:` specifier neither catalog set can resolve falls back to this
 * snapshot's `importerVersions` — but only to a version
 * **every** importer recording that dependency agrees on. A catalog injected
 * by a config-dependency pnpmfile hook appears in no committed catalog source,
 * so without this fallback both sides of a before/after diff resolve it to the
 * same raw string and a real version movement produces no row. When importers
 * disagree there is no single correct answer, so this stays `Option.none()`
 * rather than inventing one; {@link WorkspaceStateSnapshot.resolveIn} answers
 * precisely for callers that know which importer is asking.
 *
 * **Example** (Leave a plain range unresolved)
 *
 * ```ts
 * import * as O from "effect/Option";
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(O.isNone(snapshot.resolve("effect", "^4.0.0"))) // true
 * ```
 *
 * @param dependency - The dependency's package name (what `workspace:` /
 *   `catalog:` resolve for).
 * @param specifier - The raw specifier string.
 * @since 0.0.0
 */
	resolve(dependency: string, specifier: string): O.Option<string> {
		return this.#resolveWith(dependency, specifier, () =>
			O.fromUndefinedOr(unanimousVersionOf(this.importerVersions ?? {}, dependency)),
		);
	}

	/**
 * The concrete range or version a specifier resolved to AS OF this snapshot,
 * scoped to the importer that declared it.
 *
 * **Details**
 *
 * Identical to {@link WorkspaceStateSnapshot.resolve} except in how an
 * unresolvable `catalog:` specifier falls back: this consults **only**
 * `importerPath`'s own recorded versions, so a monorepo whose packages hold
 * different versions of one dependency still gets an exact answer where
 * `resolve` must abstain. Prefer this whenever the caller knows the importer —
 * a consumer iterating `packages` has `relativePath` in hand, which is the
 * importer key (`"."` for the root package).
 *
 * An unknown `importerPath`, or one recording nothing for `dependency`, is
 * `Option.none()`. Total.
 *
 * **Example** (Resolve the importers recorded catalog version)
 *
 * ```ts
 * import * as O from "effect/Option";
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({
 *   packages: [], catalogs: CatalogSet.empty(),
 *   importerVersions: { ".": { effect: "4.0.0" } },
 * });
 * console.log(O.getOrUndefined(snapshot.resolveIn(".", "effect", "catalog:"))) // 4.0.0
 * ```
 *
 * @param importerPath - The importer's path relative to the workspace root,
 *   `"."` for the root package — `PackageStateSnapshot.relativePath`.
 * @param dependency - The dependency's package name.
 * @param specifier - The raw specifier string.
 * @since 0.0.0
 */
	resolveIn(importerPath: string, dependency: string, specifier: string): O.Option<string> {
		return this.#resolveWith(dependency, specifier, () =>
			O.flatMap(R.get(this.importerVersions ?? {}, importerPath), R.get(dependency)),
		);
	}

	/**
	 * The shared resolution path: classify, answer from the captured state, and
	 * consult `onUnresolvedCatalog` only for a `catalog:` specifier the catalog set
	 * could not answer. A plain range is already its own answer and must keep
	 * resolving to `Option.none()` so the caller falls back to the raw string.
 *
 * **Example** (Use the shared specifier resolution path)
 *
 * ```ts
 * import * as O from "effect/Option";
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(O.isNone(snapshot.resolve("effect", "^4.0.0"))) // true
 * ```
 *
 * @since 0.0.0
 */
	#resolveWith(
		dependency: string,
		specifier: string,
		onUnresolvedCatalog: () => O.Option<string>,
	): O.Option<string> {
		const exit = S.decodeExit(DependencySpecifier.FromString)(specifier);
		if (!Exit.isSuccess(exit)) return O.none();
		const classified = exit.value;
		return Match.value(classified).pipe(
			Match.tag("catalog", (catalog) => {
				const fromCatalogs = this.#catalogRange(dependency, catalog.name);
				return O.isSome(fromCatalogs) ? fromCatalogs : onUnresolvedCatalog();
			}),
			// A version-less member is absent from the index, so it resolves to
			// `none` exactly as a non-member does — there is nothing to substitute
			// for `workspace:^`.
			Match.tag("workspace", () => HashMap.get(this.#versions(), dependency)),
			Match.orElse(O.none<string>),
		);
	}

	/**
  * The catalog half of resolution, in precedence order: this moment's own
  * catalogs first, the external seed second.
  *
  * **Details**
  *
  * The ordering is the whole contract. What the ref itself declared can never
  * be overridden by something handed in from outside, so a seed can only ever
  * ADD an answer where there was none — which is why seeding is safe to do
  * unconditionally and why an over-broad seed cannot corrupt a diff.
 *
 * **Example** (Consult catalog sources through resolution)
 *
 * ```ts
 * import * as O from "effect/Option";
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(O.isNone(snapshot.resolve("effect", "catalog:"))) // true
 * ```
 *
 * @since 0.0.0
 */
	#catalogRange(dependency: string, catalog: O.Option<string>): O.Option<string> {
		const own = this.catalogs.rangeOf(dependency, catalog);
		if (O.isSome(own)) return own;
		return this.seededCatalogs === undefined ? O.none() : this.seededCatalogs.rangeOf(dependency, catalog);
	}

	/**
  * This snapshot with `seed` as its `seededCatalogs`
  * — catalogs consulted only where this moment's own catalogs cannot answer.
  *
  * **Details**
  *
  * Returns a NEW snapshot; the receiver is untouched, and the seed REPLACES
  * any seed already present rather than merging with it (a snapshot is a
  * value, and an accumulating seed would make precedence depend on call
  * order). {@link WorkspaceStateSnapshot.crossSeed} is the deliberate
  * exception: it composes the two seeds explicitly, precisely because a bare
  * replace would discard a layer-level seed. `catalogs`, `packages`, `importerVersions` and `hookReplays` are
  * carried through unchanged, so what the ref declared is still exactly what it declared.
  *
  * The two seeds worth reaching for: the LIVE hook-injected catalog set (from
  * a `WorkspaceCatalogs` built by one of the config-dependency layers), or the
  * other side of a two-ref diff — see
  * {@link WorkspaceStateSnapshot.crossSeed}.
  *
  * **Example** (Seed a historical snapshot with live catalogs)
  *
  * ```ts
  * import { WorkspaceCatalogs, WorkspaceSnapshots } from "@beep/scratchpad/effected/workspaces/index";
  * import * as Effect from "effect/Effect";
  *
  * const program = Effect.gen(function* () {
  *   const snapshots = yield* WorkspaceSnapshots;
  *   const catalogs = yield* WorkspaceCatalogs;
  *   // The live set includes hook-injected catalogs under a config-dependency
  *   // layer; the ref's own set never can.
  *   const live = yield* catalogs.set;
  *   const before = (yield* snapshots.at("origin/main")).withSeededCatalogs(live);
  *   return before.resolve("effect", "catalog:");
  * });
 * console.log(Effect.isEffect(program)) // true
  * ```
  *
  * @param seed - The catalogs to consult as a fallback.
 * @since 0.0.0
 */
	withSeededCatalogs(seed: CatalogSet): WorkspaceStateSnapshot {
		return WorkspaceStateSnapshot.make({
			packages: this.packages,
			catalogs: this.catalogs,
			...O.getSomesStruct({ importerVersions: O.fromUndefinedOr(this.importerVersions) }),
			...O.getSomesStruct({ hookReplays: O.fromUndefinedOr(this.hookReplays) }),
			seededCatalogs: seed,
		});
	}

	/**
  * Both sides of a diff, each seeded with the other's catalogs.
  *
  * **Gotchas**
  *
  * The two-ref symmetry the hook-catalog gap actually needs. A catalog
  * injected by a config-dependency hook is declared in no committed source,
  * so neither ref's snapshot can see it and a `catalog:` specifier against it
  * resolves to nothing on both sides — a real version movement then produces
  * no row. Cross-seeding restores a declared RANGE on whichever side is
  * missing it, at strictly lower precedence than that side's own catalogs, so
  * a genuine change between the refs still reads as a change.
  *
  * **What cross-seeding can and cannot see depends on the hooks layer.** A
  * range change made purely by bumping the config dependency BETWEEN the two
  * refs is detected when the snapshots were read under a replaying
  * `ConfigDependencyHooks` layer: `WorkspaceSnapshots.at(ref)` replays each
  * ref's hook at the version that ref's `configDependencies` declares, so
  * each side's OWN catalogs carry that side's injected range and the seed
  * never gets a say. Under `layerNoop` the case stays suppressed — neither
  * committed source declares the catalog, so each side falls back to the
  * other's value and the two agree by construction; there, diff
  * `configDependencies` in `pnpm-workspace.yaml` directly, the only committed
  * evidence that the injection changed. Cross-seeding is harmless under a
  * replaying layer (own catalogs take precedence) and still worthwhile under
  * the no-op one, which is why it stays.
  *
  * **The seeding relationship is symmetric; the RETURN ORDER is not.** Each
  * snapshot is seeded with the other's catalogs, so neither argument is
  * privileged and swapping them produces the same two values — but they come
  * back mirroring the order they went in, so destructure in the order you
  * passed. The `before`/`after` names describe the intended calling
  * convention for a two-ref diff, not a constraint on what may be passed.
  *
  * **A seed already present on either snapshot is preserved**, beneath the
  * other side's catalogs — which matters because
  * `WorkspaceSnapshotsOptions.seedCatalogs` puts one there on every snapshot
  * the service returns. Composing the two surfaces is therefore safe: the
  * layer-level seed keeps answering what neither ref declared, while the
  * other ref's committed declaration wins where it has one.
  *
  * **Example** (Cross-seed snapshots for catalog resolution)
  *
  * ```ts
  * import { WorkspaceSnapshots, WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/index";
  * import * as Effect from "effect/Effect";
  *
  * const program = Effect.gen(function* () {
  *   const snapshots = yield* WorkspaceSnapshots;
  *   const [before, after] = WorkspaceStateSnapshot.crossSeed(
  *     yield* snapshots.at("origin/main"),
  *     yield* snapshots.worktree,
  *   );
  *   return { before: before.resolve("effect", "catalog:"), after: after.resolve("effect", "catalog:") };
  * });
 * console.log(Effect.isEffect(program)) // true
  * ```
  *
  * @param before - One snapshot, conventionally the earlier one.
  * @param after - The other snapshot, conventionally the later one.
  * @returns Both snapshots in the order given, each carrying the other's
  *   catalogs as its seed.
 * @since 0.0.0
 */
	static crossSeed(
		before: WorkspaceStateSnapshot,
		after: WorkspaceStateSnapshot,
	): readonly [WorkspaceStateSnapshot, WorkspaceStateSnapshot] {
		// A seed already on the receiver is KEPT, beneath the other side's
		// catalogs. `withSeededCatalogs` replaces, and `WorkspaceSnapshots` applies
		// a layer-level `seedCatalogs` to every snapshot it returns — so a
		// replace-only cross-seed dropped that seed on BOTH sides at once and
		// silently reopened the hook-catalog gap these surfaces exist to close.
		// The other ref's committed declaration still outranks the carried seed,
		// which is the whole point of cross-seeding; the carried seed only answers
		// what neither ref declared.
		const seedFor = (self: WorkspaceStateSnapshot, other: WorkspaceStateSnapshot): CatalogSet =>
			self.seededCatalogs === undefined ? other.catalogs : CatalogSet.merge(self.seededCatalogs, other.catalogs);
		return [
			before.withSeededCatalogs(seedFor(before, after)),
			after.withSeededCatalogs(seedFor(after, before)),
		] as const;
	}

	/**
 * A `CatalogResolver` layer implementing `@effected/npm`'s contract against
 * THIS snapshot's catalog set — so code written to the contract resolves
 * `catalog:` specifiers as of this ref. Built once per instance and cached, so
 * it memoizes by reference.
 *
 * **Details**
 *
 * The contract's error channel (`CatalogAssemblyError` /
 * `DependencyResolutionError`) is satisfied vacuously: a snapshot's catalogs
 * were already assembled when it was captured, so this resolver is total —
 * `rangeOf` never fails.
 *
 * **Example** (Resolve an absent catalog through the snapshot layer)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { CatalogResolver } from "@beep/scratchpad/effected/npm/CatalogResolver";
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * const program = Effect.gen(function* () {
 *   const resolver = yield* CatalogResolver;
 *   return yield* resolver.rangeOf("missing", O.none());
 * }).pipe(Effect.provide(snapshot.catalogResolver));
 * console.log(O.isNone(Effect.runSync(program))) // true
 * ```
 *
 * @since 0.0.0
 */
	get catalogResolver(): Layer.Layer<CatalogResolver> {
		if (this.#catalogResolver === undefined) {
			this.#catalogResolver = Layer.succeed(CatalogResolver, {
				// The same precedence `resolve` applies — own catalogs, then the seed.
				// A resolver that ignored the seed would answer differently from
				// `resolve` on the very snapshot it is bound to.
				rangeOf: Effect.fn("CatalogResolver.rangeOf")((packageName: string, catalog: O.Option<string>) => Effect.succeed(this.#catalogRange(packageName, catalog))),
			});
		}
		return this.#catalogResolver;
	}

	/**
 * A `WorkspaceResolver` layer implementing `@effected/npm`'s contract against
 * THIS snapshot's captured versions — so code written to the contract resolves
 * `workspace:` specifiers as of this ref. Built once per instance and cached.
 *
 * **Example** (Resolve a nonmember through the snapshot layer)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { WorkspaceResolver } from "@beep/scratchpad/effected/npm/WorkspaceResolver";
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * const program = Effect.gen(function* () {
 *   const resolver = yield* WorkspaceResolver;
 *   return yield* resolver.versionOf("missing");
 * }).pipe(Effect.provide(snapshot.workspaceResolver));
 * console.log(O.isNone(Effect.runSync(program))) // true
 * ```
 *
 * @since 0.0.0
 */
	get workspaceResolver(): Layer.Layer<WorkspaceResolver> {
		if (this.#workspaceResolver === undefined) {
			this.#workspaceResolver = Layer.succeed(WorkspaceResolver, {
				// The contract reserves `none` for a NON-member, so a known member that
				// declared no version fails typed — the same answer the discovery-backed
				// resolver gives.
				versionOf: Effect.fn("WorkspaceResolver.versionOf")((packageName: string): Effect.Effect<O.Option<string>, DependencyResolutionError> => {
					const member = O.getOrUndefined(HashMap.get(this.#packages(), packageName));
					if (member === undefined) return Effect.succeed(O.none<string>());
					const version = member.version;
					if (version === undefined) {
						return Effect.fail(
							DependencyResolutionError.make({
								specifier: `workspace:${packageName}`,
								reason: "no-version",
								cause: undefined,
							}),
						);
					}
					return Effect.succeedSome(version);
				}),
			});
		}
		return this.#workspaceResolver;
	}

	/**
 *  Both snapshot-scoped resolver layers merged. Built once per instance and cached. 
 *
 * **Example** (Reuse the merged snapshot layers)
 *
 * ```ts
 * import { CatalogSet } from "@beep/scratchpad/effected/workspaces/WorkspaceCatalogs";
 * import { WorkspaceStateSnapshot } from "@beep/scratchpad/effected/workspaces/WorkspaceStateSnapshot";
 *
 * const snapshot = WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty() });
 * console.log(snapshot.resolvers === snapshot.resolvers) // true
 * ```
 *
 * @since 0.0.0
 */
	get resolvers(): Layer.Layer<CatalogResolver | WorkspaceResolver> {
		if (this.#resolvers === undefined) {
			this.#resolvers = Layer.mergeAll(this.catalogResolver, this.workspaceResolver);
		}
		return this.#resolvers;
	}
}
