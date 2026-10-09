/**
 * Pure lockfile parsing for all four package-manager formats — bun
 * (`bun.lock`), npm (`package-lock.json`), pnpm (`pnpm-lock.yaml`)
 * and yarn Berry (`yarn.lock`) — normalized into one unified `Lockfile`
 * model, plus pure integrity checking of that model against workspace
 * manifests.
 *
 * Supported lockfile *format* versions are pnpm `lockfileVersion` 9+ and npm
 * `lockfileVersion` 3+; older formats fail typed rather than parsing into a
 * model that cannot answer resolution questions.
 *
 * `PnpmEnvLockfile.packageManager` reads the package manager a
 * `pnpm-lock.yaml` pins, with its recorded integrity, out of the env preamble
 * document pnpm writes ahead of the lockfile, and
 * `PnpmEnvLockfile.configDependencies` the config dependencies it records,
 * each with its integrity.
 *
 * Every entrypoint takes content as a string; this package performs no IO.
 *
 * @example
 * ```typescript
 * import { Lockfile } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * declare const content: string; // the text of a pnpm-lock.yaml
 *
 * const program = Effect.gen(function* () {
 *   const lockfile = yield* Lockfile.parse(content, { format: "pnpm" });
 *   return lockfile.workspacePackages.length;
 * });
 * ```
 *
 * @packageDocumentation
 */

export { BunExtension } from "./BunExtension.ts";
export { ConfigDependencyLock } from "./ConfigDependencyLock.ts";
export { ImporterDependency } from "./ImporterDependency.ts";
export { Lockfile, LockfileFramingError, LockfileParseError } from "./Lockfile.ts";
export { LockfileFormat, filenameFor, filenamesFor, fromFilename } from "./LockfileFormat.ts";
export { LockfileImporter } from "./LockfileImporter.ts";
export { LockfileIntegrity, WorkspaceManifest } from "./LockfileIntegrity.ts";
export { PackageManagerLock } from "./PackageManagerLock.ts";
export { PnpmEnvLockfile, type PnpmEnvLockfileReaders } from "./PnpmEnvLockfile.ts";
export { type PnpmCatalogs, PnpmExtension } from "./PnpmExtension.ts";
export { ResolvedPackage } from "./ResolvedPackage.ts";
export { type UnsupportedLockfileVersion, isUnsupportedLockfileVersion } from "./UnsupportedLockfileVersion.ts";
export { WorkspaceDependency } from "./WorkspaceDependency.ts";
