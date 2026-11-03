import { YamlVisitor, YamlVisitorEvent } from "@beep/yaml/YamlVisitor";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";

describe("YamlVisitor event fidelity", () => {
  it.effect("replays the same stream after full and partial executions in event order", () =>
    Effect.gen(function* () {
      const stream = YamlVisitor.visit("a: 1\n");
      const first = yield* Stream.runCollect(stream);
      assert.deepStrictEqual(
        A.map(first, (event) => event._tag),
        ["DocumentStart", "MapStart", "Pair", "Scalar", "Scalar", "MapEnd", "DocumentEnd"]
      );
      const resultCollect = yield* Stream.runCollect(stream);
      assert.deepStrictEqual(resultCollect, first);
      const resultCollect1 = yield* Stream.runCollect(Stream.take(stream, 1));
      assert.deepStrictEqual(resultCollect1, first.slice(0, 1));
      const resultCollect2 = yield* Stream.runCollect(stream);
      assert.deepStrictEqual(resultCollect2, first);
    })
  );

  it.effect("visits scalar comments, aliases without comments and positioned document errors", () =>
    Effect.gen(function* () {
      const events = yield* Stream.runCollect(
        YamlVisitor.visit("base:\n  # scalar lead\n  &x 1 # scalar tail\nref: *x\n")
      );
      assert.deepStrictEqual(
        A.map(A.filter(events, YamlVisitorEvent.$is("Comment")), (e) => [e.text, e.placement]),
        [
          [" scalar lead", "leading"],
          [" scalar tail", "trailing"],
        ]
      );
      assert.strictEqual(A.filter(events, YamlVisitorEvent.$is("Alias")).length, 1);
      const malformed = yield* Stream.runCollect(YamlVisitor.visit("a: *missing\n"));
      assert.deepStrictEqual(
        A.map(A.filter(malformed, YamlVisitorEvent.$is("Error")), (e) => e.diagnostic.code),
        ["UndefinedAlias"]
      );
      assert.strictEqual(malformed[malformed.length - 1]?._tag, "DocumentEnd");
    })
  );

  it.effect("places document comments around an empty and a populated document", () =>
    Effect.gen(function* () {
      const events = yield* Stream.runCollect(YamlVisitor.visit("# header\n---\n# root\n[1]\n...\n# tail\n---\n...\n"));
      assert.deepStrictEqual(
        A.map(A.filter(events, YamlVisitorEvent.$is("Comment")), (e) => [e.text, e.placement, e.path]),
        [
          [" header", "leading", []],
          [" root", "leading", []],
          [" tail", "trailing", []],
        ]
      );
      assert.strictEqual(A.filter(events, YamlVisitorEvent.$is("DocumentStart")).length, 2);
      assert.strictEqual(A.filter(events, YamlVisitorEvent.$is("DocumentEnd")).length, 2);
    })
  );

  it.effect("keeps leading and trailing comments on aliases and both collection kinds", () =>
    Effect.gen(function* () {
      for (const [kind, value] of [
        ["MapStart", "&x {a: 1}"],
        ["SeqStart", "&x [1]"],
        ["Alias", "*x"],
      ] as const) {
        const text = `base: &x 1\nroot:\n  # lead\n  ${value} # tail\n`;
        const events = yield* Stream.runCollect(YamlVisitor.visit(text));
        const comments = A.filter(events, YamlVisitorEvent.$is("Comment"));
        assert.deepStrictEqual(
          A.map(comments, (e) => [e.text, e.placement, e.path, e.depth]),
          [
            [" lead", "leading", ["root"], 2],
            [" tail", "trailing", ["root"], 2],
          ]
        );
        assert.isTrue(A.some(events, (e) => e._tag === kind && e.path[0] === "root"));
      }
    })
  );

  it.effect("emits stream errors before documents and duplicate-anchor warnings inside them", () =>
    Effect.gen(function* () {
      const events = yield* Stream.runCollect(
        YamlVisitor.visit("%YAML 1.2\n---\na: &x 1\nb: &x 2\n---\n%YAML 1.2\n---\nc: 3\n")
      );
      assert.strictEqual(events[0]?._tag, "Error");
      const errors = A.filter(events, YamlVisitorEvent.$is("Error"));
      assert.isTrue(A.some(errors, (e) => e.diagnostic.code === "InvalidDirective"));
      assert.isTrue(A.some(errors, (e) => e.diagnostic.code === "DuplicateAnchor"));
      assert.strictEqual(events[events.length - 1]?._tag, "DocumentEnd");
    })
  );

  it.effect("uses numeric, boolean and complex key paths and omits absent value walks", () =>
    Effect.gen(function* () {
      const events = yield* Stream.runCollect(YamlVisitor.visit("true: 1\n2: 3\n? [a,b]\n: x\nempty:\n"));
      assert.deepStrictEqual(
        A.map(A.filter(events, YamlVisitorEvent.$is("Pair")), (e) => [e.path, e.key, e.value]),
        [
          [["true"], true, 1],
          [[2], 2, 3],
          [["null"], null, "x"],
          [["empty"], "empty", null],
        ]
      );
      assert.deepStrictEqual(
        A.map(
          A.filter(A.filter(events, YamlVisitorEvent.$is("Scalar")), (e) => e.path[0] === "null"),
          (e) => e.path
        ),
        [["null", 0], ["null", 1], ["null"]]
      );
    })
  );

  it.effect("retains the JavaScript static-only utility shape", () =>
    Effect.sync(() => {
      const instance: unknown = Reflect.construct(YamlVisitor, []);
      assert.strictEqual(Object.getPrototypeOf(instance), YamlVisitor.prototype);
      assert.notProperty(instance, "visit");
      assert.isFunction(YamlVisitor.visit);
    })
  );
});
