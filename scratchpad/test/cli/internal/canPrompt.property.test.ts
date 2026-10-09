import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { canPrompt } from "../../../effected/cli/internal/canPrompt.ts";
const runs = { arbitrary: fcRuns(100) };
it.effect.prop("prompt permission requires both terminals and refuses TERM=dumb", [Arbitrary.schema(S.Boolean), Arbitrary.schema(S.Boolean), Arbitrary.schema(S.String)], ([stdin, stdout, term]) => Effect.gen(function* () {
  const stream = { isTerminal: stdout, color: "none" as const, hyperlinks: false, columns: O.none<number>() };
  const terminal = { stdinIsTerminal: stdin, stdout: stream, stderr: stream, width: () => 80 };
  const result = yield* canPrompt(terminal).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { TERM: term } })));
  assert.strictEqual(result, stdin && stdout && term !== "dumb");
}), runs);
