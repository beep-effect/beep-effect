import * as Semantic from "@beep/toml/internal/semantic";
import { Toml } from "@beep/toml/Toml";
import { TomlFormat, TomlFormattingOptions, TomlModificationError } from "@beep/toml/TomlFormat";
import { assert, describe, it, vi } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import type { TomlPath } from "@beep/toml/TomlEdit";
import type { TomlExpression } from "@beep/toml/TomlNode";

const rejection = Effect.fn("TomlFormat.coverage.rejection")(function* (
  source: string,
  path: TomlPath,
  value: unknown,
  message: string
) {
  const result = yield* Effect.result(TomlFormat.modify(source, path, value));
  result.pipe(Result.isFailure, assertTrue);
  if (Result.isFailure(result)) {
    assert.instanceOf(result.failure, TomlModificationError);
    assert.include(result.failure.message, message);
  }
});

// The invariant defect is asserted structurally rather than through
// `Cause.pretty`: under Bun the vite module runner's stack-trace source-map
// interceptor throws on the column-0 frame JSC reports for the `Effect.fn`
// definition site inside a static class field, so the first `Cause.pretty`
// of a `TomlFormat.modify` defect crashes instead of rendering.
const invariantDefectMessage = (cause: Cause.Cause<unknown>): string => {
  const defect = Cause.findDefect(cause);
  if (Result.isFailure(defect)) return assert.fail("expected a defect in the cause");
  const error = defect.success;
  assert.isTrue(P.isTagged(error, "TomlFormatInvariantError"), "expected a TomlFormatInvariantError defect");
  if (!P.hasProperty(error, "message") || !P.isString(error.message)) return assert.fail("expected a defect message");
  return error.message;
};

describe("TomlFormat remaining observable paths", () => {
  it.effect("descends into the current array-table element when resolving key-value sections", () =>
    // Array-of-tables nodes are non-empty by construction (`A.NonEmptyArray`), so the descent
    // always yields the latest element; each key-value must resolve inside its own section.
    Effect.gen(function* () {
      const source = "[[a]]\nx = 1\n[[a]]\nx = 3\n[[a]]\nx = 5\n";
      const modifyToString1 = yield* TomlFormat.modifyToString(source, ["a", 0, "x"], 2);
      assert.strictEqual(modifyToString1, "[[a]]\nx = 2\n[[a]]\nx = 3\n[[a]]\nx = 5\n");
      const modifyToString2 = yield* TomlFormat.modifyToString(source, ["a", 1, "x"], 4);
      assert.strictEqual(modifyToString2, "[[a]]\nx = 1\n[[a]]\nx = 4\n[[a]]\nx = 5\n");
      const modifyToString3 = yield* TomlFormat.modifyToString(source, ["a", 2, "x"], 6);
      assert.strictEqual(modifyToString3, "[[a]]\nx = 1\n[[a]]\nx = 3\n[[a]]\nx = 6\n");
    })
  );

  it.effect("retains the typed defect when the semantic visitor navigates an absent table", () =>
    Effect.gen(function* () {
      // Inject an invalid visitor path to exercise the formatter's defensive boundary.
      const analyzer = vi.spyOn(Semantic, "analyze").mockImplementation(
        dual<
          (visitor?: Semantic.SemanticVisitor) => (expressions: ReadonlyArray<TomlExpression>) => void,
          (expressions: ReadonlyArray<TomlExpression>, visitor?: Semantic.SemanticVisitor) => void
        >(
          (args) => A.isArray(args[0]),
          (expressions, visitor) => {
            for (const expr of expressions) {
              if (P.isTagged(expr, "TomlKeyValue")) {
                visitor?.onKeyValue?.(["missing", ...A.map(expr.keyPath, (key) => key.value)], expr);
              }
            }
          }
        )
      );
      try {
        const exit = yield* Effect.exit(TomlFormat.modify("x = 1\n", ["x"], 2));
        if (Exit.isSuccess(exit)) return assert.fail("expected a navigation defect");
        exit.cause.pipe(Cause.hasDies, assertTrue);
        assert.include(
          invariantDefectMessage(exit.cause),
          "invariant: semantic pass admitted a value where a table was navigated"
        );
      } finally {
        analyzer.mockRestore();
      }
    })
  );

  it.effect("constructs the static facade and reads typed error messages", () =>
    Effect.sync(() => {
      assert.strictEqual(Reflect.getPrototypeOf(Reflect.construct(TomlFormat, [])), TomlFormat.prototype);
    })
  );

  it.effect("handles BOM trivia, tab comments, and both normalized newline directions", () =>
    Effect.sync(() => {
      assert.strictEqual(TomlFormat.formatToString("\ufeff  a=1\n"), "\ufeffa = 1\n");
      assert.strictEqual(TomlFormat.formatToString("\ufeff  #\tcomment  \n"), "\ufeff#\tcomment\n");
      assert.strictEqual(TomlFormat.formatToString("#\tcomment\n"), "#\tcomment\n");
      const lf = TomlFormattingOptions.make({ newline: "\n" });
      const crlf = TomlFormattingOptions.make({ newline: "\r\n" });
      assert.strictEqual(TomlFormat.formatToString("a=1\n", undefined, lf), "a = 1\n");
      assert.strictEqual(TomlFormat.formatToString("a=1\r\n", undefined, crlf), "a = 1\r\n");
      assert.strictEqual(TomlFormat.formatToString("# end"), "# end\n");
    })
  );

  it.effect("resolves implicit parents promoted to explicit sections and reused dotted tables", () =>
    Effect.gen(function* () {
      const source = "[a.b]\nx = 1\n[a]\ny = 2\n";
      const modifyToString4 = yield* TomlFormat.modifyToString(source, ["a", "y"], 3);
      assert.strictEqual(modifyToString4, "[a.b]\nx = 1\n[a]\ny = 3\n");
      const modifyToString5 = yield* TomlFormat.modifyToString("a.b = 1\na.c = 2\n", ["a", "d"], 3);
      assert.strictEqual(modifyToString5, "a.b = 1\na.c = 2\na.d = 3\n");
      const nested = "[[a]]\n[a.b]\nx = 1\n[[a.c]]\ny = 2\n";
      const modifyToString13 = yield* TomlFormat.modifyToString(nested, ["a", 0, "b", "x"], 9);
      const parsed = yield* Toml.parse(modifyToString13);
      assert.deepStrictEqual(parsed, {
        a: [{ b: { x: 9 }, c: [{ y: 2 }] }],
      });
    })
  );

  it.effect("navigates nested arrays and inline dotted groups", () =>
    Effect.gen(function* () {
      const modifyToString6 = yield* TomlFormat.modifyToString("a = [[1, 2], [3]]\n", ["a", 0, 1], 8);
      assert.strictEqual(modifyToString6, "a = [[1, 8], [3]]\n");
      const modifyToString7 = yield* TomlFormat.modifyToString("a = [{b = 1}]\n", ["a", 0, "b"], 8);
      assert.strictEqual(modifyToString7, "a = [{b = 8}]\n");
      const modifyToString8 = yield* TomlFormat.modifyToString("a = {b.c = 1, b.d = 2}\n", ["a", "b", "c"], 8);
      assert.strictEqual(modifyToString8, "a = {b.c = 8, b.d = 2}\n");
      const modifyToString9 = yield* TomlFormat.modifyToString("a = {b = {c = 1}}\n", ["a", "b", "c"], 8);
      assert.strictEqual(modifyToString9, "a = {b = {c = 8}}\n");
      const modify10 = yield* TomlFormat.modify("a = [1]\n", ["a", 8], undefined);
      assert.deepStrictEqual(modify10, []);
      yield* rejection("a = [1]\n", ["a", 8], 2, "modify never appends array elements");
      yield* rejection("a = {b = 1}\n", ["a", "missing", "x"], 2, "does not resolve in the inline table");
      yield* rejection("a = [[1]]\n", ["a", 8, 0], 2, "out of bounds");
      yield* rejection("a = [[1]]\n", ["a", "bad", 0], 2, "non-negative integer");
      yield* rejection("a = [1]\n", ["a", -1], 2, "non-negative integer");
      yield* rejection("a = [1]\n", ["a", 0.5], 2, "non-negative integer");
      yield* rejection("a = [1]\n", ["a", 0, "x"], 2, "cannot address a key beneath a scalar");
      yield* rejection("a = [1]\n", ["a", 0, "x", "y"], 2, "cannot navigate through a scalar");
    })
  );

  it.effect("distinguishes terminal table sections, absent deletes, and dotted inline groups", () =>
    Effect.gen(function* () {
      yield* rejection("[a]\nx = 1\n", ["a"], undefined, "not a deletable value");
      const source = "[[a]]\nx = 1\n";
      const modify11 = yield* TomlFormat.modify(source, ["a", 1], undefined);
      assert.deepStrictEqual(modify11, []);
      yield* rejection(source, ["a", 0], undefined, "not an addressable value");
      yield* rejection(source, ["a", 0], 1, "not an addressable value");
      yield* rejection(source, ["a", 3], 1, "out of bounds");
      yield* rejection(source, ["a", 3, "x"], 1, "out of bounds");
      yield* rejection(source, ["a", "bad"], 1, "non-negative integer");
      const inline = "a = {b.c = 1, b.d = 2}\n";
      const modify12 = yield* TomlFormat.modify(inline, ["a", "missing"], undefined);
      assert.deepStrictEqual(modify12, []);
      yield* rejection(inline, ["a", "b"], undefined, "not a single entry");
      yield* rejection(inline, ["a", "b"], 1, "not a single entry");
    })
  );

  it.effect("returns a typed nesting error for a deeply nested replacement", () =>
    Effect.gen(function* () {
      let value: unknown = 1;
      for (const _ of A.range(0, 300)) value = [value];
      yield* rejection("a = 1\n", ["a"], value, "NestingDepthExceeded");
    })
  );

  it.effect("preserves defects for sparse path arrays rather than materializing a modification error", () =>
    Effect.gen(function* () {
      const intermediate: Array<string> = [];
      intermediate.length = 2;
      const terminal: Array<string> = [];
      terminal.length = 1;
      for (const path of [intermediate, terminal]) {
        const exit = yield* Effect.exit(TomlFormat.modify("a = 1\n", path, 2));
        if (Exit.isFailure(exit)) {
          exit.cause.pipe(Cause.hasDies, assertTrue);
          assert.include(invariantDefectMessage(exit.cause), "missing TOML path segment");
        } else {
          assert.fail("a sparse path must fail with a defect");
        }
      }
    })
  );
});
