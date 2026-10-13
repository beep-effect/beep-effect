import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { harvestReferenceLists, parseReferenceList } from "../../effected/github-references/ClosingList.ts";
describe("ClosingList whitespace branch coverage", () => {
  it.effect("admits control and U+2000–U+200A whitespace in the opening gap only", () => Effect.sync(() => {
    for (const gap of ["\t", "\n", "\v", "\f", "\r", "\u2000", "\u2005", "\u200a"]) {
      const text = "refs" + gap + "#7";
      assert.deepStrictEqual(harvestReferenceLists(text), [{ keyword: "refs", closing: false, issueNumbers: [7], start: 0, end: text.length }]);
    }
    assert.deepStrictEqual(harvestReferenceLists("refs\b#7"), []);
    assertSome(parseReferenceList("refs\t#7"), { keyword: "refs", closing: false, issueNumbers: [7] });
    assertNone(parseReferenceList("refs\v#7"));
  }));
});
