import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as MutableHashMap from "effect/MutableHashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashSet from "effect/MutableHashSet";
import { Jsonc } from "../../jsonc/index.ts";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as S from "effect/Schema";
import { BunExtension } from "../BunExtension.ts";
import { LockfileImporter } from "../LockfileImporter.ts";
import { ResolvedPackage } from "../ResolvedPackage.ts";
import type { LockfileFields, ParseFailure, WorkspaceEntry } from "./shared.ts";
import {
	extractWorkspaceDeps,
	importerDependencies,
	peerDeclarations,
	splitNameVersion,
	syntaxFailure,
	toIntegrityHash,
	validationFailure,
} from "./shared.ts";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/lockfiles/internal/bun");

// ── Raw schema (permissive validation scaffolding, not API) ────────────────

const DepRecord = S.optionalKey(S.Record(S.String, S.String)).annotate($I.annote("DepRecord", { description: "Optional dependency names and their declared specifier strings" }));

const OptionalPeers = S.String.pipe(S.Array, S.optionalKey).annotate($I.annote("OptionalPeers", { description: "Optional peer dependency names recorded in bun workspace entries and package tuples" }));

const BunWorkspaceEntry = S.Struct({
	name: S.optionalKey(S.String).annotateKey({ description: "Recorded package or workspace name" }),
	version: S.optionalKey(S.String).annotateKey({ description: "Recorded package version or resolved dependency version" }),
	dependencies: DepRecord.annotateKey({ description: "Declared runtime dependencies keyed by package name" }),
	devDependencies: DepRecord.annotateKey({ description: "Declared development dependencies keyed by package name" }),
	peerDependencies: DepRecord.annotateKey({ description: "Declared peer dependencies keyed by package name" }),
	optionalDependencies: DepRecord.annotateKey({ description: "Declared optional dependencies keyed by package name" }),
	// bun spells optional peers as an array of names rather than a meta object,
	// on workspace entries and package tuples alike.
	optionalPeers: OptionalPeers.annotateKey({ description: "Peer dependency names bun marks optional" }),
}).annotate($I.annote("BunWorkspaceEntry", { description: "Permissive bun workspace manifest entry with declared dependencies and optional peer names" }));

/**
 * The info object at package-tuple index 2. bun's tuple shape is
 * under-documented upstream, so it is read permissively and *out of band*: a
 * shape that does not decode is skipped (the package still lands, with no
 * peers) rather than failing the whole parse.
 *
 * @internal
 */
const BunPackageInfo = S.Struct({
	dependencies: DepRecord.annotateKey({ description: "Declared runtime dependencies keyed by package name" }),
	devDependencies: DepRecord.annotateKey({ description: "Declared development dependencies keyed by package name" }),
	optionalDependencies: DepRecord.annotateKey({ description: "Declared optional dependencies keyed by package name" }),
	peerDependencies: DepRecord.annotateKey({ description: "Declared peer dependencies keyed by package name" }),
	optionalPeers: OptionalPeers.annotateKey({ description: "Peer dependency names bun marks optional" }),
}).annotate($I.annote("BunPackageInfo", { description: "Optional tuple metadata decoded independently so malformed metadata does not discard its package" }));

const decodeBunPackageInfo = S.decodeUnknownExit(BunPackageInfo);

const readBunPackageInfo = (value: unknown): typeof BunPackageInfo.Type | undefined => {
	const exit = decodeBunPackageInfo(value);
	return Exit.isSuccess(exit) ? exit.value : undefined;
};

const BunLockfileRaw = S.Struct({
	// This ungated format preserves non-finite version numbers by stringifying them upstream.
	lockfileVersion: S.Finite.annotateKey({ description: "Recorded format version, preserved verbatim before gating or string conversion" }),
	workspaces: S.optionalKey(S.Record(S.String, BunWorkspaceEntry)).annotateKey({ description: "Workspace entries keyed by their recorded directory" }),
	packages: S.optionalKey(S.Record(S.String, S.Array(S.Unknown))).annotateKey({ description: "Resolved package entries in lockfile traversal order" }),
	catalog: S.optionalKey(S.Record(S.String, S.Unknown)).annotateKey({ description: "Default bun dependency catalog preserved as recorded" }),
	catalogs: S.optionalKey(S.Record(S.String, S.Record(S.String, S.Unknown))).annotateKey({ description: "Named dependency catalogs preserved as recorded" }),
	overrides: BunExtension.fields.overrides,
	trustedDependencies: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Dependency names bun trusts to run install scripts" }),
}).annotate($I.annote("BunLockfileRaw", { description: "Permissive bun JSONC lockfile with workspace entries, package tuples and extension fields" }));

type BunLockfileRawType = typeof BunLockfileRaw.Type;

/**
 * Parse bun `bun.lock` (JSONC) content into the unified field bundle.
 * Resolved packages are tuples whose first element is `"name@version"`;
 * the integrity hash is assumed at tuple index 3 (a permissive
 * reading of an under-documented upstream shape).
 *
 * **Example** (Parse an empty text bun lockfile)
 *
 * ```ts
 * import { parseBun } from "@beep/scratchpad/effected/lockfiles/internal/bun";
 * import * as Effect from "effect/Effect";
 *
 * const fields = Effect.runSync(parseBun('{"lockfileVersion":1,"workspaces":{},"packages":{}}'));
 * console.log(fields.packages.length); // 0
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const parseBun = Effect.fn("parseBun")(function* (content: string): Effect.fn.Return<LockfileFields, ParseFailure> {
	const parsed = yield* Jsonc.parse(content).pipe(Effect.mapError(syntaxFailure));
	const validated = yield* S.decodeUnknownEffect(BunLockfileRaw)(parsed).pipe(
		Effect.mapError(validationFailure),
	);
	return yield* toFields(validated);
});

// ── Transform ──────────────────────────────────────────────────────────────

/**
 * Resolve one entry's outgoing edges by replaying bun's own key scheme.
 *
 * **Details**
 *
 * bun encodes install position in the `packages` key: a nested install is
 * keyed `<parent-key>/<name>`, so `"react-dom/react"` is literally "the react
 * react-dom got". Package names are themselves slash-bearing when scoped, so
 * the parent chain is **not** computed by splitting on `/` — it is read off
 * the key space, taking those prefixes of the key that are themselves keys,
 * longest first. Deepest wins; the root (`<name>` alone) is tried last.
 *
 * Only keys that exist are emitted, so an edge bun did not record is omitted
 * rather than invented.
 *
 * @internal
 */
const resolveBunEdges = (
	key: string,
	sections: ReadonlyArray<Readonly<Record<string, string>> | undefined>,
	keys: MutableHashSet.MutableHashSet<string>,
): Record<string, string> => {
	const names = MutableHashSet.empty<string>();
	for (const section of sections) {
		if (section === undefined) continue;
		for (const name of R.keys(section)) if (name !== "") MutableHashSet.add(names, name);
	}
	if (MutableHashSet.size(names) === 0) return {};

	// The entry's own position first, then each ancestor key, then the root.
	const prefixes: Array<string> = [key];
	for (let i = key.indexOf("/"); i !== -1; i = key.indexOf("/", i + 1)) {
		const candidate = key.slice(0, i);
		if (MutableHashSet.has(keys, candidate)) prefixes.push(candidate);
	}
	const orderedPrefixes = A.append(A.sort(prefixes, Order.mapInput(Order.flip(Order.Number), (prefix: string) => prefix.length)), "");

	const edges = MutableHashMap.empty<string, string>();
	for (const name of names) {
		for (const prefix of orderedPrefixes) {
			const candidate = prefix === "" ? name : `${prefix}/${name}`;
			if (MutableHashSet.has(keys, candidate)) {
				MutableHashMap.set(edges, name, candidate);
				break;
			}
		}
	}
	// Map-backed until the last step: `Object.fromEntries` defines own data
	// properties, so a "__proto__" dependency name neither pollutes nor drops.
	return R.fromEntries(edges);
};

const infoSections = (info: typeof BunPackageInfo.Type | undefined) =>
	[info?.dependencies, info?.devDependencies, info?.optionalDependencies, info?.peerDependencies] as const;

const workspaceSections = (entry: typeof BunWorkspaceEntry.Type) =>
	[entry.dependencies, entry.devDependencies, entry.optionalDependencies, entry.peerDependencies] as const;

const toFields = Effect.fn("toFields")(function* (raw: BunLockfileRawType): Effect.fn.Return<LockfileFields, ParseFailure> {
	const packages: Array<ResolvedPackage> = [];
	// bun's own instance identities: the `packages` keys.
	const keys = MutableHashSet.fromIterable(raw.packages !== undefined ? R.keys(raw.packages) : []);
	let workspaceNames = HashSet.fromIterable<string>([]);
	const workspaceEntries = MutableHashMap.empty<string, WorkspaceEntry>();
	const importers: Array<LockfileImporter> = [];

	if (raw.workspaces !== undefined) {
		// Bun records concrete versions on the package tuples, not per importer,
		// so every importer dependency carries a specifier and no version. The
		// root workspace is the `""` entry — the `"."` importer.
		for (const [wsPath, wsEntry] of R.toEntries(raw.workspaces)) {
			importers.push(
				LockfileImporter.make({
					path: wsPath === "" ? "." : wsPath,
					dependencies: importerDependencies(wsEntry, (specifier) => ({ specifier })),
				}),
			);
		}

		for (const [wsPath, wsEntry] of R.toEntries(raw.workspaces)) {
			if (wsPath === "") continue; // root entry
			const name = wsEntry.name === undefined || wsEntry.name === "" ? wsPath : wsEntry.name;
			workspaceNames = HashSet.add(workspaceNames, name);
			// A workspace package's identity is its `packages` key — the bare
			// name — because that is what nested keys prefix themselves with. The
			// path is the fallback for a lockfile that records no such entry.
			const instanceId = MutableHashSet.has(keys, name) ? name : wsPath;
			if (instanceId === "") continue; // no identity, no row; skip, never throw
			packages.push(
				ResolvedPackage.make({
					name,
					version: wsEntry.version ?? "0.0.0",
					instanceId,
					isWorkspace: true,
					relativePath: wsPath,
					...peerDeclarations(wsEntry.peerDependencies, undefined, wsEntry.optionalPeers),
					resolved: resolveBunEdges(instanceId, workspaceSections(wsEntry), keys),
				}),
			);
			MutableHashMap.set(workspaceEntries, name, {
				...O.getSomesStruct({ dependencies: O.fromUndefinedOr(wsEntry.dependencies) }),
				...O.getSomesStruct({ devDependencies: O.fromUndefinedOr(wsEntry.devDependencies) }),
				...O.getSomesStruct({ peerDependencies: O.fromUndefinedOr(wsEntry.peerDependencies) }),
				...O.getSomesStruct({ optionalDependencies: O.fromUndefinedOr(wsEntry.optionalDependencies) }),
			});
		}
	}

	if (raw.packages !== undefined) {
		for (const [key, tuple] of R.toEntries(raw.packages)) {
			if (key === "") continue; // no identity, no row; skip, never throw
			if (tuple.length < 1) continue;
			const first = tuple[0];
			if (!P.isString(first)) continue; // malformed tuples are skipped, never thrown on
			// The first "@" after a scoped name's own, never the last: a version
			// part may hold one (`file:../@scope/lib`).
			const split = splitNameVersion(first);
			if (split === undefined) continue; // handles "@", "@scope/", bare names
			const { name, version } = split;

			// Workspace packages were already added from the workspaces map.
			if (HashSet.has(workspaceNames, name)) continue;

			const integrity = yield* toIntegrityHash(
				tuple.length >= 4 && P.isString(tuple[3]) ? tuple[3] : undefined,
			);
			// Tuple index 2 is the info object carrying the entry's own
			// dependency and peer declarations.
			const info = tuple.length >= 3 ? readBunPackageInfo(tuple[2]) : undefined;
			packages.push(
				ResolvedPackage.make({
					name,
					version,
					instanceId: key,
					...O.getSomesStruct({ integrity: O.fromUndefinedOr(integrity) }),
					isWorkspace: false,
					...peerDeclarations(info?.peerDependencies, undefined, info?.optionalPeers),
					resolved: resolveBunEdges(key, infoSections(info), keys),
				}),
			);
		}
	}

	const workspaceDependencies = extractWorkspaceDeps(workspaceEntries, workspaceNames);

	const extension = BunExtension.make({
		...O.getSomesStruct({ catalog: O.fromUndefinedOr(raw.catalog) }),
		...O.getSomesStruct({ catalogs: O.fromUndefinedOr(raw.catalogs) }),
		...O.getSomesStruct({ overrides: O.fromUndefinedOr(raw.overrides) }),
		...O.getSomesStruct({ trustedDependencies: O.fromUndefinedOr(raw.trustedDependencies) }),
	});

	return {
		lockfileVersion: String(raw.lockfileVersion),
		packages,
		workspaceDependencies,
		importers,
		extension,
	};
});
