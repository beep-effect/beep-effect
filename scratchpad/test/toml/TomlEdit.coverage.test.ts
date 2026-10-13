import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { TomlEdit } from "../../effected/toml/TomlEdit.ts";
it.effect("adjacent edits use original offsets, leave the input order intact, and reject overlap", () => Effect.sync(() => {
  const lower = TomlEdit.make({ offset: 0, length: 2, content: "x" });
  const upper = TomlEdit.make({ offset: 2, length: 2, content: "yz" });
  const edits = [lower, upper];
  assert.strictEqual(TomlEdit.applyAll("abcd!", edits), "xyz!");
  assert.deepStrictEqual(edits, [lower, upper]);
  assert.strictEqual(TomlEdit.applyAll("abcd!", []), "abcd!");
  assert.throws(() => TomlEdit.applyAll("abcd!", [lower, TomlEdit.make({ offset: 1, length: 1, content: "z" })]), /overlapping edits at offsets 0 and 1/);
}));
