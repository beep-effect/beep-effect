/**
 * Exclusive cross-process lock held over a claim ledger's whole read, plan and append.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Path from "effect/Path";
import { acquireJournalFileLock, releaseJournalFileLock } from "../repo-run/AdmissionJournal.ts";

type LockServices = FileSystem.FileSystem | Path.Path | Digest.Digest;

type LockPlatform = {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly digest: Digest.Digest["Service"];
};

const secureRandom = SecureRandom.make(SecureRandom.randomBytesUnsafe);

type LockOptions<E2> = {
  readonly platform: LockPlatform;
  readonly lockFile: string;
  readonly busy: E2;
};

const acquireGeneration = Effect.fnUntraced(function* <E2>(options: LockOptions<E2>) {
  const random = yield* SecureRandom.SecureRandom;
  const token = `${process.pid}:${yield* random.uuidV4()}`;
  if (yield* acquireJournalFileLock(options.lockFile, token)) {
    return token;
  }
  return yield* Effect.fail(options.busy);
});

const lockPlatform =
  (platform: LockPlatform) =>
  <A, E>(effect: Effect.Effect<A, E, LockServices | SecureRandom.SecureRandom>): Effect.Effect<A, E> =>
    effect.pipe(
      Effect.provideService(FileSystem.FileSystem, platform.fs),
      Effect.provideService(Path.Path, platform.path),
      Effect.provideService(Digest.Digest, platform.digest),
      Effect.provideService(SecureRandom.SecureRandom, secureRandom)
    );

/**
 * Run one append while holding the owned-generation journal lock on its ledger.
 *
 * **Details**
 * The lock is the admission journal's owned-generation lock: it publishes the owner's PID and
 * process start time, retries briefly while another append runs, reclaims a lock whose owner
 * died, and releases only the generation this append acquired. When a live append still holds
 * the lock the call fails with `busy` and the ledger is not read or written, so two writers can
 * never plan against the same head and fork it.
 *
 * @category concurrency
 * @since 0.0.0
 */
export const withAppendLock: {
  <E2>(options: LockOptions<E2>): <A, E, R>(use: Effect.Effect<A, E, R>) => Effect.Effect<A, E | E2, R>;
  <A, E, R, E2>(use: Effect.Effect<A, E, R>, options: LockOptions<E2>): Effect.Effect<A, E | E2, R>;
} = dual(
  2,
  <A, E, R, E2>(use: Effect.Effect<A, E, R>, options: LockOptions<E2>): Effect.Effect<A, E | E2, R> =>
    Effect.acquireUseRelease(
      acquireGeneration(options).pipe(lockPlatform(options.platform)),
      () => use,
      (token) => releaseJournalFileLock(options.lockFile, token).pipe(lockPlatform(options.platform))
    )
);
