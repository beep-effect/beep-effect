import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { inlineCatalogs, normalize, rangeOf } from "../../../effected/workspaces/internal/catalogs.ts";

it.effect("absent and conflicting inline catalogs yield an empty set", () => Effect.sync(() => {
  assert.deepStrictEqual(inlineCatalogs({}), {});
  assert.deepStrictEqual(inlineCatalogs({ catalog: { a: "1" }, catalogs: { default: { a: "2" } } }), {});
}));
it.effect("normalization drops unusable entries and keeps array catalogs and lockfile ranges", () => Effect.sync(() => {
  assert.deepStrictEqual(normalize(null), {});
  assert.deepStrictEqual(normalize({ bad: 1, default: { bad: {}, range: { specifier: 1 }, valid: { specifier: "^1" }, fn: () => "x", nil: null }, list: ["1", { specifier: "2" }] }), { default: { valid: "^1" }, list: { "0": "1", "1": "2" } });
  assert.deepStrictEqual(normalize([["1"]]), { "0": { "0": "1" } });
}));
it.effect("catalog resolution distinguishes an unused protocol from malformed catalog entries", () => Effect.sync(() => {
  assert.isUndefined(rangeOf({}, "a", "workspace:*"));
  const recursive = rangeOf({ default: { a: "catalog:other" } }, "a", "catalog:");
  assert.isObject(recursive);
  assert.deepStrictEqual(typeof recursive === "object" ? recursive.catalogName : undefined, "default");
  assert.include(typeof recursive === "object" ? recursive.detail : "", "recursively");
  assert.isUndefined(rangeOf({}, "a", "catalog:missing"));
  assert.isUndefined(rangeOf({ default: {} }, "a", "catalog:"));
}));
