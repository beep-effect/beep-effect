import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import * as Node from "@beep/toml/TomlNode";
import * as Model from "@beep/toml/TomlVisitor";
import { TomlVisitor } from "@beep/toml/TomlVisitor";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constant, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    name,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(S.toEquivalence(schema)(value, decoded));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};
describe("schema property floor", () => {
  roundTrips("TomlVisitorEvent encode/decode", Model.TomlVisitorEvent);
});

it.effect.prop(
  "visitor preserves generated assignments and comments in source order",
  [Arbitrary.schema(S.Int.check(S.isBetween({ minimum: -1000000, maximum: 1000000 })))],
  ([value]) =>
    Effect.gen(function* () {
      const text = `# lead\n[table] # header\nvalue = ${value} # value\n[[rows]]\nenabled = true\n`;
      const events = yield* Stream.runCollect(TomlVisitor.visit(text));
      assert.deepStrictEqual(
        A.map(events, (event) => event._tag),
        ["TableStart", "Comment", "TableStart", "Comment", "KeyValue", "Comment", "ArrayTableStart", "KeyValue"]
      );
      const assignments = A.filter(events, Model.TomlVisitorEvent.$is("KeyValue"));
      assert.deepStrictEqual(
        A.map(assignments, (event) => event.path),
        [
          ["table", "value"],
          ["rows", "enabled"],
        ]
      );
      assert.deepStrictEqual(
        A.map(assignments, (event) => event.node.value),
        [
          Node.TomlInteger.make({
            value,
            offset: pipe(text, Str.indexOf(String(value)), O.getOrElse(constant(-1))),
            length: String(value).length,
          }),
          Node.TomlBoolean.make({
            value: true,
            offset: pipe(text, Str.indexOf("true"), O.getOrElse(constant(-1))),
            length: 4,
          }),
        ]
      );
      const comments = A.filter(events, Model.TomlVisitorEvent.$is("Comment"));
      assert.deepStrictEqual(
        A.map(comments, (event) => event.text),
        ["lead", "header", "value"]
      );
      assert.deepStrictEqual(
        A.map(comments, (event) => pipe(text, Str.charAt(event.offset), O.getOrElse(constant("")))),
        ["#", "#", "#"]
      );
    }),
  runs
);
