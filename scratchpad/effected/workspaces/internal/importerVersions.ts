import { dual } from "effect/Function";
// The lockfile-importer fallback for `catalog:` specifiers a snapshot's catalog
// set cannot resolve.
//
// Why this exists: a `catalog:` specifier injected by a pnpm config-dependency
// pnpmfile hook is recorded in NEITHER committed source a snapshot reads — not
// `pnpm-workspace.yaml` (the workspace declares no such catalog) and not the
// lockfile's `catalogs:` block (pnpm does not record a peer-only catalog). Both
// sides of a before/after diff then resolve it to the same unresolvable raw
// string, so a genuine version movement produces no row and no changeset.
//
// The fix reads what IS committed: each importer's own `{ specifier, version }`
// entries, which record the concrete version pnpm actually installed. Both
// lockfiles are committed, so `at(ref)` and `worktree()` answer identically —
// no hook replay, no network, no executing a historical ref's code.

import type { Lockfile } from "../../lockfiles/index.ts";
import * as R from "effect/Record";
import * as O from "effect/Option";
import * as MutableHashMap from "effect/MutableHashMap";

/**
 * One importer's dependency-name → resolved-version map, keyed by importer path.
 *
 * Structural on purpose: the public alias of this shape is `ImporterVersions`,
 * declared beside the service member that returns it in `WorkspaceCatalogs.ts`.
 * Naming it there rather than here keeps a `@public` type out of `internal/`
 * without an import cycle between the two modules.
 *
 * @internal
 */
type VersionIndex = Readonly<Record<string, Readonly<Record<string, string>>>>;

/**
 * Strip pnpm's peer-disambiguation suffix from a recorded importer version.
 *
 * pnpm records an importer version as the resolved version followed by the peer
 * context it was resolved under — `4.0.0(effect@4.0.0)(ioredis@5.11.1(supports-color@8.1.1))`.
 * `@effected/lockfiles` stores that string verbatim (its `packages:` key parser
 * strips the suffix; the importer entries deliberately keep it), so the raw
 * value must never reach a consumer's dependency table — it would render the
 * whole parenthesized chain as the "version" a dependency moved to.
 *
 * Everything from the first `(` is dropped; a version with no suffix passes
 * through untouched.
 */
const stripPeerSuffix = (version: string): string => {
	const paren = version.indexOf("(");
	return paren === -1 ? version : version.slice(0, paren);
};

/**
 * Whether a recorded importer version is a concrete version usable as a
 * resolution answer.
 *
 * A `link:` / `file:` entry records a filesystem edge rather than a version, and
 * an empty string is pnpm's "specifier only, nothing installed" marker. Both
 * would be worse than no answer at all: the fallback exists to report a concrete
 * version movement, and reporting `link:../foo` as a version is noise a
 * changeset would carry into release notes.
 */
const isConcreteVersion = (version: string): boolean =>
	version.length > 0 && !version.startsWith("link:") && !version.startsWith("file:");

/**
 * Build the importer-path → dependency-name → version index a snapshot uses to
 * answer `catalog:` specifiers its catalog set cannot resolve.
 *
 * @remarks
 * Keyed by **name only** within each importer, deliberately across every
 * dependency field. The bug this fixes is a peer declared `catalog:effect:peers`
 * whose importer records no `peerDependencies` entry at all — pnpm writes peer
 * declarations into the importer block only when they are also installed, so the
 * concrete version lives on the package's `devDependencies` row for the same
 * name. Joining by name across fields is what finds it; joining by field, or by
 * matching the recorded specifier, would not.
 *
 * Only pnpm populates importer versions; bun and npm record resolved versions on
 * their package entries instead, so those formats yield an empty index and the
 * fallback is inert for them.
 */
export const importerVersionsOf = (lockfile: Lockfile): VersionIndex => {
	const index = MutableHashMap.empty<string, Record<string, string>>();
	for (const importer of lockfile.importers) {
		const versions = MutableHashMap.empty<string, string>();
		for (const dependency of importer.dependencies) {
			const recorded = dependency.version;
			if (recorded === undefined) continue;
			const version = stripPeerSuffix(recorded);
			if (!isConcreteVersion(version)) continue;
			// First field wins only when a later one disagrees; pnpm records the same
			// resolved version across every field that declares the dependency, so a
			// conflict here is a malformed lockfile rather than a real ambiguity.
			if (!MutableHashMap.has(versions, dependency.name)) MutableHashMap.set(versions, dependency.name, version);
		}
		MutableHashMap.set(index, importer.path, R.fromEntries(versions));
	}
	return R.fromEntries(index);
};

/**
 * The version every importer agrees `dependency` resolved to, or `undefined`
 * when they disagree or none record it.
 *
 * @remarks
 * The unambiguity rule is what makes a workspace-wide answer safe from a
 * snapshot method that receives no importer context. Two packages in one
 * monorepo may legitimately hold different versions of the same dependency; in
 * that case there is no single correct answer, so this yields nothing and the
 * caller keeps today's behavior (no row) rather than inventing a wrong one.
 */
export const unanimousVersionOf: {
	(dependency: string): (index: VersionIndex) => string | undefined;
	(index: VersionIndex, dependency: string): string | undefined;
} = dual(2, (index: VersionIndex, dependency: string): string | undefined => {
	let agreed: string | undefined;
	for (const versions of R.values(index)) {
		const version = O.getOrUndefined(R.get(versions, dependency));
		if (version === undefined) continue;
		if (agreed === undefined) {
			agreed = version;
			continue;
		}
		if (agreed !== version) return undefined;
	}
	return agreed;
});
