/**
 * Immutable private storage that reauthenticates current producer acceptance.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Sha256HexFromBytes } from "@beep/schema";
import { Config, Effect, FileSystem, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { readContainedFileBytesNoFollow } from "../../internal/cli/FsGuards.ts";
import {
  CacheProducerAcceptanceReference,
  CacheProducerImportRequest,
  CacheProducerStoreConfiguration,
} from "./Cache.acceptance.schemas.ts";
import { validateCacheProducerImport } from "./Cache.acceptance.ts";
import { decodeCacheExperimentText } from "./Cache.evidence.ts";
import { inspectCacheProducerDirectory } from "./Cache.producer.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheProducerTrustLocations } from "./Cache.acceptance.schemas.ts";

const limit = 8 * 1024 * 1024;
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const encodeRequest = S.encodeEffect(S.fromJsonString(CacheProducerImportRequest));
const decodeRequest = S.decodeUnknownEffect(S.fromJsonString(CacheProducerImportRequest));

/**
 * Reauthenticate an immutable private record against current independent approvals.
 *
 * **Details**
 * Rejects unsafe metadata, symlinks, extra hard links, altered bytes, revoked
 * issuers, expired envelopes and unmet policy. Historical retention does not
 * extend active authority. The caller still verifies live checkout and scope.
 *
 * **Example** (Reference active receipt verification)
 * ```ts
 * import { readCacheProducerAcceptance } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof readCacheProducerAcceptance === "function")
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readCacheProducerAcceptance = Effect.fn("Producer.readAcceptance")(function* (
  directory: string,
  reference: CacheProducerAcceptanceReference,
  trust: CacheProducerTrustLocations
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const uid = yield* inspectCacheProducerDirectory(directory);
  const file = path.join(directory, `${reference.sha256}.json`);
  const info = yield* fs.stat(file);
  if (
    info.type !== "File" ||
    (info.mode & 0o777) !== 0o600 ||
    !O.contains(info.uid, uid) ||
    !O.contains(info.nlink, 1) ||
    info.size <= BigInt(0) ||
    info.size > BigInt(limit)
  )
    return yield* CacheCommandError.new("Acceptance record must be a bounded private single-link file.");
  const read = yield* readContainedFileBytesNoFollow(directory, file, S.Natural.make(limit));
  const bytes = yield* read.contents.pipe(
    Effect.fromOption(() => CacheCommandError.new("Acceptance record is missing."))
  );
  if ((yield* hashBytes(bytes)) !== reference.sha256)
    return yield* CacheCommandError.new("Acceptance record differs from its immutable content identity.");
  const request = yield* decodeCacheExperimentText(bytes).pipe(Effect.flatMap(decodeRequest));
  return yield* validateCacheProducerImport(request, trust);
}, CacheCommandError.mapError("Cannot verify active private acceptance record."));

/**
 * Publish complete authenticated bytes atomically without replacing existing records.
 *
 * **Details**
 * The independently provisioned directory must be private and outside reader
 * mounts. A staged regular file is linked exclusively to its content address;
 * the staging link is removed before single-link verification. Existing bytes
 * are reverified, never overwritten. Every read retains the original expiry.
 * This writes no qualification ledger and grants no live-checkout approval.
 *
 * **Example** (Reference immutable acceptance storage)
 * ```ts
 * import { persistCacheProducerAcceptance } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof persistCacheProducerAcceptance === "function")
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const persistCacheProducerAcceptance = Effect.fn("Producer.persistAcceptance")(
  function* (directory: string, submitted: CacheProducerImportRequest, trust: CacheProducerTrustLocations) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const contents = yield* encodeRequest(submitted);
    const bytes = new TextEncoder().encode(contents);
    if (bytes.byteLength > limit) return yield* CacheCommandError.new("Acceptance request exceeds its bound.");
    const request = yield* decodeRequest(contents);
    yield* validateCacheProducerImport(request, trust);
    yield* inspectCacheProducerDirectory(directory);
    const reference = CacheProducerAcceptanceReference.make({ sha256: yield* hashBytes(bytes) });
    const temporary = yield* fs.makeTempDirectoryScoped({ directory, prefix: ".acceptance-" });
    const staged = path.join(temporary, "record.json");
    yield* fs.writeFileString(staged, contents, { flag: "wx", mode: 0o600 });
    yield* inspectCacheProducerDirectory(directory);
    yield* fs
      .link(staged, path.join(directory, `${reference.sha256}.json`))
      .pipe(
        Effect.catchTag("PlatformError", (error) =>
          error.reason._tag === "AlreadyExists" ? Effect.void : Effect.fail(error)
        )
      );
    yield* fs.remove(staged);
    yield* readCacheProducerAcceptance(directory, reference, trust);
    return reference;
  },
  Effect.scoped,
  CacheCommandError.mapError("Cannot persist immutable private acceptance record.")
);

/**
 * Load trust from operator configuration, never from a submitted request.
 *
 * **Example** (Reference independent configuration loading)
 * ```ts
 * import { loadCacheProducerStoreConfiguration } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof loadCacheProducerStoreConfiguration === "function")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const loadCacheProducerStoreConfiguration = Effect.fn("Producer.loadStoreConfiguration")(function* () {
  return yield* S.decodeEffect(CacheProducerStoreConfiguration)({
    directory: yield* Config.String("BEEP_CACHE_ACCEPTANCE_STORE"),
    trust: {
      stable: yield* Config.String("BEEP_CACHE_STABLE_ISSUER_STORE"),
      canary: yield* Config.String("BEEP_CACHE_CANARY_ISSUER_STORE"),
    },
  });
}, CacheCommandError.mapError(
  "Cache acceptance requires independently configured private store and issuer locations."
));
