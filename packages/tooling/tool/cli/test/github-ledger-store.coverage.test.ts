import {
  BucketKey,
  BucketReading,
  DEFAULT_COMMAND_LABEL,
  GithubIdentityLabel,
  GithubLedgerRow,
  GithubLedgerStore,
  HostLabel,
  hourFileKey,
  LedgerHourRollup,
  LedgerRange,
  LedgerSummary,
  layerGithubLedgerStoreLive,
  makeGithubLedgerStoreMemory,
  RetentionCutoffs,
  SampleBucket,
} from "@beep/repo-cli/test/SharedInternals";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { withLayer } from "./support/GithubLedgerFakes.ts";

const T0 = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-11-10T00:00:00.000Z"));
const HOUR = 3_600_000;
const hour = (index: number) => DateTime.makeUnsafe(T0 + index * HOUR);
const host = HostLabel.make("hub");
const alice = GithubIdentityLabel.make("user:alice");
const tokenLabel = GithubIdentityLabel.make("token:aaaaaaaaaaaa");

const sampleAt = (at: DateTime.Utc) =>
  GithubLedgerRow.cases.Sample.make({
    at,
    host,
    command: DEFAULT_COMMAND_LABEL,
    identity: alice,
    trigger: "timer",
    selfCost: "confirmed-free",
    buckets: [SampleBucket.make({ resource: "core", limit: 5000, used: 1, remaining: 4999, resetAt: at })],
  });

const calibrationAt = (at: DateTime.Utc) =>
  GithubLedgerRow.cases.Calibration.make({
    at,
    host,
    identity: alice,
    restUsed: 100,
    restRemaining: 4900,
    restResetAt: at,
    graphqlUsed: 101,
    graphqlRemaining: 4899,
    graphqlResetAt: at,
    graphqlCost: 1,
    spanMillis: 10,
  });

const readingAt = (at: DateTime.Utc) =>
  BucketReading.make({
    key: BucketKey.make({ identity: alice, resource: "core" }),
    limit: 5000,
    remaining: 4999,
    used: O.some(1),
    resetAt: at,
    asOf: at,
    basis: "transport",
  });

const rollupAt = (at: DateTime.Utc) =>
  LedgerHourRollup.make({ hour: at, host, complete: true, cells: [], keys: [], operationCosts: [], windows: [] });

const cutoffs = (options: {
  readonly rowsBefore?: number;
  readonly rollupsBefore?: number;
  readonly rowsMaxBytes?: number;
  readonly rowsKeepAfter?: number;
  readonly latestBefore?: number;
  readonly calibrationsBefore?: number;
}) =>
  RetentionCutoffs.make({
    rowsBefore: hour(options.rowsBefore ?? -100),
    rollupsBefore: hour(options.rollupsBefore ?? -100),
    rowsMaxBytes: options.rowsMaxBytes ?? Number.MAX_SAFE_INTEGER,
    rowsKeepAfter: hour(options.rowsKeepAfter ?? -100),
    latestBefore: hour(options.latestBefore ?? -100),
    calibrationsBefore: hour(options.calibrationsBefore ?? -100),
  });

const withStateRoot =
  (root: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.provideService(
      effect,
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown({ BEEP_GITHUB_LEDGER_STATE_ROOT: root })
    );

const denied = (method: string, path: string) =>
  PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method, pathOrDescriptor: path });

// The real file system, except that `remove` and `writeFileString` fail on the matching paths.
const deniedFileSystem = (
  fs: FileSystem.FileSystem,
  options: { readonly remove?: (path: string) => boolean; readonly write?: (path: string) => boolean }
): FileSystem.FileSystem => ({
  ...fs,
  remove: (path, removeOptions) =>
    options.remove?.(path) === true ? Effect.fail(denied("remove", path)) : fs.remove(path, removeOptions),
  writeFileString: (path, data, writeOptions) =>
    options.write?.(path) === true
      ? Effect.fail(denied("writeFileString", path))
      : fs.writeFileString(path, data, writeOptions),
});

const mtimeMillis = Effect.fnUntraced(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(file);
  return O.map(info.mtime, (mtime) => mtime.getTime());
});

describe("GithubLedger memory store", () => {
  it.effect("returns no rows for a range whose end precedes its start", () =>
    Effect.gen(function* () {
      const store = yield* makeGithubLedgerStoreMemory;
      yield* store.append(sampleAt(hour(1)));
      const reversed = yield* store.rows(LedgerRange.make({ from: hour(2), to: hour(0) }));
      expect(reversed).toStrictEqual([]);
      const forward = yield* store.rows(LedgerRange.make({ from: hour(0), to: hour(2) }));
      expect(forward).toHaveLength(1);
    })
  );

  it.effect("round-trips the summary", () =>
    Effect.gen(function* () {
      const store = yield* makeGithubLedgerStoreMemory;
      const before = yield* store.readSummary;
      assertNone(before);
      const summary = LedgerSummary.make({
        generatedAt: hour(0),
        spenders: [],
        unattributedLastHour: [],
        lastRowAt: O.some(hour(0)),
      });
      yield* store.writeSummary(summary);
      const after = yield* store.readSummary;
      assertSome(after, summary);
    })
  );

  it.effect("drops rows, rollups, latest readings and calibration pairs past each cutoff", () =>
    Effect.gen(function* () {
      const store = yield* makeGithubLedgerStoreMemory;
      yield* store.append(sampleAt(hour(0)));
      yield* store.append(sampleAt(hour(3)));
      yield* store.writeRollup(rollupAt(hour(0)));
      yield* store.writeRollup(rollupAt(hour(3)));
      yield* store.writeLatestSample(sampleAt(hour(0)));
      yield* store.writeLatestTransport(readingAt(hour(0)));
      yield* store.appendCalibration(calibrationAt(hour(0)));
      yield* store.appendCalibration(calibrationAt(hour(3)));
      yield* store.removeBefore(
        cutoffs({ rowsBefore: 1, rollupsBefore: 1, latestBefore: 1, calibrationsBefore: 1, rowsKeepAfter: 1 })
      );
      const hours = yield* store.rowHours;
      expect(hours).toStrictEqual([hour(3)]);
      const oldRollup = yield* store.readRollup(hour(0));
      assertNone(oldRollup);
      const newRollup = yield* store.readRollup(hour(3));
      const newRollupHour = O.map(newRollup, (rollup) => rollup.hour);
      assertSome(newRollupHour, hour(3));
      const samples = yield* store.latestSamples;
      expect(samples).toStrictEqual([]);
      const transports = yield* store.latestTransport;
      expect(transports).toStrictEqual([]);
      const calibrations = yield* store.calibrations;
      expect(A.map(calibrations, (row) => row.at)).toStrictEqual([hour(3)]);
    })
  );
});

describe("GithubLedger file store retention and failures", () => {
  it.layer(NodeServices.layer, { timeout: "60 seconds" })((it) => {
    it.effect("drops expired hours, evicts the oldest kept hours over the byte cap and prunes the rest", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-retention-" });
        const rowsDir = path.join(root, "rows");
        yield* Effect.gen(function* () {
          const store = yield* GithubLedgerStore;
          yield* Effect.forEach([0, 1, 2, 4], (index) => store.append(sampleAt(hour(index))), { discard: true });
          // Stray `.json` hour files: one expired, one kept; neither has a `.jsonl` to stat or remove.
          yield* fs.writeFileString(path.join(rowsDir, `${hourFileKey(hour(-1))}.json`), "stray\n");
          yield* fs.writeFileString(path.join(rowsDir, `${hourFileKey(hour(3))}.json`), "stray\n");
          const lineBytes = (yield* fs.stat(path.join(rowsDir, `${hourFileKey(hour(1))}.jsonl`))).size;
          yield* store.writeRollup(rollupAt(hour(0)));
          yield* store.writeRollup(rollupAt(hour(4)));
          yield* store.writeLatestSample(sampleAt(hour(4)));
          yield* fs.writeFileString(path.join(root, "latest", "sample-user_bob.json"), "not a sample");
          yield* store.appendCalibration(calibrationAt(hour(4)));
          yield* fs.writeFileString(path.join(root, "calibration.jsonl"), '{"_tag":"Calib\n', { flag: "a" });

          // Hours 1, 2 and 4 hold one line each (hour 3 has no `.jsonl`), so dropping hour 1 fits a two-line cap.
          yield* store.removeBefore(
            cutoffs({
              rowsBefore: 1,
              rowsKeepAfter: 4,
              rowsMaxBytes: Number(lineBytes) * 2,
              rollupsBefore: 2,
              latestBefore: 3,
              calibrationsBefore: 0,
            })
          );

          const remaining = yield* fs.readDirectory(rowsDir);
          expect(A.sort(remaining, Str.Order)).toStrictEqual([
            `${hourFileKey(hour(-1))}.json`,
            `${hourFileKey(hour(2))}.jsonl`,
            `${hourFileKey(hour(3))}.json`,
            `${hourFileKey(hour(4))}.jsonl`,
          ]);
          const oldRollup = yield* store.readRollup(hour(0));
          assertNone(oldRollup);
          const newRollup = yield* store.readRollup(hour(4));
          const newRollupHour = O.map(newRollup, (rollup) => rollup.hour);
          assertSome(newRollupHour, hour(4));
          const latest = yield* fs.readDirectory(path.join(root, "latest"));
          expect(latest).toStrictEqual(["sample-user_alice-sample_user_alice.json"]);
          const calibrationText = yield* fs.readFileString(path.join(root, "calibration.jsonl"));
          expect(A.filter(Str.split("\n")(calibrationText), Str.isNonEmpty)).toHaveLength(1);
          const calibrations = yield* store.calibrations;
          expect(A.map(calibrations, (row) => row.at)).toStrictEqual([hour(4)]);
        }).pipe(withLayer(layerGithubLedgerStoreLive), withStateRoot(root));
      })
    );

    it.effect("leaves a calibration file with nothing to drop untouched", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-calibration-" });
        const file = path.join(root, "calibration.jsonl");
        yield* Effect.gen(function* () {
          const store = yield* GithubLedgerStore;
          yield* store.appendCalibration(calibrationAt(hour(4)));
          yield* fs.utimes(file, 1, 1);
          yield* store.removeBefore(cutoffs({ calibrationsBefore: 0 }));
          const mtime = yield* mtimeMillis(file);
          assertSome(mtime, 1000);
        }).pipe(withLayer(layerGithubLedgerStoreLive), withStateRoot(root));
      })
    );

    it.effect("does not rewrite an alias it already holds", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-alias-" });
        const file = path.join(root, "aliases.json");
        yield* Effect.gen(function* () {
          const store = yield* GithubLedgerStore;
          yield* store.writeAlias(tokenLabel, alice);
          yield* fs.utimes(file, 1, 1);
          yield* store.writeAlias(tokenLabel, alice);
          const mtime = yield* mtimeMillis(file);
          assertSome(mtime, 1000);
          const aliases = yield* store.readAliases;
          expect(aliases.aliases).toStrictEqual({ [tokenLabel]: alice });
        }).pipe(withLayer(layerGithubLedgerStoreLive), withStateRoot(root));
      })
    );

    it.effect("fails a read whose path is not the kind of file it expects", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-kinds-" });
        // `rows` is a file and `aliases.json` a directory.
        yield* fs.writeFileString(path.join(root, "rows"), "not a directory");
        yield* fs.makeDirectory(path.join(root, "aliases.json"));
        yield* Effect.gen(function* () {
          const store = yield* GithubLedgerStore;
          const hoursError = yield* Effect.flip(store.rowHours);
          expect([hoursError.reason, hoursError.detail]).toStrictEqual(["read", "list ledger hours"]);
          const aliasError = yield* Effect.flip(store.readAliases);
          expect([aliasError.reason, aliasError.detail]).toStrictEqual(["read", "read the identity aliases"]);
        }).pipe(withLayer(layerGithubLedgerStoreLive), withStateRoot(root));
      })
    );

    it.effect("fails retention when an expired rollup cannot be removed", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-remove-" });
        const blocked = deniedFileSystem(fs, { remove: Str.includes(`${hourFileKey(hour(0))}.json`) });
        yield* Effect.gen(function* () {
          const store = yield* GithubLedgerStore;
          yield* store.writeRollup(rollupAt(hour(0)));
          const error = yield* Effect.flip(store.removeBefore(cutoffs({ rollupsBefore: 1 })));
          expect([error.reason, error.detail]).toStrictEqual(["write", "remove a rollup"]);
          const kept = yield* store.readRollup(hour(0));
          const keptHour = O.map(kept, (rollup) => rollup.hour);
          assertSome(keptHour, hour(0));
        }).pipe(
          withLayer(layerGithubLedgerStoreLive),
          withStateRoot(root),
          Effect.provideService(FileSystem.FileSystem, blocked)
        );
      })
    );

    it.effect("gives up a reclaimed stale lease when another process creates the lock first", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-lease-race-" });
        const lock = path.join(root, "sampler", "user_alice.lock");
        // A competitor writes its own lock between this process's rename of the stale one and its retry.
        const racing: FileSystem.FileSystem = {
          ...fs,
          rename: (from, to) => fs.rename(from, to).pipe(Effect.andThen(fs.writeFileString(lock, "competitor\n"))),
        };
        yield* fs.makeDirectory(path.dirname(lock), { recursive: true });
        yield* fs.writeFileString(lock, "stale\n");
        yield* fs.utimes(lock, 1, 1);
        yield* TestClock.setTime(10 * 60_000);
        yield* Effect.gen(function* () {
          const store = yield* GithubLedgerStore;
          const won = yield* Effect.scoped(store.acquireSamplerLease(alice));
          assertFalse(won);
          const holder = yield* fs.readFileString(lock);
          expect(holder).toBe("competitor\n");
        }).pipe(
          withLayer(layerGithubLedgerStoreLive),
          withStateRoot(root),
          Effect.provideService(FileSystem.FileSystem, racing)
        );
      })
    );

    it.effect("leaves a fresh lease to the process holding it", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-lease-fresh-" });
        const lock = path.join(root, "sampler", "user_alice.lock");
        yield* fs.makeDirectory(path.dirname(lock), { recursive: true });
        yield* fs.writeFileString(lock, "holder\n");
        // The lease was touched one minute before the clock, inside the two-minute staleness bound.
        yield* fs.utimes(lock, 1, 1);
        yield* TestClock.setTime(1_000 + 60_000);
        yield* Effect.gen(function* () {
          const store = yield* GithubLedgerStore;
          const won = yield* Effect.scoped(store.acquireSamplerLease(alice));
          assertFalse(won);
          const holder = yield* fs.readFileString(lock);
          expect(holder).toBe("holder\n");
        }).pipe(withLayer(layerGithubLedgerStoreLive), withStateRoot(root));
      })
    );

    it.effect("gives up a stale lease another reclaimer renamed away first", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-lease-lost-" });
        const lock = path.join(root, "sampler", "user_alice.lock");
        const competitor = `${lock}.stale.competitor`;
        // A competitor renames the stale lock away just before this process's own rename, which then finds nothing.
        const losing: FileSystem.FileSystem = {
          ...fs,
          rename: (from, to) => fs.rename(from, competitor).pipe(Effect.andThen(fs.rename(from, to))),
        };
        yield* fs.makeDirectory(path.dirname(lock), { recursive: true });
        yield* fs.writeFileString(lock, "stale\n");
        yield* fs.utimes(lock, 1, 1);
        yield* TestClock.setTime(10 * 60_000);
        yield* Effect.gen(function* () {
          const store = yield* GithubLedgerStore;
          const won = yield* Effect.scoped(store.acquireSamplerLease(alice));
          assertFalse(won);
          const lockExists = yield* fs.exists(lock);
          assertFalse(lockExists);
          const competitorHolds = yield* fs.readFileString(competitor);
          expect(competitorHolds).toBe("stale\n");
        }).pipe(
          withLayer(layerGithubLedgerStoreLive),
          withStateRoot(root),
          Effect.provideService(FileSystem.FileSystem, losing)
        );
      })
    );

    it.effect("fails a sampler lease it cannot create for a reason other than a holder", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "github-ledger-lease-denied-" });
        const blocked = deniedFileSystem(fs, { write: Str.endsWith(".lock") });
        yield* Effect.gen(function* () {
          const store = yield* GithubLedgerStore;
          const error = yield* store.acquireSamplerLease(alice).pipe(Effect.scoped, Effect.flip);
          expect([error.reason, error.detail]).toStrictEqual(["write", "create the sampler lease"]);
        }).pipe(
          withLayer(layerGithubLedgerStoreLive),
          withStateRoot(root),
          Effect.provideService(FileSystem.FileSystem, blocked)
        );
      })
    );
  });
});
