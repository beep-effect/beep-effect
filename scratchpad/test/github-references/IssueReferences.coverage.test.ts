import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { CLOSING_KEYWORDS, harvestIssueReferences, parseBareLineReference } from "../../effected/github-references/IssueReferences.ts";
describe("IssueReferences regex-guaranteed fields", () => {
  it.effect("derives canonical keywords and safe numbers from every supported full match", () => Effect.sync(() => {
    for (const keyword of CLOSING_KEYWORDS) {
      const text = keyword.toUpperCase() + "\t#00012";
      assert.deepStrictEqual(harvestIssueReferences(text), [{ keyword, issueNumber: 12, start: 0, end: text.length }]);
      const bare = parseBareLineReference(" " + keyword.toUpperCase() + ":\t#00012 ");
      assertSome(bare, { keyword, issueNumber: 12 });
      assertNone(parseBareLineReference(keyword + " #9007199254740992"));
    }
    assert.deepStrictEqual(harvestIssueReferences("fixes\n#0; fixes #9007199254740992; closes #9007199254740991"), [
      { keyword: "fixes", issueNumber: 0, start: 0, end: 8 },
      { keyword: "closes", issueNumber: 9007199254740991, start: 35, end: 59 },
    ]);
  }));
});
