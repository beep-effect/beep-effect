/**
 * The repo CLI's one CI rule: `RuntimeEnv.ci` is `Some`.
 *
 * The table pins every row on which the rule differs from one of the three
 * predicates it replaced, and the rows on which all of them agree, the hosted
 * GitHub Actions runner among them. The retired predicates are kept here as
 * oracles, transcribed from their last bodies, so each divergence is a stated
 * expectation rather than an accident.
 */
import { isCi, isCiSync } from "@beep/repo-cli-kit/cli/EnvConfig";
import { CurrentRuntimeEnv, RuntimeEnv } from "@beep/runtime-env/RuntimeEnv";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";

type Env = Readonly<Record<string, string>>;

/** Every variable the rule reads. */
const SIGNALS = ["CI", "GITHUB_ACTIONS", "CONTINUOUS_INTEGRATION"] as const;

/** `isCi`/`isCiSync`, Lint, CiLane, GithubChecks and the Turbo secret session: `CI` is exactly `"true"`. */
const exactTrue = (env: Env): boolean => env.CI === "true";

/** DeletePackage: `Config.Boolean("CI")` with a `false` default. */
const configBoolean = (env: Env): Effect.Effect<boolean | "decode-failure"> =>
  Config.Boolean("CI").pipe(
    Config.withDefault(false),
    (config) => config.parse(ConfigProvider.fromUnknown(env)),
    Effect.result,
    Effect.map(Result.match({ onSuccess: (value) => value, onFailure: () => "decode-failure" as const }))
  );

/** `detectQualityProfile`: `CI` is non-empty. */
const nonEmpty = (env: Env): boolean => Str.isNonEmpty(env.CI ?? "");

type Row = {
  readonly name: string;
  readonly env: Env;
  readonly ci: boolean;
  readonly exactTrue: boolean;
  readonly configBoolean: boolean | "decode-failure";
  readonly nonEmpty: boolean;
};

const rows: ReadonlyArray<Row> = [
  { name: "no CI variable", env: {}, ci: false, exactTrue: false, configBoolean: false, nonEmpty: false },
  { name: "CI=true", env: { CI: "true" }, ci: true, exactTrue: true, configBoolean: true, nonEmpty: true },
  {
    name: "hosted GitHub Actions runner (CI=true, GITHUB_ACTIONS=true)",
    env: { CI: "true", GITHUB_ACTIONS: "true" },
    ci: true,
    exactTrue: true,
    configBoolean: true,
    nonEmpty: true,
  },
  { name: "CI=1", env: { CI: "1" }, ci: true, exactTrue: false, configBoolean: true, nonEmpty: true },
  { name: "CI=yes", env: { CI: "yes" }, ci: true, exactTrue: false, configBoolean: true, nonEmpty: true },
  {
    name: "CONTINUOUS_INTEGRATION alone",
    env: { CONTINUOUS_INTEGRATION: "true" },
    ci: true,
    exactTrue: false,
    configBoolean: false,
    nonEmpty: false,
  },
  {
    name: "GITHUB_ACTIONS alone",
    env: { GITHUB_ACTIONS: "true" },
    ci: true,
    exactTrue: false,
    configBoolean: false,
    nonEmpty: false,
  },
  {
    name: "GITHUB_ACTIONS with CI=false",
    env: { GITHUB_ACTIONS: "true", CI: "false" },
    ci: true,
    exactTrue: false,
    configBoolean: false,
    nonEmpty: true,
  },
  { name: "CI=false", env: { CI: "false" }, ci: false, exactTrue: false, configBoolean: false, nonEmpty: true },
  { name: "CI=0", env: { CI: "0" }, ci: false, exactTrue: false, configBoolean: false, nonEmpty: true },
  { name: "CI empty", env: { CI: "" }, ci: false, exactTrue: false, configBoolean: false, nonEmpty: false },
  { name: "CI=no", env: { CI: "no" }, ci: false, exactTrue: false, configBoolean: false, nonEmpty: true },
  { name: "CI=off", env: { CI: "off" }, ci: false, exactTrue: false, configBoolean: false, nonEmpty: true },
  { name: "CI=n", env: { CI: "n" }, ci: false, exactTrue: false, configBoolean: false, nonEmpty: true },
  { name: "CI=NO", env: { CI: "NO" }, ci: false, exactTrue: false, configBoolean: "decode-failure", nonEmpty: true },
  { name: "CI=TRUE", env: { CI: "TRUE" }, ci: true, exactTrue: false, configBoolean: "decode-failure", nonEmpty: true },
  {
    name: "CI=banana",
    env: { CI: "banana" },
    ci: true,
    exactTrue: false,
    configBoolean: "decode-failure",
    nonEmpty: true,
  },
  { name: "CI=Off", env: { CI: "Off" }, ci: false, exactTrue: false, configBoolean: "decode-failure", nonEmpty: true },
];

describe("the one CI rule", () => {
  it("isCiSync classifies every truth-table row", () => {
    expect(A.map(rows, (row) => [row.name, isCiSync(row.env)])).toEqual(A.map(rows, (row) => [row.name, row.ci]));
  });

  it.effect("isCi agrees with isCiSync on every row through a provided ConfigProvider", () =>
    Effect.gen(function* () {
      const verdicts = yield* Effect.forEach(rows, (row) =>
        isCi.pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(row.env)),
          Effect.map((ci) => [row.name, ci] as const)
        )
      );
      expect(verdicts).toEqual(A.map(rows, (row) => [row.name, row.ci] as const));
    })
  );

  it.effect("isCi reads a provided CurrentRuntimeEnv instead of the ambient provider", () =>
    Effect.gen(function* () {
      const withSnapshot = (snapshot: Env, ambient: Env) =>
        isCi.pipe(
          Effect.provideService(CurrentRuntimeEnv, RuntimeEnv.fromRecord(snapshot)),
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(ambient))
        );
      const withSnapshot1 = yield* withSnapshot({ CI: "1" }, {});
      assertTrue(withSnapshot1);
      const withSnapshot2 = yield* withSnapshot({}, { CI: "true" });
      assertFalse(withSnapshot2);
    })
  );

  it.effect("the retired predicates match their recorded verdicts", () =>
    Effect.gen(function* () {
      const recorded = yield* Effect.forEach(rows, (row) =>
        Effect.map(configBoolean(row.env), (boolean) => [row.name, exactTrue(row.env), boolean, nonEmpty(row.env)])
      );
      expect(recorded).toEqual(
        A.map(rows, (row) => [row.name, row.exactTrue, row.configBoolean, row.nonEmpty] as const)
      );
    })
  );

  it("the hosted-runner row agrees under every predicate", () => {
    const hosted = A.findFirst(
      rows,
      (row) => row.name === "hosted GitHub Actions runner (CI=true, GITHUB_ACTIONS=true)"
    );
    assertTrue(O.exists(hosted, (row) => row.ci && row.exactTrue && row.configBoolean === true && row.nonEmpty));
  });

  it('diverges from the exact `CI === "true"` rule only on the pinned rows', () => {
    expect(
      A.map(
        A.filter(rows, (row) => row.ci !== row.exactTrue),
        (row) => row.name
      )
    ).toEqual([
      "CI=1",
      "CI=yes",
      "CONTINUOUS_INTEGRATION alone",
      "GITHUB_ACTIONS alone",
      "GITHUB_ACTIONS with CI=false",
      "CI=TRUE",
      "CI=banana",
    ]);
  });

  it("reads a value changed after startup through the default record", () => {
    const [ci, githubActions, continuousIntegration] = SIGNALS;
    const saved = A.map(SIGNALS, (key) => [key, Bun.env[key]] as const);
    try {
      delete Bun.env[ci];
      delete Bun.env[githubActions];
      Bun.env[continuousIntegration] = "true";
      assertTrue(isCiSync());
      Bun.env[continuousIntegration] = "false";
      assertFalse(isCiSync());
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete Bun.env[key];
        else Bun.env[key] = value;
      }
    }
  });
});
