import { handleScaleDown, RunnerPool, RunnerTag, SelfHostedRunner } from "@beep/alchemy-github-runners";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as TestClock from "effect/testing/TestClock";
import { World, worldContext } from "./support/FakeWorld.ts";
import {
  heavyPool,
  liveHeavyPool,
  liveOverflowPool,
  livePoolConfig,
  oldFleetPrefixes,
  oldFleetRunnerName,
  oldFleetTags,
  poolConfig,
} from "./support/Fixtures.ts";
import type { PoolRuntimeConfig } from "@beep/alchemy-github-runners";

const minute = 60_000;

const runnerTags = (extra: Record<string, string> = {}) => ({
  "ghr:Application": "github-action-runner",
  "ghr:environment": "beep-ci-heavy",
  "ghr:Type": "Org",
  "ghr:Owner": "beep-effect",
  ...extra,
});

const launchWithIdleRegisteredRunners = (world: World, count: number, launchTime: number) =>
  A.map(world.launch(count, runnerTags(), launchTime), (instanceId, index) => {
    const id = 500 + world.githubRunners.length + index;
    world.githubRunners.push(
      SelfHostedRunner.make({ id, name: `beep-ci-${instanceId}`, status: "online", busy: false })
    );
    return { instanceId, id };
  });

const run = Effect.fn("runScaleDown")(function* (world: World, pool: RunnerPool = heavyPool) {
  return yield* handleScaleDown(poolConfig(pool)).pipe(Effect.provideContext(worldContext(world)));
});

describe("handleScaleDown", () => {
  it.effect("deregisters then terminates an idle runner past its minimum running time", () =>
    Effect.gen(function* () {
      const world = new World();
      const [runner] = launchWithIdleRegisteredRunners(world, 1, 0);
      yield* TestClock.adjust(6 * minute);
      const decisions = yield* run(world);
      expect(A.map(decisions, (decision) => decision.action)).toStrictEqual(["terminated"]);
      expect(world.deletedRunners).toStrictEqual([runner?.id]);
      expect(world.terminated).toStrictEqual([runner?.instanceId]);
    })
  );

  it.effect("leaves a runner alone inside its minimum running time", () =>
    Effect.gen(function* () {
      const world = new World();
      launchWithIdleRegisteredRunners(world, 1, 0);
      yield* TestClock.adjust(4 * minute);
      const decisions = yield* run(world);
      expect(decisions).toStrictEqual([]);
      expect(world.terminated).toStrictEqual([]);
    })
  );

  it.effect("keeps a busy runner and keeps idleCount runners, evicting the oldest first", () =>
    Effect.gen(function* () {
      const world = new World();
      const [old] = launchWithIdleRegisteredRunners(world, 1, 0);
      const [young] = launchWithIdleRegisteredRunners(world, 1, minute);
      const [busy] = launchWithIdleRegisteredRunners(world, 1, 2 * minute);
      world.githubRunners = A.map(world.githubRunners, (runner) =>
        runner.id === busy?.id ? SelfHostedRunner.make({ ...runner, busy: true }) : runner
      );
      yield* TestClock.adjust(30 * minute);
      const decisions = yield* run(world, RunnerPool.make({ ...heavyPool, idleCount: 1 }));
      expect(A.map(decisions, (decision) => [decision.instanceId, decision.action])).toStrictEqual([
        [busy?.instanceId, "kept-idle"],
        [young?.instanceId, "terminated"],
        [old?.instanceId, "terminated"],
      ]);
      const busyWorld = new World();
      const [onlyBusy] = launchWithIdleRegisteredRunners(busyWorld, 1, 0);
      busyWorld.githubRunners = A.map(busyWorld.githubRunners, (runner) =>
        SelfHostedRunner.make({ ...runner, busy: true })
      );
      const busyDecisions = yield* run(busyWorld);
      expect(A.map(busyDecisions, (decision) => [decision.instanceId, decision.action])).toStrictEqual([
        [onlyBusy?.instanceId, "busy"],
      ]);
      expect(busyWorld.terminated).toStrictEqual([]);
    })
  );

  it.effect("does not terminate when GitHub deregistration fails", () =>
    Effect.gen(function* () {
      const world = new World();
      const [runner] = launchWithIdleRegisteredRunners(world, 1, 0);
      world.busyOnDelete = [runner?.id ?? 0];
      yield* TestClock.adjust(10 * minute);
      const decisions = yield* run(world);
      expect(A.map(decisions, (decision) => decision.action)).toStrictEqual(["skipped"]);
      expect(world.terminated).toStrictEqual([]);
    })
  );

  it.effect("tags an instance that never registered as orphan after the boot time, then terminates it next pass", () =>
    Effect.gen(function* () {
      const world = new World();
      const [instanceId] = world.launch(1, runnerTags(), 0);
      yield* TestClock.adjust(6 * minute);
      const first = yield* run(world);
      expect(A.map(first, (decision) => [decision.instanceId, decision.action])).toStrictEqual([
        [instanceId, "orphaned"],
      ]);
      expect(world.instances[0]?.tags["ghr:orphan"]).toBe("true");
      const second = yield* run(world);
      expect(A.map(second, (decision) => [decision.instanceId, decision.action])).toStrictEqual([
        [instanceId, "terminated"],
      ]);
      expect(world.terminated).toStrictEqual([instanceId]);
    })
  );

  it.effect("un-orphans a registered orphan GitHub still reports online, and terminates one GitHub forgot", () =>
    Effect.gen(function* () {
      const world = new World();
      const [alive] = world.launch(1, runnerTags({ "ghr:orphan": "true", "ghr:github_runner_id": "700" }), 0);
      const [gone] = world.launch(1, runnerTags({ "ghr:orphan": "true", "ghr:github_runner_id": "701" }), 0);
      world.githubRunners.push(
        SelfHostedRunner.make({ id: 700, name: `beep-ci-${alive}`, status: "online", busy: true })
      );
      const decisions = yield* run(world);
      expect(A.map(decisions, (decision) => [decision.instanceId, decision.action])).toStrictEqual([
        [alive, "unorphaned"],
        [gone, "terminated"],
      ]);
      expect(world.instances[0]?.tags["ghr:orphan"]).toBeUndefined();
    })
  );

  it.effect("never touches instances of another pool or with the bypass tag", () =>
    Effect.gen(function* () {
      const world = new World();
      world.launch(1, runnerTags({ "ghr:environment": "beep-ci-overflow" }), 0);
      const [bypass] = world.launch(1, runnerTags({ "ghr:bypass-removal": "true" }), 0);
      yield* TestClock.adjust(60 * minute);
      const decisions = yield* run(world);
      expect(A.map(decisions, (decision) => [decision.instanceId, decision.action])).toStrictEqual([
        [bypass, "skipped"],
      ]);
      expect(world.terminated).toStrictEqual([]);
    })
  );
});

describe("handleScaleDown across the cutover's two fleets, which share one AWS account and one GitHub org", () => {
  const seedOldFleet = (world: World) =>
    A.flatMap(oldFleetPrefixes, (prefix, index) => {
      const base = 800 + 10 * index;
      const tags = oldFleetTags(prefix);
      const orphanTags = (runnerId: number) => ({
        ...tags,
        [RunnerTag.orphan]: "true",
        [RunnerTag.githubRunnerId]: String(runnerId),
      });
      const [idle = "", runnerless = ""] = world.launch(2, tags, 0);
      const [orphanOnline = ""] = world.launch(1, orphanTags(base + 1), 0);
      const [orphanGone = ""] = world.launch(1, orphanTags(base + 2), 0);
      world.githubRunners.push(
        SelfHostedRunner.make({ id: base, name: oldFleetRunnerName(prefix)(idle), status: "online", busy: false }),
        SelfHostedRunner.make({
          id: base + 1,
          name: oldFleetRunnerName(prefix)(orphanOnline),
          status: "online",
          busy: true,
        }),
        SelfHostedRunner.make({
          id: base + 2,
          name: oldFleetRunnerName(prefix)(orphanGone),
          status: "offline",
          busy: true,
        })
      );
      return [idle, runnerless, orphanOnline, orphanGone];
    });

  const seedOwnPool = (world: World, config: PoolRuntimeConfig) => {
    const tags = runnerTags({ "ghr:environment": config.environment });
    const [idle = "", runnerless = ""] = world.launch(2, tags, 0);
    const [orphan = ""] = world.launch(
      1,
      { ...tags, [RunnerTag.orphan]: "true", [RunnerTag.githubRunnerId]: "900" },
      0
    );
    world.githubRunners.push(
      SelfHostedRunner.make({
        id: 901,
        name: `${config.pool.runnerNamePrefix}${idle}`,
        status: "online",
        busy: false,
      }),
      SelfHostedRunner.make({ id: 900, name: `${config.pool.runnerNamePrefix}${orphan}`, status: "online", busy: true })
    );
    return { idle, runnerless, orphan };
  };

  A.forEach([liveHeavyPool, liveOverflowPool], (pool) =>
    it.effect(`a ${pool.name} pass leaves the old fleet's heavy and overflow instances untouched`, () =>
      Effect.gen(function* () {
        const world = new World();
        const config = livePoolConfig(pool);
        const oldInstances = seedOldFleet(world);
        const own = seedOwnPool(world, config);
        const snapshot = () =>
          A.map(
            A.filter(world.instances, (instance) => A.contains(oldInstances, instance.instanceId)),
            (instance) => [instance.instanceId, instance.state, { ...instance.tags }]
          );
        const before = snapshot();
        yield* TestClock.adjust(60 * minute);
        const decisions = yield* handleScaleDown(config).pipe(Effect.provideContext(worldContext(world)));
        expect(config.environment).toBe(`beep-fleet-prod-${pool.name}`);
        expect(
          A.map(decisions, (decision) => [decision.instanceId, decision.action]),
          "the own pool holds the first three old-fleet kinds: the positive control under the same live config"
        ).toStrictEqual([
          [own.orphan, "unorphaned"],
          [own.idle, "terminated"],
          [own.runnerless, "orphaned"],
          [own.orphan, "busy"],
        ]);
        expect([world.deletedRunners, world.terminated, world.tagged, world.untagged]).toStrictEqual([
          [901],
          [own.idle],
          [own.runnerless],
          [own.orphan],
        ]);
        expect(A.map(world.githubRunners, (runner) => runner.id)).toStrictEqual([800, 801, 802, 810, 811, 812, 900]);
        expect(
          snapshot(),
          "each old pool's idle runner, runner-less instance, online orphan and offline busy orphan stay untouched"
        ).toStrictEqual(before);
      })
    )
  );
});
