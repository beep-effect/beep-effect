import { fcRuns } from "@beep/fc-runs";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import { WellFormedText } from "@beep/schema/WellFormedText";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

describe("CanonicalHashSet", () => {
  const Members = CanonicalHashSet(WellFormedText);
  const encode = S.encodeResult(Members);
  const decode = S.decodeUnknownResult(Members);

  it("encodes members ascending and decodes any order with repeats", () => {
    assertSuccess(encode(HashSet.make("b", "c", "a")), ["a", "b", "c"]);
    const decoded = Result.getOrThrow(decode(["c", "a", "c", "b"]));
    assert.strictEqual(HashSet.size(decoded), 3);
    assertSuccess(encode(decoded), ["a", "b", "c"]);
  });

  it("refuses a member its item schema refuses", () => {
    assertTrue(decode(["a", "\uD800"]).pipe(Result.isFailure));
  });

  it.prop(
    "the encoded form is strictly ascending and equal sets encode alike",
    [Members],
    ([members]) => {
      const encoded = members.pipe(encode, Result.getOrThrow);
      assert.deepStrictEqual(encoded, A.dedupe(A.sort(encoded, Order.String)));
      const rebuilt = Result.getOrThrow(decode(A.appendAll(A.reverse(encoded), encoded)));
      assertTrue(S.toEquivalence(Members)(rebuilt, members));
      assertSuccess(encode(rebuilt), encoded);
    },
    runs
  );
});
