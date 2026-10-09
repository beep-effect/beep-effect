import { Effect, Option } from "effect";
import type { ConfigDependencyLock } from "./ConfigDependencyLock.ts";
import { readPnpmConfigDependencies, readPnpmPackageManager } from "./internal/pnpmEnv.ts";
import type { ParseFailure } from "./internal/shared.ts";
import type { LockfileFramingError, LockfileParseError } from "./Lockfile.ts";
import { materializeFailure } from "./Lockfile.ts";
import type { PackageManagerLock } from "./PackageManagerLock.ts";

/** Both readers surface an internal `ParseFailure` the one way `Lockfile.parse` does. */
const materialize = Effect.mapError((failure: ParseFailure) => materializeFailure("pnpm", failure));

const packageManager = Effect.fn("PnpmEnvLockfile.packageManager")((content: string) =>
	readPnpmPackageManager(content).pipe(materialize, Effect.map(Option.fromUndefinedOr)),
);

const configDependencies = Effect.fn("PnpmEnvLockfile.configDependencies")((content: string) =>
	readPnpmConfigDependencies(content).pipe(materialize),
);

/**
 * Readers over the env ("preamble") document of a `pnpm-lock.yaml`.
 *
 * @remarks
 * A `pnpm-lock.yaml` is a YAML stream. When a workspace declares
 * `devEngines.packageManager` or `configDependencies`, pnpm writes an env
 * preamble document ahead of the lockfile proper: the preamble is always the
 * **first** of two documents, the lockfile always the **last**.
 * `Lockfile.parse` reads the last; these readers read the first.
 *
 * @public
 */
export interface PnpmEnvLockfileReaders {
	/**
	 * Read the package manager a `pnpm-lock.yaml` pins, with its recorded
	 * integrity. Pure: takes the lockfile text, performs no IO.
	 *
	 * @param content - The `pnpm-lock.yaml` text.
	 * @returns `Option.none()` when the lockfile records no package manager —
	 *   a single-document lockfile (no preamble; pnpm writes none for a
	 *   workspace declaring neither `devEngines.packageManager` nor
	 *   `configDependencies`), or a preamble whose root importer declares no
	 *   `pnpm` in `packageManagerDependencies`. Otherwise `Option.some` of the
	 *   {@link PackageManagerLock}.
	 *
	 * Fails with {@link LockfileParseError} when the text is not well-formed
	 * YAML (`stage: "syntax"`), or when the preamble is malformed or records a
	 * claim it cannot back (`stage: "validation"`): `pnpm@<version>` with no
	 * `packages` entry, snapshot or SRI integrity, or a native optional
	 * dependency with no SRI integrity. A lockfile that names a version it
	 * cannot account for is a failure, never `none`. Fails with
	 * {@link LockfileFramingError} (`reason: "unexpectedDocuments"`) when the
	 * stream carries more than two documents, since no position then
	 * identifies the preamble.
	 */
	readonly packageManager: (
		content: string,
	) => Effect.Effect<Option.Option<PackageManagerLock>, LockfileParseError | LockfileFramingError>;

	/**
	 * Read the config dependencies a `pnpm-lock.yaml` records, each with its
	 * recorded integrity. Pure: takes the lockfile text, performs no IO.
	 *
	 * @remarks
	 * The integrity source for a `configDependencies` entry written as a bare
	 * version: pnpm 11 and 12 keep it here rather than inline in
	 * `pnpm-workspace.yaml`. Read by `@effected/workspaces` to verify a config
	 * dependency it fetches at a version this checkout never installed.
	 *
	 * @param content - The `pnpm-lock.yaml` text.
	 * @returns A map keyed by config-dependency name. Empty when the lockfile
	 *   records none — a single-document lockfile (no preamble), or a preamble
	 *   whose root importer declares no `configDependencies`.
	 *
	 * Fails exactly as {@link PnpmEnvLockfileReaders.packageManager} does, with
	 * {@link LockfileParseError} for broken YAML (`stage: "syntax"`) or a
	 * malformed preamble (`stage: "validation"`), and with
	 * {@link LockfileFramingError} (`reason: "unexpectedDocuments"`) for more
	 * than two documents. A recorded entry the lockfile cannot back fails at
	 * `stage: "validation"`: an empty version, or a `<name>@<version>` with no
	 * `packages` entry, no `resolution.integrity`, or an integrity that is not
	 * SRI. An entry is never silently dropped.
	 */
	readonly configDependencies: (
		content: string,
	) => Effect.Effect<ReadonlyMap<string, ConfigDependencyLock>, LockfileParseError | LockfileFramingError>;
}

/**
 * Readers over the env ("preamble") document of a `pnpm-lock.yaml` — see
 * {@link PnpmEnvLockfileReaders}.
 *
 * @example
 * ```typescript
 * import { PnpmEnvLockfile } from "./index.ts";
 * import { Effect, Option } from "effect";
 *
 * declare const content: string; // the text of a pnpm-lock.yaml
 *
 * const program = Effect.gen(function* () {
 *   const lock = yield* PnpmEnvLockfile.packageManager(content);
 *   const configDependencies = yield* PnpmEnvLockfile.configDependencies(content);
 *   return {
 *     pnpm: Option.map(lock, (pm) => pm.integrity),
 *     plugin: configDependencies.get("@effected/pnpm-plugin-effect")?.integrity,
 *   };
 * });
 * ```
 *
 * @public
 */
export const PnpmEnvLockfile: PnpmEnvLockfileReaders = { packageManager, configDependencies };
