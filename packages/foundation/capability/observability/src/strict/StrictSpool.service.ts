/**
 * Service contracts of the strict-tier encrypted spool: the root key it and
 * the span-id salt derive from, and the spool that seals each held-back
 * export body after the gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { isStricterTier } from "../catalog/Catalog.literals.ts";
import { TelemetryRefusalTag } from "../Observability.instruments.ts";
import { StrictEgressRecord } from "./StrictGate.schemas.ts";
import { StrictSpoolError } from "./StrictSpool.errors.ts";
import {
  StrictSpoolAlgorithm,
  StrictSpoolOutcome,
  StrictSpoolReplay,
  StrictSpoolSegment,
  StrictSpoolSurvey,
  StrictSpoolSurveyEntry,
} from "./StrictSpool.schemas.ts";
import type { TelemetryTier } from "../catalog/Catalog.literals.ts";
import type { RefusalLedger } from "./StrictGate.schemas.ts";
import type { StrictSpoolOperation } from "./StrictSpool.errors.ts";
import type { StrictKeyProtection, StrictSpoolOptions } from "./StrictSpool.schemas.ts";

const $I = $ObservabilityId.create("strict/StrictSpool.service");

/**
 * The root key of a strict host: 32 random bytes from which the spool's
 * AES-256-GCM key and the span-id salt are derived.
 *
 * **Details**
 *
 * `epoch` names the key generation; it is stamped on every spool segment and
 * exported as `beep.key_epoch`, and a segment from another epoch is refused
 * at replay. `protection` records how the key is held at rest. The material
 * never leaves the service unredacted except into the derivation.
 *
 * **Example** (Provide a test key)
 *
 * ```ts
 * import { StrictSpoolKey } from "@beep/observability/strict"
 * import * as Layer from "effect/Layer"
 * import * as Redacted from "effect/Redacted"
 *
 * const key = Layer.succeed(
 *   StrictSpoolKey,
 *   StrictSpoolKey.of({ epoch: "1", protection: "dev-memory", material: Redacted.make(new Uint8Array(32)) })
 * )
 * console.log(Layer.isLayer(key)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class StrictSpoolKey extends Context.Service<
  StrictSpoolKey,
  {
    readonly epoch: string;
    readonly protection: StrictKeyProtection;
    readonly material: Redacted.Redacted<Uint8Array>;
  }
>()($I`StrictSpoolKey`) {}

/**
 * The encrypted spool written after the strict gate.
 *
 * **Details**
 *
 * `append` seals one export body as a new segment and returns the refusals
 * it caused (`spool-evicted` for every old segment it removed,
 * `spool-evict-failed` for every one it could not remove); it fails
 * only when the body could not be sealed, encoded or written. `replay`
 * decrypts every segment, oldest first, and refuses each one that does not
 * decode, authenticate or match the key epoch (`spool-segment-invalid`), or
 * whose tier is looser than the spool's tier (`spool-tier-refused`).
 *
 * **Example** (Replay the spool)
 *
 * ```ts
 * import { StrictSpool } from "@beep/observability/strict"
 * import * as Effect from "effect/Effect"
 *
 * const bodies = Effect.gen(function* () {
 *   const spool = yield* StrictSpool
 *   return (yield* spool.replay).records.length
 * })
 * console.log(Effect.isEffect(bodies)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class StrictSpool extends Context.Service<
  StrictSpool,
  {
    readonly append: (record: StrictEgressRecord) => Effect.Effect<RefusalLedger, StrictSpoolError>;
    readonly replay: Effect.Effect<StrictSpoolReplay, StrictSpoolError>;
  }
>()($I`StrictSpool`) {}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const nonceBytes = 12;
const nameBytes = 8;
const millisWidth = 15;
const sequenceWidth = 9;
const segmentSuffix = ".seg";
const ownerOnlyDirectory = 0o700;
const ownerOnlyFile = 0o600;
const spoolKeyInfo = "beep/strict-spool/aes-256-gcm/v1";
const saltInfo = "beep/strict-salt/hmac-sha256/v1";
const saltBits = 256;

const encodeSegment = S.encodeEffect(S.fromJsonString(StrictSpoolSegment));
const decodeSegment = S.decodeUnknownEffect(S.fromJsonString(StrictSpoolSegment));

const cryptoBytes = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
};

const randomBytes = (length: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(length));

const spoolFailure =
  (operation: StrictSpoolOperation, message: string) =>
  (cause: unknown): StrictSpoolError =>
    StrictSpoolError.make({ operation, message, cause });

const hkdfParams = (info: string) => ({
  name: "HKDF",
  hash: "SHA-256",
  salt: new Uint8Array(0),
  info: textEncoder.encode(info),
});

const importRootKey = (key: Context.Service.Shape<typeof StrictSpoolKey>) =>
  Effect.tryPromise({
    try: () =>
      globalThis.crypto.subtle.importKey("raw", key.material.pipe(Redacted.value, cryptoBytes), "HKDF", false, [
        "deriveKey",
        "deriveBits",
      ]),
    catch: spoolFailure("key", "The strict root key could not be imported."),
  });

/**
 * Derives the 32-byte span-id salt from the strict root key with
 * HKDF-SHA256, under an info string distinct from the spool key's, so the
 * salt and the spool key never coincide.
 *
 * **Example** (Derive the salt)
 *
 * ```ts
 * import { deriveStrictSalt, StrictSpoolKey } from "@beep/observability/strict"
 * import * as Effect from "effect/Effect"
 * import * as Redacted from "effect/Redacted"
 *
 * const salt = deriveStrictSalt(
 *   StrictSpoolKey.of({ epoch: "1", protection: "dev-memory", material: Redacted.make(new Uint8Array(32)) })
 * )
 * console.log(Effect.isEffect(salt)) // true
 * ```
 *
 * @param key - The strict root key.
 * @returns The salt bytes.
 * @category constructors
 * @since 0.0.0
 */
export const deriveStrictSalt = Effect.fnUntraced(function* (key: Context.Service.Shape<typeof StrictSpoolKey>) {
  const root = yield* importRootKey(key);
  const bits = yield* Effect.tryPromise({
    try: () => globalThis.crypto.subtle.deriveBits(hkdfParams(saltInfo), root, saltBits),
    catch: spoolFailure("key", "The strict salt could not be derived."),
  });
  return new Uint8Array(bits);
});

const deriveSpoolKey = Effect.fnUntraced(function* (key: Context.Service.Shape<typeof StrictSpoolKey>) {
  const root = yield* importRootKey(key);
  return yield* Effect.tryPromise({
    try: () =>
      globalThis.crypto.subtle.deriveKey(hkdfParams(spoolKeyInfo), root, { name: "AES-GCM", length: 256 }, false, [
        "encrypt",
        "decrypt",
      ]),
    catch: spoolFailure("key", "The strict spool key could not be derived."),
  });
});

// The header bound to the ciphertext as additional authenticated data.
const additionalData = (header: {
  readonly signal: string;
  readonly tier: string;
  readonly keyEpoch: string;
  readonly sealedAtMillis: number;
}): Uint8Array<ArrayBuffer> =>
  cryptoBytes(
    textEncoder.encode(
      A.join(["strict-spool/v1", header.signal, header.tier, header.keyEpoch, `${header.sealedAtMillis}`], "\u0000")
    )
  );

const segmentName = (sealedAtMillis: number, sequence: number): string =>
  `${Str.padStart(millisWidth, "0")(`${sealedAtMillis}`)}-${Str.padStart(sequenceWidth, "0")(`${sequence}`)}-${Hex.encode(randomBytes(nameBytes))}${segmentSuffix}`;

/**
 * Writes `text` to `target` owner-only (`0600`) without ever exposing a
 * partial file: it writes a uniquely named temporary file beside `target`,
 * fixes its mode, then renames it into place. On failure the temporary file
 * is removed.
 *
 * **Example** (Write a file owner-only)
 *
 * ```ts
 * import { writeOwnerOnlyFile } from "@beep/observability/strict"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(writeOwnerOnlyFile("/state/telemetry/key.dpapi", "{}"))) // true
 * ```
 *
 * @param target - The file to create or replace.
 * @param text - Its contents.
 * @category constructors
 * @since 0.0.0
 */
export const writeOwnerOnlyFile = Effect.fnUntraced(function* (target: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  const temporary = `${target}.${Hex.encode(randomBytes(nameBytes))}.tmp`;
  yield* fs.writeFileString(temporary, text, { flag: "wx", mode: ownerOnlyFile }).pipe(
    Effect.andThen(fs.chmod(temporary, ownerOnlyFile)),
    Effect.andThen(fs.rename(temporary, target)),
    Effect.tapError(() => Effect.ignore(fs.remove(temporary, { force: true })))
  );
});

/**
 * Builds a ledger counting each tag once per occurrence.
 *
 * **Example** (Count two evictions)
 *
 * ```ts import.meta.vitest name="Count two evictions"
 * import { refusalLedgerOf } from "@beep/observability/strict"
 * import * as HashMap from "effect/HashMap"
 * import * as O from "effect/Option"
 *
 * HashMap.get(refusalLedgerOf(["spool-evicted", "spool-evicted"]), "spool-evicted") // => O.some(2)
 * ```
 *
 * @param tags - One entry per refusal.
 * @returns The refusal counts by tag.
 * @category constructors
 * @since 0.0.0
 */
export const refusalLedgerOf = (tags: ReadonlyArray<TelemetryRefusalTag>): RefusalLedger =>
  A.reduce(tags, HashMap.empty<TelemetryRefusalTag, number>(), (ledger, tag) =>
    HashMap.set(ledger, tag, O.getOrElse(HashMap.get(ledger, tag), () => 0) + 1)
  );

type SegmentReader = {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly key: Context.Service.Shape<typeof StrictSpoolKey>;
  readonly aesKey: CryptoKey;
  readonly directory: string;
  readonly tier: TelemetryTier;
};

const segmentNamesIn = (fs: FileSystem.FileSystem, directory: string) =>
  fs
    .readDirectory(directory)
    .pipe(Effect.map((entries) => A.sort(A.filter(entries, Str.endsWith(segmentSuffix)), Order.String)));

const isNatural = S.is(S.Natural);

// The seal time a segment name starts with, or 0 for a name without one.
const sealedAtOfName = (name: string): number =>
  pipe(
    Str.slice(0, millisWidth)(name),
    Num.parse,
    O.filter(isNatural),
    O.getOrElse(() => 0)
  );

const openSegment = Effect.fnUntraced(function* (aesKey: CryptoKey, segment: StrictSpoolSegment) {
  const nonce = Base64.decode(segment.nonceBase64);
  const ciphertext = Base64.decode(segment.ciphertextBase64);
  if (Result.isFailure(nonce) || Result.isFailure(ciphertext)) {
    return yield* Effect.fail(TelemetryRefusalTag.Enum["spool-segment-invalid"]);
  }
  const plaintext = yield* Effect.tryPromise({
    try: () =>
      globalThis.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: cryptoBytes(nonce.success), additionalData: additionalData(segment) },
        aesKey,
        cryptoBytes(ciphertext.success)
      ),
    catch: () => TelemetryRefusalTag.Enum["spool-segment-invalid"],
  });
  return StrictEgressRecord.make({ signal: segment.signal, body: textDecoder.decode(plaintext) });
});

// Decodes, checks and opens one segment's text; every failure is a refusal tag.
const outcomeOf = (reader: SegmentReader, text: string): Effect.Effect<StrictSpoolOutcome> =>
  decodeSegment(text).pipe(
    Effect.mapError(() => TelemetryRefusalTag.Enum["spool-segment-invalid"]),
    // Authenticate before trusting any header field: the tier is bound as
    // additional data, so an edited tier fails here as an invalid segment
    // and only a genuine segment sealed under a looser tier is tier-refused.
    // Replay, the survey and the privacy receipt all classify through here.
    Effect.flatMap((segment) =>
      segment.keyEpoch !== reader.key.epoch
        ? Effect.fail(TelemetryRefusalTag.Enum["spool-segment-invalid"])
        : openSegment(reader.aesKey, segment).pipe(
            Effect.filterOrFail(
              () => !isStricterTier(reader.tier, segment.tier),
              () => TelemetryRefusalTag.Enum["spool-tier-refused"]
            )
          )
    ),
    Effect.match({
      onFailure: (tag) => StrictSpoolOutcome.cases.refused.make({ tag }),
      onSuccess: (record) => StrictSpoolOutcome.cases.opened.make({ record }),
    })
  );

const readSegment = Effect.fnUntraced(function* (reader: SegmentReader, name: string) {
  const text = yield* Effect.option(reader.fs.readFileString(reader.path.join(reader.directory, name)));
  const outcome = yield* O.match(text, {
    onNone: () => Effect.succeed(StrictSpoolOutcome.cases.refused.make({ tag: "spool-segment-invalid" })),
    onSome: (body) => outcomeOf(reader, body),
  });
  return StrictSpoolSurveyEntry.make({
    sealedAtMillis: sealedAtOfName(name),
    sizeBytes: O.match(text, { onNone: () => 0, onSome: (body) => textEncoder.encode(body).byteLength }),
    outcome,
  });
});

// Reads every named segment, in name order, without writing anything.
const readSegments = <E>(
  reader: SegmentReader,
  names: Effect.Effect<ReadonlyArray<string>, E>
): Effect.Effect<StrictSpoolSurvey, E> =>
  names.pipe(
    Effect.flatMap((sorted) => Effect.forEach(sorted, (name) => readSegment(reader, name))),
    Effect.map((entries) => StrictSpoolSurvey.make({ entries }))
  );

/**
 * Opens the strict spool in `options.directory`.
 *
 * **Details**
 *
 * - The directory is created owner-only (`0700`), and every segment is
 *   written owner-only (`0600`) to a unique temporary name, then renamed into
 *   place, so a reader never sees a partial segment.
 * - Segment names start with the zero-padded seal time and a per-spool
 *   sequence number, so name order is append order and eviction removes the
 *   oldest first, even for appends in the same millisecond.
 * - The AES-256-GCM key is derived from the {@link StrictSpoolKey} with
 *   HKDF-SHA256; each segment gets a fresh 12-byte nonce.
 *
 * **Gotchas**
 *
 * Owner-only modes are POSIX permissions. On Windows the directory inherits
 * the ACL of its parent under the user profile, which is already owner-only.
 *
 * **Example** (Open a spool)
 *
 * ```ts
 * import { makeStrictSpool, StrictSpoolOptions } from "@beep/observability/strict"
 * import * as Effect from "effect/Effect"
 *
 * const spool = makeStrictSpool(StrictSpoolOptions.make({ directory: "/state/spool", tier: "shape-only" }))
 * console.log(Effect.isEffect(spool)) // true
 * ```
 *
 * @param options - Directory, tier and byte bound of the spool.
 * @category constructors
 * @since 0.0.0
 */
export const makeStrictSpool = Effect.fn("StrictSpool.make")(function* (options: StrictSpoolOptions) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const key = yield* StrictSpoolKey;
  const aesKey = yield* deriveSpoolKey(key);
  const directory = options.directory;
  const sequence = yield* Ref.make(0);

  yield* fs
    .makeDirectory(directory, { recursive: true, mode: ownerOnlyDirectory })
    .pipe(
      Effect.andThen(fs.chmod(directory, ownerOnlyDirectory)),
      Effect.mapError(spoolFailure("open", "The strict spool directory could not be created."))
    );

  const segmentNames = segmentNamesIn(fs, directory);

  // Removes the oldest segments until the rest fit, one remove per segment:
  // each one removed counts `spool-evicted` and each one that could not be
  // removed `spool-evict-failed`, so a failed remove neither hides the
  // removes before it nor stops the ones after it. A directory that cannot be
  // listed or sized is one `spool-evict-failed`.
  const evict = (): Effect.Effect<ReadonlyArray<TelemetryRefusalTag>> =>
    Effect.gen(function* () {
      const names = yield* segmentNames;
      const sizes = yield* Effect.forEach(names, (name) =>
        fs.stat(path.join(directory, name)).pipe(Effect.map((info) => ByteSize.toNumberUnsafe(info.size)))
      );
      const total = A.reduce(sizes, 0, (sum, size) => sum + size);
      // Walk oldest first, picking segments until the rest fit.
      const candidates = pipe(
        A.zip(names, sizes),
        A.reduce({ remaining: total, names: A.empty<string>() }, (state, [name, size]) =>
          state.remaining > options.maxBytes
            ? { remaining: state.remaining - size, names: A.append(state.names, name) }
            : state
        )
      ).names;
      return yield* Effect.forEach(candidates, (name) =>
        fs.remove(path.join(directory, name), { force: true }).pipe(
          Effect.as(TelemetryRefusalTag.Enum["spool-evicted"]),
          Effect.orElseSucceed(() => TelemetryRefusalTag.Enum["spool-evict-failed"])
        )
      );
    }).pipe(Effect.orElseSucceed(() => [TelemetryRefusalTag.Enum["spool-evict-failed"]]));

  // Untraced: the spool runs inside the exporter, and its own spans would only
  // be exported, and refused, in the next window.
  const append = Effect.fnUntraced(function* (record: StrictEgressRecord) {
    const sealedAtMillis = yield* Clock.currentTimeMillis;
    const header = { signal: record.signal, tier: options.tier, keyEpoch: key.epoch, sealedAtMillis };
    const nonce = randomBytes(nonceBytes);
    const ciphertext = yield* Effect.tryPromise({
      try: () =>
        globalThis.crypto.subtle.encrypt(
          { name: "AES-GCM", iv: cryptoBytes(nonce), additionalData: additionalData(header) },
          aesKey,
          cryptoBytes(textEncoder.encode(record.body))
        ),
      catch: spoolFailure("append", "A strict spool segment could not be sealed."),
    });
    const text = yield* encodeSegment(
      StrictSpoolSegment.make({
        version: 1,
        algorithm: StrictSpoolAlgorithm.Enum["AES-256-GCM"],
        ...header,
        nonceBase64: Base64.encode(nonce),
        ciphertextBase64: Base64.encode(new Uint8Array(ciphertext)),
      })
    ).pipe(Effect.mapError(spoolFailure("append", "A strict spool segment could not be encoded.")));
    const gotAndUpdate = yield* Ref.getAndUpdate(sequence, (next) => next + 1);
    const name = segmentName(sealedAtMillis, gotAndUpdate);
    const target = path.join(directory, name);
    yield* writeOwnerOnlyFile(target, text).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.mapError(spoolFailure("append", "A strict spool segment could not be written."))
    );
    // The body is already on disk, so eviction never fails the append: a
    // segment it could not remove is counted and the next append tries again.
    const evict1 = yield* evict();
    return refusalLedgerOf(evict1);
  });

  const replay = readSegments(
    { fs, path, key, aesKey, directory, tier: options.tier },
    segmentNames.pipe(Effect.mapError(spoolFailure("replay", "The strict spool directory could not be read.")))
  ).pipe(
    Effect.map((survey) => {
      const outcomes = A.map(survey.entries, (entry) => entry.outcome);
      return StrictSpoolReplay.make({
        records: A.filterMap(outcomes, (outcome) =>
          StrictSpoolOutcome.guards.opened(outcome) ? Result.succeed(outcome.record) : Result.failVoid
        ),
        refused: refusalLedgerOf(
          A.filterMap(outcomes, (outcome) =>
            StrictSpoolOutcome.guards.refused(outcome) ? Result.succeed(outcome.tag) : Result.failVoid
          )
        ),
      });
    })
  );

  return StrictSpool.of({ append, replay });
});

/**
 * Reads a strict spool directory without writing to it: every segment,
 * oldest first, with its seal time, its size and what reading it came to.
 *
 * **Details**
 *
 * - Unlike {@link makeStrictSpool}, it never creates the directory: a
 *   missing directory surveys as empty.
 * - A segment is opened under the same rules as a replay: one from another
 *   key epoch, or one that does not decode or authenticate, is refused as
 *   `spool-segment-invalid`, and one sealed under a looser tier than
 *   `options.tier` as `spool-tier-refused`.
 * - `options.maxBytes` is not read.
 *
 * **Example** (Survey a spool)
 *
 * ```ts
 * import { StrictSpoolOptions, surveyStrictSpool } from "@beep/observability/strict"
 * import * as Effect from "effect/Effect"
 *
 * const survey = surveyStrictSpool(StrictSpoolOptions.make({ directory: "/state/spool", tier: "shape-only" }))
 * console.log(Effect.isEffect(survey)) // true
 * ```
 *
 * @param options - Directory and tier ceiling of the spool.
 * @category use-cases
 * @since 0.0.0
 */
export const surveyStrictSpool = Effect.fn("StrictSpool.survey")(function* (options: StrictSpoolOptions) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const key = yield* StrictSpoolKey;
  const directory = options.directory;
  const present = yield* fs
    .exists(directory)
    .pipe(Effect.mapError(spoolFailure("replay", "The strict spool directory could not be read.")));
  if (!present) {
    return StrictSpoolSurvey.make({ entries: [] });
  }
  const aesKey = yield* deriveSpoolKey(key);
  return yield* readSegments(
    { fs, path, key, aesKey, directory, tier: options.tier },
    segmentNamesIn(fs, directory).pipe(
      Effect.mapError(spoolFailure("replay", "The strict spool directory could not be read."))
    )
  );
});
