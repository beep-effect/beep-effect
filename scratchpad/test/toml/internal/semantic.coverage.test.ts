import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { parseExpressions } from "../../../effected/toml/internal/parser.ts";
import { analyze, buildValue } from "../../../effected/toml/internal/semantic.ts";
import { TomlArrayTableHeader, TomlInlineEntry, TomlInlineTable, TomlKey, TomlKeyValue, TomlString, TomlTableHeader } from "../../../effected/toml/TomlNode.ts";

const key = (value: string) => TomlKey.make({ value, kind: "bare", offset: 0, length: value.length });
const value = TomlString.make({ value: "v", style: "basic", offset: 0, length: 3 });
const entry = (keyPath: ReadonlyArray<TomlKey>) => TomlKeyValue.make({ keyPath, value, offset: 0, length: 3 });
const table = (keyPath: ReadonlyArray<TomlKey>) => TomlTableHeader.make({ keyPath, offset: 0, length: 3 });
const arrayTable = (keyPath: ReadonlyArray<TomlKey>) => TomlArrayTableHeader.make({ keyPath, offset: 0, length: 3 });
const missingKey = /missing TOML key/;

// Synthetic CSTs can bypass the parser's non-empty, dense path guarantee.
describe("semantic defensive inputs", () => {
  it.effect("rejects empty assignment and header paths", () => Effect.sync(() => {
    for (const expression of [entry([]), table([]), arrayTable([])]) {
      assert.throws(() => analyze([expression]), missingKey);
    }
  }));

  it.effect("rejects holes in header and dotted-assignment prefixes", () => Effect.sync(() => {
    const sparse = new Array<TomlKey>(2);
    sparse[1] = key("leaf");
    for (const expression of [{ ...table([]), keyPath: sparse }, { ...entry([]), keyPath: sparse }]) {
      assert.throws(() => analyze([expression]), missingKey);
    }
  }));

  it.effect("rejects header paths that disappear between validation and the output callback", () => Effect.sync(() => {
    for (const header of [arrayTable([key("t")])]) {
      let reads = 0;
      const unstable = { ...header, get keyPath() { reads += 1; return reads === 1 ? header.keyPath : []; } };
      assert.throws(() => buildValue([unstable]), missingKey);
    }
  }));

  it.effect("rejects assignment paths that disappear after validation", () => Effect.sync(() => {
    const original = entry([key("k")]);
    let reads = 0;
    const unstable = { ...original, get keyPath() { reads += 1; return reads === 1 ? original.keyPath : []; } };
    assert.throws(() => buildValue([unstable]), missingKey);
  }));

  it.effect("rejects an output path redirected into a scalar after validation", () => Effect.sync(() => {
    const original = entry([key("safe"), key("leaf")]);
    let reads = 0;
    const unstable = { ...original, get keyPath() { reads += 1; return reads === 1 ? original.keyPath : [key("scalar"), key("leaf")]; } };
    assert.throws(() => buildValue([entry([key("scalar")]), unstable]), /expected TOML output table/);
  }));

  it.effect("rejects an inline path removed between semantic validation and materialization", () => Effect.sync(() => {
    const original = TomlInlineEntry.make({ keyPath: [key("leaf")], value, offset: 0, length: 3 });
    let reads = 0;
    const unstable = { ...original, get keyPath() { reads += 1; return reads <= 2 ? original.keyPath : []; } };
    const inline = { ...TomlInlineTable.make({ entries: [], offset: 0, length: 2 }), entries: [unstable] };
    assert.throws(() => buildValue([{ ...entry([key("t")]), value: inline }]), missingKey);
  }));

  it.effect("navigates the most recent array-table element and preserves own prototype keys", () => Effect.sync(() => {
    assert.deepStrictEqual(buildValue(parseExpressions('[[a]]\nv=1\n[[a]]\nv=2\n[a.child]\n__proto__.x=3\n')), {
      a: [{ v: 1 }, { v: 2, child: { ["__proto__"]: { x: 3 } } }],
    });
    const paths: Array<ReadonlyArray<string>> = [];
    analyze({ onKeyValue: (path) => { paths.push(path); } })(parseExpressions("a.b=1\na.c=2\n"));
    assert.deepStrictEqual(paths, [["a", "b"], ["a", "c"]]);
  }));
});
