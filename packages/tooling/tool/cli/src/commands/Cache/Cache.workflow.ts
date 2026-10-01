/**
 * Bounded provenance checks for explicitly approved cache-producer workflows.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Sha256HexFromBytes } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import { Effect, FileSystem, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { OutputBound, runCapturedStreams } from "../../internal/process/index.ts";
import { gitPathListFromNulOutput } from "../../internal/repo-run/GitExec.ts";
import { AdmissionRequest } from "../../internal/repo-run/QualityScheduler.schemas.ts";
import { noAdmissionOriginGate, withQualityAdmission } from "../../internal/repo-run/QualityScheduler.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { readCacheExperimentBytes } from "./Cache.evidence.ts";
import { collectCacheToolchain } from "./Cache.fingerprint.ts";
import { inspectCacheLinkedFile } from "./Cache.linker.ts";
import { runCacheSignedPilotExperiment } from "./Cache.pilot.runner.ts";
import { CacheProducerBinding } from "./Cache.producer.schemas.ts";
import { openCacheProducerIssuer } from "./Cache.producer.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import {
  CacheProducerObservation,
  CacheProducerWorkflow,
  CacheProducerWorkflowFile,
} from "./Cache.workflow.schemas.ts";
import type { CacheSignedPilotRequest } from "./Cache.pilot.signed.schemas.ts";

const bindingCodec = JsonStringCodec(CacheProducerBinding);
const digest = S.decodeEffect(Sha256HexFromBytes);
const decodeRevision = S.decodeUnknownEffect(GitObjectId);
const encodeWorkflow = S.encodeEffect(S.fromJsonString(CacheProducerWorkflow));
const pathsEquivalent = S.toEquivalence(S.Array(S.String));
const bound = OutputBound.make({ maxChars: 4 * 1024 * 1024, truncatedNotice: "workflow inventory exceeded bound" });
const captureGit = Effect.fn("CacheWorkflow.git")(function* (root: string, args: ReadonlyArray<string>) {
  const captured = yield* runCapturedStreams({
    command: "/usr/bin/git",
    args,
    cwd: root,
    extendEnv: false,
    env: { PATH: "/usr/bin", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
    bound,
  });
  if (captured.exitCode !== 0 || captured.truncated)
    return yield* CacheCommandError.new("Cannot read a complete workflow Git inventory.");
  return captured.stdout;
});
const listSources = Effect.fn("CacheWorkflow.listSources")(function* (root: string) {
  const output = yield* captureGit(root, [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    "packages",
    "scripts",
    "package.json",
    "bun.lock",
    "bunfig.toml",
    "tsconfig.json",
    "tsconfig.base.json",
    "tsconfig.packages.json",
    ".bun-version",
    ".nvmrc",
  ]);
  if (!Str.endsWith("\0")(output))
    return yield* CacheCommandError.new("Workflow source inventory is empty or incomplete.");
  const paths = gitPathListFromNulOutput(output);
  if (paths.length > 20000) return yield* CacheCommandError.new("Workflow source inventory exceeded its entry bound.");
  return paths;
});

/**
 * Inspect declared source bytes without following an alias outside the checkout.
 *
 * **Example** (Reference source inventory)
 * ```ts
 * import { collectCacheProducerWorkflowFiles } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof collectCacheProducerWorkflowFiles === "function")
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const collectCacheProducerWorkflowFiles = Effect.fn("CacheWorkflow.files")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const paths = yield* listSources(root);
  const files = yield* Effect.forEach(
    paths,
    Effect.fn("CacheWorkflow.file")(function* (relative) {
      const file = path.resolve(root, relative);
      const linkTarget = yield* fs.readLink(file).pipe(Effect.option);
      if (O.exists(linkTarget, path.isAbsolute))
        return yield* CacheCommandError.new("Workflow source alias must be relative.");
      const target = O.isSome(linkTarget) ? yield* fs.realPath(file) : file;
      const bytes = yield* readCacheExperimentBytes(root, target, 8 * 1024 * 1024);
      const info = yield* fs.stat(target);
      return CacheProducerWorkflowFile.make({
        path: relative,
        sha256: yield* digest(bytes),
        mode: S.Natural.make(info.mode & 0o777),
        linkTarget,
      });
    }),
    { concurrency: 4 }
  );
  if (!pathsEquivalent(paths, yield* listSources(root)))
    return yield* CacheCommandError.new("Workflow source inventory changed during inspection.");
  return files;
}, CacheCommandError.mapError("Cannot bind the declared workflow source files."));

/**
 * Observe the declared workflow sources, installed dependency tree and host tools.
 *
 * **Details**
 * Call inside the caller's admission scope. This observation never provisions an
 * issuer or approves its own digest. The execution profile must separately close
 * ignored inputs and workspace-local dependency resolution before promotion.
 *
 * **Example** (Reference workflow inspection)
 * ```ts
 * import { inspectCacheProducerWorkflow } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof inspectCacheProducerWorkflow === "function")
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const inspectCacheProducerWorkflow = Effect.fn("CacheWorkflow.inspect")(function* (root: string) {
  const before = yield* captureGit(root, ["rev-parse", "HEAD"]).pipe(
    Effect.map(Str.trim),
    Effect.flatMap(decodeRevision)
  );
  const files = yield* collectCacheProducerWorkflowFiles(root);
  const toolchain = yield* collectCacheToolchain(root);
  const inspectionTools = yield* Effect.forEach(
    ["/usr/bin/git", "/usr/bin/bwrap", "/usr/bin/find", "/usr/bin/tar", "/usr/bin/sha256sum", "/usr/bin/awk"],
    inspectCacheLinkedFile,
    { concurrency: 2 }
  );
  if (Str.trim(yield* captureGit(root, ["rev-parse", "HEAD"])) !== before)
    return yield* CacheCommandError.new("Workflow revision changed during inspection.");
  return CacheProducerWorkflow.make({ revision: before, files, toolchain, inspectionTools });
}, CacheCommandError.mapError("Cannot inspect the producer workflow."));

/**
 * Derive the domain-separated implementation identity for an observed workflow.
 *
 * **Example** (Reference implementation identity hashing)
 * ```ts
 * import { hashCacheProducerWorkflow } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof hashCacheProducerWorkflow === "function")
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const hashCacheProducerWorkflow = Effect.fn("CacheWorkflow.hash")(function* (workflow: CacheProducerWorkflow) {
  const text = yield* encodeWorkflow(workflow);
  return yield* digest(new TextEncoder().encode(`beep/cache-producer-workflow/v1\0${text}`));
});

/**
 * Execute the owned signed pilot and authenticate only its supervised observation.
 *
 * **Details**
 * Opens an existing issuer fixed to independently supplied approval. Checks the
 * declared workflow identity before and after execution, requires actual-key
 * reader denial, and exposes no arbitrary payload-signing argument. This route
 * neither provisions its own approval nor grants qualification. The approved
 * execution profile must also exclude or bind ignored executable overrides.
 *
 * **Example** (Reference closed supervised issuance)
 * ```ts
 * import { runCacheProducerWorkflow } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof runCacheProducerWorkflow === "function")
 * ```
 *
 * @internal
 * @category commands
 * @since 0.0.0
 */
export const runCacheProducerWorkflow = Effect.fn("CacheWorkflow.run")(function* (
  root: string,
  request: CacheSignedPilotRequest,
  directory: string,
  expected: CacheProducerBinding
) {
  const path = yield* Path.Path;
  const trusted = yield* bindingCodec.encode(expected).pipe(Effect.flatMap(bindingCodec.decode));
  const issuer = yield* openCacheProducerIssuer(directory, trusted);
  const verifyWorkflow = withQualityAdmission(
    AdmissionRequest.make({
      kind: "review-fix",
      weightTokens: 1,
      priority: "verify",
      originKey: "",
      checkoutRoot: root,
      branch: "",
      command: "cache producer workflow identity verification",
    }),
    noAdmissionOriginGate,
    Effect.gen(function* () {
      const workflow = yield* inspectCacheProducerWorkflow(root);
      if (
        workflow.revision !== trusted.workflowRevision ||
        (yield* hashCacheProducerWorkflow(workflow)) !== trusted.workflowImplementation
      )
        return yield* CacheCommandError.new("Live producer workflow differs from its independently approved identity.");
    })
  );
  yield* verifyWorkflow;
  const observation = yield* runCacheSignedPilotExperiment(root, request, O.some(path.join(directory, "issuer.key")));
  yield* verifyWorkflow;
  return CacheProducerObservation.make({ observation, envelope: yield* issuer.issue(observation) });
}, CacheCommandError.mapError("Cannot issue an observation from the approved producer workflow."));
