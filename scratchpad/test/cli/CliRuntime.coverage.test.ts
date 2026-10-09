import { assert, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Cause from "effect/Cause";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import { CliDoc } from "../../effected/cli/CliFailure.ts";
import { CliRuntime } from "../../effected/cli/CliRuntime.ts";

it.effect("an unprintable failure still produces a safe last-resort diagnostic", () => Effect.gen(function* () {
  const unprintable = new Error("unprintable");
  const error = {
    get [CliDoc](): () => never { throw new Error("document unavailable"); },
    toString(): string { throw unprintable; },
  };
  const lines: Array<unknown> = [];
  const logger = Logger.make(({ message }) => { lines.push(message); });
  const exit = yield* Effect.scopedWith((scope) => Effect.flatMap(
    Layer.buildWithScope(Logger.layer([logger]), scope),
    (context) => Effect.fail(error).pipe(
      CliRuntime.reportFailures({ render: (_error, details) => details.defaultLines }),
      Effect.exit,
      Effect.provideContext(context),
    ),
  ));
  assertExitFailure(exit, Cause.die(unprintable));
  assert.deepStrictEqual(lines, [["[unprintable failure]"]]);
}));
