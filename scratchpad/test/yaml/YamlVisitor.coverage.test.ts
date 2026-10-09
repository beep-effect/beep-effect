import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { YamlVisitor, YamlVisitorEvent } from "../../effected/yaml/YamlVisitor.ts";

describe("YamlVisitor event fidelity", () => {
  it.effect("visits scalar comments, aliases without comments and positioned document errors", () => Effect.gen(function* () {
    const events = yield* Stream.runCollect(YamlVisitor.visit("base:\n  # scalar lead\n  &x 1 # scalar tail\nref: *x\n"));
    assert.deepStrictEqual(events.filter(YamlVisitorEvent.$is("Comment")).map((e) => [e.text, e.placement]), [
      [" scalar lead", "leading"], [" scalar tail", "trailing"],
    ]);
    assert.strictEqual(events.filter(YamlVisitorEvent.$is("Alias")).length, 1);
    const malformed = yield* Stream.runCollect(YamlVisitor.visit("a: *missing\n"));
    assert.deepStrictEqual(malformed.filter(YamlVisitorEvent.$is("Error")).map((e) => e.diagnostic.code), ["UndefinedAlias"]);
    assert.strictEqual(malformed[malformed.length - 1]?._tag, "DocumentEnd");
  }));

  it.effect("places document comments around an empty and a populated document", () => Effect.gen(function* () {
    const events = yield* Stream.runCollect(YamlVisitor.visit("# header\n---\n# root\n[1]\n...\n# tail\n---\n...\n"));
    assert.deepStrictEqual(events.filter(YamlVisitorEvent.$is("Comment")).map((e) => [e.text, e.placement, e.path]), [
      [" header", "leading", []], [" root", "leading", []], [" tail", "trailing", []],
    ]);
    assert.strictEqual(events.filter(YamlVisitorEvent.$is("DocumentStart")).length, 2);
    assert.strictEqual(events.filter(YamlVisitorEvent.$is("DocumentEnd")).length, 2);
  }));

  it.effect("keeps leading and trailing comments on aliases and both collection kinds", () => Effect.gen(function* () {
    for (const [kind, value] of [["MapStart", "&x {a: 1}"], ["SeqStart", "&x [1]"], ["Alias", "*x"]] as const) {
      const text = `base: &x 1\nroot:\n  # lead\n  ${value} # tail\n`;
      const events = yield* Stream.runCollect(YamlVisitor.visit(text));
      const comments = events.filter(YamlVisitorEvent.$is("Comment"));
      assert.deepStrictEqual(comments.map((e) => [e.text, e.placement, e.path, e.depth]), [
        [" lead", "leading", ["root"], 2], [" tail", "trailing", ["root"], 2],
      ]);
      assert.isTrue(events.some((e) => e._tag === kind && e.path[0] === "root"));
    }
  }));

  it.effect("emits stream errors before documents and duplicate-anchor warnings inside them", () => Effect.gen(function* () {
    const events = yield* Stream.runCollect(YamlVisitor.visit("%YAML 1.2\n---\na: &x 1\nb: &x 2\n---\n%YAML 1.2\n---\nc: 3\n"));
    assert.strictEqual(events[0]?._tag, "Error");
    const errors = events.filter(YamlVisitorEvent.$is("Error"));
    assert.isTrue(errors.some((e) => e.diagnostic.code === "InvalidDirective"));
    assert.isTrue(errors.some((e) => e.diagnostic.code === "DuplicateAnchor"));
    assert.strictEqual(events[events.length - 1]?._tag, "DocumentEnd");
  }));

  it.effect("uses numeric, boolean and complex key paths and omits absent value walks", () => Effect.gen(function* () {
    const events = yield* Stream.runCollect(YamlVisitor.visit("true: 1\n2: 3\n? [a,b]\n: x\nempty:\n"));
    assert.deepStrictEqual(events.filter(YamlVisitorEvent.$is("Pair")).map((e) => [e.path, e.key, e.value]), [
      [["true"], true, 1], [[2], 2, 3], [["null"], null, "x"], [["empty"], "empty", null],
    ]);
    assert.deepStrictEqual(events.filter(YamlVisitorEvent.$is("Scalar")).filter((e) => e.path[0] === "null").map((e) => e.path), [
      ["null", 0], ["null", 1], ["null"],
    ]);
  }));

  it.effect("retains the JavaScript static-only utility shape", () => Effect.sync(() => {
    const instance: unknown = Reflect.construct(YamlVisitor, []);
    assert.strictEqual(Object.getPrototypeOf(instance), YamlVisitor.prototype);
    assert.notProperty(instance, "visit");
    assert.isFunction(YamlVisitor.visit);
  }));
});
