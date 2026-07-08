/**
 * Version-sync handler orchestration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { A } from "@beep/utils";
import { Console, Effect, Layer, Number as Num } from "effect";
import { ReportRendererService, ReportRendererServiceLive } from "../VersionSync.render.js";
import { VersionSyncDriftError, VersionSyncModeMatch } from "../VersionSync.schemas.js";
import { CategorySelectionServiceLive } from "./services/CategorySelectionService.js";
import { ResolverService, ResolverServiceLive } from "./services/ResolverService.js";
import { UpdateApplierService, UpdateApplierServiceLive } from "./services/UpdateApplierService.js";
import type { NoSuchFileError } from "@beep/repo-utils";
import type { FileSystem, Path } from "effect";
import type { HttpClient } from "effect/unstable/http";
import type { VersionSyncError, VersionSyncOptions } from "../VersionSync.schemas.js";

const VersionSyncServicesLive = Layer.mergeAll(
  CategorySelectionServiceLive,
  ResolverServiceLive,
  ReportRendererServiceLive,
  UpdateApplierServiceLive
);

const handleVersionSyncProgram = Effect.fn(function* (options: VersionSyncOptions) {
  const repoRoot = yield* findRepoRoot();
  const resolver = yield* ResolverService;
  const renderer = yield* ReportRendererService;
  const updater = yield* UpdateApplierService;

  const resolution = yield* resolver.resolve(repoRoot, options);
  yield* renderer.renderReport(resolution.report, options.mode);

  const applyWriteUpdates = Effect.fn("VersionSync.handle.write.applyUpdates")(function* () {
    const totalChanges = yield* updater.apply(repoRoot, resolution);
    yield* Console.log(`\nApplied ${totalChanges} file update(s).`);
  });

  const failOnDrift = Effect.fn("VersionSync.handle.check.failOnDrift")(function* () {
    const driftCount = A.reduce(resolution.report.categories, 0, (count, category) =>
      Num.sum(count, A.length(category.items))
    );

    return yield* VersionSyncDriftError.new(driftCount, `Version drift detected: ${driftCount} item(s) need updating`);
  });

  yield* VersionSyncModeMatch(options.mode, {
    write: () => applyWriteUpdates().pipe(Effect.when(Effect.succeed(resolution.report.hasDrift)), Effect.asVoid),
    check: () => failOnDrift().pipe(Effect.when(Effect.succeed(resolution.report.hasDrift)), Effect.asVoid),
    "dry-run": () => Effect.void,
  });
});

/**
 * Execute the version-sync command.
 *
 * @param options - Parsed version-sync options.
 * @returns Effect that resolves or fails with typed version-sync errors.
 * @category use-cases
 * @since 0.0.0
 */
export const handleVersionSync: (
  options: VersionSyncOptions
) => Effect.Effect<
  void,
  VersionSyncError | VersionSyncDriftError | NoSuchFileError,
  FileSystem.FileSystem | Path.Path | HttpClient.HttpClient
> = (options) =>
  Effect.scoped(
    Layer.build(VersionSyncServicesLive).pipe(
      Effect.flatMap(
        Effect.fnUntraced(function* (context) {
          return yield* handleVersionSyncProgram(options).pipe(Effect.provide(context));
        })
      )
    )
  );
