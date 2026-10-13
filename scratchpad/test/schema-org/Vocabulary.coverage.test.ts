import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { Vocabulary } from "../../effected/schema-org/Vocabulary.ts";

describe("Vocabulary coverage", () => {
  it.effect("resolves deprecated classes and leaves current classes without successors", () => Effect.sync(() => {
    assertSome(Vocabulary.supersededBy("Code"), "SoftwareSourceCode");
    assertSome(Vocabulary.supersededBy("UserComments"), "InteractionCounter");
    assertNone(Vocabulary.supersededBy("Thing"));
    assert.strictEqual(Vocabulary.hasType("Code"), true);
    assert.strictEqual(Vocabulary.hasType("SoftwareSourceCode"), true);
  }));

  it.effect("repeated ordered and membership queries preserve inherited answers", () => Effect.sync(() => {
    const ancestors = Vocabulary.ancestorsInOrder("HowToStep");
    const properties = Vocabulary.propertiesInOrder("HowToStep");
    assert.deepStrictEqual(Vocabulary.ancestorsInOrder("HowToStep"), ancestors);
    assert.deepStrictEqual(Vocabulary.propertiesInOrder("HowToStep"), properties);
    assert.strictEqual(Vocabulary.isPropertyOn("license", "HowToStep"), true);
    assert.strictEqual(Vocabulary.isPropertyOn("license", "HowToStep"), true);
    assert.strictEqual(Vocabulary.isPropertyOn("softwareVersion", "HowToStep"), false);
  }));

  it.effect("unknown terms make property legality false on either side", () => Effect.sync(() => {
    assert.strictEqual(Vocabulary.isPropertyOn("notAProperty", "Thing"), false);
    assert.strictEqual(Vocabulary.isPropertyOn("name", "NotAType"), false);
    assert.strictEqual(Vocabulary.isPropertyOn("notAProperty", "NotAType"), false);
  }));
});
