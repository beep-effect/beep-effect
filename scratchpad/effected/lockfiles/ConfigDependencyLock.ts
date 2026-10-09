import { Schema } from "effect";

/**
 * One config dependency a `pnpm-lock.yaml` records, with the integrity pnpm
 * recorded for it — read from the lockfile's env preamble by
 * `PnpmEnvLockfile.configDependencies`.
 *
 * @remarks
 * pnpm 11 and 12 record each `configDependencies` entry of
 * `pnpm-workspace.yaml` as the root importer's `configDependencies` in the env
 * preamble document, and its integrity in the preamble's `packages:` section.
 * A workspace that writes its `configDependencies` as bare versions keeps the
 * integrity only here, which makes the lockfile the checksum store for its
 * config dependencies, as it is for the package manager
 * (`PackageManagerLock`).
 *
 * - `name` — the config dependency's package name.
 * - `specifier` — the specifier pnpm recorded, verbatim. pnpm records the bare
 *   version even when `pnpm-workspace.yaml` declares the legacy inline
 *   `<version>+<integrity>` form.
 * - `version` — the exact version pnpm resolved the specifier to.
 * - `integrity` — the SRI integrity (`sha512-<base64>`) of
 *   `<name>@<version>`.
 *
 * @public
 */
export class ConfigDependencyLock extends Schema.Class<ConfigDependencyLock>("ConfigDependencyLock")({
	name: Schema.String,
	specifier: Schema.String,
	version: Schema.String,
	integrity: Schema.String,
}) {}
