import { $RepoCliId } from "@beep/identity/packages";
import { it } from "@beep/test-runner";
import { assert, beforeAll } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import { Config, Effect } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("test/fixtures/bun-spawn-env");
// Optional env deliberately models the native API boundary: absence means inherit.
class SpawnEnvScenario extends S.Class<SpawnEnvScenario>($I`SpawnEnvScenario`)(
  {
    name: S.String,
    env: S.optionalKey(S.Record(S.String, S.UndefinedOr(S.String))),
    parentExpression: S.String,
    childExpression: S.String,
  },
  $I.annote("SpawnEnvScenario", {
    description: "A caller environment and the two synthetic values expected in the real child.",
  })
) {}

const scenarios = [
  SpawnEnvScenario.make({
    name: "omitted inherits",
    parentExpression: '"synthetic-parent"',
    childExpression: "undefined",
  }),
  SpawnEnvScenario.make({
    name: "empty replaces",
    env: {},
    parentExpression: "undefined",
    childExpression: "undefined",
  }),
  SpawnEnvScenario.make({
    name: "partial replaces",
    env: { BEEP_PARITY_CHILD: "synthetic-child" },
    parentExpression: "undefined",
    childExpression: '"synthetic-child"',
  }),
  SpawnEnvScenario.make({
    name: "explicit override",
    env: { BEEP_PARITY_PARENT: "synthetic-override" },
    parentExpression: '"synthetic-override"',
    childExpression: "undefined",
  }),
  SpawnEnvScenario.make({
    name: "undefined removes",
    env: { BEEP_PARITY_PARENT: undefined },
    parentExpression: "undefined",
    childExpression: "undefined",
  }),
];

beforeAll(() =>
  Effect.runPromise(
    Effect.gen(function* () {
      assert.strictEqual(yield* Config.String("BEEP_PARITY_PARENT"), "synthetic-parent");
      assertNone(yield* Config.option(Config.String("BEEP_PARITY_CHILD")));
      assert.strictEqual(P.isUndefined(process.versions.bun), (yield* Config.String("BEEP_PARITY_RUNTIME")) === "node");
    })
  )
);

for (const scenario of scenarios) {
  for (const objectForm of [false, true]) {
    const program = `process.exit(process.env.BEEP_PARITY_PARENT === ${scenario.parentExpression} && process.env.BEEP_PARITY_CHILD === ${scenario.childExpression} ? 0 : 61)`;
    const command = [process.execPath, "-e", program];
    const environment = P.isUndefined(scenario.env) ? {} : { env: scenario.env };
    it.effect(`spawnSync ${scenario.name} object=${objectForm}`, () =>
      Effect.sync(() => {
        const child = objectForm
          ? Bun.spawnSync({
              cmd: command,
              ...environment,
              stdout: "ignore",
              stderr: "ignore",
            })
          : Bun.spawnSync(command, {
              ...environment,
              stdout: "ignore",
              stderr: "ignore",
            });
        assert.strictEqual(child.exitCode, 0);
      })
    );
    it.effect(`spawn ${scenario.name} object=${objectForm}`, () =>
      Effect.gen(function* () {
        const child = objectForm
          ? Bun.spawn({
              cmd: command,
              ...environment,
              stdout: "ignore",
              stderr: "ignore",
            })
          : Bun.spawn(command, {
              ...environment,
              stdout: "ignore",
              stderr: "ignore",
            });
        assert.strictEqual(yield* Effect.tryPromise(() => child.exited), 0);
      })
    );
  }
}
