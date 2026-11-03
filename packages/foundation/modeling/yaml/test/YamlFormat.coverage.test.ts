import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { YamlFormattingOptions, YamlStringifyOptions } from "@beep/yaml";
import * as Stringifier from "@beep/yaml/internal/stringifier";
import { Yaml } from "@beep/yaml/Yaml";
import { YamlFormat } from "@beep/yaml/YamlFormat";
import { assert, describe, it, vi } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { flow } from "effect/Function";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

describe("formatting navigation and regional fallbacks", () => {
  it.effect.prop(
    "nested sequence replacements preserve the requested value at a formatting fixed point",
    [Arbitrary.schema(S.String)],
    ([value]) =>
      Effect.gen(function* () {
        const text = yield* YamlFormat.modifyToString("items:\n- name: old\n", ["items", 0, "name"], value);
        const parsed = yield* Yaml.parse(text);
        assert.deepStrictEqual(parsed, { items: [{ name: value }] });
        const formatted = YamlFormat.formatToString(text);
        assert.strictEqual(YamlFormat.formatToString(formatted), formatted);
      }),
    { arbitrary: fcRuns(100) }
  );

  it.effect("regional and full edits preserve navigation and replacement semantics", () =>
    Effect.gen(function* () {
      for (const path of [
        ["items", 0, "name"],
        ["items", "0", "name"],
      ]) {
        const text = yield* YamlFormat.modifyToString(
          "items: [{name: old}]\n",
          path,
          2,
          YamlStringifyOptions.make({ indent: 2 })
        );
        const parsed1 = yield* Yaml.parse(text);
        assert.deepStrictEqual(parsed1, { items: [{ name: 2 }] });
        const regional = yield* YamlFormat.modifyToString("items: [{name: old}]\n", path, 2);
        const parsed2 = yield* Yaml.parse(regional);
        assert.deepStrictEqual(parsed2, { items: [{ name: 2 }] });
      }
      for (const [input, path, value] of [
        ["a: [1]\n", ["a"], 2],
        ["a:\n", ["a"], 2],
        ["a: &x\n", ["a"], 2],
        ["a: 'old'\n", ["a"], "\u0080"],
        ["a: old\n", ["a"], -0],
      ] as const) {
        const text = yield* YamlFormat.modifyToString(input, path, value);
        const parsed3 = yield* Yaml.parse(text);
        assert.deepStrictEqual(parsed3, { a: value === 0 ? 0 : value });
      }
      const folded = yield* YamlFormat.modifyToString(
        "a: old\n",
        ["a"],
        "one two three four five six",
        YamlStringifyOptions.make({ lineWidth: 5 })
      );
      const parsed4 = yield* Yaml.parse(folded);
      assert.deepStrictEqual(parsed4, { a: "one two three four five six" });
      const failure = yield* Effect.flip(YamlFormat.modifyToString("? a\n", ["a", "b"], 1));
      assert.deepStrictEqual(
        A.map(failure.diagnostics, (d) => d.code),
        ["PathNotFound"]
      );
      const untouched = "a: [1]\n";
      const modifyToString5 = yield* YamlFormat.modifyToString(untouched, ["a", 5], undefined);
      assert.strictEqual(modifyToString5, untouched);
      const fraction = yield* Effect.exit(YamlFormat.modifyToString("a: [1]\n", ["a", 0.5, "b"], 1));
      assertSome(
        Option.flatMap(
          Exit.getCause(fraction),
          flow(
            Cause.findDie,
            Result.map((d) => (d.defect instanceof Error ? d.defect.message : "unexpected")),
            Result.getSuccess
          )
        ),
        "Cannot read properties of undefined (reading '_tag')"
      );
    })
  );

  it.effect("unexpected replacement getters retain their defect", () =>
    Effect.gen(function* () {
      const defect = new Error("replacement getter");
      const value = {
        get key(): unknown {
          throw defect;
        },
      };
      const exit = yield* Effect.exit(YamlFormat.modify("a: old\n", ["a"], value));
      assertSome(
        Option.flatMap(
          Exit.getCause(exit),
          flow(
            Cause.findDie,
            Result.map((d) => d.defect),
            Result.getSuccess
          )
        ),
        defect
      );
    })
  );

  it.effect("unexpected document serialization failures retain their defect", () =>
    Effect.gen(function* () {
      const defect = new Error("document serialization defect");
      const serializer = vi.spyOn(Stringifier, "stringifyDocument").mockImplementation(() => {
        throw defect;
      });
      try {
        const exit = yield* Effect.exit(
          YamlFormat.modify("a: old\n", ["a"], "new", YamlStringifyOptions.make({ indent: 2 }))
        );
        assertSome(
          Option.flatMap(
            Exit.getCause(exit),
            flow(
              Cause.findDie,
              Result.map((d) => d.defect),
              Result.getSuccess
            )
          ),
          defect
        );
      } finally {
        serializer.mockRestore();
      }
    })
  );

  it.effect("requotes null-valued explicit keys while leaving aliases intact", () =>
    Effect.sync(() => {
      const text = "? 'a'\nb: &x 'value'\nc: *x\n";
      const formatted = YamlFormat.formatToString(
        text,
        undefined,
        YamlFormattingOptions.make({ requoteScalars: true, quoteStyle: "double" })
      );
      assert.isTrue(Yaml.equals(text, formatted));
      assert.include(formatted, '"a"');
      assert.include(formatted, "*x");
      assert.strictEqual(Reflect.getPrototypeOf(Reflect.construct(YamlFormat, [])), YamlFormat.prototype);
    })
  );
});
