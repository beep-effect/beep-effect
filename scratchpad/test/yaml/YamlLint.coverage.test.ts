import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { StyleConflict, StyleVoteTally, YamlLint, YamlStyleConflictError } from "../../effected/yaml/YamlLint.ts";

describe("lint conflict display", () => {
  it.effect("renders every candidate with count and one-based location", () => Effect.sync(() => {
    const tally = StyleVoteTally.make({ rule: "quoted-strings", dimension: "quoteType", value: "double", count: 2, offset: 0, length: 3, line: 1, character: 2 });
    const error = YamlStyleConflictError.make({ conflicts: [StyleConflict.make({ rule: tally.rule, dimension: tally.dimension, candidates: [tally] })] });
    assert.strictEqual(error.message, 'Conflicting style for quoted-strings.quoteType: "double" (2×, first at 2:3)');
    assert.strictEqual(Reflect.getPrototypeOf(Reflect.construct(YamlLint, [])), YamlLint.prototype);
  }));
});
