import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import { Toml } from "../../effected/toml/Toml.ts";
import type { TomlPath } from "../../effected/toml/TomlEdit.ts";
import { TomlFormat, TomlFormattingOptions, TomlModificationError } from "../../effected/toml/TomlFormat.ts";

const rejection = Effect.fn("TomlFormat.coverage.rejection")(function* (source: string, path: TomlPath, value: unknown, message: string) {
  const result = yield* Effect.result(TomlFormat.modify(source, path, value));
  result.pipe(Result.isFailure, assertTrue);
  if (Result.isFailure(result)) {
    assert.instanceOf(result.failure, TomlModificationError);
    assert.include(result.failure.message, message);
  }
});

describe("TomlFormat remaining observable paths", () => {
  it.effect("constructs the static facade and reads typed error messages", () => Effect.sync(() => {
    assert.strictEqual(Reflect.getPrototypeOf(Reflect.construct(TomlFormat, [])), TomlFormat.prototype);
  }));

  it.effect("handles BOM trivia, tab comments, and both normalized newline directions", () => Effect.sync(() => {
    assert.strictEqual(TomlFormat.formatToString("\ufeff  a=1\n"), "\ufeffa = 1\n");
    assert.strictEqual(TomlFormat.formatToString("\ufeff  #\tcomment  \n"), "\ufeff#\tcomment\n");
    assert.strictEqual(TomlFormat.formatToString("#\tcomment\n"), "#\tcomment\n");
    const lf = TomlFormattingOptions.make({ newline: "\n" });
    const crlf = TomlFormattingOptions.make({ newline: "\r\n" });
    assert.strictEqual(TomlFormat.formatToString("a=1\n", undefined, lf), "a = 1\n");
    assert.strictEqual(TomlFormat.formatToString("a=1\r\n", undefined, crlf), "a = 1\r\n");
    assert.strictEqual(TomlFormat.formatToString("# end"), "# end\n");
  }));

  it.effect("resolves implicit parents promoted to explicit sections and reused dotted tables", () => Effect.gen(function* () {
    const source = "[a.b]\nx = 1\n[a]\ny = 2\n";
    assert.strictEqual(yield* TomlFormat.modifyToString(source, ["a", "y"], 3), "[a.b]\nx = 1\n[a]\ny = 3\n");
    assert.strictEqual(yield* TomlFormat.modifyToString("a.b = 1\na.c = 2\n", ["a", "d"], 3), "a.b = 1\na.c = 2\na.d = 3\n");
    const nested = "[[a]]\n[a.b]\nx = 1\n[[a.c]]\ny = 2\n";
    assert.deepStrictEqual(yield* Toml.parse(yield* TomlFormat.modifyToString(nested, ["a", 0, "b", "x"], 9)), { a: [{ b: { x: 9 }, c: [{ y: 2 }] }] });
  }));

  it.effect("navigates nested arrays and inline dotted groups", () => Effect.gen(function* () {
    assert.strictEqual(yield* TomlFormat.modifyToString("a = [[1, 2], [3]]\n", ["a", 0, 1], 8), "a = [[1, 8], [3]]\n");
    assert.strictEqual(yield* TomlFormat.modifyToString("a = [{b = 1}]\n", ["a", 0, "b"], 8), "a = [{b = 8}]\n");
    assert.strictEqual(yield* TomlFormat.modifyToString("a = {b.c = 1, b.d = 2}\n", ["a", "b", "c"], 8), "a = {b.c = 8, b.d = 2}\n");
    assert.strictEqual(yield* TomlFormat.modifyToString("a = {b = {c = 1}}\n", ["a", "b", "c"], 8), "a = {b = {c = 8}}\n");
    assert.deepStrictEqual(yield* TomlFormat.modify("a = [1]\n", ["a", 8], undefined), []);
    yield* rejection("a = [1]\n", ["a", 8], 2, "modify never appends array elements");
    yield* rejection("a = {b = 1}\n", ["a", "missing", "x"], 2, "does not resolve in the inline table");
    yield* rejection("a = [[1]]\n", ["a", 8, 0], 2, "out of bounds");
    yield* rejection("a = [[1]]\n", ["a", "bad", 0], 2, "non-negative integer");
    yield* rejection("a = [1]\n", ["a", -1], 2, "non-negative integer");
    yield* rejection("a = [1]\n", ["a", 0.5], 2, "non-negative integer");
    yield* rejection("a = [1]\n", ["a", 0, "x"], 2, "cannot address a key beneath a scalar");
    yield* rejection("a = [1]\n", ["a", 0, "x", "y"], 2, "cannot navigate through a scalar");
  }));

  it.effect("distinguishes terminal table sections, absent deletes, and dotted inline groups", () => Effect.gen(function* () {
    yield* rejection("[a]\nx = 1\n", ["a"], undefined, "not a deletable value");
    const source = "[[a]]\nx = 1\n";
    assert.deepStrictEqual(yield* TomlFormat.modify(source, ["a", 1], undefined), []);
    yield* rejection(source, ["a", 0], undefined, "not an addressable value");
    yield* rejection(source, ["a", 0], 1, "not an addressable value");
    yield* rejection(source, ["a", 3], 1, "out of bounds");
    yield* rejection(source, ["a", 3, "x"], 1, "out of bounds");
    yield* rejection(source, ["a", "bad"], 1, "non-negative integer");
    const inline = "a = {b.c = 1, b.d = 2}\n";
    assert.deepStrictEqual(yield* TomlFormat.modify(inline, ["a", "missing"], undefined), []);
    yield* rejection(inline, ["a", "b"], undefined, "not a single entry");
    yield* rejection(inline, ["a", "b"], 1, "not a single entry");
  }));

  it.effect("returns a typed nesting error for a deeply nested replacement", () => Effect.gen(function* () {
    let value: unknown = 1;
    for (const _ of A.range(0, 300)) value = [value];
    yield* rejection("a = 1\n", ["a"], value, "NestingDepthExceeded");
  }));

  it.effect("preserves defects for sparse path arrays rather than materializing a modification error", () => Effect.gen(function* () {
    const intermediate: Array<string> = [];
    intermediate.length = 2;
    const terminal: Array<string> = [];
    terminal.length = 1;
    for (const path of [intermediate, terminal]) {
      const exit = yield* Effect.exit(TomlFormat.modify("a = 1\n", path, 2));
      if (Exit.isFailure(exit)) {
        exit.cause.pipe(Cause.hasDies, assertTrue);
        assert.include(Cause.pretty(exit.cause), "missing TOML path segment");
      } else {
        assert.fail("a sparse path must fail with a defect");
      }
    }
  }));
});
