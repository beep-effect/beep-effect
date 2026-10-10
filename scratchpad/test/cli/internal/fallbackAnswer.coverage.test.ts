import { assert, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { CliError } from "effect/cli";
import * as Path from "effect/Path";
import * as Layer from "effect/Layer";
import { TestTerminal } from "../../../effected/cli/testing.ts";
import { MemoryFileSystem } from "../../../effected/memfs/index.ts";
import { answerWithoutPerson } from "../../../effected/cli/internal/fallbackAnswer.ts";

it.effect("an explicitly undefined default still reports the missing argument or flag", () => Effect.gen(function* () {
  for (const target of [{ flag: "name", otherwise: undefined }, { argument: "name", otherwise: undefined }]) {
    const result = yield* Effect.result(answerWithoutPerson(target));
    const tag = "flag" in target ? "MissingOption" : "MissingArgument";
    assertFailure(result, tag === "MissingOption" ? CliError.MissingOption.make({ option: "name" }) : CliError.MissingArgument.make({ argument: "name" }));
  }
  const prompt = yield* answerWithoutPerson({ flag: "enabled", otherwise: false });
  const terminal = yield* TestTerminal.make();
  const context = yield* Layer.build(Layer.mergeAll(MemoryFileSystem.layer, Path.layer, terminal.layer));
  assert.strictEqual(yield* prompt.pipe(Effect.provideContext(context)), false);
}));
