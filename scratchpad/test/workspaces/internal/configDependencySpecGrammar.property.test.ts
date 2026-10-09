import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { splitConfigDependencySpec } from "../../../effected/workspaces/internal/configDependencySpecGrammar.ts";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop("splitting and reconstructing preserves every byte, including later plus signs", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  const parsed = splitConfigDependencySpec(text);
  const rendered = parsed.integrity === undefined ? parsed.version : `${parsed.version}+${parsed.integrity}`;
  assert.strictEqual(rendered, text);
  assert.deepStrictEqual(splitConfigDependencySpec(rendered), parsed);
  const again = splitConfigDependencySpec(rendered);
  assert.strictEqual(again.integrity === undefined ? again.version : `${again.version}+${again.integrity}`, rendered);
}), runs);
