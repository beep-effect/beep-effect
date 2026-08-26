/**
 * Encrypted raw archive helpers for repo AI metrics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit, Sha256Hex } from "@beep/schema";
import { Str } from "@beep/utils";
import { Clock, Effect, Encoding, FileSystem, Path, Redacted, Result } from "effect";
import * as S from "effect/Schema";
import { AiMetricsTranscriptSource } from "./models.ts";
import { hashPrivateIdentifier, hashPublicTextSha256 } from "./privacy.ts";
import type * as O from "@beep/utils/Option";

const $I = $RepoAiMetricsId.create("archive");
const AES_GCM_KEY_BYTES = 32;
const AES_GCM_NONCE_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const ArchiveSha256Hex = S.toEncoded(Sha256Hex).pipe(
  $I.annoteSchema("ArchiveSha256Hex", {
    description: "Canonical lowercase SHA-256 digest stored in an archive model.",
  })
);

const decodedBase64ByteLengthSatisfies = (predicate: (byteLength: number) => boolean) => (value: string) =>
  Result.match(Encoding.decodeBase64(value), {
    onFailure: () => false,
    onSuccess: (bytes) => predicate(bytes.byteLength),
  });

const Aes256KeyBase64 = S.String.check(
  S.isBase64({
    identifier: $I`Aes256KeyBase64ShapeCheck`,
    title: "AES-256 Key Base64 Shape",
    description: "A standard Base64 string containing AES-256 key bytes.",
    message: "Raw archive key must be valid standard Base64",
  }),
  S.makeFilter(
    decodedBase64ByteLengthSatisfies((byteLength) => byteLength === AES_GCM_KEY_BYTES),
    {
      identifier: $I`Aes256KeyByteLengthCheck`,
      title: "AES-256 Key Byte Length",
      description: "A Base64 value that decodes to exactly 32 AES-256 key bytes.",
      message: "Raw archive key must decode to exactly 32 bytes for AES-256-GCM",
    }
  )
).pipe(
  $I.annoteSchema("Aes256KeyBase64", {
    description: "Standard Base64 encoding of an exact 32-byte AES-256 key.",
  })
);

const AesGcmNonceBase64 = S.String.check(
  S.isBase64({
    identifier: $I`AesGcmNonceBase64ShapeCheck`,
    title: "AES-GCM Nonce Base64 Shape",
    description: "A standard Base64 string containing an AES-GCM nonce.",
    message: "Archive envelope nonce must be valid standard Base64",
  }),
  S.makeFilter(
    decodedBase64ByteLengthSatisfies((byteLength) => byteLength === AES_GCM_NONCE_BYTES),
    {
      identifier: $I`AesGcmNonceByteLengthCheck`,
      title: "AES-GCM Nonce Byte Length",
      description: "A Base64 value that decodes to exactly 12 nonce bytes.",
      message: "Archive envelope nonce must decode to exactly 12 bytes",
    }
  )
).pipe(
  $I.annoteSchema("AesGcmNonceBase64", {
    description: "Standard Base64 encoding of the exact 12-byte nonce generated for an archive envelope.",
  })
);

const AesGcmCiphertextBase64 = S.String.check(
  S.isBase64({
    identifier: $I`AesGcmCiphertextBase64ShapeCheck`,
    title: "AES-GCM Ciphertext Base64 Shape",
    description: "A standard Base64 string containing AES-GCM ciphertext and its authentication tag.",
    message: "Archive envelope ciphertext must be valid standard Base64",
  }),
  S.makeFilter(
    decodedBase64ByteLengthSatisfies((byteLength) => byteLength >= AES_GCM_TAG_BYTES),
    {
      identifier: $I`AesGcmCiphertextTagLengthCheck`,
      title: "AES-GCM Ciphertext Tag Length",
      description: "Ciphertext bytes long enough to contain the 16-byte AES-GCM authentication tag.",
      message: "Archive envelope ciphertext must include a 16-byte AES-GCM authentication tag",
    }
  )
).pipe(
  $I.annoteSchema("AesGcmCiphertextBase64", {
    description: "Standard Base64 encoding of AES-GCM ciphertext with its appended authentication tag.",
  })
);

const AiMetricsRawArchiveObjectId = S.String.check(
  S.isPattern(/^raw-[0-9a-f]{64}$/u, {
    identifier: $I`AiMetricsRawArchiveObjectIdShapeCheck`,
    title: "AI Metrics Raw Archive Object Id Shape",
    description: "A raw- prefix followed by one lowercase SHA-256 hexadecimal digest.",
    message: "Raw archive object id must be 'raw-' followed by 64 lowercase hexadecimal characters",
  })
).pipe(
  $I.annoteSchema("AiMetricsRawArchiveObjectId", {
    description: "Content-addressed raw archive object id derived from a SHA-256 digest.",
  })
);

/**
 * Encryption algorithm used by every raw AI metrics archive envelope.
 *
 * **Example** (Read the archive algorithm)
 *
 * ```ts
 * import { AiMetricsArchiveAlgorithm } from "@beep/repo-ai-metrics"
 *
 * console.log(AiMetricsArchiveAlgorithm.Enum["AES-256-GCM"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsArchiveAlgorithm = LiteralKit(["AES-256-GCM"]).pipe(
  $I.annoteSchema("AiMetricsArchiveAlgorithm", {
    description: "Encryption algorithm identifier shared by raw AI metrics archive models.",
  })
);

/**
 * Runtime type for {@link AiMetricsArchiveAlgorithm}.
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsArchiveAlgorithm = typeof AiMetricsArchiveAlgorithm.Type;

/**
 * Error raised by AI metrics encrypted archive helpers.
 *
 * **Example** (Make archive error instance)
 *
 * ```ts
 * import { AiMetricsArchiveError } from "@beep/repo-ai-metrics"
 * const error = AiMetricsArchiveError.make({
 *   cause: "boom",
 *   message: "Archive failed."
 * })
 * console.log(error)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AiMetricsArchiveError extends S.TaggedError<AiMetricsArchiveError>($I`AiMetricsArchiveError`)(
  "AiMetricsArchiveError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annoteError<AiMetricsArchiveError>("AiMetricsArchiveError", {
    description: "Typed failure raised while encrypting or reading AI metrics raw archive objects.",
  })
) {}

/**
 * Encrypted raw transcript archive envelope stored on disk.
 *
 * **Example** (Build encrypted archive envelope)
 *
 * ```ts
 * import {
 *   AiMetricsArchiveAlgorithm,
 *   AiMetricsEncryptedRawArchiveEnvelope
 * } from "@beep/repo-ai-metrics"
 *
 * const envelope = AiMetricsEncryptedRawArchiveEnvelope.make({
 *   algorithm: AiMetricsArchiveAlgorithm.Enum["AES-256-GCM"],
 *   archiveObjectId: "raw-2222222222222222222222222222222222222222222222222222222222222222",
 *   ciphertextBase64: "AAAAAAAAAAAAAAAAAAAAAA==",
 *   encryptedAtEpochMillis: 1_717_000_000_000,
 *   nonceBase64: "AAAAAAAAAAAAAAAA",
 *   plaintextContentHash: "0000000000000000000000000000000000000000000000000000000000000000",
 *   sourceKind: "codex",
 *   sourcePathHash: "1111111111111111111111111111111111111111111111111111111111111111"
 * })
 * console.log(envelope.algorithm)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsEncryptedRawArchiveEnvelope extends S.Class<AiMetricsEncryptedRawArchiveEnvelope>(
  $I`AiMetricsEncryptedRawArchiveEnvelope`
)(
  {
    algorithm: AiMetricsArchiveAlgorithm,
    archiveObjectId: AiMetricsRawArchiveObjectId,
    ciphertextBase64: AesGcmCiphertextBase64,
    encryptedAtEpochMillis: S.Natural,
    nonceBase64: AesGcmNonceBase64,
    plaintextContentHash: ArchiveSha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: ArchiveSha256Hex,
  },
  $I.annote("AiMetricsEncryptedRawArchiveEnvelope", {
    description: "Encrypted raw transcript archive envelope with private source paths represented by salted hashes.",
  })
) {
  static readonly decodeUnknownEffectFromJsonString = S.decodeUnknownEffect(
    S.fromJsonString(AiMetricsEncryptedRawArchiveEnvelope)
  );
  static readonly decodeUnknownResultFromJsonString = S.decodeUnknownResult(
    S.fromJsonString(AiMetricsEncryptedRawArchiveEnvelope)
  );
  static readonly encodeUnknownEffectFromJsonString = S.encodeUnknownEffect(
    S.fromJsonString(AiMetricsEncryptedRawArchiveEnvelope)
  );
  static readonly encodeUnknownResultFromJsonString = S.encodeUnknownResult(
    S.fromJsonString(AiMetricsEncryptedRawArchiveEnvelope)
  );
}

/**
 * Safe archive object metadata returned after an encrypted write or lookup.
 *
 * **Example** (Create raw archive object)
 *
 * ```ts
 * import { AiMetricsArchiveAlgorithm, AiMetricsRawArchiveObject } from "@beep/repo-ai-metrics"
 *
 * const object = AiMetricsRawArchiveObject.make({
 *   algorithm: AiMetricsArchiveAlgorithm.Enum["AES-256-GCM"],
 *   archiveObjectId: "raw-2222222222222222222222222222222222222222222222222222222222222222",
 *   archivePath: ".beep/ai-metrics/raw/codex/raw-2222222222222222222222222222222222222222222222222222222222222222.json",
 *   created: true,
 *   encryptedAtEpochMillis: 1_717_000_000_000,
 *   plaintextContentHash: "0000000000000000000000000000000000000000000000000000000000000000",
 *   sourceKind: "codex",
 *   sourcePathHash: "1111111111111111111111111111111111111111111111111111111111111111"
 * })
 * console.log(object.created)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiMetricsRawArchiveObject extends S.Class<AiMetricsRawArchiveObject>($I`AiMetricsRawArchiveObject`)(
  {
    algorithm: AiMetricsArchiveAlgorithm,
    archiveObjectId: AiMetricsRawArchiveObjectId,
    archivePath: S.String,
    created: S.Boolean,
    encryptedAtEpochMillis: S.Natural,
    plaintextContentHash: ArchiveSha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    sourcePathHash: ArchiveSha256Hex,
  },
  $I.annote("AiMetricsRawArchiveObject", {
    description: "Safe metadata for one encrypted raw transcript archive object.",
  })
) {}

/**
 * Redacted base64 AES-256-GCM key used for raw archive encryption.
 *
 * **Example** (Create redacted archive key)
 *
 * ```ts
 * import { AiMetricsRawArchiveKey } from "@beep/repo-ai-metrics"
 * import { Redacted } from "effect"
 * const key: AiMetricsRawArchiveKey = Redacted.make("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
 * console.log(key)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiMetricsRawArchiveKey = Aes256KeyBase64.pipe(
  S.RedactedFromValue,
  $I.annoteSchema("AiMetricsRawArchiveKey", {
    description: "Redacted base64 AES-256-GCM key used for raw archive encryption.",
  })
);

/**
 * Type for {@link AiMetricsRawArchiveKey}.
 *
 * **Example** (Type redacted archive key)
 *
 * ```ts
 * import type { AiMetricsRawArchiveKey } from "@beep/repo-ai-metrics"
 * import { Redacted } from "effect"
 * const key: AiMetricsRawArchiveKey = Redacted.make("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
 * console.log(key)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiMetricsRawArchiveKey = typeof AiMetricsRawArchiveKey.Type;

const decodeAes256KeyBase64 = S.decodeEffect(Aes256KeyBase64);

const archiveFailure = (message: string, cause: unknown): AiMetricsArchiveError =>
  AiMetricsArchiveError.make({ cause, message });

const decodeRawArchiveKey = (rawArchiveKey: AiMetricsRawArchiveKey): Effect.Effect<Uint8Array, AiMetricsArchiveError> =>
  decodeAes256KeyBase64(Str.trim(Redacted.value(rawArchiveKey))).pipe(
    Effect.flatMap(S.decodeEffect(S.Uint8ArrayFromBase64)),
    Effect.mapError((cause) =>
      archiveFailure("Raw archive key must be valid base64 and decode to exactly 32 bytes.", cause)
    )
  );

const importRawArchiveKey = (rawArchiveKey: AiMetricsRawArchiveKey): Effect.Effect<CryptoKey, AiMetricsArchiveError> =>
  Effect.flatMap(decodeRawArchiveKey(rawArchiveKey), (bytes) =>
    Effect.tryPromise({
      try: () =>
        globalThis.crypto.subtle.importKey("raw", cryptoBytes(bytes), "AES-GCM", false, ["encrypt", "decrypt"]),
      catch: (cause) => archiveFailure("Failed to import raw archive encryption key.", cause),
    })
  );

const cryptoBytes = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
};

const randomNonce = (): Uint8Array => {
  const nonce = new Uint8Array(AES_GCM_NONCE_BYTES);
  globalThis.crypto.getRandomValues(nonce);
  return nonce;
};

const archiveObjectIdFor = Effect.fn("AiMetrics.archiveObjectIdFor")(function* (
  sourceKind: AiMetricsTranscriptSource,
  sourcePathHash: string,
  plaintextContentHash: string
) {
  const digest = yield* hashPublicTextSha256(
    `ai-metrics-raw-archive-v1\u0000${sourceKind}\u0000${sourcePathHash}\u0000${plaintextContentHash}`
  ).pipe(Effect.mapError((cause) => archiveFailure("Failed to compute raw archive object id.", cause)));

  return `raw-${digest}`;
});

const archiveObjectPath = (
  pathApi: Path.Path,
  rawArchiveDir: string,
  sourceKind: AiMetricsTranscriptSource,
  archiveObjectId: string
): string => pathApi.join(rawArchiveDir, sourceKind, `${archiveObjectId}.json`);

const envelopeToObject = (
  archivePath: string,
  envelope: AiMetricsEncryptedRawArchiveEnvelope,
  created: boolean
): AiMetricsRawArchiveObject =>
  AiMetricsRawArchiveObject.make({
    algorithm: envelope.algorithm,
    archiveObjectId: envelope.archiveObjectId,
    archivePath,
    created,
    encryptedAtEpochMillis: envelope.encryptedAtEpochMillis,
    plaintextContentHash: envelope.plaintextContentHash,
    sourceKind: envelope.sourceKind,
    sourcePathHash: envelope.sourcePathHash,
  });

const readExistingArchiveObject = Effect.fn("AiMetrics.readExistingArchiveObject")(function* (archivePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const envelopeText = yield* fs
    .readFileString(archivePath)
    .pipe(
      Effect.mapError((cause) => archiveFailure(`Failed to read existing archive object "${archivePath}".`, cause))
    );
  const envelope = yield* AiMetricsEncryptedRawArchiveEnvelope.decodeUnknownEffectFromJsonString(envelopeText).pipe(
    Effect.mapError((cause) => archiveFailure(`Failed to decode existing archive object "${archivePath}".`, cause))
  );

  return envelopeToObject(archivePath, envelope, false);
});

/**
 * Write one raw transcript file into the encrypted content-addressed archive.
 *
 * **Details**
 *
 * The raw archive key is unwrapped only inside the crypto import boundary.
 *
 * **Example** (Write encrypted raw archive)
 *
 * ```ts
 * import {
 *   AiMetricsTranscriptSource,
 *   writeEncryptedRawArchiveObject
 * } from "@beep/repo-ai-metrics"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect, Redacted } from "effect"
 * import * as O from "effect/Option"
 * const program = writeEncryptedRawArchiveObject({
 *   content: "{\"type\":\"event_msg\"}",
 *   hashSalt: O.some("fixture-salt"),
 *   rawArchiveDir: ".ai-metrics/raw",
 *   rawArchiveKey: Redacted.make("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
 *   sourceKind: AiMetricsTranscriptSource.Enum.codex,
 *   sourcePath: "session.jsonl"
 * }).pipe(Effect.provide(NodeServices.layer))
 * const archiveObjectId = Effect.runPromise(Effect.map(program, (object) => object.archiveObjectId))
 * console.log(archiveObjectId)
 * ```
 *
 * @effects
 * - Reads `globalThis.crypto` for AES-GCM key import, nonce generation, and encryption.
 * - Creates the source-kind archive directory when missing.
 * - Writes one JSON envelope unless the content-addressed object already exists.
 * - Reads and decodes the existing envelope when the object is already archived.
 * @category services
 * @since 0.0.0
 */
export const writeEncryptedRawArchiveObject = Effect.fn("AiMetrics.writeEncryptedRawArchiveObject")(
  function* ({
    content,
    hashSalt,
    rawArchiveDir,
    rawArchiveKey,
    sourceKind,
    sourcePath,
  }: {
    readonly content: string;
    readonly hashSalt: O.Option<string>;
    readonly rawArchiveDir: string;
    readonly rawArchiveKey: AiMetricsRawArchiveKey;
    readonly sourceKind: AiMetricsTranscriptSource;
    readonly sourcePath: string;
  }) {
    const fs = yield* FileSystem.FileSystem;
    const pathApi = yield* Path.Path;
    const sourcePathHash = yield* hashPrivateIdentifier(sourcePath, hashSalt).pipe(
      Effect.mapError((cause) => archiveFailure("Failed to hash raw archive source path.", cause))
    );
    const plaintextContentHash = yield* hashPrivateIdentifier(content, hashSalt).pipe(
      Effect.mapError((cause) => archiveFailure("Failed to hash raw archive plaintext identity.", cause))
    );
    const archiveObjectId = yield* archiveObjectIdFor(sourceKind, sourcePathHash, plaintextContentHash);
    const archivePath = archiveObjectPath(pathApi, rawArchiveDir, sourceKind, archiveObjectId);
    const alreadyArchived = yield* fs.exists(archivePath);
    if (alreadyArchived) {
      return yield* readExistingArchiveObject(archivePath);
    }

    const key = yield* importRawArchiveKey(rawArchiveKey);
    const nonce = randomNonce();
    const ciphertext = yield* Effect.tryPromise({
      try: () =>
        globalThis.crypto.subtle.encrypt(
          { iv: cryptoBytes(nonce), name: "AES-GCM" },
          key,
          new TextEncoder().encode(content)
        ),
      catch: (cause) => archiveFailure("Failed to encrypt raw archive object.", cause),
    });
    const encryptedAtEpochMillis = yield* Clock.currentTimeMillis;
    const envelope = AiMetricsEncryptedRawArchiveEnvelope.make({
      algorithm: AiMetricsArchiveAlgorithm.Enum["AES-256-GCM"],
      archiveObjectId,
      ciphertextBase64: Encoding.encodeBase64(new Uint8Array(ciphertext)),
      encryptedAtEpochMillis,
      nonceBase64: Encoding.encodeBase64(nonce),
      plaintextContentHash,
      sourceKind,
      sourcePathHash,
    });
    const envelopeText = yield* AiMetricsEncryptedRawArchiveEnvelope.encodeUnknownEffectFromJsonString(envelope).pipe(
      Effect.mapError((cause) => archiveFailure("Failed to encode raw archive envelope.", cause))
    );

    yield* fs
      .makeDirectory(pathApi.dirname(archivePath), { recursive: true })
      .pipe(
        Effect.mapError((cause) =>
          archiveFailure(`Failed to create raw archive directory for "${archivePath}".`, cause)
        )
      );
    yield* fs
      .writeFileString(archivePath, envelopeText)
      .pipe(Effect.mapError((cause) => archiveFailure(`Failed to write raw archive object "${archivePath}".`, cause)));

    return envelopeToObject(archivePath, envelope, true);
  },
  (effect, input) =>
    effect.pipe(
      Effect.withSpan("repo_ai_metrics.archive.write", {
        attributes: {
          "ai_metrics.source_kind": input.sourceKind,
        },
      })
    )
);

/**
 * Decrypt an archive envelope for package-level verification.
 *
 * **Details**
 *
 * P2 intentionally does not expose this as a CLI command.
 * Decryption is package-level verification support, not a user-facing CLI path.
 *
 * **Example** (Decrypt archive envelope)
 *
 * ```ts
 * import {
 *   AiMetricsArchiveAlgorithm,
 *   AiMetricsEncryptedRawArchiveEnvelope,
 *   decryptEncryptedRawArchiveEnvelope
 * } from "@beep/repo-ai-metrics"
 * import { Redacted } from "effect"
 * const program = decryptEncryptedRawArchiveEnvelope({
 *   envelope: AiMetricsEncryptedRawArchiveEnvelope.make({
 *     algorithm: AiMetricsArchiveAlgorithm.Enum["AES-256-GCM"],
 *     archiveObjectId: "raw-2222222222222222222222222222222222222222222222222222222222222222",
 *     ciphertextBase64: "AAAAAAAAAAAAAAAAAAAAAA==",
 *     encryptedAtEpochMillis: 0,
 *     nonceBase64: "AAAAAAAAAAAAAAAA",
 *     plaintextContentHash: "0000000000000000000000000000000000000000000000000000000000000000",
 *     sourceKind: "codex",
 *     sourcePathHash: "1111111111111111111111111111111111111111111111111111111111111111"
 *   }),
 *   rawArchiveKey: Redacted.make("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
 * })
 * console.log(program)
 * ```
 *
 * @effects Reads `globalThis.crypto` for AES-GCM key import and decryption.
 * @category services
 * @since 0.0.0
 */
export const decryptEncryptedRawArchiveEnvelope = Effect.fn("AiMetrics.decryptEncryptedRawArchiveEnvelope")(function* ({
  envelope,
  rawArchiveKey,
}: {
  readonly envelope: AiMetricsEncryptedRawArchiveEnvelope;
  readonly rawArchiveKey: AiMetricsRawArchiveKey;
}) {
  const key = yield* importRawArchiveKey(rawArchiveKey);
  const nonce = yield* Result.match(Encoding.decodeBase64(envelope.nonceBase64), {
    onFailure: (cause) => Effect.fail(archiveFailure("Archive envelope nonce is not valid base64.", cause)),
    onSuccess: Effect.succeed,
  });
  const ciphertext = yield* Result.match(Encoding.decodeBase64(envelope.ciphertextBase64), {
    onFailure: (cause) => Effect.fail(archiveFailure("Archive envelope ciphertext is not valid base64.", cause)),
    onSuccess: Effect.succeed,
  });
  const plaintext = yield* Effect.tryPromise({
    try: () =>
      globalThis.crypto.subtle.decrypt({ iv: cryptoBytes(nonce), name: "AES-GCM" }, key, cryptoBytes(ciphertext)),
    catch: (cause) => archiveFailure("Failed to decrypt raw archive envelope.", cause),
  });

  return new TextDecoder().decode(plaintext);
});

/**
 * Read and decode an encrypted raw archive envelope from disk.
 *
 * **Example** (Read envelope from disk)
 *
 * ```ts
 * import { readEncryptedRawArchiveEnvelope } from "@beep/repo-ai-metrics"
 * const program = readEncryptedRawArchiveEnvelope(".ai-metrics/raw/codex/raw-example.json")
 * console.log(program)
 * ```
 *
 * @effects Reads and decodes one encrypted raw archive envelope JSON file.
 * @category services
 * @since 0.0.0
 */
export const readEncryptedRawArchiveEnvelope = Effect.fn("AiMetrics.readEncryptedRawArchiveEnvelope")(function* (
  archivePath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const envelopeText = yield* fs
    .readFileString(archivePath)
    .pipe(Effect.mapError((cause) => archiveFailure(`Failed to read archive envelope "${archivePath}".`, cause)));

  return yield* AiMetricsEncryptedRawArchiveEnvelope.decodeUnknownEffectFromJsonString(envelopeText).pipe(
    Effect.mapError((cause) => archiveFailure(`Failed to decode archive envelope "${archivePath}".`, cause))
  );
});
