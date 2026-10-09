import { dual } from "effect/Function";
// The importer → instance join shared by every walk over a parsed lockfile
// (`PeerCheck`, `DuplicateCheck`). One implementation, so the two checks cannot
// disagree about which importers are answerable, and so the root-importer
// limitation (npm and bun record no per-importer resolved version) is measured
// and reported in exactly one place.
//
// `instanceId` is OPAQUE here — composed and looked up, never parsed.

import type { Lockfile, ResolvedPackage } from "../../lockfiles/index.ts";

/** The two lookups every walk needs, built once per lockfile. */
export interface InstanceIndex {
	/** Every instance by its `instanceId`. */
	readonly byId: ReadonlyMap<string, ResolvedPackage>;
	/** Workspace rows by the importer path they stand for. */
	readonly workspaceByPath: ReadonlyMap<string, ResolvedPackage>;
}

export const indexInstances = (lockfile: Lockfile): InstanceIndex => {
	const byId = new Map(lockfile.packages.map((pkg) => [pkg.instanceId, pkg]));
	const workspaceByPath = new Map<string, ResolvedPackage>();
	for (const pkg of lockfile.packages) {
		if (pkg.isWorkspace && pkg.relativePath !== undefined) workspaceByPath.set(pkg.relativePath, pkg);
	}
	return { byId, workspaceByPath };
};

/**
 * Where an importer's walk starts.
 *
 * - `"own"` — the lockfile records a workspace row for the importer. The row
 *   carries both its declared peers (npm, bun) and its resolved edges, so it is
 *   the walk's first node and its edges ARE the importer's dependencies.
 * - `"dependencies"` — no row (the root under every format, and any importer
 *   whose row the lockfile omits); the instances are what the importer entry's
 *   own dependency records joined to.
 */
export type ImporterRoots =
	| { readonly _tag: "own"; readonly instance: ResolvedPackage }
	| { readonly _tag: "dependencies"; readonly instances: ReadonlyArray<ResolvedPackage> };

/**
 * The instances an importer's dependencies resolved to, or the importer's own
 * workspace row when the lockfile records one.
 *
 * Returns `undefined` when the importer cannot be resolved at all, which every
 * caller reports rather than treating as "no problems here".
 */
export const rootInstances: {
	(importerPath: string, index: InstanceIndex): (lockfile: Lockfile) => ImporterRoots | undefined;
	(lockfile: Lockfile, importerPath: string, index: InstanceIndex): ImporterRoots | undefined;
} = dual(3, (
	lockfile: Lockfile,
	importerPath: string,
	index: InstanceIndex,
): ImporterRoots | undefined => {
	const own = index.workspaceByPath.get(importerPath);
	if (own !== undefined) return { _tag: "own", instance: own };

	const importer = lockfile.importer(importerPath);
	if (importer._tag === "None") return undefined;

	const instances: Array<ResolvedPackage> = [];
	let resolvable = false;
	for (const dep of importer.value.dependencies) {
		if (dep.version === undefined) continue;

		// Compose the identity the importer entry describes, then VERIFY it
		// against the real id set — the same compose-then-verify rule the
		// lockfile's own edge resolution follows. A composed string matching
		// nothing is discarded and the dependency is skipped; there is no
		// name-and-version fallback, because guessing between two peer variants
		// of one name@version would attribute one variant's facts to an importer
		// that resolved the other, and a fabricated finding is worse than a
		// missing one.
		//
		// This is not parsing an instanceId: nothing is split, indexed or
		// pattern-matched. `peerSuffix` is a field the lockfile hands us
		// precisely because a version alone cannot name a peer-resolved
		// instance, and dropping it is what made the root importer of a
		// workspace with two peer variants silently unanswerable.
		const composed = index.byId.get(`${dep.name}@${dep.version}${dep.peerSuffix ?? ""}`);
		if (composed === undefined) continue;
		resolvable = true;
		instances.push(composed);
	}

	// An importer with no dependencies at all is legitimately clean, not
	// unresolvable; one whose every dependency failed to join is not.
	if (!resolvable && importer.value.dependencies.length > 0) return undefined;
	return { _tag: "dependencies", instances };
});
