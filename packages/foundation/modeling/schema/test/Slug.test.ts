import { Slug } from "@beep/schema/Slug";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const decodeUnknownSlugSync = S.decodeUnknownSync(Slug);
const isSlug2 = S.is(Slug);
const SlugPayload = S.Struct({ slug: Slug });
const decodeSlugPayloadSync = S.decodeSync(SlugPayload);

describe("Slug", () => {
  it("accepts lowercase kebab-case slugs", () => {
    expect(decodeUnknownSlugSync("a")).toBe("a");
    expect(decodeUnknownSlugSync("my-post")).toBe("my-post");
    expect(decodeUnknownSlugSync("post-2")).toBe("post-2");
    expect(decodeUnknownSlugSync("abc-123-def")).toBe("abc-123-def");
  });

  it("rejects empty input", () => {
    expect(() => decodeUnknownSlugSync("")).toThrow();
  });

  it("rejects characters outside lowercase ascii letters, digits, and hyphens", () => {
    expect(() => decodeUnknownSlugSync("My-Post")).toThrow(
      "Slug must use lowercase ASCII letters, digits, and hyphens only"
    );
    expect(() => decodeUnknownSlugSync("my_post")).toThrow(
      "Slug must use lowercase ASCII letters, digits, and hyphens only"
    );
    expect(() => decodeUnknownSlugSync("my post")).toThrow(
      "Slug must use lowercase ASCII letters, digits, and hyphens only"
    );
    expect(() => decodeUnknownSlugSync("blog/post")).toThrow(
      "Slug must use lowercase ASCII letters, digits, and hyphens only"
    );
    expect(() => decodeUnknownSlugSync("post!")).toThrow(
      "Slug must use lowercase ASCII letters, digits, and hyphens only"
    );
    expect(() => decodeUnknownSlugSync("café")).toThrow(
      "Slug must use lowercase ASCII letters, digits, and hyphens only"
    );
  });

  it("rejects leading and trailing hyphens", () => {
    expect(() => decodeUnknownSlugSync("-post")).toThrow("Slug must not start with a hyphen");
    expect(() => decodeUnknownSlugSync("post-")).toThrow("Slug must not end with a hyphen");
  });

  it("rejects repeated hyphens", () => {
    expect(() => decodeUnknownSlugSync("my--post")).toThrow("Slug must not contain repeated hyphens");
  });

  it("supports guard-style schema checks", () => {
    expect(isSlug2("my-post")).toBe(true);
    expect(isSlug2("my_post")).toBe(false);
  });

  it("reports nested field failures at the slug key", () => {
    expect(() => decodeSlugPayloadSync({ slug: "my_post" })).toThrow(`at ["slug"]`);
  });
});
