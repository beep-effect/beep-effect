/**
 * Scoped late acquisition of the independently approved upload backend.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { OutputBound, runCapturedStreams } from "@beep/repo-cli-kit/process/index";
import { Sha256Hex } from "@beep/schema";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { CacheOwnedAdapterHost } from "./Cache.adapter.host.ts";
import {
  CacheAdapterWriterAfterLoad,
  CacheAdapterWriterReady,
  CacheOwnedAdapterStartup,
  CacheProducerAdapterReceipt,
} from "./Cache.adapter.schemas.ts";
import { readCacheDependencyMaterialization } from "./Cache.dependencies.ts";
import { CacheCommandError } from "./Cache.errors.ts";
import { hashCacheExperimentExecutable, makePrivateSupervisorStorage, requireCacheLinuxX64 } from "./Cache.evidence.ts";
import type { CacheSignedPilotRequest } from "./Cache.pilot.signed.schemas.ts";
import type { CacheProducerUploadRuntime } from "./Cache.workflow.schemas.ts";
import type { CacheProducerUploadApproval } from "./Cache.workflow.upload.schemas.ts";

/**
 * Own the actual bounded backend only around the approved upload phase.
 *
 * **Details**
 * The worker receives neither storage credentials nor the host's unit handles.
 * Successful use is returned only after the same executable/process/listener
 * passed its post-load check and the owned host completed cleanup. Exceptions
 * and interruption close the scope, whose finalizer stops the owned unit and
 * its `systemd-run` client. The host is the in-process
 * {@link CacheOwnedAdapterHost} (formerly the `policy_runtime.py` subprocess).
 * The canonical Bun CLI owns this helper and its admission/process services.
 * A missing systemd user manager fails explicitly. The caller admits the entire
 * upload before acquisition; the load callback has nine minutes after readiness,
 * leaving time for verification and cleanup inside the fixed ten-minute backend cap.
 *
 * **Example** (Reference late backend acquisition)
 * ```ts
 * import { withCacheProducerAdapter } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof withCacheProducerAdapter === "function")
 * ```
 *
 * @internal
 * @category resources
 * @since 0.0.0
 */
export const withCacheProducerAdapter = Effect.fn("CacheAdapter.withOwnedBackend")(function* <
  Success,
  Error,
  Requirements,
>(
  root: string,
  request: CacheSignedPilotRequest,
  runtime: CacheProducerUploadRuntime,
  approval: CacheProducerUploadApproval,
  use: Effect.Effect<Success, Error, Requirements>
) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      yield* requireCacheLinuxX64("Owned adapter supervision requires Linux x64.");
      const fs = yield* FileSystem.FileSystem;
      const launch = yield* runtime.adapter.pipe(
        Effect.fromOption(() => CacheCommandError.new("Producer upload requires an owned adapter launch capability."))
      );
      const storage = yield* runtime.target.storage.pipe(
        Effect.fromOption(() => CacheCommandError.new("Producer upload requires independently approved storage."))
      );
      const backendSha256 = yield* S.decodeEffect(Sha256Hex)(runtime.target.backend.digest);
      const executable = yield* fs.realPath(launch.executable);
      if ((yield* hashCacheExperimentExecutable(executable)) !== backendSha256)
        return yield* CacheCommandError.new("Owned adapter executable differs from its independently approved pin.");
      const dependencies = yield* readCacheDependencyMaterialization(request.sourceRoot, request.pilot.dependencies);
      // KEEP (D-19): producer trust boundary (pinned /usr/bin/git in the identity, scrubbed env).
      // biome-ignore lint/plugin/no-hand-rolled-git-gh-spawn: KEEP (D-19), reason above
      const git = yield* runCapturedStreams({
        command: "/usr/bin/git",
        args: ["rev-parse", "--path-format=absolute", "--git-common-dir"],
        cwd: request.sourceRoot,
        extendEnv: false,
        env: { PATH: "/usr/bin" },
        bound: OutputBound.make({ maxChars: 4096, truncatedNotice: "adapter mount metadata exceeded bound" }),
      });
      if (git.exitCode !== 0 || git.truncated)
        return yield* CacheCommandError.new("Cannot resolve owned adapter source Git metadata.");
      const mounts = yield* Effect.forEach(
        [root, request.sourceRoot, ...request.pilot.worktrees, Str.trim(git.stdout), dependencies.directory],
        fs.realPath,
        { concurrency: 1 }
      );
      const directory = yield* makePrivateSupervisorStorage(root, mounts);
      const startup = CacheOwnedAdapterStartup.make({
        adapter: executable,
        sha256: backendSha256,
        env: {
          PATH: "/usr/bin",
          HOME: directory,
          HOST: "127.0.0.1",
          PORT: runtime.target.baseUrl.port,
          TOKIO_WORKER_THREADS: "2",
          S3_ENDPOINT: storage.endpoint.origin,
          S3_REGION: "auto",
          S3_BUCKET_NAME: storage.bucket,
          S3_USE_PATH_STYLE: "true",
          S3_ACCESS_KEY: Redacted.value(launch.accessKey),
          S3_SECRET_KEY: Redacted.value(launch.secretKey),
          TURBO_TOKEN: Redacted.value(runtime.bearers.writer),
          BEEP_CACHE_POLICY: "signed-v1",
          BEEP_CACHE_NAMESPACE: runtime.target.namespace.teamId,
          BEEP_CACHE_ACCESS_ROLE: "writer",
          OTEL_SDK_DISABLED: "true",
        },
      });
      const host = yield* CacheOwnedAdapterHost;
      const adapter = yield* host.start(startup, directory).pipe(Effect.timeout(Duration.seconds(20)));
      const ready = yield* S.decodeUnknownEffect(CacheAdapterWriterReady)(adapter.ready).pipe(
        Effect.mapError(() => CacheCommandError.new("Owned adapter host omitted readiness."))
      );
      const result = yield* use.pipe(Effect.timeout(Duration.minutes(9)));
      const after = yield* adapter.verify.pipe(
        Effect.timeout(Duration.seconds(20)),
        Effect.flatMap(S.decodeUnknownEffect(CacheAdapterWriterAfterLoad)),
        Effect.mapError((cause) =>
          CacheCommandError.new("Owned adapter host omitted its post-load observation.", cause)
        )
      );
      yield* adapter.stop.pipe(
        Effect.timeout(Duration.seconds(20)),
        Effect.mapError((cause) =>
          CacheCommandError.new("Owned adapter host did not finish successful cleanup.", cause)
        )
      );
      const receipt = yield* S.decodeEffect(CacheProducerAdapterReceipt)({
        backendSha256,
        targetSha256: approval.targetSha256,
        ready,
        afterLoad: after,
        cleaned: true,
      });
      return Tuple.make(result, receipt);
    })
  );
}, CacheCommandError.mapError("Owned producer backend supervision failed."));
