import { REFERENCE_KEYWORDS } from "@beep/github-references/ClosingList";
import { CLOSING_KEYWORDS } from "@beep/github-references/IssueReferences";
import { KeywordFamily, keywordFamily } from "@beep/github-references/KeywordFamily";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { ReferenceKeyword } from "@beep/github-references/ClosingList";
import type { ClosingKeyword } from "@beep/github-references/IssueReferences";

describe("KeywordFamily.keywordFamily: pure functions get pure tests, with no layer at all", () => {
  it("defines exactly the four schema families reached by the twelve keywords", () => {
    assert.deepStrictEqual(KeywordFamily.literals, ["close", "fix", "resolve", "ref"]);
    assert.deepStrictEqual(R.values(KeywordFamily.Enum), [...KeywordFamily.literals]);
    for (const keyword of [...CLOSING_KEYWORDS, ...REFERENCE_KEYWORDS]) {
      assert.isTrue(S.is(KeywordFamily)(keywordFamily(keyword)), keyword);
    }
    for (const invalid of ["closes", "refs", "constructor", "toString", "__proto__"]) {
      assert.isFalse(S.is(KeywordFamily)(invalid), invalid);
    }
  });

  it("maps all twelve keywords — the projection is exhaustive, restated row by row so a drifted source entry fails by keyword", () => {
    const expected: ReadonlyArray<readonly [ClosingKeyword | ReferenceKeyword, KeywordFamily]> = [
      ["close", "close"],
      ["closes", "close"],
      ["closed", "close"],
      ["fix", "fix"],
      ["fixes", "fix"],
      ["fixed", "fix"],
      ["resolve", "resolve"],
      ["resolves", "resolve"],
      ["resolved", "resolve"],
      ["ref", "ref"],
      ["refs", "ref"],
      ["references", "ref"],
    ];
    assert.deepStrictEqual(
      A.map(expected, ([keyword]) => keyword),
      [...CLOSING_KEYWORDS, ...REFERENCE_KEYWORDS]
    );
    for (const [keyword, family] of expected) {
      assert.strictEqual(keywordFamily(keyword), family, keyword);
    }
  });

  it("collapses each closing conjugation to its stem", () => {
    for (const keyword of CLOSING_KEYWORDS) {
      const family = keywordFamily(keyword);
      assert.isTrue(Str.startsWith(family)(keyword), keyword);
      assert.notStrictEqual(family, "ref", keyword);
    }
  });

  it("maps every reference keyword to the ref family", () => {
    for (const keyword of REFERENCE_KEYWORDS) {
      assert.strictEqual(keywordFamily(keyword), "ref", keyword);
    }
  });
});
