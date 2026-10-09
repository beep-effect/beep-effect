import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { lookupPnpmfiles } from "../../../effected/workspaces/internal/configDependencyResolution.ts";
import { splitConfigDependencySpec } from "../../../effected/workspaces/internal/configDependencySpecGrammar.ts";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop("supplied replay resolution preserves lenient first-plus version spelling and the supplied path", [Arbitrary.schema(S.String), Arbitrary.schema(S.String)], ([spec, path]) => Effect.gen(function* () {
  const parsed = splitConfigDependencySpec(spec);
  const result = yield* lookupPnpmfiles({ [`config@${parsed.version}`]: path }, { config: spec });
  assert.deepStrictEqual(result, [{ name: "config", version: parsed.version, source: "supplied", path }]);
  const canonical = parsed.integrity === undefined ? parsed.version : `${parsed.version}+${parsed.integrity}`;
  assert.deepStrictEqual(yield* lookupPnpmfiles({ [`config@${parsed.version}`]: path }, { config: canonical }), result);
}), runs);
