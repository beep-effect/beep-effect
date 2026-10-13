import { assert, describe, it, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Lexer from "../../../effected/yaml/internal/lexer.ts";
import { parseCSTAll } from "../../../effected/yaml/internal/cst-parser.ts";
import { Yaml } from "../../../effected/yaml/Yaml.ts";

describe("CST explicit mapping indentation regressions", () => {
  it.effect("a repeated same-indent scope marker is consumed without nesting", () => Effect.sync(() => {
    const source = "a: 1\nb: 2\n";
    const tokens = Lexer.lexAll(source);
    const marker = A.findFirst(tokens, (token) => token.kind === "block-map-start");
    if (marker._tag === "None") throw new Error("Missing mapping scope marker");
    const bIndex = A.findFirstIndex(tokens, (token) => token.value === "b");
    if (bIndex._tag === "None") throw new Error("Missing second key");
    const lexer = vi.spyOn(Lexer, "lexAll").mockReturnValue([
      ...A.take(tokens, bIndex.value),
      { ...marker.value, offset: 5, line: 1 },
      ...A.drop(tokens, bIndex.value),
    ]);
    try {
      const document = A.getUnsafe(parseCSTAll(source), 0);
      const maps = A.filter(document.children ?? [], (node) => node.type === "block-map");
      assert.strictEqual(maps.length, 1);
      assert.deepStrictEqual(A.filter(A.getUnsafe(maps, 0).children ?? [], (node) => node.type === "block-map"), []);
      assert.include(A.getUnsafe(maps, 0).source, "b: 2");
    } finally { lexer.mockRestore(); }
  }));

  it.effect("a dedented explicit mapping remains a sibling and preserves oracle recovery", () => Effect.gen(function* () {
    const source = " ? a\n : 1\n? b\n: 2\n";
    const document = A.getUnsafe(parseCSTAll(source), 0);
    const maps = A.filter(document.children ?? [], (node) => node.type === "block-map");
    assert.strictEqual(maps.length, 2);
    assert.deepStrictEqual(A.map(maps, (node) => node.source), ["? a\n : 1\n", "? b\n: 2\n"]);
    for (const map of maps) {
      assert.deepStrictEqual(A.filter(map.children ?? [], (node) => node.type === "block-map"), []);
    }
    assert.deepStrictEqual(yield* Yaml.parse(source), { b: 2 });
  }));

  it.effect("deeper explicit mappings recurse and same-indent entries share their map", () => Effect.gen(function* () {
    const source = "? a\n: \n  ? b\n  : 1\n  ? c\n  : 2\n? d\n: 3\n";
    assert.deepStrictEqual(yield* Yaml.parse(source), { a: { b: 1, c: 2 }, d: 3 });
    const document = A.getUnsafe(parseCSTAll(source), 0);
    const maps = A.filter(document.children ?? [], (node) => node.type === "block-map");
    assert.strictEqual(maps.length, 1);
    const nested = A.filter(A.getUnsafe(maps, 0).children ?? [], (node) => node.type === "block-map");
    assert.strictEqual(nested.length, 1);
  }));
});
