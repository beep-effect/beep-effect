import { answerWithoutPerson } from "@beep/cli-kit/internal/fallbackAnswer";
import { TestTerminal } from "@beep/cli-kit/testing";
import { MemoryFileSystem } from "@beep/memfs";
import { assert, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as CliError from "effect/cli/CliError";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

it.effect("an explicitly undefined default still reports the missing argument or flag", () =>
  Effect.gen(function* () {
    for (const target of [
      { flag: "name", otherwise: undefined },
      { argument: "name", otherwise: undefined },
    ]) {
      const result = yield* Effect.result(answerWithoutPerson(target));
      const tag = "flag" in target ? "MissingOption" : "MissingArgument";
      assertFailure(
        result,
        tag === "MissingOption"
          ? CliError.MissingOption.make({ option: "name" })
          : CliError.MissingArgument.make({ argument: "name" })
      );
    }
    const prompt = yield* answerWithoutPerson({ flag: "enabled", otherwise: false });
    const terminal = yield* TestTerminal.make();
    const context = yield* Layer.build(Layer.mergeAll(MemoryFileSystem.layer, Path.layer, terminal.layer));
    const pipe1 = yield* prompt.pipe(Effect.provideContext(context));
    assert.strictEqual(pipe1, false);
  })
);
