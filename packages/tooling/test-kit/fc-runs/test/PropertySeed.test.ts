import { envFcSeed } from "@beep/fc-runs";
import { describe, it } from "@effect/vitest";
import { assertFalse, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";

const seed = envFcSeed();
const runs = 20;
const sampled = (options: { readonly seed?: number }) =>
  Arbitrary.sampleEffect(Arbitrary.schema(S.Int), { count: runs, ...options });

const unseeded = Ref.makeUnsafe<ReadonlyArray<number>>([]);
const seeded = Ref.makeUnsafe<ReadonlyArray<number>>([]);
const keep = (drawn: Ref.Ref<ReadonlyArray<number>>) => (value: number) =>
  Effect.asVoid(Ref.update(drawn, A.append(value)));

const logToProcessConsole = (line: string) =>
  Effect.provideService(Console.log(`[property-seed] worker seed ${line}`), Console.Console, globalThis.console);

describe("the pinned property seed reaches every property in a worker, in order since the last test reads what the others drew", {
  concurrent: false,
}, () => {
  it.effect.prop("draws for a property that passes no seed", [S.Int], ([value]) => keep(unseeded)(value), {
    arbitrary: { runs },
  });

  it.effect.prop("draws for a property that passes the seed", [S.Int], ([value]) => keep(seeded)(value), {
    arbitrary: { runs, seed: O.getOrElse(seed, () => 1) },
  });

  it.effect("repeats both and a sample when pinned, and nothing otherwise", () =>
    Effect.gen(function* () {
      const drawn = yield* Ref.get(unseeded);
      const expected = yield* Ref.get(seeded);
      const first = yield* sampled({});
      const second = yield* sampled({});
      const explicit = yield* sampled({ seed: O.getOrElse(seed, () => 1) + 1 });
      const pinned = O.match(seed, { onNone: () => "random", onSome: (value) => `${value}` });
      yield* logToProcessConsole(
        `${pinned}, ${drawn.length} runs without fcRuns, drew ${A.join(
          A.map(drawn, (value) => `${value}`),
          " "
        )}`
      );
      deepStrictEqual([drawn.length, expected.length], [runs, runs]);
      deepStrictEqual(Equal.equals(drawn, expected), O.isSome(seed));
      deepStrictEqual(Equal.equals(first, second), O.isSome(seed));
      assertFalse(Equal.equals(explicit, first));
    })
  );
});
