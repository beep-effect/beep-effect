/**
 * Admitted private-network supervision of signed real-pilot comparisons.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isResolvedPathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { CacheClientPin } from "@beep/repo-configs/cache";
import { Sha256HexFromBytes } from "@beep/schema";
import { O } from "@beep/utils";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as NetAddress from "effect/net/NetAddress";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { writeContainedFileString } from "../../internal/cli/FsGuards.ts";
import { OutputBound, runCapturedStreams } from "../../internal/process/index.ts";
import { AdmissionRequest } from "../../internal/repo-run/QualityScheduler.schemas.ts";
import { noAdmissionOriginGate, withQualityAdmission } from "../../internal/repo-run/QualityScheduler.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { CacheConformanceProxyOptions, makeCacheConformanceSocketProxy } from "./Cache.conformance.proxy.ts";
import { CacheConformanceTarget } from "./Cache.conformance.schemas.ts";
import { CacheDependencyMaterialization } from "./Cache.dependencies.schemas.ts";
import {
  decodeCacheExperimentText,
  hashCacheExperimentExecutable,
  readCacheEvidenceBytes,
  readCacheExperimentBytes,
  requireCacheLinuxX64,
  requireCacheSupervisorCapture,
} from "./Cache.evidence.ts";
import { CacheSignedPilotReceipt, CacheSignedPilotRequest, CacheSignedPilotRun } from "./Cache.pilot.signed.schemas.ts";
import { validateCacheSignedPilotReceipt } from "./Cache.pilot.signed.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import { CacheProducerUploadRuntime } from "./Cache.workflow.schemas.ts";
import { joinCacheProducerUpload } from "./Cache.workflow.upload.ts";
import type { CacheProducerBinding } from "./Cache.producer.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.pilot.runner");
const PrivateUploadAddress = S.declare(NetAddress.isUnixPathAddress).pipe(
  $I.annoteSchema("PrivateUploadAddress", {
    description: "The existing immutable Unix address owned by the parent observer.",
  })
);
class UploadSupervisor extends S.Opaque<UploadSupervisor, { readonly brand: unique symbol }>()(
  S.Struct({ address: S.Redacted(PrivateUploadAddress), runtime: CacheProducerUploadRuntime }).pipe(
    $I.annoteSchema("UploadSupervisor", {
      description: "Unserialized socket and upload capabilities held by the owning supervisor.",
    })
  )
) {}
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const bound = OutputBound.make({ maxChars: 64 * 1024, truncatedNotice: "signed pilot capture exceeded bound" });

const renderSignedPilotWorker = Effect.fn("CachePilot.renderSignedWorker")(function* (
  root: string,
  directory: string,
  protectedIssuerMaterial: O.Option<string>,
  upload: O.Option<UploadSupervisor>
) {
  const path = yield* Path.Path;
  const module = yield* JsonStringCodec(S.String).encode(
    path.join(root, "packages/tooling/tool/cli/src/commands/Cache/index.ts")
  );
  const service = yield* JsonStringCodec(S.String).encode(
    path.join(root, "packages/tooling/tool/cli/src/commands/Cache/Cache.service.ts")
  );
  const input = yield* JsonStringCodec(S.String).encode(path.join(directory, "request.json"));
  const output = yield* JsonStringCodec(S.String).encode(path.join(directory, "report.json"));
  const issuerProbe = yield* S.String.pipe(S.OptionFromNullOr, JsonStringCodec).encode(protectedIssuerMaterial);
  const reportType = O.isSome(upload) ? "CacheSignedPilotRun" : "CacheSignedPilotReceipt";
  const uploadModule = yield* JsonStringCodec(S.String).encode(
    path.join(root, "packages/tooling/tool/cli/src/commands/Cache/Cache.pilot.ts")
  );
  const targetModule = yield* JsonStringCodec(S.String).encode(
    path.join(root, "packages/tooling/tool/cli/src/commands/Cache/Cache.conformance.schemas.ts")
  );
  const uploadTarget = O.isSome(upload)
    ? yield* JsonStringCodec(CacheConformanceTarget).encode(upload.value.runtime.target)
    : "";
  const execute = O.isSome(upload)
    ? `runCacheSignedPilotUploadWorker(request.sourceRoot, request.pilot, yield* S.decodeUnknownEffect(CacheConformanceTarget)(${uploadTarget}), yield* Config.Redacted("BEEP_CACHE_UPLOAD_BEARER"), yield* Config.Redacted("BEEP_CACHE_UPLOAD_SIGNING"), issuerProbe)`
    : "runCacheSignedPilotWorker(request.sourceRoot, request.pilot, issuerProbe)";
  return `import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { BunRuntime } from "@effect/platform-bun";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { CacheSignedPilotRequest, ${reportType}, runCacheSignedPilotWorker } from ${module};
${O.isSome(upload) ? `import { runCacheSignedPilotUploadWorker } from ${uploadModule};\nimport { CacheConformanceTarget } from ${targetModule};` : ""}
import { CacheQualificationLive } from ${service};
BunRuntime.runMain(Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const request = yield* S.decodeUnknownEffect(S.fromJsonString(CacheSignedPilotRequest))(yield* fs.readFileString(${input}));
  const issuerProbe = yield* S.decodeUnknownEffect(S.OptionFromNullOr(S.String))(${issuerProbe});
  const report = yield* ${execute};
  yield* fs.writeFileString(${output}, yield* S.encodeEffect(S.fromJsonString(${reportType}))(report));
}).pipe(Effect.scoped, Effect.provide(CacheQualificationLive), Effect.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, FsUtilsLive.pipe(Layer.provide(NodeServices.layer))))));
`;
});

const makePrivateSupervisorStorage = Effect.fn("CachePilot.makePrivateSupervisorStorage")(function* (
  root: string,
  mounts: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs
    .makeTempDirectoryScoped({
      directory: "/tmp",
      prefix: "beep-cache-supervisor-",
    })
    .pipe(Effect.flatMap(fs.realPath));
  if (A.some([...mounts, "/usr"], (mount) => isResolvedPathWithinRoot(path, { root: mount, candidate: directory })))
    return yield* CacheCommandError.new("Private supervisor storage must remain outside every source input mount.");
  yield* fs.chmod(directory, 0o700);
  // Resolve worker imports without placing private captures inside a source mount.
  yield* fs.symlink(path.join(root, "node_modules"), path.join(directory, "node_modules"));
  return directory;
});

/**
 * Supervise signed comparisons with a private loopback and read-only input mounts.
 *
 * **Details**
 * The runner checkout may differ from the frozen source checkout. The nested
 * worker verifies its exact tools, registered worktrees and dependency receipt.
 * Only scoped supervisor storage outside every source input mount is writable.
 * An optional supervisor-selected issuer file is checked before/after execution
 * and probed from each nested reader. It is never added to the mount list or
 * passed as key bytes. The returned report remains observation-only and cannot
 * authorize promotion; callers still own issuer selection and approval.
 *
 * **Example** (Reference the admitted supervisor)
 * ```ts
 * import { runCacheSignedPilotExperiment } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof runCacheSignedPilotExperiment === "function")
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
const captureCacheSignedPilotWorker = Effect.fn("CachePilot.captureSignedWorker")(function* (
  runnerRoot: string,
  request: CacheSignedPilotRequest,
  protectedIssuerMaterial: O.Option<string> = O.none(),
  upload: O.Option<UploadSupervisor> = O.none()
) {
  return yield* withQualityAdmission(
    AdmissionRequest.make({
      kind: "review-fix",
      weightTokens: 1,
      priority: "verify",
      originKey: "",
      checkoutRoot: runnerRoot,
      branch: "",
      command: "bun run beep cache pilot-signed",
    }),
    noAdmissionOriginGate,
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* requireCacheLinuxX64("Signed pilot supervisor requires Linux x64.");
        if ((yield* hashCacheExperimentExecutable(request.pilot.executable)) !== request.pilot.client.sha256)
          return yield* CacheCommandError.new("Signed pilot executable differs from its requested binary pin.");
        const hashIssuerMaterial = Effect.fn("CachePilot.hashIssuerMaterial")(function* (file: string) {
          return yield* readCacheExperimentBytes(path.dirname(file), file, 4096).pipe(Effect.flatMap(hashBytes));
        });
        const issuerDigest = yield* O.match(protectedIssuerMaterial, {
          onNone: () => Effect.succeedNone,
          onSome: (file) => hashIssuerMaterial(file).pipe(Effect.asSome),
        });
        const sourceRoot = yield* fs.realPath(request.sourceRoot);
        const root = yield* fs.realPath(runnerRoot);
        const bun = yield* fs.realPath(process.execPath);
        const node = yield* fs.realPath(request.pilot.nodeExecutable);
        const dependencies = yield* readCacheEvidenceBytes(sourceRoot, request.pilot.dependencies).pipe(
          Effect.flatMap(decodeCacheExperimentText),
          Effect.flatMap(JsonStringCodec(CacheDependencyMaterialization).decode)
        );
        const git = yield* runCapturedStreams({
          command: "/usr/bin/git",
          args: ["rev-parse", "--path-format=absolute", "--git-common-dir"],
          cwd: sourceRoot,
          extendEnv: false,
          env: { PATH: "/usr/bin" },
          bound,
        });
        if (git.exitCode !== 0 || git.truncated)
          return yield* CacheCommandError.new("Cannot resolve signed pilot source Git metadata.");
        const commonGit = yield* fs.realPath(Str.trim(git.stdout));
        const mounts = yield* Effect.forEach(
          [
            root,
            sourceRoot,
            ...request.pilot.worktrees,
            commonGit,
            dependencies.directory,
            bun,
            node,
            request.pilot.biomeExecutable,
            request.pilot.executable,
          ],
          fs.realPath
        );
        const directory = yield* makePrivateSupervisorStorage(root, mounts);
        yield* writeContainedFileString(
          directory,
          "request.json",
          yield* JsonStringCodec(CacheSignedPilotRequest).encode(
            CacheSignedPilotRequest.make({ ...request, sourceRoot })
          )
        );
        const worker = yield* renderSignedPilotWorker(root, directory, protectedIssuerMaterial, upload);
        yield* writeContainedFileString(directory, "worker.ts", worker);
        // Bun otherwise discovers sourceRoot/bunfig.toml from the untrusted cwd,
        // including preloads that run before this trusted worker.
        yield* writeContainedFileString(directory, "bunfig.toml", "");
        const verifyIssuerMountIsolation = Effect.fn("CachePilot.verifyIssuerMountIsolation")(function* () {
          if (O.isSome(protectedIssuerMaterial)) {
            const issuer = yield* fs.realPath(protectedIssuerMaterial.value);
            if (
              A.some([...mounts, directory, "/usr"], (mount) =>
                isResolvedPathWithinRoot(path, { root: mount, candidate: issuer })
              )
            )
              return yield* CacheCommandError.new(
                "Issuer material must remain outside every signed pilot input mount."
              );
          }
        });
        yield* verifyIssuerMountIsolation();
        const captured = yield* runCapturedStreams({
          command: "/usr/bin/bwrap",
          args: [
            "--unshare-all",
            "--die-with-parent",
            "--new-session",
            "--ro-bind",
            "/usr",
            "/usr",
            "--symlink",
            "usr/lib",
            "/lib",
            "--symlink",
            "usr/lib",
            "/lib64",
            "--symlink",
            "usr/bin",
            "/bin",
            "--proc",
            "/proc",
            "--dev",
            "/dev",
            "--tmpfs",
            "/tmp",
            ...A.flatMap(A.dedupe(mounts), (mount) => ["--ro-bind", mount, mount]),
            ...O.match(upload, {
              onNone: A.empty<string>,
              onSome: ({ address }) => ["--ro-bind", Redacted.value(address).path, "/cache-upload.sock"],
            }),
            "--bind",
            directory,
            directory,
            "--chdir",
            sourceRoot,
            bun,
            "--no-env-file",
            "--no-install",
            `--config=${path.join(directory, "bunfig.toml")}`,
            path.join(directory, "worker.ts"),
          ],
          cwd: root,
          extendEnv: false,
          env: {
            PATH: `${path.dirname(bun)}:${path.dirname(node)}:/usr/bin`,
            HOME: "/tmp",
            CI: "1",
            NO_COLOR: "1",
            ...O.getSomesStruct({
              BEEP_CACHE_UPLOAD_BEARER: O.map(upload, ({ runtime }) => Redacted.value(runtime.bearers.writer)),
              BEEP_CACHE_UPLOAD_SIGNING: O.map(upload, ({ runtime }) => Redacted.value(runtime.signing)),
            }),
          },
          bound,
        }).pipe(Effect.timeout(O.isSome(upload) ? Duration.minutes(10) : Duration.minutes(20)));
        yield* requireCacheSupervisorCapture(captured, "Signed pilot");
        const text = yield* readCacheExperimentBytes(directory, "report.json", 256 * 1024).pipe(
          Effect.flatMap(decodeCacheExperimentText)
        );
        if (O.isSome(upload)) {
          if (
            O.isSome(protectedIssuerMaterial) &&
            !O.contains(issuerDigest, yield* hashIssuerMaterial(protectedIssuerMaterial.value))
          )
            return yield* CacheCommandError.new("Persistent issuer material changed during the upload worker.");
          return yield* JsonStringCodec(CacheSignedPilotRun).decode(text);
        }
        const report = yield* JsonStringCodec(CacheSignedPilotReceipt).decode(text);
        const verifySupervisedReceipt = Effect.fn("CachePilot.verifySupervisedReceipt")(function* () {
          if (
            report.channel !== request.pilot.channel ||
            !S.toEquivalence(CacheClientPin)(report.client, request.pilot.client) ||
            report.bun.sha256 !== (yield* hashCacheExperimentExecutable(bun))
          )
            return yield* CacheCommandError.new("Signed pilot report differs from its supervised identities.");
          if (O.isSome(protectedIssuerMaterial)) {
            if (
              !O.contains(issuerDigest, yield* hashIssuerMaterial(protectedIssuerMaterial.value)) ||
              !A.every(report.comparisons, (pair) => O.contains(pair.protection.issuerMaterialDenied, true))
            )
              return yield* CacheCommandError.new(
                "Persistent issuer material was exposed or changed during the signed pilot."
              );
          }
        });
        yield* verifySupervisedReceipt();
        return yield* validateCacheSignedPilotReceipt(report);
      })
    )
  );
}, CacheCommandError.mapError("Signed pilot admission or supervision failed."));

/**
 * Supervise the complete signed comparison matrix under its original boundary.
 *
 * **Example** (Reference the admitted matrix supervisor)
 * ```ts
 * import { runCacheSignedPilotExperiment } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof runCacheSignedPilotExperiment === "function")
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const runCacheSignedPilotExperiment = Effect.fn("CachePilot.signedExperiment")(function* (
  root: string,
  request: CacheSignedPilotRequest,
  protectedIssuerMaterial: O.Option<string> = O.none()
) {
  return yield* captureCacheSignedPilotWorker(root, request, protectedIssuerMaterial).pipe(
    Effect.filterOrFail(S.is(CacheSignedPilotReceipt), () =>
      CacheCommandError.new("Expected the signed comparison matrix.")
    )
  );
});

/**
 * Join one owned upload-only real execution to the parent's complete capture.
 *
 * **Details**
 * The workflow owner must first bind the target descriptor and full task closure
 * to independent approval. This component creates the only mounted socket, keeps
 * host networking outside the worker, and validates every settled exchange. It
 * accepts no uploaded summary or capture JSON and grants no producer authority.
 *
 * **Example** (Reference the closed upload experiment)
 * ```ts
 * import { runCacheProducerUploadExperiment } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof runCacheProducerUploadExperiment === "function")
 * ```
 *
 * @internal
 * @category commands
 * @since 0.0.0
 */
export const runCacheProducerUploadExperiment = Effect.fn("CachePilot.producerUploadExperiment")(function* (
  root: string,
  request: CacheSignedPilotRequest,
  runtime: CacheProducerUploadRuntime,
  expected: CacheProducerBinding,
  expectedTasks: ReadonlyArray<string>,
  protectedIssuerMaterial: string
) {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const proxy = yield* makeCacheConformanceSocketProxy(
        CacheConformanceProxyOptions.make({
          target: runtime.target,
          bearers: runtime.bearers,
          holdMs: 100,
          maxEvents: 200,
          maxBodyBytes: 50 * 1024 * 1024,
          maxCaptureBytes: 50 * 1024 * 1024,
        })
      );
      const report = yield* captureCacheSignedPilotWorker(
        root,
        request,
        O.some(protectedIssuerMaterial),
        O.some(UploadSupervisor.make({ address: proxy.address, runtime }))
      ).pipe(
        Effect.filterOrFail(S.is(CacheSignedPilotRun), () => CacheCommandError.new("Expected an owned upload run."))
      );
      const summary = yield* report.nativeSummary.pipe(
        Effect.fromOption(() => CacheCommandError.new("Owned upload omitted its complete native summary."))
      );
      return yield* joinCacheProducerUpload(expected, summary, yield* proxy.events, expectedTasks);
    })
  );
}, CacheCommandError.mapError("Owned producer upload supervision failed."));
