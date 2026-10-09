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

import { CatalogResolver, DependencyResolutionError, DependencySpecifier, WorkspaceResolver } from "../npm/index.ts";
import { Effect, Exit, Layer, Option, Schema, SchemaTransformation } from "effect";
import { unanimousVersionOf } from "./internal/importerVersions.ts";
import { CatalogSet } from "./WorkspaceCatalogs.ts";

// A frozen, prototype-free empty map shared as the default for every absent
// dependency record — the `WorkspacePackage` precedent, so an omitted record
// round-trips as `{}` rather than `undefined`.
const EMPTY: Record<string, string> = Object.freeze(Object.create(null) as Record<string, string>);

const DependencyMap = Schema.Record(Schema.String, Schema.String).pipe(
	Schema.withDecodingDefaultKey(Effect.succeed(EMPTY)),
	Schema.withConstructorDefault(Effect.succeed(EMPTY)),
);

/**
 * A snapshot's `version` field: absent when the manifest declared none, and
 * never `""`.
 *
 * @remarks
 * The Type side is a `NonEmptyString`, so `make` rejects `""` outright. The
 * encoded side stays a plain optional string so that a stored value carrying
 * `""` still decodes, to the absent key it meant — a stored value and a fresh
 * capture of the same manifest compare equal.
 */
const SnapshotVersion = Schema.optionalKey(Schema.String).pipe(
	Schema.decodeTo(
		Schema.optionalKey(Schema.NonEmptyString),
		SchemaTransformation.transformOptional({
			decode: (encoded) => Option.filter(encoded, (version) => version !== ""),
			encode: (version) => version,
		}),
	),
);

/**
 * One workspace member as captured in a {@link WorkspaceStateSnapshot} — the
 * serializable slice a snapshot diff reads: identity, version, location, and the
 * four dependency records.
 *
 * @remarks
 * Deliberately narrower than {@link WorkspacePackage}: a snapshot is a value to
 * store and diff, not a located member to act on, so it carries no absolute
 * paths, `publishConfig`, or `private` flag. The four records are keyed by the
 * standard manifest field names, which are exactly `@effected/npm`'s
 * `DependencyField` values.
 *
 * @public
 */
export class PackageStateSnapshot extends Schema.Class<PackageStateSnapshot>("PackageStateSnapshot")({
	/** The package name. */
	name: Schema.NonEmptyString,
	/**
	 * The raw `version` string, as recorded at the captured moment — absent for
	 * a manifest that declared none.
	 *
	 * @remarks
	 * Optional exactly as `WorkspacePackage.version` is: a version-less member is
	 * an ordinary pnpm shape. Both capture paths — `WorkspaceSnapshots.at(ref)`
	 * and `WorkspaceSnapshots.worktree()` — omit the key for such a member, so
	 * the two sides of a diff agree without a placeholder. Never `""`: `make`
	 * rejects it, and a stored `""` decodes to the absent key.
	 *
	 * A version-less member is still a member: it appears in `packages` and
	 * answers {@link WorkspaceStateSnapshot.package}, but is absent from
	 * {@link WorkspaceStateSnapshot.versions}, resolves a `workspace:` specifier
	 * to `Option.none()`, and fails its snapshot-bound `WorkspaceResolver`'s
	 * `versionOf` typed.
	 */
	version: SnapshotVersion,
	/** POSIX path relative to the workspace root; `"."` for the root package. */
	relativePath: Schema.String,
	/** Production dependencies. */
	dependencies: DependencyMap,
	/** Development dependencies. */
	devDependencies: DependencyMap,
	/** Peer dependencies. */
	peerDependencies: DependencyMap,
	/** Optional dependencies. */
	optionalDependencies: DependencyMap,
}) {
	/**
	 * Every dependency, merged across the four kinds.
	 *
	 * @remarks
	 * Precedence on a name declared in several kinds runs
	 * `dependencies` \> `devDependencies` \> `peerDependencies` \>
	 * `optionalDependencies`.
	 */
	get allDependencies(): Record<string, string> {
		return {
			...this.optionalDependencies,
			...this.peerDependencies,
			...this.devDependencies,
			...this.dependencies,
		};
	}
}

/**
 * The state of a whole workspace at one moment — its packages and its assembled
 * catalog set — as a serializable value.
 *
 * @remarks
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
 * @example
 * ```ts
 * import { WorkspaceSnapshots } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const snapshots = yield* WorkspaceSnapshots;
 *   const before = yield* snapshots.at("origin/main");
 *   return before.resolve("effect", "catalog:");
 * });
 * ```
 *
 * @public
 */
export class WorkspaceStateSnapshot extends Schema.Class<WorkspaceStateSnapshot>("WorkspaceStateSnapshot")({
	/** Every workspace package captured at this moment. */
	packages: Schema.Array(PackageStateSnapshot),
	/** The catalog set assembled at this moment. */
	catalogs: CatalogSet,
	/**
	 * Each importer's dependency-name → resolved-version map, as the manager's
	 * lockfile recorded it at this moment.
	 *
	 * @remarks
	 * Defaults to `{}` when absent from a stored value; an empty index makes the
	 * `catalog:` fallback in {@link WorkspaceStateSnapshot.resolve} inert. Only
	 * pnpm records importer versions; bun and npm yield an empty index.
	 */
	importerVersions: Schema.optionalKey(Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.String))),
	/**
	 * Which version each declared config dependency's hook was replayed from at
	 * this moment, keyed by name.
	 *
	 * @remarks
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
	hookReplays: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
	/**
	 * Catalogs supplied from OUTSIDE this moment, consulted only when
	 * `catalogs` cannot answer.
	 *
	 * @remarks
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
	seededCatalogs: Schema.optionalKey(CatalogSet),
}) {
	#versionIndex: ReadonlyMap<string, string> | undefined;
	#packageIndex: ReadonlyMap<string, PackageStateSnapshot> | undefined;
	#catalogResolver: Layer.Layer<CatalogResolver> | undefined;
	#workspaceResolver: Layer.Layer<WorkspaceResolver> | undefined;
	#resolvers: Layer.Layer<CatalogResolver | WorkspaceResolver> | undefined;

	#versions(): ReadonlyMap<string, string> {
		if (this.#versionIndex === undefined) {
			// Only members that declared a version: an absent version stays absent
			// here, rather than being presented as a placeholder string.
			const index = new Map<string, string>();
			for (const pkg of this.packages) if (pkg.version !== undefined) index.set(pkg.name, pkg.version);
			this.#versionIndex = index;
		}
		return this.#versionIndex;
	}

	#packages(): ReadonlyMap<string, PackageStateSnapshot> {
		if (this.#packageIndex === undefined) {
			this.#packageIndex = new Map(this.packages.map((pkg) => [pkg.name, pkg]));
		}
		return this.#packageIndex;
	}

	/**
	 * Every captured package's name → version, for the packages that declared
	 * one. Total; O(1) after the first call.
	 *
	 * @remarks
	 * A member whose manifest declared no version is **absent** from this map,
	 * so every value is a real version and presence answers "has a version",
	 * not membership — ask {@link WorkspaceStateSnapshot.package} for that.
	 */
	get versions(): ReadonlyMap<string, string> {
		return this.#versions();
	}

	/** A single captured package by name, or `Option.none()`. Total. */
	package(name: string): Option.Option<PackageStateSnapshot> {
		return Option.fromUndefinedOr(this.#packages().get(name));
	}

	/**
	 * The concrete range or version a specifier resolved to AS OF this snapshot.
	 *
	 * @remarks
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
	 * @param dependency - The dependency's package name (what `workspace:` /
	 *   `catalog:` resolve for).
	 * @param specifier - The raw specifier string.
	 */
	resolve(dependency: string, specifier: string): Option.Option<string> {
		return this.#resolveWith(dependency, specifier, () =>
			Option.fromUndefinedOr(unanimousVersionOf(this.importerVersions ?? {}, dependency)),
		);
	}

	/**
	 * The concrete range or version a specifier resolved to AS OF this snapshot,
	 * scoped to the importer that declared it.
	 *
	 * @remarks
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
	 * @param importerPath - The importer's path relative to the workspace root,
	 *   `"."` for the root package — `PackageStateSnapshot.relativePath`.
	 * @param dependency - The dependency's package name.
	 * @param specifier - The raw specifier string.
	 */
	resolveIn(importerPath: string, dependency: string, specifier: string): Option.Option<string> {
		return this.#resolveWith(dependency, specifier, () =>
			Option.fromUndefinedOr(this.importerVersions?.[importerPath]?.[dependency]),
		);
	}

	/**
	 * The shared resolution path: classify, answer from the captured state, and
	 * consult `onUnresolvedCatalog` only for a `catalog:` specifier the catalog set
	 * could not answer. A plain range is already its own answer and must keep
	 * resolving to `Option.none()` so the caller falls back to the raw string.
	 */
	#resolveWith(
		dependency: string,
		specifier: string,
		onUnresolvedCatalog: () => Option.Option<string>,
	): Option.Option<string> {
		const exit = Schema.decodeUnknownExit(DependencySpecifier.FromString)(specifier);
		if (!Exit.isSuccess(exit)) return Option.none();
		const classified = exit.value;
		switch (classified._tag) {
			case "catalog": {
				const fromCatalogs = this.#catalogRange(dependency, classified.name);
				return Option.isSome(fromCatalogs) ? fromCatalogs : onUnresolvedCatalog();
			}
			case "workspace": {
				// A version-less member is absent from the index, so it resolves to
				// `none` exactly as a non-member does — there is nothing to substitute
				// for `workspace:^`.
				return Option.fromUndefinedOr(this.#versions().get(dependency));
			}
			default:
				return Option.none();
		}
	}

	/**
	 * The catalog half of resolution, in precedence order: this moment's own
	 * catalogs first, the external seed second.
	 *
	 * @remarks
	 * The ordering is the whole contract. What the ref itself declared can never
	 * be overridden by something handed in from outside, so a seed can only ever
	 * ADD an answer where there was none — which is why seeding is safe to do
	 * unconditionally and why an over-broad seed cannot corrupt a diff.
	 */
	#catalogRange(dependency: string, catalog: Option.Option<string>): Option.Option<string> {
		const own = this.catalogs.rangeOf(dependency, catalog);
		if (Option.isSome(own)) return own;
		return this.seededCatalogs === undefined ? Option.none() : this.seededCatalogs.rangeOf(dependency, catalog);
	}

	/**
	 * This snapshot with `seed` as its `seededCatalogs`
	 * — catalogs consulted only where this moment's own catalogs cannot answer.
	 *
	 * @remarks
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
	 * @param seed - The catalogs to consult as a fallback.
	 *
	 * @example
	 * ```ts
	 * import { WorkspaceCatalogs, WorkspaceSnapshots } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * const program = Effect.gen(function* () {
	 *   const snapshots = yield* WorkspaceSnapshots;
	 *   const catalogs = yield* WorkspaceCatalogs;
	 *   // The live set includes hook-injected catalogs under a config-dependency
	 *   // layer; the ref's own set never can.
	 *   const live = yield* catalogs.set();
	 *   const before = (yield* snapshots.at("origin/main")).withSeededCatalogs(live);
	 *   return before.resolve("effect", "catalog:");
	 * });
	 * ```
	 */
	withSeededCatalogs(seed: CatalogSet): WorkspaceStateSnapshot {
		return WorkspaceStateSnapshot.make({
			packages: this.packages,
			catalogs: this.catalogs,
			...(this.importerVersions === undefined ? {} : { importerVersions: this.importerVersions }),
			...(this.hookReplays === undefined ? {} : { hookReplays: this.hookReplays }),
			seededCatalogs: seed,
		});
	}

	/**
	 * Both sides of a diff, each seeded with the other's catalogs.
	 *
	 * @remarks
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
	 * @param before - One snapshot, conventionally the earlier one.
	 * @param after - The other snapshot, conventionally the later one.
	 * @returns Both snapshots in the order given, each carrying the other's
	 *   catalogs as its seed.
	 *
	 * @example
	 * ```ts
	 * import { WorkspaceSnapshots, WorkspaceStateSnapshot } from "./index.ts";
	 * import { Effect } from "effect";
	 *
	 * const program = Effect.gen(function* () {
	 *   const snapshots = yield* WorkspaceSnapshots;
	 *   const [before, after] = WorkspaceStateSnapshot.crossSeed(
	 *     yield* snapshots.at("origin/main"),
	 *     yield* snapshots.worktree(),
	 *   );
	 *   return { before: before.resolve("effect", "catalog:"), after: after.resolve("effect", "catalog:") };
	 * });
	 * ```
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
	 * @remarks
	 * The contract's error channel (`CatalogAssemblyError` /
	 * `DependencyResolutionError`) is satisfied vacuously: a snapshot's catalogs
	 * were already assembled when it was captured, so this resolver is total —
	 * `rangeOf` never fails.
	 */
	get catalogResolver(): Layer.Layer<CatalogResolver> {
		if (this.#catalogResolver === undefined) {
			this.#catalogResolver = Layer.succeed(CatalogResolver, {
				// The same precedence `resolve` applies — own catalogs, then the seed.
				// A resolver that ignored the seed would answer differently from
				// `resolve` on the very snapshot it is bound to.
				rangeOf: (packageName: string, catalog: Option.Option<string>) =>
					Effect.succeed(this.#catalogRange(packageName, catalog)),
			});
		}
		return this.#catalogResolver;
	}

	/**
	 * A `WorkspaceResolver` layer implementing `@effected/npm`'s contract against
	 * THIS snapshot's captured versions — so code written to the contract resolves
	 * `workspace:` specifiers as of this ref. Built once per instance and cached.
	 */
	get workspaceResolver(): Layer.Layer<WorkspaceResolver> {
		if (this.#workspaceResolver === undefined) {
			this.#workspaceResolver = Layer.succeed(WorkspaceResolver, {
				// The contract reserves `none` for a NON-member, so a known member that
				// declared no version fails typed — the same answer the discovery-backed
				// resolver gives.
				versionOf: (packageName: string) => {
					const member = this.#packages().get(packageName);
					if (member === undefined) return Effect.succeed(Option.none<string>());
					const version = member.version;
					if (version === undefined) {
						return Effect.fail(
							new DependencyResolutionError({
								specifier: `workspace:${packageName}`,
								reason: "no-version",
								cause: undefined,
							}),
						);
					}
					return Effect.succeed(Option.some(version));
				},
			});
		}
		return this.#workspaceResolver;
	}

	/** Both snapshot-scoped resolver layers merged. Built once per instance and cached. */
	get resolvers(): Layer.Layer<CatalogResolver | WorkspaceResolver> {
		if (this.#resolvers === undefined) {
			this.#resolvers = Layer.mergeAll(this.catalogResolver, this.workspaceResolver);
		}
		return this.#resolvers;
	}
}
