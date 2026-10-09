import { assert, it } from "@effect/vitest";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import { CliLogger } from "../../effected/cli/CliLogger.ts";

it.effect("the logger accepts a scalar message from another logger", () => Effect.gen(function* () {
  const lines: Array<unknown> = [];
  const output = Layer.succeed(Console.Console, { ...globalThis.console, error: (value: unknown) => { lines.push(value); } });
  const cli = CliLogger.make();
  const relay = Logger.make((options) => cli.log({ ...options, message: "\u001b[31mscalar\u001b[0m" }));
  yield* Effect.scopedWith((scope) => Effect.flatMap(
    Layer.buildWithScope(Layer.merge(output, Logger.layer([relay])), scope),
    (context) => Effect.provideContext(Effect.logError("ignored"), context),
  ));
  assert.deepStrictEqual(lines, ["scalar"]);
}));
