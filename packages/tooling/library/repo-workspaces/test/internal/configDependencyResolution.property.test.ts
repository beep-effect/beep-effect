import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { lookupPnpmfiles, ResolvedPnpmfile } from "@beep/repo-workspaces/internal/configDependencyResolution";
import { splitConfigDependencySpec } from "@beep/repo-workspaces/internal/configDependencySpecGrammar";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop(
  "supplied replay resolution preserves lenient first-plus version spelling and the supplied path",
  [Arbitrary.schema(S.String), Arbitrary.schema(S.String)],
  ([spec, path]) =>
    Effect.gen(function* () {
      const parsed = splitConfigDependencySpec(spec);
      const result = yield* lookupPnpmfiles({ [`config@${parsed.version}`]: path }, { config: spec });
      assert.deepStrictEqual(result, [
        ResolvedPnpmfile.make({ name: "config", version: parsed.version, source: "supplied", path }),
      ]);
      const canonical = parsed.integrity === undefined ? parsed.version : `${parsed.version}+${parsed.integrity}`;
      const lookupPnpmfiles1 = yield* lookupPnpmfiles({ [`config@${parsed.version}`]: path }, { config: canonical });
      assert.deepStrictEqual(lookupPnpmfiles1, result);
    }),
  runs
);

it.effect.prop(
  "resolved replay codecs preserve every source rung and an absent pnpmfile",
  [Arbitrary.schema(ResolvedPnpmfile)],
  ([resolved]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ResolvedPnpmfile)(resolved);
      const decoded = yield* S.decodeEffect(ResolvedPnpmfile)(encoded);
      assert.deepStrictEqual(decoded, resolved);
      const value = yield* S.encodeEffect(ResolvedPnpmfile)(decoded);
      assert.deepStrictEqual(value, encoded);
    }),
  runs
);
