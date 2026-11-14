import {
  HousekeeperRuntimeConfig,
  handleJobRetry,
  handleRunnerBinariesSync,
  handleSsmHousekeeping,
  ReleaseAsset,
  SyncerRuntimeConfig,
} from "@beep/alchemy-github-runners";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as TestClock from "effect/testing/TestClock";
import { World, worldContext } from "./support/FakeWorld.ts";
import { message, poolConfig } from "./support/Fixtures.ts";

const day = 86_400_000;

describe("handleJobRetry", () => {
  it.effect("puts a still-queued job back on the build queue and drops one that started", () =>
    Effect.gen(function* () {
      const world = new World();
      const retry = message({ id: 9, retryCounter: 0 });
      const requeued = yield* handleJobRetry({ config: poolConfig(), message: retry }).pipe(
        Effect.provideContext(worldContext(world))
      );
      expect(requeued).toBe(true);
      expect(A.map(world.sent, (sent) => sent.queueUrl)).toStrictEqual([
        "https://sqs.us-east-1.amazonaws.com/1/heavy-build",
      ]);
      world.jobQueued = false;
      const dropped = yield* handleJobRetry({ config: poolConfig(), message: retry }).pipe(
        Effect.provideContext(worldContext(world))
      );
      expect(dropped).toBe(false);
      expect(world.sent).toHaveLength(1);
    })
  );
});

describe("handleSsmHousekeeping", () => {
  it.effect("deletes token parameters older than the threshold and keeps fresh and foreign ones", () =>
    Effect.gen(function* () {
      const world = new World();
      world.ssm = {
        "/beep-ci/heavy/tokens/i-old": { value: "a", modified: 0, tags: {} },
        "/beep-ci/heavy/tokens/i-new": { value: "b", modified: 2 * day, tags: {} },
        "/beep-ci/app/github_app_id": { value: "1", modified: 0, tags: {} },
      };
      yield* TestClock.adjust(2 * day + 1);
      const config = HousekeeperRuntimeConfig.make({
        tokenPaths: ["/beep-ci/heavy/tokens"],
        minimumDaysOld: 1,
        dryRun: false,
      });
      const stale = yield* handleSsmHousekeeping(config).pipe(Effect.provideContext(worldContext(world)));
      expect(stale).toStrictEqual(["/beep-ci/heavy/tokens/i-old"]);
      expect(R.keys(world.ssm)).toStrictEqual(["/beep-ci/heavy/tokens/i-new", "/beep-ci/app/github_app_id"]);
    })
  );

  it.effect("reports but keeps stale tokens in a dry run", () =>
    Effect.gen(function* () {
      const world = new World();
      world.ssm = { "/p/tokens/i-old": { value: "a", modified: 0, tags: {} } };
      yield* TestClock.adjust(3 * day);
      const config = HousekeeperRuntimeConfig.make({ tokenPaths: ["/p/tokens"], minimumDaysOld: 1, dryRun: true });
      const stale = yield* handleSsmHousekeeping(config).pipe(Effect.provideContext(worldContext(world)));
      expect([stale, R.keys(world.ssm)]).toStrictEqual([["/p/tokens/i-old"], ["/p/tokens/i-old"]]);
    })
  );
});

describe("handleRunnerBinariesSync", () => {
  const config = SyncerRuntimeConfig.make({
    bucketName: "binaries",
    objectKey: "actions-runner-linux.tar.gz",
    os: "linux",
    architecture: "x64",
  });
  const asset = ReleaseAsset.make({
    name: "actions-runner-linux-x64-2.330.0.tar.gz",
    downloadUrl: "https://example/a",
  });

  it.effect("mirrors a new release and skips an up-to-date one", () =>
    Effect.gen(function* () {
      const world = new World();
      world.latestAsset = O.some(asset);
      const uploaded = yield* handleRunnerBinariesSync(config).pipe(Effect.provideContext(worldContext(world)));
      world.cachedName = O.some(asset.name);
      const skipped = yield* handleRunnerBinariesSync(config).pipe(Effect.provideContext(worldContext(world)));
      expect([uploaded, skipped, world.mirrored]).toStrictEqual([true, false, [asset.name]]);
    })
  );

  it.effect("fails when the release has no asset for the target", () =>
    Effect.gen(function* () {
      const world = new World();
      const error = yield* Effect.flip(
        handleRunnerBinariesSync(config).pipe(Effect.provideContext(worldContext(world)))
      );
      expect(error._tag).toBe("GitHubApiError");
    })
  );
});
