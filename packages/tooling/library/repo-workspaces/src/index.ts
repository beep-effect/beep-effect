/**
 * Monorepo workspace tooling as Effect services: find the workspace root,
 * enumerate its packages, walk the dependency graph, detect the package
 * manager, resolve pnpm catalogs, read the lockfile, and work out which
 * packages a git range touches.
 *
 * **Details**
 *
 * The pure halves live in siblings — `@beep/lockfiles` parses lockfile
 * text, `@beep/glob` matches patterns, `@beep/walker` ascends
 * directories. This package is the part that needs a filesystem and a package
 * manager under it, and it is where `@beep/npm-spec`'s `CatalogResolver` and
 * `WorkspaceResolver` contracts are implemented.
 *
 * **Example** (List workspace package names with Effect services)
 *
 * ```ts
 * import { NodeServices } from "@effect/platform-node";
 * import { WorkspaceDiscovery, Workspaces } from "@beep/repo-workspaces";
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 *
 * const WorkspacesLayer = Workspaces.layer().pipe(Layer.provide(NodeServices.layer));
 *
 * const program = Effect.gen(function* () {
 *   const discovery = yield* WorkspaceDiscovery;
 *   const packages = yield* discovery.listPackages;
 *   return packages.map((pkg) => pkg.name);
 * }).pipe(Effect.provide(WorkspacesLayer));
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
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
  NoPeerDependencyRules,
  type PeerDependencyRules,
} from "./ConfigDependencyHooks.ts";
export { HookReplay, HookReplayContext, HookReplaySource } from "./ConfigDependencyReplay.ts";
export { ConfigDependencySpec, InvalidConfigDependencySpecError } from "./ConfigDependencySpec.ts";
export { CyclicDependencyError, DependencyGraph } from "./DependencyGraph.ts";
export {
  Dependent,
  DuplicateCheck,
  type DuplicateCheckOptions,
  DuplicatedPackage,
  DuplicatedVersion,
  DuplicateInstance,
} from "./DuplicateCheck.ts";
export {
  LockfileReadError,
  LockfileReader,
  type LockfileReaderOptions,
  type LockfileReaderShape,
  type LockfileReadFailure,
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
export { PublishabilityDetector, type PublishabilityDetectorShape, PublishTarget } from "./Publishability.ts";
export {
  classifyTag,
  ReleaseTag,
  ReleaseTagClassification,
  type TagClassification,
  type TagFormatOptions,
  TagStyle,
  TrackingTag,
  TrackingTagClassification,
  type TrackingTagOptions,
  UnrecognizedTagClassification,
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
  WorkspacePatternReadError,
  WorkspacePatternReadFailureKind,
  WorkspacePatterns,
} from "./WorkspacePatterns.ts";
export {
  type FindWorkspaceRootOptions,
  WORKSPACE_MARKERS,
  WorkspaceRoot,
  WorkspaceRootNotFoundError,
  type WorkspaceRootShape,
} from "./WorkspaceRoot.ts";
export {
  type WorkspaceSnapshotAtFailure,
  WorkspaceSnapshots,
  type WorkspaceSnapshotsOptions,
  type WorkspaceSnapshotsShape,
  type WorkspaceSnapshotWorktreeFailure,
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
  findWorkspaceRootSync,
  type GetWorkspacePackagesSyncOptions,
  getWorkspacePackagesSync,
  type SyncDirectoryEntry,
  SyncEnumerationBound,
  type SyncEnumerationObserver,
  type SyncFileSystem,
  type SyncPath,
  SyncRootCeiling,
  type WorkspaceDiscoverySkip,
  type WorkspaceDiscoverySkipKind,
  WorkspaceEnumerationDepthError,
  type WorkspacesSyncOptions,
} from "./WorkspacesSync.ts";
