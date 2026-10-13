import { assert, describe, it } from "@effect/vitest";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PackedInstallError, InstalledConsumer, PackedInstallResult } from "../../effected/workspaces/PackedInstall.ts";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding encoded values succeeds and preserves their value`,
    [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }),
    runs,
  );
};

describe("PackedInstall property floor", () => {
  roundTrips("PackedInstallError", PackedInstallError);
  roundTrips("InstalledConsumer", InstalledConsumer);
  roundTrips("PackedInstallResult", PackedInstallResult);
});

import { PackedInstall } from "../../effected/workspaces/PackedInstall.ts";
it.effect.prop("scrubEnv is idempotent and preserves caller values outside manager context", [Arbitrary.schema(S.String), Arbitrary.schema(S.String)],
  ([path, home]) => Effect.sync(() => {
    const cleaned = PackedInstall.scrubEnv({ PATH: path, HOME: home, CI: "true", npm_config_user_agent: "npm/11", EMPTY: undefined });
    assert.deepStrictEqual(cleaned, { PATH: path, HOME: home });
    assert.deepStrictEqual(PackedInstall.scrubEnv(cleaned), cleaned);
  }), runs);
