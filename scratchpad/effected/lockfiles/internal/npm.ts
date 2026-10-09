import { Effect, Schema } from "effect";
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

// ── Raw schema (permissive validation scaffolding, not API) ────────────────

const DepRecord = Schema.optionalKey(Schema.Record(Schema.String, Schema.String));

const PeerMetaRecord = Schema.optionalKey(
	Schema.Record(Schema.String, Schema.Struct({ optional: Schema.optionalKey(Schema.Boolean) })),
);

const NpmPackageEntry = Schema.Struct({
	name: Schema.optionalKey(Schema.String),
	version: Schema.optionalKey(Schema.String),
	resolved: Schema.optionalKey(Schema.String),
	integrity: Schema.optionalKey(Schema.String),
	link: Schema.optionalKey(Schema.Boolean),
	dev: Schema.optionalKey(Schema.Boolean),
	dependencies: DepRecord,
	devDependencies: DepRecord,
	peerDependencies: DepRecord,
	peerDependenciesMeta: PeerMetaRecord,
	optionalDependencies: DepRecord,
});

/**
 * The version gate's own input: `lockfileVersion` and nothing else.
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
const NpmVersionProbe = Schema.Struct({
	lockfileVersion: Schema.Union([Schema.Finite, Schema.String]),
});

const NpmLockfileRaw = Schema.Struct({
	name: Schema.optionalKey(Schema.String),
	version: Schema.optionalKey(Schema.String),
	lockfileVersion: Schema.Union([Schema.Finite, Schema.String]),
	requires: Schema.optionalKey(Schema.Boolean),
	packages: Schema.Record(Schema.String, NpmPackageEntry),
});

type NpmLockfileRawType = typeof NpmLockfileRaw.Type;
type NpmPackageEntryType = typeof NpmPackageEntry.Type;

const NODE_MODULES_PREFIX = "node_modules/";
const NESTED_NODE_MODULES = "/node_modules/";

/**
 * Where a `packages` key's package name starts: after the **last**
 * `node_modules/` segment, not the first.
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
	const names = new Set<string>();
	for (const section of sections) {
		if (section === undefined) continue;
		for (const name of Object.keys(section)) if (name !== "") names.add(name);
	}
	if (names.size === 0) return {};

	const prefixes: Array<string> = [];
	for (let prefix = start; ; ) {
		prefixes.push(prefix);
		if (prefix === "") break;
		const slash = prefix.lastIndexOf("/");
		prefix = slash === -1 ? "" : prefix.slice(0, slash);
	}

	const edges = new Map<string, string>();
	for (const name of names) {
		for (const prefix of prefixes) {
			const candidate = prefix === "" ? `${NODE_MODULES_PREFIX}${name}` : `${prefix}${NESTED_NODE_MODULES}${name}`;
			if (Object.hasOwn(packages, candidate)) {
				edges.set(name, candidate);
				break;
			}
		}
	}
	// Map-backed until the last step: `Object.fromEntries` defines own data
	// properties, so a "__proto__" dependency name neither pollutes nor drops.
	return Object.fromEntries(edges);
};

const entrySections = (entry: NpmPackageEntryType | undefined) =>
	[entry?.dependencies, entry?.devDependencies, entry?.optionalDependencies, entry?.peerDependencies] as const;

/**
 * Parse npm `package-lock.json` content into the unified field bundle —
 * `lockfileVersion` 3 and newer; v2 and older fail typed at validation.
 * Native `JSON.parse` inside `Effect.try` — its throw on hostile input
 * (including V8's `RangeError` on pathological depth) lands typed as
 * `stage: "syntax"`.
 *
 * @internal
 */
export const parseNpm = (content: string): Effect.Effect<LockfileFields, ParseFailure> =>
	Effect.gen(function* () {
		const raw = yield* Effect.try({
			try: () => JSON.parse(content) as unknown,
			catch: syntaxFailure,
		});
		// Format-version gate: npm lockfileVersion 3 and newer. v1/v2 trees record
		// resolution in a different shape this parser does not model.
		//
		// It runs BEFORE the shape decode, and must: a v1 tree carries no
		// `packages` object at all, so decoding first would report the oldest
		// format we reject as merely malformed. "Too old" is the more specific
		// true statement, and the only one a consumer can act on.
		const probe = yield* Schema.decodeUnknownEffect(NpmVersionProbe)(raw).pipe(Effect.mapError(validationFailure));
		yield* requireLockfileVersion("npm", probe.lockfileVersion);
		const validated = yield* Schema.decodeUnknownEffect(NpmLockfileRaw)(raw).pipe(Effect.mapError(validationFailure));
		return yield* toFields(validated);
	});

// ── Transform ──────────────────────────────────────────────────────────────

const toFields = (raw: NpmLockfileRawType): Effect.Effect<LockfileFields, ParseFailure> =>
	Effect.gen(function* () {
		const packages: Array<ResolvedPackage> = [];
		const workspaceNames = new Set<string>();
		const workspaceEntries = new Map<string, WorkspaceEntry>();
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
		for (const [key, entry] of Object.entries(raw.packages)) {
			const nameIndex = packageNameIndex(key);
			if (nameIndex !== -1 && entry.link === true) {
				const wsEntry = entry.resolved !== undefined ? raw.packages[entry.resolved] : undefined;
				const name = wsEntry?.name ?? entry.name ?? key.slice(nameIndex);
				if (name !== "") workspaceNames.add(name);
			}
		}

		// Second pass: build packages and workspace entries.
		for (const [key, entry] of Object.entries(raw.packages)) {
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
						...(resolved !== undefined ? { relativePath: resolved } : {}),
						// A workspace link entry is a stub; its manifest sections —
						// peers included — live on the resolved path entry.
						...peerDeclarations(wsEntry?.peerDependencies, wsEntry?.peerDependenciesMeta),
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
					workspaceEntries.set(name, {
						...(wsEntry.dependencies !== undefined ? { dependencies: wsEntry.dependencies } : {}),
						...(wsEntry.devDependencies !== undefined ? { devDependencies: wsEntry.devDependencies } : {}),
						...(wsEntry.peerDependencies !== undefined ? { peerDependencies: wsEntry.peerDependencies } : {}),
						...(wsEntry.optionalDependencies !== undefined ? { optionalDependencies: wsEntry.optionalDependencies } : {}),
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
							...(integrity !== undefined ? { integrity } : {}),
							isWorkspace: false,
							dependencies: entry.dependencies ?? {},
							...peerDeclarations(entry.peerDependencies, entry.peerDependenciesMeta),
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
