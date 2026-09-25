import { Slug } from "@beep/schema/Slug";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
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
      const failure1 = yield* Effect.exit(decodeUnknownSlugEffect(""));
      pipe(failure1, Exit.hasFails, assertTrue);
    })
  );

  it.effect(
    "rejects characters outside lowercase ascii letters, digits, and hyphens",
    Effect.fnUntraced(function* () {
      const failure2 = yield* Effect.exit(decodeUnknownSlugEffect("My-Post"));
      pipe(failure2, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure2)) {
        expect(pipe(failure2.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Slug must use lowercase ASCII letters, digits, and hyphens only"
        );
      }
      const failure3 = yield* Effect.exit(decodeUnknownSlugEffect("my_post"));
      pipe(failure3, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure3)) {
        expect(pipe(failure3.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Slug must use lowercase ASCII letters, digits, and hyphens only"
        );
      }
      const failure4 = yield* Effect.exit(decodeUnknownSlugEffect("my post"));
      pipe(failure4, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure4)) {
        expect(pipe(failure4.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Slug must use lowercase ASCII letters, digits, and hyphens only"
        );
      }
      const failure5 = yield* Effect.exit(decodeUnknownSlugEffect("blog/post"));
      pipe(failure5, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure5)) {
        expect(pipe(failure5.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Slug must use lowercase ASCII letters, digits, and hyphens only"
        );
      }
      const failure6 = yield* Effect.exit(decodeUnknownSlugEffect("post!"));
      pipe(failure6, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure6)) {
        expect(pipe(failure6.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Slug must use lowercase ASCII letters, digits, and hyphens only"
        );
      }
      const failure7 = yield* Effect.exit(decodeUnknownSlugEffect("café"));
      pipe(failure7, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure7)) {
        expect(pipe(failure7.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Slug must use lowercase ASCII letters, digits, and hyphens only"
        );
      }
    })
  );

  it.effect(
    "rejects leading and trailing hyphens",
    Effect.fnUntraced(function* () {
      const failure8 = yield* Effect.exit(decodeUnknownSlugEffect("-post"));
      pipe(failure8, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure8)) {
        expect(pipe(failure8.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Slug must not start with a hyphen"
        );
      }
      const failure9 = yield* Effect.exit(decodeUnknownSlugEffect("post-"));
      pipe(failure9, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure9)) {
        expect(pipe(failure9.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Slug must not end with a hyphen"
        );
      }
    })
  );

  it.effect(
    "rejects repeated hyphens",
    Effect.fnUntraced(function* () {
      const failure10 = yield* Effect.exit(decodeUnknownSlugEffect("my--post"));
      pipe(failure10, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure10)) {
        expect(pipe(failure10.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Slug must not contain repeated hyphens"
        );
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
      const failure11 = yield* Effect.exit(decodeSlugPayloadEffect({ slug: "my_post" }));
      pipe(failure11, Exit.hasFails, assertTrue);
      if (Exit.hasFails(failure11)) {
        expect(pipe(failure11.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(`at ["slug"]`);
      }
    })
  );
});
