import { handleScaleDown, RunnerPool, SelfHostedRunner } from "@beep/alchemy-github-runners";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as TestClock from "effect/testing/TestClock";
import { World, worldContext } from "./support/FakeWorld.ts";
import { heavyPool, poolConfig } from "./support/Fixtures.ts";

const minute = 60_000;

const runnerTags = (extra: Record<string, string> = {}) => ({
  "ghr:Application": "github-action-runner",
  "ghr:environment": "beep-ci-heavy",
  "ghr:Type": "Org",
  "ghr:Owner": "beep-effect",
  ...extra,
});

/** Launches `count` instances at `launchTime` and registers an idle GitHub runner for each. */
const seedRegistered = (world: World, count: number, launchTime: number) =>
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
      const [runner] = seedRegistered(world, 1, 0);
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
      seedRegistered(world, 1, 0);
      yield* TestClock.adjust(4 * minute);
      const decisions = yield* run(world);
      expect(decisions).toStrictEqual([]);
      expect(world.terminated).toStrictEqual([]);
    })
  );

  it.effect("keeps a busy runner and keeps idleCount runners, evicting the oldest first", () =>
    Effect.gen(function* () {
      const world = new World();
      const [old] = seedRegistered(world, 1, 0);
      const [young] = seedRegistered(world, 1, minute);
      const [busy] = seedRegistered(world, 1, 2 * minute);
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
      const [onlyBusy] = seedRegistered(busyWorld, 1, 0);
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
      const [runner] = seedRegistered(world, 1, 0);
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
