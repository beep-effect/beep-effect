import { checkRunnerPool, RunnerPoolUnnamed, runnerPoolName } from "@alchemy.run/effect-cluster/Host";
import { expect, it } from "@effect/vitest";
import * as RunnerAddress from "effect/cluster/RunnerAddress";
import * as ShardingConfig from "effect/cluster/ShardingConfig";
import * as Effect from "effect/Effect";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";

// Phase 12: the commit fence's start check. A runner whose fenced commits could never succeed (no
// address, or a pool not named after it) fails at start with `RunnerPoolUnnamed`; one whose pool
// carries its name starts. The check reads the runner's configuration, which is what is run here
// with Effect's own `ShardingConfig`; the runner bootstrap that declares the name and the launch
// that runs the check are not exercised in process (notes/phase-12.md).

const address = RunnerAddress.make("10.0.1.6", 34431);

/** The start check on a runner configured with `config` whose bootstrap declared `poolName`. */
const startWith = (poolName: string | undefined, config: Partial<ShardingConfig.ShardingConfig["Service"]>) =>
  checkRunnerPool(poolName).pipe(Effect.provideService(ShardingConfig.ShardingConfig, { ...ShardingConfig.defaults, ...config }));

it.effect("a runner whose pool is named after it starts", () =>
  Effect.gen(function* () {
    yield* startWith(runnerPoolName(address.host, address.port), { runnerAddress: O.some(address) });
    // A host name too long for PostgreSQL's 63 bytes is named by its hash, on both sides.
    const long = RunnerAddress.make(Str.repeat(70)("h"), 34431);
    yield* startWith(runnerPoolName(long.host, long.port), { runnerAddress: O.some(long) });
  }),
);

it.effect("a runner whose pool is not named fails at start, naming the cause and the name to give", () =>
  Effect.gen(function* () {
    const unnamed = yield* Effect.flip(startWith(undefined, { runnerAddress: O.some(address) }));
    expect(unnamed).toBeInstanceOf(RunnerPoolUnnamed);
    expect(unnamed.reason).toBe("pool-not-named");
    expect(unnamed.message).toContain("effect-cluster:10.0.1.6:34431");
  }),
);

it.effect("a runner without an address, or whose pool is named for another, fails at start", () =>
  Effect.gen(function* () {
    const nowhere = yield* Effect.flip(startWith(runnerPoolName(address.host, address.port), { runnerAddress: O.none() }));
    expect(nowhere.reason).toBe("no-runner-address");
    const other = yield* Effect.flip(startWith(runnerPoolName("10.0.1.7", 34431), { runnerAddress: O.some(address) }));
    expect(other.reason).toBe("pool-named-for-another-runner");
  }),
);

it.effect("a runner whose storage takes no advisory locks has no lock session to tell apart, and starts", () =>
  startWith(undefined, { runnerAddress: O.none(), shardLockDisableAdvisory: true }),
);
