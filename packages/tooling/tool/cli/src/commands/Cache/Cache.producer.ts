/**
 * Closed-key authentication for bounded cache-producer observations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CacheClientPin, CacheQualificationKey } from "@beep/repo-configs/cache";
import { NonNegativeInt, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { Clock, Crypto, Duration, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { readContainedFileBytesNoFollow } from "../../internal/cli/FsGuards.ts";
import {
  currentEffectiveUserIdOption,
  validatePrivateCoordinationDirectory,
} from "../../internal/repo-run/QualityScheduler.ts";
import { CacheSignedPilotReceipt } from "./Cache.pilot.signed.schemas.ts";
import { validateCacheSignedPilotReceipt } from "./Cache.pilot.signed.ts";
import { CacheProducerBinding, CacheProducerBody, CacheProducerEnvelope } from "./Cache.producer.schemas.ts";
import { CacheCommandError } from "./Cache.schemas.ts";

const encodeBinding = S.encodeEffect(S.fromJsonString(CacheProducerBinding));
const decodeBinding = S.decodeUnknownEffect(S.fromJsonString(CacheProducerBinding));
const encodeBody = S.encodeEffect(S.fromJsonString(CacheProducerBody));
const encodeReceipt = S.encodeEffect(S.fromJsonString(CacheSignedPilotReceipt));
const digest = S.decodeEffect(Sha256HexFromBytes);
const maxLifetimeMs = Duration.toMillis(Duration.hours(24));
const persistedMaterialBytes = 96;
const bindingDigest = Effect.fn("Producer.bindingDigest")(function* (expected: CacheProducerBinding) {
  const text = yield* encodeBinding(expected);
  return yield* digest(new TextEncoder().encode(`beep/cache-producer-approval/v1\0${text}`));
});
const verifyBinding = Effect.fn("Producer.verifyBinding")(function* (
  receipt: CacheSignedPilotReceipt,
  expected: CacheProducerBinding
) {
  yield* validateCacheSignedPilotReceipt(receipt);
  if (
    receipt.sourceRevision !== expected.sourceRevision ||
    receipt.channel !== expected.channel ||
    receipt.runtimeKeyDigest !== expected.runtimeKeyDigest ||
    !S.toEquivalence(CacheQualificationKey)(receipt.key, expected.key) ||
    !S.toEquivalence(CacheClientPin)(receipt.client, expected.client) ||
    receipt.configurationDigest !== expected.configurationDigest ||
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
          new TextEncoder().encode(`beep/cache-producer-envelope/v1\0${text}`)
        ),
      catch: () => CacheCommandError.new("Producer authentication failed."),
    });
    return Sha256Hex.make(Hex.encode(new Uint8Array(signature)));
  });
  const payloadDigest = Effect.fn("Producer.payloadDigest")(function* (receipt: CacheSignedPilotReceipt) {
    const text = yield* encodeReceipt(receipt);
    return yield* digest(new TextEncoder().encode(text));
  });
  const issue = Effect.fn("Producer.issue")(function* (receipt: CacheSignedPilotReceipt) {
    const trusted = yield* decodeBinding(trustedBindingBytes);
    yield* verifyBinding(receipt, trusted);
    const now = yield* Clock.currentTimeMillis;
    const body = CacheProducerBody.make({
      issuer,
      binding: trusted,
      payloadSha256: yield* payloadDigest(receipt),
      issuedAtMs: NonNegativeInt.make(now),
      expiresAtMs: NonNegativeInt.make(now + maxLifetimeMs),
    });
    return CacheProducerEnvelope.make({ body, mac: yield* mac(body) });
  });
  const verify = Effect.fn("Producer.verify")(function* (
    envelope: CacheProducerEnvelope,
    receipt: CacheSignedPilotReceipt
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
          new TextEncoder().encode(`beep/cache-producer-envelope/v1\0${body}`)
        ),
      catch: () => CacheCommandError.new("Cannot verify producer authentication."),
    });
    if (!validMac) return yield* CacheCommandError.new("Producer envelope authentication is invalid.");
    if (envelope.body.payloadSha256 !== (yield* payloadDigest(receipt)))
      return yield* CacheCommandError.new("Producer payload differs from its authenticated observation.");
    yield* verifyBinding(receipt, trusted);
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

const inspectIssuerDirectory = Effect.fn("Producer.inspectIssuerDirectory")(function* (directory: string) {
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

const readIssuerMaterial = Effect.fn("Producer.readIssuerMaterial")(
  function* (directory: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const uid = yield* inspectIssuerDirectory(directory);
    // readDirectory detects even a dangling revocation marker; errors fail closed.
    const entries = yield* fs.readDirectory(directory);
    if (A.contains(entries, "revoked")) return yield* CacheCommandError.new("Producer issuer is revoked.");
    const file = path.join(directory, "issuer.key");
    const info = yield* fs.stat(file);
    if (
      info.type !== "File" ||
      (info.mode & 0o777) !== 0o600 ||
      !O.contains(info.uid, uid) ||
      !O.contains(info.nlink, 1) ||
      info.size !== BigInt(persistedMaterialBytes)
    )
      return yield* CacheCommandError.new("Producer material must be a private single-link approval-bound file.");
    const read = yield* readContainedFileBytesNoFollow(directory, file, NonNegativeInt.make(persistedMaterialBytes));
    if (O.isNone(read.contents) || read.contents.value.length !== persistedMaterialBytes)
      return yield* CacheCommandError.new("Producer material is unavailable.");
    return Redacted.make(read.contents.value);
  },
  Effect.mapError(() => CacheCommandError.new("Producer store is unavailable, unsafe or revoked."))
);

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
    issue: Effect.fn("Producer.persistentIssue")(function* (receipt: CacheSignedPilotReceipt) {
      yield* active;
      return yield* issuer.issue(receipt);
    }),
    verify: Effect.fn("Producer.persistentVerify")(function* (
      envelope: CacheProducerEnvelope,
      receipt: CacheSignedPilotReceipt
    ) {
      yield* active;
      return yield* issuer.verify(envelope, receipt);
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
 * material. It is an explicit trusted-supervisor action, never an observation
 * import or a receipt-selected key lookup. A new binding requires a new issuer.
 * Callers must keep this location outside every reader mount.
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
export const initializeCacheProducerIssuer = Effect.fn("Producer.initializeCacheProducerIssuer")(
  function* (directory: string, expected: CacheProducerBinding) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const crypto = yield* Crypto.Crypto;
    if (!path.isAbsolute(directory)) return yield* CacheCommandError.new("Producer store path must be absolute.");
    yield* fs.makeDirectory(directory, { mode: 0o700 });
    yield* inspectIssuerDirectory(directory);
    const trusted = yield* encodeBinding(expected).pipe(Effect.flatMap(decodeBinding));
    const approved = yield* bindingDigest(trusted).pipe(Effect.flatMap(S.decodeEffect(S.Uint8ArrayFromHex)));
    const bytes = new Uint8Array(persistedMaterialBytes);
    bytes.set(yield* crypto.randomBytes(64));
    bytes.set(approved, 64);
    const material = Redacted.make(bytes);
    yield* fs.writeFile(path.join(directory, "issuer.key"), Redacted.value(material), { flag: "wx", mode: 0o600 });
    return yield* openCacheProducerIssuer(directory, trusted);
  },
  Effect.mapError(() => CacheCommandError.new("Cannot exclusively provision producer store."))
);

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
export const revokeCacheProducerIssuer = Effect.fn("Producer.revokeCacheProducerIssuer")(
  function* (directory: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* inspectIssuerDirectory(directory);
    yield* fs.writeFileString(path.join(directory, "revoked"), "revoked\n", { flag: "wx", mode: 0o600 });
  },
  Effect.mapError(() => CacheCommandError.new("Cannot revoke producer store."))
);
