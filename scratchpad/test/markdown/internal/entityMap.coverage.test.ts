import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as HashMap from "effect/HashMap";
import * as Effect from "effect/Effect";
import { ENTITY_MAP } from "../../../effected/markdown/internal/entityMap.ts";

it.effect("exposes the complete ordered HTML5 table through every ReadonlyMap view", () => Effect.sync(() => {
  const entries = ENTITY_MAP.pipe(HashMap.entries, A.fromIterable);
  assert.strictEqual(entries.length, 2125);
  assert.strictEqual(HashMap.size(ENTITY_MAP), entries.length);
  assert.deepStrictEqual(A.fromIterable(ENTITY_MAP), entries);
  assert.deepStrictEqual(ENTITY_MAP.pipe(HashMap.keys, A.fromIterable), A.map(entries, ([key]) => key));
  assert.deepStrictEqual(ENTITY_MAP.pipe(HashMap.values, A.fromIterable), A.map(entries, ([, value]) => value));
  const receiver = { visits: 0 };
  const visited: Array<readonly [string, string]> = [];
  HashMap.forEach(ENTITY_MAP, (value, key) => {
    assert.isTrue(HashMap.isHashMap(ENTITY_MAP));
    assertSome(HashMap.get(ENTITY_MAP, key), value);
    assert.strictEqual(HashMap.has(ENTITY_MAP, key), true);
    receiver.visits += 1;
    visited.push([key, value]);
  });
  assert.deepStrictEqual(visited, entries);
  assert.strictEqual(receiver.visits, entries.length);
  assert.strictEqual(HashMap.has(ENTITY_MAP, "&amp;"), false);
  assertNone(HashMap.get(ENTITY_MAP, "missing"));
}));
