/**
 * Monorepo workspace tooling as Effect services: find the workspace root,
 * enumerate its packages, walk the dependency graph, detect the package
 * manager, resolve pnpm catalogs, read the lockfile, and work out which
 * packages a git range touches.
 *
 * The pure halves live in siblings — `@effected/lockfiles` parses lockfile
 * text, `@effected/glob` matches patterns, `@effected/walker` ascends
 * directories. This package is the part that needs a filesystem and a package
 * manager under it, and it is where `@effected/npm`'s `CatalogResolver` and
 * `WorkspaceResolver` contracts are implemented.
 *
 * @example
 * ```ts
 * import { NodeServices } from "@effect/platform-node";
 * import { WorkspaceDiscovery, Workspaces } from "./index.ts";
 * import { Effect, Layer } from "effect";
 *
 * const WorkspacesLayer = Workspaces.layer().pipe(Layer.provide(NodeServices.layer));
 *
 * const program = Effect.gen(function* () {
 *   const discovery = yield* WorkspaceDiscovery;
 *   const packages = yield* discovery.listPackages();
 *   return packages.map((pkg) => pkg.name);
 * }).pipe(Effect.provide(WorkspacesLayer));
 * ```
 *
 * @packageDocumentation
 */

export {
	ChangeDetectionError,
	type ChangeDetectionFailure,
	ChangeDetectionOptions,
	ChangeDetector,
	type ChangeDetectorShape,
} from "./ChangeDetector.ts";
export {
	ConfigDependencyHooks,
	type ConfigDependencyHooksShape,
	type HookInjection,
	type HookReplay,
	type HookReplayContext,
	type HookReplaySource,
	NoPeerDependencyRules,
	type PeerDependencyRules,
} from "./ConfigDependencyHooks.ts";
export { ConfigDependencySpec, InvalidConfigDependencySpecError } from "./ConfigDependencySpec.ts";
export { CyclicDependencyError, DependencyGraph } from "./DependencyGraph.ts";
export {
	Dependent,
	DuplicateCheck,
	type DuplicateCheckOptions,
	DuplicateInstance,
	DuplicatedPackage,
	DuplicatedVersion,
} from "./DuplicateCheck.ts";
export {
	LockfileReadError,
	type LockfileReadFailure,
	LockfileReader,
	type LockfileReaderOptions,
	type LockfileReaderShape,
} from "./LockfileReader.ts";
export {
	DetectedPackageManager,
	PackageManagerDetectionError,
	type PackageManagerDetectionFailure,
	PackageManagerDetector,
	type PackageManagerDetectorShape,
	PackageManagerEvidence,
	PackageManagerName,
} from "./PackageManagerName.ts";
export {
	PeerCheck,
	type PeerCheckOptions,
	PeerParent,
	UnsatisfiedPeer,
	type UnverifiedReason,
} from "./PeerCheck.ts";
export { PublishTarget, PublishabilityDetector, type PublishabilityDetectorShape } from "./Publishability.ts";
export {
	ReleaseTag,
	type TagClassification,
	type TagFormatOptions,
	TagStyle,
	TrackingTag,
	type TrackingTagOptions,
	classifyTag,
} from "./ReleaseTag.ts";
export {
	type ClassifyOptions,
	type PackageRelease,
	type VersioningDetectOptions,
	VersioningStrategy,
	VersioningStrategyType,
} from "./VersioningStrategy.ts";
export {
	type CatalogAssemblyFailure,
	CatalogSet,
	type ImporterVersions,
	WorkspaceCatalogs,
	type WorkspaceCatalogsOptions,
	type WorkspaceCatalogsShape,
} from "./WorkspaceCatalogs.ts";
export {
	PackageNotFoundError,
	WorkspaceDiscovery,
	WorkspaceDiscoveryError,
	type WorkspaceDiscoveryFailure,
	type WorkspaceDiscoveryOptions,
	type WorkspaceDiscoveryShape,
	WorkspaceInfo,
	type WorkspaceLookupFailure,
	WorkspacePatternError,
} from "./WorkspaceDiscovery.ts";
export { type DependencyDiff, PublishConfig, WorkspaceManifestError, WorkspacePackage } from "./WorkspacePackage.ts";
export {
	type FindWorkspaceRootOptions,
	WORKSPACE_MARKERS,
	WorkspaceRoot,
	WorkspaceRootNotFoundError,
	type WorkspaceRootShape,
} from "./WorkspaceRoot.ts";
export {
	type WorkspaceSnapshotAtFailure,
	type WorkspaceSnapshotWorktreeFailure,
	WorkspaceSnapshots,
	type WorkspaceSnapshotsOptions,
	type WorkspaceSnapshotsShape,
} from "./WorkspaceSnapshots.ts";
export { PackageStateSnapshot, WorkspaceStateSnapshot } from "./WorkspaceStateSnapshot.ts";
export {
	Workspaces,
	type WorkspacesGitOptions,
	type WorkspacesOptions,
	type WorkspacesServices,
} from "./Workspaces.ts";
export {
	type FindWorkspaceRootSyncOptions,
	type GetWorkspacePackagesSyncOptions,
	type SyncDirectoryEntry,
	type SyncFileSystem,
	type SyncPath,
	type WorkspaceDiscoverySkip,
	type WorkspaceDiscoverySkipKind,
	type WorkspacesSyncOptions,
	findWorkspaceRootSync,
	getWorkspacePackagesSync,
} from "./WorkspacesSync.ts";
