/**
 * Resolver orchestration service for version-sync.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { Context, Effect, Layer } from "effect";
import * as S from "effect/Schema";
import {
  VersionCategoryStatus,
  VersionSyncReport,
  VersionSyncResolution,
  VersionSyncUpdateLocation,
} from "../../VersionSync.schemas.js";
import { BiomeSchemaState, buildBiomeReport, resolveBiomeSchema } from "../resolvers/BiomeResolver.js";
import { BunVersionState, buildBunReport, resolveBunVersions } from "../resolvers/BunResolver.js";
import { buildDockerReport, DockerImageState, resolveDockerImages } from "../resolvers/DockerResolver.js";
import { buildEffectReport, EffectCatalogState, resolveEffectCatalog } from "../resolvers/EffectResolver.js";
import { buildNodeReport, resolveNodeVersions } from "../resolvers/NodeResolver.js";
import { CategorySelectionService } from "./CategorySelectionService.js";
import type { FileSystem, Path } from "effect";
import type { HttpClient } from "effect/unstable/http";
import type { VersionCategoryReport, VersionSyncError, VersionSyncOptions } from "../../VersionSync.schemas.js";

const $I = $RepoCliId.create("commands/VersionSync/internal/services/ResolverService");
const versionCategoryStatusEquivalence = S.toEquivalence(VersionCategoryStatus);

type ResolverEnvironment = FileSystem.FileSystem | Path.Path | HttpClient.HttpClient | CategorySelectionService;

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

const resolve: ResolverServiceShape["resolve"] = Effect.fn(function* (repoRoot, options) {
  const categorySelection = yield* CategorySelectionService;
  let categories = A.empty<VersionCategoryReport>();
  let nodeLocations = A.empty<VersionSyncUpdateLocation>();

  if (categorySelection.shouldCheck(options, "bun")) {
    const bunState = yield* resolveBunVersions(repoRoot, options.skipNetwork).pipe(
      Effect.catchTag(
        "VersionSyncError",
        Effect.fn(function* (error) {
          yield* Effect.logWarning(`Bun resolution failed: ${error.message}`);
          return BunVersionState.make({});
        })
      )
    );

    if (Str.isNonEmpty(bunState.bunVersionFile)) {
      categories = A.append(categories, buildBunReport(bunState));
    }
  }

  if (categorySelection.shouldCheck(options, "node")) {
    const nodeState = yield* resolveNodeVersions(repoRoot);
    categories = A.append(categories, buildNodeReport(nodeState));

    nodeLocations = A.map(
      A.filter(nodeState.workflowLocations, (location) => !Str.equivalence(location.currentValue, nodeState.nvmrc)),
      (location) =>
        VersionSyncUpdateLocation.make({
          file: location.file,
          yamlPath: location.yamlPath,
        })
    );
  }

  if (categorySelection.shouldCheck(options, "docker")) {
    const dockerState = yield* resolveDockerImages(repoRoot, options.skipNetwork).pipe(
      Effect.catchTag(
        "VersionSyncError",
        Effect.fn(function* (error) {
          yield* Effect.logWarning(`Docker resolution failed: ${error.message}`);
          return DockerImageState.make({});
        })
      )
    );

    categories = A.append(categories, buildDockerReport(dockerState));
  }

  if (categorySelection.shouldCheck(options, "biome")) {
    const biomeState = yield* resolveBiomeSchema(repoRoot).pipe(
      Effect.catchTag(
        "VersionSyncError",
        Effect.fn(function* (error) {
          yield* Effect.logWarning(`Biome schema resolution failed: ${error.message}`);
          return BiomeSchemaState.make({});
        })
      )
    );

    if (Str.isNonEmpty(biomeState.installedVersion)) {
      categories = A.append(categories, buildBiomeReport(biomeState));
    }
  }

  if (categorySelection.shouldCheck(options, "effect")) {
    const effectState = yield* resolveEffectCatalog(repoRoot).pipe(
      Effect.catchTag(
        "VersionSyncError",
        Effect.fn(function* (error) {
          yield* Effect.logWarning(`Effect catalog resolution failed: ${error.message}`);
          return EffectCatalogState.make({});
        })
      )
    );

    categories = A.append(categories, buildEffectReport(effectState));
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
