import { Slug } from "@beep/schema/Slug";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeUnknownSlugEffect = S.decodeUnknownEffect(Slug);
const isSlug2 = S.is(Slug);
const SlugPayload = S.Struct({ slug: Slug });
const decodeSlugPayloadEffect = S.decodeEffect(SlugPayload);

describe("Slug", () => {
  it.effect(
    "accepts lowercase kebab-case slugs",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownSlugEffect("a")).toBe("a");
      expect(yield* decodeUnknownSlugEffect("my-post")).toBe("my-post");
      expect(yield* decodeUnknownSlugEffect("post-2")).toBe("post-2");
      expect(yield* decodeUnknownSlugEffect("abc-123-def")).toBe("abc-123-def");
    })
  );

  it.effect(
    "rejects empty input",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownSlugEffect(""));
      expect(Result.isFailure(failure1)).toBe(true);
    })
  );

  it.effect(
    "rejects characters outside lowercase ascii letters, digits, and hyphens",
    Effect.fnUntraced(function* () {
      const failure2 = yield* Effect.result(decodeUnknownSlugEffect("My-Post"));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain("Slug must use lowercase ASCII letters, digits, and hyphens only");
      }
      const failure3 = yield* Effect.result(decodeUnknownSlugEffect("my_post"));
      expect(Result.isFailure(failure3)).toBe(true);
      if (Result.isFailure(failure3)) {
        expect(failure3.failure.message).toContain("Slug must use lowercase ASCII letters, digits, and hyphens only");
      }
      const failure4 = yield* Effect.result(decodeUnknownSlugEffect("my post"));
      expect(Result.isFailure(failure4)).toBe(true);
      if (Result.isFailure(failure4)) {
        expect(failure4.failure.message).toContain("Slug must use lowercase ASCII letters, digits, and hyphens only");
      }
      const failure5 = yield* Effect.result(decodeUnknownSlugEffect("blog/post"));
      expect(Result.isFailure(failure5)).toBe(true);
      if (Result.isFailure(failure5)) {
        expect(failure5.failure.message).toContain("Slug must use lowercase ASCII letters, digits, and hyphens only");
      }
      const failure6 = yield* Effect.result(decodeUnknownSlugEffect("post!"));
      expect(Result.isFailure(failure6)).toBe(true);
      if (Result.isFailure(failure6)) {
        expect(failure6.failure.message).toContain("Slug must use lowercase ASCII letters, digits, and hyphens only");
      }
      const failure7 = yield* Effect.result(decodeUnknownSlugEffect("café"));
      expect(Result.isFailure(failure7)).toBe(true);
      if (Result.isFailure(failure7)) {
        expect(failure7.failure.message).toContain("Slug must use lowercase ASCII letters, digits, and hyphens only");
      }
    })
  );

  it.effect(
    "rejects leading and trailing hyphens",
    Effect.fnUntraced(function* () {
      const failure8 = yield* Effect.result(decodeUnknownSlugEffect("-post"));
      expect(Result.isFailure(failure8)).toBe(true);
      if (Result.isFailure(failure8)) {
        expect(failure8.failure.message).toContain("Slug must not start with a hyphen");
      }
      const failure9 = yield* Effect.result(decodeUnknownSlugEffect("post-"));
      expect(Result.isFailure(failure9)).toBe(true);
      if (Result.isFailure(failure9)) {
        expect(failure9.failure.message).toContain("Slug must not end with a hyphen");
      }
    })
  );

  it.effect(
    "rejects repeated hyphens",
    Effect.fnUntraced(function* () {
      const failure10 = yield* Effect.result(decodeUnknownSlugEffect("my--post"));
      expect(Result.isFailure(failure10)).toBe(true);
      if (Result.isFailure(failure10)) {
        expect(failure10.failure.message).toContain("Slug must not contain repeated hyphens");
      }
    })
  );

  it("supports guard-style schema checks", () => {
    expect(isSlug2("my-post")).toBe(true);
    expect(isSlug2("my_post")).toBe(false);
  });

  it.effect(
    "reports nested field failures at the slug key",
    Effect.fnUntraced(function* () {
      const failure11 = yield* Effect.result(decodeSlugPayloadEffect({ slug: "my_post" }));
      expect(Result.isFailure(failure11)).toBe(true);
      if (Result.isFailure(failure11)) {
        expect(failure11.failure.message).toContain(`at ["slug"]`);
      }
    })
  );
});
