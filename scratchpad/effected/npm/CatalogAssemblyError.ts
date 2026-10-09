// The typed failure of catalog *assembly* — reading and validating whatever
// declares a workspace's catalogs — defined here so the `CatalogResolver`
// contract can name it in its error channel and every consumer can branch on
// it without `_tag`-sniffing an untyped defect.
//
// It lives in its own module (rather than beside `CatalogResolver`) for the
// same reason `DependencyResolutionError` lives in `WorkspaceResolver.ts`:
// both resolver modules must be able to reference it without creating an
// import cycle (`noImportCycles` is an error here).

import { Schema } from "effect";

/** The message a cause carries, if it carries a non-empty one: an `Error`'s `message`, or a thrown string. */
const causeMessage = (cause: unknown): string | undefined => {
	const text = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : undefined;
	return text === undefined || text.trim() === "" ? undefined : text;
};

/**
 * Raised when a workspace's catalogs cannot be assembled — a `pnpm-workspace.yaml`
 * that is unreadable or not valid YAML, a root `package.json` `workspaces` field
 * whose shape or catalog blocks are malformed in a way pnpm itself rejects
 * (including the default catalog declared twice), or a config dependency whose
 * `pnpmfile.cjs` cannot be loaded or replayed.
 *
 * @remarks
 * A *missing* `pnpm-workspace.yaml`, an *absent* `workspaces` field, or one
 * explicitly `null` is not an error: there is simply nothing to misread, so
 * assembly yields the empty set. The reader is otherwise **hard-fail by design** —
 * a silently-empty catalog read is the "every dependency looks newly added" bug,
 * because catalog output is load-bearing for snapshot diffing.
 *
 * Defined next to the {@link CatalogResolver} contract that raises it, so a
 * consumer tells an assembly failure from a resolution failure by catching the
 * tag (`Effect.catchTag("CatalogAssemblyError", ...)`) rather than inspecting an
 * untyped defect `cause`.
 *
 * @public
 */
export class CatalogAssemblyError extends Schema.TaggedError<CatalogAssemblyError>()("CatalogAssemblyError", {
	/**
	 * Which input failed: `manifest` for a file-level or top-level shape problem,
	 * `catalog` for a malformed catalog block or the double-default duplication,
	 * `hooks` for a config-dependency `pnpmfile.cjs` load or replay failure.
	 */
	source: Schema.Literals(["manifest", "catalog", "hooks"]),
	/** The file, the catalog name, or the config dependency name. */
	path: Schema.String,
	/** The originating failure. */
	cause: Schema.Defect(),
	/**
	 * Why a `hooks`-source failure could not resolve a config dependency at its
	 * declared version, when that is what failed. Absent for every other
	 * failure, including a pnpmfile that resolved but failed to load or replay.
	 *
	 * - `notInstalled` — the declared version is in neither
	 *   `node_modules/.pnpm-config` nor any pnpm store, and the replaying layer
	 *   does not fetch. Typical of the base side of a diff across a
	 *   config-dependency bump: that side declares a version this checkout never
	 *   installed.
	 * - `ambiguous` — one store holds the declared version more than once, and
	 *   nothing records which copy the declaration pinned.
	 * - `fetchFailed` — the replaying layer tried to fetch the declared version
	 *   into the store and the fetch failed. The package manager's own integrity
	 *   check rejecting the download lands here too.
	 * - `integrityMismatch` — the inline `configDependencies` integrity and the
	 *   lockfile's recorded integrity disagree, so nothing was fetched.
	 * - `integrityUnavailable` — a fetch was needed but the declaring side records
	 *   no integrity to verify it against (no inline integrity, and no lockfile
	 *   entry, or a lockfile that could not be read), so nothing was fetched.
	 */
	reason: Schema.optionalKey(
		Schema.Literals(["notInstalled", "ambiguous", "fetchFailed", "integrityMismatch", "integrityUnavailable"]),
	),
}) {
	/**
	 * Renders the failing source into a one-line summary, followed by the
	 * cause's own message when the cause carries one.
	 *
	 * @remarks
	 * The cause is where the actionable detail lives — which version was
	 * declared, what is installed, which stores were searched, the module a
	 * pnpmfile could not import — so a consumer rendering only `message`, the
	 * normal Effect path, must not lose it. A cause that is itself a
	 * `CatalogAssemblyError` (a nested assembly error) already renders its own
	 * summary, so its message is used as-is rather than prefixed a second time.
	 */
	override get message(): string {
		if (this.cause instanceof CatalogAssemblyError) return this.cause.message;
		const summary = `Failed to assemble catalogs from ${this.source} ${this.path}`;
		const detail = causeMessage(this.cause);
		return detail === undefined ? summary : `${summary}: ${detail}`;
	}
}
