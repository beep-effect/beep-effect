/**
 * The runner-binaries syncer Lambda's program: keep the S3 mirror of the
 * `actions/runner` tarball on the latest release.
 *
 * Ported from `lambdas/functions/gh-agent-syncer/src/syncer/syncer.ts` of
 * github-aws-runners/terraform-aws-github-runner v7.10.1 (MIT); see the
 * package README for the license notice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { RunnerBinaries } from "./RunnerBinaries.service.ts";
import { GitHubApiError } from "./RunnerFleet.errors.ts";
import type { SyncerRuntimeConfig } from "./RunnerRuntime.models.ts";

/**
 * Mirrors the latest release asset when the cached object is missing or
 * tagged with a different asset name; returns whether it uploaded.
 *
 * **Example** (Wire the program)
 *
 * ```ts
 * import { handleRunnerBinariesSync } from "@beep/alchemy-github-runners/RunnerBinariesSyncer.program"
 *
 * console.log(typeof handleRunnerBinariesSync)
 * ```
 *
 * @param config - Bucket, key, OS and architecture.
 * @returns `true` when a new asset was uploaded.
 * @category use-cases
 * @since 0.0.0
 */
export const handleRunnerBinariesSync = Effect.fn("RunnerBinariesSyncer.handle")(function* (
  config: SyncerRuntimeConfig
) {
  const binaries = yield* RunnerBinaries;
  const asset = yield* binaries.latestAsset({ os: config.os, architecture: config.architecture }).pipe(
    Effect.flatMap(Effect.fromOption),
    Effect.mapError((error) =>
      error._tag === "GitHubApiError"
        ? error
        : GitHubApiError.make({ operation: "getLatestRelease", message: "Cannot find GitHub release asset." })
    )
  );
  const cached = yield* binaries.cachedName({ bucket: config.bucketName, key: config.objectKey });
  if (O.contains(cached, asset.name)) {
    return false;
  }
  yield* binaries.mirror({ bucket: config.bucketName, key: config.objectKey, asset });
  return true;
});
