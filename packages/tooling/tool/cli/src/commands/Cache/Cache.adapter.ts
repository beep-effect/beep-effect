/**
 * Scoped late acquisition of the independently approved upload backend.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Pull from "effect/Pull";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { OutputBound, runCapturedStreams } from "../../internal/process/index.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { CacheAdapterHostEvent, CacheProducerAdapterReceipt } from "./Cache.adapter.schemas.ts";
import { readCacheDependencyMaterialization } from "./Cache.dependencies.ts";
import { hashCacheExperimentExecutable, requireCacheLinuxX64 } from "./Cache.evidence.ts";
import { makePrivateSupervisorStorage } from "./Cache.pilot.runner.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheSignedPilotRequest } from "./Cache.pilot.signed.schemas.ts";
import type { CacheProducerUploadRuntime } from "./Cache.workflow.schemas.ts";
import type { CacheProducerUploadApproval } from "./Cache.workflow.upload.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.adapter");
const Startup = S.Struct({ adapter: S.NonEmptyString, sha256: Sha256Hex, env: S.Record(S.String, S.String) }).pipe(
  $I.annoteSchema("CacheAdapterStartupFrame", {
    description: "One private startup frame consumed only through the owning host pipe.",
  })
);

/**
 * Own the actual bounded backend only around the approved upload phase.
 *
 * **Details**
 * The worker receives neither storage credentials nor the host control pipe.
 * Successful use is returned only after the same executable/process/listener
 * passed its post-load check and the owning host completed cleanup. Exceptions
 * and interruption terminate the scoped host, whose finalizer stops its units.
 * The canonical Bun CLI owns this helper and its admission/process services.
 * A missing systemd user manager fails explicitly.
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
      const path = yield* Path.Path;
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
      const input = yield* JsonStringCodec(Startup).encode({
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
      const handle = yield* ChildProcess.make(
        "/usr/bin/python3",
        ["-I", "-B", path.join(root, "infra/r2-cache/policy_runtime.py"), "owned-host"],
        {
          cwd: directory,
          extendEnv: false,
          env: { PATH: "/usr/bin", HOME: directory },
          stdin: { stream: Stream.make(new TextEncoder().encode(`${input}\n`)), endOnDone: false },
          stdout: "pipe",
          stderr: "ignore",
          forceKillAfter: Duration.seconds(30),
        }
      );
      const pull = yield* handle.stdout.pipe(
        Stream.decodeText(),
        Stream.splitLines,
        Stream.mapEffect(
          Effect.fn("CacheAdapter.decodeHostFrame")(function* (line) {
            if (Str.length(line) > 4096)
              return yield* CacheCommandError.new("Owned adapter host frame exceeds its bound.");
            return yield* JsonStringCodec(CacheAdapterHostEvent).decode(line);
          })
        ),
        Stream.toPull
      );
      const buffered = yield* Ref.make(A.empty<CacheAdapterHostEvent>());
      const take = Effect.fn("CacheAdapter.takeHostFrame")(function* () {
        const retainTail = Effect.fn("CacheAdapter.retainHostFrames")(function* ([
          head,
          ...tail
        ]: A.NonEmptyReadonlyArray<CacheAdapterHostEvent>) {
          yield* Ref.set(buffered, tail);
          return head;
        });
        return yield* A.match(yield* Ref.get(buffered), {
          onEmpty: () =>
            pull.pipe(
              Pull.catchDone(() => CacheCommandError.new("Owned adapter host closed before its required frame.")),
              Effect.flatMap(retainTail)
            ),
          onNonEmpty: retainTail,
        }).pipe(Effect.timeout(Duration.seconds(20)));
      });
      const ready = yield* take();
      if (!CacheAdapterHostEvent.guards.ready(ready))
        return yield* CacheCommandError.new("Owned adapter host omitted readiness.");
      const result = yield* use;
      yield* Stream.run(Stream.make(new TextEncoder().encode("verify\n")), handle.stdin);
      const after = yield* take();
      if (!CacheAdapterHostEvent.guards["after-load"](after))
        return yield* CacheCommandError.new("Owned adapter host omitted its post-load observation.");
      yield* Stream.run(Stream.make(new TextEncoder().encode("stop\n")), handle.stdin);
      const cleaned = yield* take();
      if (
        !CacheAdapterHostEvent.guards.cleaned(cleaned) ||
        (yield* handle.exitCode.pipe(Effect.timeout(Duration.seconds(20)))) !== 0
      )
        return yield* CacheCommandError.new("Owned adapter host did not finish successful cleanup.");
      if (A.isReadonlyArrayNonEmpty(yield* Ref.get(buffered)))
        return yield* CacheCommandError.new("Owned adapter host emitted extra frames.");
      yield* pull.pipe(
        Effect.flatMap(() => CacheCommandError.new("Owned adapter host emitted trailing frames.")),
        Pull.catchDone(() => Effect.void),
        Effect.timeout(Duration.seconds(5))
      );
      const receipt = yield* S.decodeEffect(CacheProducerAdapterReceipt)({
        backendSha256,
        targetSha256: approval.targetSha256,
        ready: ready.observation,
        afterLoad: after.observation,
        cleaned: true,
      });
      return Tuple.make(result, receipt);
    })
  );
}, CacheCommandError.mapError("Owned producer backend supervision failed."));
