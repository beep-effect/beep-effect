import { assert, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { resolveEntryPoint, UnresolvedEntryPointError } from "../../effected/package-json/EntryPoint.ts";
it.effect("reports all entry point failures and searches past unmatched nested conditions", () => Effect.sync(() => {
  assert.strictEqual(UnresolvedEntryPointError.make({reason: "noRootExport"}).message, 'The manifest\'s "exports" declares subpaths but no "." entry, so it has no root entry point');
  assert.strictEqual(UnresolvedEntryPointError.make({reason: "unsupportedExportsForm"}).message, 'The manifest\'s "exports" uses a form this resolver does not implement');
  assert.strictEqual(UnresolvedEntryPointError.make({reason: "noConditionMatched"}).message, 'The manifest\'s "exports" matched none of the conditions []');
  assertFailure(resolveEntryPoint({exports: {".": {require: "./cjs.js"}}}, {conditions: ["import"]}), UnresolvedEntryPointError.make({reason: "noConditionMatched", conditions: ["import"]}));
  assert.deepStrictEqual(resolveEntryPoint({exports: {import: {require: "./cjs.js"}, default: "./fallback.js"}}), resolveEntryPoint({exports: "./fallback.js"}));
}));
