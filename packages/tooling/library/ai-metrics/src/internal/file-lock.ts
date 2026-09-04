import { Clock, Effect, FileSystem, Path, Random, Schedule } from "effect";
import * as Eq from "effect/Equal";
import type * as Duration from "effect/Duration";

interface AiMetricsFileLockOptions<LockError> {
  readonly lockPath: string;
  readonly maxRetries: number;
  readonly onClaimFailure: (cause: unknown) => LockError;
  readonly onTimeout: (lockPath: string) => LockError;
  readonly retryDelay: Duration.Duration;
}

export const aiMetricsWriterToken = Effect.gen(function* () {
  const nowEpochMillis = yield* Clock.currentTimeMillis;
  const entropy = yield* Random.nextIntBetween(0, 0xffffffff);
  return `${nowEpochMillis}-${entropy.toString(16)}`;
});

const claimFileLock = <LockError>(options: AiMetricsFileLockOptions<LockError>, token: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    fs.writeFileString(options.lockPath, token, { flag: "wx" }).pipe(
      Effect.as(true),
      Effect.catchTag("PlatformError", (error) =>
        Eq.equals(error.reason._tag, "AlreadyExists")
          ? Effect.succeed(false)
          : Effect.fail(options.onClaimFailure(error))
      )
    )
  );

const acquireFileLock = Effect.fnUntraced(function* <LockError>(options: AiMetricsFileLockOptions<LockError>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const token = yield* aiMetricsWriterToken;
  const schedule = Schedule.recurs(options.maxRetries).pipe(
    Schedule.addDelay(() => Effect.succeed(options.retryDelay))
  );

  yield* fs
    .makeDirectory(path.dirname(options.lockPath), { recursive: true })
    .pipe(Effect.mapError(options.onClaimFailure));
  const claimed = yield* claimFileLock(options, token).pipe(
    Effect.repeat({ schedule, until: (acquired: boolean) => acquired })
  );
  if (!claimed) return yield* Effect.fail(options.onTimeout(options.lockPath));
  return options.lockPath;
});

const releaseFileLock = (lockPath: string): Effect.Effect<void, never, FileSystem.FileSystem> =>
  Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(lockPath).pipe(Effect.ignore));

export const withAiMetricsFileLock =
  <LockError>(options: AiMetricsFileLockOptions<LockError>) =>
  <A, E, R>(use: Effect.Effect<A, E, R>): Effect.Effect<A, E | LockError, FileSystem.FileSystem | Path.Path | R> =>
    Effect.acquireUseRelease(acquireFileLock(options), () => use, releaseFileLock);
