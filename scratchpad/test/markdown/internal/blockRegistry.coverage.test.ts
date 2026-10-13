import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Effect from "effect/Effect";
import { blockDialect } from "../../../effected/markdown/internal/blockRegistry.ts";
import { makeBlockNode } from "../../../effected/markdown/internal/blockTypes.ts";

describe("blockRegistry map contract", () => {
  it.effect("iterates constructs in insertion order and preserves identities", () => Effect.sync(() => {
    const coreStarts = ["blockquote", "atxHeading", "fencedCode", "htmlBlock", "setextHeading", "thematicBreak", "listItem", "indentedCode"];
    for (const name of ["commonmark", "gfm"] as const) {
      const dialect = blockDialect(name);
      const table = dialect.constructs;
      assert.isTrue(HashMap.isHashMap(table));
      // The ordered scanner starts retain insertion order; the construct
      // index uses HashMap traversal and preserves membership and identity.
      const entries = A.fromIterable(table);
      assert.strictEqual(HashMap.size(table), name === "commonmark" ? 10 : 14);
      assert.strictEqual(entries.length, HashMap.size(table));
      assert.deepStrictEqual(table.pipe(HashMap.entries, A.fromIterable), entries);
      assert.deepStrictEqual(table.pipe(HashMap.keys, A.fromIterable), A.map(entries, ([key]) => key));
      assert.deepStrictEqual(table.pipe(HashMap.values, A.fromIterable), A.map(entries, ([, value]) => value));
      const observed: Array<string> = [];
      HashMap.forEach(table, (value, key) => {
        assert.strictEqual(O.getOrThrow(HashMap.get(table, key)), value);
        assert.strictEqual(HashMap.has(table, key), true);
        assert.strictEqual(value.type, key);
        observed.push(key);
      });
      assert.deepStrictEqual(observed, A.map(entries, ([key]) => key));
      assert.deepStrictEqual(dialect.starts.map((start) => start.name), name === "commonmark" ? coreStarts : [
        ...coreStarts.slice(0, 6), "footnoteDefinition", ...coreStarts.slice(6), "taskListItem", "tableHeader", "tableRow",
      ]);
    }
    const core = blockDialect("commonmark").constructs;
    assert.strictEqual(HashMap.has(core, "table"), false);
    assertNone(HashMap.get(core, "table"));
  }));
  it.effect("recognizes the GFM extension fast-path prefixes", () => Effect.sync(() => {
    const mayStart = blockDialect("gfm").mayStartBlock;
    assert.ok(mayStart);
    if (mayStart === undefined) return;
    for (const prefix of ["[", "|", ":"]) assert.strictEqual(mayStart(`${prefix}content`, makeBlockNode("paragraph", 0, 1)), true);
    assert.strictEqual(mayStart("plain", makeBlockNode("table", 0, 1)), true);
    assert.strictEqual(mayStart("plain", makeBlockNode("paragraph", 0, 1)), false);
  }));
});

it.effect("reports an unknown runtime dialect as a programmer defect", () => Effect.sync(() => {
  assert.throws(() => Reflect.apply(blockDialect, undefined, ["unknown"]), /unknown markdown dialect: unknown/);
}));
