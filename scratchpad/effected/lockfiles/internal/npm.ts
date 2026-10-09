import { $ScratchpadId } from "@beep/identity/packages";
import * as MutableHashMap from "effect/MutableHashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { LockfileImporter } from "../LockfileImporter.ts";
import { ResolvedPackage } from "../ResolvedPackage.ts";
import type { LockfileFields, ParseFailure, WorkspaceEntry } from "./shared.ts";
import {
	extractWorkspaceDeps,
	importerDependencies,
	peerDeclarations,
	requireLockfileVersion,
	syntaxFailure,
	toIntegrityHash,
	validationFailure,
} from "./shared.ts";
import * as R from "effect/Record";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/lockfiles/internal/npm");

// ── Raw schema (permissive validation scaffolding, not API) ────────────────

const DepRecord = S.optionalKey(S.Record(S.String, S.String)).annotate($I.annote("DepRecord", { description: "Optional dependency names and their declared specifier strings" }));

const PeerMetaRecord = S.optionalKey(
	S.Record(S.String, S.Struct({ optional: S.optionalKey(S.Boolean).annotateKey({ description: "Whether this peer dependency is optional" }) })),
).annotate($I.annote("PeerMetaRecord", { description: "Optional per-peer metadata recording whether a peer is optional" }));

const NpmPackageEntry = S.Struct({
	name: S.optionalKey(S.String).annotateKey({ description: "Recorded package or workspace name" }),
	version: S.optionalKey(S.String).annotateKey({ description: "Recorded package version or resolved dependency version" }),
	resolved: S.optionalKey(S.String).annotateKey({ description: "Recorded resolution location or resolved instance ids keyed by dependency name" }),
	integrity: S.optionalKey(S.String).annotateKey({ description: "Recorded subresource integrity hash" }),
	link: S.optionalKey(S.Boolean).annotateKey({ description: "Whether this package entry links to a workspace" }),
	dev: S.optionalKey(S.Boolean).annotateKey({ description: "Whether npm marks the package as development-only" }),
	dependencies: DepRecord.annotateKey({ description: "Declared runtime dependencies keyed by package name" }),
	devDependencies: DepRecord.annotateKey({ description: "Declared development dependencies keyed by package name" }),
	peerDependencies: DepRecord.annotateKey({ description: "Declared peer dependencies keyed by package name" }),
	peerDependenciesMeta: PeerMetaRecord.annotateKey({ description: "Optionality metadata keyed by peer dependency name" }),
	optionalDependencies: DepRecord.annotateKey({ description: "Declared optional dependencies keyed by package name" }),
}).annotate($I.annote("NpmPackageEntry", { description: "Permissive npm package entry with identity, resolution and dependency sections" }));

/**
 * The version gate's own input: `lockfileVersion` and nothing else.
 *
 * **Details**
 *
 * The gate has to read the version *before* the shape decode, because the
 * shape it would decode against is the shape of a supported version. `packages`
 * is a required key here and a v1 tree does not have one, so a shape-first
 * order reports npm v1 as **malformed** rather than as **too old** — losing
 * exactly the distinction the `UnsupportedLockfileVersion` cause exists to
 * carry.
 *
 * @internal
 */
const NpmVersionProbe = S.Struct({
	// The version gate owns non-finite rejection and preserves the recorded value in its typed cause.
	lockfileVersion: S.Union([S.Finite, S.String]).annotateKey({ description: "Recorded format version, preserved verbatim before gating or string conversion" }),
}).annotate($I.annote("NpmVersionProbe", { description: "Version-only npm boundary read before decoding the supported package-map shape" }));

const NpmLockfileRaw = S.Struct({
	name: S.optionalKey(S.String).annotateKey({ description: "Recorded package or workspace name" }),
	version: S.optionalKey(S.String).annotateKey({ description: "Recorded package version or resolved dependency version" }),
	// The version gate owns non-finite rejection and preserves the recorded value in its typed cause.
	lockfileVersion: S.Union([S.Finite, S.String]).annotateKey({ description: "Recorded format version, preserved verbatim before gating or string conversion" }),
	requires: S.optionalKey(S.Boolean).annotateKey({ description: "Whether npm records that this lockfile requires dependencies" }),
	packages: S.Record(S.String, NpmPackageEntry).annotateKey({ description: "Resolved package entries in lockfile traversal order" }),
}).annotate($I.annote("NpmLockfileRaw", { description: "Permissive package-lock document containing a version and installed package entries" }));

type NpmLockfileRawType = typeof NpmLockfileRaw.Type;
type NpmPackageEntryType = typeof NpmPackageEntry.Type;

const NODE_MODULES_PREFIX = "node_modules/";
const NESTED_NODE_MODULES = "/node_modules/";

/**
 * Where a `packages` key's package name starts: after the **last**
 * `node_modules/` segment, not the first.
 *
 * **Details**
 *
 * npm encodes the whole install position in the key, so
 * `node_modules/express/node_modules/debug` is *debug*, nested under express —
 * and `packages/lib/node_modules/react` is *react*, nested under a workspace
 * directory and carrying no `node_modules/` prefix at all. Returns `-1` for a
 * key that is not a package position (the root `""` entry, a workspace path
 * entry), which the caller skips.
 *
 * @internal
 */
const packageNameIndex = (key: string): number => {
	const nested = key.lastIndexOf(NESTED_NODE_MODULES);
	if (nested !== -1) return nested + NESTED_NODE_MODULES.length;
	return key.startsWith(NODE_MODULES_PREFIX) ? NODE_MODULES_PREFIX.length : -1;
};

/**
 * Resolve one entry's outgoing edges by replaying node resolution over the key
 * space: from the depending package's own directory, try
 * `<prefix>/node_modules/<name>`, then strip one path segment and try again,
 * out to the root — **deepest first**, first hit wins. That order is the whole
 * algorithm: outermost-first would return the hoisted copy and silently
 * mis-report every shadowed dependency.
 *
 * **Details**
 *
 * Only keys that actually exist in the lockfile are emitted, so an edge npm
 * did not record is omitted rather than invented.
 *
 * @internal
 */
const resolveNpmEdges = (
	start: string,
	sections: ReadonlyArray<Readonly<Record<string, string>> | undefined>,
	packages: Readonly<Record<string, unknown>>,
): Record<string, string> => {
	const names = MutableHashSet.empty<string>();
	for (const section of sections) {
		if (section === undefined) continue;
		for (const name of R.keys(section)) if (name !== "") MutableHashSet.add(names, name);
	}
	if (MutableHashSet.size(names) === 0) return {};

	const prefixes: Array<string> = [];
	for (let prefix = start; ; ) {
		prefixes.push(prefix);
		if (prefix === "") break;
		const slash = prefix.lastIndexOf("/");
		prefix = slash === -1 ? "" : prefix.slice(0, slash);
	}

	const edges = MutableHashMap.empty<string, string>();
	for (const name of names) {
		for (const prefix of prefixes) {
			const candidate = prefix === "" ? `${NODE_MODULES_PREFIX}${name}` : `${prefix}${NESTED_NODE_MODULES}${name}`;
			if (R.has(packages, candidate)) {
				MutableHashMap.set(edges, name, candidate);
				break;
			}
		}
	}
	// Map-backed until the last step: `Object.fromEntries` defines own data
	// properties, so a "__proto__" dependency name neither pollutes nor drops.
	return R.fromEntries(edges);
};

const entrySections = (entry: NpmPackageEntryType | undefined) =>
	[entry?.dependencies, entry?.devDependencies, entry?.optionalDependencies, entry?.peerDependencies] as const;

/** The lockfile text decoded as JSON of any shape; the version gate and shape decode follow. */
const decodeJsonText = S.decodeEffect(S.fromJsonString(S.Unknown));

/**
 * Parse npm `package-lock.json` content into the unified field bundle —
 * `lockfileVersion` 3 and newer; v2 and older fail typed at validation.
 * Schema JSON decoding maps malformed input into the typed `stage: "syntax"`
 * failure channel before version and shape validation.
 *
 * **Example** (Parse an empty npm package map)
 *
 * ```ts
 * import { parseNpm } from "@beep/scratchpad/effected/lockfiles/internal/npm";
 * import * as Effect from "effect/Effect";
 *
 * const fields = Effect.runSync(parseNpm('{"lockfileVersion":3,"packages":{}}'));
 * console.log(fields.lockfileVersion); // 3
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const parseNpm = Effect.fn("parseNpm")(function* (content: string): Effect.fn.Return<LockfileFields, ParseFailure> {
	const raw = yield* decodeJsonText(content).pipe(
		Effect.mapError(syntaxFailure),
	);
	// Format-version gate: npm lockfileVersion 3 and newer. v1/v2 trees record
	// resolution in a different shape this parser does not model.
	//
	// It runs BEFORE the shape decode, and must: a v1 tree carries no
	// `packages` object at all, so decoding first would report the oldest
	// format we reject as merely malformed. "Too old" is the more specific
	// true statement, and the only one a consumer can act on.
	const probe = yield* S.decodeUnknownEffect(NpmVersionProbe)(raw).pipe(Effect.mapError(validationFailure));
	yield* requireLockfileVersion("npm", probe.lockfileVersion);
	const validated = yield* S.decodeUnknownEffect(NpmLockfileRaw)(raw).pipe(Effect.mapError(validationFailure));
	return yield* toFields(validated);
});

// ── Transform ──────────────────────────────────────────────────────────────

const toFields = Effect.fn("toFields")(function* (raw: NpmLockfileRawType): Effect.fn.Return<LockfileFields, ParseFailure> {
	const packages: Array<ResolvedPackage> = [];
	let workspaceNames = HashSet.fromIterable<string>([]);
	const workspaceEntries = MutableHashMap.empty<string, WorkspaceEntry>();
	const importers: Array<LockfileImporter> = [];

	// npm records concrete versions on the `node_modules/*` entries, not per
	// importer, so every importer dependency carries a specifier and no version.
	// The root manifest is the `""` entry — the `"."` importer.
	const rootEntry = raw.packages[""];
	if (rootEntry !== undefined) {
		importers.push(
			LockfileImporter.make({ path: ".", dependencies: importerDependencies(rootEntry, (s) => ({ specifier: s })) }),
		);
	}

	// First pass: identify workspace link entries. Name resolution must match
	// the second pass (wsEntry first) or a link stub disagreeing with its
	// resolved entry drops inter-workspace edges.
	for (const [key, entry] of R.toEntries(raw.packages)) {
		const nameIndex = packageNameIndex(key);
		if (nameIndex !== -1 && entry.link === true) {
			const wsEntry = entry.resolved !== undefined ? raw.packages[entry.resolved] : undefined;
			const name = wsEntry?.name ?? entry.name ?? key.slice(nameIndex);
			if (name !== "") workspaceNames = HashSet.add(workspaceNames, name);
		}
	}

	// Second pass: build packages and workspace entries.
	for (const [key, entry] of R.toEntries(raw.packages)) {
		if (key === "") continue; // root entry
		// Every key that names a package position, at any nesting depth —
		// `node_modules/x`, `node_modules/x/node_modules/y` and the workspace
		// form `packages/lib/node_modules/y` alike. A key that names none (a
		// workspace path entry) is reached through its link entry instead.
		const nameIndex = packageNameIndex(key);
		if (nameIndex === -1) continue;

		if (entry.link === true) {
			// Workspace link — actual package data lives at the resolved path entry.
			const resolved = entry.resolved;
			const wsEntry = resolved !== undefined ? raw.packages[resolved] : undefined;
			const name = wsEntry?.name ?? entry.name ?? key.slice(nameIndex);
			if (name === "") continue; // a nameless entry cannot be modeled; skip, never throw
			packages.push(
				ResolvedPackage.make({
					name,
					version: wsEntry?.version ?? "0.0.0",
					instanceId: key,
					isWorkspace: true,
					...O.getSomesStruct({ relativePath: O.fromUndefinedOr(resolved) }),
					// A workspace link entry is a stub; its manifest sections —
					// peers included — live on the resolved path entry.
					...peerDeclarations(wsEntry?.peerDependencies, wsEntry?.peerDependenciesMeta, undefined),
					// Resolution starts from the workspace *directory*, which is where
					// npm nests a workspace-local copy (`packages/lib/node_modules/x`).
					resolved: resolveNpmEdges(
						resolved !== undefined && resolved !== "" ? resolved : key,
						entrySections(wsEntry),
						raw.packages,
					),
				}),
			);
			if (wsEntry !== undefined) {
				MutableHashMap.set(workspaceEntries, name, {
					...O.getSomesStruct({ dependencies: O.fromUndefinedOr(wsEntry.dependencies) }),
					...O.getSomesStruct({ devDependencies: O.fromUndefinedOr(wsEntry.devDependencies) }),
					...O.getSomesStruct({ peerDependencies: O.fromUndefinedOr(wsEntry.peerDependencies) }),
					...O.getSomesStruct({ optionalDependencies: O.fromUndefinedOr(wsEntry.optionalDependencies) }),
				});
			}
			// An empty resolved path is malformed: `LockfileImporter.path` is a
			// `NonEmptyString`, so constructing one from "" would die as a defect.
			// Skip the row before construction, per the total-skip discipline.
			if (resolved !== undefined && resolved !== "") {
				importers.push(
					LockfileImporter.make({
						path: resolved,
						dependencies: wsEntry !== undefined ? importerDependencies(wsEntry, (s) => ({ specifier: s })) : [],
					}),
				);
			}
		} else {
			// Regular resolved package, at any depth.
			const name = key.slice(nameIndex);
			if (name !== "" && entry.version !== undefined) {
				const integrity = yield* toIntegrityHash(entry.integrity);
				packages.push(
					ResolvedPackage.make({
						name,
						version: entry.version,
						instanceId: key,
						...O.getSomesStruct({ integrity: O.fromUndefinedOr(integrity) }),
						isWorkspace: false,
						dependencies: entry.dependencies ?? {},
						...peerDeclarations(entry.peerDependencies, entry.peerDependenciesMeta, undefined),
						resolved: resolveNpmEdges(key, entrySections(entry), raw.packages),
					}),
				);
			}
		}
	}

	const workspaceDependencies = extractWorkspaceDeps(workspaceEntries, workspaceNames);

	return {
		lockfileVersion: String(raw.lockfileVersion),
		packages,
		workspaceDependencies,
		importers,
	};
});
