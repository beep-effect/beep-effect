/**
 * Resolver orchestration service for version-sync.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { Context, Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  VersionCategoryStatus,
  VersionSyncReport,
  VersionSyncResolution,
  VersionSyncUpdateLocation,
} from "../../VersionSync.schemas.ts";
import { BiomeSchemaState, buildBiomeReport, resolveBiomeSchema } from "../resolvers/BiomeResolver.ts";
import { BunVersionState, buildBunReport, resolveBunVersions } from "../resolvers/BunResolver.ts";
import { buildDockerReport, DockerImageState, resolveDockerImages } from "../resolvers/DockerResolver.ts";
import { buildEffectReport, EffectCatalogState, resolveEffectCatalog } from "../resolvers/EffectResolver.ts";
import { buildNodeReport, resolveNodeVersions } from "../resolvers/NodeResolver.ts";
import { buildTurboReport, resolveTurboSchema, TurboSchemaState } from "../resolvers/TurboResolver.ts";
import { CategorySelectionService } from "./CategorySelectionService.ts";
import type { FsUtils } from "@beep/repo-utils";
import type { FileSystem, Path } from "effect";
import type { HttpClient } from "effect/unstable/http";
import type { VersionCategoryReport, VersionSyncError, VersionSyncOptions } from "../../VersionSync.schemas.ts";

const $I = $RepoCliId.create("commands/VersionSync/internal/services/ResolverService");
const versionCategoryStatusEquivalence = S.toEquivalence(VersionCategoryStatus);

type ResolverEnvironment =
  | FileSystem.FileSystem
  | Path.Path
  | HttpClient.HttpClient
  | FsUtils
  | CategorySelectionService;

/**
 * Service contract for resolving version drift state.
 *
 * @category models
 * @since 0.0.0
 */
export type ResolverServiceShape = {
  readonly resolve: (
    repoRoot: string,
    options: VersionSyncOptions
  ) => Effect.Effect<VersionSyncResolution, VersionSyncError, ResolverEnvironment>;
};

/**
 * Service tag for resolver orchestration.
 *
 * @category ports
 * @since 0.0.0
 */
export class ResolverService extends Context.Service<ResolverService, ResolverServiceShape>()($I`ResolverService`) {}

/**
 * Run a category resolver, degrading to its empty state with a warning when it fails.
 */
const resolveOrEmpty = <State>(
  label: string,
  resolution: Effect.Effect<State, VersionSyncError, ResolverEnvironment>,
  empty: State
): Effect.Effect<State, never, ResolverEnvironment> =>
  resolution.pipe(
    Effect.catchTag(
      "VersionSyncError",
      Effect.fn(function* (error) {
        yield* Effect.logWarning(`${label} resolution failed: ${error.message}`);
        return empty;
      })
    )
  );

const resolveBunCategory = Effect.fn(function* (repoRoot: string, options: VersionSyncOptions) {
  const bunState = yield* resolveOrEmpty(
    "Bun",
    resolveBunVersions(repoRoot, options.skipNetwork),
    BunVersionState.make({})
  );

  return Str.isNonEmpty(bunState.bunVersionFile) ? O.some(buildBunReport(bunState)) : O.none<VersionCategoryReport>();
});

const resolveNodeCategory = Effect.fn(function* (repoRoot: string) {
  const nodeState = yield* resolveNodeVersions(repoRoot);

  const locations = A.map(
    A.filter(nodeState.workflowLocations, (location) => !Str.equivalence(location.currentValue, nodeState.nvmrc)),
    (location) =>
      VersionSyncUpdateLocation.make({
        file: location.file,
        yamlPath: location.yamlPath,
      })
  );

  return { report: buildNodeReport(nodeState), locations };
});

const resolveDockerCategory = Effect.fn(function* (repoRoot: string, options: VersionSyncOptions) {
  const dockerState = yield* resolveOrEmpty(
    "Docker",
    resolveDockerImages(repoRoot, options.skipNetwork),
    DockerImageState.make({})
  );

  return buildDockerReport(dockerState);
});

const resolveBiomeCategory = Effect.fn(function* (repoRoot: string) {
  const biomeState = yield* resolveOrEmpty("Biome schema", resolveBiomeSchema(repoRoot), BiomeSchemaState.make({}));

  return Str.isNonEmpty(biomeState.installedVersion)
    ? O.some(buildBiomeReport(biomeState))
    : O.none<VersionCategoryReport>();
});

const resolveEffectCategory = Effect.fn(function* (repoRoot: string) {
  const effectState = yield* resolveOrEmpty(
    "Effect catalog",
    resolveEffectCatalog(repoRoot),
    EffectCatalogState.make({})
  );

  return buildEffectReport(effectState);
});

const resolveTurboCategory = Effect.fn(function* (repoRoot: string) {
  const turboState = yield* resolveOrEmpty("Turbo schema", resolveTurboSchema(repoRoot), TurboSchemaState.make({}));

  return Str.isNonEmpty(turboState.installedVersion)
    ? O.some(buildTurboReport(turboState))
    : O.none<VersionCategoryReport>();
});

const resolve: ResolverServiceShape["resolve"] = Effect.fn(function* (repoRoot, options) {
  const categorySelection = yield* CategorySelectionService;
  let categories = A.empty<VersionCategoryReport>();
  let nodeLocations = A.empty<VersionSyncUpdateLocation>();

  if (categorySelection.shouldCheck(options, "bun")) {
    categories = A.appendAll(categories, A.fromOption(yield* resolveBunCategory(repoRoot, options)));
  }

  if (categorySelection.shouldCheck(options, "node")) {
    const node = yield* resolveNodeCategory(repoRoot);
    categories = A.append(categories, node.report);
    nodeLocations = node.locations;
  }

  if (categorySelection.shouldCheck(options, "docker")) {
    categories = A.append(categories, yield* resolveDockerCategory(repoRoot, options));
  }

  if (categorySelection.shouldCheck(options, "biome")) {
    categories = A.appendAll(categories, A.fromOption(yield* resolveBiomeCategory(repoRoot)));
  }

  if (categorySelection.shouldCheck(options, "effect")) {
    categories = A.append(categories, yield* resolveEffectCategory(repoRoot));
  }

  if (categorySelection.shouldCheck(options, "turbo")) {
    categories = A.appendAll(categories, A.fromOption(yield* resolveTurboCategory(repoRoot)));
  }

  const report = VersionSyncReport.make({
    categories,
    hasDrift: A.some(categories, (category) => !versionCategoryStatusEquivalence(category.status, "ok")),
  });

  return VersionSyncResolution.make({
    report,
    nodeLocations,
  });
});

/**
 * Live layer for resolver orchestration.
 *
 * @category configuration
 * @since 0.0.0
 */
export const ResolverServiceLive = Layer.succeed(
  ResolverService,
  ResolverService.of({
    resolve,
  })
);
