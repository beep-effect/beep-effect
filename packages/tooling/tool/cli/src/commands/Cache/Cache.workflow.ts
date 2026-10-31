/**
 * Bounded provenance checks for explicitly approved cache-producer workflows.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { CacheClientPin } from "@beep/repo-configs/cache";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import { O } from "@beep/utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { OutputBound, runCapturedStreams } from "../../internal/process/index.ts";
import { gitPathListFromNulOutput } from "../../internal/repo-run/GitExec.ts";
import { AdmissionRequest } from "../../internal/repo-run/QualityScheduler.schemas.ts";
import { noAdmissionOriginGate, withQualityAdmission } from "../../internal/repo-run/QualityScheduler.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { CacheProducerAdapterLaunch } from "./Cache.adapter.schemas.ts";
import { CacheConformanceBearers, CacheConformanceTarget } from "./Cache.conformance.schemas.ts";
import { loadCacheConformanceBearers } from "./Cache.conformance.ts";
import { decodeCacheExperimentText, readCacheEvidenceBytes, readCacheExperimentBytes } from "./Cache.evidence.ts";
import { collectCacheToolchain } from "./Cache.fingerprint.ts";
import { inspectCacheLinkedFile } from "./Cache.linker.ts";
import { runCacheProducerUploadExperiment, runCacheSignedPilotExperiment } from "./Cache.pilot.runner.ts";
import { CacheSignedPilotRequest } from "./Cache.pilot.signed.schemas.ts";
import { CacheProducerApproval, CacheProducerBinding, CacheProducerBundle } from "./Cache.producer.schemas.ts";
import {
  assertCacheProducerPrivateLocation,
  initializeCacheProducerIssuer,
  openCacheProducerIssuer,
  readCacheProducerExecutionProfile,
  revokeCacheProducerIssuer,
  validateCacheProducerApproval,
} from "./Cache.producer.ts";
import { CacheProtocolRequest } from "./Cache.protocol.runner.schemas.ts";
import { runCacheProtocolExperiment } from "./Cache.protocol.runner.ts";
import { CacheActivationPreview, CacheCommandError } from "./Cache.schemas.ts";
import {
  CacheProducerExecutionProfile,
  CacheProducerObservation,
  CacheProducerUploadRuntime,
  CacheProducerWorkflow,
  CacheProducerWorkflowFile,
} from "./Cache.workflow.schemas.ts";
import { CacheProducerUploadApproval } from "./Cache.workflow.upload.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.workflow");
const R2StorageEndpoint = S.String.check(S.isPattern(/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com\/$/)).pipe(
  $I.annoteSchema("R2StorageEndpoint", {
    description: "Canonical account-specific R2 storage URL allowed for producer uploads.",
  })
);
const isR2StorageEndpoint = S.is(R2StorageEndpoint);
const bindingCodec = JsonStringCodec(CacheProducerBinding);
const digest = S.decodeEffect(Sha256HexFromBytes);
const decodeRevision = S.decodeUnknownEffect(GitObjectId);
const encodeWorkflow = S.encodeEffect(S.fromJsonString(CacheProducerWorkflow));
const approvalCodec = JsonStringCodec(CacheProducerApproval);
const executionProfileCodec = JsonStringCodec(CacheProducerExecutionProfile);
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
const declaredSourcePaths = [
  "packages",
  "scripts",
  "infra/r2-cache",
  "package.json",
  "bun.lock",
  "bunfig.toml",
  "tsconfig.json",
  "tsconfig.base.json",
  "tsconfig.packages.json",
  ".bun-version",
  ".nvmrc",
];
const listSources = Effect.fn("CacheWorkflow.listSources")(function* (root: string) {
  const output = yield* captureGit(root, [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    ...declaredSourcePaths,
  ]);
  if (!Str.endsWith("\0")(output))
    return yield* CacheCommandError.new("Workflow source inventory is empty or incomplete.");
  const paths = gitPathListFromNulOutput(output);
  if (paths.length > 20000) return yield* CacheCommandError.new("Workflow source inventory exceeded its entry bound.");
  return paths;
});

const AmbientEnvironmentFile = LiteralKit([
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
  ".env.test",
  ".env.test.local",
]);
const isAmbientEnvironmentFile = S.is(AmbientEnvironmentFile);

/**
 * Require committed declared sources without ignored source or local dependency overrides.
 *
 * **Details**
 * Intended for a dedicated execution checkout. Rejects staged, unstaged,
 * untracked and ignored entries under the declared source paths. Root dotenv
 * names are rejected without reading their contents, including dangling aliases.
 * The root dependency view is verified separately by workflow inspection.
 *
 * **Example** (Reference frozen source eligibility)
 * ```ts
 * import { assertCacheProducerWorkflowProfile } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof assertCacheProducerWorkflowProfile === "function")
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const assertCacheProducerWorkflowProfile = Effect.fn("CacheWorkflow.profile")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const status = yield* captureGit(root, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--ignored=matching",
    "--ignore-submodules=none",
    "--",
    ...declaredSourcePaths,
  ]);
  if (status !== "")
    return yield* CacheCommandError.new("Producer workflow requires clean declared sources without ignored overrides.");
  if (A.some(yield* fs.readDirectory(root), isAmbientEnvironmentFile))
    return yield* CacheCommandError.new("Producer workflow must not contain ambient dotenv files.");
}, CacheCommandError.mapError("Cannot validate the frozen producer workflow profile."));

/**
 * Bind the supplied workflow root to this loaded source supervisor.
 *
 * **Example** (Reference loaded implementation binding)
 * ```ts
 * import { assertCacheProducerWorkflowLocation } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof assertCacheProducerWorkflowLocation === "function")
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const assertCacheProducerWorkflowLocation = Effect.fn("CacheWorkflow.location")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const loaded = yield* path.fromFileUrl(new URL(import.meta.url)).pipe(Effect.flatMap(fs.realPath));
  const expected = path.join(
    yield* fs.realPath(root),
    "packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.ts"
  );
  if (loaded !== expected)
    return yield* CacheCommandError.new("Loaded producer workflow does not belong to the requested checkout.");
}, CacheCommandError.mapError("Cannot bind the loaded producer workflow."));

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
 * issuer or approves its own digest. Requires the frozen declared-source profile; the root dependency tree
 * supplies the remaining installed module bindings. This is still not approval.
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
  yield* assertCacheProducerWorkflowProfile(root);
  const files = yield* collectCacheProducerWorkflowFiles(root);
  const toolchain = yield* collectCacheToolchain(root);
  const inspectionTools = yield* Effect.forEach(
    [
      "/usr/bin/git",
      "/usr/bin/bwrap",
      "/usr/bin/find",
      "/usr/bin/tar",
      "/usr/bin/sha256sum",
      "/usr/bin/awk",
      "/usr/bin/python3",
    ],
    inspectCacheLinkedFile,
    { concurrency: 2 }
  );
  if (Str.trim(yield* captureGit(root, ["rev-parse", "HEAD"])) !== before)
    return yield* CacheCommandError.new("Workflow revision changed during inspection.");
  yield* assertCacheProducerWorkflowProfile(root);
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
  return yield* digest(new TextEncoder().encode(`beep/cache-producer-workflow/v2\0${text}`));
});

const assertWorkflowIdentity = Effect.fn("CacheWorkflow.assertIdentity")(function* (
  workflow: CacheProducerWorkflow,
  binding: CacheProducerBinding
) {
  if (
    workflow.revision !== binding.workflowRevision ||
    (yield* hashCacheProducerWorkflow(workflow)) !== binding.workflowImplementation
  )
    return yield* CacheCommandError.new("Live producer workflow differs from its independently approved identity.");
});

/**
 * Hash the approved upload target without serializing any runtime credential.
 *
 * **Example** (Reference target identity hashing)
 * ```ts
 * import { hashCacheProducerUploadTarget } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof hashCacheProducerUploadTarget === "function")
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const hashCacheProducerUploadTarget = Effect.fn("CacheWorkflow.hashUploadTarget")(function* (
  target: CacheConformanceTarget
) {
  const text = yield* JsonStringCodec(CacheConformanceTarget).encode(target);
  return yield* digest(new TextEncoder().encode(`beep/cache-producer-upload-target/v1\0${text}`));
});

/**
 * Derive the artifact-key identity without retaining or publishing its value.
 *
 * **Example** (Reference the key identity boundary)
 * ```ts
 * import { hashCacheProducerUploadKey } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof hashCacheProducerUploadKey === "function")
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const hashCacheProducerUploadKey = Effect.fn("CacheWorkflow.hashUploadKey")((key: Redacted.Redacted<string>) =>
  digest(new TextEncoder().encode(`beep/cache-producer-artifact-key/v1\0${Redacted.value(key)}`))
);

const validateProvidedCacheProducerUploadRuntime = Effect.fn("CacheWorkflow.assertProvidedUploadRuntime")(function* (
  binding: CacheProducerBinding,
  runtime: CacheProducerUploadRuntime
) {
  const targetCodec = JsonStringCodec(CacheConformanceTarget);
  const target = yield* targetCodec.encode(runtime.target).pipe(Effect.flatMap(targetCodec.decode));
  const supplied = runtime;
  const owned = CacheProducerUploadRuntime.make({
    target,
    bearers: CacheConformanceBearers.make({
      reader: supplied.bearers.reader.pipe(Redacted.value, Redacted.make),
      writer: supplied.bearers.writer.pipe(Redacted.value, Redacted.make),
      foreign: supplied.bearers.foreign.pipe(Redacted.value, Redacted.make),
      unknown: supplied.bearers.unknown.pipe(Redacted.value, Redacted.make),
    }),
    signing: supplied.signing.pipe(Redacted.value, Redacted.make),
    adapter: O.map(supplied.adapter, (adapter) =>
      CacheProducerAdapterLaunch.make({
        executable: adapter.executable,
        accessKey: adapter.accessKey.pipe(Redacted.value, Redacted.make),
        secretKey: adapter.secretKey.pipe(Redacted.value, Redacted.make),
      })
    ),
  });
  if (O.isNone(owned.adapter) || O.isNone(target.storage))
    return yield* CacheCommandError.new("Producer upload requires approved storage and an owned adapter capability.");
  if (
    A.some(
      [
        owned.bearers.reader,
        owned.bearers.writer,
        owned.bearers.foreign,
        owned.bearers.unknown,
        owned.adapter.value.accessKey,
        owned.adapter.value.secretKey,
      ],
      (capability) => Redacted.value(capability) === Redacted.value(owned.signing)
    )
  )
    return yield* CacheCommandError.new("Producer artifact signing must be distinct from backend capabilities.");
  const storage = target.storage.value;
  const endpoint = storage.endpoint;
  const url = target.baseUrl;
  const targetDigest = yield* hashCacheProducerUploadTarget(target);
  const keyDigest = yield* hashCacheProducerUploadKey(owned.signing);
  if (
    A.contains(
      [
        url.href === "http://127.0.0.1:19427/",
        S.is(Sha256Hex)(target.backend.digest),
        Str.startsWith("/")(owned.adapter.value.executable),
        isR2StorageEndpoint(endpoint.href),
        storage.bucket === "beep-turbo-r2-pilot",
        target.namespace.teamId === "team_beep_signed_canary_v1",
        target.namespace.teamId === binding.client.namespace,
        target.namespace.teamId !== target.namespace.foreignTeamId,
        target.policy.readerWriterSplit,
        target.policy.tenantBinding,
        O.containsWith(S.toEquivalence(CacheProducerUploadApproval))(
          binding.uploadApproval,
          CacheProducerUploadApproval.make({ targetSha256: targetDigest, artifactKeySha256: keyDigest })
        ),
      ],
      false
    )
  )
    return yield* CacheCommandError.new("Producer upload target differs from its approved bounded pilot profile.");
  return owned;
});

/**
 * Require independent approval of the exact bounded pilot upload destination.
 *
 * **Details**
 * Approval contains paired descriptor and artifact-key digests. Runtime bearers
 * and the key value never enter it. Historical bindings without an upload target can execute
 * their original isolated matrix but cannot perform an external upload.
 *
 * **Example** (Validate a local-only execution without upload capabilities)
 * ```ts
 * import {
 *   assertCacheProducerUploadRuntime,
 *   readCacheProducerExecutionProfile,
 * } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const localOnly = Effect.gen(function* () {
 *   const [binding] = yield* readCacheProducerExecutionProfile("/private/local-only-producer")
 *   // An upload-approved binding refuses absent capabilities instead of uploading.
 *   return yield* assertCacheProducerUploadRuntime(binding, O.none())
 * })
 * console.assert(Effect.isEffect(localOnly))
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const assertCacheProducerUploadRuntime = Effect.fn("CacheWorkflow.assertUploadRuntime")(function* (
  binding: CacheProducerBinding,
  runtime: O.Option<CacheProducerUploadRuntime>
) {
  if (O.isSome(binding.uploadApproval) !== O.isSome(runtime))
    return yield* CacheCommandError.new("Producer upload runtime differs from independent target approval.");
  return yield* O.match(runtime, {
    onNone: () => Effect.succeedNone,
    onSome: (provided) => validateProvidedCacheProducerUploadRuntime(binding, provided).pipe(Effect.asSome),
  });
});

/**
 * Load capabilities for an existing independently approved producer store.
 *
 * **Details**
 * Private approval and runtime records are checked before credentials are read.
 * The destination must match independent approval, and the resulting capability
 * must satisfy the same target, key and adapter checks as the owned executor.
 * This never creates an issuer or accepts configuration from an experiment.
 *
 * **Example** (Plan capability loading)
 * ```ts
 * import { loadCacheProducerExecutionRuntime } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * const load = loadCacheProducerExecutionRuntime("/private/cache-producer")
 * console.assert(Effect.isEffect(load))
 * ```
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const loadCacheProducerExecutionRuntime = Effect.fn("CacheWorkflow.loadExecutionRuntime")(function* (
  directory: string
) {
  const [binding, profile] = yield* readCacheProducerExecutionProfile(directory);
  const approval = yield* binding.uploadApproval.pipe(
    Effect.fromOption(() => CacheCommandError.new("The producer store has no independently approved upload."))
  );
  if ((yield* hashCacheProducerUploadTarget(profile.target)) !== approval.targetSha256)
    return yield* CacheCommandError.new("The private producer destination differs from independent approval.");
  const capabilities = yield* Config.all({
    signing: Config.Redacted("TURBO_REMOTE_CACHE_SIGNATURE_KEY"),
    accessKey: Config.Redacted("R2_ACCESS_KEY_ID"),
    secretKey: Config.Redacted("R2_SECRET_ACCESS_KEY"),
  }).pipe(
    Effect.mapError(() => CacheCommandError.new("Approved producer signing and storage capabilities are required."))
  );
  const runtime = CacheProducerUploadRuntime.make({
    target: profile.target,
    bearers: yield* loadCacheConformanceBearers(profile.target),
    signing: capabilities.signing,
    adapter: O.some(
      CacheProducerAdapterLaunch.make({
        executable: profile.adapterExecutable,
        accessKey: capabilities.accessKey,
        secretKey: capabilities.secretKey,
      })
    ),
  });
  const owned = yield* validateProvidedCacheProducerUploadRuntime(binding, runtime);
  return Tuple.make(binding, owned);
}, CacheCommandError.mapError("Cannot load independently approved producer execution capabilities."));

/**
 * Exclusively provision an execution store from separately approved source and target identities.
 *
 * **Details**
 * This explicit supervisor operation loads no runtime credentials and never
 * derives approval from an experiment. It verifies the loaded checkout and
 * frozen workflow before creating material, checks the target and executable
 * digest, and preserves the existing exclusive issuer initializer. Failed or
 * interrupted profile installation revokes the reserved store; no retry can
 * overwrite it. The parent must exist and the store must be outside this checkout.
 * Transferred private material retains the independently approved issuer across
 * hosts; it is never rebound to the inspected workflow.
 *
 * **Example** (Reference trusted execution provisioning)
 * ```ts
 * import { initializeCacheProducerExecution, readCacheProducerProvisioning } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * const provision = Effect.gen(function* () {
 *   const [approval, profile, material] = yield* readCacheProducerProvisioning("/private/approved-inputs", "/checkout")
 *   yield* initializeCacheProducerExecution("/checkout", "/private/producer-store", approval, profile, material)
 * })
 * console.assert(Effect.isEffect(provision))
 * ```
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const initializeCacheProducerExecution = Effect.fn("CacheWorkflow.initializeExecution")(
  function* (
    root: string,
    directory: string,
    approval: CacheProducerApproval,
    profile: CacheProducerExecutionProfile,
    material: O.Option<Redacted.Redacted<Uint8Array>> = O.none()
  ) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* assertCacheProducerWorkflowLocation(root);
    yield* assertCacheProducerPrivateLocation(root, directory);
    const approvedText = yield* approvalCodec.encode(approval);
    const profileText = yield* executionProfileCodec.encode(profile);
    if (A.some([approvedText, profileText], (text) => new TextEncoder().encode(text).byteLength > 16384))
      return yield* CacheCommandError.new("Producer provisioning records exceed their sixteen KiB private-read bound.");
    const trusted = yield* approvalCodec.decode(approvedText);
    const selected = yield* executionProfileCodec.decode(profileText);
    yield* validateCacheProducerApproval(trusted);
    const upload = yield* trusted.binding.uploadApproval.pipe(
      Effect.fromOption(() => CacheCommandError.new("Producer provisioning requires independent upload approval."))
    );
    if ((yield* hashCacheProducerUploadTarget(selected.target)) !== upload.targetSha256)
      return yield* CacheCommandError.new("Producer provisioning target differs from independent approval.");
    if (!path.isAbsolute(selected.adapterExecutable))
      return yield* CacheCommandError.new("Producer provisioning requires an absolute adapter executable.");
    const executable = yield* inspectCacheLinkedFile(selected.adapterExecutable);
    if (executable.sha256 !== selected.target.backend.digest)
      return yield* CacheCommandError.new("Producer provisioning executable differs from its approved digest.");
    yield* assertWorkflowIdentity(yield* inspectCacheProducerWorkflow(root), trusted.binding);
    yield* Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* () {
        yield* initializeCacheProducerIssuer(directory, trusted.binding, trusted.contract, material);
        yield* restore(
          Effect.gen(function* () {
            yield* fs.writeFileString(path.join(directory, "runtime.json"), profileText, { flag: "wx", mode: 0o600 });
            const [, installed] = yield* readCacheProducerExecutionProfile(directory);
            if ((yield* executionProfileCodec.encode(installed)) !== profileText)
              return yield* CacheCommandError.new(
                "Installed producer execution profile differs from independent selection."
              );
            yield* assertWorkflowIdentity(yield* inspectCacheProducerWorkflow(root), trusted.binding);
          })
        ).pipe(Effect.onError(() => revokeCacheProducerIssuer(directory).pipe(Effect.orDie)));
      })
    );
  },
  Effect.asVoid,
  CacheCommandError.mapError("Cannot exclusively provision independently approved producer execution.")
);

/**
 * Execute the owned signed pilot and authenticate only its supervised observation.
 *
 * **Details**
 * Opens an existing issuer fixed to independently supplied approval. Checks the
 * declared workflow identity before and after execution, requires actual-key
 * reader denial, and exposes no arbitrary payload-signing argument. This route
 * neither provisions its own approval nor grants qualification. The approved
 * execution profile rejects ignored source and local dependency overrides.
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
  expected: CacheProducerBinding,
  uploadRuntime: O.Option<CacheProducerUploadRuntime> = O.none()
) {
  const path = yield* Path.Path;
  const requestCodec = JsonStringCodec(CacheSignedPilotRequest);
  const ownedRequest = yield* requestCodec.encode(request).pipe(Effect.flatMap(requestCodec.decode));
  yield* assertCacheProducerWorkflowLocation(root);
  const trusted = yield* bindingCodec.encode(expected).pipe(Effect.flatMap(bindingCodec.decode));
  if (
    ownedRequest.pilot.channel !== trusted.channel ||
    !S.toEquivalence(CacheClientPin)(ownedRequest.pilot.client, trusted.client)
  )
    return yield* CacheCommandError.new("Producer request differs from its independently approved client or channel.");
  const runtime = yield* assertCacheProducerUploadRuntime(trusted, uploadRuntime);
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
      yield* assertCacheProducerWorkflowProfile(ownedRequest.sourceRoot);
      const sourceRevision = yield* captureGit(ownedRequest.sourceRoot, ["rev-parse", "HEAD"]).pipe(
        Effect.map(Str.trim),
        Effect.flatMap(decodeRevision)
      );
      if (sourceRevision !== trusted.sourceRevision)
        return yield* CacheCommandError.new("Live producer source differs from its independently approved revision.");
      yield* assertWorkflowIdentity(workflow, trusted);
    })
  );
  yield* verifyWorkflow;
  const pilot = yield* runCacheSignedPilotExperiment(root, ownedRequest, O.some(path.join(directory, "issuer.key")));
  yield* verifyWorkflow;
  const protocol = yield* runCacheProtocolExperiment(
    root,
    CacheProtocolRequest.make({
      channel: trusted.channel,
      client: trusted.protocolClient,
      executable: ownedRequest.pilot.executable,
    })
  );
  const uploadObservation = yield* O.match(runtime, {
    onNone: () => Effect.succeedNone,
    onSome: Effect.fn("CacheWorkflow.executeOwnedUpload")(function* (runtime) {
      yield* verifyWorkflow;
      const activation = yield* readCacheEvidenceBytes(ownedRequest.sourceRoot, ownedRequest.pilot.activation).pipe(
        Effect.flatMap(decodeCacheExperimentText),
        Effect.flatMap(JsonStringCodec(CacheActivationPreview).decode)
      );
      if (activation.source.configurationDigest !== trusted.configurationDigest)
        return yield* CacheCommandError.new("Producer task closure differs from independent configuration approval.");
      const expectedTasks = A.map(activation.source.configuration.nodes, (node) => node.id);
      return yield* runCacheProducerUploadExperiment(
        root,
        ownedRequest,
        runtime,
        trusted,
        expectedTasks,
        path.join(directory, "issuer.key")
      ).pipe(Effect.asSome);
    }),
  });
  const observation = CacheProducerBundle.make({
    pilot,
    protocol,
    upload: O.map(uploadObservation, Tuple.get(0)),
    adapterRuntime: O.map(uploadObservation, Tuple.get(1)),
  });
  yield* verifyWorkflow;
  return CacheProducerObservation.make({ observation, envelope: yield* issuer.issue(observation) });
}, CacheCommandError.mapError("Cannot issue an observation from the approved producer workflow."));
