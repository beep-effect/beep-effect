import { StyleEvidence, Yaml, YamlLint } from "@beep/yaml";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Result from "effect/Result";

const values: ReadonlyArray<unknown> = [
  { name: "alice", age: 30, admin: true },
  { deps: { a: "*", b: ">=1.2.3" }, scripts: { test: "vitest run", lint: "biome check" } },
  { list: [1, 2, 3], nested: { seq: ["a", "b", "c"], map: { deep: { deeper: "still" } } } },
  { steps: [{ run: "build" }, { run: "test", env: { CI: "true" } }] },
  { text: "line one\nline two\n", note: "needs: quoting" },
  { empty: {}, emptyList: [], nul: null, pi: 3.14 },
];

describe("e2e: strict inference over the stringifier's own value-path emit (#345)", () => {
  it("unanimous evidence out of our own emit — or the stringifier disagrees with itself", () => {
    let evidence = StyleEvidence.empty;
    for (const value of values) {
      const emitted = Yaml.stringifyResult(value);
      assertSuccess(emitted, Result.getOrThrow(emitted));
      if (Result.isSuccess(emitted)) {
        evidence = StyleEvidence.combine(evidence, YamlLint.observe(emitted.success, YamlLint.builtins));
      }
    }
    const voted = new Set(A.map(evidence.votes, (v) => `${v.rule}.${v.dimension}`));
    assert.isTrue(voted.has("quoted-strings.quoteType"), "corpus must produce quote-style votes");
    assert.isTrue(voted.has("indentation.spaces"), "corpus must produce indent-unit votes");
    assert.isTrue(voted.has("indentation.indentSequences"), "corpus must produce sequence-policy votes");
    assert.isTrue(voted.has("document-start.present"), "corpus must produce start-marker votes");
    assert.isTrue(voted.has("document-end.present"), "corpus must produce end-marker votes");

    const resolved = YamlLint.resolveStrict(evidence);
    assertSuccess(resolved, Result.getOrThrow(resolved));
    if (Result.isSuccess(resolved)) {
      assert.deepStrictEqual(resolved.success.rules["quoted-strings"], { quoteType: "single" });
      assert.deepStrictEqual(resolved.success.rules.indentation, { indentSequences: false, spaces: 2 });
      assert.deepStrictEqual(resolved.success.rules["document-start"], { present: false });
      assert.deepStrictEqual(resolved.success.rules["document-end"], { present: false });
    }
  });
});
