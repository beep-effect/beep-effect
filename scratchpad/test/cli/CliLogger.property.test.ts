import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { CliLogger } from "../../effected/cli/CliLogger.ts";
import { Fmt } from "../../effected/cli/Fmt.ts";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop("plain logger preserves sanitized message fidelity and normalization is stable", [Arbitrary.schema(S.String)], ([input]) => Effect.gen(function* () {
  const lines: Array<unknown> = [];
  const output = Layer.succeed(Console.Console, { ...globalThis.console, error: (value: unknown) => { lines.push(value); } });
  const text = Fmt.sanitize(input);
  yield* Effect.scopedWith((scope) => Effect.flatMap(
    Layer.buildWithScope(Layer.merge(output, CliLogger.layer()), scope),
    (context) => Effect.gen(function* () {
      yield* Effect.logError(input);
      yield* Effect.logError(text);
    }).pipe(Effect.provideContext(context)),
  ));
  assert.deepStrictEqual(lines, [text, text]);
}), runs);
