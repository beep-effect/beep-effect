import { assertExitFailure } from "@effect/vitest/utils";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { YamlDocument, documentFromRaw } from "../../effected/yaml/YamlDocument.ts";
import { YamlScalar } from "../../effected/yaml/YamlNode.ts";
import { YamlStringifyError } from "../../effected/yaml/Yaml.ts";
import { StringifyFailure } from "../../effected/yaml/internal/stringifier.ts";
const scalarFailure = YamlScalar.make({ value: { toString() { throw StringifyFailure.new("Circular reference detected"); } }, style: "plain", offset: 0, length: 1 });
const cyclic = YamlDocument.make({ contents: scalarFailure, errors: [], warnings: [], directives: [] });
describe("document uncovered contracts", () => {
  it.effect("stream fatal diagnostics aggregate from directives and documents", () => Effect.gen(function* () {
    const documents = yield* YamlDocument.parseAll("---\na: 1\n---\nb: 2\n");
    assert.deepStrictEqual(A.map(documents, (doc) => doc.toValue()), [{ a: 1 }, { b: 2 }]);
    const localTags = yield* YamlDocument.parseAll("%TAG !e! tag:example.com,2020:\n---\na: !e!foo x\n---\nb: !e!foo y\n");
    assert.deepStrictEqual(A.map(localTags, (doc) => doc.toValue()), [{ a: "x" }, { b: "y" }]);
    assert.deepStrictEqual(A.map(localTags, (doc) => doc.directives.length), [1, 0]);
    for (const input of ["a: 1\n%YAML 1.2\n---\nb: 2", "---\n*missing"]) {
      const error = yield* Effect.flip(YamlDocument.parseAll(input));
      assert.strictEqual(error.input, input);
      assert.isAbove(error.diagnostics.length, 0);
    }
  }));
  it.effect("scalar conversion failures become typed document and codec failures", () => Effect.gen(function* () {
    const error = yield* Effect.flip(cyclic.stringify());
    assert.instanceOf(error, YamlStringifyError);
    assert.deepStrictEqual(A.map(error.diagnostics, (d) => d.code), ["CircularReference"]);
    assert.include((yield* Effect.flip(S.encodeEffect(YamlDocument.schema())(cyclic))).message, "Circular");
  }));
  it.effect("unexpected scalar getter defects propagate without becoming stringify errors", () => Effect.gen(function* () {
    const defect = YamlStringifyError.make({ diagnostics: [], value: "getter" });
    const scalar = YamlScalar.make({ value: "x", style: "plain", offset: 0, length: 1 });
    const node = Object.defineProperty(scalar, "value", { get: () => { throw defect; } });
    const doc = YamlDocument.make({ contents: node, errors: [], warnings: [], directives: [] });
    const exit = yield* Effect.exit(doc.stringify());
    assertExitFailure(exit, Cause.die(defect));
  }));
  it.effect("raw bridging materializes errors, warnings and directive positions in both dual forms", () => Effect.sync(() => {
    const raw = { contents: null, errors: [{ code: "UnexpectedToken", message: "bad", offset: 2, length: 1 }], warnings: [{ code: "DuplicateKey", message: "duplicate", offset: 0, length: 1 }], directives: [{ name: "YAML", parameters: ["1.2"] }], hasDocumentStart: false, hasDocumentEnd: false, hasDocumentStartTab: false } as const;
    const doc = documentFromRaw(raw, "a\nb");
    assert.deepStrictEqual(documentFromRaw("a\nb")(raw), doc);
    assert.deepStrictEqual(A.map(doc.errors, (d) => [d.line, d.character]), [[1, 0]]);
    assert.deepStrictEqual(A.map(doc.warnings, (d) => d.code), ["DuplicateKey"]);
    assert.strictEqual(doc.directives.length, 1);
  }));
});
