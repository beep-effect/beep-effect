import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { ENTITY_MAP } from "../../../effected/markdown/internal/entityMap.ts";

it.effect("exposes the complete ordered HTML5 table through every ReadonlyMap view", () => Effect.sync(() => {
  const entries = A.fromIterable(ENTITY_MAP.entries());
  assert.strictEqual(entries.length, 2125);
  assert.strictEqual(ENTITY_MAP.size, entries.length);
  assert.deepStrictEqual(A.fromIterable(ENTITY_MAP), entries);
  assert.deepStrictEqual(A.fromIterable(ENTITY_MAP.keys()), A.map(entries, ([key]) => key));
  assert.deepStrictEqual(A.fromIterable(ENTITY_MAP.values()), A.map(entries, ([, value]) => value));
  const receiver = { visits: 0 };
  const visited: Array<readonly [string, string]> = [];
  ENTITY_MAP.forEach(function(this: typeof receiver, value, key, map) {
    assert.strictEqual(this, receiver);
    assert.strictEqual(map, ENTITY_MAP);
    assert.strictEqual(map.get(key), value);
    assert.strictEqual(map.has(key), true);
    this.visits += 1;
    visited.push([key, value]);
  }, receiver);
  assert.deepStrictEqual(visited, entries);
  assert.strictEqual(receiver.visits, entries.length);
  assert.strictEqual(ENTITY_MAP.has("&amp;"), false);
  assert.strictEqual(ENTITY_MAP.get("missing"), undefined);
}));
