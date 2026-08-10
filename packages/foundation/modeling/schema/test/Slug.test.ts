import { Slug } from "@beep/schema/Slug";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

describe("Slug", () => {
  const decode = S.decodeUnknownSync(Slug);

  it("accepts lowercase kebab-case slugs", () => {
    expect(decode("a")).toBe("a");
    expect(decode("my-post")).toBe("my-post");
    expect(decode("post-2")).toBe("post-2");
    expect(decode("abc-123-def")).toBe("abc-123-def");
  });

  it("rejects empty input", () => {
    expect(() => decode("")).toThrow();
  });

  it("rejects characters outside lowercase ascii letters, digits, and hyphens", () => {
    expect(() => decode("My-Post")).toThrow("Slug must use lowercase ASCII letters, digits, and hyphens only");
    expect(() => decode("my_post")).toThrow("Slug must use lowercase ASCII letters, digits, and hyphens only");
    expect(() => decode("my post")).toThrow("Slug must use lowercase ASCII letters, digits, and hyphens only");
    expect(() => decode("blog/post")).toThrow("Slug must use lowercase ASCII letters, digits, and hyphens only");
    expect(() => decode("post!")).toThrow("Slug must use lowercase ASCII letters, digits, and hyphens only");
    expect(() => decode("café")).toThrow("Slug must use lowercase ASCII letters, digits, and hyphens only");
  });

  it("rejects leading and trailing hyphens", () => {
    expect(() => decode("-post")).toThrow("Slug must not start with a hyphen");
    expect(() => decode("post-")).toThrow("Slug must not end with a hyphen");
  });

  it("rejects repeated hyphens", () => {
    expect(() => decode("my--post")).toThrow("Slug must not contain repeated hyphens");
  });

  it("supports guard-style schema checks", () => {
    const isSlug = S.is(Slug);

    expect(isSlug("my-post")).toBe(true);
    expect(isSlug("my_post")).toBe(false);
  });

  it("reports nested field failures at the slug key", () => {
    const Payload = S.Struct({
      slug: Slug,
    });

    expect(() => S.decodeSync(Payload)({ slug: "my_post" })).toThrow(`at ["slug"]`);
  });
});
