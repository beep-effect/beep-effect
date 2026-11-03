import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CompilerOptions } from "@beep/tsconfig/CompilerOptions";
import { JsxConfig } from "@beep/tsconfig/JsxConfig";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";

/** Unwrap a `Some`, failing the test on `None`. */
const expectSome = (result: O.Option<JsxConfig>): JsxConfig => {
  const config = O.getOrThrow(result);
  assertSome(result, config);
  return config;
};

describe("JsxConfig.fromCompilerOptions", () => {
  it("react-jsx selects the automatic runtime with the react default import source", () => {
    const config = expectSome(JsxConfig.fromCompilerOptions({ jsx: "react-jsx" }));
    assert(config.runtime === "automatic");
    assert.strictEqual(config.importSource, "react");
  });

  it("react-jsxdev honors an explicit jsxImportSource", () => {
    const options: CompilerOptions.Type = { jsx: "react-jsxdev", jsxImportSource: "preact" };
    const config = expectSome(JsxConfig.fromCompilerOptions(options));
    assert(config.runtime === "automatic");
    assert.strictEqual(config.importSource, "preact");
  });

  it("react selects the classic runtime and carries no import source", () => {
    const config = expectSome(JsxConfig.fromCompilerOptions({ jsx: "react", jsxImportSource: "ignored" }));
    assert.strictEqual(config.runtime, "classic");
    // The classic variant omits the field, rather than carrying undefined.
    assert.isFalse("importSource" in config);
  });

  it("preserve leaves JSX untransformed: nothing for a bundler to configure", () => {
    assertNone(JsxConfig.fromCompilerOptions({ jsx: "preserve" }));
  });

  it("react-native leaves JSX untransformed: nothing for a bundler to configure", () => {
    assertNone(JsxConfig.fromCompilerOptions({ jsx: "react-native" }));
  });

  it("an absent jsx option projects to None", () => {
    assertNone(JsxConfig.fromCompilerOptions({}));
  });
});

describe("JsxConfig runtime variants", () => {
  it("rejects an automatic runtime without its required import source", () => {
    assertNone(S.decodeUnknownOption(JsxConfig)({ runtime: "automatic" }));
  });

  it.effect("round-trips the automatic runtime and its required import source", () =>
    Effect.gen(function* () {
      const input: JsxConfig = { runtime: "automatic", importSource: "preact" };
      const config = yield* S.decodeEffect(JsxConfig)(input);
      assert(config.runtime === "automatic");
      assert.strictEqual(config.importSource, "preact");
      const value = yield* S.encodeEffect(JsxConfig)(config);
      assert.deepEqual(value, input);
    })
  );

  it.effect("omits automatic-only fields from the classic model and encoding", () =>
    Effect.gen(function* () {
      const config = yield* S.decodeUnknownEffect(JsxConfig)({ runtime: "classic", importSource: "ignored" });
      assert.strictEqual(config.runtime, "classic");
      assert.isFalse("importSource" in config);
      const value1 = yield* S.encodeEffect(JsxConfig)(config);
      assert.deepEqual(value1, { runtime: "classic" });
    })
  );
});

it.prop(
  "fromCompilerOptions yields none for any generated options without a jsx mode",
  [CompilerOptions],
  ([options]) => {
    assertNone(JsxConfig.fromCompilerOptions(Struct.omit(options, ["jsx"])));
  },
  { arbitrary: fcRuns(100) }
);
