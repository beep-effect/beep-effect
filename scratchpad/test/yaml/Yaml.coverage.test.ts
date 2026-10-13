import { assert, describe, it, vi } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Node from "../../effected/yaml/YamlNode.ts";
import { Yaml, YamlParseError, YamlStringifyError } from "../../effected/yaml/Yaml.ts";
import { YamlDiagnostic } from "../../effected/yaml/YamlDiagnostic.ts";
const circular: Array<unknown> = [];
circular.push(circular);
const bomb = A.join(A.append(A.makeBy(7, (index) => index === 0 ? "a1: &a1 [x]" : `a${index + 1}: &a${index + 1} [${A.join(A.replicate(`*a${index}`, 10), ", ")}]`), "top: *a7"), "\n");
describe("facade uncovered contracts", () => {
  it.effect("errors summarize multiple diagnostics and stringify messages", () => Effect.sync(() => {
    const diagnostic = YamlDiagnostic.fromRaw({ code: "UnexpectedToken", message: "bad token", offset: 2, length: 1 }, "a\nb");
    assert.strictEqual(YamlParseError.make({ diagnostics: [diagnostic, diagnostic], input: "a\nb" }).message, "YAML parse failed with 2 errors: UnexpectedToken at 2:1; UnexpectedToken at 2:1");
    assert.strictEqual(YamlStringifyError.make({ diagnostics: [diagnostic], value: null }).message, "YAML stringify failed: bad token");
    assert.strictEqual(Reflect.getPrototypeOf(Reflect.construct(Yaml, [])), Yaml.prototype);
    assert.isFalse(Yaml.equalsValue("a: 1", { b: 1 }));
    assert.isFalse(Yaml.equalsValue("a: 1", {}));
  }));
  it.effect("stream expansion budget fails typed", () => Effect.gen(function* () {
    const error = yield* Effect.flip(Yaml.parseAll(bomb));
    assert.deepStrictEqual(A.map(error.diagnostics, (d) => d.code), ["AliasCountExceeded"]);
  }));
  it.effect("value equality treats expansion bombs as malformed", () => Effect.sync(() => {
    assert.isFalse(Yaml.equalsValue(bomb, {}));
  }));
  it.effect("text equality treats expansion bombs as malformed", () => Effect.sync(() => {
    assert.isFalse(Yaml.equals(bomb, bomb));
  }));
  it.effect("codec errors retain parse and stringify diagnostics, including streams", () => Effect.gen(function* () {
    const single = Yaml.fromString();
    const stream = Yaml.allFromString();
    const parse = yield* Effect.match(S.decodeEffect(single)("*missing"), { onFailure: (error) => error.message, onSuccess: () => "success" });
    assert.include(parse, "UndefinedAlias");
    const allParse = yield* Effect.flip(S.decodeEffect(stream)("*missing"));
    assert.include(allParse.message, "UndefinedAlias");
    const stringify = yield* Effect.flip(S.encodeEffect(single)(circular));
    assert.include(stringify.message, "Circular");
    const allStringify = yield* Effect.flip(S.encodeEffect(stream)([circular]));
    assert.include(allStringify.message, "Circular");
    assert.strictEqual(yield* S.encodeEffect(stream)([]), "");
  }));
  it.effect("unexpected value getters propagate their defect in both stringify paths", () => Effect.gen(function* () {
    const defect = YamlStringifyError.make({ diagnostics: [], value: "getter" });
    const value = { get key(): unknown { throw defect; } };
    assert.throws(() => Yaml.stringifyResult(value), defect);
    const exit = yield* Effect.exit(Yaml.stringify(value));
    assertSome(Option.flatMap(Exit.getCause(exit), flow(
      Cause.findDie,
      Result.map((reason) => reason.defect),
      Result.getSuccess,
    )), defect);
  }));
  it.effect("unexpected evaluator defects are preserved by single, stream and equality boundaries", () => Effect.sync(() => {
    const defect = YamlParseError.make({ diagnostics: [], input: "evaluator" });
    const evaluator = vi.spyOn(Node, "nodeToJsValue").mockImplementation(() => { throw defect; });
    try {
      assert.throws(() => Yaml.parseResult("a: 1"), defect);
      assert.throws(() => Yaml.parseAllResult("a: 1"), defect);
      assert.throws(() => Yaml.equalsValue("a: 1", {}), defect);
    } finally { evaluator.mockRestore(); }
  }));
});
