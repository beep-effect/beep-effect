import * as Layer from "effect/Layer";
import { CatalogResolver } from "./CatalogResolver.ts";
import { WorkspaceResolver } from "./WorkspaceResolver.ts";

export { CatalogAssemblyError } from "./CatalogAssemblyError.ts";
export { CatalogResolver } from "./CatalogResolver.ts";
export {
	DependencyField,
	DependencyKind,
	DependencySection,
} from "./DependencySection.ts";
export {
	CatalogSpecifier,
	type ClassifiedSpecifier,
	type DependencyProtocol,
	DependencySpecifier,
	type DependencySpecifierBrand,
	DistTagSpecifier,
	InvalidDependencySpecifierError,
	RangeSpecifier,
	RawSpecifier,
	WorkspaceSpecifier,
	isValidDependencySpecifier,
} from "./DependencySpecifier.ts";
export {
	CorepackIntegrityHash,
	type IntegrityAlgorithm,
	IntegrityHash,
	type IntegrityHashBrand,
	InvalidIntegrityHashError,
	InvalidSriIntegrityHashError,
	SriIntegrityHash,
	isValidIntegrityHash,
} from "./IntegrityHash.ts";
export {
	Manifest,
	ManifestDecodeError,
	UnresolvedDependencyError,
} from "./Manifest.ts";
export { NpmExecutor } from "./NpmExecutor.ts";
// Free-standing named exports, never gathered into a namespace object: a
// consumer that imports only the pure vocabulary (IntegrityHash, the
// specifier) must not link the HTTP client this module reaches. A namespace
// object is one live binding and would retain the whole graph — the
// config-file codec hazard, one package over.
export {
	DEFAULT_REGISTRY,
	NpmRegistry,
	type NpmRegistryShape,
	PublishTime,
	PublishedVersion,
	RegistryReadError,
	type RegistrySeed,
	type RegistryTarget,
	type SeededVersion,
} from "./NpmRegistry.ts";
export {
	CachingPackageManager,
	type DefaultCacheDirectoryOptions,
	PackageManagerCache,
} from "./PackageManagerCache.ts";
export {
	InvalidPackageManagerPinError,
	PackageManagerPin,
	PackageManagerPinName,
} from "./PackageManagerPin.ts";
export {
	type DryRunOutcome,
	type PackOptions,
	PackagePublish,
	type PackagePublishShape,
	PackedTarball,
	type PublishOptions,
	type PublishOutcome,
} from "./PackagePublish.ts";
export { PackageTarball, type PackageTarballShape, TarballError } from "./PackageTarball.ts";
export { PublishError } from "./PublishError.ts";
export {
	type BasicCredential,
	type RegistryCredential,
	type TokenCredential,
	basicCredentialFromPair,
} from "./RegistryCredential.ts";
export {
	RegistryKind,
	classifyRegistry,
	registryDisplayName,
	registryHost,
	registryShortLabel,
} from "./RegistryKind.ts";
export { PartialReleaseAgeGate, ReleaseAgeGate } from "./ReleaseAgeGate.ts";
export { DependencyResolutionError, WorkspaceResolver } from "./WorkspaceResolver.ts";

/**
 * Composite no-op default layer merging {@link CatalogResolver.noop} and
 * {@link WorkspaceResolver.noop}. Provide it once at the application boundary
 * when a consumer only needs the resolver contracts to type-check while
 * resolving nothing (both `rangeOf` and `versionOf` return `Option.none()`).
 *
 * Bound to a const so it memoizes by reference — never expose it through a
 * getter, which would mint a fresh layer per access and defeat memoization.
 *
 * @example
 * ```ts
 * import { Effect, Option } from "effect";
 * import { CatalogResolver, Default, WorkspaceResolver } from "./index.ts";
 *
 * const program = Effect.gen(function* () {
 *   const catalog = yield* CatalogResolver;
 *   const workspace = yield* WorkspaceResolver;
 *   return yield* Effect.all([
 *     catalog.rangeOf("effect", Option.none()),
 *     workspace.versionOf("@effected/semver"),
 *   ]);
 * });
 *
 * Effect.runPromise(Effect.provide(program, Default));
 * // => [Option.none(), Option.none()]
 * ```
 *
 * @public
 */
export const Default: Layer.Layer<CatalogResolver | WorkspaceResolver> = Layer.mergeAll(
	CatalogResolver.noop,
	WorkspaceResolver.noop,
);
