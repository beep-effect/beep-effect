/**
 * Admitted private-network supervision of signed real-pilot comparisons.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isResolvedPathWithinRoot } from "@beep/file-processing/PathSafety";
import { CacheClientPin } from "@beep/repo-configs/cache";
import { Sha256HexFromBytes } from "@beep/schema";
import { Duration, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { writeContainedFileString } from "../../internal/cli/FsGuards.ts";
import { OutputBound, runCapturedStreams } from "../../internal/process/index.ts";
import { AdmissionRequest } from "../../internal/repo-run/QualityScheduler.schemas.ts";
import { noAdmissionOriginGate, withQualityAdmission } from "../../internal/repo-run/QualityScheduler.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { CacheDependencyMaterialization } from "./Cache.dependencies.schemas.ts";
import {
  decodeCacheExperimentText,
  hashCacheExperimentExecutable,
  readCacheEvidenceBytes,
  readCacheExperimentBytes,
} from "./Cache.evidence.ts";
import { CacheSignedPilotReceipt, CacheSignedPilotRequest } from "./Cache.pilot.signed.schemas.ts";
import { validateCacheSignedPilotReceipt } from "./Cache.pilot.signed.ts";
import { CacheCommandError } from "./Cache.schemas.ts";

const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const bound = OutputBound.make({ maxChars: 64 * 1024, truncatedNotice: "signed pilot capture exceeded bound" });

/**
 * Supervise signed comparisons with a private loopback and read-only input mounts.
 *
 * **Details**
 * The runner checkout may differ from the frozen source checkout. The nested
 * worker verifies its exact tools, registered worktrees and dependency receipt.
 * Only scoped supervisor storage and the source experiment directory are writable.
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
export const runCacheSignedPilotExperiment = Effect.fn("CachePilot.signedExperiment")(function* (
  runnerRoot: string,
  request: CacheSignedPilotRequest,
  protectedIssuerMaterial: O.Option<string> = O.none()
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
        if (process.platform !== "linux" || process.arch !== "x64")
          return yield* CacheCommandError.new("Signed pilot supervisor requires Linux x64.");
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
        const parent = path.join(root, ".beep/cache-signed-pilot");
        yield* fs.makeDirectory(parent, { recursive: true });
        const directory = yield* fs.makeTempDirectoryScoped({ directory: parent, prefix: "run-" });
        const experiments = path.join(sourceRoot, ".beep/cache/experiments");
        yield* fs.makeDirectory(experiments, { recursive: true });
        yield* writeContainedFileString(
          directory,
          "request.json",
          yield* JsonStringCodec(CacheSignedPilotRequest).encode(
            CacheSignedPilotRequest.make({ ...request, sourceRoot })
          )
        );
        const module = yield* JsonStringCodec(S.String).encode(
          path.join(root, "packages/tooling/tool/cli/src/commands/Cache/index.ts")
        );
        const service = yield* JsonStringCodec(S.String).encode(
          path.join(root, "packages/tooling/tool/cli/src/commands/Cache/Cache.service.ts")
        );
        const input = yield* JsonStringCodec(S.String).encode(path.join(directory, "request.json"));
        const output = yield* JsonStringCodec(S.String).encode(path.join(directory, "report.json"));
        const issuerProbe = yield* S.String.pipe(S.OptionFromNullOr, JsonStringCodec).encode(protectedIssuerMaterial);
        const worker = `import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { BunRuntime } from "@effect/platform-bun";
import { Effect, FileSystem, Layer } from "effect";
import * as S from "effect/Schema";
import { CacheSignedPilotRequest, CacheSignedPilotReceipt, runCacheSignedPilotWorker } from ${module};
import { CacheQualificationLive } from ${service};
BunRuntime.runMain(Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const request = yield* S.decodeUnknownEffect(S.fromJsonString(CacheSignedPilotRequest))(yield* fs.readFileString(${input}));
  const issuerProbe = yield* S.decodeUnknownEffect(S.OptionFromNullOr(S.String))(${issuerProbe});
  const report = yield* runCacheSignedPilotWorker(request.sourceRoot, request.pilot, issuerProbe);
  yield* fs.writeFileString(${output}, yield* S.encodeEffect(S.fromJsonString(CacheSignedPilotReceipt))(report));
}).pipe(Effect.provide(CacheQualificationLive), Effect.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, FsUtilsLive.pipe(Layer.provide(NodeServices.layer))))));
`;
        yield* writeContainedFileString(directory, "worker.ts", worker);
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
        if (O.isSome(protectedIssuerMaterial)) {
          const issuer = yield* fs.realPath(protectedIssuerMaterial.value);
          if (
            A.some([...mounts, "/usr"], (mount) => isResolvedPathWithinRoot(path, { root: mount, candidate: issuer }))
          )
            return yield* CacheCommandError.new("Issuer material must remain outside every signed pilot input mount.");
        }
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
            "--bind",
            directory,
            directory,
            "--bind",
            experiments,
            experiments,
            "--chdir",
            sourceRoot,
            bun,
            "--no-env-file",
            "--no-install",
            path.join(directory, "worker.ts"),
          ],
          cwd: root,
          extendEnv: false,
          env: { PATH: `${path.dirname(bun)}:${path.dirname(node)}:/usr/bin`, HOME: "/tmp", CI: "1", NO_COLOR: "1" },
          bound,
        }).pipe(Effect.timeout(Duration.minutes(20)));
        if (captured.exitCode !== 0 || captured.truncated)
          return yield* CacheCommandError.new("Signed pilot supervisor failed or exceeded its capture bound.");
        const report = yield* readCacheExperimentBytes(directory, "report.json", 256 * 1024).pipe(
          Effect.flatMap(decodeCacheExperimentText),
          Effect.flatMap(JsonStringCodec(CacheSignedPilotReceipt).decode)
        );
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
        return yield* validateCacheSignedPilotReceipt(report);
      })
    )
  );
}, CacheCommandError.mapError("Signed pilot admission or supervision failed."));
