// The seed the shared Vitest setup pins reaches every property in a worker, whether or not the
// property passes options of its own; without a pinned seed, properties draw random seeds.
import { envFcSeed } from "@beep/fc-runs";
import { describe, it } from "@effect/vitest";
import { assertFalse, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import type { CheckOptions } from "effect/Arbitrary";

const seed = envFcSeed();
// The line the run's log carries; the test console would keep it.
const report = (line: string) =>
  Effect.provideService(Console.log(`[property-seed] worker seed ${line}`), Console.Console, globalThis.console);

const integers = Arbitrary.schema(S.Int);

// What a check with the given options draws, in order.
const checked = Effect.fnUntraced(function* (options: CheckOptions) {
  const seen = yield* Ref.make(A.empty<number>());
  yield* Arbitrary.checkEffect(integers, (value) => Effect.as(Ref.update(seen, A.append(value)), true), {
    runs: 20,
    ...options,
  });
  return yield* Ref.get(seen);
});

describe("the pinned property seed", () => {
  it.effect.skipIf(O.isNone(seed))(
    "is the seed of a check and a sample that pass none, and an explicit seed wins",
    () =>
      Effect.gen(function* () {
        const pinned = { seed: O.getOrThrow(seed) };
        yield* report(`${pinned.seed}`);
        const unseeded = yield* checked({});
        const seeded = yield* checked(pinned);
        const explicit = yield* checked({ seed: pinned.seed + 1 });
        const sample = yield* Arbitrary.sampleEffect(integers, { count: 20 });
        const seededSample = yield* Arbitrary.sampleEffect(integers, { count: 20, ...pinned });
        deepStrictEqual(unseeded, seeded);
        deepStrictEqual(sample, seededSample);
        assertFalse(A.makeEquivalence((left: number, right: number) => left === right)(explicit, seeded));
      })
  );

  it.effect.skipIf(O.isSome(seed))("is absent otherwise: two checks draw different values", () =>
    Effect.gen(function* () {
      yield* report("random");
      const first = yield* checked({});
      const second = yield* checked({});
      assertFalse(A.makeEquivalence((left: number, right: number) => left === right)(first, second));
    })
  );
});
