import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { blockDialect } from "../../../effected/markdown/internal/blockRegistry.ts";
import { makeBlockNode } from "../../../effected/markdown/internal/blockTypes.ts";

describe("blockRegistry map contract", () => {
  it.effect("iterates constructs in insertion order and preserves identities", () => Effect.sync(() => {
    for (const name of ["commonmark", "gfm"] as const) {
      const table = blockDialect(name).constructs;
      const entries = Array.from(table.entries());
      assert.strictEqual(entries.length, table.size);
      assert.deepStrictEqual(Array.from(table), entries);
      assert.deepStrictEqual(Array.from(table.keys()), entries.map(([key]) => key));
      assert.deepStrictEqual(Array.from(table.values()), entries.map(([, value]) => value));
      const observed: Array<string> = [];
      const receiver = { marker: "callback receiver" };
      table.forEach(function (this: typeof receiver, value, key, map) {
        assert.strictEqual(this, receiver);
        assert.strictEqual(map, table);
        assert.strictEqual(table.get(key), value);
        assert.strictEqual(table.has(key), true);
        observed.push(key);
      }, receiver);
      assert.deepStrictEqual(observed, entries.map(([key]) => key));
    }
    const core = blockDialect("commonmark").constructs;
    assert.strictEqual(core.has("table"), false);
    assert.strictEqual(core.get("table"), undefined);
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
