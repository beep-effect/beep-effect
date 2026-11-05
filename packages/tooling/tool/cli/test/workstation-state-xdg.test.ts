import { resolveWorkstationStateDir } from "@beep/repo-cli/test/SharedInternals";
import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";

type Row = readonly [name: string, env: Readonly<Record<string, string>>, expected: string];

const resolveIn = (env: Readonly<Record<string, string>>) =>
  resolveWorkstationStateDir({ override: "BEEP_TEST_STATE_ROOT", store: "sessions" }).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { ...env } }))
  );

/** The env matrix of the state root. */
const resolved: ReadonlyArray<Row> = [
  ["the override wins", { BEEP_TEST_STATE_ROOT: "/override", XDG_STATE_HOME: "/xdg", HOME: "/h" }, "/override"],
  ["XDG_STATE_HOME namespaced", { XDG_STATE_HOME: "/xdg", HOME: "/h" }, "/xdg/beep/sessions"],
  ["XDG_STATE_HOME without HOME", { XDG_STATE_HOME: "/xdg" }, "/xdg/beep/sessions"],
  ["the HOME default", { HOME: "/h" }, "/h/.local/state/beep/sessions"],
  ["an empty XDG_STATE_HOME", { XDG_STATE_HOME: "", HOME: "/h" }, "/h/.local/state/beep/sessions"],
  ["a whitespace override", { BEEP_TEST_STATE_ROOT: "  ", HOME: "/h" }, "/h/.local/state/beep/sessions"],
];

/**
 * Inverted rows: before @beep/xdg a relative XDG_STATE_HOME or HOME became a
 * relative state root and HOME was joined unnormalized. The spec ignores a
 * relative value, so the HOME default applies, or nothing resolves at all.
 */
const divergent: ReadonlyArray<Row> = [
  ["a relative XDG_STATE_HOME", { XDG_STATE_HOME: "relative", HOME: "/h" }, "/h/.local/state/beep/sessions"],
  ["a HOME with a trailing slash", { HOME: "/h/" }, "/h/.local/state/beep/sessions"],
];

describe("resolveWorkstationStateDir env matrix", () => {
  for (const [name, env, expected] of [...resolved, ...divergent]) {
    it.effect(name, () =>
      Effect.gen(function* () {
        const resolvedIn = yield* resolveIn(env);
        assert.strictEqual(resolvedIn, expected);
      })
    );
  }

  const unresolved: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = [
    ["nothing set", {}],
    ["an empty HOME", { HOME: "" }],
    // Inverted: a relative HOME used to resolve to relative/.local/state/beep/sessions.
    ["a relative HOME", { HOME: "relative" }],
  ];
  for (const [name, env] of unresolved) {
    it.effect(`fails with a ConfigError for ${name}`, () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(resolveIn(env));
        assert.strictEqual(error._tag, "ConfigError");
      })
    );
  }
});
