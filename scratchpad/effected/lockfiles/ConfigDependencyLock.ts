import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/lockfiles/ConfigDependencyLock");

/**
 * One config dependency a `pnpm-lock.yaml` records, with the integrity pnpm
 * recorded for it — read from the lockfile's env preamble by
 * `PnpmEnvLockfile.configDependencies`.
 *
 * **Details**
 *
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
 *
 * **Example** (Inspect a config dependency checksum)
 *
 * ```ts
 * import { ConfigDependencyLock } from "@beep/scratchpad/effected/lockfiles/ConfigDependencyLock";
 *
 * const dependency = ConfigDependencyLock.make({
 *   name: "@acme/config", specifier: "1.0.0", version: "1.0.0", integrity: "sha512-YWJj",
 * });
 * console.log(dependency.integrity); // sha512-YWJj
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ConfigDependencyLock extends S.Class<ConfigDependencyLock>($I`ConfigDependencyLock`)({
	name: S.String.annotateKey({ description: "Config dependency package recorded in the pnpm lockfile's env preamble" }),
	specifier: S.String.annotateKey({ description: "Config dependency specifier recorded verbatim by pnpm, without the legacy inline integrity suffix" }),
	version: S.String.annotateKey({ description: "Exact config dependency version resolved by pnpm" }),
	integrity: S.String.annotateKey({ description: "SRI checksum recorded in the env preamble for the resolved config dependency package" }),
}, $I.annote("ConfigDependencyLock", { description: "One config dependency a `pnpm-lock.yaml` records, with the integrity pnpm recorded for it — read from the lockfile's env preamble by `PnpmEnvLockfile.configDependencies`." })) {}
