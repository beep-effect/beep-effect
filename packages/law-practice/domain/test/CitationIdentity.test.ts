import { CitationAuthorityId, CitationMentionId } from "@beep/law-practice-domain/values";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const digest = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const mention = `cm1:${digest}` as const;
const authority = `ca1:${digest}` as const;

describe("document-local citation identity schemas", () => {
  it.effect("round-trips opaque tokens through their own codecs", () =>
    Effect.gen(function* () {
      const decodedMention = yield* S.decodeEffect(CitationMentionId)(mention);
      const decodedAuthority = yield* S.decodeEffect(CitationAuthorityId)(authority);
      expect(yield* S.encodeEffect(CitationMentionId)(decodedMention)).toBe(mention);
      expect(yield* S.encodeEffect(CitationAuthorityId)(decodedAuthority)).toBe(authority);
      expect(S.is(CitationAuthorityId)(decodedMention)).toBe(false);
      expect(S.is(CitationMentionId)(decodedAuthority)).toBe(false);
      expect(S.is(LawPractice.CitationId)(decodedMention)).toBe(false);
      expect(S.is(LawPractice.CitationId)(decodedAuthority)).toBe(false);
    })
  );

  it("delegates complete digest validation to the shared hexadecimal schema", () => {
    for (const invalid of [
      "",
      "c0",
      `cm1:${Str.toUpperCase(digest)}`,
      `cm1:${digest}0`,
      `cm1:${Str.slice(1)(digest)}`,
      `cm1:${Str.repeat(64)("g")}`,
      authority,
      `cm2:${digest}`,
    ]) {
      expect(Result.isFailure(S.decodeUnknownResult(CitationMentionId)(invalid))).toBe(true);
    }
    for (const invalid of [
      mention,
      `ca1:${Str.toUpperCase(digest)}`,
      `ca1:${digest}0`,
      `ca1:${Str.slice(1)(digest)}`,
      `ca2:${digest}`,
    ]) {
      expect(Result.isFailure(S.decodeUnknownResult(CitationAuthorityId)(invalid))).toBe(true);
    }
  });

  it("keeps occurrence, authority and persisted entity brands disjoint", () => {
    const occurrenceIsDistinct: [CitationMentionId] extends [CitationAuthorityId] ? false : true = true;
    const authorityIsDistinct: [CitationAuthorityId] extends [CitationMentionId] ? false : true = true;
    const occurrenceIsNotEntity: [CitationMentionId] extends [LawPractice.CitationId] ? false : true = true;
    const authorityIsNotEntity: [CitationAuthorityId] extends [LawPractice.CitationId] ? false : true = true;
    expect([occurrenceIsDistinct, authorityIsDistinct, occurrenceIsNotEntity, authorityIsNotEntity]).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });
});
