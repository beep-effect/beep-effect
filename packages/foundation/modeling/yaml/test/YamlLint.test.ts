import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { YamlEdit, YamlLint, YamlLintConfig, YamlLintDiagnostic, YamlParseError, YamlRule } from "@beep/yaml";
import { LintLine } from "@beep/yaml/YamlLintRule";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ruleSourcePaths, sourceText } from "./fixture-text.ts";
import type { LintContext } from "@beep/yaml/YamlLintRule";

const todoRule = YamlRule.make({
  id: "no-todo",
  check: dual(
    2,
    (ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> =>
      A.map(
        A.filter(ctx.tokens, (t) => t.kind === "scalar" && t.text === "TODO"),
        (t) =>
          YamlLintDiagnostic.make({
            rule: "no-todo",
            severity: "error",
            message: "TODO is not allowed",
            offset: t.offset,
            length: t.length,
            line: t.line,
            character: t.character,
            fix: YamlEdit.make({ offset: t.offset, length: t.length, content: "DONE" }),
          })
      )
  ),
});

describe("YamlLintConfig", () => {
  it("accepts bare severities, off, and opaque options for custom rules", () => {
    const config = YamlLintConfig.make({
      rules: { "line-length": "warning", "no-todo": { severity: "warning", anything: 1 }, custom: "off" },
    });
    assert.deepStrictEqual(config.rules.custom, "off");
  });

  it("rejects demoting or disabling parse-validity, loudly", () => {
    assert.throws(() => YamlLintConfig.make({ rules: { "parse-validity": "off" } }));
    assert.throws(() => YamlLintConfig.make({ rules: { "parse-validity": "warning" } }));
    assert.throws(() => YamlLintConfig.make({ rules: { "parse-validity": { severity: "error" } } }));
    const messageOf = (input: unknown): string => {
      const r = S.decodeUnknownResult(YamlLintConfig)(input);
      assertFailure(r, r.pipe(Result.flip, Result.getOrThrow));
      return Result.isFailure(r) ? r.failure.message : "";
    };
    assert.include(
      messageOf({ rules: { "parse-validity": "off" } }),
      'Rule "parse-validity" is always-on',
      "constructor validation fails loud (effect's `make` throws with a generic message), and the schema decode path carries the typed error NAMING the entry"
    );
    assert.include(messageOf({ rules: { "parse-validity": "warning" } }), 'Rule "parse-validity" is always-on');
    assert.include(messageOf({ rules: { "parse-validity": {} } }), 'Rule "parse-validity" accepts no options');
  });

  it("allows an explicit redundant error severity on parse-validity", () => {
    const config = YamlLintConfig.make({ rules: { "parse-validity": "error" } });
    assert.strictEqual(config.rules["parse-validity"], "error");
  });

  it("rejects a typo'd option KEY on a built-in rule, naming the key and the rule", () => {
    assert.throws(() => YamlLintConfig.make({ rules: { "line-length": { mxa: 100 } } }));
    const r = S.decodeResult(YamlLintConfig)({ rules: { "line-length": { mxa: 100 } } });
    assertFailure(r, r.pipe(Result.flip, Result.getOrThrow));
    if (Result.isFailure(r)) {
      assert.include(r.failure.message, "line-length");
      assert.include(r.failure.message, "mxa", "the reviewer's probe: `mxa` must not silently decode to {}");
    }
    const custom = YamlLintConfig.make({ rules: { "my-rule": { anything: true, extra: 1 } } });
    assert.deepStrictEqual(
      custom.rules["my-rule"],
      { anything: true, extra: 1 },
      "opaque options on a NON-catalog id keep working: custom rules validate their own options"
    );
  });

  it("rejects out-of-domain numeric options, naming the field", () => {
    for (const bad of [Number.NaN, -1, 1.5]) {
      const r = S.decodeResult(YamlLintConfig)({ rules: { "line-length": { max: bad } } });
      assertFailure(r, r.pipe(Result.flip, Result.getOrThrow));
      if (Result.isFailure(r)) {
        assert.include(r.failure.message, "max");
        assert.include(r.failure.message, "non-negative integer");
      }
    }
    const numericOptionsWithTheSameBound = [
      ["empty-lines", "maxStart"],
      ["comments-spacing", "minSpacesBefore"],
      ["colon-spacing", "maxSpacesAfter"],
      ["hyphen-spacing", "maxSpacesAfter"],
      ["indentation", "spaces"],
    ] as const;
    for (const [rule, field] of numericOptionsWithTheSameBound) {
      const r = S.decodeResult(YamlLintConfig)({ rules: { [rule]: { [field]: -2 } } });
      assertFailure(r, r.pipe(Result.flip, Result.getOrThrow));
    }
    for (const rule of ["colon-spacing", "hyphen-spacing"] as const) {
      const r = S.decodeResult(YamlLintConfig)({ rules: { [rule]: { maxSpacesAfter: 0 } } });
      assertFailure(r, r.pipe(Result.flip, Result.getOrThrow));
      if (Result.isFailure(r)) {
        assert.include(
          r.failure.message,
          "greater than or equal to 1",
          "`maxSpacesAfter: 0` would make the fix delete the separation space and fuse the indicator with its content (`- item` → `-item`, `a: val` → `a:val`): the floor is 1, not 0"
        );
      }
    }
    const zeroSpacesBeforeColonIsLegal = S.decodeResult(YamlLintConfig)({
      rules: { "colon-spacing": { maxSpacesBefore: 0 } },
    });
    assertSuccess(zeroSpacesBeforeColonIsLegal, Result.getOrThrow(zeroSpacesBeforeColonIsLegal));
  });

  it("ships presets as statics", () => {
    assert.isTrue(S.is(YamlLintConfig)(YamlLintConfig.default));
    assert.isTrue(S.is(YamlLintConfig)(YamlLintConfig.relaxed));
    const custom = YamlLintConfig.make({ rules: { ...YamlLintConfig.default.rules, "no-todo": "error" } });
    assert.strictEqual(custom.rules["no-todo"], "error", "composing a preset is object spread, not string resolution");
  });
});

describe("YamlLint.run", () => {
  it("skips rules that are off or absent from the config", () => {
    const text = "a: TODO\n";
    const off = YamlLint.run(text, [todoRule], YamlLintConfig.make({ rules: { "no-todo": "off" } }));
    assert.strictEqual(off.length, 0);
    const absent = YamlLint.run(text, [todoRule], YamlLintConfig.make({ rules: {} }));
    assert.strictEqual(absent.length, 0);
  });

  it("resolves severity: bare literal overrides what the rule emitted", () => {
    const found = YamlLint.run("a: TODO\n", [todoRule], YamlLintConfig.make({ rules: { "no-todo": "warning" } }));
    assert.strictEqual(found[0]?.severity, "warning");
  });

  it("resolves severity from an options object, defaulting to error", () => {
    const explicit = YamlLint.run(
      "a: TODO\n",
      [todoRule],
      YamlLintConfig.make({ rules: { "no-todo": { severity: "warning" } } })
    );
    assert.strictEqual(explicit[0]?.severity, "warning");
    const defaulted = YamlLint.run("a: TODO\n", [todoRule], YamlLintConfig.make({ rules: { "no-todo": {} } }));
    assert.strictEqual(defaulted[0]?.severity, "error");
  });

  it("hands the options object through to the rule", () => {
    let seen: unknown;
    const probe = YamlRule.make({
      id: "probe",
      check: dual(2, (_ctx: LintContext, options: unknown): Iterable<YamlLintDiagnostic> => {
        seen = options;
        return [];
      }),
    });
    YamlLint.run("a: 1\n", [probe], YamlLintConfig.make({ rules: { probe: { max: 3 } } }));
    assert.deepStrictEqual(seen, { max: 3 });
  });

  it("reports nothing on empty input under the default preset", () => {
    const found = YamlLint.run("", YamlLint.builtins, YamlLintConfig.default);
    assert.deepStrictEqual(
      found,
      [],
      'empty input has no lines: a phantom first line would make empty-lines report "too many blank lines" on ""'
    );
  });

  it("sorts findings by position across rules", () => {
    const text = "a: TODO\nb: *missing\n";
    const found = YamlLint.run(
      text,
      [...YamlLint.builtins, todoRule],
      YamlLintConfig.make({ rules: { "no-todo": "error" } })
    );
    const offsets = A.map(found, (d) => d.offset);
    assert.deepStrictEqual(
      offsets,
      [...offsets].sort((x, y) => x - y)
    );
    assert.isTrue(A.some(found, (d) => d.rule === "no-todo"));
    assert.isTrue(A.some(found, (d) => d.rule === "parse-validity"));
  });
});

describe("YamlLint.fix", () => {
  const config = YamlLintConfig.make({ rules: { "no-todo": "error" } });

  it("applies surgical fixes through YamlEdit.applyAll", () => {
    const result = YamlLint.fix("a: TODO\nb: TODO\n", [todoRule], config);
    assertSuccess(result, Result.getOrThrow(result));
    if (Result.isSuccess(result)) {
      assert.strictEqual(result.success, "a: DONE\nb: DONE\n");
    }
  });

  it("preserves comments — the fix is surgical, never a reformat", () => {
    const result = YamlLint.fix("# header\na: TODO # trailing\n", [todoRule], config);
    assertSuccess(result, Result.getOrThrow(result));
    if (Result.isSuccess(result)) {
      assert.strictEqual(result.success, "# header\na: DONE # trailing\n");
    }
  });

  it("drops the later of two overlapping fixes (earlier wins)", () => {
    const rival = YamlRule.make({
      id: "rival",
      check: dual(
        2,
        (ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> =>
          A.map(
            A.filter(ctx.tokens, (t) => t.kind === "scalar" && t.text === "TODO"),
            (t) =>
              YamlLintDiagnostic.make({
                rule: "rival",
                severity: "error",
                message: "rival fix",
                offset: t.offset,
                length: t.length,
                line: t.line,
                character: t.character,
                fix: YamlEdit.make({ offset: t.offset, length: t.length, content: "RIVAL" }),
              })
          )
      ),
    });
    const result = YamlLint.fix(
      "a: TODO\n",
      [todoRule, rival],
      YamlLintConfig.make({ rules: { "no-todo": "error", rival: "error" } })
    );
    assertSuccess(result, Result.getOrThrow(result));
    if (Result.isSuccess(result)) {
      assert.match(
        result.success,
        /^a: (DONE|RIVAL)\n$/,
        "two rules flag the same span: the first fix is applied, the second dropped rather than throwing applyAll's overlap defect"
      );
    }
  });

  it("drops the later of two zero-length fixes at the same offset (deterministic)", () => {
    const insertRule = (id: string, content: string): YamlRule =>
      YamlRule.make({
        id,
        check: dual(
          2,
          (ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> => [
            YamlLintDiagnostic.make({
              rule: id,
              severity: "error",
              message: `insert ${content}`,
              offset: ctx.text.length,
              length: 0,
              line: 0,
              character: 0,
              fix: YamlEdit.make({ offset: ctx.text.length, length: 0, content }),
            }),
          ]
        ),
      });
    const result = YamlLint.fix(
      "a: 1\n",
      [insertRule("insert-a", "# A\n"), insertRule("insert-b", "# B\n")],
      YamlLintConfig.make({ rules: { "insert-a": "error", "insert-b": "error" } })
    );
    assertSuccess(result, Result.getOrThrow(result));
    if (Result.isSuccess(result)) {
      assert.strictEqual(
        result.success,
        "a: 1\n# A\n",
        "run() orders equal positions by rule id, so insert-a wins and insert-b is dropped: never both, never in arbitrary order"
      );
    }
  });

  it("fails with YamlParseError on fatally-invalid input", () => {
    const result = YamlLint.fix("a: *missing\n", [todoRule], config);
    assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
    if (Result.isFailure(result)) {
      assert.instanceOf(result.failure, YamlParseError);
    }
  });
});

const importSpecifiers = (source: string): ReadonlyArray<string> => {
  const withoutLineComments = Str.replace(/\/\/[^\n]*/g, "")(source);
  const stripped = Str.replace(/\/\*[\s\S]*?\*\//g, "")(withoutLineComments);
  const out: Array<string> = [];
  for (const match of Str.matchAll(/\bfrom\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm)(stripped)) {
    const specifier = match[1] ?? match[2];
    if (specifier !== undefined) out.push(specifier);
  }
  return out;
};

describe("fix routes only through YamlEdit.applyAll — structural pin", () => {
  it("neither the facade nor any rule imports YamlFormat", () => {
    const files = ["YamlLint.ts", "YamlLintRule.ts", ...ruleSourcePaths];
    assert.isAbove(
      ruleSourcePaths.length,
      0,
      "positive control: the rule-source glob found no modules, and an empty listing would pass vacuously"
    );
    for (const file of files) {
      const specifiers = importSpecifiers(sourceText(file));
      assert.isAbove(
        specifiers.length,
        0,
        `${file}: the import walker found no imports; a walker that finds none would pass vacuously, so line comments are stripped before block comments (a \`/*\` inside a \`//\` comment, a glob like \`src/internal/rules/*\`, must not open a phantom block comment)`
      );
      for (const specifier of specifiers) {
        assert.isFalse(
          /(?:^|\/)YamlFormat(?:\.js|\.ts)?$/.test(specifier),
          `${file} imports "${specifier}" — the lint layer must not reach for the formatter (comments are stripped first: a comment merely NAMING a module is not an import; the walker reads \`from "..."\` paths plus bare side-effect \`import "..."\` specifiers)`
        );
      }
    }
  });
});

describe("LintContext", () => {
  it("exists for malformed input: document carries the recovered diagnostics", () => {
    let ran = false;
    const probe = YamlRule.make({
      id: "probe",
      check: dual(2, (ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> => {
        ran = true;
        assert.isAbove(ctx.document.errors.length, 0);
        assert.isAbove(ctx.tokens.length, 0);
        assert.isAbove(ctx.lines.length, 0);
        return [];
      }),
    });
    YamlLint.run("a: *missing\n", [probe], YamlLintConfig.make({ rules: { probe: "error" } }));
    assert.isTrue(ran, "probe rule must have been invoked");
  });

  it("lines carry text, offset and zero-based numbers", () => {
    let ran = false;
    const probe = YamlRule.make({
      id: "probe",
      check: dual(2, (ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> => {
        ran = true;
        assert.deepStrictEqual(ctx.lines, [
          LintLine.make({ text: "a: 1", offset: 0, number: 0 }),
          LintLine.make({ text: "b: 2", offset: 5, number: 1 }),
        ]);
        return [];
      }),
    });
    YamlLint.run("a: 1\nb: 2\n", [probe], YamlLintConfig.make({ rules: { probe: "error" } }));
    assert.isTrue(ran, "probe rule must have been invoked");
  });
});

describe("YamlLintDiagnostic schema property", () => {
  it.effect.prop(
    "YamlLintDiagnostic decodes its encoding and preserves schema equivalence",
    [Arbitrary.schema(YamlLintDiagnostic)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(YamlLintDiagnostic)(value);
        const decoded = yield* S.decodeEffect(YamlLintDiagnostic)(encoded);
        assert.isTrue(S.toEquivalence(YamlLintDiagnostic)(decoded, value));
      }),
    { arbitrary: fcRuns(100) }
  );
});
