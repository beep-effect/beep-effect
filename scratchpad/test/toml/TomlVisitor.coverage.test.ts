import { assert, it, vi } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { TomlVisitor } from "../../effected/toml/TomlVisitor.ts";
import * as Parser from "../../effected/toml/internal/parser.ts";

it.effect("visitor retains unspaced comments, blank lines and final whitespace", () => Effect.gen(function* () {
  const events = yield* Stream.runCollect(TomlVisitor.visit("\n#raw\n\t\n  "));
  assert.deepStrictEqual(events, [
    { _tag: "TableStart", path: [] },
    { _tag: "Comment", text: "raw", offset: 1 },
  ]);
  assert.strictEqual(Object.getPrototypeOf(Reflect.construct(TomlVisitor, [])), TomlVisitor.prototype);
  const eof = yield* Stream.runCollect(TomlVisitor.visit("#EOF"));
  assert.deepStrictEqual(eof, [
    { _tag: "TableStart", path: [] },
    { _tag: "Comment", text: "EOF", offset: 0 },
  ]);
}));

it.effect("unexpected parser defects retain their identity through the visitor", () => Effect.gen(function* () {
  const defect = new Error("parser defect");
  const parser = vi.spyOn(Parser, "parseExpressions").mockImplementation(() => { throw defect; });
  try {
    const exit = yield* TomlVisitor.visit("a=1").pipe(Stream.runCollect, Effect.exit);
    assertExitFailure(exit, Cause.die(defect));
  } finally {
    parser.mockRestore();
  }
}));
