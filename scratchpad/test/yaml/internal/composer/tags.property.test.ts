import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as S from "effect/Schema";
import { composeFlowMap, composeFlowSeq } from "../../../../effected/yaml/internal/composer/flow.ts";
import { createState } from "../../../../effected/yaml/internal/composer/state.ts";
import { parseDirective, resolveTagHandle } from "../../../../effected/yaml/internal/composer/tags.ts";

const runs = { arbitrary: fcRuns(100) };
const word = S.Literals(["A", "B", "C", "0", "1"]).pipe(S.Array, Arbitrary.schema, Arbitrary.map((value) => `D${value.join("")}`));
describe("tag parser properties", () => {
  it.effect.prop("directive canonical rendering is idempotent and preserves parsed names and parameters", [Arbitrary.schema(S.String)], ([source]) => Effect.sync(() => {
    const input = `%${source}`;
    const parsed = parseDirective(input);
    if (parsed === null) {
      assert.strictEqual(parseDirective(input.trim()), null);
    } else {
      const canonical = `%${[parsed.name, ...parsed.parameters].join(" ")}`;
      const reparsed = parseDirective(canonical);
      assert.deepStrictEqual(reparsed, parsed);
      if (reparsed !== null) assert.strictEqual(`%${[reparsed.name, ...reparsed.parameters].join(" ")}`, canonical);
    }
  }), runs);
  it.effect.prop("directive parsing retains parameters but discards only the trailing comment", [word, S.Literals(["alpha", "beta", "1.2", "!app!", "urn:app"]).pipe(S.Array, Arbitrary.schema), Arbitrary.schema(S.String)], ([name, parameters, comment]) => Effect.sync(() => {
    const text = `%${name} ${parameters.join("\t")} # ${comment.replaceAll("\n", " ")}`;
    assert.deepStrictEqual(parseDirective(text), { name, parameters });
  }), runs);
  it.effect.prop("percent-encoded suffixes resolve faithfully and resolved URIs are idempotent", [Arbitrary.schema(S.String).pipe(Arbitrary.filter((value) => value.isWellFormed()))], ([suffix]) => Effect.sync(() => {
    const state = createState("", { composeFlowMap, composeFlowSeq });
    MutableHashMap.set(state.tagMap, "!app!", "urn:app:");
    const resolved = resolveTagHandle(`!app!${encodeURIComponent(suffix)}`, state);
    assert.strictEqual(resolved, `urn:app:${suffix}`);
    assert.strictEqual(resolveTagHandle(resolved, state), resolved);
    assert.strictEqual(resolveTagHandle(`!<${resolved}>`, state), resolved);
    assert.deepStrictEqual(state.errors, []);
  }), runs);
});
