import { checkRunnerPool, RunnerPoolUnnamed, runnerPoolName } from "@alchemy.run/effect-cluster/Host";
import { expect, it } from "@effect/vitest";
import { Sequence } from "@proto/kernel/Measure";
import * as RunnerAddress from "effect/cluster/RunnerAddress";
import * as ShardingConfig from "effect/cluster/ShardingConfig";
import * as Effect from "effect/Effect";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";

// Phase 12: the commit fence's start check. A runner whose fenced commits could never succeed (no
// address, or a pool not named after it) fails at start with `RunnerPoolUnnamed`; one whose pool
// carries its name starts. The check reads the runner's configuration, which is what is run here
// with Effect's own `ShardingConfig`; the runner bootstrap that declares the name and the launch
// that runs the check are not exercised in process (notes/phase-12.md).
// Every address below is generated from Effect's `RunnerAddress` schema; a host longer than the
// 63 bytes PostgreSQL keeps of a name is generated on its own, so the hashed name is exercised too.

const Address = RunnerAddress.RunnerAddress;
/** An address whose host alone is longer than PostgreSQL keeps of a pool's name. */
const LongAddress = S.Struct({ host: S.String.check(S.isMinLength(64)), port: S.Int });
/** What a runner's bootstrap may have named its pool: nothing, or any name. */
const PoolName = S.UndefinedOr(S.String);

/** The start check on a runner configured with `config` whose bootstrap declared `poolName`. */
const startWith = (poolName: string | undefined, config: Partial<ShardingConfig.ShardingConfig["Service"]>) =>
  checkRunnerPool(poolName).pipe(Effect.provideService(ShardingConfig.ShardingConfig, { ...ShardingConfig.defaults, ...config }));
/** The start check on the runner at `address`, its pool named `poolName`. */
const startAt = (address: RunnerAddress.RunnerAddress, poolName: string | undefined) =>
  startWith(poolName, { runnerAddress: O.some(address) });
const nameOf = (address: RunnerAddress.RunnerAddress) => runnerPoolName(address.host, address.port);

it.effect.prop("a runner whose pool is named after its address starts", [Address], ([address]) => startAt(address, nameOf(address)));

it.effect.prop("a runner whose host is too long for PostgreSQL's name starts, named by its hash on both sides", [LongAddress], ([{ host, port }]) =>
  startAt(RunnerAddress.make(host, port), runnerPoolName(host, port)),
);

it.prop("a pool's name is kept whole by PostgreSQL: at most 63 bytes of printable ASCII", [S.Union([Address, LongAddress])], ([{ host, port }]) => {
  const name = runnerPoolName(host, port);
  expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(63);
  expect(name).toMatch(/^[\x20-\x7e]*$/);
});

it.prop("two runners on the same host, at different ports, get different pool names", [S.Union([Address, LongAddress]), Sequence], ([{ host, port }, apart]) => {
  expect(runnerPoolName(host, port)).not.toBe(runnerPoolName(host, port + apart));
});

it.effect.prop("a runner whose pool is not named fails at start, naming the cause and the name to give", [Address], ([address]) =>
  Effect.gen(function* () {
    const unnamed = yield* Effect.flip(startAt(address, undefined));
    expect(unnamed).toBeInstanceOf(RunnerPoolUnnamed);
    expect(unnamed.reason).toBe("pool-not-named");
    expect(unnamed.message).toContain(nameOf(address));
  }),
);

it.effect.prop("a runner whose pool is named for another runner fails at start", [Address, Sequence], ([address, apart]) =>
  Effect.gen(function* () {
    const other = RunnerAddress.make(address.host, address.port + apart);
    const misnamed = yield* Effect.flip(startAt(address, nameOf(other)));
    expect(misnamed.reason).toBe("pool-named-for-another-runner");
  }),
);

it.effect.prop("a runner without an address fails at start, whatever its pool is named", [PoolName], ([poolName]) =>
  Effect.gen(function* () {
    const nowhere = yield* Effect.flip(startWith(poolName, { runnerAddress: O.none() }));
    expect(nowhere.reason).toBe("no-runner-address");
  }),
);

it.effect.prop("a runner whose storage takes no advisory locks has no lock session to tell apart, and starts", [Address.pipe(S.Option), PoolName], ([runnerAddress, poolName]) =>
  startWith(poolName, { runnerAddress, shardLockDisableAdvisory: true }),
);
