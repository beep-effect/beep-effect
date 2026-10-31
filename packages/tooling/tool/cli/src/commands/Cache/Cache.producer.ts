/**
 * Closed-key authentication for bounded cache-producer observations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CacheClientPin, CacheQualificationKey, CacheTaskContract } from "@beep/repo-configs/cache";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Crypto from "effect/Crypto";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { readContainedFileBytesNoFollow } from "../../internal/cli/FsGuards.ts";
import {
  currentEffectiveUserIdOption,
  validatePrivateCoordinationDirectory,
} from "../../internal/repo-run/QualityScheduler.ts";
import { validateCacheSignedPilotReceipt } from "./Cache.pilot.signed.ts";
import {
  CacheProducerApproval,
  CacheProducerBinding,
  CacheProducerBody,
  CacheProducerBundle,
  CacheProducerEnvelope,
} from "./Cache.producer.schemas.ts";
import { validateCacheProtocolExecution } from "./Cache.protocol.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import { CacheHostedProducerApproval } from "./Cache.workflow.github.schemas.ts";
import { CacheProducerExecutionProfile } from "./Cache.workflow.schemas.ts";

const encodeApproval = S.encodeEffect(S.fromJsonString(CacheProducerApproval));
const decodeApproval = S.decodeUnknownEffect(S.fromJsonString(CacheProducerApproval));
const decodeHostedApproval = S.decodeUnknownEffect(S.fromJsonString(CacheHostedProducerApproval));
const decodeExecutionProfile = S.decodeUnknownEffect(S.fromJsonString(CacheProducerExecutionProfile));
const encodeContract = S.encodeEffect(S.fromJsonString(CacheTaskContract));
const encodeBinding = S.encodeEffect(S.fromJsonString(CacheProducerBinding));
const decodeBinding = S.decodeUnknownEffect(S.fromJsonString(CacheProducerBinding));
const decodeBindingBytes = S.decodeEffect(S.Uint8ArrayFromHex);
const encodeBody = S.encodeEffect(S.fromJsonString(CacheProducerBody));
const encodeReceipt = S.encodeEffect(S.fromJsonString(CacheProducerBundle));
const digest = S.decodeEffect(Sha256HexFromBytes);
const maxLifetimeMs = Duration.toMillis(Duration.hours(24));
const persistedMaterialBytes = 96;
const sameSignedApprovalBinding = S.toEquivalence(
  S.Struct(
    Struct.pick(CacheProducerBinding.fields, [
      "activatedConfigurationDigest",
      "signedConfigurationDigest",
      "signedRootConfiguration",
      "runtimeKeyDigest",
    ])
  )
);

/**
 * Bind every reviewed task obligation to the producer's policy identity.
 *
 * **Example** (Reference canonical policy hashing)
 * ```ts
 * import { hashCacheProducerContract } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof hashCacheProducerContract === "function")
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const hashCacheProducerContract = Effect.fn("Producer.hashContract")(function* (contract: CacheTaskContract) {
  const text = yield* encodeContract(contract);
  return yield* digest(new TextEncoder().encode(`beep/cache-producer-contract/v1\0${text}`));
});
const validateSignedProducerApproval = Effect.fn("Producer.validateSignedApproval")(function* (
  approval: CacheProducerApproval
) {
  const { binding, contract } = approval;
  if (O.isSome(contract.signedExecution)) {
    const execution = contract.signedExecution.value;
    const expectedKey = CacheQualificationKey.make({
      ...execution.sourceKey,
      profile: `${execution.sourceKey.profile}-private-loopback-signed-v1`,
    });
    if (
      !S.toEquivalence(CacheQualificationKey)(contract.key, expectedKey) ||
      O.isNone(contract.activation) ||
      contract.activation.value.sourceConfiguration !== execution.sourceConfiguration ||
      !sameSignedApprovalBinding(binding, {
        activatedConfigurationDigest: execution.activatedConfiguration,
        signedConfigurationDigest: contract.pins.configuration,
        signedRootConfiguration: execution.signedRootConfiguration.sha256,
        runtimeKeyDigest: execution.runtimeKeys[binding.channel],
      }) ||
      contract.pins.toolchain !== execution.runtimeKeys.stable
    )
      return yield* CacheCommandError.new("Producer approval differs from its reviewed signed execution profile.");
  }
});

/**
 * Check the complete reviewed contract against its fixed producer binding.
 *
 * **Example** (Reference the validation boundary)
 * ```ts
 * import { validateCacheProducerApproval } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof validateCacheProducerApproval === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateCacheProducerApproval = Effect.fn("Producer.validateApproval")(function* (
  approval: CacheProducerApproval
) {
  const { binding, contract } = approval;
  if (
    Str.endsWith("-private-loopback-signed-v1")(contract.key.profile) &&
    (O.isNone(contract.signedExecution) || O.isNone(contract.activation))
  )
    return yield* CacheCommandError.new(
      "Signed producer approval requires a reviewed execution profile and activation."
    );
  const sourceConfiguration = O.match(contract.signedExecution, {
    onNone: () => contract.pins.configuration,
    onSome: (execution) => execution.sourceConfiguration,
  });
  const sourceToolchain = O.match(contract.signedExecution, {
    onNone: () => contract.pins.toolchain,
    onSome: (execution) => execution.sourceToolchain,
  });
  if (
    binding.policyDigest !== (yield* hashCacheProducerContract(contract)) ||
    !S.toEquivalence(CacheQualificationKey)(binding.key, contract.key) ||
    !S.toEquivalence(CacheClientPin)(binding.client, contract.clients[binding.channel]) ||
    binding.configurationDigest !== sourceConfiguration ||
    binding.toolchainDigest !== sourceToolchain
  )
    return yield* CacheCommandError.new("Producer approval's full policy differs from its fixed binding.");
  yield* validateSignedProducerApproval(approval);
});

/**
 * Validate complete native matrices before authenticating their shared payload.
 *
 * **Details**
 * The protocol client is supplied from independent workflow approval. Every
 * signed reader must have demonstrated denial of the actual persistent issuer
 * material. This check grants no qualification or issuer authority itself.
 *
 * **Example** (Reference the complete payload gate)
 * ```ts
 * import { validateCacheProducerBundle } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof validateCacheProducerBundle === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateCacheProducerBundle = Effect.fn("Producer.validateBundle")(function* (
  bundle: CacheProducerBundle,
  protocolClient: CacheClientPin
) {
  const { pilot, protocol } = bundle;
  yield* validateCacheSignedPilotReceipt(pilot);
  yield* validateCacheProtocolExecution(protocol);
  if (
    protocol.observation.channel !== pilot.channel ||
    protocol.bunSha256 !== pilot.bun.sha256 ||
    !S.toEquivalence(CacheClientPin)(protocol.observation.client, protocolClient) ||
    protocolClient.version !== pilot.client.version ||
    protocolClient.sha256 !== pilot.client.sha256 ||
    protocolClient.namespace === pilot.client.namespace ||
    A.some(pilot.comparisons, (pair) => pair.client.namespace === protocolClient.namespace) ||
    A.some(pilot.comparisons, (pair) => O.isNone(pair.protection.issuerMaterialDenied))
  )
    return yield* CacheCommandError.new(
      "Producer bundle lacks independently pinned conformance or persistent issuer protection."
    );
  return bundle;
});
const bindingDigest = Effect.fn("Producer.bindingDigest")(function* (expected: CacheProducerBinding) {
  const text = yield* encodeBinding(expected);
  return yield* digest(new TextEncoder().encode(`beep/cache-producer-approval/v3\0${text}`));
});
/**
 * Check both native matrices against the independently supplied producer identity.
 *
 * **Example** (Reference the validation boundary)
 * ```ts
 * import { validateCacheProducerBinding } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof validateCacheProducerBinding === "function")
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateCacheProducerBinding = Effect.fn("Producer.validateCacheProducerBinding")(function* (
  bundle: CacheProducerBundle,
  expected: CacheProducerBinding
) {
  yield* validateCacheProducerBundle(bundle, expected.protocolClient);
  const receipt = bundle.pilot;
  if (O.isSome(expected.uploadApproval) !== O.isSome(bundle.upload))
    return yield* CacheCommandError.new("Producer upload presence differs from its independently approved target.");
  if (
    O.isSome(expected.uploadApproval) !== O.isSome(bundle.adapterRuntime) ||
    (O.isSome(expected.uploadApproval) &&
      O.isSome(bundle.adapterRuntime) &&
      expected.uploadApproval.value.targetSha256 !== bundle.adapterRuntime.value.targetSha256)
  )
    return yield* CacheCommandError.new(
      "Producer backend lifecycle differs from its independently approved upload target."
    );
  if (
    receipt.sourceRevision !== expected.sourceRevision ||
    receipt.channel !== expected.channel ||
    receipt.runtimeKeyDigest !== expected.runtimeKeyDigest ||
    !S.toEquivalence(CacheQualificationKey)(receipt.key, expected.key) ||
    !S.toEquivalence(CacheClientPin)(receipt.client, expected.client) ||
    receipt.configurationDigest !== expected.configurationDigest ||
    receipt.activatedConfigurationDigest !== expected.activatedConfigurationDigest ||
    receipt.signedConfigurationDigest !== expected.signedConfigurationDigest ||
    receipt.toolchainDigest !== expected.toolchainDigest ||
    receipt.signedRootConfiguration !== expected.signedRootConfiguration
  )
    return yield* CacheCommandError.new("Producer receipt differs from the trusted live binding.");
});

const makeIssuer = Effect.fn("Producer.makeIssuer")(function* (
  expected: CacheProducerBinding,
  material: Redacted.Redacted<Uint8Array>
) {
  const trustedBindingBytes = yield* encodeBinding(expected);
  const bytes = Redacted.value(material);
  const key = Redacted.make(bytes.slice(32, 64));
  const issuer = Sha256Hex.make(Hex.encode(bytes.slice(0, 32)));
  // Effect Crypto provides randomness/digests but no HMAC. Keep this standard
  // Web Crypto operation at the effectful platform boundary; never export the key.
  const secretKey = yield* Effect.tryPromise({
    try: () =>
      globalThis.crypto.subtle.importKey(
        "raw",
        new Uint8Array(Redacted.value(key)),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
      ),
    catch: () => CacheCommandError.new("Cannot initialize producer authentication."),
  });
  const mac = Effect.fn("Producer.mac")(function* (body: CacheProducerBody) {
    const text = yield* encodeBody(body);
    const signature = yield* Effect.tryPromise({
      try: () =>
        globalThis.crypto.subtle.sign(
          "HMAC",
          secretKey,
          new TextEncoder().encode(`beep/cache-producer-envelope/v2\0${text}`)
        ),
      catch: () => CacheCommandError.new("Producer authentication failed."),
    });
    return Sha256Hex.make(Hex.encode(new Uint8Array(signature)));
  });
  const payloadDigest = Effect.fn("Producer.payloadDigest")(function* (receipt: CacheProducerBundle) {
    const text = yield* encodeReceipt(receipt);
    return yield* digest(new TextEncoder().encode(text));
  });
  const issue = Effect.fn("Producer.issue")(function* (receipt: CacheProducerBundle) {
    const trusted = yield* decodeBinding(trustedBindingBytes);
    yield* validateCacheProducerBinding(receipt, trusted);
    const now = yield* Clock.currentTimeMillis;
    const body = CacheProducerBody.make({
      issuer,
      binding: trusted,
      payloadSha256: yield* payloadDigest(receipt),
      issuedAtMs: S.Natural.make(now),
      expiresAtMs: S.Natural.make(now + maxLifetimeMs),
    });
    return CacheProducerEnvelope.make({ body, mac: yield* mac(body) });
  });
  const verify = Effect.fn("Producer.verify")(function* (
    envelope: CacheProducerEnvelope,
    receipt: CacheProducerBundle
  ) {
    const trusted = yield* decodeBinding(trustedBindingBytes);
    const now = yield* Clock.currentTimeMillis;
    if (
      envelope.body.issuer !== issuer ||
      !S.toEquivalence(CacheProducerBinding)(envelope.body.binding, trusted) ||
      envelope.body.issuedAtMs > now ||
      envelope.body.expiresAtMs <= now ||
      envelope.body.expiresAtMs <= envelope.body.issuedAtMs ||
      envelope.body.expiresAtMs - envelope.body.issuedAtMs > maxLifetimeMs
    )
      return yield* CacheCommandError.new("Producer issuer, binding or validity period is invalid.");
    const body = yield* encodeBody(envelope.body);
    const signature = yield* S.decodeEffect(S.Uint8ArrayFromHex)(envelope.mac);
    const validMac = yield* Effect.tryPromise({
      try: () =>
        globalThis.crypto.subtle.verify(
          "HMAC",
          secretKey,
          new Uint8Array(signature),
          new TextEncoder().encode(`beep/cache-producer-envelope/v2\0${body}`)
        ),
      catch: () => CacheCommandError.new("Cannot verify producer authentication."),
    });
    if (!validMac) return yield* CacheCommandError.new("Producer envelope authentication is invalid.");
    if (envelope.body.payloadSha256 !== (yield* payloadDigest(receipt)))
      return yield* CacheCommandError.new("Producer payload differs from its authenticated observation.");
    yield* validateCacheProducerBinding(receipt, trusted);
    return receipt;
  });
  return { issue, verify };
});

/**
 * Create an in-memory issuer bound to independently trusted workflow configuration.
 *
 * **Details**
 * Snapshots expected configuration and generates a private issuer key distinct
 * from artifact signing keys. The caller owns workflow approval. No persistence,
 * public sign-request route or qualification authority is provided here. Keys
 * are never returned; losing this issuer instance invalidates its verification
 * capability. Envelopes expire after at most 24 hours.
 *
 * **Example** (Reference the internal issuer factory)
 * ```ts
 * import { makeCacheProducerIssuer } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof makeCacheProducerIssuer === "function")
 * ```
 *
 * @internal
 * @category fixtures
 * @since 0.0.0
 */
export const makeCacheProducerIssuer = Effect.fn("Producer.makeCacheProducerIssuer")(function* (
  expected: CacheProducerBinding
) {
  const crypto = yield* Crypto.Crypto;
  return yield* makeIssuer(expected, Redacted.make(yield* crypto.randomBytes(64)));
});

/**
 * Require a canonical supervisor-owned private directory for protected records.
 *
 * **Example** (Reference the protected directory boundary)
 * ```ts
 * import { inspectCacheProducerDirectory } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof inspectCacheProducerDirectory === "function")
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const inspectCacheProducerDirectory = Effect.fn("Producer.inspectIssuerDirectory")(function* (
  directory: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const uid = currentEffectiveUserIdOption();
  if (O.isNone(uid) || !path.isAbsolute(directory) || (yield* fs.realPath(directory)) !== path.resolve(directory))
    return yield* CacheCommandError.new("Producer store requires a canonical absolute path and an effective uid.");
  yield* validatePrivateCoordinationDirectory(directory, {
    effectiveUserId: uid,
    label: "Producer store",
    onStatError: () => CacheCommandError.new("Cannot inspect producer store."),
    onViolation: () => CacheCommandError.new("Producer store must be private and owned by the supervisor."),
  });
  return uid.value;
});

/**
 * Require private producer inputs and stores outside the loaded checkout.
 *
 * **Details**
 * Callers also keep every private material copy outside all worker mounts.
 * The protected caller supplies the checkout; experiment requests do not select it.
 *
 * **Example** (Plan an outside-checkout location check)
 * ```ts
 * import { assertCacheProducerPrivateLocation } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * const check = assertCacheProducerPrivateLocation("/checkout", "/private/producer-inputs")
 * console.assert(Effect.isEffect(check))
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const assertCacheProducerPrivateLocation = Effect.fn("Producer.privateLocation")(function* (
  root: string,
  directory: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const source = yield* fs.realPath(root);
  const destination = path.resolve(directory);
  if (!path.isAbsolute(directory) || destination === source || Str.startsWith(`${source}${path.sep}`)(destination))
    return yield* CacheCommandError.new("Producer private location must be absolute and outside its checkout.");
}, CacheCommandError.mapError("Cannot approve the private producer location."));

/**
 * Inspect the common ownership and single-link boundary of a private producer file.
 *
 * **Details**
 * Callers retain their own byte bounds and contained no-follow reads. This check
 * rejects unsafe metadata before either issuer or acceptance bytes are consumed.
 *
 * **Example** (Reference the private metadata boundary)
 * ```ts
 * import { inspectCacheProducerFile } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof inspectCacheProducerFile === "function")
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const inspectCacheProducerFile = Effect.fn("Producer.inspectPrivateFile")(function* (
  file: string,
  uid: number,
  diagnostic: string
) {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(file);
  if (
    info.type !== "File" ||
    (info.mode & 0o777) !== 0o600 ||
    !O.contains(info.uid, uid) ||
    !O.contains(info.nlink, BigInt(1))
  )
    return yield* CacheCommandError.new(diagnostic);
  return info;
});

const readPrivateProducerMaterial = Effect.fn("Producer.readPrivateMaterial")(function* (
  directory: string,
  name: string,
  uid: number
) {
  const path = yield* Path.Path;
  const file = path.join(directory, name);
  const diagnostic = "Producer material must be a private single-link approval-bound file.";
  const info = yield* inspectCacheProducerFile(file, uid, diagnostic);
  if (info.size !== BigInt(persistedMaterialBytes))
    return yield* CacheCommandError.new("Producer material must be a private single-link approval-bound file.");
  const read = yield* readContainedFileBytesNoFollow(directory, file, S.Natural.make(persistedMaterialBytes));
  if (O.isNone(read.contents) || read.contents.value.length !== persistedMaterialBytes)
    return yield* CacheCommandError.new("Producer material is unavailable.");
  return Redacted.make(read.contents.value);
});

const readIssuerMaterial = Effect.fn("Producer.readIssuerMaterial")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const uid = yield* inspectCacheProducerDirectory(directory);
  // readDirectory detects even a dangling revocation marker; errors fail closed.
  const entries = yield* fs.readDirectory(directory);
  if (A.contains(entries, "revoked")) return yield* CacheCommandError.new("Producer issuer is revoked.");
  return yield* readPrivateProducerMaterial(directory, "issuer.key", uid);
}, CacheCommandError.mapError("Producer store is unavailable, unsafe or revoked."));

/**
 * Open an existing supervisor-owned issuer without creating or replacing material.
 *
 * **Details**
 * The directory must be canonical, owner-only and excluded from reader mounts.
 * The caller's expected binding must match the digest fixed at provisioning.
 * Every operation rechecks permissions, revocation and material replacement.
 * The host operator is trusted; these checks do not defend against concurrent
 * malicious filesystem changes by the same uid. Independent workflow approval
 * at provisioning remains the caller's responsibility.
 *
 * **Example** (Reference the internal persistent issuer)
 * ```ts
 * import { openCacheProducerIssuer } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof openCacheProducerIssuer === "function")
 * ```
 *
 * @internal
 * @category fixtures
 * @since 0.0.0
 */
export const openCacheProducerIssuer = Effect.fn("Producer.openCacheProducerIssuer")(function* (
  directory: string,
  expected: CacheProducerBinding
) {
  const trusted = yield* encodeBinding(expected).pipe(Effect.flatMap(decodeBinding));
  const material = yield* readIssuerMaterial(directory);
  const approved = Hex.encode(Redacted.value(material).slice(64));
  if (approved !== (yield* bindingDigest(trusted)))
    return yield* CacheCommandError.new("Producer store was approved for a different workflow or computation binding.");
  const identity = yield* material.pipe(Redacted.value, digest);
  const issuer = yield* makeIssuer(trusted, material);
  const active = Effect.gen(function* () {
    const current = yield* readIssuerMaterial(directory);
    if ((yield* current.pipe(Redacted.value, digest)) !== identity)
      return yield* CacheCommandError.new(
        "Producer material changed; reopen with independently trusted configuration."
      );
  });
  return {
    issue: Effect.fn("Producer.persistentIssue")(function* (receipt: CacheProducerBundle) {
      yield* active;
      return yield* issuer.issue(receipt);
    }),
    verify: Effect.fn("Producer.persistentVerify")(function* (
      envelope: CacheProducerEnvelope,
      receipt: CacheProducerBundle
    ) {
      yield* active;
      return yield* issuer.verify(envelope, receipt);
    }),
  };
});

const readPrivateProducerRecord = Effect.fn("Producer.readPrivateRecord")(function* <Decoded>(
  directory: string,
  name: string,
  description: string,
  decode: (text: string) => Effect.Effect<Decoded, S.SchemaError>
) {
  const path = yield* Path.Path;
  const uid = yield* inspectCacheProducerDirectory(directory);
  const file = path.join(directory, name);
  const limit = 16384;
  const diagnostic = `Producer ${description} must be a bounded private single-link file.`;
  const info = yield* inspectCacheProducerFile(file, uid, diagnostic);
  if (info.size === BigInt(0) || info.size > BigInt(limit)) return yield* CacheCommandError.new(diagnostic);
  const read = yield* readContainedFileBytesNoFollow(directory, file, S.Natural.make(limit));
  if (O.isNone(read.contents)) return yield* CacheCommandError.new(`Producer ${description} is unavailable.`);
  const bytes = read.contents.value;
  const text = yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: () => CacheCommandError.new(`Producer ${description} must be valid UTF-8.`),
  });
  return yield* decode(text);
});

/**
 * Read independently provisioned hosted-publication approval from the issuer store.
 *
 * **Details**
 * Reuses the owner-only directory, bounded single-link/no-follow record reader.
 * Submitted observations cannot select the filename or supply its contents.
 * Callers compare the binding to the current issuer approval and re-read after
 * hosted verification to refuse concurrent replacement or revocation.
 *
 * **Example** (Read the independently approved workflow)
 * ```ts
 * import { readCacheProducerHostedApproval } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 *
 * const approvedWorkflow = readCacheProducerHostedApproval("/private/cache/stable").pipe(
 *   Effect.map((approval) => approval.workflowPath)
 * )
 * // Effect<string, CacheCommandError, FileSystem | Path>; no read until execution.
 * console.assert(Effect.isEffect(approvedWorkflow))
 * ```
 *
 * @param directory - Independently selected owner-only issuer directory.
 * @returns The bounded decoded approval, or a typed failure for missing or unsafe storage.
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const readCacheProducerHostedApproval = Effect.fn("Producer.readHostedApproval")((directory: string) =>
  readPrivateProducerRecord(directory, "publication.json", "hosted publication approval", decodeHostedApproval).pipe(
    CacheCommandError.mapError("Hosted producer approval is unavailable or unsafe.")
  )
);

const readIssuerApproval = Effect.fn("Producer.readIssuerApproval")(function* (directory: string) {
  const approval = yield* readPrivateProducerRecord(directory, "approval.json", "approval", decodeApproval);
  yield* validateCacheProducerApproval(approval);
  return approval;
}, CacheCommandError.mapError("Producer approval is unavailable or unsafe."));

/**
 * Read private approval and optional transferred material outside an execution store.
 *
 * **Details**
 * Only the supervisor selects this directory. Both fixed records use the existing
 * owner-only, single-link, no-follow and sixteen-KiB boundaries. An issuer key or
 * revocation marker refuses the input directory; provisioning does not select
 * approval from an existing execution store or submitted experiment.
 * Optional `issuer.material` uses the same fixed-length private byte reader as
 * execution keys. It stays redacted and must match the approved binding before
 * installation; it is never an observation or public artifact field.
 *
 * **Example** (Read separately prepared approval)
 * ```ts
 * import { readCacheProducerProvisioning } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * const read = readCacheProducerProvisioning("/private/approved-producer-inputs", "/checkout")
 * console.assert(Effect.isEffect(read))
 * ```
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const readCacheProducerProvisioning = Effect.fn("Producer.readProvisioning")(function* (
  directory: string,
  root: string
) {
  yield* assertCacheProducerPrivateLocation(root, directory);
  const uid = yield* inspectCacheProducerDirectory(directory);
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs.readDirectory(directory);
  if (A.some(["issuer.key", "revoked"], (name) => A.contains(entries, name)))
    return yield* CacheCommandError.new("Provisioning inputs must be separate from an issuer store.");
  const approval = yield* readIssuerApproval(directory);
  const profile = yield* readPrivateProducerRecord(
    directory,
    "runtime.json",
    "execution profile",
    decodeExecutionProfile
  );
  const material = A.contains(entries, "issuer.material")
    ? O.some(yield* readPrivateProducerMaterial(directory, "issuer.material", uid))
    : O.none();
  return Tuple.make(approval, profile, material);
}, CacheCommandError.mapError("Cannot read independently selected producer provisioning inputs."));

/**
 * Read execution settings from an independently selected private issuer store.
 *
 * **Details**
 * Opening verifies the approval against existing issuer material and revocation
 * before returning the nonsecret runtime profile. It never provisions, replaces
 * or rebinds an issuer. Submitted experiment requests do not select this store.
 *
 * **Example** (Plan a private configuration read)
 * ```ts
 * import { readCacheProducerExecutionProfile } from "@beep/repo-cli/test/Cache"
 * import * as Effect from "effect/Effect"
 * const read = readCacheProducerExecutionProfile("/private/cache-producer")
 * console.assert(Effect.isEffect(read))
 * ```
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const readCacheProducerExecutionProfile = Effect.fn("Producer.readExecutionProfile")(function* (
  directory: string
) {
  const approval = yield* readIssuerApproval(directory);
  yield* openCacheProducerIssuer(directory, approval.binding);
  const profile = yield* readPrivateProducerRecord(
    directory,
    "runtime.json",
    "execution profile",
    decodeExecutionProfile
  );
  return Tuple.make(approval.binding, profile);
}, CacheCommandError.mapError("Cannot read the independently approved producer execution profile."));

/**
 * Open a verification-only capability from independently provisioned private approval.
 *
 * **Details**
 * The supervisor selects the store outside reader authority. Submitted evidence
 * never selects an issuer or supplies its expected binding. The approval record
 * must match the digest fixed in issuer material; every verification rechecks
 * both records and revocation. No signing method or mutable expected binding is
 * returned. Verification returns a freshly read full approval, not signing
 * authority or mutable verifier state. This authenticates complete observations against a fixed reviewed contract;
 * qualification satisfaction remains a separate gate. Legacy stores without
 * the full approval record fail closed.
 *
 * **Example** (Reference the private approval verifier)
 * ```ts
 * import { openCacheProducerVerifier } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof openCacheProducerVerifier === "function")
 * ```
 *
 * @internal
 * @category fixtures
 * @since 0.0.0
 */
export const openCacheProducerVerifier = Effect.fn("Producer.openCacheProducerVerifier")(function* (directory: string) {
  const trusted = yield* readIssuerApproval(directory);
  const issuer = yield* openCacheProducerIssuer(directory, trusted.binding);
  return {
    verify: Effect.fn("Producer.approvedVerify")(function* (
      envelope: CacheProducerEnvelope,
      receipt: CacheProducerBundle
    ) {
      const current = yield* readIssuerApproval(directory);
      if (!S.toEquivalence(CacheProducerApproval)(current, trusted))
        return yield* CacheCommandError.new("Producer approval changed after verification opened.");
      yield* issuer.verify(envelope, receipt);
      return current;
    }),
  };
});

/**
 * Provision a new private issuer directory exclusively; existing stores are refused.
 *
 * **Details**
 * The parent must already exist. Failed initialization leaves the reserved
 * directory for operator inspection and never silently recreates a lost key.
 * Provisioning fixes the approved workflow/computation binding in the private
 * material and writes the complete reviewed contract to its private approval
 * record. It is an explicit trusted-supervisor action, never an observation
 * import or a receipt-selected key lookup. A new binding requires a new issuer.
 * Callers must keep this location outside every reader mount.
 * An explicitly supplied private material value is installed only for the exact
 * binding encoded in its existing suffix. Installation never generates a new key
 * or silently rebinds transferred material. Omission retains fresh local generation.
 *
 * **Example** (Reference explicit provisioning)
 * ```ts
 * import { initializeCacheProducerIssuer } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof initializeCacheProducerIssuer === "function")
 * ```
 *
 * @internal
 * @category fixtures
 * @since 0.0.0
 */
export const initializeCacheProducerIssuer = Effect.fn("Producer.initializeCacheProducerIssuer")(function* (
  directory: string,
  expected: CacheProducerBinding,
  contract: CacheTaskContract,
  transferred: O.Option<Redacted.Redacted<Uint8Array>> = O.none()
) {
  if (O.exists(transferred, (value) => Redacted.value(value).length !== persistedMaterialBytes))
    return yield* CacheCommandError.new(
      "Transferred producer material differs from its independently approved binding."
    );
  const supplied = O.map(transferred, (value) => Redacted.make(new Uint8Array(Redacted.value(value))));
  const approval = yield* encodeApproval(CacheProducerApproval.make({ binding: expected, contract })).pipe(
    Effect.flatMap(decodeApproval)
  );
  yield* validateCacheProducerApproval(approval);
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Crypto.Crypto;
  if (!path.isAbsolute(directory)) return yield* CacheCommandError.new("Producer store path must be absolute.");
  const trusted = approval.binding;
  const approvedHex = yield* bindingDigest(trusted);
  if (
    O.exists(supplied, (value) => {
      const bytes = Redacted.value(value);
      return Hex.encode(bytes.slice(64)) !== approvedHex;
    })
  )
    return yield* CacheCommandError.new(
      "Transferred producer material differs from its independently approved binding."
    );
  yield* fs.makeDirectory(directory, { mode: 0o700 });
  yield* inspectCacheProducerDirectory(directory);
  yield* fs.writeFileString(path.join(directory, "approval.json"), yield* encodeApproval(approval), {
    flag: "wx",
    mode: 0o600,
  });
  const material = yield* supplied.pipe(
    O.map(Effect.succeed),
    O.getOrElse(
      Effect.fnUntraced(function* () {
        const approved = yield* decodeBindingBytes(approvedHex);
        const bytes = new Uint8Array(persistedMaterialBytes);
        bytes.set(yield* crypto.randomBytes(64));
        bytes.set(approved, 64);
        return Redacted.make(bytes);
      })
    )
  );
  yield* fs.writeFile(path.join(directory, "issuer.key"), Redacted.value(material), { flag: "wx", mode: 0o600 });
  return yield* openCacheProducerIssuer(directory, trusted);
}, CacheCommandError.mapError("Cannot exclusively provision producer store."));

/**
 * Revoke an existing issuer, including instances opened before revocation.
 *
 * **Example** (Reference explicit revocation)
 * ```ts
 * import { revokeCacheProducerIssuer } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof revokeCacheProducerIssuer === "function")
 * ```
 *
 * @internal
 * @category fixtures
 * @since 0.0.0
 */
export const revokeCacheProducerIssuer = Effect.fn("Producer.revokeCacheProducerIssuer")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* inspectCacheProducerDirectory(directory);
  yield* fs.writeFileString(path.join(directory, "revoked"), "revoked\n", { flag: "wx", mode: 0o600 });
}, CacheCommandError.mapError("Cannot revoke producer store."));
