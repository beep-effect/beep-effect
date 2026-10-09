import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ConfigIssueRenderer } from "../../effected/cli/ConfigIssueRenderer.ts";
import { ConfigValidationError } from "../../effected/config-file/index.ts";

const runs = { arbitrary: fcRuns(100) };
const target = S.Struct({ port: S.Finite });

it.effect.prop("issue rendering preserves the rejected field and its expected type", [Arbitrary.schema(S.String)], ([port]) => Effect.gen(function* () {
  const failure = yield* S.decodeUnknownEffect(target)({ port }).pipe(Effect.flip);
    const error = ConfigValidationError.make({ path: O.none(), issue: failure.issue });
    const lines = ConfigIssueRenderer.render(error);
    assert.strictEqual(lines.length, 1);
    assert.include(lines[0] ?? "", "at port");
    assert.include(lines[0] ?? "", "number");
    assert.deepStrictEqual(ConfigIssueRenderer.render(error), lines);
}), runs);
