import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Public from "../../effected/github-references/index.ts";
import * as Lists from "../../effected/github-references/ClosingList.ts";
import * as Issues from "../../effected/github-references/IssueReferences.ts";
import * as Families from "../../effected/github-references/KeywordFamily.ts";
describe("github-references public barrel", () => {
  it.effect("reexports every owned public value with its original identity", () => Effect.sync(() => {
    const expected = { ...Lists, ...Issues, ...Families };
    assert.deepStrictEqual(Object.keys(Public).sort(), Object.keys(expected).sort());
    for (const key of Object.keys(expected)) {
      assert.strictEqual(Reflect.get(Public, key), Reflect.get(expected, key));
    }
    assert.strictEqual(Public.keywordFamily("references"), "ref");
  }));
});
