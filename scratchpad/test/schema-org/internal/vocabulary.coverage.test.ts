import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import {
  decodeRow,
  SUPERSEDED_PROPERTIES,
  SUPERSEDED_PROPERTY_MAP,
  SUPERSEDED_TYPES,
  SUPERSEDED_TYPE_MAP,
} from "../../../effected/schema-org/internal/vocabulary.ts";

describe("internal vocabulary coverage", () => {
  it.effect("decodes absent, empty, singleton and populated rows", () => Effect.sync(() => {
    assert.deepStrictEqual(decodeRow(undefined), []);
    assert.deepStrictEqual(decodeRow(""), []);
    assert.deepStrictEqual(decodeRow("0"), [0]);
    assert.deepStrictEqual(decodeRow("150,793"), [150, 793]);
  }));

  it.effect("every generated supersession pair becomes exactly one map entry", () => Effect.sync(() => {
    for (const [rows, map] of [
      [SUPERSEDED_TYPES, SUPERSEDED_TYPE_MAP],
      [SUPERSEDED_PROPERTIES, SUPERSEDED_PROPERTY_MAP],
    ] as const) {
      assert.strictEqual(MutableHashMap.size(map), rows.length);
      for (const row of rows) {
        assert.match(row, /^\d+,\d+$/);
        const indices = decodeRow(row);
        assert.strictEqual(indices.length, 2);
        const [from, to] = indices;
        assertSome(MutableHashMap.get(map, Number(from)), to);
      }
    }
  }));
});
