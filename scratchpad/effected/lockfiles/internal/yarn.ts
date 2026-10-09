import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ResolvedPackage } from "../ResolvedPackage.ts";
import { selectSoleDocument } from "./documents.ts";
import type { LockfileFields, ParseFailure, WorkspaceEntry } from "./shared.ts";
import { extractWorkspaceDeps, peerDeclarations, toIntegrityHash, validationFailure } from "./shared.ts";
import * as R from "effect/Record";
import * as O from "@beep/utils/Option";

// ── Raw schemas (permissive validation scaffolding, not API) ───────────────

// The top-level shape must be a string-keyed map. Classic (v1) yarn.lock
// content that happens to YAML-parse produces scalar entry values, which
// fail YarnEntry validation — Berry-only support exits typed either way.
const YarnLockfileRaw = S.Record(S.String, S.Unknown);

const DepRecord = S.optionalKey(S.Record(S.String, S.String));

const YarnEntry = S.Struct({
	version: S.optionalKey(S.String),
	resolution: S.optionalKey(S.String),
	dependencies: DepRecord,
	devDependencies: DepRecord,
	peerDependencies: DepRecord,
	peerDependenciesMeta: S.optionalKey(
		S.Record(S.String, S.Struct({ optional: S.optionalKey(S.Boolean) })),
	),
	optionalDependencies: DepRecord,
	checksum: S.optionalKey(S.String),
	languageName: S.optionalKey(S.String),
	linkType: S.optionalKey(S.String),
	bin: S.optionalKey(S.Unknown),
});

type YarnEntryType = typeof YarnEntry.Type;

const YarnMetadata = S.Struct({
	version: S.optionalKey(S.Union([S.String, S.Finite])),
});

/**
 * Parse yarn Berry `yarn.lock` content into the unified field bundle.
 *
 * Yarn Berry lockfiles are YAML with a flat key structure where each key
 * encodes package name + resolution descriptor(s) (e.g.
 * `"@scope/name@npm:^1.0.0"`); workspace entries carry `linkType: "soft"`.
 *
 * @internal
 */
export const parseYarn = (content: string): Effect.Effect<LockfileFields, ParseFailure> =>
	Effect.gen(function* () {
		// yarn defines no document framing, so a multi-document yarn.lock fails
		// typed rather than being silently truncated to its first document.
		const { document } = yield* selectSoleDocument(content);
		const raw = yield* S.decodeUnknownEffect(YarnLockfileRaw)(document).pipe(Effect.mapError(validationFailure));

		// Extract the lockfile version from __metadata; skip it during iteration.
		const metadata =
			raw.__metadata === undefined
				? undefined
				: yield* S.decodeUnknownEffect(YarnMetadata)(raw.__metadata).pipe(Effect.mapError(validationFailure));
		const lockfileVersion = metadata?.version === undefined ? "unknown" : String(metadata.version);

		// Decode each entry once and cache in a Map.
		const decoded = new Map<string, YarnEntryType>();
		for (const [key, value] of R.toEntries(raw)) {
			if (key === "__metadata") continue;
			const entry = yield* S.decodeUnknownEffect(YarnEntry)(value).pipe(Effect.mapError(validationFailure));
			decoded.set(key, entry);
		}

		return yield* toFields(lockfileVersion, decoded);
	});

// ── Transform ──────────────────────────────────────────────────────────────

const toFields = (
	lockfileVersion: string,
	decoded: ReadonlyMap<string, YarnEntryType>,
): Effect.Effect<LockfileFields, ParseFailure> =>
	Effect.gen(function* () {
		const packages: Array<ResolvedPackage> = [];
		const workspaceNames = new Set<string>();
		const workspaceEntries = new Map<string, WorkspaceEntry>();
		// yarn's own identity is the locator, and its lockfile *is* the
		// descriptor→locator index — every key lists the descriptors that resolve
		// to that entry. Building the index is therefore a read, not a guess.
		const locators = new Map<string, string>();
		for (const [key, entry] of decoded) {
			const descriptors = key.split(", ");
			const locator = entry.resolution ?? descriptors[0];
			if (locator === undefined || locator === "") continue;
			for (const descriptor of descriptors) {
				if (descriptor !== "") locators.set(descriptor, locator);
			}
		}

		// First pass: identify workspace names.
		for (const [key, entry] of decoded) {
			if (entry.linkType === "soft") {
				const name = extractYarnPackageName(key);
				if (name !== undefined) workspaceNames.add(name);
			}
		}

		// Second pass: build packages.
		for (const [key, entry] of decoded) {
			const name = extractYarnPackageName(key);
			if (name === undefined) continue; // malformed descriptors are skipped, never thrown on

			const isWorkspace = entry.linkType === "soft";
			const relativePath = isWorkspace ? extractYarnWorkspacePath(key) : undefined;
			// Yarn Berry's `10c0/<hex>` cache checksums validate as an `IntegrityHash`
			// (the yarn textual form), so they are preserved; a present but unparseable
			// checksum fails typed at validation rather than being dropped.
			const integrity = yield* toIntegrityHash(entry.checksum);
			const instanceId = entry.resolution ?? key.split(", ")[0] ?? "";
			if (instanceId === "") continue; // no identity, no row; skip, never throw

			packages.push(
				ResolvedPackage.make({
					name,
					version: entry.version ?? "0.0.0",
					instanceId,
					...O.getSomesStruct({ integrity: O.fromUndefinedOr(integrity) }),
					isWorkspace,
					...O.getSomesStruct({ relativePath: O.fromUndefinedOr(relativePath) }),
					// Peer ranges are recorded plainly (no `npm:` protocol prefix),
					// so unlike the dependency sections they need no cleaning.
					...peerDeclarations(entry.peerDependencies, entry.peerDependenciesMeta),
					...resolveYarnEdges(entry, locators),
				}),
			);

			if (isWorkspace) {
				const deps = cleanYarnDeps(entry.dependencies);
				const devDeps = cleanYarnDeps(entry.devDependencies);
				const peerDeps = cleanYarnDeps(entry.peerDependencies);
				const optDeps = cleanYarnDeps(entry.optionalDependencies);
				workspaceEntries.set(name, {
					...O.getSomesStruct({ dependencies: O.fromUndefinedOr(deps) }),
					...O.getSomesStruct({ devDependencies: O.fromUndefinedOr(devDeps) }),
					...O.getSomesStruct({ peerDependencies: O.fromUndefinedOr(peerDeps) }),
					...O.getSomesStruct({ optionalDependencies: O.fromUndefinedOr(optDeps) }),
				});
			}
		}

		const workspaceDependencies = extractWorkspaceDeps(workspaceEntries, workspaceNames);

		// yarn does not record importers; the field is always empty.
		return { lockfileVersion, packages, workspaceDependencies, importers: [] };
	});

/**
 * Resolve one entry's outgoing edges through the descriptor→locator index.
 *
 * A yarn dependency value is a *descriptor* range (`"npm:5.3.0"`), and the
 * lockfile keys enumerate exactly which descriptors resolve to which locator,
 * so the lookup is exact rather than reconstructed.
 *
 * **`devDependencies` is not a section a Berry lockfile has.** yarn folds a
 * workspace's dev declarations into the entry's `dependencies` map — the
 * lockfile a project produces is byte-identical whether a dependency is
 * declared under `dependencies` or `devDependencies` (probed against yarn
 * 4.9.1). Dev edges are therefore already resolved here; iterating
 * `entry.devDependencies` would be dead code, and the schema keeps the field
 * only as permissive scaffolding for hand-edited input.
 *
 * **Dependency edges only.** yarn resolves peers virtually — a peer-bearing
 * package gets a `@virtual:` locator per consumer, and this lockfile shape does
 * not record which one satisfied which peer. Emitting a peer edge here would
 * mean guessing, so peers are left out: an absent edge is a true statement, a
 * plausible one would not be.
 *
 * @internal
 */
const resolveYarnEdges = (
	entry: YarnEntryType,
	locators: ReadonlyMap<string, string>,
): { readonly resolved: Record<string, string>; readonly unresolvedEdges: ReadonlyArray<string> } => {
	const edges = new Map<string, string>();
	const unnameable = new Set<string>();
	for (const section of [entry.dependencies, entry.optionalDependencies]) {
		if (section === undefined) continue;
		for (const [name, range] of R.toEntries(section)) {
			if (name === "") continue;
			const locator = locators.get(`${name}@${range}`);
			if (locator !== undefined) edges.set(name, locator);
			// The descriptor IS the recorded edge; a descriptor the key index does
			// not name is an inconsistent lockfile, not an absent dependency.
			else unnameable.add(name);
		}
	}
	// Map-backed until the last step: `Object.fromEntries` defines own data
	// properties, so a "__proto__" dependency name neither pollutes nor drops.
	return { resolved: R.fromEntries(edges), unresolvedEdges: [...unnameable].sort() };
};

/**
 * Extract the package name from a yarn lockfile key. Handles compound keys
 * (`"a@workspace:*, a@workspace:packages/a"`) via the first descriptor and
 * `@patch:` descriptors (which embed `@npm:` inside). Total: malformed keys
 * yield `undefined`.
 *
 * @internal
 */
const extractYarnPackageName = (key: string): string | undefined => {
	const commaIdx = key.indexOf(", ");
	const descriptor = commaIdx === -1 ? key : key.slice(0, commaIdx);
	// @patch: first — it embeds @npm: inside the patch descriptor.
	const patchIdx = descriptor.indexOf("@patch:");
	if (patchIdx > 0) return descriptor.slice(0, patchIdx);
	const npmIdx = descriptor.lastIndexOf("@npm:");
	const wsIdx = descriptor.lastIndexOf("@workspace:");
	const idx = Math.max(npmIdx, wsIdx);
	if (idx <= 0) return undefined;
	return descriptor.slice(0, idx);
};

/**
 * Extract the workspace-relative path from a yarn lockfile key: the segment
 * after `@workspace:` in the first descriptor carrying a non-`*` path.
 *
 * @internal
 */
const extractYarnWorkspacePath = (key: string): string | undefined => {
	for (const desc of key.split(", ")) {
		const wsIdx = desc.lastIndexOf("@workspace:");
		if (wsIdx >= 0) {
			const path = desc.slice(wsIdx + "@workspace:".length);
			if (path !== "" && path !== "*") return path;
		}
	}
	return undefined;
};

/**
 * Strip the `"npm:"` prefix from yarn dependency specifiers.
 *
 * @internal
 */
const cleanYarnDeps = (
	deps: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined => {
	if (deps === undefined) return undefined;
	return R.fromEntries(
		R.toEntries(deps).map(([name, value]) => [name, value.startsWith("npm:") ? value.slice(4) : value]),
	);
};
