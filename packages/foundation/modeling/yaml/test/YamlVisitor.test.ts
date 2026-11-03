import { Yaml, YamlParseOptions } from "@beep/yaml/Yaml";
import { YamlVisitor, YamlVisitorEvent } from "@beep/yaml/YamlVisitor";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const Path = S.Array(S.Union([S.String, S.Finite]));
const isPath = S.is(Path);

describe("YamlVisitor", () => {
  describe("visit", () => {
    it.effect("emits a well-formed event sequence for a mapping", () =>
      Effect.gen(function* () {
        const events = yield* Stream.runCollect(YamlVisitor.visit("a: 1\n"));
        const tags = A.map(events, (e) => e._tag);
        assert.deepStrictEqual(tags, [
          "DocumentStart",
          "MapStart",
          "Pair",
          "Scalar",
          "Scalar",
          "MapEnd",
          "DocumentEnd",
        ]);
      })
    );

    it.effect("carries path context on nested scalar events", () =>
      Effect.gen(function* () {
        const events = yield* Stream.runCollect(YamlVisitor.visit("a:\n  b: 42\n"));
        const scalar = O.getOrUndefined(
          A.findFirst(events, (e) => YamlVisitorEvent.$is("Scalar")(e) && e.value === 42)
        );
        assert.isDefined(scalar);
        assert.deepStrictEqual(scalar !== undefined && "path" in scalar ? [...scalar.path] : undefined, ["a", "b"]);
      })
    );

    it.effect("emits Pair events with resolved key/value", () =>
      Effect.gen(function* () {
        const events = yield* Stream.runCollect(YamlVisitor.visit("name: Alice\n"));
        const pair = O.getOrUndefined(A.findFirst(events, YamlVisitorEvent.$is("Pair")));
        assert.isDefined(pair);
        assert.strictEqual(pair?.key, "name");
        assert.strictEqual(pair?.value, "Alice");
      })
    );

    it.effect("normalizes non-finite mapping paths while retaining numeric scalar values", () =>
      Effect.gen(function* () {
        const text = "outer:\n  .nan: .nan\n  .inf: .inf\n  +.inf: +.inf\n  -.inf: -.inf\n  42: 42\n";
        const events = yield* Stream.runCollect(YamlVisitor.visit(text, YamlParseOptions.make({ uniqueKeys: false })));
        const pairs = A.filter(events, YamlVisitorEvent.$is("Pair"));
        assert.deepStrictEqual(
          A.map(pairs, (event) => event.path),
          [
            ["outer"],
            ["outer", "NaN"],
            ["outer", "Infinity"],
            ["outer", "Infinity"],
            ["outer", "-Infinity"],
            ["outer", 42],
          ]
        );
        assert.deepStrictEqual(
          A.map(pairs.slice(1), (event) => [event.key, event.value]),
          [
            [Number.NaN, Number.NaN],
            [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
            [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
            [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
            [42, 42],
          ]
        );
        const scalars = A.filter(events, YamlVisitorEvent.$is("Scalar"));
        assert.deepStrictEqual(
          A.map(scalars.slice(1), (event) => [event.path, event.value]),
          [
            [["outer", "NaN"], Number.NaN],
            [["outer", "NaN"], Number.NaN],
            [["outer", "Infinity"], Number.POSITIVE_INFINITY],
            [["outer", "Infinity"], Number.POSITIVE_INFINITY],
            [["outer", "Infinity"], Number.POSITIVE_INFINITY],
            [["outer", "Infinity"], Number.POSITIVE_INFINITY],
            [["outer", "-Infinity"], Number.NEGATIVE_INFINITY],
            [["outer", "-Infinity"], Number.NEGATIVE_INFINITY],
            [["outer", 42], 42],
            [["outer", 42], 42],
          ]
        );
        assert.isTrue(A.every(events, (event) => isPath(event.path)));
        assert.deepStrictEqual(A.filter(events, YamlVisitorEvent.$is("Error")), []);
      })
    );

    it.effect("filter + take enables early termination", () =>
      Effect.gen(function* () {
        const events = yield* YamlVisitor.visit("a: 1\nb: 2\nc: 3\n").pipe(
          Stream.filter(YamlVisitorEvent.$is("Scalar")),
          Stream.take(1),
          Stream.runCollect
        );
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0]?.value, "a");
      })
    );

    it.effect("surfaces malformed input as Error events in the union and still completes", () =>
      Effect.gen(function* () {
        const events = yield* Stream.runCollect(YamlVisitor.visit("a: *undefined\n"));
        const errors = A.filter(events, YamlVisitorEvent.$is("Error"));
        assert.isAbove(errors.length, 0);
        assert.isTrue(A.some(errors, (e) => e.diagnostic.code === "UndefinedAlias"));
        // The stream must still complete normally.
        assert.strictEqual(events[events.length - 1]?._tag, "DocumentEnd");
      })
    );

    it.effect("the maxAliasCount DoS guard carries over from the engine", () =>
      Effect.gen(function* () {
        const events = yield* Stream.runCollect(
          YamlVisitor.visit("a: &x 1\nb: *x\nc: *x\n", YamlParseOptions.make({ maxAliasCount: 1 }))
        );
        const errors = A.filter(events, YamlVisitorEvent.$is("Error"));
        assert.isTrue(A.some(errors, (e) => e.diagnostic.code === "AliasCountExceeded"));
      })
    );

    it.effect("emits per-directive events and DocumentStart directives", () =>
      Effect.gen(function* () {
        const events = yield* Stream.runCollect(YamlVisitor.visit("%YAML 1.2\n---\na: 1\n"));
        const directiveEvent = O.getOrUndefined(A.findFirst(events, YamlVisitorEvent.$is("Directive")));
        assert.isDefined(directiveEvent);
        assert.strictEqual(directiveEvent?.name, "YAML");
        const start = O.getOrUndefined(A.findFirst(events, YamlVisitorEvent.$is("DocumentStart")));
        assert.isDefined(start);
        assert.strictEqual(start?.directives.length, 1);
        assert.strictEqual(start?.directives[0]?.name, "YAML");
      })
    );

    it.effect("emits a separate DocumentStart/DocumentEnd pair per document in a multi-doc stream", () =>
      Effect.gen(function* () {
        const events = yield* Stream.runCollect(YamlVisitor.visit("a: 1\n---\nb: 2\n"));
        const starts = A.filter(events, YamlVisitorEvent.$is("DocumentStart"));
        const ends = A.filter(events, YamlVisitorEvent.$is("DocumentEnd"));
        assert.strictEqual(starts.length, 2);
        assert.strictEqual(ends.length, 2);
      })
    );
  });

  describe("event constructors", () => {
    it("build tagged, structurally-equal events", () => {
      const event = YamlVisitorEvent.SeqEnd({ path: [], depth: 0 });
      assert.strictEqual(event._tag, "SeqEnd");
      assert.strictEqual(event.depth, 0);
    });
  });

  describe("visitCollect replacement", () => {
    it.effect("Stream.filter + runCollect covers the dropped convenience", () =>
      Effect.gen(function* () {
        const keys = yield* YamlVisitor.visit("name: x\nage: 1\n").pipe(
          Stream.filter(YamlVisitorEvent.$is("Pair")),
          Stream.map((e) => e.key),
          Stream.runCollect
        );
        assert.deepStrictEqual([...keys], ["name", "age"]);
        // Sanity: parity with a full parse.
        const parsed = yield* Yaml.parse("name: x\nage: 1\n");
        assert.deepStrictEqual(parsed, { name: "x", age: 1 });
      })
    );
  });
});

describe("schema-derived visitor constructor compatibility", () => {
  it("retains structural equality and optional metadata with Data constructors", () => {
    const fields = { path: ["a", 0], depth: 2, value: 42, style: "plain" } as const;
    const first = YamlVisitorEvent.Scalar(fields);
    const second = YamlVisitorEvent.Scalar({ ...fields, path: ["a", 0] });
    assert.isTrue(Equal.equals(first, second));
    assert.isTrue(YamlVisitorEvent.$is("Scalar")(first));
    assert.strictEqual(
      YamlVisitorEvent.$match(first, {
        Scalar: (event) => event.value,
        Alias: () => null,
        Comment: () => null,
        Directive: () => null,
        DocumentEnd: () => null,
        DocumentStart: () => null,
        Error: () => null,
        MapEnd: () => null,
        MapStart: () => null,
        Pair: () => null,
        SeqEnd: () => null,
        SeqStart: () => null,
      }),
      42
    );
    assert.notProperty(first, "tag");
    assert.notProperty(first, "anchor");
    const tagged = YamlVisitorEvent.Scalar({ ...fields, tag: "tag:yaml.org,2002:int", anchor: "x" });
    assert.strictEqual(tagged.tag, "tag:yaml.org,2002:int");
    assert.strictEqual(tagged.anchor, "x");
    assert.isFalse(Equal.equals(first, tagged));
  });
});
