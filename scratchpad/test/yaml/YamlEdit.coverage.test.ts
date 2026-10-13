import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { YamlEdit } from "../../effected/yaml/YamlEdit.ts";
describe("adjacent edit contracts", () => {
  it.effect("sorts without mutation, allows touching spans and rejects overlaps", () => Effect.sync(() => {
    const edits = [YamlEdit.make({ offset: 0, length: 2, content: "A" }), YamlEdit.make({ offset: 2, length: 2, content: "B" })];
    assert.strictEqual(YamlEdit.applyAll("abcd", edits), "AB");
    assert.strictEqual(edits[0]?.offset, 0);
    assert.strictEqual(YamlEdit.applyAll("abcd", []), "abcd");
    assert.throws(() => YamlEdit.applyAll("abcd", [edits[0] ?? YamlEdit.make({ offset: 0, length: 2, content: "A" }), YamlEdit.make({ offset: 1, length: 1, content: "x" })]), /overlapping edits/);
  }));
});
