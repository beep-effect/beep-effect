import { fcRuns } from "@beep/fc-runs";
import { ActivityId, ContentHash, DomainTag } from "@beep/schema/ContentHash";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { assert, describe, it } from "@effect/vitest";
import { assertFalse, assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };

const emptyDigest = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("ContentHash", () => {
  it("brands the prefixed SHA-256 digest grammar", () => {
    const isContentHash = S.is(ContentHash);
    assertTrue(isContentHash(emptyDigest));
    assertFalse(isContentHash(Str.slice(7)(emptyDigest)));
    assertFalse(isContentHash(Str.toUpperCase(emptyDigest)));
    assertTrue(S.is(Sha256PrefixedDigest)(ContentHash.make(emptyDigest)));
  });

  it("brands an activity id over a content hash with the same encoding", () => {
    const id = ActivityId.make(ContentHash.make(emptyDigest));
    assertTrue(S.is(ContentHash)(id));
    assertSuccess(S.encodeResult(ActivityId)(id), emptyDigest);
  });

  it("accepts only versioned lowercase domain tags", () => {
    const isDomainTag = S.is(DomainTag);
    assert.deepStrictEqual(
      A.map(
        ["activity/v1", "quote-key/v12", "activity/v0", "activity/v01", "Activity/v1", "activity", "-x/v1"],
        isDomainTag
      ),
      [true, true, false, false, false, false, false]
    );
  });

  it.prop(
    "content hashes round-trip with their encoded bytes unchanged",
    [ContentHash],
    ([hash]) => assertSuccess(S.encodeResult(ContentHash)(hash), hash),
    runs
  );
});
